import { Connection, PublicKey } from "@solana/web3.js";
import { appendFileSync, writeFileSync } from "node:fs";
import { CONFIG } from "./config.js";

const OUT = "pause-probe.out";
const log = (s: string) => { console.log(s); appendFileSync(OUT, s + "\n"); };
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
/** What "using" a pause/freeze authority actually looks like. */
const COERCIVE = new Set(["freezeAccount","thawAccount","pause","resume","setAuthority",
                          "transfer","transferChecked","transferCheckedWithFee","burn","burnChecked"]);
const BATCH = 10;
const ADDR = "JDq14BWvqCRFNu1krb12bcRpbGtJZ1FLEakMw6FdxJNs";

const to = <T,>(p: Promise<T>, ms: number): Promise<T|null> =>
  Promise.race([p.catch(()=>null), new Promise<null>(r=>setTimeout(()=>r(null), ms))]);

(async()=>{
  writeFileSync(OUT,"");
  const conn = new Connection(CONFIG.rpcUrlMainnet,"confirmed");
  const who = new PublicKey(ADDR);
  log(`${"=".repeat(64)}\nPAUSE + FREEZE AUTHORITY\n${ADDR}\n${"=".repeat(64)}`);

  const info = await conn.getAccountInfo(who);
  log(`account: owner=${info?.owner.toBase58()} space=${info?.data.length} lamports=${info?.lamports}`);
  log(`(space 0 + system owner => plain keypair, NOT an SPL multisig)`);

  const sigs:any[]=[]; let before:string|undefined;
  for(;;){
    const b = await to(conn.getSignaturesForAddress(who,{limit:1000,before}),45_000);
    if(!b||!b.length) break;
    sigs.push(...b); before=b[b.length-1].signature;
    log(`  fetched ${sigs.length} signatures...`);
    if(b.length<1000) break;
  }
  const ok = sigs.filter(s=>!s.err);
  const f=(t?:number|null)=>t?new Date(t*1000).toISOString().slice(0,19):"?";
  log(`signatures: ${sigs.length} total, ${ok.length} successful, ${sigs.length-ok.length} failed`);
  log(`range: ${f(sigs[sigs.length-1]?.blockTime)}  ->  ${f(sigs[0]?.blockTime)}`);

  const t22kinds=new Map<string,number>(), progs=new Map<string,number>();
  const hits:any[]=[]; let decoded=0, unresolved=0;
  for(let i=0;i<ok.length;i+=BATCH){
    const batch = ok.slice(i,i+BATCH).map(s=>s.signature);
    let txs:any=null;
    for(let a=0;a<4 && !txs;a++){
      txs = await to(conn.getParsedTransactions(batch,{maxSupportedTransactionVersion:0}),25_000);
      if(!txs) await new Promise(r=>setTimeout(r,800*(a+1)));
    }
    if(!txs){ unresolved+=batch.length; continue; }
    txs.forEach((tx:any,j:number)=>{
      if(!tx){ unresolved++; return; } decoded++;
      const ixs:any[]=[...(tx.transaction.message.instructions as any[]),
        ...((tx.meta?.innerInstructions??[]).flatMap((x:any)=>x.instructions as any[]))];
      for(const ix of ixs){
        const pid = ix.programId?.toBase58?.() ?? String(ix.programId);
        progs.set(pid,(progs.get(pid)??0)+1);
        if(pid!==T22) continue;
        const type = ix.parsed?.type ?? "(unparsed)";
        t22kinds.set(type,(t22kinds.get(type)??0)+1);
        if(!COERCIVE.has(type)) continue;
        const inf = ix.parsed?.info ?? {};
        const auth = inf.authority ?? inf.multisigAuthority ?? inf.owner ?? inf.freezeAuthority ?? "";
        if(auth===ADDR) hits.push({sig:batch[j],type,acct:inf.account,mint:inf.mint,
          newAuth:inf.newAuthority, authType:inf.authorityType, amt:inf.tokenAmount?.uiAmountString??inf.amount});
      }
    });
    if((i/BATCH)%25===0) log(`  progress ${decoded}/${ok.length}, unresolved ${unresolved}, hits ${hits.length}`);
    await new Promise(r=>setTimeout(r,120));
  }
  log(`\nCOVERAGE: decoded ${decoded}/${ok.length} (${ok.length?(decoded/ok.length*100).toFixed(1):0}%), unresolved ${unresolved}`);
  log(`\nPrograms touched:`);
  [...progs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,n])=>log(`  ${k}  ${n}`));
  log(`\nToken-2022 instruction types:`);
  [...t22kinds.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([k,n])=>log(`  ${k.padEnd(34)} ${n}`));
  const byType = new Map<string,number>();
  hits.forEach(h=>byType.set(h.type,(byType.get(h.type)??0)+1));
  log(`\n>>> COERCIVE instructions authorised by this address: ${hits.length}`);
  [...byType.entries()].forEach(([k,n])=>log(`    ${k}: ${n}`));
  const bad = hits.filter(h=>h.type!=="setAuthority");
  log(`>>> Of those, freeze/thaw/pause/resume/transfer/burn (i.e. acting ON a holder): ${bad.length}`);
  bad.slice(0,30).forEach(h=>log(`  ${h.type} mint=${h.mint} acct=${h.acct} amt=${h.amt}\n    ${h.sig}`));
  log("\nDONE");
})().catch(e=>{log("FATAL "+e.message);process.exit(1);});
