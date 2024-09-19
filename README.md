# Chess Game Converter

This Python script converts Ludii trial files (.trl) to Portable Game Notation (PGN) files for chess games. It supports both standard chess and Kriegspiel variants.

## Features

- Converts Ludii trial files to PGN format
- Supports standard chess and Kriegspiel variants
- Allows custom event names and player names
- Provides both graphical and command-line interfaces
- Includes debug mode for detailed conversion information
- Generates filtered output for easier debugging

## Requirements

- Python 3.6 or higher
- tkinter (usually comes pre-installed with Python)

## Installation

1. Clone this repository or download the script file.
2. Ensure you have Python 3.6 or higher installed on your system.
3. Install required packages:

   ```
   pip install tkinter
   ```

   Note: tkinter usually comes pre-installed with Python. If you're using Linux and tkinter is not available, you can install it using your distribution's package manager. For example, on Ubuntu or Debian:

   ```
   sudo apt-get install python3-tk
   ```

## Usage

You can run the script in several ways:

### Graphical Interface

Simply run the script without any arguments:

```
python chess_converter.py
```

This will open file dialogs for selecting the input file, output file, and entering event and player names.

### Command Line Interface

You can also use command-line arguments:

```
python chess_converter.py -f input_file.trl -o output_file.pgn -e "Event Name" -w "White Player" -b "Black Player"
```

- `-f` or `--file`: Path to the input .trl file
- `-o` or `--output`: Path to the output .pgn file
- `-e` or `--event`: Name of the event
- `-w` or `--white`: Name of the white player
- `-b` or `--black`: Name of the black player

If you don't provide these arguments, the script will prompt you to enter the information.

## Output

The script generates two files:

1. A .pgn file with the converted game
2. A _filtered.pgn file (if DEBUG is set to True) which contains a more readable version of the debug information. This filtered file excludes non-essential moves such as illegal moves and setup moves, making it easier to review the debug output.

## Debug Mode

Set the `DEBUG` variable to `True` in the script to enable detailed logging. This will include a debug log in the output PGN file and generate the filtered PGN file for easier debugging.

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to check [issues page](https://github.com/yourusername/chess-converter/issues) if you want to contribute.

## License

This project is licensed under the GNU General Public License v3.0 (GPLv3) - see the [LICENSE](LICENSE) file for details. This is one of the most permissive open-source licenses, ensuring that derivatives of this software also remain open source.