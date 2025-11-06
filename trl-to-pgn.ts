#!/usr/bin/env node

// Imports
import * as fs from 'fs';
import * as path from 'path';

// #region Global variables and Types
// Global debug flag
let DEBUG = false;
// Global debug log list
let debugLog: string[] = [];

// Type definition for the chess board
type Board = Record<string, number>;

// Type for SetScore actions
interface SetScoreAction {
    player: number;
    score: number;
    add: boolean;
}

// Type for a successfully parsed Ludii move
type ParsedMove = [
    player: number,
    fromSq: string,
    toSq: string,
    isCapture: boolean,
    promotion: number | null,
    notes: [string, string][],
    setScoreActions: SetScoreAction[]
];

// Chess piece mapping
const PIECE_MAP: Record<number, string> = {
    1: 'P', 2: 'P',  // Pawn (white/black)
    9: 'N', 10: 'N',  // Knight (white/black)
    7: 'B', 8: 'B',  // Bishop (white/black)
    3: 'R', 4: 'R',  // Rook (white/black)
    5: 'K', 6: 'K',  // King (white/black)
    11: 'Q', 12: 'Q'  // Queen (white/black)
};
// #endregion

// #region Utility Functions
/**
 * Adds debug messages to the log if DEBUG is True.
 */
function debugPrint(...args: any[]): void {
    if (DEBUG) {
        const logEntry = args.map(String).join(' ');
        debugLog.push(logEntry);
    }
}

/**
 * Ensures that the file has the correct extension.
 */
function ensureFileExtension(filePath: string, extension: string): string {
    // If the basename already contains an extension, assume the user provided one.
    const base = path.basename(filePath);
    if (base.includes('.')) return filePath;

    if (!filePath.toLowerCase().endsWith(extension.toLowerCase())) {
        return filePath + extension;
    }
    return filePath;
}

/**
 * Gets the creation date of the file in "YYYY.MM.DD" format.
 */
function getFileCreationDate(filePath: string): string {
    try {
        const stats = fs.statSync(filePath);
        const creationDate = stats.birthtime;
        const year = creationDate.getFullYear();
        const month = String(creationDate.getMonth() + 1).padStart(2, '0');
        const day = String(creationDate.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    } catch (e) {
        debugPrint(`Error getting file creation date: ${e}`);
        return "????.??.??";
    }
}

/**
 * Extracts the game result from the Ludii content.
 */
function getGameResult(ludiiContent: string): string {
    const lines = ludiiContent.split('\n').reverse();
    const winnerLine = lines.find(line => line.startsWith('winner='));
    if (winnerLine) {
        const winner = parseInt(winnerLine.split('=')[1], 10);
        if (winner === 0) return "1/2-1/2";
        if (winner === 1) return "1-0";
        if (winner === 2) return "0-1";
    }
    return "*";
}

/**
 * Determines the chess variant from the Ludii content.
 */
function getGameVariant(ludiiContent: string): string {
    const firstLine = ludiiContent.split('\n')[0].trim();
    
    // Check if it contains 'kriegspiel' (case-insensitive)
    if (firstLine.toLowerCase().includes('kriegspiel')) {
        return 'game=/lud/board/war/replacement/checkmate/chess/Kriegspiel (Chess).lud';
    }
    
    // If it matches the standard Chess variant exactly
    if (firstLine === 'game=/lud/board/war/replacement/checkmate/chess/Chess.lud') {
        return firstLine;
    }
    
    // Otherwise it's unsupported
    throw new Error(`Unsupported game variant: ${firstLine}`);
}

/**
 * Prints the current components (pieces) of a player for debugging.
 */
function printPlayerComponents(board: Board, player: number): void {
    const components: string[] = [];
    for (const square in board) {
        const piece = board[square];
        if (piece % 2 === player % 2) {
            const pieceSymbol = PIECE_MAP[piece] || '?';
            components.push(`${square}:${pieceSymbol}`);
        }
    }
    const playerName = player === 1 ? "White" : "Black";
    debugPrint(`${playerName} components before move: ${components.sort().join(', ')}`);
}

/**
 * Creates a visual ASCII representation of the chess board for debugging.
 */
function printBoard(board: Board): string {
    let boardStr = "";
    for (let rank = 8; rank >= 1; rank--) {
        for (const file of 'abcdefgh') {
            const square = file + rank;
            const piece = board[square];
            boardStr += (piece ? PIECE_MAP[piece] : '.') + ' ';
        }
        boardStr += '\n';
    }
    return boardStr;
}

// #endregion

// #region PGN Building Functions

/**
 * Builds the PGN header for the chess game.
 */
function buildPgnHeader(inputFile: string, variant: string, result: string, eventName: string, whitePlayer: string, blackPlayer: string): string {
    const headerLines = [
        `[Event "${eventName}"]`,
        `[Site "Ludii"]`,
        `[Date "${getFileCreationDate(inputFile)}"]`,
        // Round is ignored as requested
        `[White "${whitePlayer}"]`,
        `[Black "${blackPlayer}"]`,
        `[Variant "${variant}"]`,
        `[Result "${result}"]`,
        '' // Extra newline for separation
    ];
    return headerLines.join('\n') + '\n';
}

/**
 * Removes commentary notes from a move string.
 */
function removeNotes(moveStr: string): string {
    return moveStr.replace(/\s*\{[^}]*\}/g, '');
}

