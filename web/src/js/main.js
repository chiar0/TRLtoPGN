// Main application entry point
  import { Chess } from 'https://unpkg.com/chess.js@1.0.0/dist/esm/chess.js';
  import { ludiiToPgn } from '../../dist/trl-to-pgn.js';
  import { pgnToTrl, parsePgn } from '../../dist/pgn-to-trl.js';import { $, detectType } from './modules/utils.js';
import { GameState } from './modules/game-state.js';
import { HeaderManager } from './modules/header-manager.js';
import { BoardRenderer } from './modules/board-renderer.js';
import { FileManager } from './modules/file-manager.js';
import { EngineManager } from './modules/engine-manager.js';
import * as Compression from './modules/compression.js';
import { initShareUI, buildShareUrl as buildShareUrlFromModule } from './modules/share-manager.js';
import { initClipboardUI } from './modules/clipboard-manager.js';
import { applyInitialConverterOnlyState as applyInitialConverterOnlyStateUI, showBoardPanels as showBoardPanelsUI, updateShareControls as updateShareControlsUI } from './modules/ui-visibility.js';

// Global state
let gameState = new GameState();
let headerManager = null;
let fileManager = new FileManager();
let engineManager = null;
let boardRenderer = null;

// Guard against stray drag container injected by chessboard-element
let draggedPiecesObserver = null;
let draggedPiecesShadowObserver = null;
let draggedPiecesShadowPoll = null;
function installDraggedPiecesGuard() {
  try {
    const purgeIn = (root) => {
      try {
        const list = root.querySelectorAll ? root.querySelectorAll('#dragged-pieces') : [];
        list && list.forEach(el => { try { el.remove(); } catch {} });
      } catch {}
    };
    const purgeAll = () => {
      purgeIn(document);
      try {
        const boardEl = document.getElementById('board');
        if (boardEl && boardEl.shadowRoot) purgeIn(boardEl.shadowRoot);
      } catch {}
    };
    purgeAll();
    if (draggedPiecesObserver) return;
    draggedPiecesObserver = new MutationObserver(muts => {
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach(node => {
          if (!(node && node.nodeType === 1)) return;
          const el = node;
          if (el.id === 'dragged-pieces') {
            try { el.remove(); } catch {}
            return;
          }
          if (el.querySelectorAll) {
            el.querySelectorAll('#dragged-pieces').forEach(dp => { try { dp.remove(); } catch {} });
          }
        });
      }
    });
    if (document.body) {
      draggedPiecesObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        try { purgeAll(); } catch {}
        try { draggedPiecesObserver.observe(document.body, { childList: true, subtree: true }); } catch {}
      });
    }

    // Also watch inside the chess-board shadow DOM once it exists
    const attachShadowObserver = () => {
      try {
        const boardEl = document.getElementById('board');
        if (!boardEl || !boardEl.shadowRoot) return false;
        if (draggedPiecesShadowObserver) return true;
        draggedPiecesShadowObserver = new MutationObserver(muts => {
          for (const m of muts) {
            m.addedNodes && m.addedNodes.forEach(node => {
              try {
                if (node && node.nodeType === 1) {
                  if (node.id === 'dragged-pieces') { node.remove(); return; }
                  const q = node.querySelector ? node.querySelector('#dragged-pieces') : null;
                  if (q) q.remove();
                }
              } catch {}
            });
          }
        });
        // Initial purge within shadow and then observe
        try { purgeIn(boardEl.shadowRoot); } catch {}
        draggedPiecesShadowObserver.observe(boardEl.shadowRoot, { childList: true, subtree: true });
        return true;
      } catch { return false; }
    };
    // Try immediately, otherwise poll briefly until shadowRoot is available
    if (!attachShadowObserver()) {
      let attempts = 0;
      draggedPiecesShadowPoll = setInterval(() => {
        attempts++;
        if (attachShadowObserver() || attempts > 100) {
          try { clearInterval(draggedPiecesShadowPoll); } catch {}
          draggedPiecesShadowPoll = null;
        }
      }, 50);
    }
  } catch {}
}

// UI elements
const input = $('#input');
const originalTag = $('#originalTag');
const board = $('#board');
const overlay = $('#overlay');
const status = $('#status');

// Timer state
let timer = null;
let backTimer = null;
let autoResumeForward = false;
let forwardSpeed = 1;
let backSpeed = 1;
let convertTimer = null;
function isHighSpeed() { return forwardSpeed > 1; }

// Initialize board renderer after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Ensure stray drag container never shows
  installDraggedPiecesGuard();
  // Instantiate modules only after DOM is ready so they can bind to elements
  boardRenderer = new BoardRenderer(board, overlay);
  headerManager = new HeaderManager();
  engineManager = new EngineManager();
  init();
  applyInitialConverterOnlyState();
  tryDecodeShareFromURL();
});

function init() {
  // Load saved input
  try {
    const saved = localStorage.getItem('viewer_input');
    if (saved) {
      input.value = saved;
      const t = detectType(saved);
      fileManager.lastInputType = t;
      fileManager.setTag(t, originalTag, input);
      updateShareControls();
      updateOriginalInfo();
    }
  } catch { }

  if (!input.value) fileManager.setTag(null, originalTag, input);
  
  renderBoard();
  setupEventListeners();
  bootShare();
  // Initialize modular UI helpers
  initClipboardUI({ fileManager, input, status });
  initShareUI({ fileManager, input, status });
}

function renderBoard() {
  if (!boardRenderer) return;
  const hideOpp = document.getElementById('hideOpp');
  boardRenderer.renderBoard(gameState, hideOpp?.checked);
  // Double-ensure any stray drag container is removed after board render (light + shadow roots)
  try {
    const kill = (root) => { root && root.querySelectorAll && root.querySelectorAll('#dragged-pieces').forEach(el => el.remove()); };
    kill(document);
    const boardEl = document.getElementById('board');
    if (boardEl && boardEl.shadowRoot) kill(boardEl.shadowRoot);
  } catch {}
  renderAttemptOverlay();
  renderTurnInfo();
  renderRawMove();
  // Do not auto-request analysis on every repaint to avoid churn
}

