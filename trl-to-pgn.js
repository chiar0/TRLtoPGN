#!/usr/bin/env node
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Imports
import * as fs from 'fs';
import * as path from 'path';
// yargs is ESM-only in recent versions; we'll import it dynamically in `main` to avoid
// require()/ESM interop problems when compiling to CommonJS.
// #region Global variables and Types
// Global debug flag
let DEBUG = false;
// Global debug log list
let debugLog = [];
// Chess piece mapping
const PIECE_MAP = {
    1: 'P', 2: 'P', // Pawn (white/black)
    9: 'N', 10: 'N', // Knight (white/black)
    7: 'B', 8: 'B', // Bishop (white/black)
    3: 'R', 4: 'R', // Rook (white/black)
    5: 'K', 6: 'K', // King (white/black)
    11: 'Q', 12: 'Q' // Queen (white/black)
};
// #endregion
// #region Utility Functions
/**
 * Adds debug messages to the log if DEBUG is True.
 */
function debugPrint(...args) {
    if (DEBUG) {
        const logEntry = args.map(String).join(' ');
        debugLog.push(logEntry);
    }
}
/**
 * Ensures that the file has the correct extension.
 */
function ensureFileExtension(filePath, extension) {
    // If the basename already contains an extension, assume the user provided one.
    const base = path.basename(filePath);
    if (base.includes('.'))
        return filePath;
    if (!filePath.toLowerCase().endsWith(extension.toLowerCase())) {
        return filePath + extension;
    }
    return filePath;
}
/**
 * Gets the creation date of the file in "YYYY.MM.DD" format.
 */
function getFileCreationDate(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const creationDate = stats.birthtime;
        const year = creationDate.getFullYear();
        const month = String(creationDate.getMonth() + 1).padStart(2, '0');
        const day = String(creationDate.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    }
    catch (e) {
        debugPrint(`Error getting file creation date: ${e}`);
        return "????.??.??";
    }
}
/**
 * Extracts the game result from the Ludii content.
 */
function getGameResult(ludiiContent) {
    const lines = ludiiContent.split('\n').reverse();
    const winnerLine = lines.find(line => line.startsWith('winner='));
    if (winnerLine) {
        const winner = parseInt(winnerLine.split('=')[1], 10);
        if (winner === 0)
            return "1/2-1/2";
        if (winner === 1)
            return "1-0";
        if (winner === 2)
            return "0-1";
    }
    return "*";
}
/**
 * Determines the chess variant from the Ludii content.
 */
function getGameVariant(ludiiContent) {
    return ludiiContent.split('\n')[0].trim();
}
/**
 * Prints the current components (pieces) of a player for debugging.
 */