/**
 * Builds the move section of the PGN without notes.
 */
function buildPgnMoves(whiteMoves: string[], blackMoves: string[]): string {
    let pgn = "";
    const numMoves = Math.max(whiteMoves.length, blackMoves.length);
    for (let i = 0; i < numMoves; i++) {
        pgn += `${i + 1}. `;
        if (i < whiteMoves.length) {
            pgn += `${removeNotes(whiteMoves[i])} `;
        }
        if (i < blackMoves.length) {
            pgn += `${removeNotes(blackMoves[i])} `;
        }
        pgn += "\n";
    }
    return pgn;
}

/**
 * Builds the move section of the PGN including notes (for variants like Kriegspiel).
 */
function buildPgnMovesWithNotes(whiteMoves: string[], blackMoves: string[]): string {
    let pgn = "";
    const numMoves = Math.max(whiteMoves.length, blackMoves.length);
    for (let i = 0; i < numMoves; i++) {
        pgn += `${i + 1}. `;
        if (i < whiteMoves.length) {
            pgn += `${whiteMoves[i]} `;
        }
        if (i < blackMoves.length) {
            pgn += `${blackMoves[i]} `;
        }
        pgn += "\n";
    }
    return pgn;
}
// #endregion

// #region Coordinate Conversion
/**
 * Converts Ludii coordinates (0-63) to algebraic chess notation (e.g., 'e4').
 */
function ludiiToAlgebraic(coord: number): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + (coord % 8));
    const rank = String(Math.floor(coord / 8) + 1);
    return file + rank;
}

/**
 * Converts algebraic chess notation (e.g., 'e4') to Ludii coordinates (0-63).
 */
function algebraicToLudii(alg: string): number {
    const file = alg.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(alg.substring(1), 10) - 1;
    return rank * 8 + file;
}
// #endregion

// #region Board Management
/**
 * Sets up the initial chess board based on Ludii content.
 */
function setupBoard(ludiiContent: string): Board {
    const board: Board = {};
    const setupMoveRegex = /Move=\[Move:mover=0.*?\]/g;
    const matches = ludiiContent.matchAll(setupMoveRegex);

    for (const match of matches) {
        const moveStr = match[0];
        const toMatch = moveStr.match(/to=(\d+)/);
        const whatMatch = moveStr.match(/what=(\d+)/);
        if (toMatch && whatMatch) {
            const square = parseInt(toMatch[1], 10);
            const piece = parseInt(whatMatch[1], 10);
            board[ludiiToAlgebraic(square)] = piece;
        }
    }
    return board;
}