function renderMoves() {
  const cont = $('#moves');
  const skipIllegal = document.getElementById('skipIllegal');
  
  cont.innerHTML = '';
  const activeElems = [];

  // Helper to append and mark active
  const markActive = (el) => { activeElems.push(el); };

  // Render attempts before any move (ply 0)
  if (gameState.isKrieg && (!skipIllegal || !skipIllegal.checked)) {
    const attempts0 = gameState.illegalByPly[0] || [];
    const sub0 = (attempts0 && typeof attempts0._subIdx === 'number') ? attempts0._subIdx : 0;
    const state0 = 0 < gameState.idx ? 'past' : (0 === gameState.idx ? 'current' : 'future');
    const showCount0 = state0 === 'past' ? attempts0.length : (state0 === 'current' ? Math.max(0, Math.min(sub0, attempts0.length)) : 0);
    
    for (let k = 0; k < showCount0; k++) {
      const t = attempts0[k];
      const attEl = document.createElement('span');
      attEl.textContent = `↳ ${t}`;
      const isActiveAttempt = (state0 === 'current' && k === showCount0 - 1);
      attEl.className = 'move attempt' + (isActiveAttempt ? ' active' : '');
      attEl.title = 'Illegal attempt';
      attEl.onclick = () => {
        const list = gameState.illegalByPly[0] || [];
        list._subIdx = Math.min(k + 1, list.length);
        goTo(0);
      };
      cont.appendChild(attEl);
      if (isActiveAttempt) markActive(attEl);
    }
  }

  // Render moves with attempts
  gameState.sanMoves.forEach((m, i) => {
    const state = i < gameState.idx ? 'past' : (i === gameState.idx ? 'current' : 'future');
    const moveEl = document.createElement('span');
    moveEl.textContent = (i % 2 === 0 ? Math.floor(i / 2) + 1 + '. ' : '') + m + ' ';

    // Check for queued state during illegal attempts
    let queued = false;
    if (gameState.isKrieg && (!skipIllegal || !skipIllegal.checked) && state === 'current') {
      const attempts = gameState.illegalByPly[i] || [];
      const sub = (attempts && typeof attempts._subIdx === 'number') ? attempts._subIdx : 0;
      queued = sub > 0;
    }

    let cls = 'move ';
    if (state === 'past') cls += 'legal-past';
    else if (state === 'current') cls += (queued ? 'legal-queued' : 'legal-current active');
    moveEl.className = cls;
    moveEl.onclick = () => { goTo(i + 1); };
    cont.appendChild(moveEl);
    if (state === 'past' || state === 'current') markActive(moveEl);

    // Append illegal attempts that occur after this move
    let attempts = [];
    const attemptsIdx = i + 1;
    if (gameState.isKrieg && (!skipIllegal || !skipIllegal.checked)) {
      attempts = gameState.illegalByPly[attemptsIdx] || [];
    }
    const sub = (attempts && typeof attempts._subIdx === 'number') ? attempts._subIdx : 0;
    const stateA = attemptsIdx < gameState.idx ? 'past' : (attemptsIdx === gameState.idx ? 'current' : 'future');
    let showCount = 0;
    if (stateA === 'past') { showCount = attempts.length; }
    else if (stateA === 'current') { showCount = Math.max(0, Math.min(sub, attempts.length)); }
    else { showCount = 0; }

    for (let k = 0; k < showCount; k++) {
      const t = attempts[k];
      const attEl = document.createElement('span');
      attEl.textContent = `↳ ${t}`;
      const isActiveAttempt = (stateA === 'current' && k === showCount - 1);
      let acls = 'move illegal ';
      acls += (stateA === 'past') ? 'illegal-past' : (isActiveAttempt ? 'illegal-current' : '');
      if (isActiveAttempt) acls += ' active';
      attEl.className = acls;
      attEl.title = 'Illegal attempt';
      attEl.onclick = () => {
        const list = gameState.illegalByPly[attemptsIdx] || [];
        list._subIdx = Math.min(k + 1, list.length);
        goTo(attemptsIdx);
      };
      cont.appendChild(attEl);
      if (isActiveAttempt) markActive(attEl);
    }
  });

  // Auto-scroll to last active element
  const active = activeElems.length ? activeElems[activeElems.length - 1] : cont.querySelector('.move.current:last-of-type');
  if (active) {
    const parent = cont;
    const aTop = active.offsetTop;
    const aBottom = aTop + active.offsetHeight;
    if (aTop < parent.scrollTop) { parent.scrollTop = aTop - 8; }
    else if (aBottom > parent.scrollTop + parent.clientHeight) { parent.scrollTop = aBottom - parent.clientHeight + 8; }
  }
}

function goTo(n) {
  gameState.goTo(n);
  renderBoard();
  renderMoves();
  renderRawMove();
  try {
    if (engineManager && engineManager.engineRunning) {
      const fen = gameState.game.fen();
      if (!engineManager.showCachedForFen(fen)) {
        // Clear stale visuals if no cache
        try { if (boardRenderer) { boardRenderer.clearBestMove(); } } catch {}
        const st = document.getElementById('engineBestMoveText');
        if (st) st.textContent = '';
        engineManager.requestAnalysis(fen, { showOnComplete: true, reuseCache: true });
      }
    }
  } catch {}
  updatePlayUI();
  try { engineManager && engineManager.updateIconVisuals && engineManager.updateIconVisuals(); } catch {}
}

function step(dir) {
  const skipIllegal = document.getElementById('skipIllegal');
  const attempts = gameState.isKrieg ? (gameState.illegalByPly[gameState.idx] || []) : [];
  
  if (dir > 0) {
    if (gameState.isKrieg && (!skipIllegal || !skipIllegal.checked) && attempts && attempts._subIdx !== undefined && attempts._subIdx < attempts.length) {
      attempts._subIdx++;
      renderBoard();
      renderMoves();
      return;
    }
    if (gameState.idx < gameState.sanMoves.length) {
      gameState.game.move(gameState.sanMoves[gameState.idx++]);
      const nextAttempts = gameState.illegalByPly[gameState.idx] || [];
      nextAttempts._subIdx = 0;
    }
  } else {
    if (gameState.isKrieg && (!skipIllegal || !skipIllegal.checked)) {
      const curAttempts = gameState.illegalByPly[gameState.idx] || [];
      if (curAttempts && curAttempts._subIdx && curAttempts._subIdx > 0) {
        curAttempts._subIdx--;
        renderBoard();
        renderMoves();
        return;
      }
    }
    if (gameState.idx > 0) {
      gameState.game.undo();
      gameState.idx--;
    }
  }
  renderBoard();
  renderMoves();
  renderRawMove();
  try {
    if (engineManager && engineManager.engineRunning) {
      const fen = gameState.game.fen();
      if (!engineManager.showCachedForFen(fen)) {
        try { if (boardRenderer) { boardRenderer.clearBestMove(); } } catch {}
        const st = document.getElementById('engineBestMoveText');
        if (st) st.textContent = '';
        engineManager.requestAnalysis(fen, { showOnComplete: true, reuseCache: true });
      }
    }
  } catch {}
  updatePlayUI();
  try { engineManager && engineManager.updateIconVisuals && engineManager.updateIconVisuals(); } catch {}
}

