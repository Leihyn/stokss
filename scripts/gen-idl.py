#!/usr/bin/env python3
"""Generate the Anchor IDL for stokss directly, without `anchor build`'s IDL path.

WHY THIS EXISTS
---------------
`anchor build` generates the IDL by recompiling the crate with
`--cfg procmacro2_semver_exempt`, which needs `proc_macro::Span::source_file`. That compiler
API is gone, so proc-macro2 versions new enough to build on a current rustc no longer expose
it, and anchor-syn 0.30.1 fails with `no method named source_file`. Pinning proc-macro2 back
far enough to satisfy anchor-syn then breaks ark-bn254's `MontFp!` macro, which panics with
"could not parse". There is no version that satisfies both, and `anchor idl build` is the
same code path, so it fails identically.

The program binary is unaffected: `anchor build --no-idl` produces target/deploy/stokss.so
normally. Only the IDL generation is blocked.

CORRECTNESS
-----------
Discriminators are not guessed. Anchor derives them as:
    instruction : sha256("global:"  + snake_case_name)[0..8]
    account     : sha256("account:" + PascalName)[0..8]
    event       : sha256("event:"   + PascalName)[0..8]
This script computes them the same way, so a client built from this IDL produces byte-identical
instruction data to one built from a compiler-generated IDL.

The account lists, argument types and field layouts below are transcribed from the Rust source
in programs/stokss/src/. If you change a #[derive(Accounts)] struct, change it here too, and
re-run. Regenerate with the compiler instead as soon as the toolchain allows.
"""
import hashlib, json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def disc(prefix: str, name: str) -> list:
    return list(hashlib.sha256(f"{prefix}:{name}".encode()).digest()[:8])


def acct(name, writable=False, signer=False, address=None, pda=None):
    d = {"name": name}
    if writable:
        d["writable"] = True
    if signer:
        d["signer"] = True
    if address:
        d["address"] = address
    if pda:
        d["pda"] = pda
    return d


def seed_const(text):
    return {"kind": "const", "value": list(text.encode())}


def seed_acct(path):
    return {"kind": "account", "path": path}


CONFIG_PDA = {"seeds": [seed_const("config")]}


def plan_pda(owner_path):
    return {"seeds": [seed_const("plan"), seed_acct(owner_path), seed_acct("plan.mint")]}


program_id = subprocess.run(
    ["solana", "address", "-k", str(ROOT / "target/deploy/stokss-keypair.json")],
    capture_output=True, text=True, check=True,
).stdout.strip()