/**
 * Updates the chess board after a move.
 */
function updateBoard(board: Board, fromSq: string, toSq: string, promotion: number | null): Board {
    const newBoard = { ...board };
    const piece = newBoard[fromSq];
    if (piece !== undefined) {
        delete newBoard[fromSq];
        newBoard[toSq] = promotion !== null ? promotion : piece;

        // Handle castling
        if ((piece === 5 || piece === 6) && Math.abs(fromSq.charCodeAt(0) - toSq.charCodeAt(0)) === 2) {
            let rookFrom: string, rookTo: string;
            if (toSq.charAt(0) === 'g') { // Kingside
                rookFrom = 'h' + fromSq.charAt(1);
                rookTo = 'f' + fromSq.charAt(1);
            } else { // Queenside
                rookFrom = 'a' + fromSq.charAt(1);
                rookTo = 'd' + fromSq.charAt(1);
            }
            const rook = newBoard[rookFrom];
            if (rook !== undefined) {
                delete newBoard[rookFrom];
                newBoard[rookTo] = rook;
            }
        }
    }
    return newBoard;
}
// #endregion

// #region Move Analysis and Generation
/**
 * Parses a move in Ludii format.
 */
function parseLudiiMove(moveStr: string): ParsedMove | null {
    debugPrint(`Debugging parse_ludii_move. Input: ${moveStr}`);
    if (moveStr.includes('Illegal move')) {
        debugPrint("Illegal move detected");
        return null;
    }

    const moverMatch = moveStr.match(/mover=(\d+)/);
    const fromMatch = moveStr.match(/from=(\d+)/);
    const toMatch = moveStr.match(/to=(\d+)/);

    const noteRegex = /\[Note:message=(.*?),to=(\d+)\]/g;
    const notes = [...moveStr.matchAll(noteRegex)];
    const groupedNotes = new Map<string, Set<string>>();
    for (const note of notes) {
        const [_, message, toPlayer] = note;
        if (!groupedNotes.has(message)) {
            groupedNotes.set(message, new Set());
        }
        groupedNotes.get(message)!.add(toPlayer);
    }
    const combinedNotes: [string, string][] = [];
    groupedNotes.forEach((players, message) => {
        if (players.size > 1) {
            combinedNotes.push([message, 'player 1 & player 2']);
        } else {
            combinedNotes.push([message, `player ${players.values().next().value}`]);
        }
    });

    // Parse SetScore actions (allow optional add=, default to false)
    const setScoreRegex = /SetScore:player=(\d+),score=(\d+)(?:,add=(true|false))?/g;
    const setScoreMatches = [...moveStr.matchAll(setScoreRegex)];
    const setScoreActions: SetScoreAction[] = setScoreMatches.map(match => ({
        player: parseInt(match[1], 10),
        score: parseInt(match[2], 10),
        add: match[3] ? match[3] === 'true' : false
    }));

    if (moverMatch && fromMatch && toMatch) {
        const player = parseInt(moverMatch[1], 10);
        const fromCoord = parseInt(fromMatch[1], 10);
        const toCoord = parseInt(toMatch[1], 10);

        const fromSq = ludiiToAlgebraic(fromCoord);
        const toSq = ludiiToAlgebraic(toCoord);
        const isCapture = moveStr.includes('Remove:') || moveStr.includes('CapturedPiece');
        
        let promotion: number | null = null;
        if (moveStr.includes('Promote:')) {
            const promotionMatch = moveStr.match(/Promote:.*?what=(\d+)/);
            if (promotionMatch) {
                promotion = parseInt(promotionMatch[1], 10);
            }
        }

        debugPrint(`Move parsed: player=${player}, from=${fromSq}, to=${toSq}, capture=${isCapture}, promotion=${promotion}, notes=${JSON.stringify(combinedNotes)}, setScoreActions=${JSON.stringify(setScoreActions)}`);
        return [player, fromSq, toSq, isCapture, promotion, combinedNotes, setScoreActions];
    }
    
    debugPrint("Move parsing failed");
    return null;
}