// Continue with remaining functions...
function setupEventListeners() {
  // Navigation buttons
  $('#back').onclick = () => step(-1);
  $('#forward').onclick = () => step(1);
  $('#backAll').onclick = () => goTo(0);
  $('#forwardAll').onclick = () => goTo(gameState.sanMoves.length);

  // Play controls
  const playBtn = document.getElementById('play');
  const revPlayBtn = document.getElementById('revPlay');
  const stopBtn = document.getElementById('stop');

  if (playBtn) {
    playBtn.onclick = () => {
      if (timer) {
        forwardSpeed = Math.min(8, forwardSpeed * 2);
        clearInterval(timer);
        timer = null;
        startForward();
      } else {
        forwardSpeed = 1;
        autoResumeForward = false;
        startForward();
      }
      // If speed > 1, stop engine analysis as requested
      try { if (forwardSpeed > 1 && engineManager && engineManager.engineRunning) engineManager.stopEngine(); } catch {}
    };
  }

  if (revPlayBtn) {
    revPlayBtn.onclick = () => {
      if (backTimer) {
        backSpeed = Math.min(8, backSpeed * 2);
        clearInterval(backTimer);
        backTimer = null;
        startBackward();
      } else {
        backSpeed = 1;
        startBackward();
      }
      // If speed > 1, stop engine analysis as requested
      try { if (backSpeed > 1 && engineManager && engineManager.engineRunning) engineManager.stopEngine(); } catch {}
    };
  }

  if (stopBtn) {
    stopBtn.onclick = () => {
      if (timer) { clearInterval(timer); timer = null; }
      if (backTimer) { clearInterval(backTimer); backTimer = null; }
      forwardSpeed = 1;
      backSpeed = 1;
      updatePlayUI();
    };
  }

  // File handling
  const file = document.getElementById('file');
  if (file) {
    file.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      await fileManager.handleFileLoad(f, input, originalTag, document.getElementById('originalInfo'), () => {
        status.textContent = 'Loaded file: ' + f.name;
        updateConvertedPreview(input.value);
        updateShareControls();
      });
      // Allow re-selecting the same file by clearing the input value
      try { e.target.value = ''; } catch {}
    });
  }

  // Copy/Download handled via clipboard-manager (initialized in init())

  // Clear input and reset everything
  const clearBtn = document.getElementById('clearInput');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      try { input.value = ''; } catch {}
      try { const f = document.getElementById('file'); if (f) f.value = ''; } catch {}
      try { localStorage.removeItem('viewer_input'); } catch {}
      try { location.hash = ''; } catch {}
      try { fileManager.lastInputType = null; fileManager.lastConverted = null; } catch {}
      try { if (engineManager && engineManager.resetAll) engineManager.resetAll(); } catch {}
      try {
        if (boardRenderer) {
          boardRenderer.clearOverlay();
          boardRenderer.clearBestMove();
        }
      } catch {}
      try {
        gameState.reset();
        // Hide board panel and return to converter-only state
        const boardPanel = document.getElementById('boardPanel');
        if (boardPanel) boardPanel.style.display = 'none';
        const toggleConverter = document.getElementById('toggleConverter');
        if (toggleConverter) toggleConverter.style.display = 'none';
        const gridEl = document.getElementById('grid');
        if (gridEl) { gridEl.classList.add('conv-only'); gridEl.classList.remove('conv-collapsed'); gridEl.classList.remove('tight'); }
        // Reset UI bits
        updateShareControls();
        updateOriginalInfo();
        const originalTag = document.getElementById('originalTag');
        if (originalTag) originalTag.textContent = 'Auto‑detect Input';
        const outputPreview = document.getElementById('outputPreview');
        const outputInfo = document.getElementById('outputInfo');
        const convertedWrap = document.getElementById('convertedWrap');
        if (outputPreview) outputPreview.value = '';
        if (outputInfo) outputInfo.textContent = '';
        if (convertedWrap) convertedWrap.style.display = 'none';
        const settingsPanel = document.getElementById('settingsPanel');
        const shareWrap = document.getElementById('shareLinkWrap');
        if (settingsPanel) settingsPanel.style.display = 'none';
        if (shareWrap) shareWrap.style.display = 'none';
        // Status
        if (status) status.textContent = 'Cleared';
      } catch {}
    });
  }

  // Input handling
  input.addEventListener('input', () => {
    const t = detectType(input.value);
    fileManager.lastInputType = t;
    fileManager.setTag(t, originalTag, input);
    updateShareControls();
    
    try {
      localStorage.setItem('viewer_input', input.value);
    } catch { }
    
    
  });

  // Start game button
  $('#start').onclick = startGame;

  // Share handled via share-manager (initialized in init())

  // Flip board
  const flip = $('#flip');
  if (flip) {
    flip.onclick = () => {
      gameState.orientation = (gameState.orientation === 'white') ? 'black' : 'white';
      renderBoard();
    };
  }
  // Settings panel is opened via Share now

  // Replay options toggle: open options above metaBar and push it down
  const replaySettingsBtn = document.getElementById('replaySettingsBtn');
  const replaySettingsMenu = document.getElementById('replaySettingsMenu');
  const headerBarForOptions = document.getElementById('boardHeaderBar');
  const metaRow = document.getElementById('metaRow');
  const ensureOptionsHolder = () => {
    let holder = document.getElementById('boardHeaderOptionsHolder');
    if (!holder) {
      holder = document.createElement('div');
      holder.id = 'boardHeaderOptionsHolder';
      holder.style.margin = '8px 0';
  holder.className = 'preview';
  // Place holder after the entire meta row so it spans full width
  if (metaRow) metaRow.insertAdjacentElement('afterend', holder);
  else headerBarForOptions?.insertAdjacentElement('afterend', holder);
    }
    return holder;
  };
  const closeOptionsUnderHeader = () => {
    try {
      const holder = document.getElementById('boardHeaderOptionsHolder');
      if (holder && replaySettingsMenu) {
        replaySettingsMenu.style.display = 'none';
        // Move it back under boardPanel (default hidden)
        const boardPanel = document.getElementById('boardPanel');
        if (boardPanel) boardPanel.appendChild(replaySettingsMenu);
        holder.parentElement?.removeChild(holder);
      }
    } catch {}
    requestAnimationFrame(() => { if (boardRenderer) { boardRenderer.resizeOverlay(); renderAttemptOverlay(); updateMovesPlacement(); } });
  };
  const openOptionsUnderHeader = () => {
    try {
      const holder = ensureOptionsHolder();
      if (replaySettingsMenu) {
        holder.appendChild(replaySettingsMenu);
        replaySettingsMenu.style.display = '';
      }
    } catch {}
    requestAnimationFrame(() => { if (boardRenderer) { boardRenderer.resizeOverlay(); renderAttemptOverlay(); updateMovesPlacement(); } });
  };
  if (replaySettingsBtn && replaySettingsMenu) {
    replaySettingsBtn.onclick = () => {
      const isOpen = !!(document.getElementById('boardHeaderOptionsHolder') && replaySettingsMenu.parentElement && replaySettingsMenu.style.display !== 'none');
      if (isOpen) closeOptionsUnderHeader();
      else openOptionsUnderHeader();
    };
  }

  // Converter show/hide and restore
  const gridEl = document.getElementById('grid');
  const converterPanel = document.getElementById('converterPanel');
  const toggleConverter = document.getElementById('toggleConverter');
  const restoreConverterBtn = document.getElementById('restoreConverter');
  const converterRestoreWrap = document.getElementById('converterRestoreWrap');
  if (toggleConverter && converterPanel && gridEl) {
    toggleConverter.onclick = () => {
      const isHidden = converterPanel.style.display === 'none';
      if (isHidden) {
        converterPanel.style.display = '';
        gridEl.classList.remove('conv-collapsed');
        toggleConverter.textContent = 'Hide Converter';
        if (converterRestoreWrap) converterRestoreWrap.style.display = 'none';
        gridEl.classList.remove('tight');
      } else {
        converterPanel.style.display = 'none';
        gridEl.classList.add('conv-collapsed');
        toggleConverter.textContent = 'Show Converter';
        if (converterRestoreWrap) converterRestoreWrap.style.display = '';
        // If there is enough width to keep moves on the right, enable tight mode
        try {
          const bp = document.getElementById('boardPanel');
          const row = bp ? bp.querySelector('.boardRow') : null;
          const boardWrap = bp ? bp.querySelector('.board-wrap') : null;
          const cont = gridEl.getBoundingClientRect().width;
          const boardW = boardWrap ? boardWrap.getBoundingClientRect().width : 620;
          const gap = 20;
          const sideW = 520;
          const canFit = cont >= (boardW + gap + sideW + 10);
          // If can't fit with current board width, try tight board (520)
          const canFitTight = cont >= (520 + gap + sideW + 10);
          if (!canFit && canFitTight) {
            gridEl.classList.add('tight');
            requestAnimationFrame(() => { updateMovesPlacement(); });
          } else {
            gridEl.classList.remove('tight');
          }
        } catch {}
      }
      requestAnimationFrame(() => { if (boardRenderer) { boardRenderer.resizeOverlay(); renderAttemptOverlay(); updateMovesPlacement(); } });
    };
  }
  if (restoreConverterBtn && converterPanel && gridEl) {
    restoreConverterBtn.onclick = () => {
      converterPanel.style.display = '';
      gridEl.classList.remove('conv-collapsed');
      if (toggleConverter) toggleConverter.textContent = 'Hide Converter';
      if (converterRestoreWrap) converterRestoreWrap.style.display = 'none';
      requestAnimationFrame(() => { if (boardRenderer) { boardRenderer.resizeOverlay(); renderAttemptOverlay(); updateMovesPlacement(); } });
    };
  }

  // Moves panel show/hide
  const toggleMoves = document.getElementById('toggleMoves');
  const showMovesTop = document.getElementById('showMovesTop');
  if (toggleMoves) toggleMoves.onclick = () => setMovesVisible(false);
  if (showMovesTop) showMovesTop.onclick = () => setMovesVisible(true);

  // Header editor toggles
  const toggleEditorBtn = document.getElementById('toggleEditor');
  const toggleEditorOriginalBtn = document.getElementById('toggleEditorOriginal');
  if (toggleEditorBtn) toggleEditorBtn.onclick = () => toggleEditor('converted');
  if (toggleEditorOriginalBtn) toggleEditorOriginalBtn.onclick = () => toggleEditor('original');
  const boardHeaderBar = document.getElementById('boardHeaderBar');
  if (boardHeaderBar) {
    boardHeaderBar.addEventListener('click', () => openEditorUnderHeader());
  }

  // Header fields live update
  try {
    const el = headerManager?.elements;
    if (el?.pgnEvent) el.pgnEvent.addEventListener('input', onHeaderFieldChange);
    if (el?.pgnSite) el.pgnSite.addEventListener('input', onHeaderFieldChange);
    if (el?.pgnDate) el.pgnDate.addEventListener('input', onHeaderFieldChange);
    if (el?.pgnWhite) el.pgnWhite.addEventListener('input', onHeaderFieldChange);
    if (el?.pgnBlack) el.pgnBlack.addEventListener('input', onHeaderFieldChange);
    if (el?.pgnVariant) el.pgnVariant.addEventListener('change', onHeaderFieldChange);
  } catch {}

  // Replay settings
  const hideOpp = document.getElementById('hideOpp');
  const skipIllegal = document.getElementById('skipIllegal');
  const latestOnly = document.getElementById('latestOnly');
  const showRaw = document.getElementById('showRaw');
  const showDetails = document.getElementById('showDetails');
  if (hideOpp) hideOpp.addEventListener('change', renderBoard);
  if (skipIllegal) skipIllegal.addEventListener('change', () => { renderBoard(); renderMoves(); renderRawMove(); });
  if (latestOnly) latestOnly.addEventListener('change', () => { renderAttemptOverlay(); });
  if (showRaw) showRaw.addEventListener('change', renderRawMove);
  if (showDetails) showDetails.addEventListener('change', () => {
    const detailsWrap = document.getElementById('detailsWrap');
    if (detailsWrap) detailsWrap.style.display = showDetails.checked ? '' : 'none';
  });

  // Responsive placement
  window.addEventListener('resize', () => { if (boardRenderer) { boardRenderer.resizeOverlay(); renderAttemptOverlay(); } });
  window.addEventListener('resize', updateMovesPlacement);
  requestAnimationFrame(updateMovesPlacement);
}