function printPlayerComponents(board, player) {
    const components = [];
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
function printBoard(board) {
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
function buildPgnHeader(inputFile, variant, result, eventName, whitePlayer, blackPlayer) {
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
function removeNotes(moveStr) {
    return moveStr.replace(/\s*\{[^}]*\}/g, '');
}
/**
 * Builds the move section of the PGN without notes.
 */
function buildPgnMoves(whiteMoves, blackMoves) {
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
function buildPgnMovesWithNotes(whiteMoves, blackMoves) {
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
function ludiiToAlgebraic(coord) {
    const file = String.fromCharCode('a'.charCodeAt(0) + (coord % 8));
    const rank = String(Math.floor(coord / 8) + 1);
    return file + rank;
}
/**
 * Converts algebraic chess notation (e.g., 'e4') to Ludii coordinates (0-63).
 */
function algebraicToLudii(alg) {
    const file = alg.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(alg.substring(1), 10) - 1;
    return rank * 8 + file;
}
// #endregion
// #region Board Management
/**
 * Sets up the initial chess board based on Ludii content.
 */
function setupBoard(ludiiContent) {
    const board = {};
    const setupMoveRegex = /Move=\[Move:mover=0.*?\]/g;
    let match;
    while ((match = setupMoveRegex.exec(ludiiContent)) !== null) {
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
function updateBoard(board, fromSq, toSq, promotion) {
    const newBoard = Object.assign({}, board);
    const piece = newBoard[fromSq];
    if (piece !== undefined) {
        delete newBoard[fromSq];
        newBoard[toSq] = promotion !== null ? promotion : piece;
        // Handle castling
        if ((piece === 5 || piece === 6) && Math.abs(fromSq.charCodeAt(0) - toSq.charCodeAt(0)) === 2) {
            let rookFrom, rookTo;
            if (toSq.charAt(0) === 'g') { // Kingside
                rookFrom = 'h' + fromSq.charAt(1);
                rookTo = 'f' + fromSq.charAt(1);
            }
            else { // Queenside
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
/**
 * Parses a move in Ludii format.
 */
function parseLudiiMove(moveStr) {
    debugPrint(`Debugging parse_ludii_move. Input: ${moveStr}`);
    if (moveStr.includes('Illegal move')) {
        debugPrint("Illegal move detected");
        return null;
    }
    const moverMatch = moveStr.match(/mover=(\d+)/);
    const fromMatch = moveStr.match(/from=(\d+)/);
    const toMatch = moveStr.match(/to=(\d+)/);
    const noteRegex = /\[Note:message=(.*?),to=(\d+)\]/g;
    const notes = [];
    let noteMatch;
    while ((noteMatch = noteRegex.exec(moveStr)) !== null) {
        const [_, message, toPlayer] = noteMatch;
        const key = message;
        const existing = notes.find(([msg]) => msg === key);
        if (existing) {
            existing[1] = existing[1].includes('&') ? existing[1] : `${existing[1]} & player ${toPlayer}`;
        }
        else {
            notes.push([message, `player ${toPlayer}`]);
        }
    }
    // Extract SetScore actions
    const setScoreActions = [];
    const setScoreRegex = /SetScore:player=(\d+),score=(\d+)(?:,add=(true|false))?/g;
    let setScoreMatch;
    while ((setScoreMatch = setScoreRegex.exec(moveStr)) !== null) {
        const [_, playerStr, scoreStr, addStr] = setScoreMatch;
        setScoreActions.push({
            player: parseInt(playerStr, 10),
            score: parseInt(scoreStr, 10),
            add: addStr ? addStr === 'true' : false
        });
    }
    if (moverMatch && fromMatch && toMatch) {
        const player = parseInt(moverMatch[1], 10);
        const fromCoord = parseInt(fromMatch[1], 10);
        const toCoord = parseInt(toMatch[1], 10);
        const fromSq = ludiiToAlgebraic(fromCoord);
        const toSq = ludiiToAlgebraic(toCoord);
        const isCapture = moveStr.includes('Remove:') || moveStr.includes('CapturedPiece');
        let promotion = null;
        if (moveStr.includes('Promote:')) {
            const promotionMatch = moveStr.match(/Promote:.*?what=(\d+)/);
            if (promotionMatch) {
                promotion = parseInt(promotionMatch[1], 10);
            }
        }
        debugPrint(`Move parsed: player=${player}, from=${fromSq}, to=${toSq}, capture=${isCapture}, promotion=${promotion}, notes=${JSON.stringify(notes)}, setScore=${JSON.stringify(setScoreActions)}`);
        return [player, fromSq, toSq, isCapture, promotion, notes, setScoreActions];
    }
    debugPrint("Move parsing failed");
    return null;
}
/**
 * Parses an illegal move for notation in variants like Kriegspiel.
 */
function parseIllegalMove(moveStr, board) {
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
        }
        else if (pieceSymbol) {
            return `${pieceSymbol}${fromSq}-${toSq}`;
        }
    }
    debugPrint(`Failed to parse illegal move: ${moveStr}`);
    return null;
}
/**
 * Calculates potential pawn captures for Kriegspiel umpire messages.
 */
function calculatePawnTries(board, player, fromSq, toSq) {
    // Calculate how many opponent pawns could capture onto `toSq`.
    // This checks normal diagonal pawn captures (not full en-passant history).
    // It returns a count and a list of algebraic attempts (like 'exd5').
    debugPrint(`Calculating pawn tries for player=${player}, from=${fromSq}, to=${toSq}`);
    const opponent = player === 1 ? 2 : 1;
    const toFile = toSq[0];
    const toRank = parseInt(toSq[1], 10);
    const tryMoves = [];
    // Determine the rank offset for opponent pawns: opponent pawns capture from one rank behind
    // If opponent is white (parity 1) they capture from rank (toRank - 1) -> they move upward.
    // If opponent is black (parity 0) they capture from rank (toRank + 1) -> they move downward.
    const opponentIsWhite = (opponent % 2) === 1;
    const fromRank = opponentIsWhite ? toRank - 1 : toRank + 1;
    if (fromRank < 1 || fromRank > 8) {
        debugPrint(`No pawn captures possible: fromRank ${fromRank} out of board`);
        return { tries: 0, tryMoves: [] };
    }
    const files = [];
    const leftFileCode = toFile.charCodeAt(0) - 1;
    const rightFileCode = toFile.charCodeAt(0) + 1;
    if (leftFileCode >= 'a'.charCodeAt(0))
        files.push(String.fromCharCode(leftFileCode));
    if (rightFileCode <= 'h'.charCodeAt(0))
        files.push(String.fromCharCode(rightFileCode));
    const seen = new Set();
    for (const f of files) {
        const candidate = f + String(fromRank);
        const piece = board[candidate];
        if (piece === undefined)
            continue;
        // Check it's an opponent pawn: PIECE_MAP[piece] === 'P' and parity matches opponent
        if ((PIECE_MAP[piece] === 'P') && (piece % 2 === opponent % 2)) {
            // Construct a simple pawn capture notation (file of pawn + 'x' + toSq)
            const moveNotation = `${candidate[0]}x${toSq}`;
            if (!seen.has(moveNotation)) {
                tryMoves.push(moveNotation);
                seen.add(moveNotation);
            }
        }
    }
    // Detect en-passant possibility: if the moved piece was a pawn and moved two ranks,
    // an opponent pawn on the same rank as `toSq` and adjacent file could capture en-passant
    // to the intermediate square.
    const movedPiece = board[toSq];
    if (movedPiece !== undefined && PIECE_MAP[movedPiece] === 'P' && (movedPiece % 2 === player % 2)) {
        const fromRankNum = parseInt(fromSq[1], 10);
        const toRankNum = parseInt(toSq[1], 10);
        if (Math.abs(fromRankNum - toRankNum) === 2) {
            const midRank = (fromRankNum + toRankNum) / 2;
            // opponent pawns that could capture en-passant are on files adjacent to toFile and on rank = toRank
            const adjFiles = [];
            const lf = toFile.charCodeAt(0) - 1;
            const rf = toFile.charCodeAt(0) + 1;
            if (lf >= 'a'.charCodeAt(0))
                adjFiles.push(String.fromCharCode(lf));
            if (rf <= 'h'.charCodeAt(0))
                adjFiles.push(String.fromCharCode(rf));
            for (const af of adjFiles) {
                const candidate = af + String(toRank);
                const piece = board[candidate];
                if (piece === undefined)
                    continue;
                if ((PIECE_MAP[piece] === 'P') && (piece % 2 === opponent % 2)) {
                    // en-passant capture would land on mid square (file = toFile, rank = midRank)
                    const epTarget = `${toFile}${midRank}`;
                    const moveNotation = `${candidate[0]}x${epTarget} e.p.`;
                    if (!seen.has(moveNotation)) {
                        tryMoves.push(moveNotation);
                        seen.add(moveNotation);
                    }
                }
            }
        }
    }
    debugPrint(`Pawn tries found: ${tryMoves.length} -> ${JSON.stringify(tryMoves)}`);
    return { tries: tryMoves.length, tryMoves };
}
/**
 * Generates the core part of the PGN move string, handling ambiguity.
 */
function generateBasicMoveString(board, fromSq, toSq, isCapture, promotion, pieceSymbol) {
    if (pieceSymbol === 'K') {
        if (fromSq === 'e1' && toSq === 'g1')
            return "O-O";
        if (fromSq === 'e1' && toSq === 'c1')
            return "O-O-O";
        if (fromSq === 'e8' && toSq === 'g8')
            return "O-O";
        if (fromSq === 'e8' && toSq === 'c8')
            return "O-O-O";
    }
    let move = "";
    if (pieceSymbol === 'P') {
        if (isCapture) {
            move = `${fromSq[0]}x${toSq}`;
        }
        else {
            move = toSq;
        }
    }
    else {
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
                }
                else if (rankIsUnique) {
                    move += fromRank;
                }
                else {
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
function canMoveTo(fromSq, toSq, piece) {
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
function generatePgnMoveWithAccumulatedTries(board, fromSq, toSq, isCapture, promotion, notes, player, illegalMoves, triesGenerated) {
    const piece = board[fromSq];
    const pieceSymbol = piece ? PIECE_MAP[piece] : '';
    const isPawnCapture = pieceSymbol === 'P' && fromSq[0] !== toSq[0];
    const finalIsCapture = isCapture || isPawnCapture;
    const moveStr = generateBasicMoveString(board, fromSq, toSq, finalIsCapture, promotion, pieceSymbol);
    const newBoard = updateBoard(Object.assign({}, board), fromSq, toSq, promotion);
    const umpireInfo = [];
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
    // Always add comment for Kriegspiel, even if empty
    const pgnMove = `${moveStr} ${comment}`;
    return { pgnMove, newBoard };
}
// #endregion
// #region Main Conversion Logic
/**
 * Converts a standard chess game from Ludii format to PGN.
 */
function convertChess(ludiiContent, inputFile, eventName, whitePlayer, blackPlayer) {
    debugLog = []; // Reset debug log for each game
    let board = setupBoard(ludiiContent);
    const moves = ludiiContent.split('\n').filter(line => line.startsWith('Move='));
    const whiteMoves = [];
    const blackMoves = [];
    for (const move of moves) {
        debugPrint(`\nOriginal: ${move}`);
        const parsed = parseLudiiMove(move);
        if (parsed) {
            const [player, fromSq, toSq, isCapture, promotion, notes, setScoreActions] = parsed;
            if (player === 1 || player === 2) {
                const pieceSymbol = board[fromSq] ? PIECE_MAP[board[fromSq]] : '';
                const pgnMove = generateBasicMoveString(board, fromSq, toSq, isCapture, promotion, pieceSymbol);
                board = updateBoard(board, fromSq, toSq, promotion);
                if (player === 1) {
                    whiteMoves.push(pgnMove);
                }
                else {
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
function convertKriegspiel(ludiiContent, inputFile, eventName, whitePlayer, blackPlayer) {
    debugLog = []; // Reset debug log
    let board = setupBoard(ludiiContent);
    const moves = ludiiContent.split('\n').filter(line => line.startsWith('Move='));
    const whiteMoves = [];
    const blackMoves = [];
    let illegalMoves = [];
    for (let i = 0; i < moves.length; i++) {
        debugPrint(`\nMove ${i + 1}: ${moves[i]}`);
        if (moves[i].includes('Illegal move')) {
            const illegalMove = parseIllegalMove(moves[i], board);
            if (illegalMove)
                illegalMoves.push(illegalMove);
            continue;
        }
        const parsed = parseLudiiMove(moves[i]);
        if (parsed) {
            let [player, fromSq, toSq, isCapture, promotion, notes, setScoreActions] = parsed;
            // Compute tries generated this move for the opponent only (no accumulation across moves)
            const opponent = player === 1 ? 2 : 1;
            let triesGenerated = 0;
            for (const action of setScoreActions) {
                if (action.add && action.player === opponent && action.score > 0) {
                    triesGenerated += action.score;
                }
            }
            if (i + 1 < moves.length && moves[i + 1].includes('Promote:')) {
                const nextParsed = parseLudiiMove(moves[i + 1]);
                if (nextParsed && nextParsed[1] === toSq && nextParsed[2] === toSq) {
                    promotion = nextParsed[4];
                    i++;
                }
            }
            if (player === 1 || player === 2) {
                // Use per-move tries generated for the opponent
                const { pgnMove, newBoard } = generatePgnMoveWithAccumulatedTries(board, fromSq, toSq, isCapture, promotion, notes, player, illegalMoves, triesGenerated);
                if (player === 1)
                    whiteMoves.push(pgnMove);
                else
                    blackMoves.push(pgnMove);
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
function ludiiToPgn(ludiiContent, inputFile, eventName, whitePlayer, blackPlayer) {
    const gameVariant = getGameVariant(ludiiContent);
    if (gameVariant === "game=/lud/board/war/replacement/checkmate/chess/Chess.lud") {
        return convertChess(ludiiContent, inputFile, eventName, whitePlayer, blackPlayer);
    }
    else if (gameVariant === "game=/lud/board/war/replacement/checkmate/chess/Kriegspiel (Chess).lud") {
        return convertKriegspiel(ludiiContent, inputFile, eventName, whitePlayer, blackPlayer);
    }
    else {
        throw new Error(`Unsupported game variant: ${gameVariant}`);
    }
}
// #endregion
// #region Main Execution
/**
 * Processes a list of input files, converting each to PGN.
 */
function processFiles(inputFiles, whitePlayer, blackPlayer) {
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Failed to process ${inputFile}. Error: ${message}`);
        }
    }
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Minimal manual argument parsing to avoid pulling in ESM-only `yargs`.
        const args = process.argv.slice(2);
        const inputFiles = [];
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
            }
            else if (a === '--white' || a === '-w') {
                i++;
                if (i < args.length)
                    whitePlayer = args[i];
            }
            else if (a === '--black' || a === '-b') {
                i++;
                if (i < args.length)
                    blackPlayer = args[i];
            }
            else if (a === '--debug') {
                DEBUG = true;
            }
            else if (a === '-h' || a === '--help') {
                console.log('Usage: converter.ts -f <file.trl> [--white NAME] [--black NAME] [--debug]');
                process.exit(0);
            }
        }
        if (inputFiles.length === 0) {
            console.error('No input files provided. Use -f <file.trl>');
            process.exit(1);
        }
        processFiles(inputFiles, whitePlayer, blackPlayer);
    });
}
// Entry point
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('trl-to-pgn.js')) {
    main().catch(console.error);
}
// #endregion
