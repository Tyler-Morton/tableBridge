"""AI order parser — uses Claude tool-use to map raw orders to Toast menu structure.

PII (customer name, phone, address) is stripped before any data is sent to Anthropic.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from anthropic import AsyncAnthropic
from anthropic.types import Message

from app.config import get_settings
from app.schemas.orders import IncomingOrder, ParsedOrderOut

logger = logging.getLogger(__name__)
settings = get_settings()

ALLERGY_VOCAB = [
    "nuts", "peanuts", "tree nuts", "gluten", "wheat", "dairy", "lactose",
    "shellfish", "fish", "eggs", "soy", "sesame",
]
DIETARY_VOCAB = ["vegan", "vegetarian", "halal", "kosher", "pescatarian"]


PARSE_TOOL = {
    "name": "submit_parsed_order",
    "description": (
        "Submit the structured interpretation of a delivery order, "
        "mapping each raw line item to the matching Toast menu item and modifiers. "
        "Use confidence < 0.85 for any item that is ambiguous, missing from the menu, "
        "or where modifiers can't be resolved."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "mapped_items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "raw_name": {"type": "string"},
                        "menu_item_id": {"type": ["integer", "null"]},
                        "menu_item_name": {"type": "string"},
                        "quantity": {"type": "integer"},
                        "modifiers": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "modifier_id": {"type": ["integer", "null"]},
                                    "modifier_name": {"type": "string"},
                                    "confidence": {"type": "number"},
                                    "note": {"type": ["string", "null"]},
                                },
                                "required": ["modifier_name", "confidence"],
                            },
                        },
                        "special_instructions": {"type": ["string", "null"]},
                        "confidence": {"type": "number"},
                        "needs_review": {"type": "boolean"},
                    },
                    "required": [
                        "raw_name", "menu_item_name", "quantity", "confidence",
                    ],
                },
            },
            "detected_allergies": {
                "type": "array", "items": {"type": "string"},
            },
            "detected_dietary": {
                "type": "array", "items": {"type": "string"},
            },
            "unmappable_notes": {
                "type": "array", "items": {"type": "string"},
            },
            "kitchen_note": {
                "type": ["string", "null"],
                "description": (
                    "Free-text note for the kitchen. Pre-populate this from the "
                    "order-level raw_special_instructions. Carry through anything "
                    "that affects how the kitchen prepares the order (e.g. "
                    "'EXTRA hot sauce', 'cut sandwich in half', 'on the side: ranch')."
                ),
            },
            "overall_confidence": {"type": "number"},
            "flagged_for_review": {"type": "boolean"},
        },
        "required": ["mapped_items", "overall_confidence", "flagged_for_review"],
    },
}


def _strip_pii(order: IncomingOrder) -> dict[str, Any]:
    """Remove customer name, phone, address before sending to Anthropic."""
    return {
        "platform": order.platform,
        "items": [
            {
                "raw_name": it.raw_name,
                "quantity": it.quantity,
                "raw_modifiers": it.raw_modifiers,
                "raw_special_instructions": it.raw_special_instructions,
            }
            for it in order.items
        ],
        "raw_special_instructions": order.raw_special_instructions,
    }


def _menu_context(menu: list[dict[str, Any]]) -> str:
    """Compact menu representation for the system prompt (token-efficient)."""
    lines: list[str] = []
    for cat in menu:
        lines.append(f"## {cat['name']}")
        for it in cat["items"]:
            tags = (
                f" [allergens: {','.join(it['allergen_tags'])}]"
                if it.get("allergen_tags")
                else ""
            )
            avail = "" if it["available"] else " (86'd)"
            lines.append(f"  [{it['id']}] {it['name']} — ${it['price']:.2f}{tags}{avail}")
            for grp in it.get("modifier_groups", []):
                mods = ", ".join(
                    f"[{m['id']}]{m['name']}" for m in grp["modifiers"] if m["available"]
                )
                if mods:
                    lines.append(f"     · {grp['name']}: {mods}")
    return "\n".join(lines)


SYSTEM_PROMPT = """You are TableBridge's AI order parser. Your job is to take a raw \
delivery-platform order and map it precisely to the restaurant's Toast POS menu structure.

