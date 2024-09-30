# TRLtoPGN

This Python script converts Ludii trial files (.trl) to Portable Game Notation (PGN) files for chess games. It supports both standard chess and Kriegspiel variants, and can handle multiple input files for processing games in rounds.

## Features

- Converts Ludii trial files to PGN format
- Supports standard chess and Kriegspiel variants
- Handles multiple input files for processing games in rounds
- Allows custom event names and player names
- Provides both graphical and command-line interfaces
- Includes debug mode for detailed conversion information
- Generates filtered output for easier debugging
- Automatically swaps player names between rounds

## Requirements

- Python 3.6 or higher
- tkinter (usually comes pre-installed with Python)

## Installation

1. Install Python:
   * Windows:
     a. Go to the official Python website: https://www.python.org/downloads/windows/
     b. Download the latest Python 3 version (3.6 or higher)
     c. Run the installer and make sure to check "Add Python to PATH" during installation
   * macOS:
     ```
     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
     brew install python
     ```
   * Linux:
     * Ubuntu or Debian:
       ```
       sudo apt-get update && sudo apt-get install python3 python3-pip
       ```
     * Fedora:
       ```
       sudo dnf install python3 python3-pip
       ```
     * Arch Linux:
       ```
       sudo pacman -S python python-pip
       ```

2. Clone this repository or download the script file:
   ```
   git clone https://github.com/chiar0/TRLtoPGN.git
   cd TRLtoPGN
   ```

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
python TRLtoPGN.py
```

This will open file dialogs for selecting the input files, output file, and entering player names.

### Command Line Interface

You can also use command-line arguments:

```
python TRLtoPGN.py -f input_file1.trl input_file2.trl -o output_file.pgn -w "White Player" -b "Black Player"
```

- `-f` or `--files`: Paths to one or more input .trl files
- `-o` or `--output`: Path to the output .pgn file
- `-w` or `--white`: Name of the white player
- `-b` or `--black`: Name of the black player

If you don't provide these arguments, the script will prompt you to enter the information.

### Multiple File Processing

When processing multiple input files, the script will:
1. Convert the first file to `output_file-1.pgn`
2. Convert subsequent files to `output_file-2.pgn`, `output_file-3.pgn`, etc.
3. All output files will be in the same directory as the specified output file
4. Player names will be swapped between rounds automatically

## Output

The script generates PGN files for each input file processed. If DEBUG mode is enabled, it will include additional debug information in the console output.

## Debug Mode

Set the `DEBUG` variable to `True` in the script to enable detailed logging. This will include a debug log in the console output and may generate additional debug files for easier debugging.

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to check the issues page if you want to contribute.
