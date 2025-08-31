#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

async function run(file: string){
  const abs = path.resolve(file);
  const text = fs.readFileSync(abs,'utf-8');
  // Lazy import parsePgn from source (ts-node or compiled dist will resolve)
  const mod = await import('../pgn-to-trl.js');
  const { header, moves } = mod.parsePgn(text);
  const isKrieg = !!(header.Variant && header.Variant.toLowerCase().includes('krieg'));
  console.log(`File: ${path.basename(abs)} | Variant=${header.Variant || ''} | Krieg=${isKrieg}`);
  let ply = 0; let totalAttempts=0; let totalNotes=0;
  const parseComment = (c?: string)=>{
    if(!c) return { notes:[], attempts:[] };
    const colon = c.indexOf(':');
    const notesPart = colon>=0 ? c.slice(0,colon).trim() : c.trim();
    const attemptsPart = colon>=0 ? c.slice(colon+1).trim() : '';
    const notes = notesPart.split(',').map(s=>s.trim()).filter(Boolean);
    const attempts = attemptsPart.split(',').map(s=>s.trim()).filter(t=>/-/.test(t));
    return { notes, attempts };
  };
  for(const rec of moves){
    if(rec.whiteMove){ const { notes, attempts } = parseComment(rec.whiteComment); totalNotes+=notes.length; totalAttempts+=attempts.length; ply++; }
    if(rec.blackMove){ const { notes, attempts } = parseComment(rec.blackComment); totalNotes+=notes.length; totalAttempts+=attempts.length; ply++; }
  }
  console.log(`Plies=${ply} | Notes=${totalNotes} | IllegalAttempts=${totalAttempts}`);
  // Print first few detailed entries
  let printed=0;
  ply=0;
  for(const rec of moves){
    if(rec.whiteMove){
      const { notes, attempts } = parseComment(rec.whiteComment);
      if((notes.length||attempts.length) && printed<6){
        console.log(`${rec.num}. ${rec.whiteMove}  notes=[${notes.join(' ')}] attempts=[${attempts.join(' ')}]`);
        printed++;
      }
      ply++;
    }
    if(rec.blackMove){
      const { notes, attempts } = parseComment(rec.blackComment);
      if((notes.length||attempts.length) && printed<6){
        console.log(`${rec.num}... ${rec.blackMove}  notes=[${notes.join(' ')}] attempts=[${attempts.join(' ')}]`);
        printed++;
      }
      ply++;
    }
  }
}

async function main(){
  const files = process.argv.slice(2);
  if(files.length===0){
    console.error('Usage: inspect_pgn.ts <file1.pgn> [more.pgn]');
    process.exit(2);
  }
  for(const f of files){ await run(f); }
}

main().catch(e=>{ console.error(e); process.exit(1); });