function updateMovesPlacement() {
  try {
    const grid = document.getElementById('grid'); if (!grid) return;
    const bp = document.getElementById('boardPanel'); if (!bp) return;
    const row = bp.querySelector('.boardRow'); if (!row) return;
    const cont = grid.getBoundingClientRect().width;
    const boardWrap = bp.querySelector('.board-wrap');
    const boardRect = boardWrap ? boardWrap.getBoundingClientRect() : { width: 460 };
    const gap = 20;
    let convWidth = 520;
    const converterPanel = document.getElementById('converterPanel');
    if (converterPanel && converterPanel.style.display !== 'none') {
      const cr = converterPanel.getBoundingClientRect();
      if (cr && cr.width > 0) convWidth = Math.max(480, Math.min(560, Math.round(cr.width)));
    }
    const needed = boardRect.width + gap + convWidth + 10;
    if (cont >= needed) row.classList.add('moves-right');
    else row.classList.remove('moves-right');
  } catch {}
}

function detectEditorContext() {
  const pgnEditor = document.getElementById('pgnEditor');
  if (!pgnEditor || pgnEditor.style.display === 'none') return null;
  const parentId = pgnEditor.parentElement?.id;
  if (parentId === 'originalWrap') return 'original';
  if (parentId === 'convertedWrap') return 'converted';
  if (parentId === 'boardHeaderEditorHolder') {
    const t = fileManager.lastInputType ?? detectType(input.value);
    if (t === 'pgn') return 'original';
    const op = document.getElementById('outputPreview');
    if (op && detectType(op.value) === 'pgn') return 'converted';
  }
  return null;
}

