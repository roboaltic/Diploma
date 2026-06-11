import hashlib
import hmac
import secrets


HASH_NAME = "sha256"
ITERATIONS = 100_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)

    password_hash = hashlib.pbkdf2_hmac(
        HASH_NAME,
        password.encode("utf-8"),
        salt.encode("utf-8"),
        ITERATIONS
    ).hex()

    return f"pbkdf2_{HASH_NAME}${ITERATIONS}${salt}${password_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False

    try:
        algorithm, iterations, salt, expected_hash = stored_hash.split("$")
        hash_name = algorithm.replace("pbkdf2_", "")

        calculated_hash = hashlib.pbkdf2_hmac(
            hash_name,
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations)
        ).hex()

        return hmac.compare_digest(calculated_hash, expected_hash)

    except Exception:
        return False