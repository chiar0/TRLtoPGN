// Header management for PGN editing
import { parsePgn } from '../../../dist/pgn-to-trl.js';

export class HeaderManager {
  constructor() {
    this.elements = this.getElements();
  }

  getElements() {
    return {
      pgnEvent: document.getElementById('pgnEvent'),
      pgnSite: document.getElementById('pgnSite'),
      pgnDate: document.getElementById('pgnDate'),
      pgnWhite: document.getElementById('pgnWhite'),
      pgnBlack: document.getElementById('pgnBlack'),
      pgnVariant: document.getElementById('pgnVariant'),
      boardHeaderBar: document.getElementById('boardHeaderBar'),
      metaWhite: document.getElementById('metaWhite'),
      metaBlack: document.getElementById('metaBlack'),
      metaInfoBar: document.getElementById('metaInfo'),
      toggleEditorBtn: document.getElementById('toggleEditor'),
      toggleEditorOriginalBtn: document.getElementById('toggleEditorOriginal'),
      pgnEditor: document.getElementById('pgnEditor')
    };
  }

  parsePgnHeadersToPanel(pgn) {
    try {
      const { header } = parsePgn(pgn);
      if (this.elements.pgnEvent) this.elements.pgnEvent.value = header.Event || this.elements.pgnEvent.placeholder || 'Client Game';
      if (this.elements.pgnSite) this.elements.pgnSite.value = header.Site || this.elements.pgnSite.placeholder || 'Local';
      if (this.elements.pgnDate) this.elements.pgnDate.value = header.Date || this.elements.pgnDate.placeholder || new Date().toISOString().slice(0, 10).replace(/-/g, '.');
      if (this.elements.pgnWhite) this.elements.pgnWhite.value = header.White || this.elements.pgnWhite.placeholder || 'Player 1';
      if (this.elements.pgnBlack) this.elements.pgnBlack.value = header.Black || this.elements.pgnBlack.placeholder || 'Player 2';
      if (this.elements.pgnVariant) this.elements.pgnVariant.value = (header.Variant && header.Variant.toLowerCase().includes('krieg')) ? 'kriegspiel' : 'chess';
    } catch { }
  }

  applyPanelHeadersToPgnText(text) {
    const lines = text.split(/\r?\n/);
    const setOrInsert = (key, val) => {
      if (!val) return;
      const tag = `[${key} "${val}"]`;
      let idx = lines.findIndex(l => new RegExp(`^\\s*\\[${key}\\s+"`).test(l));
      if (idx >= 0) lines[idx] = tag;
      else lines.unshift(tag);
    };

    const ev = (this.elements.pgnEvent?.value || '').trim() || 'Client Game';
    const st = (this.elements.pgnSite?.value || '').trim() || 'Local';
    const dt = (this.elements.pgnDate?.value || '').trim() || new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const wh = (this.elements.pgnWhite?.value || '').trim() || 'Player 1';
    const bl = (this.elements.pgnBlack?.value || '').trim() || 'Player 2';
    const varSel = (this.elements.pgnVariant?.value || 'chess');

    setOrInsert('Event', ev);
    setOrInsert('Site', st);
    setOrInsert('Date', dt);
    setOrInsert('White', wh);
    setOrInsert('Black', bl);
    if (varSel === 'kriegspiel') setOrInsert('Variant', 'Kriegspiel');

    if (varSel === 'chess') {
      const vi = lines.findIndex(l => /^\s*\[Variant\s+\"/i.test(l));
      if (vi >= 0) lines.splice(vi, 1);
    }
    return lines.join('\n');
  }

  renderBoardHeaderMeta(gameState) {
    if (!this.elements.boardHeaderBar) return;
    
    const editorVisible = this.elements.pgnEditor && this.elements.pgnEditor.style.display !== 'none';
    let ev, st, dt, wh, bl;

    if (editorVisible) {
      ev = (this.elements.pgnEvent?.value || this.elements.pgnEvent?.placeholder || 'Client Game');
      st = (this.elements.pgnSite?.value || this.elements.pgnSite?.placeholder || 'Local');
      dt = (this.elements.pgnDate?.value || this.elements.pgnDate?.placeholder || new Date().toISOString().slice(0, 10).replace(/-/g, '.'));
      wh = (this.elements.pgnWhite?.value || this.elements.pgnWhite?.placeholder || 'White');
      bl = (this.elements.pgnBlack?.value || this.elements.pgnBlack?.placeholder || 'Black');
    } else if (gameState.lastHeader && (gameState.lastHeader.White || gameState.lastHeader.Black || gameState.lastHeader.Event)) {
      ev = gameState.lastHeader.Event || 'Client Game';
      st = gameState.lastHeader.Site || 'Local';
      dt = gameState.lastHeader.Date || new Date().toISOString().slice(0, 10).replace(/-/g, '.');
      wh = gameState.lastHeader.White || 'White';
      bl = gameState.lastHeader.Black || 'Black';
    } else {
      ev = 'Client Game';
      st = 'Local';
      dt = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
      wh = 'White';
      bl = 'Black';
    }

    if (this.elements.metaWhite) this.elements.metaWhite.textContent = wh;
    if (this.elements.metaBlack) this.elements.metaBlack.textContent = bl;
    if (this.elements.metaInfoBar) this.elements.metaInfoBar.textContent = `${ev} • ${dt} • ${st}`;
  }
}