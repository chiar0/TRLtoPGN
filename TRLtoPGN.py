# Imports and global variables
import os
import re
import argparse
from datetime import datetime
import tkinter as tk
from tkinter import filedialog, simpledialog

# Global debug flag
DEBUG = False
# Global debug log list
debug_log = []

# Chess piece mapping
# Key: numeric piece code (odd for white, even for black)
# Value: piece symbol in algebraic notation
PIECE_MAP = {
    1: 'P', 2: 'P',  # Pawn (white/black)
    9: 'N', 10: 'N',  # Knight (white/black)
    7: 'B', 8: 'B',  # Bishop (white/black)
    3: 'R', 4: 'R',  # Rook (white/black)
    5: 'K', 6: 'K',  # King (white/black)
    11: 'Q', 12: 'Q'  # Queen (white/black)
}

# Utility functions

def debug_print(*args, **kwargs):
    """
    Adds debug messages to the log if DEBUG is True.
    
    Args:
        *args: Variable arguments to print.
        **kwargs: Optional keyword arguments.
    
    This function converts all arguments to strings, joins them,
    and adds them to the debug_log list if DEBUG is True.
    """
    if DEBUG:
        log_entry = ' '.join(map(str, args))
        debug_log.append(log_entry)

def ensure_file_extension(file_path, extension):
    """
    Ensures that the file has the correct extension.
    
    Args:
        file_path (str): The file path.
        extension (str): The desired extension (e.g., '.txt').
    
    Returns:
        str: The file path with the correct extension.
    
    If the file doesn't already have the specified extension, it is added.
    The extension comparison is case-insensitive.
    """
    if not file_path.lower().endswith(extension.lower()):
        return file_path + extension
    return file_path

def get_file_creation_date(file_path):
    """
    Gets the creation date of the file.
    
    Args:
        file_path (str): The file path.
    
    Returns:
        str: The creation date in "YYYY.MM.DD" format.
             Returns "????.??.??" in case of an error.
    
    Uses os.path.getctime() to get the creation timestamp,
    converts it to a datetime object, and formats it as a string.
    Handles exceptions and logs errors to the debug log.
    """
    try:
        creation_time = os.path.getctime(file_path)
        creation_date = datetime.fromtimestamp(creation_time)
        return creation_date.strftime("%Y.%m.%d")
    except Exception as e:
        debug_print(f"Error getting file creation date: {e}")
        return "????.??.??"
    

def get_input_file():
    """
    Prompts the user to provide the input .trl file path.
    
    Returns:
        str: Path to the input .trl file.
    
    This function first checks for command-line arguments, then tries to
    use a file dialog if available, and finally falls back to manual input.
    It ensures that the file exists and has the correct extension.
    """
    parser = argparse.ArgumentParser(description="Convert Ludii trial files to PGN.")
    parser.add_argument("-f", "--file", help="Path to the input .trl file")
    args = parser.parse_args()

    if args.file:
        return ensure_file_extension(args.file, '.trl')
    
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        file_path = filedialog.askopenfilename(filetypes=[("Ludii Trial files", "*.trl")])
        if file_path:
            return file_path
    except:
        pass
    
    while True:
        file_path = input("Please enter the path to the .trl file: ")
        file_path_with_extension = ensure_file_extension(file_path, '.trl')
        if os.path.exists(file_path_with_extension):
            return file_path_with_extension
        else:
            print("Invalid file path. Please try again.")

def get_output_file(input_file):
    """
    Determines the output file path for the PGN file.
    
    Args:
        input_file (str): Path to the input .trl file.
    
    Returns:
        str: Path where the output PGN file will be saved.
    
    This function checks for command-line arguments, tries to use a file
    dialog if available, and falls back to manual input or a default name
    based on the input file.
    """
    parser = argparse.ArgumentParser(description="Convert Ludii trial files to PGN.")
    parser.add_argument("-f", "--file", help="Path to the input .trl file")
    parser.add_argument("-o", "--output", help="Path to the output .pgn file")
    args = parser.parse_args()

    if args.output:
        return ensure_file_extension(args.output, '.pgn')
    
    default_output = os.path.splitext(input_file)[0] + ".pgn"
    
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        file_path = filedialog.asksaveasfilename(
            defaultextension=".pgn",
            filetypes=[("PGN files", "*.pgn")],
            initialfile=os.path.basename(default_output),
            initialdir=os.path.dirname(default_output)
        )
        if file_path:
            return file_path
    except:
        pass
    
    while True:
        file_path = input(f"Please enter the path for the output .pgn file (press Enter to use default: {default_output}): ")
        if not file_path:
            return default_output
        file_path_with_extension = ensure_file_extension(file_path, '.pgn')
        return file_path_with_extension