function onHeaderFieldChange() {
  if (!headerManager) return;
  headerManager.renderBoardHeaderMeta(gameState);
  const ctx = detectEditorContext();
  if (!ctx) return;
  try {
    if (ctx === 'original') {
      const updated = headerManager.applyPanelHeadersToPgnText(input.value || '');
      input.value = updated;
      updateOriginalInfo();
      updateConvertedPreview(updated);
      try { const { header } = parsePgn(updated); gameState.lastHeader = header; } catch {}
    } else if (ctx === 'converted') {
      const outputPreview = document.getElementById('outputPreview');
      const outputInfo = document.getElementById('outputInfo');
      if (outputPreview) {
        const updated = headerManager.applyPanelHeadersToPgnText(outputPreview.value || '');
        outputPreview.value = updated;
        if (outputInfo) {
          const len = updated.length; const lines = (updated.match(/\n/g) || []).length + 1;
          outputInfo.textContent = `${lines} lines • ${len} chars`;
        }
        try { const { header } = parsePgn(updated); gameState.lastHeader = header; } catch {}
      }
    }
  } catch {}
}

function toggleEditor(which) {
  const pgnEditor = document.getElementById('pgnEditor');
  const outputPreview = document.getElementById('outputPreview');
  if (!pgnEditor) return;
  const holder = document.getElementById('boardHeaderEditorHolder');
  const isOpenUnderHeader = holder && pgnEditor && holder.contains(pgnEditor) && pgnEditor.style.display !== 'none';
  const nowShown = pgnEditor.style.display !== 'none';
  const toggleEditorBtn = document.getElementById('toggleEditor');
  const toggleEditorOriginalBtn = document.getElementById('toggleEditorOriginal');
  // If header editor is open and user explicitly requests an editor, move it there and show
  if (isOpenUnderHeader && which) {
    try { holder.parentElement?.removeChild(holder); } catch {}
    if (which === 'converted') {
      const parent = document.getElementById('convertedWrap');
      if (parent && pgnEditor.parentElement !== parent) parent.appendChild(pgnEditor);
      if (outputPreview) outputPreview.style.display = 'none';
      if (toggleEditorBtn) toggleEditorBtn.classList.add('active');
      if (toggleEditorOriginalBtn) toggleEditorOriginalBtn.classList.remove('active');
    } else if (which === 'original') {
      const parent = document.getElementById('originalWrap');
      if (parent && pgnEditor.parentElement !== parent) parent.appendChild(pgnEditor);
      if (input) input.style.display = 'none';
      if (toggleEditorOriginalBtn) toggleEditorOriginalBtn.classList.add('active');
      if (toggleEditorBtn) toggleEditorBtn.classList.remove('active');
    }
    pgnEditor.style.display = '';
    return;
  }
  if (nowShown) {
    pgnEditor.style.display = 'none';
    if (which === 'converted' && outputPreview) outputPreview.style.display = '';
    if (which === 'original' && input) input.style.display = '';
    if (toggleEditorBtn) toggleEditorBtn.classList.remove('active');
    if (toggleEditorOriginalBtn) toggleEditorOriginalBtn.classList.remove('active');
    if (holder && holder.contains(pgnEditor)) {
      try {
        holder.parentElement?.removeChild(holder);
      } catch {}
      const parent = document.getElementById('convertedWrap') || document.body;
      if (parent && pgnEditor.parentElement !== parent) parent.appendChild(pgnEditor);
    }
    return;
  }
  // Determine source and target container
  let src = null; let mode = null;
  const t = fileManager.lastInputType ?? detectType(input.value);
  if (which === 'original' || (t === 'pgn')) { src = input.value; mode = 'original'; }
  else if (which === 'converted' || (outputPreview && detectType(outputPreview.value) === 'pgn')) { src = outputPreview.value; mode = 'converted'; }
  if (!src) { status.textContent = 'No PGN to edit.'; return; }
  headerManager.parsePgnHeadersToPanel(src);
  if (mode === 'original') {
    const parent = document.getElementById('originalWrap');
    if (parent && pgnEditor.parentElement !== parent) { parent.appendChild(pgnEditor); }
    if (input) input.style.display = 'none';
    if (toggleEditorOriginalBtn) toggleEditorOriginalBtn.classList.add('active');
  } else {
    const parent = document.getElementById('convertedWrap');
    if (parent && pgnEditor.parentElement !== parent) { parent.appendChild(pgnEditor); }
    if (outputPreview) outputPreview.style.display = 'none';
    if (toggleEditorBtn) toggleEditorBtn.classList.add('active');
  }
  pgnEditor.style.display = '';
}

