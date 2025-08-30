import { detectType } from './utils.js';

export function initClipboardUI(ctx) {
  const { fileManager, input, status } = ctx;
  const copyOriginal = document.getElementById('copyOriginal');
  if (copyOriginal) {
    copyOriginal.onclick = async () => {
      const data = input.value || '';
      if (!data) { if (status) status.textContent = 'Nothing to copy.'; return; }
      try { await navigator.clipboard.writeText(data); if (status) status.textContent = 'Copied original'; } catch { if (status) status.textContent = 'Copy failed'; }
    };
  }
  const downloadOriginal = document.getElementById('downloadOriginal');
  if (downloadOriginal) {
    downloadOriginal.onclick = () => {
      const data = input.value || '';
      const t = fileManager.lastInputType ?? detectType(data);
      if (!data || !t) { if (status) status.textContent = 'No original data.'; return; }
      const ext = t === 'pgn' ? 'pgn' : 'trl';
      downloadBlob(data, `original.${ext}`);
    };
  }
  const copyConverted = document.getElementById('copyConverted');
  if (copyConverted) {
    copyConverted.onclick = async () => {
      const op = document.getElementById('outputPreview');
      const data = op?.value || '';
      if (!data) { if (status) status.textContent = 'Nothing to copy.'; return; }
      try { await navigator.clipboard.writeText(data); if (status) status.textContent = 'Copied converted'; } catch { if (status) status.textContent = 'Copy failed'; }
    };
  }
  const downloadConverted = document.getElementById('downloadConverted');
  if (downloadConverted) {
    downloadConverted.onclick = () => {
      const op = document.getElementById('outputPreview');
      const data = op?.value || '';
      const t = fileManager.lastInputType ?? detectType(input.value);
      if (!data || !t) { if (status) status.textContent = 'No converted data.'; return; }
      const ext = t === 'pgn' ? 'trl' : 'pgn';
      downloadBlob(data, `converted.${ext}`);
    };
  }
}

export function downloadBlob(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
