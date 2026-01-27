import json
import base64
import os
import sys
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.fernet import Fernet


ENV_VAR = "JSON_FILE_PASSWORD"


def get_password() -> str:
    password = os.getenv(ENV_VAR)
    if not password:
        print(f"❌ Environment variable {ENV_VAR} is not set")
        sys.exit(1)
    return password


def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def encrypt_json_inplace(file_path: str):
    password = get_password()
    salt = os.urandom(16)

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    key = derive_key(password, salt)
    encrypted = Fernet(key).encrypt(json.dumps(data).encode())

    with open(file_path, "wb") as f:
        f.write(salt + encrypted)

    print("🔒 Encrypted in-place")


def decrypt_json_inplace(file_path: str):
    password = get_password()

    with open(file_path, "rb") as f:
        raw = f.read()

    salt = raw[:16]
    encrypted_data = raw[16:]

    key = derive_key(password, salt)
    decrypted = Fernet(key).decrypt(encrypted_data)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(json.loads(decrypted.decode()), f, indent=2)

    print("🔓 Decrypted in-place")


if __name__ == "__main__":
    FILE_PATH = "data.json"

    # Uncomment what you want
    encrypt_json_inplace(FILE_PATH)
    # decrypt_json_inplace(FILE_PATH)