function openEditorUnderHeader() {
  const pgnEditor = document.getElementById('pgnEditor');
  const boardHeaderBar = document.getElementById('boardHeaderBar');
  if (!boardHeaderBar || !pgnEditor) return;
  const holder = document.getElementById('boardHeaderEditorHolder');
  const isOpenUnderHeader = holder && pgnEditor && holder.contains(pgnEditor) && pgnEditor.style.display !== 'none';
  const outputPreview = document.getElementById('outputPreview');
  if (isOpenUnderHeader) {
    pgnEditor.style.display = 'none';
    const ctx = detectEditorContext();
    if (ctx === 'original' && input) input.style.display = '';
    if (ctx === 'converted' && outputPreview) outputPreview.style.display = '';
    holder.parentElement?.removeChild(holder);
    const parent = document.getElementById('convertedWrap') || document.body;
    parent.appendChild(pgnEditor);
    const toggleEditorOriginalBtn = document.getElementById('toggleEditorOriginal');
    const toggleEditorBtn = document.getElementById('toggleEditor');
    if (toggleEditorOriginalBtn) toggleEditorOriginalBtn.classList.remove('active');
    if (toggleEditorBtn) toggleEditorBtn.classList.remove('active');
    return;
  }
  let mode = null; let src = null;
  const t = fileManager.lastInputType ?? detectType(input.value);
  if (t === 'pgn') { mode = 'original'; src = input.value; }
  else if (outputPreview && detectType(outputPreview.value) === 'pgn') { mode = 'converted'; src = outputPreview.value; }
  if (!mode || !src) { status.textContent = 'No PGN to edit.'; return; }
  headerManager.parsePgnHeadersToPanel(src);
  if (mode === 'original' && input) input.style.display = '';
  if (mode === 'converted' && outputPreview) outputPreview.style.display = '';
  let holder2 = document.getElementById('boardHeaderEditorHolder');
  if (!holder2) {
    holder2 = document.createElement('div');
    holder2.id = 'boardHeaderEditorHolder';
    holder2.style.margin = '8px 0';
    holder2.className = 'preview';
    const metaRow = document.getElementById('metaRow');
    if (metaRow) metaRow.insertAdjacentElement('afterend', holder2);
    else boardHeaderBar.insertAdjacentElement('afterend', holder2);
  }
  holder2.appendChild(pgnEditor);
  pgnEditor.style.display = '';
}

function updatePlayUI() {
  const playBtn = document.getElementById('play');
  const revPlayBtn = document.getElementById('revPlay');
  const stopBtn = document.getElementById('stop');
  const playSpeedLabel = document.getElementById('playSpeedLabel');
  const revSpeedLabel = document.getElementById('revSpeedLabel');
  const skipIllegal = document.getElementById('skipIllegal');

  const fwd = !!timer, back = !!backTimer;
  if (playBtn) {
    playBtn.classList.toggle('activePulse', fwd);
    // Hide forward play when reverse is active; show otherwise
    playBtn.style.display = back ? 'none' : '';
  }
  if (revPlayBtn) {
    revPlayBtn.classList.toggle('activePulse', back);
    // When forward is active, hide reverse play regardless of availability
    if (fwd) {
      revPlayBtn.style.display = 'none';
    } else {
      let sub = 0;
      if (!skipIllegal || !skipIllegal.checked) {
        const attempts = gameState.illegalByPly[gameState.idx] || [];
        sub = attempts && typeof attempts._subIdx === 'number' ? attempts._subIdx : 0;
      }
      const backAvailable = gameState.idx + sub;
      revPlayBtn.style.display = (backAvailable >= 2) ? '' : 'none';
    }
  }
  if (stopBtn) stopBtn.style.display = (fwd || back) ? '' : 'none';
  if (playSpeedLabel) {
    playSpeedLabel.style.display = fwd && forwardSpeed > 1 ? '' : 'none';
    playSpeedLabel.textContent = fwd && forwardSpeed > 1 ? `x${forwardSpeed}` : '';
  }
  if (revSpeedLabel) {
    revSpeedLabel.style.display = back && backSpeed > 1 ? '' : 'none';
    revSpeedLabel.textContent = back && backSpeed > 1 ? `x${backSpeed}` : '';
  }
}

function startForward() {
  if (timer) return;
  if (backTimer) {
    clearInterval(backTimer);
    backTimer = null;
    backSpeed = 1;
  }
  const base = 700;
  const interval = Math.max(120, Math.floor(base / forwardSpeed));
  timer = setInterval(async () => {
    // Hard pause: if engine is thinking, skip this tick entirely
    try { if (engineManager && engineManager.engineRunning && engineManager.engineBusy) { return; } } catch {}
    if (gameState.idx >= gameState.sanMoves.length) {
      clearInterval(timer);
      timer = null;
      updatePlayUI();
      return;
    }
    const fen = gameState.game.fen();
    const engineOn = !!(engineManager && engineManager.engineRunning);
    if (engineOn) {
      const cached = engineManager.getCached ? engineManager.getCached(fen) : null;
      if (!cached) {
        engineManager.requestAnalysis(fen, { showOnComplete: true, reuseCache: true, origin: 'auto' });
      }
      const high = isHighSpeed();
      const waitBaseToggle = document.getElementById('engineWaitBase');
      const shouldWait = !high && (!!waitBaseToggle ? waitBaseToggle.checked : true);
      if (shouldWait && engineManager.waitUntilIdle) {
        // Balanced idle wait for SF 17.1 lite
        const ok = await engineManager.waitUntilIdle(5000);
        if (!ok && engineManager.abortSearch) {
          // Avoid sticky busy state blocking autoplay; abort current search only
          engineManager.abortSearch();
        }
      }
    }
    step(1);
    if (!(engineManager && engineManager.engineRunning && isHighSpeed() && engineManager.engineBusy)) {
      renderRawMove();
      renderBoard();
    }
  }, interval);
  updatePlayUI();
}

function startBackward() {
  if (backTimer) return;
  if (timer) {
    clearInterval(timer);
    timer = null;
    forwardSpeed = 1;
  }
  const base = 700;
  const interval = Math.max(120, Math.floor(base / backSpeed));
  backTimer = setInterval(() => {
    if (gameState.idx <= 0) {
      clearInterval(backTimer);
      backTimer = null;
      updatePlayUI();
      return;
    }
    try {
      const engineOn = !!(engineManager && engineManager.engineRunning);
      if (engineOn) {
        const high = backSpeed > 1;
        const waitBaseToggle = document.getElementById('engineWaitBase');
        const shouldWait = !high && (!!waitBaseToggle ? waitBaseToggle.checked : true);
        if (shouldWait && engineManager.engineBusy) {
          // Skip this tick to allow engine to finish
          return;
        }
      }
    } catch {}
    step(-1);
    renderRawMove();
  }, interval);
  updatePlayUI();
}

