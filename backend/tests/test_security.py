from app.security import (
    create_access_token,
    hash_password,
    sign_payload,
    verify_hmac_signature,
    verify_jwt,
    verify_password,
)


def test_password_hash_and_verify():
    h = hash_password("Sup3rStr0ng!")
    assert verify_password("Sup3rStr0ng!", h)
    assert not verify_password("nope", h)


def test_jwt_round_trip():
    tok = create_access_token("123", "owner")
    payload = verify_jwt(tok)
    assert payload is not None
    assert payload["sub"] == "123"
    assert payload["role"] == "owner"
    assert payload["type"] == "access"


def test_jwt_invalid():
    assert verify_jwt("not-a-jwt") is None


def test_hmac_signature():
    secret = "shared-secret"
    body = b'{"hello": "world"}'
    sig = sign_payload(body, secret)
    assert verify_hmac_signature(body, sig, secret)
    assert not verify_hmac_signature(body, sig, "wrong-secret")
    assert not verify_hmac_signature(body + b"tampered", sig, secret)