def get_event_name(input_file):
    """
    Prompts the user to provide an event name for the chess game.
    
    Args:
        input_file (str): Path to the input .trl file.
    
    Returns:
        str: The event name for the chess game.
    
    This function checks for a command-line argument, tries to use a
    dialog box if available, and falls back to manual input. It uses
    the input file name as a default event name.
    """
    parser = argparse.ArgumentParser(description="Convert Ludii trial files to PGN.")
    parser.add_argument("-e", "--event", help="Name of the event")
    args = parser.parse_args()

    if args.event:
        return args.event
    
    default_event = os.path.splitext(os.path.basename(input_file))[0]
    
    try:
        root = tk.Tk()
        root.withdraw()
        event_name = simpledialog.askstring("Event Name", "Enter the event name:", initialvalue=default_event)
        if event_name:
            return event_name
    except:
        pass
    
    event_name = input(f"Enter the event name (press Enter to use default: {default_event}): ")
    return event_name if event_name else default_event

def get_player_names():
    """
    Prompts the user to provide names for the white and black players.
    
    Returns:
        tuple: A tuple containing the names of the white and black players.
    
    This function checks for command-line arguments, tries to use dialog
    boxes if available, and falls back to manual input. It provides default
    names if the user doesn't specify any.
    """
    parser = argparse.ArgumentParser(description="Convert Ludii trial files to PGN.")
    parser.add_argument("-w", "--white", help="Name of the white player")
    parser.add_argument("-b", "--black", help="Name of the black player")
    args = parser.parse_args()

    if args.white and args.black:
        return args.white, args.black
    
    try:
        root = tk.Tk()
        root.withdraw()
        white_player = simpledialog.askstring("White Player", "Enter the name of the white player:", initialvalue="Player 1")
        black_player = simpledialog.askstring("Black Player", "Enter the name of the black player:", initialvalue="Player 2")
        if white_player and black_player:
            return white_player, black_player
    except:
        pass
    
    white_player = input("Enter the name of the white player (press Enter to use default: Player 1): ")
    black_player = input("Enter the name of the black player (press Enter to use default: Player 2): ")
    return white_player if white_player else "Player 1", black_player if black_player else "Player 2"

def get_game_result(ludii_content):
    """
    Extracts the game result from the Ludii content.
    
    Args:
        ludii_content (str): The full content of the Ludii file.
    
    Returns:
        str: The game result in PGN format ('1-0', '0-1', '1/2-1/2', or '*').
    
    This function searches for the 'winner=' line in the Ludii content
    and translates it to the standard PGN result notation.
    """
    winner_line = next((line for line in reversed(ludii_content.split('\n')) if line.startswith('winner=')), None)
    if winner_line:
        winner = int(winner_line.split('=')[1])
        if winner == 0:
            return "1/2-1/2"
        elif winner == 1:
            return "1-0"
        elif winner == 2:
            return "0-1"
    return "*"

def get_game_variant(ludii_content):
    """
    Determines the chess variant from the Ludii content.
    
    Args:
        ludii_content (str): The full content of the Ludii file.
    
    Returns:
        str: The name of the chess variant.
    
    This function extracts the game variant information from the first
    line of the Ludii content, which typically contains the game path.
    """
    first_line = ludii_content.split('\n')[0]
    return first_line.strip()
    
def filter_moves(input_file, output_file):
    """
    Filters and cleans up the moves in a PGN file.

    Args:
        input_file (str): Path to the input PGN file.
        output_file (str): Path where the filtered PGN file will be saved.

    This function reads a PGN file, removes certain types of moves (like setup moves
    and illegal moves), and writes the cleaned-up content to a new file. It's useful
    for removing extraneous information and focusing on the actual game moves.
    """
    with open(input_file, 'r') as file:
        lines = file.readlines()

    filtered_lines = []
    i = 0
    while i < len(lines):
        if "Ignored: Setup move" in lines[i]:
            for j in range(i-1, i-7, -1):
                if j >= 0 and (lines[j].startswith("Move parsed:") or 
                               lines[j].startswith("Debugging parse_ludii_move") or 
                               lines[j].startswith("Original:") or 
                               lines[j].startswith("Move") or
                               lines[j].startswith("Black components before move") or
                               lines[j].strip() == ""):
                    if filtered_lines:
                        filtered_lines.pop()
            i += 1
        elif "Parsed illegal move" in lines[i]:
            for j in range(i-1, i-7, -1):
                if j >= 0 and (lines[j].startswith("Parsing illegal move:") or 
                               lines[j].startswith("Illegal move detected") or 
                               lines[j].startswith("Original:") or 
                               lines[j].startswith("Move") or
                               lines[j].strip() == ""):
                    if filtered_lines:
                        filtered_lines.pop()
            i += 1
        else:
            filtered_lines.append(lines[i])
            i += 1

    filtered_lines = [line for line in filtered_lines if line.strip() != ""]

    with open(output_file, 'w') as file:
        file.writelines(filtered_lines)

