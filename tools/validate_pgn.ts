#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { Chess } from 'chess.js';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: validate_pgn.ts <file.pgn|file.trl>');
    process.exit(2);
  }
  const abs = path.resolve(file);
  const raw = fs.readFileSync(abs, 'utf-8');
  const ext = path.extname(abs).toLowerCase();

  let pgn = raw;
  if (ext === '.trl') {
    try {
  const trlToPgn = await import('../trl-to-pgn.js');
      pgn = trlToPgn.ludiiToPgn(raw, abs, path.basename(abs, ext), 'Player 1', 'Player 2');
    } catch (e) {
      console.error('Conversion TRL→PGN failed:', (e as Error).message);
      process.exit(1);
    }
  }

  const game = new Chess();
  try {
    game.loadPgn(pgn, { strict: false });
  } catch (e) {
    console.error('PGN failed to load:', (e as Error).message);
    console.error('First 500 chars:\n', pgn.slice(0, 500));
    process.exit(1);
  }
  console.log('OK:', path.basename(abs), 'moves=', game.history().length);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