/**
 * Parses an illegal move for notation in variants like Kriegspiel.
 */
function parseIllegalMove(moveStr: string, board: Board): string | null {
    debugPrint(`Parsing illegal move: ${moveStr}`);
    const fromMatch = moveStr.match(/from=(\d+)/);
    const toMatch = moveStr.match(/to=(\d+)/);
    
    if (fromMatch && toMatch) {
        const fromSq = ludiiToAlgebraic(parseInt(fromMatch[1], 10));
        const toSq = ludiiToAlgebraic(parseInt(toMatch[1], 10));
        const piece = board[fromSq];
        const pieceSymbol = piece ? PIECE_MAP[piece] : '';
        
        if (pieceSymbol === 'P') {
            return `${fromSq}-${toSq}`;
        } else if (pieceSymbol) {
            return `${pieceSymbol}${fromSq}-${toSq}`;
        }
    }
    
    debugPrint(`Failed to parse illegal move: ${moveStr}`);
    return null;
}


/*
COMMENTED-OUT: Pawn try generator symmetric to Ludii's CountTries.
Kept for reference only; do not use for computing P in PGN.
P is derived strictly from TRL SetScore actions (add=true) on the same move.

function calculatePawnTries(board: Board, player: number, fromSq: string, toSq: string): { tries: number; tryMoves: string[] } {
    return { tries: 0, tryMoves: [] };
}
*/

/**
 * Counts all pawn capture moves available for a player on the given board, optionally including en passant to a target square.
 * Returns the total number of distinct pawn capture moves (each diagonal counts separately), not just the number of pawns.
 */
/*
COMMENTED-OUT helper: count pawn capture moves for a player (reference only).
function countPawnCaptureMoves(board: Board, playerToMove: number, enPassantTarget: string | null): number {
    return 0;
}
*/

/**
 * Generates the core part of the PGN move string, handling ambiguity.
 */
function generateBasicMoveString(board: Board, fromSq: string, toSq: string, isCapture: boolean, promotion: number | null, pieceSymbol: string): string {
    if (pieceSymbol === 'K') {
        if (fromSq === 'e1' && toSq === 'g1') return "O-O";
        if (fromSq === 'e1' && toSq === 'c1') return "O-O-O";
        if (fromSq === 'e8' && toSq === 'g8') return "O-O";
        if (fromSq === 'e8' && toSq === 'c8') return "O-O-O";
    }

    let move = "";
    if (pieceSymbol === 'P') {
        if (isCapture) {
            move = `${fromSq[0]}x${toSq}`;
        } else {
            move = toSq;
        }
    } else {
        move = pieceSymbol;
        const movingPiece = board[fromSq];
        if (movingPiece !== undefined) {
             const ambiguousPieces = Object.entries(board)
                .filter(([sq, p]) => p === movingPiece && sq !== fromSq && canMoveTo(sq, toSq, p))
                .map(([sq, _]) => sq);

            if (ambiguousPieces.length > 0) {
                const fromFile = fromSq[0];
                const fromRank = fromSq[1];
                const fileIsUnique = ambiguousPieces.every(sq => sq[0] !== fromFile);
                const rankIsUnique = ambiguousPieces.every(sq => sq[1] !== fromRank);

                if (fileIsUnique) {
                    move += fromFile;
                } else if (rankIsUnique) {
                    move += fromRank;
                } else {
                    move += fromSq;
                }
            }
        }
        
        if (isCapture) {
            move += "x";
        }
        move += toSq;
    }

    if (promotion !== null) {
        move += `=${PIECE_MAP[promotion] || 'Q'}`;
    }

    return move;
}


