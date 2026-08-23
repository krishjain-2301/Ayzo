from app.core.crypto import encrypt_api_key, decrypt_api_key


def test_encrypt_decrypt_roundtrip():
    plaintext = "sk-test-key-12345"
    stored = encrypt_api_key(plaintext)
    assert stored.startswith("fernet:")
    assert decrypt_api_key(stored) == plaintext


def test_decrypt_legacy_plaintext():
    assert decrypt_api_key("sk-plaintext-legacy") == "sk-plaintext-legacy"


def test_encrypt_none():
    assert encrypt_api_key(None) is None
    assert decrypt_api_key(None) is None