instructions = [
    {
        "name": "initialize_config",
        "discriminator": disc("global", "initialize_config"),
        "accounts": [
            acct("admin", writable=True, signer=True),
            acct("config", writable=True, pda=CONFIG_PDA),
            acct("system_program", address="11111111111111111111111111111111"),
        ],
        "args": [
            {"name": "keeper", "type": "pubkey"},
            {"name": "fee_bps", "type": "u16"},
            {"name": "payout_floor_usdc", "type": "u64"},
        ],
    },
    {
        "name": "set_paused",
        "discriminator": disc("global", "set_paused"),
        "accounts": [acct("admin", signer=True), acct("config", writable=True, pda=CONFIG_PDA)],
        "args": [{"name": "paused", "type": "bool"}],
    },
    {
        "name": "enroll",
        "discriminator": disc("global", "enroll"),
        "accounts": [
            acct("owner", writable=True, signer=True),
            acct("mint"),
            acct("destination"),
            acct("plan", writable=True,
                 pda={"seeds": [seed_const("plan"), seed_acct("owner"), seed_acct("mint")]}),
            acct("system_program", address="11111111111111111111111111111111"),
        ],
        "args": [{"name": "mode", "type": {"defined": {"name": "PayoutMode"}}}],
    },
    {
        "name": "harvest",
        "discriminator": disc("global", "harvest"),
        "accounts": [
            acct("keeper", writable=True, signer=True),
            acct("config", pda=CONFIG_PDA),
            acct("plan", writable=True, pda=plan_pda("plan.owner")),
            acct("mint"),
            acct("mint_raw"),
            acct("holder_ata", writable=True),
            acct("collection_ata", writable=True),
            acct("harvest_authority", pda={"seeds": [seed_const("harvest_authority")]}),
            acct("token_program", address="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
        ],
        "args": [],
    },
    {
        "name": "settle",
        "discriminator": disc("global", "settle"),
        "accounts": [
            acct("keeper", writable=True, signer=True),
            acct("config", pda=CONFIG_PDA),
            acct("plan", writable=True, pda=plan_pda("plan.owner")),
            acct("keeper_usdc", writable=True),
            acct("destination", writable=True),
            acct("usdc_mint"),
            acct("receipt", writable=True),
            acct("token_program"),
            acct("system_program", address="11111111111111111111111111111111"),
        ],
        "args": [
            {"name": "usdc_amount", "type": "u64"},
            {"name": "delta_raw_settled", "type": "u64"},
        ],
    },
    {
        "name": "close_plan",
        "discriminator": disc("global", "close_plan"),
        "accounts": [
            acct("owner", writable=True, signer=True),
            acct("plan", writable=True,
                 pda={"seeds": [seed_const("plan"), seed_acct("owner"), seed_acct("plan.mint")]}),
        ],
        "args": [],
    },
]

accounts = [
    {"name": "Config", "discriminator": disc("account", "Config")},
    {"name": "UserPlan", "discriminator": disc("account", "UserPlan")},
    {"name": "HarvestReceipt", "discriminator": disc("account", "HarvestReceipt")},
]

events = [
    {"name": "Enrolled", "discriminator": disc("event", "Enrolled")},
    {"name": "Harvested", "discriminator": disc("event", "Harvested")},
    {"name": "Settled", "discriminator": disc("event", "Settled")},
    {"name": "PlanClosed", "discriminator": disc("event", "PlanClosed")},
]

ERRORS = [
    "Program is paused",
    "Only the configured keeper may call this",
    "Plan is closed",
    "Mint is not a Token-2022 mint",
    "Mint has no ScaledUiAmount extension",
    "Mint account data is malformed",
    "Multiplier has not increased since the last harvest; nothing to do",
    "Computed delta is zero",
    "Multiplier moved backwards, which indicates a reverse split, not a dividend",
    "Multiplier jumped further than any observed dividend; this looks like a split",
    "Settle amount exceeds what this plan is owed",
    "Nothing pending to settle",
    "Arithmetic overflow",
]
ERROR_NAMES = [
    "Paused", "NotKeeper", "PlanClosed", "NotToken2022", "NoScaledUiExtension",
    "MalformedMint", "NoTick", "ZeroDelta", "MultiplierDecreased", "TickTooLarge",
    "OverSettle", "NothingPending", "Overflow",
]
errors = [{"code": 6000 + i, "name": n, "msg": m}
          for i, (n, m) in enumerate(zip(ERROR_NAMES, ERRORS))]


def struct(name, fields):
    return {"name": name, "type": {"kind": "struct",
                                   "fields": [{"name": n, "type": t} for n, t in fields]}}


types = [
    struct("Config", [
        ("admin", "pubkey"), ("keeper", "pubkey"), ("fee_bps", "u16"),
        ("payout_floor_usdc", "u64"), ("paused", "bool"), ("bump", "u8"),
    ]),
    {"name": "PayoutMode",
     "type": {"kind": "enum", "variants": [{"name": "Cash"}, {"name": "Bill"}]}},
    struct("UserPlan", [
        ("owner", "pubkey"), ("mint", "pubkey"), ("destination", "pubkey"),
        ("mode", {"defined": {"name": "PayoutMode"}}),
        ("last_multiplier_bits", "u64"), ("pending_raw", "u64"),
        ("pending_m0_bits", "u64"), ("pending_m1_bits", "u64"),
        ("pending_activation_ts", "i64"),
        ("accrued_usdc", "u64"), ("total_paid_usdc", "u64"),
        ("harvest_count", "u32"), ("closed", "bool"), ("bump", "u8"),
    ]),
    struct("HarvestReceipt", [
        ("plan", "pubkey"), ("mint", "pubkey"), ("m0_bits", "u64"), ("m1_bits", "u64"),
        ("delta_raw", "u64"), ("usdc_paid", "u64"), ("tick_activation_ts", "i64"),
        ("settled_ts", "i64"), ("bump", "u8"),
    ]),
    struct("Enrolled", [("owner", "pubkey"), ("mint", "pubkey"),
                        ("multiplier_bits", "u64"), ("ts", "i64")]),
    struct("Harvested", [("owner", "pubkey"), ("mint", "pubkey"), ("m0_bits", "u64"),
                         ("m1_bits", "u64"), ("delta_raw", "u64"),
                         ("batch_pending_raw", "u64"), ("ts", "i64")]),
    struct("Settled", [("owner", "pubkey"), ("mint", "pubkey"), ("delta_raw", "u64"),
                       ("usdc_paid", "u64"), ("accrued_usdc", "u64"), ("ts", "i64")]),
    struct("PlanClosed", [("owner", "pubkey"), ("mint", "pubkey"),
                          ("total_paid_usdc", "u64"), ("ts", "i64")]),
]

idl = {
    "address": program_id,
    "metadata": {
        "name": "stokss",
        "version": "0.1.0",
        "spec": "0.1.0",
        "description": "Cash dividends for tokenized stocks on Solana",
    },
    "instructions": instructions,
    "accounts": accounts,
    "events": events,
    "errors": errors,
    "types": types,
}

out = ROOT / "target" / "idl"
out.mkdir(parents=True, exist_ok=True)
(out / "stokss.json").write_text(json.dumps(idl, indent=2) + "\n")

print(f"wrote {out / 'stokss.json'}")
print(f"program: {program_id}")
print(f"instructions: {len(instructions)}  accounts: {len(accounts)}  "
      f"events: {len(events)}  errors: {len(errors)}  types: {len(types)}")
print("\ndiscriminators (sha256 derived, not guessed):")
for i in instructions:
    print(f"  {i['name']:20s} {i['discriminator']}")
