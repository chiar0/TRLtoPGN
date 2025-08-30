// UI visibility helpers extracted for maintainability
import { detectType } from './utils.js';

export function applyInitialConverterOnlyState(gameState) {
  try {
    const started = !!gameState.hasStarted;
    const gridEl = document.getElementById('grid');
    if (!started) {
      const boardPanel = document.getElementById('boardPanel');
      if (boardPanel) boardPanel.style.display = 'none';
      const toggleConverter = document.getElementById('toggleConverter');
      if (toggleConverter) toggleConverter.style.display = 'none';
      if (gridEl) gridEl.classList.add('conv-only');
      const convertedWrap = document.getElementById('convertedWrap');
      if (convertedWrap) convertedWrap.style.display = 'none';
      // Ensure settings panels are closed initially and hide share/settings buttons
      try {
        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel) settingsPanel.style.display = 'none';
        const replaySettingsMenu = document.getElementById('replaySettingsMenu');
        if (replaySettingsMenu) replaySettingsMenu.style.display = 'none';
        const shareBtn = document.getElementById('shareLink');
        if (shareBtn) shareBtn.style.display = 'none';
        const settingsBtnTop = document.getElementById('settingsBtn');
        if (settingsBtnTop) settingsBtnTop.style.display = 'none';
        const optHolder = document.getElementById('boardHeaderOptionsHolder');
        if (optHolder && optHolder.parentElement) optHolder.parentElement.removeChild(optHolder);
        const edHolder = document.getElementById('boardHeaderEditorHolder');
        if (edHolder && edHolder.parentElement) edHolder.parentElement.removeChild(edHolder);
      } catch {}
    }
  } catch {}
}

export function showBoardPanels() {
  try {
    const boardPanel = document.getElementById('boardPanel');
    if (boardPanel) boardPanel.style.display = '';
    const toggleConverter = document.getElementById('toggleConverter');
    if (toggleConverter) toggleConverter.style.display = '';
    const gridEl = document.getElementById('grid');
    if (gridEl) gridEl.classList.remove('conv-only');
  } catch {}
}

export function updateShareControls(fileManager, input, headerManager, gameState) {
  const t = fileManager.lastInputType ?? detectType(input.value);
  const inputIsPgn = (t === 'pgn');
  const outputPreview = document.getElementById('outputPreview');
  const convertedIsPgn = (!inputIsPgn && outputPreview && outputPreview.value && detectType(outputPreview.value) === 'pgn');
  
  const toggleEditorOriginalBtn = document.getElementById('toggleEditorOriginal');
  const toggleEditorBtn = document.getElementById('toggleEditor');
  const boardHeaderBar = document.getElementById('boardHeaderBar');
  const shareBtn = document.getElementById('shareLink');
  const settingsBtnTop = document.getElementById('settingsBtn');
  
  if (toggleEditorOriginalBtn) toggleEditorOriginalBtn.style.display = inputIsPgn ? '' : 'none';
  if (toggleEditorBtn) toggleEditorBtn.style.display = convertedIsPgn ? '' : 'none';
  
  const hasAnyPgn = inputIsPgn || convertedIsPgn;
  if (boardHeaderBar) {
    boardHeaderBar.style.display = hasAnyPgn ? '' : 'none';
  }
  if (hasAnyPgn && headerManager) {
    headerManager.renderBoardHeaderMeta(gameState);
  }
  // Show share/settings only after we have a detected type and a non-empty converted preview
  const hasType = !!t;
  const hasConvertedText = !!(outputPreview && typeof outputPreview.value === 'string' && outputPreview.value.trim().length > 0);
  const allowShareUI = hasType && hasConvertedText;
  if (shareBtn) shareBtn.style.display = allowShareUI ? '' : 'none';
  if (settingsBtnTop) settingsBtnTop.style.display = allowShareUI ? '' : 'none';
}
