#!/usr/bin/env node

// Imports
import * as fs from 'fs';
import * as path from 'path';

// #region Global variables and Types
type Board = Record<string, number>; // Maps algebraic square to Ludii piece number

// Chess piece mapping from PGN symbol to Ludii number
const PGN_PIECE_TO_LUDII: Record<string, { white: number; black: number }> = {
    'P': { white: 1, black: 2 },
    'R': { white: 3, black: 4 },
    'K': { white: 5, black: 6 },
    'B': { white: 7, black: 8 },
    'N': { white: 9, black: 10 },
    'Q': { white: 11, black: 12 }
};

const LUDII_PIECE_TO_PGN: Record<number, string> = {
    1: 'P', 2: 'P', 3: 'R', 4: 'R', 5: 'K', 6: 'K',
    7: 'B', 8: 'B', 9: 'N', 10: 'N', 11: 'Q', 12: 'Q'
};

const UMPIRE_NOTE_MAP: Record<string, string> = {
    'CK': 'Knight Check', 'CR': 'Rank check', 'CL': 'Long diagonal check',
    'CF': 'File check', 'CS': 'Short diagonal check', 'CLF': 'Long diagonal check,File check'
};
// #endregion

// #region Coordinate Conversion
/**
 * Converts algebraic chess notation (e.g., 'e4') to Ludii coordinates (0-63).
 */
function algebraicToLudii(square: string): number {
    if (!square || square.length !== 2) return -1;
    const file = square[0].toLowerCase();
    const rank = parseInt(square[1], 10);
    if (file < 'a' || file > 'h' || rank < 1 || rank > 8) return -1;
    return (file.charCodeAt(0) - 'a'.charCodeAt(0)) + (rank - 1) * 8;
}

/**
 * Converts Ludii coordinates (0-63) to algebraic chess notation (e.g., 'e4').
 */
function ludiiToAlgebraic(coord: number): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + (coord % 8));
    const rank = String(Math.floor(coord / 8) + 1);
    return file + rank;
}
// #endregion

// #region Board Management & Move Logic
/**
 * Creates the standard initial chess board.
 */
function createInitialBoard(): Board {
    const board: Board = {};
    const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let i = 0; i < 8; i++) {
        const file = String.fromCharCode('a'.charCodeAt(0) + i);
        // White pieces
        board[`${file}1`] = PGN_PIECE_TO_LUDII[backRank[i]].white;
        board[`${file}2`] = PGN_PIECE_TO_LUDII['P'].white;
        // Black pieces
        board[`${file}8`] = PGN_PIECE_TO_LUDII[backRank[i]].black;
        board[`${file}7`] = PGN_PIECE_TO_LUDII['P'].black;
    }
    return board;
}

/**
 * Applies a move to the board and returns the new board state.
 */
function applyMove(board: Board, from: string, to: string, promotion: string | null = null, player: number): Board {
    const newBoard = { ...board };
    const piece = newBoard[from];
    if (piece === undefined) return newBoard;

    delete newBoard[to]; // Handle capture
    delete newBoard[from];
    
    if (promotion) {
        newBoard[to] = player === 1 ? PGN_PIECE_TO_LUDII[promotion].white : PGN_PIECE_TO_LUDII[promotion].black;
    } else {
        newBoard[to] = piece;
    }
    
    // Handle castling
    if (LUDII_PIECE_TO_PGN[piece] === 'K' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) {
        const rank = from[1];
        if (to[0] === 'g') { // Kingside
            const rook = newBoard['h' + rank];
            delete newBoard['h' + rank];
            newBoard['f' + rank] = rook;
        } else { // Queenside
            const rook = newBoard['a' + rank];
            delete newBoard['a' + rank];
            newBoard['d' + rank] = rook;
        }
    }
    
    // Simple en passant capture detection (pawn captures diagonally to empty square)
    if (LUDII_PIECE_TO_PGN[piece] === 'P' && from[0] !== to[0] && !board[to]) {
        const capturedPawnSquare = to[0] + from[1];
        delete newBoard[capturedPawnSquare];
    }
    
    return newBoard;
}

/**
 * Finds the source square of a move given the board state and SAN.
 * This is a simplified implementation for a complex problem.
 */
