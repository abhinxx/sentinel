"""REST API for the Sentinel dashboard.

Stdlib only. Mounted onto the same HTTPServer that serves the SSE stream
(`GET /events`) in run_live.py — see `handle_api()`.

Endpoints (all CORS `*`, all OPTIONS-preflightable):
  GET  /api/health
  GET  /api/packs
  GET  /api/packs/<pack_id>
  GET  /api/calls                          -> proxy Guava conversations
  GET  /api/calls/<call_id>/transcript     -> proxy Guava transcript
  POST /api/call   {"to_number": "+1..."}  -> REAL outbound call
"""
from __future__ import annotations

import json
import os
import re
import threading
import urllib.error
import urllib.request
from pathlib import Path

PACKS_DIR = Path(__file__).parent / "packs"
GUAVA_BASE = "https://app.goguava.ai/v1"
E164 = re.compile(r"^\+[1-9][0-9]{7,14}$")

# Set by run_live.main(); the handler needs the live objects.
LIVE_PACK = None   # type: ignore[var-annotated]
LIVE_AGENT = None  # type: ignore[var-annotated]


def set_live(pack=None, agent=None) -> None:
    global LIVE_PACK, LIVE_AGENT
    LIVE_PACK, LIVE_AGENT = pack, agent


# ------------------------------------------------------------------ guava proxy
def _guava_get(path: str) -> tuple[int, dict]:
    """GET the Guava REST API. Never leaks the API key into the response."""
    key = os.environ.get("GUAVA_API_KEY", "")
    if not key:
        return 200, {"conversations": [], "error": "GUAVA_API_KEY not set"}
    req = urllib.request.Request(
        f"{GUAVA_BASE}{path}",
        headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode("utf-8", "replace")
        try:
            return 200, json.loads(body)
        except json.JSONDecodeError:
            return 200, {"conversations": [], "error": "non-JSON upstream response"}
    except urllib.error.HTTPError as e:
        return 200, {"conversations": [], "error": f"upstream HTTP {e.code}"}
    except Exception as e:  # noqa: BLE001 - degrade gracefully for the UI
        return 200, {"conversations": [], "error": f"{type(e).__name__}: {e}"}


# ------------------------------------------------------------------ packs
def _pack_summary(raw: dict) -> dict:
    policy = raw.get("policy", {}) or {}
    return {
        "pack_id": raw.get("pack_id"),
        "product": raw.get("product"),
        "insurer": raw.get("insurer"),
        "policy_id": policy.get("policy_id"),
        "holder": policy.get("holder"),
        "currency": raw.get("currency"),
        "coverages_count": len(policy.get("coverages", {}) or {}),
        "rules_count": len(raw.get("rules", []) or []),
    }


def _list_packs() -> list[dict]:
    out = []
    for p in sorted(PACKS_DIR.glob("*.json")):
        try:
            out.append(_pack_summary(json.loads(p.read_text())))
        except Exception:  # noqa: BLE001 - skip unreadable packs
            continue
    return out


def _read_pack(pack_id: str) -> dict | None:
    path = PACKS_DIR / f"{pack_id}.json"
    if not path.is_file() or path.parent != PACKS_DIR:
        return None
    try:
        return json.loads(path.read_text())
    except Exception:  # noqa: BLE001
        return None


# ------------------------------------------------------------------ outbound call
def _place_call(to_number: str) -> None:
    def run():
        try:
            LIVE_AGENT.call_phone(
                from_number=os.environ["GUAVA_AGENT_NUMBER"], to_number=to_number
            )
        except Exception as e:  # noqa: BLE001
            print(f"[api] outbound call failed: {type(e).__name__}: {e}")

    threading.Thread(target=run, daemon=True).start()


# ------------------------------------------------------------------ dispatch
def handle_api(h) -> bool:
    """Handle an /api/* request on BaseHTTPRequestHandler `h`.

    Returns True if the request was handled (including OPTIONS preflight).
    """
    path = h.path.split("?", 1)[0].rstrip("/") or "/"
    if not path.startswith("/api"):
        return False

    if h.command == "OPTIONS":
        _send(h, 204, None)
        return True

    if h.command == "GET":
        if path == "/api/health":
            return _send(h, 200, {
                "ok": True,
                "pack": LIVE_PACK.pack_id if LIVE_PACK is not None else None,
                "agent_number": os.environ.get("GUAVA_AGENT_NUMBER"),
            })
        if path == "/api/packs":
            return _send(h, 200, _list_packs())
        if path.startswith("/api/packs/"):
            pack = _read_pack(path[len("/api/packs/"):])
            return _send(h, 200, pack) if pack else _send(
                h, 404, {"ok": False, "error": "pack not found"})
        if path == "/api/calls":
            code, body = _guava_get("/conversations")
            return _send(h, code, body)
        m = re.fullmatch(r"/api/calls/([^/]+)/transcript", path)
        if m:
            code, body = _guava_get(f"/conversations/{m.group(1)}/transcript")
            return _send(h, code, body)
        return _send(h, 404, {"ok": False, "error": "not found"})

    if h.command == "POST" and path == "/api/call":
        try:
            n = int(h.headers.get("Content-Length") or 0)
            payload = json.loads(h.rfile.read(n) or b"{}")
        except Exception:  # noqa: BLE001
            return _send(h, 400, {"ok": False, "error": "invalid JSON body"})
        to = (payload.get("to_number") or "").strip()
        if not E164.match(to):
            return _send(h, 400, {
                "ok": False,
                "error": "to_number must be E.164, e.g. +14155550123",
            })
        if LIVE_AGENT is None:
            return _send(h, 400, {"ok": False, "error": "no live agent configured"})
        if not os.environ.get("GUAVA_AGENT_NUMBER"):
            return _send(h, 400, {"ok": False, "error": "GUAVA_AGENT_NUMBER not set"})
        _place_call(to)
        return _send(h, 200, {"ok": True, "to": to})

    return _send(h, 404, {"ok": False, "error": "not found"})


def _send(h, code: int, body) -> bool:
    data = b"" if body is None else json.dumps(body).encode()
    h.send_response(code)
    if body is not None:
        h.send_header("Content-Type", "application/json")
        h.send_header("Content-Length", str(len(data)))
    h.send_header("Access-Control-Allow-Origin", "*")
    h.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    h.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    h.end_headers()
    if data:
        h.wfile.write(data)
    return True
