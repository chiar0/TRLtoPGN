import * as Compression from './compression.js';
import { detectType } from './utils.js';

export function initShareUI(ctx) {
  const { fileManager, input, status } = ctx;
  const shareBtn = document.getElementById('shareLink');
  if (!shareBtn) return;
  shareBtn.onclick = async () => {
    const opPrev = document.getElementById('outputPreview');
    if (!opPrev || !opPrev.value || !opPrev.value.trim()) return;
    const settingsPanel = document.getElementById('settingsPanel');
    const shareWrap = document.getElementById('shareLinkWrap');
    const shareBox = document.getElementById('shareLinkBox');
    if (settingsPanel) settingsPanel.style.display = '';
    if (shareWrap) shareWrap.style.display = '';
    const updateBox = async () => {
      const url = await buildShareUrl(fileManager, input);
      if (shareBox) shareBox.value = url;
      try { await navigator.clipboard.writeText(url); if (status) status.textContent = 'Share link copied!'; } catch {}
    };
    await updateBox();
    const fmt = document.getElementById('shareFormatSelect');
    const comp = document.getElementById('compressionSelect');
    const onChange = () => { updateBox(); };
    if (fmt) fmt.addEventListener('change', onChange);
    if (comp) comp.addEventListener('change', onChange);
  };
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