/**
 * Helper to check if a piece can theoretically move to a square (for ambiguity checks).
 */
function canMoveTo(fromSq: string, toSq: string, piece: number): boolean {
    const pieceSymbol = PIECE_MAP[piece] || '';
    const fileDiff = Math.abs(fromSq.charCodeAt(0) - toSq.charCodeAt(0));
    const rankDiff = Math.abs(parseInt(fromSq[1], 10) - parseInt(toSq[1], 10));

    switch (pieceSymbol) {
        case 'R': return fileDiff === 0 || rankDiff === 0;
        case 'N': return (fileDiff === 1 && rankDiff === 2) || (fileDiff === 2 && rankDiff === 1);
        case 'B': return fileDiff === rankDiff;
        case 'Q': return fileDiff === 0 || rankDiff === 0 || fileDiff === rankDiff;
        case 'K': return fileDiff <= 1 && rankDiff <= 1;
        case 'P': return fileDiff === 1 && rankDiff === 1;
        default: return true;
    }
}


/**
 * Generates a full move in PGN format, including umpire notes for Kriegspiel.
 */
function generatePgnMove(
    board: Board, fromSq: string, toSq: string, isCapture: boolean, 
    promotion: number | null, notes: [string, string][], player: number, 
    illegalMoves: string[], setScoreActions: SetScoreAction[]
): { pgnMove: string; newBoard: Board } {
    const piece = board[fromSq];
    const pieceSymbol = piece ? PIECE_MAP[piece] : '';
    
    const isPawnCapture = pieceSymbol === 'P' && fromSq[0] !== toSq[0];
    const finalIsCapture = isCapture || isPawnCapture;

    const moveStr = generateBasicMoveString(board, fromSq, toSq, finalIsCapture, promotion, pieceSymbol);

    const newBoard = updateBoard({ ...board }, fromSq, toSq, promotion);

    const umpireInfo: string[] = [];
    
    // Process SetScore actions to generate try information
    // P<n> means: this move generated n tries for the opponent.
    const opponent = player === 1 ? 2 : 1;
    let triesGenerated = 0;
    for (const action of setScoreActions) {
        if (action.add && action.score > 0 && action.player === opponent) {
            triesGenerated += action.score;
        }
    }
    // Order to match reference: capture first, then P<n>, then checks
    if (finalIsCapture) {
        umpireInfo.push(`X${toSq.toLowerCase()}`);
    }
    if (triesGenerated > 0) {
        umpireInfo.push(`P${triesGenerated}`);
    }

    const isCheck = notes.some(([note]) => note.toLowerCase().includes("check"));
    if (isCheck) {
        const checkTypes = notes
            .filter(([note]) => note.toLowerCase().includes("check"))
            .map(([note]) => note.split(' ')[0].toLowerCase());
        const checkStr = "C" + checkTypes.map(type => type[0].toUpperCase()).join('');
        umpireInfo.push(checkStr);
    }

    let comment = "{";
    if (umpireInfo.length > 0) {
        comment += umpireInfo.join(',');
    }
    if (illegalMoves.length > 0) {
        // Always prefix illegal attempts with a leading colon, even if no umpireInfo
        comment += ":" + illegalMoves.join(',');
    } else if (triesGenerated > 0 || isCheck) {
        // Add trailing colon when only P or C (check) is present
        comment += ":";
    }
    comment += "}";

    // Always add comment braces for Kriegspiel
    const pgnMove = `${moveStr} ${comment}`;
    
    return { pgnMove, newBoard };
}

// #endregion

// #region Main Conversion Logic
/**
 * Converts a standard chess game from Ludii format to PGN.
 */
