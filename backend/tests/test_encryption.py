from app.services.encryption import decrypt_json, decrypt_str, encrypt_json, encrypt_str


def test_string_round_trip():
    secret = "hello world — 🚀"
    enc = encrypt_str(secret)
    assert enc != secret
    assert decrypt_str(enc) == secret


def test_json_round_trip():
    payload = {"api_key": "sk-1234", "nested": {"x": [1, 2, 3]}}
    blob = encrypt_json(payload)
    assert decrypt_json(blob) == payload


def test_each_encrypt_uses_unique_nonce():
    a = encrypt_str("same plaintext")
    b = encrypt_str("same plaintext")
    assert a != b
