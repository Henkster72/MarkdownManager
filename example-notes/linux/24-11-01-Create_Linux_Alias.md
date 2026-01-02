# Create Linux Alias

_date: 24-11-01_

**user:**

How would I make this an alias in linux?

**assistant:**

To create an alias in Linux that runs the last command with `sudo` using a more expressive term, you can add the following line to your shell configuration file (such as `~/.bashrc` or `~/.zshrc`):

```bash
alias fuck='sudo $(fc -ln -1)'
```

Here's a breakdown of how this works:

- `alias fuck=...` creates an alias called `fuck`.
- `sudo $(fc -ln -1)` runs the last command with `sudo`.
  - `fc -ln -1` retrieves the last command from your command history.
  - `$(...)` is command substitution, which means it will take the output of `fc -ln -1` and pass it to `sudo`.

### Steps to set up the alias:

1. Open your terminal.
2. Edit your shell configuration file, for example:

   ```bash
   nano ~/.bashrc  # For Bash
   # or
   nano ~/.zshrc   # For Zsh
   ```

3. Add the alias line:

   ```bash
   alias fuck='sudo $(fc -ln -1)'
   ```

4. Save and close the file.
5. Reload your shell configuration to apply the alias:

   ```bash
   source ~/.bashrc  # Or source ~/.zshrc
   ```

Now, whenever you type `fuck`, it will rerun the last command with `sudo`.
