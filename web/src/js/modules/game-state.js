// Game state management
import { Chess } from 'https://unpkg.com/chess.js@1.0.0/dist/esm/chess.js';
import { EMPTY_FEN } from './utils.js';

export class GameState {
  constructor() {
    this.game = new Chess();
    this.sanMoves = [];
    this.idx = 0;
    this.hasStarted = false;
    this.isKrieg = false;
    this.orientation = 'white';
    this.lastHeader = {};
    this.plyComments = [];
    this.illegalByPly = [];
    this.umpireNotesByPly = [];
  }

  reset() {
    this.game = new Chess();
    this.sanMoves = [];
    this.idx = 0;
    this.hasStarted = false;
    this.plyComments = [];
    this.illegalByPly = [];
    this.umpireNotesByPly = [];
  }

  getFen() {
    return this.hasStarted ? this.game.fen() : EMPTY_FEN;
  }

  setMoves(sanMoves) {
    this.sanMoves = sanMoves;
    this.game.reset();
    this.idx = 0;
  }

  goTo(n) {
    this.game.reset();
    this.idx = Math.max(0, Math.min(n, this.sanMoves.length));
    for (let i = 0; i < this.idx; i++) {
      this.game.move(this.sanMoves[i]);
    }
  }

  step(dir) {
    const attempts = this.isKrieg ? (this.illegalByPly[this.idx] || []) : [];
    if (dir > 0) {
      if (this.isKrieg && attempts && attempts._subIdx !== undefined && attempts._subIdx < attempts.length) {
        attempts._subIdx++;
        return;
      }
      if (this.idx < this.sanMoves.length) {
        this.game.move(this.sanMoves[this.idx++]);
        const nextAttempts = this.illegalByPly[this.idx] || [];
        nextAttempts._subIdx = 0;
      }
    } else {
      if (this.isKrieg) {
        const curAttempts = this.illegalByPly[this.idx] || [];
        if (curAttempts && curAttempts._subIdx && curAttempts._subIdx > 0) {
          curAttempts._subIdx--;
          return;
        }
      }
      if (this.idx > 0) {
        this.game.undo();
        this.idx--;
      }
    }
  }
}