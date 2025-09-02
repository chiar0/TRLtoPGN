import * as Compression from './compression.js';

export function initShareUI(ctx) {
  const { fileManager, input, status } = ctx;
  const shareBtn = document.getElementById('shareLink');
  if (!shareBtn) return;
  shareBtn.onclick = async () => {
    // Allow sharing regardless of whether the converted preview is visible
    const settingsPanel = document.getElementById('settingsPanel');
    const shareWrap = document.getElementById('shareLinkWrap');
    const shareBox = document.getElementById('shareLinkBox');
    const shareCopy = document.getElementById('shareLinkCopy');
    const shareLen = document.getElementById('shareLinkLen');
    const safeCopy = async (text) => {
      try { await navigator.clipboard.writeText(text); return true; } catch {}
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        const ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        return !!ok;
      } catch { return false; }
    };
    if (settingsPanel) settingsPanel.style.display = '';
    if (shareWrap) shareWrap.style.display = '';
    const updateBox = async () => {
      const url = await buildShareUrl(fileManager, input);
      if (shareBox) shareBox.value = url;
      if (shareLen) shareLen.textContent = `${url.length} chars`;
      try { if (shareBox) { shareBox.focus(); shareBox.select(); } } catch {}
      const ok = await safeCopy(url);
      if (status) status.textContent = ok ? 'Share link copied!' : 'Link ready (copy failed)';
    };
    await updateBox();
    if (shareCopy) {
      shareCopy.onclick = async () => {
        const url = shareBox?.value || await buildShareUrl(fileManager, input);
        const ok = await safeCopy(url);
        if (status) status.textContent = ok ? 'Share link copied!' : 'Copy failed';
      };
    }
    const fmt = document.getElementById('shareFormatSelect');
    const comp = document.getElementById('compressionSelect');
    const onChange = () => { updateBox(); };
    if (fmt) fmt.addEventListener('change', onChange);
    if (comp) comp.addEventListener('change', onChange);
  };

  // Export: Standalone single-file HTML (lite)
  try {
    const btnStandalone = document.getElementById('exportStandalone');
    if (btnStandalone) btnStandalone.onclick = async () => {
      try {
        // Load modular HTML and inline CSS/JS
        const htmlResp = await fetch('./index.html');
        let html = await htmlResp.text();
        // Inline all CSS modules to avoid @import resolution offline
        const cssFiles = [
          'variables.css','base.css','header.css','layout.css','panels.css','forms.css','controls.css','board.css','moves.css','ui-elements.css','meta.css'
        ];
        let css = '';
        for (const f of cssFiles) {
          try { const r = await fetch(`./src/styles/${f}`); css += `\n/* ${f} */\n` + await r.text(); } catch {}
        }
        html = html.replace('<link rel="stylesheet" href="./src/styles/main.css?v=dev">', `<style>${css}</style>`);
        // Build a minimal bundle using an import map with data URLs for all local modules
        const toB64 = (txt) => btoa(unescape(encodeURIComponent(txt)));
        // Alias mapping for modules we need; keys are normalized absolute-like paths
        const aliasOf = (path) => {
          if (path.startsWith('/src/js/modules/')) return '@app' + path.replace('/src/js', '');
          if (path === '/src/js/main.js') return '@app/main.js';
          if (path.startsWith('/src/js/embedded/')) return '@app' + path.replace('/src/js', '');
          if (path.startsWith('/dist/')) return '@dist' + path.replace('/dist', '');
          if (path === '/shims/fs.js') return '@shim/fs.js';
          if (path === '/shims/path.js') return '@shim/path.js';
          return null;
        };
        const srcPaths = [
          '/src/js/main.js',
          '/src/js/modules/utils.js',
          '/src/js/modules/game-state.js',
          '/src/js/modules/header-manager.js',
          '/src/js/modules/board-renderer.js',
          '/src/js/modules/file-manager.js',
          '/src/js/modules/engine-manager.js',
          '/src/js/modules/compression.js',
          '/src/js/modules/share-manager.js',
          '/src/js/modules/clipboard-manager.js',
          '/src/js/modules/ui-visibility.js',
          '/src/js/embedded/stockfish-lite-embedded.js',
          '/dist/trl-to-pgn.js',
          '/dist/pgn-to-trl.js',
          '/shims/fs.js',
          '/shims/path.js'
        ];
        const codeMap = new Map();
        // Fetch all sources
        for (const p of srcPaths) {
          try {
            const resp = await fetch('.' + p);
            if (!resp.ok) continue;
            const txt = await resp.text();
            codeMap.set(p, txt);
          } catch {}
        }
        // Rewrite import specifiers to use aliases
        const rewriteImports = (code, curPath) => {
          const base = 'https://x' + curPath; // for URL resolution
          const replaceSpec = (spec) => {
            // Do not rewrite Node-like bare specifiers we purposefully alias via import map
            if (spec === 'fs' || spec === 'path') return spec;
            try {
              const resolved = new URL(spec, base).pathname; // normalized like /src/js/modules/utils.js
              const alias = aliasOf(resolved);
              return alias || spec;
            } catch { return spec; }
          };
          // from "..."
          code = code.replace(/from\s+['"]([^'"]+)['"]/g, (m, s) => `from '${replaceSpec(s)}'`);
          // bare import "..."
          code = code.replace(/import\s+['"]([^'"]+)['"]/g, (m, s) => `import '${replaceSpec(s)}'`);
          // dynamic import("...")
          code = code.replace(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, (m, s) => `import('${replaceSpec(s)}')`);
          return code;
        };
        const importsMap = {};
        for (const [path, src] of codeMap.entries()) {
          const alias = aliasOf(path);
          if (!alias) continue;
          const rewritten = rewriteImports(src, path);
          importsMap[alias] = 'data:text/javascript;base64,' + toB64(rewritten);
        }
        // Try to embed external dependencies for full offline use
        try {
          const chessUrl = 'https://unpkg.com/chess.js@1.0.0/dist/esm/chess.js';
          const chessResp = await fetch(chessUrl);
          if (chessResp.ok) {
            const chessTxt = await chessResp.text();
            // Map the absolute URL specifier to a data URL via import map
            importsMap[chessUrl] = 'data:text/javascript;base64,' + toB64(chessTxt);
          }
        } catch {}
        // chessboard-element is loaded via a separate <script type="module" src=...>; inline it if available
        // and map its relative module imports to data: URLs so file:// works without CORS.
        let cbeInline = '';
        let removedCbeExternal = false;
        try {
          const cbeUrl = 'https://unpkg.com/chessboard-element?module';
          const cbeResp = await fetch(cbeUrl);
          if (cbeResp.ok) {
            let cbeTxt = await cbeResp.text();
            // Try to fetch its likely relative deps across versions
            const base = 'https://unpkg.com/chessboard-element';
            const depUrls = [
              // Common older paths
              `${base}/lib/chessboard-element.js?module`,
              `${base}/lib/chess-utils.js?module`,
              `${base}/chess-utils.js?module`,
              // Newer/alternative paths seen in recent releases
              `${base}/utils.js?module`,
              `${base}/lib/utils.js?module`,
              // Styles modules across versions
              `${base}/lib/chessboard-styles.js?module`,
              `${base}/chessboard-styles.js?module`,
              `${base}/lib/styles.js?module`,
              `${base}/styles.js?module`,
              // Pieces SVG modules across versions
              `${base}/wikipedia-pieces-svg.js?module`,
              `${base}/lib/wikipedia-pieces-svg.js?module`,
              `${base}/pieces-svg.js?module`,
              `${base}/lib/pieces-svg.js?module`
            ];
            const depMap = new Map();
            for (const u of depUrls) {
              try {
                const r = await fetch(u);
                if (r.ok) depMap.set(u, await r.text());
              } catch {}
            }
            // Build import map aliases for anything we found
            const aliasAdd = (key, txt) => { if (txt) importsMap[key] = 'data:text/javascript;base64,' + toB64(txt); };
            // Prefer specific aliases; support multiple variants mapping to same key
            const dLibBoard = depMap.get(`${base}/lib/chessboard-element.js?module`) || '';
            // Separate chess-specific utils vs general utils
            const dLibChessUtils = depMap.get(`${base}/lib/chess-utils.js?module`) || '';
            const dRootChessUtils = depMap.get(`${base}/chess-utils.js?module`) || '';
            const chessUtilsTxt = dLibChessUtils || dRootChessUtils || '';
            const dRootGeneralUtils = depMap.get(`${base}/utils.js?module`) || '';
            const dLibGeneralUtils = depMap.get(`${base}/lib/utils.js?module`) || '';
            const generalUtilsTxt = dRootGeneralUtils || dLibGeneralUtils || '';
            // Styles: prefer lib/chessboard-styles, fallback to root/chessboard-styles or styles.js variants
            const dLibStyles = depMap.get(`${base}/lib/chessboard-styles.js?module`) || '';
            const dRootStyles = depMap.get(`${base}/chessboard-styles.js?module`) || '';
            const dLibStylesAlt = depMap.get(`${base}/lib/styles.js?module`) || '';
            const dRootStylesAlt = depMap.get(`${base}/styles.js?module`) || '';
            const stylesTxt = dLibStyles || dRootStyles || dLibStylesAlt || dRootStylesAlt || '';
            // Pieces modules
            const dPiecesWikipedia = depMap.get(`${base}/wikipedia-pieces-svg.js?module`) || depMap.get(`${base}/lib/wikipedia-pieces-svg.js?module`) || '';
            const dPiecesDefault = depMap.get(`${base}/pieces-svg.js?module`) || depMap.get(`${base}/lib/pieces-svg.js?module`) || '';
            // Generic rewrite of relative imports to cbe/* aliases
            const aliasForName = (name) => {
              if (name === 'chessboard-element') return 'cbe/chessboard';
              if (name === 'chess-utils') return 'cbe/chess-utils';
              if (name === 'utils') return 'cbe/utils';
              if (name === 'chessboard-styles' || name === 'styles') return 'cbe/styles';
              if (name === 'wikipedia-pieces-svg') return 'cbe/pieces-wikipedia';
              if (name === 'pieces-svg' || name === 'pieces') return 'cbe/pieces';
              return null;
            };
            const rewriteRel = (txt) => txt
              .replace(/(from|import)\s+['"]\.\/(?:lib\/)?([\w-]+)\.js(?:\?module)?['"]/g, (m, kw, nm) => {
                const a = aliasForName(nm); return a ? `${kw} '${a}'` : m;
              });
            const rewriteDeepCopyImport = (txt) => txt
              .replace(/import\s*\{\s*([^}]*\bdeepCopy\b[^}]*)\s*\}\s*from\s*['"]cbe\/utils['"]\s*;?/g, (m, inside) => `import { ${inside} } from 'cbe/utils-provided';`);
            cbeTxt = rewriteRel(cbeTxt);
            // If cbe imports deepCopy from utils, rewrite to a safe shim
            cbeTxt = rewriteDeepCopyImport(cbeTxt);
            // For nested deps, ensure their own relative imports point to our alias too
            let d1 = dLibBoard;
            let dChess = chessUtilsTxt;
            let dUtils = generalUtilsTxt;
            let d3 = stylesTxt;
            if (d1) {
              d1 = rewriteRel(d1);
              d1 = rewriteDeepCopyImport(d1);
              aliasAdd('cbe/chessboard', d1);
            }
            if (dChess) { dChess = rewriteRel(dChess); dChess = rewriteDeepCopyImport(dChess); aliasAdd('cbe/chess-utils', dChess); }
            if (dUtils) {
              dUtils = rewriteRel(dUtils);
              // Store the original utils under a different key
              aliasAdd('cbe/utils-original', dUtils);
              // Provide a wrapper that re-exports everything and ensures deepCopy exists
              const wrapper =
                "import * as U from 'cbe/utils-original';\n" +
                "export * from 'cbe/utils-original';\n" +
                "export const deepCopy = (U && U.deepCopy) ? U.deepCopy : (obj => { try { return (typeof structuredClone === 'function') ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); } catch(e){ try { return JSON.parse(JSON.stringify(obj)); } catch(e2){ return obj; } } });\n";
              aliasAdd('cbe/utils', wrapper);
            }
            if (d3) {
              d3 = rewriteRel(d3);
              // Ensure any deepCopy import uses shim
              d3 = rewriteDeepCopyImport(d3);
              aliasAdd('cbe/styles', d3);
            }
            // Provide a safe deepCopy shim module that re-exports from utils if available
            importsMap['cbe/utils-provided'] = 'data:text/javascript;base64,' + toB64(
              "import * as U from 'cbe/utils';\n" +
              "export * from 'cbe/utils';\n" +
              "export const deepCopy = (U && U.deepCopy) ? U.deepCopy : (obj => { try { return (typeof structuredClone === 'function') ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); } catch(e){ try { return JSON.parse(JSON.stringify(obj)); } catch(e2){ return obj; } } });\n"
            );
            if (dPiecesWikipedia) {
              let d = rewriteRel(dPiecesWikipedia);
              d = rewriteDeepCopyImport(d);
              aliasAdd('cbe/pieces-wikipedia', d);
            }
            if (dPiecesDefault) {
              let d = rewriteRel(dPiecesDefault);
              d = rewriteDeepCopyImport(d);
              aliasAdd('cbe/pieces', d);
            }
            cbeInline = `<script type=\"module\">${cbeTxt}</script>`;
            // Remove the external tag; we'll insert inline after the import map so aliases resolve
            const before = html;
            html = html.replace(/<script[^>]+src=\"https:\/\/unpkg\.com\/chessboard-element\?module\"[^>]*><\/script>/, '');
            removedCbeExternal = before !== html;
          }
        } catch {}
        // Compose final import map: include fs/path shims + our aliases
        const importMapObj = { imports: Object.assign(
          {},
          {
            fs: importsMap['@shim/fs.js'] || './shims/fs.js',
            path: importsMap['@shim/path.js'] || './shims/path.js'
          },
          importsMap
        ) };
        const importMapTag = `<script type=\"importmap\">${JSON.stringify(importMapObj)}</script>`;
        // Place import map and then inline chessboard-element directly after it, to ensure the map is active
        if (cbeInline && removedCbeExternal) {
          html = html.replace(/<script type=\"importmap\">[\s\S]*?<\/script>/, (m) => `${importMapTag}${cbeInline}`);
        } else {
          html = html.replace(/<script type=\"importmap\">[\s\S]*?<\/script>/, importMapTag);
          if (cbeInline) {
            // As a fallback, inject inline cbe before main module script
            html = html.replace(/<script type=\"module\" src=\"\.\/src\/js\/main\.js\"><\/script>/, `${cbeInline}$&`);
          }
        }
        // Build the hash now and set it BEFORE boot so the app picks it up
        let hashSetter = '';
        let embedSetter = '';
        try {
          const fmt = (document.getElementById('shareFormatSelect')?.value || 'pgn');
          const text = await fileManager.ensureFormat(input.value || '', fmt);
          const esc = (s) => s.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/</g,'\\x3c');
          embedSetter = `<script>window.TRL_EMBED={fmt:'${fmt}',text:\`${esc(text)}\`};</script>`;
          const shareUrl = await buildShareUrl(fileManager, input);
          const withHash = shareUrl.split('#')[1] || '';
          const safe = withHash
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '')
            .replace(/</g, '\\x3c');
          hashSetter = `<script>try{location.hash='${safe}';}catch(e){}</script>`;
        } catch {}
        // Mark standalone context and bootstrap main via alias
        const standaloneFlag = `<script>window.TRL_STANDALONE = true;</script>`;
        const bootstrap = `<script type="module">import '@app/main.js';</script>`;
        html = html.replace('<script type="module" src="./src/js/main.js"></script>', `${hashSetter}${embedSetter}${standaloneFlag}${bootstrap}`);
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'viewer-standalone.html';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch (e) {
        if (status) status.textContent = 'Export failed';
      }
    };
  } catch {}
}

export async function buildShareUrl(fileManager, input) {
  const compression = (document.getElementById('compressionSelect')?.value || 'auto');
  const format = (document.getElementById('shareFormatSelect')?.value || 'pgn');
  const text = input.value || '';
  let payload = text;
  try { payload = await fileManager.ensureFormat(text, format); } catch {}
  let scheme = 'raw';
  let data = null;
  if (compression === 'none') {
    scheme = 'raw';
    data = Compression.b64urlEncodeUtf8(payload);
  } else if (compression === 'gzip') {
    const comp = await Compression.gzipCompressString(payload);
    if (comp) { scheme = 'gz'; data = Compression.bytesToB64url(comp); }
    else { scheme = 'raw'; data = Compression.b64urlEncodeUtf8(payload); }
  } else if (compression === 'deflate') {
    const comp = await Compression.deflateCompressString(payload);
    if (comp) { scheme = 'df'; data = Compression.bytesToB64url(comp); }
    else { scheme = 'raw'; data = Compression.b64urlEncodeUtf8(payload); }
  } else {
    const comp = await Compression.gzipCompressString(payload);
    if (comp) { scheme = 'gz'; data = Compression.bytesToB64url(comp); }
    else { scheme = 'raw'; data = Compression.b64urlEncodeUtf8(payload); }
  }
  const hash = `v=1&fmt=${encodeURIComponent(format)}&c=${scheme}&d=${data}`;
  const url = `${location.origin}${location.pathname}#${hash}`;
  return url;
}
