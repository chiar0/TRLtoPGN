// Engine management for Stockfish integration
export class EngineManager {
  constructor() {
    this.engineWorker = null;
    this.engineReady = false;
    this.engineBusy = false;
    this.engineRunning = false;
    this.analysisCache = new Map();
    this.currentContext = null;
    this.elements = this.getElements();
    this.setupEventListeners();
  }

  getElements() {
    return {
      engineAnalyzeBtn: document.getElementById('engineAnalyzeBtn'),
      engineBusyOverlay: document.getElementById('engineBusyOverlay'),
      engineBusyBtn: document.getElementById('engineBusyBtn'),
      engineLog: document.getElementById('engineLog'),
      engineStatusText: document.getElementById('engineStatusText'),
      engineBestMoveText: document.getElementById('engineBestMoveText'),
      engineStatusUnderMoves: document.getElementById('engineStatusUnderMoves'),
      engineDepthInput: document.getElementById('engineDepth'),
      engineTimeInput: document.getElementById('engineTime'),
      engineExplain: document.getElementById('engineExplain'),
      engineVariantSelect: document.getElementById('engineVariantSelect'),
      engineBuildSelect: document.getElementById('engineBuildSelect')
    };
  }

  setEngineStatus(text) {
    const name = this.engineName ? this.engineName : 'Engine';
    if (this.elements.engineStatusText) this.elements.engineStatusText.textContent = `${name}: ${text}`;
    this.updateIconVisuals();
  }

  setupEventListeners() {
    if (this.elements.engineAnalyzeBtn) {
      this.elements.engineAnalyzeBtn.addEventListener('click', async () => {
        // Toggle behavior:
        // - If engine is on (busy or ready), pressing again stops and resets
        // - If off, start a fresh analysis for current FEN
        if (this.engineRunning) {
          this.stopEngine();
          this.updateAnalyzeButton();
          return;
        }
        if (!window.TRLViewer?.gameState?.hasStarted) {
          try { if (window.TRLViewer?.startGame) await window.TRLViewer.startGame(); } catch {}
        }
        if (!window.TRLViewer?.gameState?.hasStarted) { this.setEngineStatus('no game'); return; }
        try {
          const fen = window.TRLViewer.gameState.game.fen();
          const cached = this.getCached ? this.getCached(fen) : null;
          this.engineRunning = true;
          if (cached && cached.bestMove) {
            // Show cached instantly, but still launch a fresh analysis to surface overlay
            this.engineBusy = true;
            this.setEngineStatus('cached');
            try {
              if (window.TRLViewer?.boardRenderer) {
                window.TRLViewer.boardRenderer.clearBestMove();
                window.TRLViewer.boardRenderer.showBestMove(cached.bestMove, window.TRLViewer.gameState.orientation);
              }
            } catch {}
            // Under-moves status
            if (this.elements.engineStatusUnderMoves) {
              const name = this.engineName ? this.engineName : 'Engine';
              if (this.elements.engineStatusText) this.elements.engineStatusText.textContent = `${name}: cached`;
              if (this.elements.engineBestMoveText) {
                this.elements.engineBestMoveText.textContent = this.uciToAlgebraicLabel(cached.bestMove);
                this.elements.engineBestMoveText.style.color = '#22c55e';
              }
            }
            this.updateIconVisuals();
          } else {
            // No cached: start analysis and show overlay
            this.engineBusy = true;
          }
          if (this.elements.engineBestMoveText) this.elements.engineBestMoveText.textContent = '';
          if (this.elements.engineExplain) {
            this.elements.engineExplain.textContent = '';
            this.elements.engineExplain.style.display = (this.elements.engineLog && this.elements.engineLog.checked) ? '' : 'none';
          }
          this.setEngineStatus('initializing...');
          this.updateIconVisuals();
          this.showBusyOverlay(true);
          this.updateAnalyzeButton();
          await this.startAnalysisForFEN(fen);
        } catch {}
      });
    }
    if (this.elements.engineBusyBtn) {
      this.elements.engineBusyBtn.addEventListener('click', () => { this.stopEngine(); this.updateAnalyzeButton(); });
    }

    if (this.elements.engineLog) {
      this.elements.engineLog.addEventListener('change', () => {
        const logEl = this.elements.engineExplain;
        if (!logEl) return;
        const enabled = !!this.elements.engineLog.checked;
        logEl.style.display = enabled ? '' : 'none';
        if (!enabled) logEl.textContent = '';
      });
    }

    // Restart with new settings when engine parameters change
    const onParamsChanged = () => {
      try {
        // If engine is running and a game is loaded, abort current search and restart
        if (window.TRLViewer?.gameState?.hasStarted && this.engineRunning) {
          try { if (this.engineBusy) this.sendEngine('stop'); } catch {}
          this.engineBusy = false;
          this.showBusyOverlay(false);
          this.updateIconVisuals();
          const fen = window.TRLViewer.gameState.game.fen();
          this.requestAnalysis(fen, { showOnComplete: true, reuseCache: false, origin: 'user' });
        }
      } catch {}
    };
    if (this.elements.engineDepthInput) this.elements.engineDepthInput.addEventListener('change', onParamsChanged);
    if (this.elements.engineTimeInput) this.elements.engineTimeInput.addEventListener('change', onParamsChanged);

    const onVariantChanged = async () => {
      try {
        // Terminate current worker and clear readiness so next analysis loads the new variant
        if (this.engineWorker) { try { this.engineWorker.terminate(); } catch {} }
        this.engineWorker = null;
        this.engineReady = false;
        this.analysisCache.clear();
        this.setEngineStatus('reloading...');
        // If analyzing, stop overlay
        this.abortSearch();
        // Optionally auto-restart analysis for current fen if game running
        if (window.TRLViewer?.gameState?.hasStarted) {
          this.engineRunning = true;
          const fen = window.TRLViewer.gameState.game.fen();
          await this.startAnalysisForFEN(fen);
        }
      } catch {}
    };
    if (this.elements.engineVariantSelect) this.elements.engineVariantSelect.addEventListener('change', onVariantChanged);
  }