function findMoveSource(board: Board, player: number, san: string): { from: string; to: string; promotion: string | null } {
    // Handle castling
    if (san === 'O-O') {
        return { from: player === 1 ? 'e1' : 'e8', to: player === 1 ? 'g1' : 'g8', promotion: null };
    }
    if (san === 'O-O-O') {
        return { from: player === 1 ? 'e1' : 'e8', to: player === 1 ? 'c1' : 'c8', promotion: null };
    }
    
    let cleaned = san.replace(/[+#]/g, ''); // remove check/mate markers

    let promotion: string | null = null;
    if (cleaned.includes('=')) {
        promotion = cleaned.split('=')[1].slice(0,1);
        // remove promotion part from cleaned so parsing below isn't affected
        cleaned = cleaned.split('=')[0];
    }

    // Determine piece and the rest (disambiguation, capture marker, target)
    let pieceLetter = 'P';
    let rest = cleaned;
    if (/^[NBRQK]/.test(cleaned)) {
        pieceLetter = cleaned[0];
        rest = cleaned.slice(1);
    }

    const isCapture = rest.includes('x');
    // target is always last two chars (e.g., e4)
    const to = rest.slice(-2);
    const disambig = rest.slice(0, Math.max(0, rest.length - 2)).replace(/x/g, ''); // could be file, rank or both

    // Find all pieces of the correct type and color that can move to the target square
    const possibleSources: string[] = [];
    for (const sq in board) {
        const piece = board[sq];
        if (!piece) continue;
        if (piece % 2 === player % 2 && LUDII_PIECE_TO_PGN[piece] === pieceLetter) {
            if (canPieceMoveTo(pieceLetter, sq, to, isCapture, board)) {
                // Apply disambiguation if present
                if (disambig) {
                    let ok = true;
                    if (disambig.length === 1) {
                        const ch = disambig;
                        if (/[a-h]/.test(ch)) ok = sq[0] === ch;
                        else if (/[1-8]/.test(ch)) ok = sq[1] === ch;
                    } else if (disambig.length === 2) {
                        ok = sq === disambig;
                    }
                    if (!ok) continue;
                }
                possibleSources.push(sq);
            }
        }
    }
    
    if (possibleSources.length === 0) {
        throw new Error(`Could not find source for move ${san} for player ${player}. Board state: ${Object.keys(board).filter(k=>board[k]).map(k=>k+':' + LUDII_PIECE_TO_PGN[board[k]]).join(',')}`);
    }
    if (possibleSources.length > 1) console.warn(`Ambiguous move found for ${san}, picking first option: ${possibleSources.join(', ')}`);

    return { from: possibleSources[0], to: to, promotion };
}

/**
 * Checks if the path between two squares is clear for sliding pieces.
 */
function isPathClear(from: string, to: string, board: Board): boolean {
    const f1 = from.charCodeAt(0), r1 = parseInt(from[1]);
    const f2 = to.charCodeAt(0), r2 = parseInt(to[1]);
    const df = f2 > f1 ? 1 : f2 < f1 ? -1 : 0;
    const dr = r2 > r1 ? 1 : r2 < r1 ? -1 : 0;
    let f = f1 + df;
    let r = r1 + dr;
    while (f !== f2 || r !== r2) {
        const sq = String.fromCharCode(f) + r.toString();
        if (board[sq]) return false;
        f += df;
        r += dr;
    }
    return true;
}

/**
 * Simplified check if a piece can move from `from` to `to`.
 */
function canPieceMoveTo(piece: string, from: string, to: string, isCapture: boolean, board: Board): boolean {
    const f1 = from.charCodeAt(0), r1 = parseInt(from[1]);
    const f2 = to.charCodeAt(0), r2 = parseInt(to[1]);
    const fileDiff = Math.abs(f1 - f2);
    const rankDiff = Math.abs(r1 - r2);
    
    let valid = false;
    switch(piece) {
        case 'P':
            const dir = (board[from] % 2 === 1) ? 1 : -1; // White moves up, black down
            if (isCapture) {
                valid = rankDiff === 1 && fileDiff === 1 && (r2 - r1) === dir;
            } else {
                if (fileDiff === 0) {
                    if ((r2 - r1) === dir) {
                        valid = true;
                    } else if ((r2 - r1) === 2 * dir && (r1 === 2 || r1 === 7)) {
                        const midRank = r1 + dir;
                        const midSq = from[0] + midRank.toString();
                        if (!board[midSq]) valid = true;
                    }
                }
            }
            if (!valid) return false;
            break;
        case 'N':
            valid = (fileDiff === 1 && rankDiff === 2) || (fileDiff === 2 && rankDiff === 1);
            if (!valid) return false;
            break;
        case 'B':
            valid = fileDiff === rankDiff;
            if (!valid) return false;
            if (!isPathClear(from, to, board)) return false;
            break;
        case 'R':
            valid = fileDiff === 0 || rankDiff === 0;
            if (!valid) return false;
            if (!isPathClear(from, to, board)) return false;
            break;
        case 'Q':
            valid = fileDiff === 0 || rankDiff === 0 || fileDiff === rankDiff;
            if (!valid) return false;
            if (!isPathClear(from, to, board)) return false;
            break;
        case 'K':
            valid = fileDiff <= 1 && rankDiff <= 1;
            if (!valid) return false;
            break;
    }
    
    // Occupancy check
    const targetPiece = board[to];
    const isTargetEmpty = !targetPiece;
    const isTargetEnemy = targetPiece && (targetPiece % 2 !== board[from] % 2);
    
    if (isCapture) {
        if (piece === 'P' && isTargetEmpty) {
            // Allow en passant
            return true;
        } else {
            return !!isTargetEnemy;
        }
    } else {
        return isTargetEmpty;
    }
}

// #endregion

// #region Kriegspiel Scoring Logic (based on Ludii implementation)

/**
 * Counts diagonal pawn capture attempts for the current player (CountTries equivalent)
 * This implements the CanPawnCapture logic from Kriegspiel.lud
 */
function countPawnCaptureTries(board: Board, player: number): number {
    let tries = 0;
    const friendPieces = player === 1 ? [1, 3, 5, 7, 9, 11] : [2, 4, 6, 8, 10, 12]; // White or Black pieces
    
    // Find all pawns of the current player
    for (const square in board) {
        const piece = board[square];
        if (!piece) continue;
        
        const isPawn = (piece === 1 || piece === 2);
        const isFriendPawn = isPawn && friendPieces.includes(piece);
        
        if (isFriendPawn) {
            const file = square[0];
            const rank = parseInt(square[1]);
            const direction = piece === 1 ? 1 : -1; // White pawns move up, black down
            
            // Check diagonal captures (left and right)
            const captureRank = rank + direction;
            if (captureRank >= 1 && captureRank <= 8) {
                // Left diagonal
                const leftFile = String.fromCharCode(file.charCodeAt(0) - 1);
                if (leftFile >= 'a') {
                    const leftTarget = leftFile + captureRank;
                    const targetPiece = board[leftTarget];
                    if (targetPiece && !friendPieces.includes(targetPiece)) {
                        tries++;
                    }
                }
                
                // Right diagonal  
                const rightFile = String.fromCharCode(file.charCodeAt(0) + 1);
                if (rightFile <= 'h') {
                    const rightTarget = rightFile + captureRank;
                    const targetPiece = board[rightTarget];
                    if (targetPiece && !friendPieces.includes(targetPiece)) {
                        tries++;
                    }
                }
            }
        }
    }
    
    return tries;
}

/**
 * Counts en passant capture attempts when a pawn does a double-step (CountEnPassantTries equivalent)
 */
function countEnPassantTries(board: Board, player: number, pawnDestination: string): number {
    let tries = 0;
    const enemyPawn = player === 1 ? 2 : 1;
    const file = pawnDestination[0];
    const rank = parseInt(pawnDestination[1]);
    
    // Check adjacent files for enemy pawns that could capture en passant
    const adjacentFiles = [
        String.fromCharCode(file.charCodeAt(0) - 1), // Left
        String.fromCharCode(file.charCodeAt(0) + 1)  // Right
    ];
    
    for (const adjFile of adjacentFiles) {
        if (adjFile >= 'a' && adjFile <= 'h') {
            const adjSquare = adjFile + rank;
            const adjPiece = board[adjSquare];
            if (adjPiece === enemyPawn) {
                tries++;
            }
        }
    }
    
    return tries;
}

// #endregion

// #region TRL Generation
// Semantic predicate for stacking: decide whether to include levelFrom=0/levelTo=0
/**
 * Decide whether to include level attributes for a move based on the board state.
 * For stacking games (as in Ludii), levelTo is required when the destination
 * site is already occupied (i.e. the move places a piece onto an existing stack).
 */
function shouldIncludeLevelTo(board: Board | undefined, toAlg: string): boolean {
    if (!board) return false;
    if (!toAlg) return false;
    return !!board[toAlg];
}

/**
 * Generates the static header for a Kriegspiel TRL file.
 */
function generateTrlHeader(): string[] {
    const lines: string[] = [];
    lines.push('game=/lud/board/war/replacement/checkmate/chess/Kriegspiel (Chess).lud');
    lines.push('START GAME OPTIONS');
    lines.push('END GAME OPTIONS');
    lines.push('RNG internal state=1,2,3,4,5,6,7,8'); // Placeholder

    // Initial piece placement
    const board = createInitialBoard();
    // Emit Add actions in a deterministic order matching repository output
    const addOrderAlg = [] as string[];
    // white pawns a2..h2
    for (const f of ['a','b','c','d','e','f','g','h']) addOrderAlg.push(`${f}2`);
    // black pawns a7..h7
    for (const f of ['a','b','c','d','e','f','g','h']) addOrderAlg.push(`${f}7`);
    // white back rank in repo-specific symmetric order: a1,h1,b1,g1,c1,f1,d1,e1
    addOrderAlg.push('a1','h1','b1','g1','c1','f1','d1','e1');
    // black back rank symmetric order: a8,h8,b8,g8,c8,f8,d8,e8
    addOrderAlg.push('a8','h8','b8','g8','c8','f8','d8','e8');

    for (const square of addOrderAlg) {
        const pieceId = board[square];
        if (!pieceId) continue;
        const coord = algebraicToLudii(square);
        const state = (LUDII_PIECE_TO_PGN[pieceId] === 'R' || LUDII_PIECE_TO_PGN[pieceId] === 'K') ? `,state=1` : '';
        lines.push(`Move=[Move:mover=0,from=${coord},to=${coord},actions=[Add:type=Cell,to=${coord},what=${pieceId}${state}]]`);
    }

    // Set hidden states in repo order: first squares 0..15 (white side) hidden from player 2, then 48..63 hidden from player 1
    // Hide white-side squares (ranks 1 and 2) from player 2
    for (let i = 0; i <= 15; i++) {
        const alg = ludiiToAlgebraic(i);
        const pieceId = board[alg];
        if (pieceId && pieceId % 2 === 1) {
            lines.push(`Move=[Move:mover=0,from=${i},to=${i},actions=[SetHidden:type=Cell,to=${i},level=0,who=2,value=true]]`);
        }
    }
    // Hide black-side squares (ranks 7 and 8) from player 1
    for (let i = 48; i <= 63; i++) {
        const alg = ludiiToAlgebraic(i);
        const pieceId = board[alg];
        if (pieceId && pieceId % 2 === 0) {
            lines.push(`Move=[Move:mover=0,from=${i},to=${i},actions=[SetHidden:type=Cell,to=${i},level=0,who=1,value=true]]`);
        }
    }
    
    return lines;
}

/**
 * Generates a TRL line for an illegal move attempt.
 */
function generateIllegalTrlMove(move: string, player: number, board?: Board): string {
    const [rawFrom, rawTo] = move.split('-');
    // Extract a proper square like 'e4' from tokens that may include piece letters (e.g., 'Ke1')
    const extractSquare = (s: string) => {
        if (!s) return '';
        const m = s.match(/[a-h][1-8]/i);
        return m ? m[0].toLowerCase() : '';
    };
    const fromAlg = extractSquare(rawFrom);
    const toAlg = extractSquare(rawTo);
    const from = algebraicToLudii(fromAlg);
    const to = algebraicToLudii(toAlg);
    // Deterministic rule: apply levelTo for illegal attempts when any of:
    // - reference patterns indicate levelTo for this exact mover|from|to key
    // - the target square is in the inferred high-prop set
    // - the target is in the mover's opponent hidden zone (ranks 7-8 for player1, ranks 1-2 for player2)
    const key = `${player}|${from}|${to}`;
    // Semantic decision: include level attributes when destination is occupied (stacking semantics)
    const wantLevelTo = shouldIncludeLevelTo(board, toAlg);
    const selectStr = wantLevelTo ? `Select:typeFrom=Cell,from=${from},typeTo=Cell,to=${to},levelTo=0,decision=true` : `Select:typeFrom=Cell,from=${from},typeTo=Cell,to=${to},decision=true`;
    // Canonical illegal attempt: provide notes and allow retry (keep player unchanged)
    const parts = [
        selectStr,
        `SetVar:name=NextLost,value=0`,
        `SetVar:name=DrawCondition,value=0`,
        `Note:message=Illegal move,to=1`,
        `Note:message=Illegal move,to=2`,
        `SetNextPlayer:player=${player}`
    ];
    return `Move=[Move:mover=${player},from=${from},to=${to},actions=[${parts.join('],[')}]]`;
}

/**
 * Generates a TRL line for a legal move.
 */
function generatePromotionMove(to: string, promotion: string, player: number): string {
    const toCoord = algebraicToLudii(to);
    if (!promotion) {
        throw new Error('Promotion piece is required');
    }
    const promoPieceId = player === 1 ? PGN_PIECE_TO_LUDII[promotion].white : PGN_PIECE_TO_LUDII[promotion].black;
    const scoringPlayer = player === 1 ? 2 : 1;
    
    // Based on semantic analysis, promotions should NOT include SetScore add=true
    return `Move=[Move:mover=${player},from=${toCoord},to=${toCoord},actions=[Promote:type=Cell,to=${toCoord},what=${promoPieceId},decision=true,SetScore:player=${scoringPlayer},score=0]]`;
}

function generateTrlMove(board: Board, from: string, to: string, promotion: string | null, player: number, umpireNotes: string[], currentEnPassant: number, explicitTries: number | null = null): { line: string, newEnPassant: number } {
    const fromCoord = algebraicToLudii(from);
    const toCoord = algebraicToLudii(to);
    const movingPiece = board[from];
    const pieceLetter = LUDII_PIECE_TO_PGN[movingPiece];
    const fromRank = parseInt(from[1], 10);
    const toRank = parseInt(to[1], 10);
    const pieceOnTarget = board[to];
    const enPassantCapture = (LUDII_PIECE_TO_PGN[board[from]] === 'P' && from[0] !== to[0] && !board[to]);
    const capturedSquare = pieceOnTarget ? to : (enPassantCapture ? (to[0] + from[1]) : null);
    const capturedPieceId = capturedSquare ? (board[capturedSquare] ?? 0) : 0;
    const isCapture = !!capturedPieceId;
    // Build actions to match Ludii canonical ordering
    const actions: string[] = [];

    // Semantic decision: include level attributes when destination is occupied (stacking semantics)
    const wantLevelTo = shouldIncludeLevelTo(board, to);
    const selectStr = wantLevelTo ? `Select:typeFrom=Cell,from=${fromCoord},typeTo=Cell,to=${toCoord},levelTo=0,decision=true` : `Select:typeFrom=Cell,from=${fromCoord},typeTo=Cell,to=${toCoord},decision=true`;

    // Decide whether this move will set a new en-passant target (pawn double-step)
    const willSetNewEnPass = (pieceLetter === 'P' && Math.abs(toRank - fromRank) === 2);

    // 1) For captures, use SetVar:name=CapturedPiece instead of Remove (matches original behavior)
    if (isCapture) {
        actions.push(`SetVar:name=CapturedPiece,value=${capturedPieceId}`);
    }

    // 2) Select first (canonical ordering)
    actions.push(selectStr);

    // 3) SetVar for NextLost and DrawCondition after Select
    actions.push(`SetVar:name=NextLost,value=0`);
    actions.push(`SetVar:name=DrawCondition,value=0`);

    // 4) Reset EnPassant after Select (canonical)
    actions.push(`SetVar:name=EnPassantLocation,value=-1`);

    const moveAction = wantLevelTo ? `Move:typeFrom=Cell,from=${fromCoord},typeTo=Cell,to=${toCoord},levelTo=0,decision=true` : `Move:typeFrom=Cell,from=${fromCoord},typeTo=Cell,to=${toCoord},decision=true`;
    actions.push(moveAction);

    // Handle castling - add intermediate actions and duplications (matches original TRL behavior)
    if (pieceLetter === 'K' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) {
        const rank = from[1];
        const scoringPlayer = 3 - player; // Score for opponent
        
        // Add SetScore for king
        actions.push(`SetScore:player=${scoringPlayer},score=0`);
        
        // Add SetState for king  
        actions.push(`SetState:type=Cell,to=${toCoord},state=0`);
        
        // DUPLICATE king move and SetState (bug/redundancy in original)
        actions.push(moveAction);
        actions.push(`SetState:type=Cell,to=${toCoord},state=0`);
        
        // Add rook move
        if (to[0] === 'g') { // Kingside castling
            const rookFrom = algebraicToLudii('h' + rank);
            const rookTo = algebraicToLudii('f' + rank);
            actions.push(`Move:typeFrom=Cell,from=${rookFrom},typeTo=Cell,to=${rookTo},decision=true`);
            actions.push(`SetScore:player=${scoringPlayer},score=0`);
            actions.push(`SetState:type=Cell,to=${rookTo},state=0`);
        } else if (to[0] === 'c') { // Queenside castling
            const rookFrom = algebraicToLudii('a' + rank);
            const rookTo = algebraicToLudii('d' + rank);
            actions.push(`Move:typeFrom=Cell,from=${rookFrom},typeTo=Cell,to=${rookTo},decision=true`);
            actions.push(`SetScore:player=${scoringPlayer},score=0`);
            actions.push(`SetState:type=Cell,to=${rookTo},state=0`);
        }
    }

    // 5) EnPassant setup for pawn double-step (before SetScore - this is critical for action ordering!)
    if (willSetNewEnPass) {
        const midFile = from[0];
        const midRank = (fromRank + toRank) / 2;
        const enPassAlg = `${midFile}${midRank}`;
        const enPassCoord = algebraicToLudii(enPassAlg);
        actions.push(`SetVar:name=EnPassantLocation,value=${enPassCoord}`);
        actions.push(`SetPending:value=${enPassCoord}`);
    }

    const noteActions: string[] = [];
    for (const note of umpireNotes) {
        if (note.startsWith('X')) { // Capture note
            const capturedSquare = note.substring(1);
            const capturedPieceId = board[capturedSquare];
            const pieceName = LUDII_PIECE_TO_PGN[capturedPieceId] === 'P' ? 'Pawn' : 'Piece';
            noteActions.push(`Note:message=${pieceName} at ${capturedSquare.toUpperCase()} captured,to=1`);
            noteActions.push(`Note:message=${pieceName} at ${capturedSquare.toUpperCase()} captured,to=2`);
        } else if (UMPIRE_NOTE_MAP[note]) { // Check note
            const checkMessages = UMPIRE_NOTE_MAP[note].split(',');
            for (const msg of checkMessages) {
                noteActions.push(`Note:message=${msg},to=1`);
                noteActions.push(`Note:message=${msg},to=2`);
            }
        }
    }

    // 6) SetScore: based on Ludii Kriegspiel logic analysis
    const scoringPlayer = player === 1 ? 2 : 1;
    
    // Ludii Kriegspiel scoring logic:
    // - CountTries: counts diagonal pawn capture attempts after every valid move
    // - CountEnPassantTries: counts en passant attempts during pawn double-step moves
    // - Special case: when en passant expires, count tries BEFORE it resets
    // - Edge case: when both expire AND new en passant is set (pawn double-step while en passant active)
    // These translate to SetScore add=true in TRL files
    
    let needsAddScore = false;
    let scoreValue = 1; // Default scoring increment
    
    // Handle the complex case: en passant expires AND new en passant is set simultaneously
    if (currentEnPassant !== -1 && willSetNewEnPass) {
        // This happens when a pawn does a double-step while there's already an active en passant
        // Count both the expiring en passant AND the new en passant opportunities
        const expiredEnPassSquare = ludiiToAlgebraic(currentEnPassant);
        const expiredTries = countEnPassantTries(board, 3 - player, expiredEnPassSquare);
        
        // For the new en passant, apply the move first to get the correct board state
        const testBoard = JSON.parse(JSON.stringify(board));
        testBoard[to] = testBoard[from];
        delete testBoard[from];
        const newTries = countEnPassantTries(testBoard, player, to);
        
        const totalTries = expiredTries + newTries;
        if (totalTries > 0) {
            needsAddScore = true;
            scoreValue = totalTries;
        }
    }
    // Check if en passant is about to expire (currentEnPassant was set, but new move won't set en passant)
    else if (currentEnPassant !== -1 && !willSetNewEnPass) {
        // En passant just expired - count tries before it resets (critical timing!)
        const enPassSquare = ludiiToAlgebraic(currentEnPassant);
        const expiredEnPassantTries = countEnPassantTries(board, 3 - player, enPassSquare);
        if (expiredEnPassantTries > 0) {
            needsAddScore = true;
            scoreValue = expiredEnPassantTries;
        }
    }
    
    if (!needsAddScore) {
        // Count pawn capture tries after this move (CountTries equivalent)
        // For this we need the board state AFTER the move, so we copy and apply the move
        const testBoard = JSON.parse(JSON.stringify(board));
        // Apply the move to the test board
        testBoard[to] = testBoard[from];
        delete testBoard[from];
        
        const pawnCaptureTries = countPawnCaptureTries(testBoard, player);
        if (pawnCaptureTries > 0) {
            needsAddScore = true;
            scoreValue = pawnCaptureTries;
        }
        
        // Count en passant tries if this is a pawn double-step (CountEnPassantTries equivalent)  
        if (willSetNewEnPass) {
            const enPassantTries = countEnPassantTries(testBoard, player, to);
            if (enPassantTries > 0) {
                needsAddScore = true;
                scoreValue = enPassantTries;
            }
        }
    }
    
    // Always add base score (every move gets this)
    actions.push(`SetScore:player=${scoringPlayer},score=0`);
    
    // Add scoring based on explicit tries from PGN or calculated Ludii logic
    if (explicitTries !== null) {
        // Use explicit tries from PGN P[number]: markers
        for (let i = 0; i < explicitTries; i++) {
            actions.push(`SetScore:player=${scoringPlayer},score=1,add=true`);
        }
    } else if (needsAddScore) {
        // Fallback to calculated tries based on Ludii logic - individual tries, not summed
        for (let i = 0; i < scoreValue; i++) {
            actions.push(`SetScore:player=${scoringPlayer},score=1,add=true`);
        }
    }

    // 7) SetState or SetCounter based on piece type
    // Pawns use SetCounter, other pieces (N,B,R,Q,K) use SetState
    // Skip SetState for castling since it's already handled above
    const isCastling = pieceLetter === 'K' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2;
    if (pieceLetter === 'P') {
        actions.push(`SetCounter:counter=-1`);
    } else if (!isCastling) {
        // Promotion will overwrite piece; still set state on destination
        actions.push(`SetState:type=Cell,to=${toCoord},state=0`);
    }

    // 8) Final EnPassant reset for non-double-step moves
    if (!willSetNewEnPass) {
        actions.push(`SetVar:name=EnPassantLocation,value=-1`);
    }

    // 7) Notes last
    const allActions = actions;
    const allNotes = noteActions.length ? `],[${noteActions.join('],[')}` : '';

    const finalParts = [
        `mover=${player}`,
        `from=${fromCoord}`,
        `to=${toCoord}`,
        `actions=[${allActions.join('],[')}${allNotes}]`
    ];
    // determine new en-passant state: if pawn double-step set enPass, otherwise reset to -1 on capture or default -1
    let newEnPassant = -1;
    if (pieceLetter === 'P' && Math.abs(toRank - fromRank) === 2) {
        const midFile = from[0];
        const midRank = (fromRank + toRank) / 2;
        const enPassAlg = `${midFile}${midRank}`;
        newEnPassant = algebraicToLudii(enPassAlg);
    } else if (isCapture) {
        newEnPassant = -1;
    } else {
        newEnPassant = -1;
    }

    return { line: `Move=[Move:${finalParts.join(',')}]`, newEnPassant };
}

/**
 * Generates the TRL footer based on the game result.
 */
function generateTrlFooter(result: string): string[] {
    let winner = -1;
    if (result === '1-0') winner = 1;
    else if (result === '0-1') winner = 2;
    else if (result === '1/2-1/2') winner = 0;
    
    const base = [] as string[];
    if (winner !== -1) {
        base.push(`numInitialPlacementMoves=64`);
        base.push(`winner=${winner}`);
        base.push(`endtype=NaturalEnd`);
        base.push(`rankings=0.0,2.0,1.0`);
        base.push(`SANDBOX=false`);
        // Always include LUDII version as the final footer line to match repository files
        base.push(`LUDII_VERSION=1.3.13`);
    }
    return base;
}
// #endregion

// #region PGN Parsing
/**
 * Parses the entire PGN content into header and structured moves.
 */
function parsePgn(pgnContent: string) {
    // Split header and moves more robustly: header ends at first blank line
    const parts = pgnContent.split(/\r?\n\r?\n/);
    const headerStr = parts.shift() || '';
    const movesStr = parts.join('\n\n');

    const header: Record<string, string> = {};
    const headerRegex = /\[(\w+)\s+"([^"]+)"\]/g;
    let match: RegExpExecArray | null;
    while ((match = headerRegex.exec(headerStr)) !== null) {
        header[match[1]] = match[2];
    }

    // Tokenize moves: treat comments {...} as single tokens
    const tokens: string[] = [];
    let i = 0;
    while (i < movesStr.length) {
        const ch = movesStr[i];
        if (ch === '{') {
            // read until matching }
            const end = movesStr.indexOf('}', i + 1);
            if (end === -1) break;
            tokens.push(movesStr.slice(i, end + 1).trim());
            i = end + 1;
        } else if (/\s/.test(ch)) {
            i++;
        } else {
            // read until whitespace or brace
            let j = i;
            while (j < movesStr.length && !/\s|\{/.test(movesStr[j])) j++;
            tokens.push(movesStr.slice(i, j));
            i = j;
        }
    }

    const moves: Array<any> = [];
    let idx = 0;
    while (idx < tokens.length) {
        const tok = tokens[idx];
        // Check if this is a game result (1-0, 0-1, 1/2-1/2, *)
        if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) {
            // This is the game result, skip it
            idx++;
            continue;
        }
        
        // Move number like "1." or "1..."
        if (/^\d+\.+$/.test(tok)) {
            // white move
            const num = tok.replace(/\.+$/, '');
            idx++;
            if (idx >= tokens.length) break;
            let whiteMove = tokens[idx];
            
            // Check if the next token is a game result instead of a move
            if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(whiteMove)) {
                // This is the game result, not a move
                break;
            }
            
            let whiteComment: string | null = null;
            if (whiteMove && whiteMove.startsWith('{')) {
                // unexpected, skip
                whiteMove = '';
            }
            idx++;
            // optional comment
            if (idx < tokens.length && tokens[idx] && tokens[idx].startsWith('{')) {
                whiteComment = tokens[idx].slice(1, -1).trim();
                idx++;
            }
            moves.push({ num, whiteMove, whiteComment });

            // black move may follow
            if (idx < tokens.length && !/^\d+\.+$/.test(tokens[idx]) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tokens[idx])) {
                let blackMove = tokens[idx];
                let blackComment: string | null = null;
                idx++;
                if (idx < tokens.length && tokens[idx] && tokens[idx].startsWith('{')) {
                    blackComment = tokens[idx].slice(1, -1).trim();
                    idx++;
                }
                moves.push({ num, whiteMove: null, blackMove, blackComment });
            }
        } else {
            // skip stray tokens
            idx++;
        }
    }

    return { header, moves };
}
// #endregion

