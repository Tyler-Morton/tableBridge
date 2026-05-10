# SECURITY.md

This is a portfolio-quality demo, but the security posture is built like the real product. Every control listed here exists in the code today.

## Threat model

TableBridge accepts *untrusted* webhook traffic from delivery platforms, exposes a tablet UI to floor staff (low-trust environment, shared device), and has admin endpoints that can rewrite the menu and emit kitchen tickets. The most likely attacks:

| Threat | Vector | Mitigation in code |
|--------|--------|--------------------|
| Forged webhook (attacker pretends to be DoorDash) | `/webhooks/{platform}` | HMAC-SHA256 signature verification with platform-specific secrets; constant-time compare via `hmac.compare_digest` |
| Webhook replay | Resending a captured payload | 5-minute replay window enforced via `X-*-Timestamp` header |
| Duplicate orders | Same order id replayed accidentally | Unique constraint on `(platform, external_order_id)`; duplicates returned as `{"status": "duplicate"}` |
| Tablet credential theft | Shared device, observed keypad | 4-digit PIN with Argon2id hashing, 5-attempts-per-15min lockout |
| Brute-force login | Repeated password attempts | slowapi rate limiting on `/auth/login` and `/auth/pin-login` |
| Stolen JWT | Sniffed bearer token | 15-min access token; 7-day refresh; refresh tokens rotated on use, sha256 hash stored not the raw token |
| At-rest credential exposure | DB stolen | All API credentials and raw webhook payloads encrypted with AES-256-GCM (`services/encryption.py`); key in env var |
| PII to third-party LLM | Customer data sent to Anthropic | `_strip_pii` removes name / phone / address before any prompt; only menu items + modifiers + special instructions are sent |
| Privilege escalation | Server tries to change settings | RBAC dependency factory `require_roles(...)`; `require_owner`, `require_manager`, `require_any` |
| Unauthorized 86'd toggle | Floor staff drives kitchen state | `PATCH /toast/items/{id}` requires `manager` role |
| Webhook spam / DoS | Flooding webhook endpoints | slowapi rate limit on webhooks |
| SQL injection | Crafted payload | SQLAlchemy ORM only — no raw string-interpolated SQL anywhere |
| Schema confusion | Bad payload from platform | Pydantic v2 strict mode validates every webhook + every API body |
| XSS / clickjacking | Compromised iframe / inline injection | Response middleware sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, CSP, `Referrer-Policy: no-referrer` |
| Cross-origin theft of access tokens | Browser CORS misconfig | CORS allow-list locked to the configured `FRONTEND_ORIGIN` |
| Token leak in logs | Bearer token in error message | Custom global handler returns generic `Internal server error`; bearer tokens never serialized |
| Insider tampering | Manager covers tracks | Append-only `audit_log` — no UPDATE / DELETE codepath; every sensitive action recorded with before/after JSON, IP, user id, timestamp |

## Auth

- Password hashing: **Argon2id** (passlib + argon2-cffi), default work factor.
- PIN hashing: same primitive, never stored or transmitted in plaintext.
- JWT: HS256, 15-minute access tokens, 7-day refresh tokens.
- Refresh token rotation: on every `/auth/refresh`, the previous refresh token is marked `revoked = true` and a new one is issued. Reuse of a revoked token is detected and rejected.
- Lockout: after `PIN_MAX_ATTEMPTS` (default 5) failed attempts within `PIN_LOCKOUT_MINUTES` (default 15), the account is temporarily locked.

## RBAC

| Role | Permissions |
|------|-------------|
| `owner` | Everything |
| `manager` | All read-only, mark items 86'd, view audit log, set runtime alert volume |
| `server` | Sign in, view orders, send/flag/reject reviews. Cannot change settings, cannot edit credentials, cannot toggle 86'd state |

Enforced on every endpoint via FastAPI dependencies — see `app/dependencies.py`.

## Webhook signing

Each platform has its own signing secret (env var). The mock generator signs payloads exactly the way the real platform would — HMAC-SHA256 over the request body, header is `X-{Platform}-Signature: sha256=<hex>` and `X-{Platform}-Timestamp: <unix-seconds>`.

Verification:

```python
expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
hmac.compare_digest(expected, signature_from_header)   # constant time
```

If the timestamp drifts more than 300 seconds the request is rejected — this is the replay window.

## Encryption

- **Library**: `cryptography` AESGCM.
- **Key length**: 32 bytes (256-bit).
- **Nonce**: 12 random bytes per encrypt, prepended to ciphertext, base64 encoded.
- **Used for**: stored API credentials (`api_credentials.encrypted_payload`) and raw webhook payloads (`incoming_orders_raw.payload_encrypted`).
- **Key source**: `ENCRYPTION_KEY` env var (64 hex chars). Never logged.
- **Production**: rotate the key by re-encrypting both tables; this demo does not implement online rotation but the `services/encryption.py` API would support it (decrypt with old key, encrypt with new).

## PII handling

The customer name on a tablet is shown as `First L.` (first name + last initial). The full payload is encrypted at rest and decrypted only when the review screen is opened.

When sending an order to Anthropic for parsing, `services/ai_parser._strip_pii` removes:

- Customer first / last name
- Phone numbers
- Addresses
- Anything outside the `items` and `raw_special_instructions` fields

Tests assert the sanitized payload contains no customer data (`test_pii_stripper_removes_customer_name`).

## Input validation

- Every request body uses `pydantic.BaseModel` with `ConfigDict(strict=True)` where appropriate.
- IDs are integers, never strings interpolated into SQL.
- Pin is `Field(pattern=r"^\d{4}$")` — exactly 4 digits, regex-bound.
- Email uses Pydantic `EmailStr`.

## Headers and CORS

`app/main.py` middleware sets:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'
```

CORS is set via `CORSMiddleware` and locked to `settings.frontend_origin` (default `http://localhost:5173`). Credentials are allowed; methods / headers are unrestricted within the same origin.

## Rate limiting

`slowapi` is wired up globally. Auth endpoints and webhook endpoints have rate limits configured via `settings.auth_rate_limit` and `settings.webhook_rate_limit`. Limits are per-IP via `get_remote_address`.

## Audit log

`audit_log` is append-only at the application layer:

- The only insertion path is `services/audit.record(...)`.
- No router or service issues `UPDATE` or `DELETE` against `audit_log`.
- Every entry stores `user_id`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `ip_address`, and `timestamp`.
- Every privileged write — login success / failure, review submission, credential change, item-availability toggle, demo-mode toggle — calls `audit.record`.

In production, a `REVOKE UPDATE, DELETE ON audit_log FROM tablebridge_app;` grant would enforce this at the DB level.

## Things this demo does *not* do (but real prod should)

- Real OAuth2 flows for DoorDash / Uber Eats / Grubhub / Toast — the demo just records placeholder API keys.
- mTLS or webhook IP allow-listing.
- Field-level encryption for in-transit Anthropic prompts (TLS only).
- A separate, network-segmented mock-services tier.
- Encryption key rotation tooling.
- Hardware security module (HSM) for the encryption key.
- Continuous secret scanning in CI.

These are explicitly listed as the gap between MVP and production so reviewers see the threat-model thinking.