  async loadEngineWorker() {
    if (this.engineWorker) return this.engineWorker;
    try {
      const hook = window.__TEST_ENGINE_WORKER__;
      if (hook && typeof hook.create === 'function') {
        this.appendEngineExplain('TEST: using fake engine worker');
        const w = hook.create();
        this.engineWorker = w;
        this.engineReady = true;
        this.engineWorker.onmessage = (ev) => this.onEngineMessage(ev);
        this.setEngineStatus('loaded (test)');
        return this.engineWorker;
      }
    } catch {}
  const sel = document.getElementById('engineBuildSelect');
  const pick = (sel && sel.value) || 'npm';
  const varSel = document.getElementById('engineVariantSelect');
  const variant = (varSel && varSel.value) || 'lite-single';

    // If the user explicitly chose the embedded engine, try it first and return.
    if (pick === 'embedded') {
      try {
        const mod = await import('../embedded/stockfish-lite-embedded.js');
        if (mod && typeof mod.createEmbeddedLiteWorker === 'function') {
          const w = mod.createEmbeddedLiteWorker();
          this.engineWorker = w;
          this.engineReady = true;
          this.engineWorker.onmessage = (ev) => this.onEngineMessage(ev);
          this.setEngineStatus('loaded (embedded)');
          this.appendEngineExplain('Motore caricato embedded (lite) su richiesta.');
          return this.engineWorker;
        }
      } catch (e) {
        this.appendEngineExplain('Embedded non disponibile: ' + (e && e.message) + '. Procedo con i fallback standard.');
        // Fall through to normal candidates
      }
    }
    // Default: only try the single-threaded lite build (no SharedArrayBuffer required)
    // Select candidate by variant; only download when selected
    let candidates = [];
    if (pick === 'embedded') {
      candidates = ['embedded'];
    } else {
      const table = {
        'lite-single': 'vendor/stockfish/stockfish-17.1-lite-single-03e3232.js',
        'lite': 'vendor/stockfish/stockfish-17.1-lite-51f59da.js',
        'full-single': 'vendor/stockfish/stockfish-17.1-single-a496a04.js',
        'full': 'vendor/stockfish/stockfish-17.1-8e4d048.js',
        'asm': 'vendor/stockfish/stockfish-17.1-asm-341ff22.js'
      };
      const u = table[variant] || table['lite-single'];
      candidates = [u];
    }

    for (const url of candidates) {
      try {
        this.setEngineStatus('loading ' + url);
        this.appendEngineExplain(`Provo: ${url}`);

        // Check for WASM file if this is a JS file
        try {
          const low = url.toLowerCase();
          if (low.endsWith('.js') || low.includes('.js?')) {
            const wasmUrl = this.getWasmUrl(url);
            if (wasmUrl) {
              this.appendEngineExplain(`Controllo WASM: ${wasmUrl}`);
              try {
                const resp = await fetch(wasmUrl, { method: 'HEAD' });
                if (!resp.ok) {
                  this.appendEngineExplain(`WASM non trovato o non accessibile (${resp.status}) per ${wasmUrl}. Provo comunque a caricare il worker.`);
                }
              } catch (fe) {
                this.appendEngineExplain(`HEAD fallito per ${wasmUrl}: ${fe && fe.message}. Provo comunque.`);
              }
            }
          }
        } catch (fe2) {
          this.appendEngineExplain(`Preflight WASM check failed: ${fe2 && fe2.message}`);
        }

        const resolvedUrl = new URL(url, location.href).href;
        let w = null;
        try {
          // Create worker directly from script URL to preserve base path for internal wasm fetches
          w = new Worker(resolvedUrl);
        } catch (e) {
          w = null;
        }

        if (!w) {
          this.appendEngineExplain(`Impossibile avviare Worker per ${url}`);
          continue;
        }

        w.onerror = (err) => {
          this.appendEngineExplain(`Worker error for ${url}: ${err.message || err}`);
        };

        const ready = await new Promise((resolve) => {
          const t = setTimeout(() => {
            try { w.terminate(); } catch (_) { }
            resolve(false);
          }, 6000);
          
          w.onmessage = (ev) => {
            const d = (ev.data || '') + '';
            this.appendEngineExplain(`Messaggio da ${url}: ${d}`);
            if (/uciok|readyok|stockfish/i.test(d) || /uci/i.test(d)) {
              clearTimeout(t);
              resolve(true);
            }
          };
          
          try {
            // Some builds allow setting a baseUrl/locateFile via a config message; send before 'uci'
            try { w.postMessage({ cmd: 'config', baseUrl: new URL('.', resolvedUrl).href }); } catch {}
            w.postMessage('uci');
          } catch (e) {
            this.appendEngineExplain(`postMessage fallito per ${url}: ${e && e.message}`);
          }
        });

        if (ready) {
          this.engineWorker = w;
          this.engineReady = true;
          this.engineWorker.onmessage = (ev) => this.onEngineMessage(ev);
          this.setEngineStatus('loaded');
          this.appendEngineExplain(`Motore caricato da ${url}`);
          return this.engineWorker;
        }
        this.appendEngineExplain(`Nessuna risposta valida da ${url}`);
      } catch (e) {
        this.appendEngineExplain(`Eccezione durante prova ${url}: ${e && e.message}`);
      }
    }

    // No automatic embedded fallback: keep behavior predictable to avoid regressions.
    this.setEngineStatus('failed to load');
    this.appendEngineExplain('Errore: nessun build disponibile o Worker bloccato. Controlla console per dettagli e verifica che il server serva .wasm con il MIME corretto.');
    return null;
  }