def print_player_components(board, player):
    """
    Prints the current components (pieces) of a player on the board.

    Args:
        board (dict): Dictionary representing the current chess board.
        player (int): The player whose components are to be printed (1 for white, 2 for black).

    This function is useful for debugging and visualizing the current state of a player's
    pieces on the board. It prints each piece's location and type.
    """
    components = []
    for square, piece in board.items():
        if piece % 2 == player % 2:
            piece_symbol = PIECE_MAP.get(piece, '?')
            components.append(f"{square}:{piece_symbol}")
    
    player_name = "White" if player == 1 else "Black"
    debug_print(f"{player_name} components before move: {', '.join(sorted(components))}")

def print_board(board):
    """
    Creates a visual representation of the chess board.
    
    Args:
        board (dict): Dictionary representing the chess board.
    
    Returns:
        str: A string visually representing the chess board.
    
    This function creates an ASCII representation of the chess board,
    where each piece is represented by its corresponding symbol.
    White pieces are in uppercase, black pieces in lowercase.
    Empty squares are represented by dots.
    """
    board_str = ""
    for rank in range(8, 0, -1):
        for file in 'abcdefgh':
            square = file + str(rank)
            piece = board.get(square, '.')
            board_str += PIECE_MAP.get(piece, '.') + ' '
        board_str += '\n'
    return board_str

def build_pgn_header(input_file, variant, result):
    """
    Builds the PGN header for the chess game.
    
    Args:
        input_file (str): The path of the input Ludii file.
        variant (str): The chess variant being played.
        result (str): The result of the game.
    
    Returns:
        str: The PGN header as a string.
    
    This function creates the standard PGN header, including tags
    for the event name, site, date, player names, game variant, and result.
    """
    event_name = get_event_name(input_file)
    white_player, black_player = get_player_names()
    
    pgn = f'[Event "{event_name}"]\n'
    pgn += f'[Site "Ludii"]\n'
    pgn += f'[Date "{get_file_creation_date(input_file)}"]\n'
    pgn += f'[White "{white_player}"]\n'
    pgn += f'[Black "{black_player}"]\n'
    pgn += f'[Variant "{variant}"]\n'
    pgn += f'[Result "{result}"]\n\n'
    return pgn

def remove_notes(move_str):
    """
    Removes commentary notes from a move string.
    
    Args:
        move_str (str): The move string potentially containing notes.
    
    Returns:
        str: The move string with notes removed.
    
    This function uses a regular expression to remove any text
    enclosed in curly braces {} from the move string.
    """
    return re.sub(r'\s*\{[^}]*\}', '', move_str)

def build_pgn_moves(white_moves, black_moves):
    """
    Builds the move section of the PGN without notes.
    
    Args:
        white_moves (list): List of white's moves.
        black_moves (list): List of black's moves.
    
    Returns:
        str: The formatted moves section of the PGN.
    
    This function combines white and black moves into the standard
    PGN format, removing any notes or comments from the moves.
    """
    pgn = ""
    for i in range(max(len(white_moves), len(black_moves))):
        pgn += f"{i+1}. "
        if i < len(white_moves):
            pgn += f"{remove_notes(white_moves[i])} "
        if i < len(black_moves):
            pgn += f"{remove_notes(black_moves[i])} "
        pgn += "\n"
    return pgn

def build_pgn_moves_with_notes(white_moves, black_moves):
    """
    Builds the move section of the PGN including notes.
    
    Args:
        white_moves (list): List of white's moves.
        black_moves (list): List of black's moves.
    
    Returns:
        str: The formatted moves section of the PGN with notes.
    
    Similar to build_pgn_moves, but this function retains all notes
    and comments in the move strings, which is particularly useful
    for variants like Kriegspiel where the notes contain important
    information about the game state.
    """
    pgn = ""
    for i in range(max(len(white_moves), len(black_moves))):
        pgn += f"{i+1}. "
        if i < len(white_moves):
            pgn += f"{white_moves[i]} "
        if i < len(black_moves):
            pgn += f"{black_moves[i]} "
        pgn += "\n"
    return pgn

