import { Connection, PublicKey } from "@solana/web3.js";
import { appendFileSync, writeFileSync } from "node:fs";
import { CONFIG } from "./config.js";

const OUT = "delegate-probe.out";
const log = (s: string) => { console.log(s); appendFileSync(OUT, s + "\n"); };
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const MOVE = new Set(["transfer","transferChecked","transferCheckedWithFee","burn","burnChecked"]);
const BATCH = 10;

const to = <T,>(p: Promise<T>, ms: number): Promise<T|null> =>
  Promise.race([p.catch(()=>null), new Promise<null>(r=>setTimeout(()=>r(null), ms))]);

async function run(conn: Connection, addr: string, label: string) {
  const who = new PublicKey(addr);
  log(`\n${"=".repeat(64)}\n${label}\n${addr}\n${"=".repeat(64)}`);

  const sigs:any[]=[]; let before:string|undefined;
  for(;;){
    const b = await to(conn.getSignaturesForAddress(who,{limit:1000,before}),45_000);
    if(!b||!b.length) break;
    sigs.push(...b); before=b[b.length-1].signature;
    if(b.length<1000) break;
  }
  const ok = sigs.filter(s=>!s.err);
  const f=(t?:number|null)=>t?new Date(t*1000).toISOString().slice(0,19):"?";
  log(`signatures: ${sigs.length} total, ${ok.length} successful`);
  log(`range: ${f(sigs[sigs.length-1]?.blockTime)}  ->  ${f(sigs[0]?.blockTime)}`);

  const kinds=new Map<string,number>(); const hits:any[]=[];
  let decoded=0, unresolved=0;
  for(let i=0;i<ok.length;i+=BATCH){
    const batch = ok.slice(i,i+BATCH).map(s=>s.signature);
    let txs:any=null;
    for(let a=0;a<4 && !txs;a++){
      txs = await to(conn.getParsedTransactions(batch,{maxSupportedTransactionVersion:0}),25_000);
      if(!txs) await new Promise(r=>setTimeout(r, 800*(a+1)));
    }
    if(!txs){ unresolved+=batch.length; continue; }
    txs.forEach((tx:any,j:number)=>{
      if(!tx){ unresolved++; return; } decoded++;
      const ixs:any[]=[...(tx.transaction.message.instructions as any[]),
        ...((tx.meta?.innerInstructions??[]).flatMap((x:any)=>x.instructions as any[]))];
      for(const ix of ixs){
        const pid = ix.programId?.toBase58?.() ?? String(ix.programId);
        if(pid!==T22) continue;
        const type = ix.parsed?.type ?? "(unparsed)";
        kinds.set(type,(kinds.get(type)??0)+1);
        if(!MOVE.has(type)) continue;
        const inf = ix.parsed?.info ?? {};
        const auth = inf.authority ?? inf.multisigAuthority ?? inf.owner ?? "";
        if(auth===addr) hits.push({sig:batch[j],type,src:inf.source,dst:inf.destination,
          amt:inf.tokenAmount?.uiAmountString ?? inf.amount, mint:inf.mint});
      }
    });
    if((i/BATCH)%25===0) log(`  progress ${decoded}/${ok.length} decoded, ${unresolved} unresolved, ${hits.length} hits`);
    await new Promise(r=>setTimeout(r,120));
  }
  const pct = ok.length? (decoded/ok.length*100).toFixed(1):"0";
  log(`\nCOVERAGE: decoded ${decoded}/${ok.length} (${pct}%), unresolved ${unresolved}`);
  log(`Token-2022 instruction types seen:`);
  [...kinds.entries()].sort((a,b)=>b[1]-a[1]).slice(0,16).forEach(([k,n])=>log(`  ${k.padEnd(38)} ${n}`));
  log(`>>> TOKEN-MOVING instructions authorised by this address: ${hits.length}`);
  hits.slice(0,30).forEach(h=>log(`  ${h.type} mint=${h.mint} src=${h.src} amt=${h.amt}\n    ${h.sig}`));
}

(async()=>{
  writeFileSync(OUT,"");
  const conn = new Connection(CONFIG.rpcUrlMainnet,"confirmed");
  await run(conn,"5aMNNLQJwAEeoemTEMkv5NVjqKwvvefRYCQ5Z67HFvEq","PERMANENT DELEGATE");
  log("\nDONE");
})().catch(e=>{log("FATAL "+e.message);process.exit(1);});