  getWasmUrl(url) {
    try {
      const base = new URL(url, location.href);
      const name = base.pathname.split('/').pop() || '';
  // No WASM for asm builds or loader script
  if (/-asm-.*\.js$/i.test(name)) return null;
      if (/stockfish-loader\.js$/i.test(name)) return null;
      // Determine proper wasm filename for the given JS build
      let wasmPath = base.pathname.replace(/\.js(\?.*)?$/, '.wasm');
      const isAsm = /stockfish-.*-asm\.js$/i.test(name);
      const isLiteSingle = /stockfish-.*-lite-single-.*\.js$/i.test(name);
      const isLite = /stockfish-.*-lite-.*\.js$/i.test(name);
      const isSingleChunked = /stockfish-.*-single-.*\.js$/i.test(name) && !isLiteSingle;
      const isMultiChunked = /stockfish-\d+\.\d+-[a-f0-9]+\.js$/i.test(name) && !isLite && !isLiteSingle && !isAsm;
      if (isSingleChunked || isMultiChunked) {
        wasmPath = base.pathname.replace(/\.js(\?.*)?$/, '-part-0.wasm');
      }
      return new URL(wasmPath, base.origin).href;
    } catch (e) {
      return null;
    }
  }

  sendEngine(cmd) {
    try {
      if (this.engineWorker) this.engineWorker.postMessage(cmd);
    } catch (e) { }
  }

