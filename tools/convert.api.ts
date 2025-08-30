#!/usr/bin/env node
// Tiny module exposing helpers to convert PGN<->TRL strings for web use
import { pgnToTrl } from '../pgn-to-trl.js';
import { ludiiToPgn } from '../trl-to-pgn.js';

export function convertPgnToTrlString(pgn: string): string {
  return pgnToTrl(pgn);
}

export function convertTrlToPgnString(trl: string, opts?: { fileName?: string; eventName?: string; white?: string; black?: string }): string {
  const file = opts?.fileName ?? 'uploaded.trl';
  const eventName = opts?.eventName ?? 'Uploaded';
  const white = opts?.white ?? 'Player 1';
  const black = opts?.black ?? 'Player 2';
  return ludiiToPgn(trl, file, eventName, white, black);
}

// If run directly, act as a tiny CLI: read stdin and convert based on arg
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  const chunks: Buffer[] = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', () => {
    const input = Buffer.concat(chunks).toString('utf-8');
    if (mode === 'pgn-to-trl') {
      process.stdout.write(convertPgnToTrlString(input));
    } else if (mode === 'trl-to-pgn') {
      process.stdout.write(convertTrlToPgnString(input));
    } else {
      console.error('Usage: convert.api.ts <pgn-to-trl|trl-to-pgn> < input > output');
      process.exit(2);
    }
  });
}