Rules:
1. For each raw item, find the matching menu item (by id) and produce a clean menu_item_name.
2. Parse natural language: "no X", "extra X", "on the side", "light X", "well done", etc., \
into structured modifiers (mapped to modifier_id when possible).
3. Detect allergies — be AGGRESSIVE here, missing one is the worst possible failure. \
Standard vocabulary: nuts, peanuts, tree nuts, gluten, wheat, dairy, lactose, shellfish, \
fish, eggs, soy, sesame. Triggers to scan for: "allergic to", "allergy", "no X", \
"I can't have", "without", "severe", "anaphylactic", "DO NOT", "NEVER". \
ALSO important: \
- Scan BOTH per-item special instructions AND the order-level note. The order-level \
note (raw_special_instructions on the order) often contains the most critical allergy info. \
- If the customer mentions ANY food paired with "allergy" / "allergic" / "severe" — even \
items not in the standard top-12 list (e.g. tomato, onion, cilantro, mushroom, garlic) — \
include that food in detected_allergies. The kitchen needs to know. \
- "no onions — severe allergy" → include "onions" \
- "vegan, no dairy or eggs" → include "dairy" and "eggs" \
- Both can apply at once: include all of them.
4. Detect dietary preferences: vegan, vegetarian, halal, kosher, pescatarian.
5. Confidence (0-1) per item: 1.0 = exact match, 0.85+ = high confidence, <0.85 = needs review.
6. needs_review=true if confidence<0.85 OR an item can't be mapped OR modifier ambiguous.
7. Anything unmappable → unmappable_notes, set flagged_for_review=true.
8. overall_confidence = lowest item confidence (or weighted avg if you prefer); \
flagged_for_review=true when overall_confidence < 0.85 OR allergies detected.
9. ALWAYS pre-populate kitchen_note from the order-level raw_special_instructions \
verbatim (preserve original wording — kitchen needs to see it as the customer wrote it). \
If the order-level note is empty, set kitchen_note to null.
10. ALWAYS use the submit_parsed_order tool — never reply with prose."""


async def parse_order(
    incoming: IncomingOrder,
    menu: list[dict[str, Any]],
    *,
    confidence_threshold: float | None = None,
) -> tuple[ParsedOrderOut, int, int]:
    """Parse an incoming order into Toast-ready structured data.

    Returns (parsed_output, tokens_used, duration_ms).
    """
    threshold = confidence_threshold or settings.ai_confidence_threshold

    if not settings.anthropic_api_key:
        # Graceful fallback for local dev without an API key.
        return _heuristic_fallback(incoming, menu, threshold), 0, 0

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    sanitized = _strip_pii(incoming)

    # Hoist the order-level note so Claude can't miss it. This is the field
    # most likely to contain critical allergy info ("no onions — severe allergy",
    # "EXTRA hot sauce", etc.).
    order_note_block = (
        f"\n\n=== ORDER-LEVEL NOTE (read carefully — often has allergies) ===\n"
        f"{incoming.raw_special_instructions}\n"
        f"=== END ORDER NOTE ===\n"
        if incoming.raw_special_instructions
        else "\n\n(no order-level note)\n"
    )

    user_msg = (
        f"MENU:\n{_menu_context(menu)}\n\n"
        f"RAW ORDER (PII stripped):\n{json.dumps(sanitized, indent=2)}"
        f"{order_note_block}\n"
        "Reminder: pre-fill kitchen_note with the ORDER-LEVEL note above (verbatim). "
        "Scan BOTH the per-item special_instructions AND the order-level note for "
        "allergens — including non-top-12 ones (tomato, onion, mushroom, etc.) when "
        "paired with 'allergy' / 'allergic' / 'severe'. Then call submit_parsed_order."
    )

    start = time.perf_counter()
    try:
        message: Message = await client.messages.create(
            model=settings.ai_model,
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            tools=[PARSE_TOOL],  # type: ignore[list-item]
            tool_choice={"type": "tool", "name": "submit_parsed_order"},
            messages=[{"role": "user", "content": user_msg}],
        )
        duration_ms = int((time.perf_counter() - start) * 1000)
        tokens = message.usage.input_tokens + message.usage.output_tokens

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_parsed_order":
                payload = block.input  # already validated by Anthropic against schema
                parsed = ParsedOrderOut.model_validate(payload)
                # Safety net — never trust the model alone for allergies.
                # Run a regex sweep over EVERY text field and merge anything
                # the model missed. False positives are fine here; missing one
                # is not.
                _safety_net_allergies(parsed, incoming)
                # Enforce flag policy
                if parsed.overall_confidence < threshold or parsed.detected_allergies:
                    parsed.flagged_for_review = True
                return parsed, tokens, duration_ms

        logger.warning("Claude returned no tool_use block — falling back to heuristic parse.")
        return _heuristic_fallback(incoming, menu, threshold), tokens, duration_ms
    except Exception:  # noqa: BLE001
        logger.exception("AI parse failed — falling back to heuristic.")
        duration_ms = int((time.perf_counter() - start) * 1000)
        return _heuristic_fallback(incoming, menu, threshold), 0, duration_ms


def _heuristic_fallback(
    incoming: IncomingOrder, menu: list[dict[str, Any]], threshold: float
) -> ParsedOrderOut:
    """Pure-Python fallback — fuzzy name match. Used when Anthropic is unavailable."""
    flat_items = [it for cat in menu for it in cat["items"]]
    mapped = []
    confidences: list[float] = []
    detected_allergies: list[str] = []
    detected_dietary: list[str] = []
    unmappable: list[str] = []

    full_text = " ".join(
        [incoming.raw_special_instructions or ""]
        + [it.raw_special_instructions or "" for it in incoming.items]
        + [m for it in incoming.items for m in it.raw_modifiers]
    ).lower()
    has_allergy_keyword = "allerg" in full_text or "anaphyla" in full_text
    for term in ALLERGY_VOCAB:
        if term in full_text and (
            has_allergy_keyword or "no " in full_text or "without" in full_text
        ):
            detected_allergies.append(term)
    # If the customer literally says "allergy" but the allergen isn't in our
    # top-12 vocab (e.g. tomato, cilantro), still flag it. Try to extract the
    # word that follows "no", "allergic to", or precedes "allergy".
    if has_allergy_keyword and not detected_allergies:
        import re
        patterns = [
            r"allergic to\s+([a-z]+)",
            r"no\s+([a-z]+)\s*[—\-–]?\s*allerg",
            r"([a-z]+)\s+allerg",
        ]
        for pat in patterns:
            for match in re.findall(pat, full_text):
                term = match.strip()
                if term and term not in {"to", "the", "a", "an", "from", "is"}:
                    detected_allergies.append(term)
        if not detected_allergies:
            detected_allergies.append("unspecified")
    for term in DIETARY_VOCAB:
        if term in full_text:
            detected_dietary.append(term)

    for raw in incoming.items:
        # Best fuzzy match by token overlap
        best, score = None, 0.0
        raw_tokens = set(raw.raw_name.lower().split())
        for mi in flat_items:
            mi_tokens = set(mi["name"].lower().split())
            if not mi_tokens:
                continue
            overlap = len(raw_tokens & mi_tokens) / max(len(mi_tokens), 1)
            if overlap > score:
                best, score = mi, overlap

        if best and score >= 0.4:
            confidence = min(1.0, 0.5 + score / 2)
            mapped.append(
                {
                    "raw_name": raw.raw_name,
                    "menu_item_id": best["id"],
                    "menu_item_name": best["name"],
                    "quantity": raw.quantity,
                    "modifiers": [
                        {"modifier_id": None, "modifier_name": m, "confidence": 0.7, "note": None}
                        for m in raw.raw_modifiers
                    ],
                    "special_instructions": raw.raw_special_instructions,
                    "confidence": confidence,
                    "needs_review": confidence < threshold,
                }
            )
            confidences.append(confidence)
        else:
            unmappable.append(raw.raw_name)
            mapped.append(
                {
                    "raw_name": raw.raw_name,
                    "menu_item_id": None,
                    "menu_item_name": raw.raw_name,
                    "quantity": raw.quantity,
                    "modifiers": [],
                    "special_instructions": raw.raw_special_instructions,
                    "confidence": 0.4,
                    "needs_review": True,
                }
            )
            confidences.append(0.4)

    overall = min(confidences) if confidences else 0.0
    flagged = overall < threshold or bool(detected_allergies) or bool(unmappable)
    out = ParsedOrderOut(
        mapped_items=mapped,  # type: ignore[arg-type]
        detected_allergies=detected_allergies,
        detected_dietary=detected_dietary,
        unmappable_notes=unmappable,
        kitchen_note=incoming.raw_special_instructions,
        overall_confidence=overall,
        flagged_for_review=flagged,
    )
    _safety_net_allergies(out, incoming)
    return out


def _safety_net_allergies(parsed: ParsedOrderOut, incoming: IncomingOrder) -> None:
    """Server-side last-line-of-defense allergy sweep.

    Runs over EVERY text field in the order — order-level note, per-item
    special instructions, modifiers — and merges anything that looks like an
    allergy into parsed.detected_allergies. Idempotent. Mutates `parsed`.

    Catches:
      - Top-12 allergens that appear after "no", "without", "allergic to", etc.
      - Any food word adjacent to "allergy", "allergic", "severe", "anaphylactic"
      - Even items not in the standard list (tomato, onion, cilantro…).
    """
    import re

    fragments: list[str] = []
    if incoming.raw_special_instructions:
        fragments.append(incoming.raw_special_instructions)
    for it in incoming.items:
        if it.raw_special_instructions:
            fragments.append(it.raw_special_instructions)
        fragments.extend(it.raw_modifiers)
    text = " | ".join(fragments).lower()
    if not text:
        return

    found: set[str] = {a.lower().strip() for a in parsed.detected_allergies}

    has_allergy_keyword = bool(re.search(r"allerg|anaphyla|severe|do not", text))

    # Top-12 vocabulary scan — always catch these if any avoidance language present.
    for term in ALLERGY_VOCAB:
        if term in text and (
            has_allergy_keyword
            or re.search(rf"\bno\s+{re.escape(term)}", text)
            or re.search(rf"without\s+{re.escape(term)}", text)
        ):
            found.add(term)

    # Open-ended scan — capture food words paired with allergy language.
    stop = {
        "to", "the", "a", "an", "from", "is", "be", "with", "on",
        "of", "in", "for", "and", "or", "but", "not", "no", "any",
        "anything", "this", "that", "please", "thanks", "thank",
        "severe", "anaphylactic", "allergy", "allergic", "allergies",
        "have", "has", "do", "does", "i", "me", "my", "customer",
        "problem", "worries", "contact", "rush", "substitute", "swap",
        "changes", "modifications", "extra", "additional", "more",
    }
    if has_allergy_keyword:
        # Classic proximity patterns — food word close to allergy keyword.
        patterns = [
            r"allergic to ([a-z\-]+)",
            r"([a-z\-]+)\s+(?:severe\s+)?allerg",
            r"do not (?:contain|include|use)\s+([a-z\-]+)",
            r"severe ([a-z\-]+) allerg",
            r"anaphyla\w*\s+to\s+([a-z\-]+)",
        ]
        for pat in patterns:
            for raw in re.findall(pat, text):
                term = raw.strip(" -")
                if term and term not in stop and len(term) > 1:
                    found.add(term)

    # Per-fragment scan: if a FRAGMENT itself contains allergy language, pull
    # all "no X" patterns from that entire fragment regardless of word distance.
    # This catches "No onions on anything — severe allergy" where the food and
    # keyword are separated by several words.
    for fragment in fragments:
        frag = fragment.lower()
        if re.search(r"allerg|anaphyla|severe|do not", frag):
            for m in re.findall(r"\bno\s+([a-z\-]+)", frag):
                term = m.strip(" -")
                if term and term not in stop and len(term) > 2:
                    found.add(term)
            # Also catch "without X" in allergy-flagged fragments
            for m in re.findall(r"\bwithout\s+([a-z\-]+)", frag):
                term = m.strip(" -")
                if term and term not in stop and len(term) > 2:
                    found.add(term)

    parsed.detected_allergies = sorted(found)
    if parsed.detected_allergies:
        parsed.flagged_for_review = True