// Pause/resume autoplay when engine is thinking
window.TRLViewer = window.TRLViewer || {};
window.TRLViewer.onEngineBusyChange = async (busy) => {
  try {
    if (busy) {
      // Pause any active timers while engine is thinking
      if (timer) { autoResumeForward = true; clearInterval(timer); timer = null; }
      if (backTimer) { clearInterval(backTimer); backTimer = null; }
      updatePlayUI();
    } else {
      // Resume forward only if it was running before enter-busy
      if (autoResumeForward && gameState && gameState.idx < gameState.sanMoves.length) {
        setTimeout(() => { if (!timer && !backTimer) startForward(); }, 50);
      }
      autoResumeForward = false;
    }
  } catch {}
};

function updateShareControls() { return updateShareControlsUI(fileManager, input, headerManager, gameState); }

function updateOriginalInfo() {
  const originalInfo = document.getElementById('originalInfo');
  if (originalInfo) {
    const txt = input.value;
    const len = txt.length;
    const lines = (txt.match(/\n/g) || []).length + (txt ? 1 : 0);
    originalInfo.textContent = txt ? `${lines} lines • ${len} chars` : '';
  }
}

function updateConvertedPreview(text) {
  const outputElements = {
    convertedWrap: document.getElementById('convertedWrap'),
    outputPreview: document.getElementById('outputPreview'),
    outputTag: document.getElementById('outputTag'),
    outputInfo: document.getElementById('outputInfo')
  };
  fileManager.updateConvertedPreview(text, outputElements).then(() => {
    updateShareControls();
  });
}

function renderAttemptOverlay() {
  if (!boardRenderer) return;
  boardRenderer.resizeOverlay();
  boardRenderer.clearOverlay();
  
  const skipIllegal = document.getElementById('skipIllegal');
  const latestOnly = document.getElementById('latestOnly');
  
  if (!gameState.isKrieg || (skipIllegal && skipIllegal.checked)) return;
  
  const attempts = gameState.illegalByPly[gameState.idx] || [];
  if (!attempts || attempts.length === 0) return;
  
  const sub = attempts._subIdx || 0;
  if (sub <= 0) return;
  
  const showOnlyLatest = latestOnly && latestOnly.checked;
  const lastIdx = sub - 1;
  const startIdx = showOnlyLatest ? lastIdx : 0;
  
  if (showOnlyLatest) {
    if (boardRenderer.overlayHideTimer) {
      clearTimeout(boardRenderer.overlayHideTimer);
    }
    boardRenderer.overlayHideTimer = setTimeout(() => {
      boardRenderer.clearOverlay();
    }, 900);
  }
  
  for (let i = startIdx; i < sub; i++) {
    const raw = attempts[i];
    const m = String(raw).match(/([KQRNBkqrnb]?)([a-h][1-8])\-([KQRNBkqrnb]?)([a-h][1-8])/);
    if (!m) continue;
    
    const from = m[2].toLowerCase();
    const to = m[4].toLowerCase();
    const rel = (lastIdx - i);
    const color = attemptColor(rel);
    const width = Math.max(2, 6 - rel);
    const opacity = Math.max(0.35, 0.95 - rel * 0.12);
    const offsetIndex = rel;
    
    boardRenderer.drawArrow(from, to, {
      color,
      width,
      opacity,
      offsetIndex,
      orientation: gameState.orientation
    });
  }
}

function attemptColor(relIndex) {
  const palette = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6'];
  return palette[Math.min(relIndex, palette.length - 1)];
}

function renderTurnInfo() {
  const turnInfoLeft = document.getElementById('topLeftInfo');
  const turnInfoCenter = document.getElementById('turnInfoCenter');
  if (!turnInfoLeft && !turnInfoCenter) return;
  
  const turn = gameState.game.turn() === 'w' ? 'White' : 'Black';
  let tries = 0;
  let checkTxt = '';
  const prev = Math.max(0, Math.min(gameState.idx - 1, gameState.umpireNotesByPly.length - 1));
  const notes = gameState.umpireNotesByPly[prev] || [];
  
  for (const n of notes) {
    const pm = n.match(/^P(\d+)/);
    if (pm) {
      tries = parseInt(pm[1], 10);
    }
    const cm = n.match(/^C([A-Z]+)/);
    if (cm) {
      const map = { K: 'Knight', R: 'Rank', L: 'Long diagonal', F: 'File', S: 'Short diagonal' };
      const parts = cm[1].split('').map(c => map[c] || c).join(', ');
      checkTxt = `Check: ${parts}`;
    }
  }
  
  const html = `<span class="pill">Turn: ${turn}</span>` +
    (tries ? ` <span class="pill">Tries: ${tries}</span>` : '') +
    (checkTxt ? ` <span class="pill">${checkTxt}</span>` : '');
  if (turnInfoCenter) turnInfoCenter.innerHTML = html;
  if (turnInfoLeft) turnInfoLeft.innerHTML = '';
}

function renderRawMove() {
  const rawWrap = document.getElementById('rawWrap');
  const rawMove = document.getElementById('rawMove');
  const showRaw = document.getElementById('showRaw');
  
  if (!rawWrap || !rawMove) return;
  
  const enabled = showRaw && showRaw.checked;
  rawWrap.style.display = enabled ? '' : 'none';
  if (!enabled) {
    rawMove.textContent = '';
    return;
  }
  
  let ply = Math.max(0, Math.min(gameState.idx - 1, gameState.sanMoves.length - 1));
  const skipIllegal = document.getElementById('skipIllegal');
  if (gameState.isKrieg && (!skipIllegal || !skipIllegal.checked)) {
    const attempts = gameState.illegalByPly[gameState.idx] || [];
    const sub = (attempts && typeof attempts._subIdx === 'number') ? attempts._subIdx : 0;
    if (sub > 0) {
      ply = Math.max(0, Math.min(gameState.idx, gameState.sanMoves.length - 1));
    }
  }
  
  const san = gameState.sanMoves[ply] || '';
  const comment = (gameState.plyComments[ply] ?? '');
  rawMove.textContent = `${san} { ${comment} }`;
}