  onEngineMessage(ev) {
    const msg = (ev.data || '') + '';
    // Try to capture engine name on startup messages
    if (/^id\s+name\s+(.*)$/im.test(msg)) {
      try { this.engineName = msg.match(/^id\s+name\s+(.*)$/im)[1].trim(); } catch {}
    }
    
  if (/bestmove\s+/i.test(msg)) {
      const m = msg.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?|[a-h][1-8][qrbn]?)/i);
      const bm = m ? m[1] : '(none)';
      this.setEngineStatus(`best ${bm}`);
      const ctx = this.currentContext;
      // Only accept result when it matches the current expected FEN
      const curFenSafe = (window.TRLViewer && window.TRLViewer.gameState && window.TRLViewer.gameState.game) ? window.TRLViewer.gameState.game.fen() : null;
      if (ctx && ctx.fen && curFenSafe === ctx.fen) {
        this.engineBusy = false;
        this.analysisCache.set(ctx.fen, { bestMove: bm, ts: Date.now() });
        this.currentContext = null;
      } else {
        // Late or stale result: clear busy state to avoid stalls, but don't cache/apply
        this.engineBusy = false;
        this.currentContext = null;
        this.showBusyOverlay(false);
        this.updateIconVisuals();
        return;
      }
      this.updateIconVisuals();
      
      try {
        const ex = this.engineExplainForBest(bm);
        this.appendEngineExplain(ex);
      } catch (e) { }
      