def ludii_to_pgn(ludii_content, input_file):
    """
    Converts Ludii game content to PGN format.
    
    Args:
        ludii_content (str): The full content of the Ludii file.
        input_file (str): The path of the input Ludii file.
    
    Returns:
        str: The game in PGN format.
    
    This function determines the chess variant from the Ludii content
    and calls the appropriate conversion function (either convert_chess
    or convert_kriegspiel).
    """
    game_variant = get_game_variant(ludii_content)

    if game_variant == "game=/lud/board/war/replacement/checkmate/chess/Chess.lud":
        return convert_chess(ludii_content, input_file)
    elif game_variant == "game=/lud/board/war/replacement/checkmate/chess/Kriegspiel (Chess).lud":
        return convert_kriegspiel(ludii_content, input_file)
    else:
        raise ValueError(f"Unsupported game variant: {game_variant}")

def convert_trl_to_pgn(input_file, output_file):
    """
    Converts a Ludii .trl file to PGN format.
    
    Args:
        input_file (str): Path to the input .trl file.
        output_file (str): Path where the output PGN file will be saved.
    
    This function reads the Ludii .trl file, converts its content to PGN
    format, and writes the result to the output file. It also handles
    potential errors during the process.
    """
    try:
        with open(input_file, 'r') as file:
            ludii_content = file.read()

        try:
            pgn_output = ludii_to_pgn(ludii_content, input_file)
            
            with open(output_file, 'w') as file:
                file.write(pgn_output)

            print(f"Conversion completed. PGN file saved as {output_file}")

        except ValueError as ve:
            print(f"Error: {str(ve)}")
            return  # Exit the function without creating output file

    except FileNotFoundError:
        print(f"Error: File {input_file} not found.")
    except IOError as e:
        print(f"I/O error during file reading or writing: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {str(e)}")

# Coordinate conversion functions

