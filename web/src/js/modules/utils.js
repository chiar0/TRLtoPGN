// Utility functions
export const $ = (s) => document.querySelector(s);

export const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

export function detectType(text) {
  if (!text || !text.trim()) return null;
  // TRL starts with 'game=/lud' or contains 'Move=[' lines
  if (/^game=\/lud\//.test(text.trim()) || /\bMove=\[/.test(text)) return 'trl';
  // PGN has headers like [Event "..."] or move numbers like '1.'
  if (/^\s*\[\w+\s+"/.test(text) || /\b1\./.test(text)) return 'pgn';
  return null;
}

export function getNumber(val) {
  const n = parseFloat(val || '0');
  return isFinite(n) ? n : 0;
}

export function algebraicToPoint(sq, orientation, overlay) {
  if (!sq || sq.length < 2) return null;
  const file = sq[0].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(sq[1], 10) - 1;
  const rect = overlay.getBoundingClientRect();
  const w = rect.width || 460;
  const h = rect.height || 460;
  const cellW = w / 8, cellH = h / 8;
  let xIndex = file, yIndex = 7 - rank; // white orientation default
  if (orientation === 'black') {
    xIndex = 7 - file;
    yIndex = rank;
  }
  let cx = (xIndex + 0.5) * cellW;
  let cy = (yIndex + 0.5) * cellH;
  // Clamp to inside the board
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  cx = clamp(cx, cellW * 0.1, w - cellW * 0.1);
  cy = clamp(cy, cellH * 0.1, h - cellH * 0.1);
  return { x: cx, y: cy };
}