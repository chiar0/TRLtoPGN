// Main application entry point - ROOT VERSION
import { Chess } from 'https://unpkg.com/chess.js@1.0.0/dist/esm/chess.js';
import { ludiiToPgn } from './web/dist/trl-to-pgn.js';
import { pgnToTrl, parsePgn } from './web/dist/pgn-to-trl.js';

// Import all modules
import * as Utils from './web/src/js/modules/utils.js';
import { GameState } from './web/src/js/modules/game-state.js';
import { BoardRenderer } from './web/src/js/modules/board-renderer.js';
import { FileManager } from './web/src/js/modules/file-manager.js';
import { HeaderManager } from './web/src/js/modules/header-manager.js';
import { EngineManager } from './web/src/js/modules/engine-manager.js';
import * as Compression from './web/src/js/modules/compression.js';

(async function() {
  'use strict';

  const { $ } = Utils;

  // Initialize all managers
  const gameState = new GameState(Chess);
  const boardRenderer = new BoardRenderer();
  const fileManager = new FileManager();
  const headerManager = new HeaderManager();
  const engineManager = new EngineManager();

  // Connect DOM elements
  const elements = {
    input: $('#input'),
    originalTag: $('#originalTag'),
    file: $('#file'),
    board: $('#board'),
    status: $('#status'),
    shareLink: $('#shareLink'),
    // ... add other elements as needed
  };

  // Initialize the application
  async function initApp() {
    console.log('TRL⇄PGN Viewer initializing...');
    
    try {
      await boardRenderer.init(elements.board);
      await fileManager.init();
      await headerManager.init();
      
      setupEventListeners();
      
      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }

  function setupEventListeners() {
    // File handling
    if (elements.file) {
      elements.file.addEventListener('change', async (e) => {
        const result = await fileManager.handleFileUpload(e);
        if (result) {
          elements.input.value = result.content;
          elements.status.textContent = `Loaded: ${result.filename}`;
        }
      });
    }

    // Start game
    const startBtn = $('#start');
    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        try {
          await startGame();
        } catch (error) {
          elements.status.textContent = `Error: ${error.message}`;
        }
      });
    }
  }

  async function startGame() {
    const inputText = elements.input.value;
    if (!inputText.trim()) {
      throw new Error('Please provide PGN or TRL input');
    }

    const pgn = await ensurePGN(inputText);
    await gameState.loadPGN(pgn);
    boardRenderer.render(gameState);
    
    elements.status.textContent = `Loaded ${gameState.getMoveCount()} moves`;
  }

  async function ensurePGN(text) {
    const type = Utils.detectType(text);
    if (type === 'pgn') return text;
    if (type === 'trl') {
      return ludiiToPgn(text, 'game.trl', 'Client Game', 'Player 1', 'Player 2');
    }
    throw new Error('Unable to detect input format');
  }

  // Start the application
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})().catch(console.error);