def ludii_to_algebraic(coord):
    """
    Converts Ludii coordinates to algebraic chess notation.
    
    Args:
        coord (int): Numeric coordinate in Ludii format (0-63).
    
    Returns:
        str: Coordinate in algebraic notation (e.g., 'e4').
    
    Ludii uses a 0-63 coordinate system, where 0 is a1 and 63 is h8.
    This function converts that number to a standard chess letter-number pair.
    """
    file = chr(ord('a') + (int(coord) % 8))
    rank = str((int(coord) // 8) + 1)
    return file + rank

def algebraic_to_ludii(alg):
    """
    Converts algebraic chess notation to Ludii coordinates.
    
    Args:
        alg (str): Coordinate in algebraic notation (e.g., 'e4').
    
    Returns:
        int: Numeric coordinate in Ludii format (0-63).
    
    This is the inverse operation of ludii_to_algebraic.
    Converts a chess letter-number pair to a 0-63 number.
    """
    file = ord(alg[0]) - ord('a')
    rank = int(alg[1]) - 1
    return rank * 8 + file

# Board management functions

def setup_board(ludii_content):
    """
    Sets up the initial chess board based on Ludii content.
    
    Args:
        ludii_content (str): The content of the Ludii file.
    
    Returns:
        dict: A dictionary representing the chess board, where keys
              are algebraic coordinates and values are piece codes.
    
    This function parses the Ludii content to extract initial setup moves
    and builds the board representation. It also compares the obtained
    configuration with the standard chess setup, logging any discrepancies
    to the debug log.
    """
    board = {}
    setup_moves = re.findall(r'Move=\[Move:mover=0.*?\]', ludii_content)
    for move in setup_moves:
        match = re.search(r'to=(\d+),.*?what=(\d+)', move)
        if match:
            square, piece = match.groups()
            board[ludii_to_algebraic(int(square))] = int(piece)

    expected_setup = {
        'a1': 3, 'b1': 9, 'c1': 7, 'd1': 11, 'e1': 5, 'f1': 7, 'g1': 9, 'h1': 3,
        'a2': 1, 'b2': 1, 'c2': 1, 'd2': 1, 'e2': 1, 'f2': 1, 'g2': 1, 'h2': 1,
        'a7': 2, 'b7': 2, 'c7': 2, 'd7': 2, 'e7': 2, 'f7': 2, 'g7': 2, 'h7': 2,
        'a8': 4, 'b8': 10, 'c8': 8, 'd8': 12, 'e8': 6, 'f8': 8, 'g8': 10, 'h8': 4
    }

    if board != expected_setup:
        debug_print("Warning: Initial board setup does not match the expected configuration.")
        debug_print("Expected:", expected_setup)
        debug_print("Actual:", board)

    return board

def update_board(board, from_sq, to_sq, promotion):
    """
    Updates the chess board after a move.
    
    Args:
        board (dict): Dictionary representing the chess board.
        from_sq (str): Starting square in algebraic notation.
        to_sq (str): Ending square in algebraic notation.
        promotion (int): Code of the promoted piece, if applicable.
    
    Returns:
        dict: The updated chess board.
    
    This function updates the board by moving the piece from the starting
    square to the ending square. It also handles special cases like
    castling and pawn promotion.
    """
    piece = board.pop(from_sq, None)
    if piece:
        board[to_sq] = promotion if promotion else piece

        # Handle castling
        if piece in [5, 6] and abs(ord(from_sq[0]) - ord(to_sq[0])) == 2:
            if to_sq[0] == 'g':  # Kingside castling
                rook_from = 'h' + from_sq[1]
                rook_to = 'f' + from_sq[1]
            else:  # Queenside castling
                rook_from = 'a' + from_sq[1]
                rook_to = 'd' + from_sq[1]
            rook = board.pop(rook_from)
            board[rook_to] = rook

    return board

# Move analysis and generation functions

def parse_ludii_move(move_str):
    """
    Parses a move in Ludii format.
    
    Args:
        move_str (str): String representing a move in Ludii format.
    
    Returns:
        tuple: A tuple containing (player, from_square, to_square,
               is_capture, promotion, notes) or None if parsing fails.
    
    This function extracts all relevant information from a Ludii move string,
    including the moving player, start and end squares, whether it's a capture,
    any promotions, and additional notes. It also handles illegal moves and
    groups notes by player.
    """
    debug_print(f"Debugging parse_ludii_move. Input: {move_str}")

    if 'Illegal move' in move_str:
        debug_print("Illegal move detected")
        return None

    # Extract basic move information
    mover_match = re.search(r'mover=(\d+)', move_str)
    from_match = re.search(r'from=(\d+)', move_str)
    to_match = re.search(r'to=(\d+)', move_str)

    # Extract and group notes
    notes = re.findall(r'\[Note:message=(.*?),to=(\d+)\]', move_str)
    grouped_notes = {}
    for note in notes:
        message, to_player = note
        if message in grouped_notes:
            grouped_notes[message].add(to_player)
        else:
            grouped_notes[message] = {to_player}

    combined_notes = []
    for message, players in grouped_notes.items():
        if len(players) > 1:
            combined_notes.append((message, 'player 1 & player 2'))
        else:
            combined_notes.append((message, f"player {players.pop()}"))

    if mover_match and from_match and to_match:
        player = int(mover_match.group(1))
        from_coord = int(from_match.group(1))
        to_coord = int(to_match.group(1))

        from_sq = ludii_to_algebraic(from_coord)
        to_sq = ludii_to_algebraic(to_coord)
        is_capture = 'Remove:' in move_str or 'CapturedPiece' in move_str
        promotion = None
        if 'Promote:' in move_str:
            promotion_match = re.search(r'Promote:.*?what=(\d+)', move_str)
            if promotion_match:
                promotion = int(promotion_match.group(1))

        debug_print(f"Move parsed: player={player}, from={from_sq}, to={to_sq}, capture={is_capture}, promotion={promotion}, notes={combined_notes}")
        return player, from_sq, to_sq, is_capture, promotion, combined_notes

    debug_print("Move parsing failed")
    return None

def parse_illegal_move(move_str, board):
    """
    Parses an illegal move.
    
    Args:
        move_str (str): String representing an illegal move.
        board (dict): Dictionary representing the current chess board.
    
    Returns:
        str: A string representing the illegal move in a readable format,
             or None if parsing fails.
    
    This function attempts to extract meaningful information from an illegal move,
    such as the starting and ending squares and the type of piece involved.
    Useful for debugging and providing feedback on illegal moves.
    """
    debug_print(f"Parsing illegal move: {move_str}")
    from_match = re.search(r'from=(\d+)', move_str)
    to_match = re.search(r'to=(\d+)', move_str)
    
    if from_match and to_match:
        from_sq = ludii_to_algebraic(int(from_match.group(1)))
        to_sq = ludii_to_algebraic(int(to_match.group(1)))
        piece = board.get(from_sq)
        piece_symbol = PIECE_MAP.get(piece, '')
        
        if piece_symbol == 'P':
            return f"{from_sq}-{to_sq}"
        elif piece_symbol:
            return f"{piece_symbol}{from_sq}-{to_sq}"
    
    debug_print(f"Failed to parse illegal move: {move_str}")
    return None

def is_legal_pawn_capture(from_sq, to_sq, player):
    """
    Checks if a pawn capture is legal.
    
    Args:
        from_sq (str): Starting square in algebraic notation.
        to_sq (str): Ending square in algebraic notation.
        player (int): Player making the move (1 for white, 2 for black).
    
    Returns:
        bool: True if the pawn capture is legal, False otherwise.
    
    This function checks if the pawn capture follows the correct diagonal
    movement pattern for the given player.
    """
    file_diff = abs(ord(from_sq[0]) - ord(to_sq[0]))
    rank_diff = int(to_sq[1]) - int(from_sq[1])
    
    if player == 1:  # White
        return file_diff == 1 and rank_diff == 1
    else:  # Black
        return file_diff == 1 and rank_diff == -1

def calculate_pawn_tries(board, player, from_sq, to_sq):
    """
    Calculates the number of possible pawn captures.
    
    Args:
        board (dict): Dictionary representing the current chess board.
        player (int): Player making the move (1 for white, 2 for black).
        from_sq (str): Starting square of the last move in algebraic notation.
        to_sq (str): Ending square of the last move in algebraic notation.
    
    Returns:
        tuple: A tuple containing the number of pawn capture attempts and
               a list of the possible capture moves.
    
    This function calculates how many pawns of the opposite color can
    potentially capture on the square where a piece just moved. It also
    checks for en passant possibilities.
    """
    debug_print(f"calculate_pawn_tries called with:")
    debug_print(f"  board: {board} //{{")
    debug_print(f"  player: {player}")
    debug_print(f"  from_sq: {from_sq}, to_sq: {to_sq}")

    tries = 0
    try_moves = []

    # Check for en passant possibility
    if board.get(to_sq) in [1, 2]:  # If the moved piece is a pawn
        if abs(int(to_sq[1]) - int(from_sq[1])) == 2:  # If it's a double step
            en_passant_rank = int(from_sq[1]) + (1 if player == 2 else -1)
            en_passant_square = to_sq[0] + str(en_passant_rank)
            adjacent_files = [chr(ord(to_sq[0]) - 1), chr(ord(to_sq[0]) + 1)]
            
            for adj_file in adjacent_files:
                pawn_square = adj_file + str(en_passant_rank)
                if pawn_square in board and board[pawn_square] == player:
                    tries += 1
                    try_moves.append(f"{pawn_square}-{en_passant_square} (en passant)")

    # Check for regular pawn captures
    for square, piece in board.items():
        if piece == player:
            file, rank = square[0], int(square[1])
            capture_squares = []

            if player == 1:  # White
                capture_squares = [chr(ord(file) - 1) + str(rank + 1), chr(ord(file) + 1) + str(rank + 1)]
            else:  # Black
                capture_squares = [chr(ord(file) - 1) + str(rank - 1), chr(ord(file) + 1) + str(rank - 1)]

            for cap_square in capture_squares:
                if cap_square in board and board[cap_square] != player and board[cap_square] % 2 != player % 2:
                    if is_legal_pawn_capture(square, cap_square, player):
                        tries += 1
                        try_moves.append(f"{square}-{cap_square}")

    debug_print(f"Pawn tries: {tries}")
    debug_print(f"Try moves: {try_moves}")
    return tries, try_moves

def generate_pgn_move(board, from_sq, to_sq, is_capture, promotion, notes, player, illegal_moves):
    """
    Generates a move in PGN (Portable Game Notation) format.
    
    Args:
        board (dict): Dictionary representing the current chess board.
        from_sq (str): Starting square in algebraic notation.
        to_sq (str): Ending square in algebraic notation.
        is_capture (bool): True if the move is a capture, False otherwise.
        promotion (int): Code of the promoted piece, if applicable.
        notes (list): List of tuples containing additional notes about the move.
        player (int): Player making the move (1 for white, 2 for black).
        illegal_moves (list): List of illegal moves attempted before this move.
    
    Returns:
        tuple: A tuple containing the PGN move string and the updated board.
    
    This function generates a PGN representation of a chess move, including
    additional information like captures, promotions, checks, and illegal move attempts.
    It also updates the board state and calculates potential pawn captures.
    """
    piece = board.get(from_sq, 1)
    piece_symbol = PIECE_MAP.get(piece, '')

    move_str = generate_basic_move_string(board, from_sq, to_sq, is_capture, promotion, piece_symbol)

    new_board = update_board(board.copy(), from_sq, to_sq, promotion)

    umpire_info = []
    
    if is_capture:
        umpire_info.append(f"X{to_sq.lower()}")

    is_check = any("check" in note.lower() for note, _ in notes)
    if is_check:
        check_types = [note.split()[0].lower() for note, _ in notes if "check" in note.lower()]
        check_str = "C" + "".join(check_type[0].upper() for check_type in check_types)
        umpire_info.append(check_str)
    else:
        # Calculate pawn tries only if the move doesn't result in a check
        pawn_tries, try_moves = calculate_pawn_tries(new_board, 3 - player, from_sq, to_sq)
        if pawn_tries > 0:
            umpire_info.append(f"P{pawn_tries}")
        if try_moves:
            debug_print(f"Pawn try moves: {', '.join(try_moves)}")

    comment = "{"
    if umpire_info:
        comment += ",".join(umpire_info)
    
    if illegal_moves:
        comment += ":" if umpire_info else ":"
        comment += ",".join(illegal_moves)
    elif umpire_info:
        comment += ":"

    comment += "}"

    return f"{move_str} {comment}", new_board

def generate_basic_move_string(board, from_sq, to_sq, is_capture, promotion, piece_symbol):
    """
    Generates a basic move string in algebraic notation.
    
    Args:
        board (dict): Dictionary representing the current chess board.
        from_sq (str): Starting square in algebraic notation.
        to_sq (str): Ending square in algebraic notation.
        is_capture (bool): True if the move is a capture, False otherwise.
        promotion (int): Code of the promoted piece, if applicable.
        piece_symbol (str): Symbol of the piece being moved.
    
    Returns:
        str: A string representing the basic move in algebraic notation.
    
    This function creates the core part of the move notation, handling
    special cases like castling, pawn moves, captures, and promotions.
    It also resolves ambiguities when multiple pieces of the same type
    can move to the same square.
    """
    if piece_symbol == 'K':
        if from_sq == 'e1' and to_sq == 'g1':
            return "O-O"
        elif from_sq == 'e1' and to_sq == 'c1':
            return "O-O-O"
        elif from_sq == 'e8' and to_sq == 'g8':
            return "O-O"
        elif from_sq == 'e8' and to_sq == 'c8':
            return "O-O-O"

    move = ""
    if piece_symbol == 'P':
        if from_sq[0] != to_sq[0]:  # Pawn capture
            move = f"{from_sq[0]}x{to_sq}"
        else:
            move = to_sq
    else:
        move = piece_symbol

        ambiguous_pieces = [sq for sq, p in board.items() if p == board.get(from_sq) and sq != from_sq and can_move_to(sq, to_sq, p)]
        if ambiguous_pieces:
            if all(sq[0] != from_sq[0] for sq in ambiguous_pieces):
                move += from_sq[0]
            elif all(sq[1] != from_sq[1] for sq in ambiguous_pieces):
                move += from_sq[1]
            else:
                move += from_sq

        if is_capture:
            move += "x"
        move += to_sq

    if promotion:
        move += f"={PIECE_MAP.get(promotion, 'Q')}"

    return move

def can_move_to(from_sq, to_sq, piece):
    """
    Checks if a piece can move from one square to another.
    
    Args:
        board (dict): Dictionary representing the current chess board.
        from_sq (str): Starting square in algebraic notation.
        to_sq (str): Ending square in algebraic notation.
        piece (int): Code of the piece being moved.
    
    Returns:
        bool: True if the move is possible, False otherwise.
    
    This function provides a basic check for whether a piece can move
    between two squares, based on the piece type and the board layout.
    It doesn't account for all chess rules (like check), but helps in
    identifying potential legal moves.
    """
    piece_symbol = PIECE_MAP.get(piece, '')
    file_diff = abs(ord(from_sq[0]) - ord(to_sq[0]))
    rank_diff = abs(int(from_sq[1]) - int(to_sq[1]))

    if piece_symbol == 'R':
        return file_diff == 0 or rank_diff == 0
    elif piece_symbol == 'N':
        return (file_diff == 1 and rank_diff == 2) or (file_diff == 2 and rank_diff == 1)
    elif piece_symbol == 'B':
        return file_diff == rank_diff
    elif piece_symbol == 'Q':
        return file_diff == 0 or rank_diff == 0 or file_diff == rank_diff
    elif piece_symbol == 'K':
        return file_diff <= 1 and rank_diff <= 1

    return True  # For pawns or unknown pieces, assume it's possible

def convert_chess(ludii_content, input_file):
    """
    Converts a standard chess game from Ludii format to PGN.
    
    Args:
        ludii_content (str): The full content of the Ludii file.
        input_file (str): The path of the input Ludii file.
    
    Returns:
        str: The game in PGN format.
    
    This function processes the entire chess game, move by move,
    converting it from Ludii's format to standard PGN. It handles
    the game setup, move parsing, and PGN generation.
    """
    global debug_log
    debug_log = []  # Reset debug log

    board = setup_board(ludii_content)
    
    moves = [line for line in ludii_content.split('\n') if line.startswith('Move=')]
    white_moves = []
    black_moves = []
    
    for move in moves:
        debug_print(f"\nOriginal: {move}")

        parsed = parse_ludii_move(move)
        if parsed:
            player, from_sq, to_sq, is_capture, promotion, notes = parsed

            print_player_components(board, player)

            if player in [1, 2]:
                pgn_move, board = generate_pgn_move(board, from_sq, to_sq, is_capture, promotion, notes, player, [])
                
                if player == 1:
                    white_moves.append(pgn_move)
                else:
                    black_moves.append(pgn_move)

                debug_print(f"Converted: {pgn_move} //{{")

                debug_print("Board after move:")
                debug_print(print_board(board))
            else:
                debug_print("Ignored: Setup move")
        else:
            debug_print("Ignored: Parsing failed")

    result = get_game_result(ludii_content)

    pgn = build_pgn_header(input_file, "Chess", result)
    pgn += build_pgn_moves(white_moves, black_moves)
    pgn += result

    if DEBUG:
        pgn += "\n\n{Debug Log:\n"
        pgn += '\n'.join(debug_log)
        pgn += "\n}"

    return pgn

def convert_kriegspiel(ludii_content, input_file):
    """
    Converts a Kriegspiel chess game from Ludii format to PGN.
    
    Args:
        ludii_content (str): The full content of the Ludii file.
        input_file (str): The path of the input Ludii file.
    
    Returns:
        str: The game in PGN format.
    
    This function is similar to convert_chess, but it handles the
    special rules and notations of Kriegspiel, including illegal
    moves and limited information available to players.
    """
    global debug_log
    debug_log = []  # Reset debug log

    board = setup_board(ludii_content)
    
    moves = [line for line in ludii_content.split('\n') if line.startswith('Move=')]
    white_moves = []
    black_moves = []

    illegal_moves = []
    
    i = 0
    while i < len(moves):
        debug_print(f"\nMove {i+1}:")
        debug_print(f"Original: {moves[i]}")

        if 'Illegal move' in moves[i]:
            debug_print("Illegal move detected")
            illegal_move = parse_illegal_move(moves[i], board)
            if illegal_move:
                illegal_moves.append(illegal_move)
                debug_print(f"Parsed illegal move: {illegal_move}")
            else:
                debug_print("Failed to parse illegal move")
            i += 1
            continue

        parsed = parse_ludii_move(moves[i])
        if parsed:
            player, from_sq, to_sq, is_capture, promotion, notes = parsed

            print_player_components(board, player)

            if i + 1 < len(moves) and 'Promote:' in moves[i+1]:
                next_parsed = parse_ludii_move(moves[i+1])
                if next_parsed and next_parsed[1] == to_sq and next_parsed[2] == to_sq:
                    promotion = next_parsed[4]
                    i += 1

            if player in [1, 2]:
                pgn_move, new_board = generate_pgn_move(board, from_sq, to_sq, is_capture, promotion, notes, player, illegal_moves)
                
                if player == 1:
                    white_moves.append(pgn_move)
                else:
                    black_moves.append(pgn_move)

                debug_print(f"Converted: {pgn_move} //{{")

                illegal_moves = []
                board = new_board

                debug_print("Board after move:")
                debug_print(print_board(board))
            else:
                debug_print("Ignored: Setup move")
        else:
            debug_print("Ignored: Parsing failed")
        
        i += 1

    result = get_game_result(ludii_content)

    pgn = build_pgn_header(input_file, "Kriegspiel (chess)", result)
    pgn += build_pgn_moves_with_notes(white_moves, black_moves)
    pgn += result

    if DEBUG:
        pgn += "\n\n{Debug Log:\n"
        pgn += '\n'.join(debug_log)
        pgn += "\n}"

    return pgn

if __name__ == "__main__":
    input_file = get_input_file()
    
    if input_file:
        # DEBUG = True

        output_file = get_output_file(input_file)

        convert_trl_to_pgn(input_file, output_file)
        
        print(f"PGN file saved as {output_file}")

        if DEBUG:
            base_name = os.path.splitext(output_file)[0]
            filtered_output_file = f"{base_name}_filtered.pgn"
            filter_moves(output_file, filtered_output_file)
            print(f"Filtered PGN file saved as {filtered_output_file}")

    else:
        print("No input file selected. Exiting.")