// #region Main Conversion Logic
// Removed reference-pattern support: conversion now follows semantic rules only.

function pgnToTrl(pgnContent: string, refPatterns?: { levelToSet: Set<string>, enpassBefore: Set<string>, enpassAfter: Set<string> }): string {
    const { header, moves } = parsePgn(pgnContent);

    if (!header.Variant || !header.Variant.includes('Kriegspiel')) {
        throw new Error('This script only supports Kriegspiel PGNs.');
    }
    
    const trlLines = generateTrlHeader();
    let board = createInitialBoard();
    
    let currentPlayer = 1;
    let currentEnPassant = -1;

    for (const moveData of moves) {
        const san = moveData.whiteMove || moveData.blackMove;
        if (!san) continue;

        const comment = moveData.whiteComment || moveData.blackComment;
        
        // 1. Process illegal move attempts from the comment. If a ':' exists, attempts follow it; otherwise the whole comment may be attempts.
        if (comment) {
            const colonIndexForAttempts = comment.indexOf(':');
            const attemptsPart = colonIndexForAttempts >= 0 ? comment.slice(colonIndexForAttempts + 1).trim() : comment.trim();
            if (attemptsPart) {
                const attemptTokens = attemptsPart.split(',').map((s: string) => s.trim()).filter(Boolean);
                for (const attempt of attemptTokens) {
                    if (attempt.includes('-')) {
                        trlLines.push(generateIllegalTrlMove(attempt, currentPlayer, board));
                    }
                }
            }
        }
        
        // 2. Process the legal move
        const { from, to, promotion } = findMoveSource(board, currentPlayer, san);
        
        // 3. Process umpire notes and try markers from the comment (before the ':' separator)
        const umpireNotes: string[] = [];
        let explicitTries: number | null = null; // P1:, P2:, etc.
        if (comment) {
            const colonIndex = comment.indexOf(':');
            const notesPart = colonIndex >= 0 ? comment.slice(0, colonIndex) : comment;
            const parts = notesPart.split(',').map((s: string) => s.trim()).filter(Boolean);
            
            // Extract P[number]: markers where number = number of tries
            for (const part of parts) {
                // Check if this part contains P[number]: anywhere in it (not just at start)
                const tryMatch = part.match(/P(\d+):/);
                if (tryMatch) {
                    const numberOfTries = parseInt(tryMatch[1]);
                    
                    // P[number]: indicates the number of tries for the current player
                    explicitTries = numberOfTries;
                }
            }
            
            // Remove any parts that are actually illegal-attempt tokens (square-to-square or with piece letter) or P markers
            const filtered = parts.filter((p: string) => 
                !(/[a-h][1-8]-[a-h][1-8]/i.test(p) || 
                  /[KQRNBkq rnb]?[a-h][1-8]-[KQRNBkq rnb]?[a-h][1-8]/i.test(p) ||
                  /^P\d+:.*$/.test(p))
            );
            umpireNotes.push(...filtered);
        }

        // 4. Generate the TRL line for the legal move (without promotion for now)
        const res = generateTrlMove(board, from, to, null, currentPlayer, umpireNotes, currentEnPassant, explicitTries);
        trlLines.push(res.line);

        // 5. Update board state for the next move
        board = applyMove(board, from, to, promotion, currentPlayer);
        // update en-passant state
        currentEnPassant = res.newEnPassant;

        // 6. If this was a promotion, generate a separate promotion move
        if (promotion) {
            const promotionRes = generatePromotionMove(to, promotion, currentPlayer);
            trlLines.push(promotionRes);
        }
        
        // 6. Switch player
        currentPlayer = currentPlayer === 1 ? 2 : 1;
    }
    
    trlLines.push(...generateTrlFooter(header.Result));

    return trlLines.join('\n');
}

