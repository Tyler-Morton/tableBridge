"""AES-256-GCM at-rest encryption for credentials and raw payloads."""

import base64
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings

settings = get_settings()


def _key() -> bytes:
    """Decode the 32-byte encryption key from a hex string."""
    raw = bytes.fromhex(settings.encryption_key)
    if len(raw) != 32:
        raise RuntimeError(
            "ENCRYPTION_KEY must be 64 hex chars (32 bytes). "
            "Generate with: python -c 'import secrets; print(secrets.token_hex(32))'"
        )
    return raw


def encrypt_str(plaintext: str) -> str:
    """Encrypt a string -> base64-encoded (nonce || ciphertext)."""
    aesgcm = AESGCM(_key())
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def decrypt_str(token: str) -> str:
    """Decrypt the output of encrypt_str."""
    aesgcm = AESGCM(_key())
    blob = base64.b64decode(token)
    nonce, ct = blob[:12], blob[12:]
    return aesgcm.decrypt(nonce, ct, None).decode("utf-8")


def encrypt_json(data: Any) -> str:
    return encrypt_str(json.dumps(data, default=str))


def decrypt_json(token: str) -> Any:
    return json.loads(decrypt_str(token))