async function startGame() {
  try {
    status.textContent = '';
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (backTimer) {
      clearInterval(backTimer);
      backTimer = null;
    }
    if (boardRenderer) boardRenderer.clearOverlay();
    
    let text = input.value;
    let t = fileManager.lastInputType ?? detectType(text);
    
    let pgn;
    const outputPreview = document.getElementById('outputPreview');
    if (t === 'trl' && outputPreview && detectType(outputPreview.value) === 'pgn') {
      pgn = outputPreview.value;
    } else {
      if (t === 'pgn') text = headerManager.applyPanelHeadersToPgnText(text);
      pgn = await fileManager.ensurePGN(text);
    }
    
    const tmp = new Chess();
    try {
      tmp.loadPgn(pgn, { strict: false });
    } catch (e) {
      throw new Error('Invalid PGN generated');
    }
    
    gameState.sanMoves = tmp.history();
    gameState.game = new Chess();
    gameState.idx = 0;
    gameState.hasStarted = true;
    
    renderBoard();
    renderMoves();
    updatePlayUI();
    status.textContent = 'Loaded ' + gameState.sanMoves.length + ' moves';
    
    fileManager.lastConverted = await fileManager.ensureAlt(text);
    
    const { header, moves } = parsePgn(pgn);
    gameState.lastHeader = header;
    gameState.isKrieg = !!(header.Variant && header.Variant.toLowerCase().includes('krieg'));
    
    const movesTitle = document.getElementById('movesTitle');
    if (movesTitle) {
      movesTitle.textContent = gameState.isKrieg ? 'Kriegspiel Game' : 'Chess Game';
    }
    
    const replaySettingsMenu = document.getElementById('replaySettingsMenu');
    if (replaySettingsMenu) {
      // Default: keep hidden; user toggles via replaySettingsBtn
      replaySettingsMenu.style.display = 'none';
    }
    
    gameState.orientation = 'white';
    
    // Build per-ply data
    gameState.plyComments = [];
    gameState.illegalByPly = [];
    gameState.umpireNotesByPly = [];
    
    const parseComment = (comment) => {
      if (!comment) return { notes: [], attempts: [] };
      const colon = comment.indexOf(':');
      const notesPart = colon >= 0 ? comment.slice(0, colon).trim() : comment.trim();
      const attemptsPart = colon >= 0 ? comment.slice(colon + 1).trim() : '';
      const notes = notesPart.split(',').map(s => s.trim()).filter(Boolean);
      const attempts = attemptsPart.split(',').map(s => s.trim()).filter(t => /-/.test(t));
      return { notes, attempts };
    };
    
    const collect = (rec) => {
      if (rec.whiteMove) {
        gameState.plyComments.push(rec.whiteComment || '');
        const { notes, attempts } = parseComment(rec.whiteComment || '');
        gameState.umpireNotesByPly.push(notes);
        gameState.illegalByPly.push(Object.assign([...attempts], { _subIdx: 0 }));
      }
      if (rec.blackMove) {
        gameState.plyComments.push(rec.blackComment || '');
        const { notes, attempts } = parseComment(rec.blackComment || '');
        gameState.umpireNotesByPly.push(notes);
        gameState.illegalByPly.push(Object.assign([...attempts], { _subIdx: 0 }));
      }
    };
    
    for (const rec of moves) {
      collect(rec);
    }
    
    // Update meta display
    const meta = $('#meta');
    const fields = ['Event', 'Site', 'Date', 'White', 'Black', 'Variant', 'Result'];
    const parts = fields.map(k => header[k] ? `<div><b>${k}:</b> ${header[k]}</div>` : '').filter(Boolean);
    if (meta) meta.innerHTML = parts.join('') || '';
    
    const detailsWrap = document.getElementById('detailsWrap');
    const showDetails = document.getElementById('showDetails');
    if (detailsWrap) {
      detailsWrap.style.display = (showDetails && showDetails.checked) ? '' : 'none';
    }
    
    try {
      setMovesVisible(true);
    } catch { }
    
    renderRawMove();
  if (headerManager) headerManager.renderBoardHeaderMeta(gameState);
    // Now that a game is loaded, show board panels and converter toggle
    showBoardPanels();
    // Recalculate layout once panels are visible to prevent clipping
    requestAnimationFrame(() => {
      try {
        if (boardRenderer) { boardRenderer.resizeOverlay(); }
        updateMovesPlacement();
      } catch {}
    });
    
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  }
}

function setMovesVisible(visible) {
  const sideColEl = document.getElementById('sideCol');
  const showMovesTop = document.getElementById('showMovesTop');
  
  if (sideColEl) sideColEl.style.display = visible ? '' : 'none';
  if (showMovesTop) showMovesTop.style.display = visible ? 'none' : '';
  
  requestAnimationFrame(() => {
    if (boardRenderer) {
      boardRenderer.resizeOverlay();
      renderAttemptOverlay();
    }
  });
}

async function bootShare() {
  // Simplified share handling - full implementation would go here
  if (input.value) {
    updateConvertedPreview(input.value);
  }
  updatePlayUI();
  renderRawMove();
}

function applyInitialConverterOnlyState() { return applyInitialConverterOnlyStateUI(gameState); }

function showBoardPanels() { return showBoardPanelsUI(); }

// Share link: encode current text into URL hash
async function buildShareUrl() { return buildShareUrlFromModule(fileManager, input); }

async function tryDecodeShareFromURL() {
  try {
    if (!location.hash || location.hash.length < 2) return;
    const q = new URLSearchParams(location.hash.slice(1));
    const fmt = (q.get('fmt') || 'pgn').toLowerCase();
    const c = (q.get('c') || 'raw');
    const d = q.get('d');
    if (!d) return;
    let text = '';
    if (c === 'gz') {
      const bytes = Compression.b64urlToBytes(d);
      text = await Compression.gzipDecompressToString(bytes);
    } else if (c === 'df') {
      const bytes = Compression.b64urlToBytes(d);
      text = await Compression.deflateDecompressToString(bytes);
    } else {
      text = Compression.b64urlDecodeUtf8(d);
    }
    // Ensure text displayed in requested format
    const final = await fileManager.ensureFormat(text, fmt);
    input.value = final;
    fileManager.lastInputType = detectType(final);
    fileManager.setTag(fileManager.lastInputType, originalTag, input);
    updateConvertedPreview(final);
    updateShareControls();
    updateOriginalInfo();
    // In share mode, keep converter visible; user can press Start to load
  } catch (e) {
    console.warn('Share decode failed', e);
  }
}

// Export for global access without clobbering existing hooks (e.g., onEngineBusyChange)
(() => {
  const tv = (window.TRLViewer = window.TRLViewer || {});
  tv.gameState = gameState;
  tv.fileManager = fileManager;
  tv.step = step;
  tv.goTo = goTo;
  tv.renderBoard = renderBoard;
  tv.renderMoves = renderMoves;
  tv.updatePlayUI = updatePlayUI;
  tv.startGame = startGame;
  try {
    Object.defineProperty(tv, 'headerManager', { get: () => headerManager, configurable: true });
    Object.defineProperty(tv, 'engineManager', { get: () => engineManager, configurable: true });
    Object.defineProperty(tv, 'boardRenderer', { get: () => boardRenderer, configurable: true });
  } catch {}
})();