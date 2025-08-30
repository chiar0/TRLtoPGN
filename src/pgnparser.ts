// Lightweight PGN parser inspired by the provided Java PGNParser.
// It focuses on tags, moves, comments, and illegal-attempt extraction.
// For full parity (Move geometry, checks, tries computed by an umpire),
// we would need the Java classes: ExtendedPGNGame, PGNMoveData, StepwiseLocalUmpire, FENData, Move.

import { parsePgn } from '../pgn-to-trl.js';

export interface PGNMoveData {
  san: string;              // SAN move token
  comment?: string | null;  // Full comment content (without braces)
  illegalAttempts: string[]; // e.g., ["e2-e4","Nb1-c3"] parsed from ":" section in comment
  triesFromComment: number; // Pn extracted from comment before ':' (e.g., P2 => 2)
}

export interface ParsedPGNGame {
  header: Record<string, string>;
  moves: PGNMoveData[];
  result: string; // "1-0", "0-1", "1/2-1/2", or "*"
}

export class PGNParser {
  constructor() {}

  parse(text: string): ParsedPGNGame {
    const { header, moves } = parsePgn(text);

    // Determine result from header or trailing token; if missing, use '*'
    const result = header.Result || '*';

    const parsedMoves: PGNMoveData[] = [];

    for (const m of moves) {
      const san: string = m.whiteMove || m.blackMove || '';
      const comment: string | null = m.whiteComment || m.blackComment || null;

      // Extract illegal attempts from comment after ':'
      const illegalAttempts: string[] = [];
      let triesFromComment = 0;
      if (comment) {
        const colonIdx = comment.indexOf(':');
        const notesPart = colonIdx >= 0 ? comment.slice(0, colonIdx) : comment;
        const attemptsPart = colonIdx >= 0 ? comment.slice(colonIdx + 1) : '';

        // Count explicit Pn in notes part (e.g., "P2")
        const pMatch = notesPart.match(/\bP(\d+)\b/i);
        if (pMatch) triesFromComment = parseInt(pMatch[1], 10) || 0;

        // Split comma-separated illegal attempts (tokens like e2-e4 or Ke1-g1)
        if (attemptsPart.trim().length) {
          const toks = attemptsPart.split(',').map(s => s.trim()).filter(Boolean);
          for (const t of toks) {
            if (t.includes('-')) illegalAttempts.push(t);
          }
        }
      }

      parsedMoves.push({ san, comment, illegalAttempts, triesFromComment });
    }

    return { header, moves: parsedMoves, result };
  }
}
