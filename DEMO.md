# DEMO.md

A 5-minute scripted walkthrough for showing TableBridge to a restaurant owner or a recruiter. Read it like a script.

---

## Setup (do this 30 seconds before the demo starts)

1. `docker compose up -d` (or `make dev`).
2. Open `http://localhost:5173` and **sign in as Server** (PIN `9999`). Leave the dashboard up.
3. Confirm the iPad-shaped browser window is sized roughly 1024×768.

You should see the empty dashboard. Demo mode is on by default — the first mock order will land in 5–15 seconds.

---

## Act 1 — "The problem"

> "Here's the situation: a small restaurant signs up for delivery. DoorDash, Uber Eats, Grubhub. Three different tablets on the counter, each with its own beeping app. Every order has to be re-typed into the kitchen POS — Toast — by hand. The server reads from one screen and types into another. They miss things. They miss allergies."

Point at the empty Dashboard.

> "TableBridge replaces all three tablets with one screen, and uses an AI to do the re-typing."

---

## Act 2 — "An order comes in"

Wait for the alert — it auto-fires within 15 seconds of startup.

A red banner slides in from the top with a beeping chime.

> "DoorDash just sent an order. Notice — the chime won't stop until I tap the button. That's intentional. Servers ignore notifications when there's no friction."

Tap **Review Order**. Chime stops.

The screen splits in half:

> "Left side: the order exactly as the customer typed it on DoorDash. Special instructions, original wording. We do not throw any of this away.
>
> Right side: Claude's interpretation. Each line is mapped to an item on our actual Toast menu. Modifiers are parsed. The confidence score per line is shown — anything below 85% gets an orange 'Review' tag."

If the demo order has an allergy in the notes, point at the red banner:

> "Severe peanut allergy. The kitchen sees this in giant red letters on the ticket. That's the whole product right there."

Edit one item to show inline editing works.

Tap **Send to Kitchen**. The screen flips back to Dashboard with the order now in "Recent activity" tagged "Sent to kitchen."

---

## Act 3 — "What just happened on the kitchen side"

Click **Kitchen** in the top nav.

> "Toast is the POS. We just generated a kitchen ticket on it. Here's the ticket — customer first name, allergy callout in red, items in Toast's structured format with modifier groups."

This is the mock Toast running inside the same backend, pretending to be Toast Cloud.

---

## Act 4 — "The other half: 86'd item sync"

Open `http://localhost:8000/docs` in a second tab.

> "When the kitchen runs out of salmon, today the manager has to log into DoorDash, log into Uber Eats, log into Grubhub, and 86 the item in three places. Or they don't, and we get a complaint."

Use Swagger UI: `PATCH /toast/items/{id}` with `{"available": false}` for the Grilled Salmon.

Wait 30 seconds. Switch back to the frontend, go to **Settings → Sync log** (or hit `/sync/log` directly in the docs):

> "Within 30 seconds, the sync engine pushed the change to all three platforms. With retries on failure — 5 seconds, 30 seconds, 2 minutes. If everything fails, an alert pops on the dashboard."

---

## Act 5 — "Reports + settings"

Click **Reports**:

> "Orders per platform over the last 7 days. Average AI confidence — this is the number the operator should watch. Edit rate — how often servers had to override the AI. Allergy frequency over 30 days. CSV export for the accountant."

Click **Settings** (sign out and back in as Owner if needed):

> "Demo mode toggle. AI confidence threshold slider — drag it up to be more conservative. Encrypted credentials store — every API key is AES-256-GCM encrypted at rest, never echoed back to the UI. Audit log shows every privileged action with timestamp, user, and IP."

---

## Act 6 — "Why this matters technically"

> "Every external API in this demo is mocked, but the contracts match. To go to production you change four base URLs and add real OAuth credentials. Nothing else moves. The unified order schema, the AI parser, the review UI, the sync engine — all unchanged.
>
> The whole stack is async Python with FastAPI, SQLAlchemy 2.0, Pydantic v2 strict mode. Frontend is React strict TypeScript with Tailwind. Webhooks are HMAC-signed. The AI parser strips PII before any data touches Anthropic. The audit log is append-only at the application layer.
>
> One command to run it all: `docker compose up`."

---

## Things to point at if asked

- **"How does the AI part actually work?"** Open `backend/app/services/ai_parser.py`. Show the tool-use schema — Claude *must* return structured data via the `submit_parsed_order` tool. No prose. Confidence is per-item.
- **"What about PII?"** Open `_strip_pii`. Customer name and phone are scrubbed before the prompt is built.
- **"What if the API is down?"** Show the heuristic fallback at the bottom of `ai_parser.py` — fuzzy token-overlap matching. Never blocks a webhook from being accepted.
- **"What's stopping someone from forging a webhook?"** Open `routers/webhooks.py`. HMAC verify with `compare_digest`, plus a 5-minute timestamp window, plus a unique constraint on `(platform, external_order_id)`.
- **"How would you scale this?"** Replace SQLite with Postgres (one env var). Replace APScheduler with Celery (same task functions). Replace the in-process mock services with real HTTP clients (same normalizers).

---

## Recovery if the demo breaks

- **Nothing happens after login**: demo mode might be off — go to Settings, toggle it on. Or `curl http://localhost:8000/health` to check the backend.
- **Beeping won't stop**: tap "Review Order" or refresh the page.
- **AI parse hangs**: check `ANTHROPIC_API_KEY` in `.env`. If unset, the heuristic fallback runs instead — slightly less impressive output but the demo still completes.
- **Database wedged**: `make clean && make seed`.
