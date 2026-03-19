“””
PGP File Decryptor
Decrypts PGP-encrypted files using a private key and passphrase.
Works on Windows, Linux, and macOS — uses shell commands directly.

Requirements:
- GnuPG (gpg) installed and available in PATH
“””

import os
import platform
import subprocess

# ============================================================

# CONFIGURE THESE VALUES

# ============================================================

ENCRYPTED_FILE = “encrypted.pgp”       # Path to the encrypted file
OUTPUT_FILE = “decrypted.txt”           # Path for the decrypted output
PRIVATE_KEY_FILE = “private.key”        # Path to your .key / .asc private key
PASSPHRASE = “your_passphrase_here”     # Passphrase for the private key

# ============================================================

def run_cmd(command):
“”“Run a shell command and return the result.”””
print(f”Running: {command}”)
result = subprocess.run(
command,
shell=True,
capture_output=True,
text=True
)
if result.stdout.strip():
print(f”  stdout: {result.stdout.strip()}”)
if result.stderr.strip():
print(f”  stderr: {result.stderr.strip()}”)
return result

def get_gpg_home():
“”“Get GnuPG home directory by running gpgconf.”””
result = subprocess.run(
“gpgconf –list-dirs homedir”,
shell=True,
capture_output=True,
text=True
)
if result.returncode == 0 and result.stdout.strip():
return result.stdout.strip()
return None

def decrypt_pgp_file(encrypted_file, output_file, key_file, passphrase):
“””
Decrypt a PGP file using shell commands.
Works exactly like running gpg in your terminal.
“””
key_file = os.path.abspath(key_file)
encrypted_file = os.path.abspath(encrypted_file)
output_file = os.path.abspath(output_file)

```
if not os.path.isfile(key_file):
    print(f"Error: Key file not found: {key_file}")
    return False

if not os.path.isfile(encrypted_file):
    print(f"Error: Encrypted file not found: {encrypted_file}")
    return False

# --- Info ---
print(f"System:      {platform.system()} {platform.release()}")
print(f"Key file:    {key_file}")
print(f"Input file:  {encrypted_file}")
print(f"Output file: {output_file}")

# Check gpg is available
gpg_check = run_cmd("gpg --version")
if gpg_check.returncode != 0:
    print("\nError: gpg is not installed or not in PATH.")
    return False

# Show gpg home
homedir = get_gpg_home()
if homedir:
    print(f"GPG home:    {homedir}")

# --- Step 1: Import the private key ---
print("\n--- Importing private key ---")
import_result = run_cmd(
    f'gpg --batch --yes --passphrase "{passphrase}" '
    f'--pinentry-mode loopback --import "{key_file}"'
)

if import_result.returncode != 0:
    stderr_lower = import_result.stderr.lower()
    if "imported" not in stderr_lower and "not changed" not in stderr_lower:
        print("Error: Key import failed.")
        return False

print("Key import done!")

# --- Step 2: Decrypt the file ---
print("\n--- Decrypting file ---")

# Remove output file if it already exists
if os.path.isfile(output_file):
    os.remove(output_file)

decrypt_result = run_cmd(
    f'gpg --batch --yes --passphrase "{passphrase}" '
    f'--pinentry-mode loopback '
    f'--output "{output_file}" --decrypt "{encrypted_file}"'
)

if decrypt_result.returncode == 0 and os.path.isfile(output_file):
    file_size = os.path.getsize(output_file)
    print(f"\nDecryption successful!")
    print(f"  Output: {output_file}")
    print(f"  Size:   {file_size} bytes")
    return True
else:
    print(f"\nDecryption failed! Return code: {decrypt_result.returncode}")
    return False
```

# — Run —

if **name** == “**main**”:
success = decrypt_pgp_file(
encrypted_file=ENCRYPTED_FILE,
output_file=OUTPUT_FILE,
key_file=PRIVATE_KEY_FILE,
passphrase=PASSPHRASE,
)

```
if success:
    print("\nDone! Check your output file.")
else:
    print("\nSomething went wrong. Check the errors above.")
```
