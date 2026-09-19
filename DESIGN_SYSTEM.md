# DESIGN_SYSTEM.md — Closing Bell

## Identity

Closing Bell is an instrument, not a landing page. A liquidity provider decides whether to
pull a position based on what this surface tells them, so it has to read like something
you would trust with money: dense, monospaced where numbers are compared, and free of
anything that looks like persuasion.

**The craft standard is adopted wholesale from `../aval/DESIGN_SYSTEM.md`** — the strict
elevation ladder, the zero-shadow rule, five type steps, exactly two radii, colour-only
motion, 44px controls. The brand identity is Closing Bell's own.

**The accent split is the product argument.** Aval's two accents encode what the
counterparty learns versus what the chain learns. Closing Bell's encode the only
distinction that matters here:

- `open` — an hour in which the US equity market prices the underlying.
- `shut` — an hour in which it does not, and in which the issuer will not create or redeem.

A surface is tinted only when it belongs to one of those two states. **The page is amber
far more often than it is green, and that asymmetry is the finding**, not a styling choice.

## Signature element

**The week bar.** 168 cells, one per hour, 32.5 lit and 135.5 unlit, with the current hour
ringed. It states the entire thesis before any sentence does, and it is the only graphic
in the product.

## Tokens

Declared in a Tailwind v4 `@theme` block in `web/app/globals.css`.

### Surfaces — strict elevation ladder

| Token | Value | Role |
|---|---|---|
| `base-950` | `#07080a` | page ground |
| `base-900` | `#0c0e12` | panel surface |
| `base-850` | `#11141a` | raised surface, one step above |
| `base-800` | `#171b23` | hairlines, inner row rules |
| `base-700` | `#222732` | borders |
| `base-600` | `#2f3542` | hover borders, control borders |

### Text

| Token | Value | Role |
|---|---|---|
| `ink-100` | `#ecedf1` | values, emphasis, headings |
| `ink-300` | `#a6abb8` | body prose, labels |
| `ink-500` | `#737988` | glosses, eyebrows, footnotes |

`ink-500` is the dimmest permitted and is never used on `base-800` or on a tinted fill.

### Semantic accents

| Token | Value | Role |
|---|---|---|
| `open-400` / `open-900` | `#3ddc97` / `#06291c` | underlying is priced; a healthy simulation |
| `shut-400` / `shut-900` | `#f2b455` / `#2a1c06` | underlying is unpriced; the exposure window |
| `danger-400` / `danger-900` | `#f2607a` / `#2a0d15` | halted trading; a failed simulation |

### Type scale — five steps and a display step, no others

`text-micro` 11px/1.25/+0.12em · `text-body` 13px/1.6 · `text-value` 14px/1.45 (mono
figures) · `text-read` 15px/1.65 · `text-lede` 17px/1.4 · `text-display` clamp.

### Radii — exactly two

`--radius-control` 8px (buttons, inputs, banners) · `--radius-card` 14px (panels, tables).

> **The v4 trap.** `rounded-[--radius-card]` is Tailwind **v3** syntax. Under v4 it
> compiles to `border-radius: --radius-card`, which is invalid CSS the browser silently
> discards, rendering the element square with no error anywhere. Use the theme-generated
> `rounded-card` / `rounded-control`. The verification below re-derives this from the
> built output.

### Shadows

**None.** Depth is a one-pixel border or a surface-elevation step. Glow reads as
marketing and this surface has to read as an instrument.

## Craft

**Tabular figures.** `.tnum` on every number a viewer compares — session volumes,
volatility columns, countdowns, compute units, position liquidity. Without it the columns
fail to align and the comparison stops being checkable by eye.

**Hover.** Colour shift only, 150ms ease-out. Never scale, never lift, never glow.

**Active.** `active:scale-[0.99]`, the only transform in the product.

**Focus.** One ring everywhere, `2px solid open-400` at `2px` offset. Focus is a property
of the user, not of the surface.

**Controls are 44px.** `h-11`. Do not shrink them.

**Third-party CSS is pulled onto the system.** The wallet adapter ships a shadow, a
gradient and its own radius. All three are overridden in `globals.css` rather than
shipping a second visual language inside the product.

## Rejection list (binding)

No neon. No gradients. No glassmorphism or blur. No emoji. No purple-to-pink crypto
palette. No rounded-everything. No bounce or spring on functional controls. No hero
illustration. No marketing copy in the product surface. **No number that is not read back
from a real measurement or a live feed** — every figure on this page traces to a script in
`crank/` or an on-chain read.

## Verification

Re-derives the claims above from the built output rather than trusting this file.

```bash
cd web && npm run build
CSS=$(find .next/static/chunks -name '*.css' | head -1)

# The v3/v4 radius trap: must return nothing
grep -oE '(border-radius|color|background-color|font-size):--[a-z0-9-]+' "$CSS"

# Shadow philosophy. Hits are permitted ONLY inside transition-property lists and
# Tailwind's own --tw-* custom-property registrations, which draw nothing.
grep -o '.\{0,60\}box-shadow.\{0,50\}' "$CSS"

# The type steps exist
grep -oE '\.text-(micro|body|value|read|lede|display)' "$CSS" | sort -u

# No non-token colour utilities survive in source: must return nothing
grep -rhoE '\b(text|bg|border)-(white|black|amber|emerald|red|slate|gray|zinc)[-/][0-9a-z/.]*' app components
```

Last run: all four clean. Six type steps present, zero bare custom-property values, zero
non-token colour utilities, and every shadow/blur/drop-shadow hit traced to Tailwind
internals rather than an applied style.
