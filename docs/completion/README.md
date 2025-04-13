# DedPaste Command Auto-Completion

This directory contains shell command auto-completion scripts for DedPaste CLI.

## Navigation

- [Documentation Home](../README.md)
- [Main README](../../README.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Release Process](../RELEASE-PROCESS.md)
- [Testing Guide](../TESTING.md)
- [Troubleshooting Guide](../troubleshooting.md)
- [Encryption Implementation Plan](../encryption-implementation-plan.md)
- [Encryption Implementation Summary](../encryption-implementation-summary.md)

## Installation

### Bash Completion

1. Source the completion script in your `.bashrc` or `.bash_profile`:

   ```bash
   # Add this line to your ~/.bashrc or ~/.bash_profile
   source /path/to/dedpaste/completion/dedpaste-completion.bash
   ```

2. Alternatively, you can copy or symlink it to the bash completion directory if you have one set up:

   ```bash
   # On macOS (if you have bash-completion installed via Homebrew)
   ln -s /path/to/dedpaste/completion/dedpaste-completion.bash /usr/local/etc/bash_completion.d/dedpaste

   # On Linux (Ubuntu/Debian)
   sudo ln -s /path/to/dedpaste/completion/dedpaste-completion.bash /etc/bash_completion.d/dedpaste
   ```

### Zsh Completion

1. Make sure you have the Zsh completion system initialized in your `.zshrc`. If not, add:

   ```zsh
   # Add to your ~/.zshrc if it's not already there
   autoload -Uz compinit
   compinit
   ```

2. Source the completion script in your `.zshrc`:

   ```zsh
   # Add this line to your ~/.zshrc
   source /path/to/dedpaste/completion/dedpaste-completion.zsh
   ```

3. Alternatively, you can copy or symlink it to one of the directories in your `$fpath`:

   ```zsh
   # Find a suitable directory in your fpath
   echo $fpath
   
   # Then symlink it (replacing with an appropriate directory from your fpath)
   ln -s /path/to/dedpaste/completion/dedpaste-completion.zsh ~/.zsh/completions/_dedpaste
   ```

## Features

The completion scripts provide auto-completion for:

- All DedPaste commands (`keys`, `send`, `get`)
- All command options for each subcommand
- File paths for options that accept files
- Content type suggestions for the `--type` option

## Usage Examples

Try typing these and press Tab to see completions:

```
dedpaste [TAB]              # Show all commands
dedpaste --[TAB]            # Show all global options
dedpaste keys --[TAB]       # Show all options for the 'keys' command
dedpaste send --[TAB]       # Show all options for the 'send' command
dedpaste get --[TAB]        # Show all options for the 'get' command
dedpaste --file [TAB]       # Show file completion
dedpaste --type [TAB]       # Show content type suggestions
```

## Updating

When new commands or options are added to DedPaste, you'll need to update these completion scripts accordingly.