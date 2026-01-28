import os
import pickle
from cryptography.fernet import Fernet

def decrypt_pickle_file(file_path: str):
    password = get_password()

    # read encrypted pickle
    with open(file_path, "rb") as f:
        raw = f.read()

    salt = raw[:16]
    encrypted_data = raw[16:]

    key = derive_key(password, salt)
    decrypted_bytes = Fernet(key).decrypt(encrypted_data)

    obj = pickle.loads(decrypted_bytes)

    # atomic replace with decrypted pickle
    tmp_path = file_path + ".tmp"
    with open(tmp_path, "wb") as f:
        pickle.dump(obj, f)
        f.flush()
        os.fsync(f.fileno())

    os.replace(tmp_path, file_path)





import os
import pickle
from cryptography.fernet import Fernet

def encrypt_pickle_file(file_path: str):
    password = get_password()
    salt = os.urandom(16)

    # load pickle safely
    with open(file_path, "rb") as f:
        obj = pickle.load(f)

    key = derive_key(password, salt)
    encrypted = Fernet(key).encrypt(pickle.dumps(obj))

    # atomic replace
    tmp_path = file_path + ".tmp"
    with open(tmp_path, "wb") as f:
        f.write(salt + encrypted)
        f.flush()
        os.fsync(f.fileno())

    os.replace(tmp_path, file_path)