      try {
        if (ctx && ctx.showOnComplete && window.TRLViewer?.boardRenderer && window.TRLViewer?.gameState) {
          const curFen = window.TRLViewer.gameState.game.fen();
          if (curFen === ctx.fen) {
            window.TRLViewer.boardRenderer.clearBestMove();
            window.TRLViewer.boardRenderer.showBestMove(bm, window.TRLViewer.gameState.orientation);
          }
        }
        // Update under-moves status with engine name and best move
        if (this.elements.engineStatusUnderMoves) {
          const name = this.engineName ? this.engineName : 'Engine';
          if (this.elements.engineStatusText) this.elements.engineStatusText.textContent = `${name}: ready`;
          if (this.elements.engineBestMoveText) {
            this.elements.engineBestMoveText.textContent = this.uciToAlgebraicLabel(bm);
            this.elements.engineBestMoveText.style.color = '#22c55e';
          }
        }
  // Hide busy overlay after best move
  setTimeout(() => this.showBusyOverlay(false), 80);
      } catch (e) { }
      return;
    }

    if (/info\s+/i.test(msg)) {
      const scm = msg.match(/score\s+(cp|mate)\s+(-?\d+)/i);
      const pvm = msg.match(/pv\s+(.+)$/i);
      let scoreText = '';
      if (scm) {
        if (scm[1].toLowerCase() === 'mate') {
          scoreText = `mate ${scm[2]}`;
        } else {
          scoreText = `cp ${scm[2]}`;
        }
      }
      let pvText = pvm ? pvm[1].split(' ').slice(0, 6).join(' ') : '';
      if (scoreText || pvText) {
        this.setEngineStatus((scoreText ? scoreText + ' ' : '') + (pvText ? `pv ${pvText}` : ''));
        // Live update under-moves status
        if (this.elements.engineStatusUnderMoves && this.elements.engineStatusText) {
          const name = this.engineName ? this.engineName : 'Engine';
          this.elements.engineStatusText.textContent = `${name}: ${scoreText || ''}`.trim();
        }
      }
      
      try {
        const ex = this.engineExplainFromInfo(scoreText || '', pvText || '');
        this.appendEngineExplain(ex);
      } catch (e) { }
    }
  }

  appendEngineExplain(text) {
    try {
      const logEl = this.elements.engineExplain;
      if (!logEl) return;
      const enabled = !!(this.elements.engineLog && this.elements.engineLog.checked);
      logEl.style.display = enabled ? '' : 'none';
      if (!enabled) return;
      const cur = logEl.textContent || '';
      const next = text ? (cur ? cur + '\n' + text : text) : cur;
      logEl.textContent = next;
    } catch (e) { }
  }

  showCachedForFen(fen) {
    try {
      const rec = this.getCached ? this.getCached(fen) : null;
      if (!rec || !rec.bestMove) return false;
      // Update status under moves with engine name and best move
      const name = this.engineName ? this.engineName : 'Engine';
      if (this.elements.engineStatusText) this.elements.engineStatusText.textContent = `${name}: ready`;
      if (this.elements.engineBestMoveText) {
        this.elements.engineBestMoveText.textContent = this.uciToAlgebraicLabel(rec.bestMove);
        this.elements.engineBestMoveText.style.color = '#22c55e';
      }
      // Draw best move arrow
      try {
        if (window.TRLViewer?.boardRenderer && window.TRLViewer?.gameState) {
          window.TRLViewer.boardRenderer.clearBestMove();
          window.TRLViewer.boardRenderer.showBestMove(rec.bestMove, window.TRLViewer.gameState.orientation);
        }
      } catch {}
      // Ensure overlay/UI reflect idle state
      this.engineBusy = false;
      this.showBusyOverlay(false);
      this.updateIconVisuals();
      return true;
    } catch { return false; }
  }

  uciToAlgebraicLabel(uci) {
    if (!uci) return '';
    const pm = uci.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/i);
    if (pm) {
      return `${pm[1]}→${pm[2]}` + (pm[3] ? `=${pm[3].toUpperCase()}` : '');
    }
    return uci;
  }

  engineExplainForBest(bestMove) {
    if (!bestMove) return '';
    const label = this.uciToAlgebraicLabel(bestMove);
    if (/^[a-h][1-8]$/.test(bestMove)) {
      return `Analisi: l'engine indica la casella di partenza ${bestMove}. Probabilmente si tratta di una notazione troncata: prova a fare un'analisi più profonda o aumentare il tempo.`;
    }
    return `Analisi: la mossa suggerita è ${label}. Questa è la migliore mossa trovata dall'engine alla profondità richiesta.`;
  }

  engineExplainFromInfo(scoreText, pvText) {
    let parts = [];
    if (scoreText) {
      const m = scoreText.match(/(-?\d+)/);
      if (m) {
        const v = parseInt(m[1], 10);
        if (/mate/i.test(scoreText)) {
          parts.push(`Valutazione: mate in ${m[1]}`);
        } else {
          parts.push(`Valutazione: ${v / 100} (centipawn)`);
        }
      }
    }
    if (pvText && pvText.trim()) {
      parts.push(`Linea principale: ${pvText}`);
    }
    return parts.join(' — ');
  }

  async ensureEngineReady() {
    if (!this.engineReady) {
      await this.loadEngineWorker();
    }
    if (!this.engineWorker) throw new Error('engine-load-failed');
    this.sendEngine('uci');
    const okUci = await new Promise((res) => {
      let settled = false;
      const to = setTimeout(()=>{ if(!settled) res(false); }, 1200);
      const prev = this.engineWorker.onmessage;
      this.engineWorker.onmessage = (ev) => {
        const d = (ev.data||'')+'';
        if (/uciok/i.test(d) || /id\s+name/i.test(d)) { settled = true; clearTimeout(to); res(true); }
        if (prev) prev.call(this.engineWorker, ev);
      };
      try { this.engineWorker.postMessage('uci'); } catch {}
    });
    this.sendEngine('isready');
    await new Promise(res => setTimeout(res, okUci ? 200 : 400));
    this.engineReady = true;
    this.setEngineStatus('ready');
  }

  async startAnalysisForFEN(fen) {
    // Force fresh analysis when triggered by the user so overlay appears
    await this.requestAnalysis(fen, { showOnComplete: true, reuseCache: false, origin: 'user' });
  }

  stopEngine() {
    try {
      if (this.engineWorker) this.sendEngine('stop');
      this.engineBusy = false;
      this.engineRunning = false;
      this.setEngineStatus('stopped');
      if (this.elements.engineExplain) this.elements.engineExplain.style.display = 'none';
      this.updateIconVisuals();
      this.showBusyOverlay(false);
      this.updateAnalyzeButton();
      try { if (window.TRLViewer?.boardRenderer) window.TRLViewer.boardRenderer.clearBestMove(); } catch {}
    } catch (e) { }
  }

  abortSearch() {
    try {
      if (this.engineWorker) this.sendEngine('stop');
    } catch {}
    this.engineBusy = false;
    // Keep engineRunning true; it's just an abort of current search
    this.setEngineStatus('ready');
    this.showBusyOverlay(false);
    this.updateIconVisuals();
    this.updateAnalyzeButton();
  }

  getCached(fen) {
    return this.analysisCache.get(fen);
  }

  resetAll() {
    try {
      this.stopEngine();
    } catch {}
    try { this.analysisCache.clear(); } catch {}
    this.currentContext = null;
    this.engineReady = false;
  }

  async requestAnalysis(fen, opts) {
    if (!this.engineRunning) return null;
    const options = Object.assign({ showOnComplete: false, reuseCache: true, origin: 'auto' }, opts || {});
    const cached = this.getCached(fen);
    if (options.reuseCache && cached) {
      this.engineBusy = false;
      this.setEngineStatus('cached');
      // Update best move visuals immediately
      try {
        if (cached.bestMove && window.TRLViewer?.boardRenderer) {
          window.TRLViewer.boardRenderer.clearBestMove();
          window.TRLViewer.boardRenderer.showBestMove(cached.bestMove, window.TRLViewer.gameState.orientation);
        }
      } catch {}
      this.showBusyOverlay(false);
      this.updateIconVisuals();
      // Under-moves status
      if (this.elements.engineStatusUnderMoves) {
        const name = this.engineName ? this.engineName : 'Engine';
        if (this.elements.engineStatusText) this.elements.engineStatusText.textContent = `${name}: cached`;
        if (this.elements.engineBestMoveText && cached.bestMove) {
          this.elements.engineBestMoveText.textContent = this.uciToAlgebraicLabel(cached.bestMove);
          this.elements.engineBestMoveText.style.color = '#22c55e';
        }
      }
      return cached;
    }
    try {
      await this.ensureEngineReady();
    } catch (e) {
      this.setEngineStatus('not available');
      this.engineBusy = false;
      this.engineRunning = false;
      this.showBusyOverlay(false);
      return null;
    }
    // Stop previous search if running for a different FEN
    try {
      if (this.engineBusy && this.currentContext && this.currentContext.fen !== fen) {
        this.sendEngine('stop');
        await new Promise(r => setTimeout(r, 60));
      }
    } catch (_) {}
    this.currentContext = { fen, showOnComplete: !!options.showOnComplete };
    this.engineBusy = true;
    this.updateIconVisuals();
  // Prefer time-based search for responsiveness; fall back to depth
  const depth = Math.max(1, parseInt(this.elements.engineDepthInput?.value || '12', 10));
  const msec = Math.max(0, parseInt(this.elements.engineTimeInput?.value || '200', 10));
    this.sendEngine('ucinewgame');
    this.sendEngine('position fen ' + fen);
    if (msec > 0) {
      this.sendEngine('go movetime ' + msec);
    } else if (depth > 0) {
      this.sendEngine('go depth ' + depth);
    } else {
      this.sendEngine('go infinite');
    }
    this.setEngineStatus('thinking...');
    // Show overlay for both user and auto origins so harness can detect it
    this.showBusyOverlay(true);
    // Timeout logic: abort if no info/bestmove in 5s
    let gotInfo = false;
    let infoListener = (ev) => {
      const msg = (ev.data || '') + '';
      if (/info\s+/i.test(msg) || /bestmove\s+/i.test(msg)) {
        gotInfo = true;
      }
    };
    this.engineWorker.addEventListener('message', infoListener);
    await new Promise((resolve) => {
      let done = false;
      const timeout = setTimeout(() => {
        if (!gotInfo) {
          this.abortSearch();
          this.setEngineStatus('timeout');
          this.showBusyOverlay(false);
          this.engineBusy = false;
        }
        done = true;
        resolve();
      }, 5000);
      let check = () => {
        if (gotInfo && !done) {
          clearTimeout(timeout);
          done = true;
          resolve();
        } else if (!done) {
          setTimeout(check, 100);
        }
      };
      check();
    });
    this.engineWorker.removeEventListener('message', infoListener);
    return null;
  }

  async waitUntilIdle(maxMs = 6000) {
    let waited = 0;
    while (this.engineBusy && waited < maxMs) {
      await new Promise(r => setTimeout(r, 50));
      waited += 50;
    }
    if (!this.engineBusy) {
      // Ensure overlay reflects idle state even if bestmove wasn't captured
      this.showBusyOverlay(false);
      this.updateIconVisuals();
    }
    return !this.engineBusy;
  }

  updateIconVisuals() {
    // Busy overlay and status under moves
    const wrap = this.elements.engineBusyOverlay;
    // Overlay is controlled explicitly by request origin (user vs auto)
    const statusBox = this.elements.engineStatusUnderMoves;
    if (statusBox) statusBox.style.display = this.engineRunning ? '' : 'none';
    this.updateAnalyzeButton();
  }

  updateAnalyzeButton() {
    const btn = this.elements.engineAnalyzeBtn;
    if (!btn) return;
    // States: idle (not running), busy (running+busy), ready (running+!busy)
    const idle = !this.engineRunning;
    const busy = this.engineRunning && this.engineBusy;
    const ready = this.engineRunning && !this.engineBusy;
    btn.classList.toggle('activePulse', busy);
    btn.classList.toggle('active', ready);
    btn.textContent = busy ? '⚡ Thinking' : '⚡';
    btn.title = busy ? 'Analyzing (click overlay to stop)' : (ready ? 'Engine on (click to stop)' : 'Analyze position');
  }

  showBusyOverlay(show) {
    const ov = this.elements.engineBusyOverlay;
    const toolbar = document.querySelector('.toolbar');
  if (ov) ov.style.display = show ? 'flex' : 'none';
  if (toolbar) toolbar.style.display = show ? 'none' : '';
    if (this.elements.engineBusyBtn) this.elements.engineBusyBtn.classList.toggle('activePulse', !!show);
    // Also disable nav buttons
    const ids = ['backAll','back','revPlay','stop','play','forward','forwardAll'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !!show;
    });
    // Notify autoplay controller to pause/resume based on busy state
    try {
      if (window.TRLViewer && typeof window.TRLViewer.onEngineBusyChange === 'function') {
        window.TRLViewer.onEngineBusyChange(!!show);
      }
    } catch {}
  }
}