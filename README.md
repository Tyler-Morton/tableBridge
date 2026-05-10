# TableBridge

> AI-powered middleware that connects DoorDash, Uber Eats, and Grubhub to a Toast POS — so restaurants stop juggling three tablets and stop missing allergy notes.

TableBridge is a portfolio MVP demonstrating a production-shaped restaurant integration platform. Delivery orders flow in from three platforms, get parsed by **Claude Sonnet 4** into the restaurant's actual Toast menu schema, surface to a tablet for human review (with allergy detection and confidence scoring), and fire to the kitchen. It also keeps 86'd-item availability synced both directions across all three platforms.

Everything runs locally with mock APIs — no real platform credentials needed. The architecture is production-shaped: swapping in real APIs only requires changing a few base URLs.

---

## Highlights

- **Async FastAPI backend** (Python 3.11, SQLAlchemy 2.0, Pydantic v2 strict) with mock implementations of DoorDash, Uber Eats, Grubhub, and Toast
- **Claude Sonnet 4 with tool-use** for guaranteed structured output — maps free-text orders to menu items + modifiers with per-line confidence scoring
- **Server-side regex safety net** for allergies — Claude detects them, but a deterministic post-processor double-checks every text field, because missing an allergy is the worst possible failure
- **PII stripped** before any data hits Anthropic — customer name, phone, and address never leave the box
- **Real-time WebSocket** push to the tablet UI with looping audio alert that won't stop until acknowledged
- **Two-way 86'd-item sync** with exponential backoff retry (5s → 30s → 2min) and 15-minute reconciliation pass
- **Production-realistic security**: HMAC webhook signatures, 5-minute replay window, idempotency, AES-256-GCM at-rest encryption, Argon2id password + PIN hashing, rotated JWT refresh tokens, role-based access, append-only audit log, slowapi rate limiting, CSP headers
- **React 18 + TypeScript strict** frontend with Tailwind, TanStack Query, Zustand
- **One-command startup** via Docker Compose; auto-seeds a sample restaurant + 3 users + ~14 menu items on first boot

## Architecture

```
        ┌────────────────────────────────────┐
        │  Mock Order Generator (APScheduler)│  ◄── runs every 30–90s in demo mode
        └────────────┬───────────────────────┘
                     │ HMAC-signed webhook
                     ▼
   /webhooks/{doordash,ubereats,grubhub}
                     │
        ┌────────────▼─────────────┐    ┌────────────────────────┐
        │   FastAPI Backend        │───►│  Anthropic Claude      │
        │   • HMAC + replay verify │    │  (tool-use, PII-stripped)│
        │   • Idempotency          │    └────────────┬───────────┘
        │   • Persist raw + parsed │◄────────────────┘
        └─────┬──────────────┬─────┘
              │ ws broadcast │
              ▼              ▼
   ┌──────────────────┐  ┌──────────────────┐
   │  Tablet Frontend │  │  Mock Toast POS  │
   │  Side-by-side    │──►  /toast/orders   │
   │  review screen   │  │  /toast/menu     │
   └──────────────────┘  └────────┬─────────┘
                                  │ kitchen ticket
                                  ▼
                       Kitchen Display screen

   86'd two-way sync ──► all 3 platforms (every 30s)
   Reconciliation pass (every 15m)
```

## Tech stack

**Backend:** Python 3.11 · FastAPI · SQLAlchemy 2.0 (async) · SQLite + aiosqlite · Pydantic v2 (strict) · Anthropic SDK · APScheduler · slowapi · Argon2 · cryptography (AES-256-GCM) · python-jose (JWT)

**Frontend:** React 18 · Vite · TypeScript (strict mode) · TailwindCSS · Zustand · TanStack Query · Native WebSocket API · Web Audio API · lucide-react

**Tooling:** Docker Compose · pytest · vitest · ruff · mypy · ESLint · Prettier

---

## Quick start

### Option 1 — Docker (one command)

```bash
git clone https://github.com/<your-username>/tablebridge.git
cd tablebridge
cp .env.example .env

# Generate the two required secrets:
python3 -c "import secrets; print('ENCRYPTION_KEY=' + secrets.token_hex(32)); print('JWT_SECRET_KEY=' + secrets.token_hex(32))"

# Paste those into .env. Add ANTHROPIC_API_KEY if you have one (optional —
# the parser falls back to a fuzzy-match heuristic without it).

docker compose up --build
```

Open `http://localhost:5173`.

### Option 2 — Local without Docker

Requires Python 3.11+ and Node 20+.

```bash
make install     # installs Python + Node deps
make dev         # runs FastAPI on :8000 and Vite on :5173 in parallel
```

### Demo accounts

| Role    | Email                       | Password         | PIN  |
| ------- | --------------------------- | ---------------- | ---- |
| Owner   | `owner@tablebridge.demo`    | `OwnerPass!2024` | 1234 |
| Manager | `manager@tablebridge.demo`  | `ManagerPass!2024` | 5678 |
| Server  | `server@tablebridge.demo`   | `ServerPass!2024` | 9999 |

---

## Demo walkthrough

1. **Sign in as the server** (PIN `9999`) on the iPad-shaped frontend.
2. **Wait 5–15 seconds** — demo mode pumps the first mock order through.
3. **A red banner slides in with a beeping chime.** The chime stops only when you tap **Review Order** — designed friction, because servers ignore frictionless notifications.
4. **The Review screen** is the headline UX:
   - **Left:** the raw order as it arrived from the platform — original wording preserved, read-only.
   - **Right:** Claude's interpretation — items mapped to your Toast menu, modifiers parsed, **red allergy banner** if it detected any allergens (anywhere in the order, not just standard items), confidence scores per line, inline-editable.
