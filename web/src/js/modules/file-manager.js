// File management and conversion handling
import { detectType } from './utils.js';
import { ludiiToPgn } from '../../../dist/trl-to-pgn.js';
import { pgnToTrl, parsePgn } from '../../../dist/pgn-to-trl.js';

export class FileManager {
  constructor() {
    this.lastInputType = null;
    this.lastConverted = null;
  }

  setTag(type, originalTag, input) {
    if (!originalTag) return;
    if (!input.value.trim()) {
      originalTag.textContent = 'Auto‑detect Input';
      return;
    }
    const fmt = type ? type.toUpperCase() : 'UNKNOWN';
    originalTag.textContent = `Inserted (${fmt})`;
  }

  async ensurePGN(text) {
    const type = this.lastInputType ?? detectType(text);
    if (type === 'pgn') return text;
    if (type === 'trl') {
      const pgn = ludiiToPgn(text, 'pasted.trl', 'Client Game', 'Player 1', 'Player 2');
      this.lastConverted = pgn;
      return pgn;
    }
    throw new Error('Unable to detect input type');
  }

  async ensureAlt(text) {
    const type = this.lastInputType ?? detectType(text);
    if (type === 'pgn') {
      const trl = pgnToTrl(text);
      return trl;
    }
    if (type === 'trl') {
      const pgn = ludiiToPgn(text, 'pasted.trl', 'Client Game', 'Player 1', 'Player 2');
      return pgn;
    }
    throw new Error('Unable to detect input type');
  }

  async ensureFormat(text, format /* 'pgn' | 'trl' */) {
    const want = (format || '').toLowerCase();
    const type = this.lastInputType ?? detectType(text);
    if (want === 'pgn') {
      if (type === 'pgn') return text;
      if (type === 'trl') return ludiiToPgn(text, 'pasted.trl', 'Client Game', 'Player 1', 'Player 2');
    }
    if (want === 'trl') {
      if (type === 'trl') return text;
      if (type === 'pgn') return pgnToTrl(text);
    }
    // Fallback to original text
    return text;
  }

  extractSANFromPGN(pgn) {
    const tmp = new Chess();
    try {
      tmp.loadPgn(pgn, { strict: false });
    } catch (e) {
      throw new Error('Invalid PGN');
    }
    return tmp.history();
  }

  async updateConvertedPreview(text, outputElements) {
    const t = this.lastInputType ?? detectType(text);
    if (!t) {
      if (outputElements.convertedWrap) outputElements.convertedWrap.style.display = 'none';
      this.lastConverted = null;
      if (outputElements.outputPreview) outputElements.outputPreview.value = '';
      if (outputElements.outputInfo) outputElements.outputInfo.textContent = '';
      return;
    }

    try {
      const alt = await this.ensureAlt(text);
      this.lastConverted = alt;
      if (outputElements.outputPreview) outputElements.outputPreview.value = alt;
      const target = t === 'pgn' ? 'TRL' : 'PGN';
      if (outputElements.outputTag) outputElements.outputTag.textContent = `Converted (${target})`;
      const len = alt.length;
      const lines = (alt.match(/\n/g) || []).length + 1;
      if (outputElements.outputInfo) outputElements.outputInfo.textContent = `${lines} lines • ${len} chars`;
      if (outputElements.convertedWrap) outputElements.convertedWrap.style.display = '';
    } catch (e) {
      if (outputElements.convertedWrap) outputElements.convertedWrap.style.display = '';
      if (outputElements.outputPreview) outputElements.outputPreview.value = '';
      if (outputElements.outputInfo) outputElements.outputInfo.textContent = `Conversion error: ${e.message || e}`;
    }
  }

  async handleFileLoad(file, input, originalTag, originalInfo, updateCallback) {
    const text = await file.text();
    input.value = text;
    const t = detectType(text);
    this.lastInputType = t;
    this.setTag(t, originalTag, input);
    if (originalInfo) {
      const len = text.length;
      const lines = (text.match(/\n/g) || []).length + 1;
      originalInfo.textContent = `${lines} lines • ${len} chars`;
    }
    if (updateCallback) updateCallback();
    return t;
  }
}