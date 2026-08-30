"""Does Guava accept an international (French, +33) destination?

Answers the question honestly: place the call, read back what the API says.
"""
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT.parent / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

import guava  # noqa: E402

FROM = os.environ["GUAVA_AGENT_NUMBER"]
TO = sys.argv[1] if len(sys.argv) > 1 else "+33759513020"

agent = guava.Agent(
    name="Claire",
    organization="Meridian Travel Cover",
    purpose="International reachability probe.",
)


@agent.on_call_start
def start(call):
    print(f"[on_call_start] connected -> {TO}", flush=True)
    call.set_task(
        "probe",
        objective="Say you are an automated assistant testing international "
                  "reachability, then end the call politely.",
    )


@agent.on_outbound_failed
def failed(call, event=None):
    print(f"[on_outbound_failed] {event!r}", flush=True)


@agent.on_session_end
def end(call, event):
    print(f"[on_session_end] reason={getattr(event, 'termination_reason', '?')}",
          flush=True)


print(f"placing {FROM} -> {TO} ...", flush=True)
t0 = time.time()
try:
    agent.call_phone(FROM, TO)
    print(f"call_phone returned after {time.time()-t0:.1f}s (no exception)")
except Exception as e:
    print(f"ERROR {type(e).__name__}: {str(e)[:600]}")