5. Tap **Send to Kitchen** → fires to the mock Toast POS.
6. Switch to **Kitchen Display** to see the fired ticket with allergy callouts and the kitchen note.
7. Open **Reports** for orders/day per platform, average AI confidence, edit rate, allergy frequency, CSV export.
8. As Owner/Manager, open **Settings** → toggle demo mode, slide the AI confidence threshold, view encrypted credentials store, browse the audit log.
9. **Test the 86'd sync engine:** open `localhost:8000/docs`, PATCH any item to `available: false`. Within 30s the sync engine pushes the change to all three mock platforms with retries and exponential backoff.

---

## How to take this to production

The architecture is designed so that *only* these things change:

| Layer | Demo (today) | Production |
| --- | --- | --- |
| **DoorDash** | `services/mock_doordash.py` | Real DoorDash Drive API calls — webhook normalizer is unchanged |
| **Uber Eats** | `services/mock_ubereats.py` | Point at `api.uber.com`, add OAuth2 |
| **Grubhub** | `services/mock_grubhub.py` | Point at `api-gtm.grubhub.com`, add OAuth |
| **Toast** | `services/mock_toast.py` + `routers/mock_toast.py` | `httpx` calls to `ws-api.toasttab.com` — schema mapping in the AI parser does not change |
| **Webhook secrets** | `.env` placeholders | Real signing secrets from each platform dashboard |
| **Database** | SQLite | Postgres — change `DATABASE_URL`, run `alembic upgrade head` |
| **Scheduler** | APScheduler in-process | Celery / RQ / external worker — same task functions |

The unified `IncomingOrder` schema, Claude parser, review UI, sync engine, and Toast firing logic are unchanged between demo and production.

---

## Project layout

```
tablebridge/
├── backend/                        FastAPI service
│   ├── app/
│   │   ├── main.py                 app entry + lifespan + WS endpoint
│   │   ├── config.py               Pydantic settings
│   │   ├── database.py             async SQLAlchemy
│   │   ├── security.py             JWT, Argon2, HMAC
│   │   ├── dependencies.py         auth + role gates
│   │   ├── websockets.py           tablet broadcast
│   │   ├── scheduler.py            APScheduler bootstrap
│   │   ├── models/                 SQLAlchemy ORM
│   │   ├── schemas/                Pydantic v2 strict
│   │   ├── routers/                auth, webhooks, orders, reviews, sync, reports, settings, mock_toast
│   │   └── services/
│   │       ├── ai_parser.py        Claude tool-use + PII stripper + safety-net regex
│   │       ├── encryption.py       AES-256-GCM
│   │       ├── audit.py            append-only audit log
│   │       ├── platform_sync.py    86'd two-way sync + reconcile
│   │       ├── mock_orders.py      demo generator
│   │       └── mock_{doordash,ubereats,grubhub,toast}.py
│   ├── seed_data.py                idempotent seed (auto-runs on first boot)
│   └── tests/                      pytest — webhook intake, AI fallback, encryption, HMAC, idempotency, auth flow
├── frontend/                       Vite + React + TypeScript
│   └── src/
│       ├── App.tsx                 router + protected shell
│       ├── routes/                 Login, Dashboard, ReviewOrder, KitchenDisplay, History, Reports, Settings
│       ├── components/             OrderAlert, SideBySidePanel, EditableItem, AllergyBanner, ConfidenceTag, PlatformBadge
│       ├── hooks/                  useAuth, useWebSocket, useAudio
│       └── stores/                 Zustand
├── docker-compose.yml
├── Makefile                        make dev / install / test / seed
├── README.md                       you are here
├── SECURITY.md                     threat model + mitigations
└── DEMO.md                         5-minute scripted walkthrough
```

---

## Tests

```bash
make test
```

Backend (pytest): auth flow · encryption round-trip · HMAC + 5-minute replay · webhook idempotency · AI parser fallback path · all three mock-platform normalizers
Frontend (vitest): component-level tests for PlatformBadge, AllergyBanner, ConfidenceTag

## API surface

OpenAPI docs auto-generated at `http://localhost:8000/docs`. Highlights:

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/login` | email + password |
| `POST` | `/auth/pin-login` | email + 4-digit PIN |
| `POST` | `/auth/refresh` | rotates refresh token |
| `GET`  | `/orders` | paginated, filter by platform / flagged / status |
| `GET`  | `/orders/{raw_id}` | raw + parsed for the review screen |
| `POST` | `/reviews` | send / flag / reject |
| `WS`   | `/ws/orders?token=…` | new_order, sync_alert, kitchen_ticket events |
| `POST` | `/webhooks/{platform}` | HMAC-signed, replay-protected |
| `GET`  | `/toast/menu` | mock POS menu |
| `PATCH`| `/toast/items/{id}` | mark item 86'd / restored |
| `GET`  | `/reports/summary` | dashboard metrics |
| `GET`  | `/reports/orders.csv` | CSV export |

---

## Documentation

- [SECURITY.md](./SECURITY.md) — threat model with explicit attack vectors and mitigations
- [DEMO.md](./DEMO.md) — 5-minute scripted walkthrough for demoing this to a recruiter or restaurant owner

## License

[MIT](./LICENSE)