function convertChess(ludiiContent: string, inputFile: string, eventName: string, whitePlayer: string, blackPlayer: string): string {
    debugLog = []; // Reset debug log for each game
    let board = setupBoard(ludiiContent);
    
    const moves = ludiiContent.split('\n').filter(line => line.startsWith('Move='));
    const whiteMoves: string[] = [];
    const blackMoves: string[] = [];
    
    for (const move of moves) {
        debugPrint(`\nOriginal: ${move}`);
        const parsed = parseLudiiMove(move);
        if (parsed) {
            const [player, fromSq, toSq, isCapture, promotion, notes] = parsed;
            if (player === 1 || player === 2) {
                const pieceSymbol = board[fromSq] ? PIECE_MAP[board[fromSq]] : '';
                const pgnMove = generateBasicMoveString(board, fromSq, toSq, isCapture, promotion, pieceSymbol);
                board = updateBoard(board, fromSq, toSq, promotion);
                
                if (player === 1) {
                    whiteMoves.push(pgnMove);
                } else {
                    blackMoves.push(pgnMove);
                }
                debugPrint(`Converted: ${pgnMove}`);
            }
        }
    }

    const result = getGameResult(ludiiContent);
    let pgn = buildPgnHeader(inputFile, "Chess", result, eventName, whitePlayer, blackPlayer);
    pgn += buildPgnMoves(whiteMoves, blackMoves);
    pgn += result;

    if (DEBUG) {
        pgn += "\n\n{Debug Log:\n" + debugLog.join('\n') + "\n}";
    }
    return pgn;
}

/**
 * Converts a Kriegspiel chess game from Ludii format to PGN.
 */
function convertKriegspiel(ludiiContent: string, inputFile: string, eventName: string, whitePlayer: string, blackPlayer: string): string {
    debugLog = []; // Reset debug log
    let board = setupBoard(ludiiContent);
    
    const moves = ludiiContent.split('\n').filter(line => line.startsWith('Move='));
    const whiteMoves: string[] = [];
    const blackMoves: string[] = [];
    let illegalMoves: string[] = [];
    // Fresh-only policy: do not carry P across moves; only show tries generated on the current move

    for (let i = 0; i < moves.length; i++) {
        debugPrint(`\nMove ${i + 1}: ${moves[i]}`);

        if (moves[i].includes('Illegal move')) {
            const illegalMove = parseIllegalMove(moves[i], board);
            if (illegalMove) illegalMoves.push(illegalMove);
            continue;
        }

        const parsed = parseLudiiMove(moves[i]);
        if (parsed) {
            let [player, fromSq, toSq, isCapture, promotion, notes, setScoreActions] = parsed;

            if (i + 1 < moves.length && moves[i+1].includes('Promote:')) {
                const nextParsed = parseLudiiMove(moves[i+1]);
                if (nextParsed && nextParsed[1] === toSq && nextParsed[2] === toSq) {
                    promotion = nextParsed[4];
                    i++; 
                }
            }

            if (player === 1 || player === 2) {
                const opponent = player === 1 ? 2 : 1;

                // Sum of fresh tries this move (for opponent)
                const addSum = setScoreActions
                    .filter(a => a.player === opponent && a.add && a.score > 0)
                    .reduce((s, a) => s + a.score, 0);

                let triesToDisplay: number | null = null;
                debugPrint(
                    `P-debug before: ply=${i + 1}, mover=${player}, opponent=${opponent}, addSum=${addSum}`
                );
                if (addSum > 0) {
                    // Fresh P generated now for the opponent; fresh-only policy (no carry-over)
                    triesToDisplay = addSum;
                    debugPrint(`P-debug update: fresh P this move = ${addSum}`);
                } else {
                    debugPrint('P-debug fresh-only: no P displayed for this move');
                }

                // Build effective SetScore list solely for display purposes (P rendering)
                const effectiveSetScores: SetScoreAction[] = [];
                if (triesToDisplay !== null) {
                    effectiveSetScores.push({ player: opponent, score: triesToDisplay, add: true });
                }

                const { pgnMove, newBoard } = generatePgnMove(board, fromSq, toSq, isCapture, promotion, notes, player, illegalMoves, effectiveSetScores);
                debugPrint(`P-debug render: effectiveSetScores=${JSON.stringify(effectiveSetScores)}`);
                if (player === 1) whiteMoves.push(pgnMove);
                else blackMoves.push(pgnMove);
                illegalMoves = [];
                board = newBoard;
            }
        }
    }

    const result = getGameResult(ludiiContent);
    let pgn = buildPgnHeader(inputFile, "Kriegspiel (chess)", result, eventName, whitePlayer, blackPlayer);
    pgn += buildPgnMovesWithNotes(whiteMoves, blackMoves);
    pgn += result;

    if (DEBUG) {
        pgn += "\n\n{Debug Log:\n" + debugLog.join('\n') + "\n}";
    }
    return pgn;
}

