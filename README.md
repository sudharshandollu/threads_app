“””
PGP File Decryptor
Decrypts PGP-encrypted files using a private key and passphrase.
Works on Windows, Linux, and macOS — auto-detects gpg binary and home directory.

Requirements:
pip install python-gnupg
“””

import os
import platform
import subprocess
import shutil

# ============================================================

# CONFIGURE THESE VALUES

# ============================================================

ENCRYPTED_FILE = “encrypted.pgp”       # Path to the encrypted file
OUTPUT_FILE = “decrypted.txt”           # Path for the decrypted output
PRIVATE_KEY_FILE = “private.key”        # Path to your .key / .asc private key
PASSPHRASE = “your_passphrase_here”     # Passphrase for the private key

# ============================================================

def get_gpg_binary():
“”“Auto-detect the gpg binary path based on the OS.”””
system = platform.system()

```
if system == "Windows":
    common_paths = [
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "GnuPG", "bin", "gpg.exe"),
        os.path.join(os.environ.get("ProgramFiles", ""), "GnuPG", "bin", "gpg.exe"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "GnuPG", "bin", "gpg.exe"),
    ]
    for path in common_paths:
        if os.path.isfile(path):
            return path

    # Fallback: try 'where gpg'
    try:
        result = subprocess.run(["where", "gpg"], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip().splitlines()[0]
    except Exception:
        pass

else:
    # Linux / macOS
    try:
        result = subprocess.run(["which", "gpg"], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass

    common_paths = ["/usr/bin/gpg", "/usr/local/bin/gpg", "/opt/homebrew/bin/gpg"]
    for path in common_paths:
        if os.path.isfile(path):
            return path

return None
```

def get_gpg_home():
“”“Auto-detect the GnuPG home directory based on the OS.”””
# First try: ask gpgconf (most reliable)
try:
gpg_binary = get_gpg_binary()
if gpg_binary:
gpgconf = os.path.join(os.path.dirname(gpg_binary), “gpgconf”)
if platform.system() == “Windows”:
gpgconf += “.exe”

```
        if os.path.isfile(gpgconf):
            result = subprocess.run(
                [gpgconf, "--list-dirs", "homedir"],
                capture_output=True, text=True
            )
            if result.returncode == 0 and result.stdout.strip():
                home = result.stdout.strip()
                if os.path.isdir(home):
                    return home
except Exception:
    pass

# Second try: check GNUPGHOME environment variable
env_home = os.environ.get("GNUPGHOME")
if env_home and os.path.isdir(env_home):
    return env_home

# Third try: default paths per OS
system = platform.system()
if system == "Windows":
    default = os.path.join(os.environ.get("APPDATA", ""), "gnupg")
else:
    default = os.path.join(os.path.expanduser("~"), ".gnupg")

if os.path.isdir(default):
    return default

return None
```

def decrypt_pgp_file(encrypted_file, output_file, key_file, passphrase):
“””
Decrypt a PGP file by importing the key and decrypting via subprocess.
Auto-detects gpg binary and home directory.
“””
# — Auto-detect gpg binary —
gpg_path = get_gpg_binary()
if not gpg_path:
print(“Error: Could not find gpg binary.”)
print(”  Windows: Install from https://gpg4win.org”)
print(”  Mac:     brew install gnupg”)
print(”  Linux:   sudo apt install gnupg”)
return False

```
# --- Auto-detect gpg home ---
homedir = get_gpg_home()
if not homedir:
    print("Error: Could not find GnuPG home directory.")
    print('  Run "gpgconf --list-dirs homedir" to find it.')
    return False

key_file = os.path.abspath(key_file)
encrypted_file = os.path.abspath(encrypted_file)
output_file = os.path.abspath(output_file)

if not os.path.isfile(key_file):
    print(f"Error: Key file not found: {key_file}")
    return False

if not os.path.isfile(encrypted_file):
    print(f"Error: Encrypted file not found: {encrypted_file}")
    return False

print(f"System:      {platform.system()} {platform.release()}")
print(f"GPG binary:  {gpg_path}")
print(f"GPG home:    {homedir}")
print(f"Key file:    {key_file}")
print(f"Input file:  {encrypted_file}")
print(f"Output file: {output_file}")

# --- Step 1: Import the private key ---
print("\n--- Importing private key ---")
import_cmd = [
    gpg_path,
    "--homedir", homedir,
    "--batch",
    "--yes",
    "--passphrase", passphrase,
    "--pinentry-mode", "loopback",
    "--import", key_file
]

result = subprocess.run(import_cmd, capture_output=True, text=True)
print(result.stderr)

if result.returncode != 0:
    stderr_lower = result.stderr.lower()
    if "imported" not in stderr_lower and "not changed" not in stderr_lower:
        print("Error: Key import failed.")
        return False

print("Key import done!")

# --- Step 2: Decrypt the file ---
print("\n--- Decrypting file ---")
decrypt_cmd = [
    gpg_path,
    "--homedir", homedir,
    "--batch",
    "--yes",
    "--passphrase", passphrase,
    "--pinentry-mode", "loopback",
    "--output", output_file,
    "--decrypt", encrypted_file
]

result = subprocess.run(decrypt_cmd, capture_output=True, text=True)
print(result.stderr)

if result.returncode == 0 and os.path.isfile(output_file):
    file_size = os.path.getsize(output_file)
    print(f"\nDecryption successful!")
    print(f"  Output: {output_file}")
    print(f"  Size:   {file_size} bytes")
    return True
else:
    print(f"\nDecryption failed! Return code: {result.returncode}")
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


