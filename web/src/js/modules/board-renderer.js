// Board rendering and visual effects
import { algebraicToPoint } from './utils.js';

export class BoardRenderer {
  constructor(board, overlay) {
    this.board = board;
    this.overlay = overlay;
    this._bestMoveElems = [];
    this.overlayHideTimer = null;
  }

  fenMaskOpp(fen, orientation, hideOpp) {
    if (!hideOpp) return fen;
    const parts = fen.split(' ');
    if (parts.length < 4) return fen;
    const rows = parts[0].split('/');
    const masked = rows.map(row => {
      let expanded = '';
      for (const ch of row) {
        if (/[1-8]/.test(ch)) expanded += '1'.repeat(parseInt(ch, 10));
        else expanded += ch;
      }
      let replaced = '';
      for (const ch of expanded) {
        const isBlack = /[prnbqk]/.test(ch);
        const isWhite = /[PRNBQK]/.test(ch);
        const hideBlack = orientation === 'white';
        const hide = hideBlack ? isBlack : isWhite;
        if (hide) replaced += '1';
        else replaced += ch;
      }
      // recompress
      let comp = '';
      let run = 0;
      const flush = () => {
        if (run > 0) {
          comp += String(run);
          run = 0;
        }
      };
      for (const ch of replaced) {
        if (ch === '1') run++;
        else {
          flush();
          comp += ch;
        }
      }
      flush();
      return comp;
    }).join('/');
    parts[0] = masked;
    return parts.join(' ');
  }

  renderBoard(gameState, hideOpp) {
    let fen = gameState.getFen();
    if (gameState.isKrieg && hideOpp) {
      fen = this.fenMaskOpp(fen, gameState.orientation, true);
    }
    this.board.setAttribute('position', fen);
    this.board.setAttribute('orientation', gameState.orientation);
    this.resizeOverlay();
  }

  resizeOverlay() {
    const rect = this.board.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    
    this.overlay.style.width = w + 'px';
    this.overlay.style.height = h + 'px';
    this.overlay.setAttribute('width', String(w));
    this.overlay.setAttribute('height', String(h));
    this.overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);

    // Cap moves list height to board pixel height
    try {
      const movesBox = document.getElementById('moves');
      if (movesBox) {
        movesBox.style.maxHeight = h + 'px';
      }
    } catch { }
  }

  clearOverlay() {
    try {
      const preserve = new Set(this._bestMoveElems.filter(Boolean));
      const toRemove = [];
      for (const child of Array.from(this.overlay.children)) {
        if (!preserve.has(child)) toRemove.push(child);
      }
      for (const c of toRemove) {
        try {
          if (c && c.parentNode) c.parentNode.removeChild(c);
        } catch (e) { }
      }
    } catch (e) {
      try {
        while (this.overlay.firstChild) this.overlay.removeChild(this.overlay.firstChild);
      } catch (_) { }
    }
  }

  ensureOverlayDefs() {
    const hasDefs = this.overlay.querySelector('defs');
    if (hasDefs) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L10,3.5 L0,7 Z');
    path.setAttribute('fill', 'context-stroke');
    marker.appendChild(path);
    defs.appendChild(marker);
    this.overlay.appendChild(defs);
  }

  drawArrow(from, to, opts = {}) {
    this.ensureOverlayDefs();
    const a = algebraicToPoint(from, opts.orientation || 'white', this.overlay);
    const b = algebraicToPoint(to, opts.orientation || 'white', this.overlay);
    if (!a || !b) return;

    const color = opts.color || '#ef4444';
    const opacity = opts.opacity ?? 0.95;
    const width = opts.width ?? 6;
    const offsetIndex = (typeof opts.offsetIndex === 'number') ? opts.offsetIndex : 0;

    // perpendicular offset to reduce overlap clutter
    const dx0 = b.x - a.x, dy0 = b.y - a.y;
    const len0 = Math.hypot(dx0, dy0) || 1;
    const ux0 = dx0 / len0, uy0 = dy0 / len0;
    const px = -uy0, py = ux0;
    const side = (offsetIndex % 2 === 0) ? 1 : -1;
    const stepN = Math.ceil(offsetIndex / 2);
    const offsetPx = Math.min(10, 3 * stepN) * side;

    const aOff = { x: a.x + px * offsetPx, y: a.y + py * offsetPx };
    const bOff = { x: b.x + px * offsetPx, y: b.y + py * offsetPx };

    // start circle
    const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circ.setAttribute('cx', String(aOff.x));
    circ.setAttribute('cy', String(aOff.y));
    circ.setAttribute('r', '8');
    circ.setAttribute('fill', color);
    circ.setAttribute('stroke', color);
    circ.setAttribute('stroke-width', '2');
    circ.setAttribute('opacity', String(Math.max(0.35, opacity - 0.6)));
    this.overlay.appendChild(circ);

    // main line with arrowhead
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const dx = bOff.x - aOff.x, dy = bOff.y - aOff.y;
    const len = Math.hypot(dx, dy) || 1;
    const insetStart = 8, insetEnd = 12;
    const ux1 = dx / len, uy1 = dy / len;
    const x1 = aOff.x + ux1 * insetStart;
    const y1 = aOff.y + uy1 * insetStart;
    const x2 = bOff.x - ux1 * insetEnd;
    const y2 = bOff.y - uy1 * insetEnd;

    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', String(width));
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', String(opacity));
    line.setAttribute('stroke-miterlimit', '1');
    line.setAttribute('marker-end', 'url(#arrowhead)');
    this.overlay.appendChild(line);

    return [circ, line];
  }

  clearBestMove() {
    try {
      for (const e of this._bestMoveElems) {
        if (e && e.parentNode) e.parentNode.removeChild(e);
      }
      this._bestMoveElems = [];
    } catch (e) { }
  }

  showBestMove(uci, orientation) {
    try {
      this.clearBestMove();
      if (!uci) return;
      const sqm = uci.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/i);
      if (!sqm) return;
      const from = sqm[1].toLowerCase();
      const to = sqm[2].toLowerCase();
      const a = algebraicToPoint(from, orientation, this.overlay);
      const b = algebraicToPoint(to, orientation, this.overlay);
      if (!a || !b) return;

      const rad = Math.max(8, Math.min(18, Math.round(Math.min(this.overlay.clientWidth, this.overlay.clientHeight) / 40)));
      const c1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c1.setAttribute('cx', String(a.x));
      c1.setAttribute('cy', String(a.y));
      c1.setAttribute('r', String(rad));
      c1.setAttribute('fill', 'rgba(99,102,241,0.18)');
      c1.setAttribute('stroke', '#6366f1');
      c1.setAttribute('stroke-width', '3');
      this.overlay.appendChild(c1);
      this._bestMoveElems.push(c1);

      const c2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c2.setAttribute('cx', String(b.x));
      c2.setAttribute('cy', String(b.y));
      c2.setAttribute('r', String(rad));
      c2.setAttribute('fill', 'rgba(16,185,129,0.14)');
      c2.setAttribute('stroke', '#10b981');
      c2.setAttribute('stroke-width', '3');
      this.overlay.appendChild(c2);
      this._bestMoveElems.push(c2);

      try {
        const created = this.drawArrow(from, to, { color: '#a78bfa', width: 6, opacity: 0.95, offsetIndex: 0, orientation });
        if (created && created.length) {
          for (const el of created) {
            this._bestMoveElems.push(el);
          }
        }
      } catch (e) { }
    } catch (e) { }
  }
}