/**
 * Main dispatcher to select the correct conversion function based on variant.
 */
export function ludiiToPgn(ludiiContent: string, inputFile: string, eventName: string, whitePlayer: string, blackPlayer: string): string {
    const gameVariant = getGameVariant(ludiiContent);

    if (gameVariant === "game=/lud/board/war/replacement/checkmate/chess/Chess.lud") {
        return convertChess(ludiiContent, inputFile, eventName, whitePlayer, blackPlayer);
    } else if (gameVariant.toLowerCase().includes('kriegspiel')) {
        return convertKriegspiel(ludiiContent, inputFile, eventName, whitePlayer, blackPlayer);
    } else {
        throw new Error(`Unsupported game variant: ${gameVariant}`);
    }
}
// #endregion

// #region Main Execution
/**
 * Processes a list of input files, converting each to PGN.
 */
function processFiles(inputFiles: string[], whitePlayer: string, blackPlayer: string) {
    console.log(`Processing ${inputFiles.length} file(s)...`);

    for (const inputFile of inputFiles) {
        try {
            console.log(`\nConverting ${inputFile}...`);
            const ludiiContent = fs.readFileSync(inputFile, 'utf-8');
            
            const eventName = path.basename(inputFile, path.extname(inputFile));
            const outputDir = path.dirname(inputFile);
            const outputFileName = `${eventName}.pgn`;
            const outputFile = path.join(outputDir, outputFileName);
            
            const pgnOutput = ludiiToPgn(ludiiContent, inputFile, eventName, whitePlayer, blackPlayer);
            
            fs.writeFileSync(outputFile, pgnOutput);
            console.log(`Successfully converted. PGN file saved as ${outputFile}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Failed to process ${inputFile}. Error: ${message}`);
        }
    }
}

async function main() {
    // Minimal manual argument parsing to avoid pulling in ESM-only `yargs`.
    const args = process.argv.slice(2);
    const inputFiles: string[] = [];
    let whitePlayer = 'Player 1';
    let blackPlayer = 'Player 2';
    DEBUG = false;

    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-f' || a === '--files') {
            i++;
            if (i < args.length) {
                inputFiles.push(ensureFileExtension(args[i], '.trl'));
            }
        } else if (a === '--white' || a === '-w') {
            i++; if (i < args.length) whitePlayer = args[i];
        } else if (a === '--black' || a === '-b') {
            i++; if (i < args.length) blackPlayer = args[i];
        } else if (a === '--debug') {
            DEBUG = true;
        } else if (a === '-h' || a === '--help') {
            console.log('Usage: converter.ts -f <file.trl> [--white NAME] [--black NAME] [--debug]');
            process.exit(0);
        }
    }

    if (inputFiles.length === 0) {
        console.error('No input files provided. Use -f <file.trl>');
        process.exit(1);
    }

    processFiles(inputFiles, whitePlayer, blackPlayer);
}

// Entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
    main().catch(console.error);
}
// #endregion