// #endregion

// #region Main Execution
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        console.log('Usage: node pgn-to-trl.js -f <input.pgn> | <input.pgn> [--white name] [--black name]');
        return;
    }

    const parsed: { file: string | null; white: string; black: string } = { file: null, white: '', black: '' };
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-f' || a === '--file') {
            parsed.file = args[++i];
        } else if (a === '--white') {
            parsed.white = args[++i];
        } else if (a === '--black') {
            parsed.black = args[++i];
        } else if (!a.startsWith('-') && !parsed.file) {
            // Accept a positional filename as a fallback (e.g. `node pgn-to-trl.js game.pgn`)
            parsed.file = a;
        }
    }

    if (!parsed.file) {
        console.error('Missing input file. Provide with -f/--file or as a positional argument.');
        return;
    }

    const inputFile = parsed.file;
    const outputFile = inputFile.replace(/\.[^/.]+$/, '') + '.trl';

    try {
        console.log(`Converting ${inputFile}...`);
        const pgnContent = fs.readFileSync(inputFile, 'utf-8');
    // Conversion follows semantic rules; no reference TRL guidance is used
    const trlOutput = pgnToTrl(pgnContent);
        fs.writeFileSync(outputFile, trlOutput);
        console.log(`Successfully converted. TRL file saved as ${outputFile}`);
        if (parsed.white) console.log(`White player: ${parsed.white}`);
        if (parsed.black) console.log(`Black player: ${parsed.black}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to process ${inputFile}. Error: ${message}`);
    }
}

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
// #endregion