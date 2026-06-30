"""
Groq API key diagnostic.

Run this from the SAME directory and the SAME environment (shell / container)
that starts your server:

    python debug_groq.py

It tells you (a) exactly which GROQ_API_KEY your app actually uses, (b) whether
an OS env var is silently overriding your .env, (c) whether the key has hidden
characters, and (d) what Groq itself says when you use that key.

Nothing here is destructive and it never prints your full key.
"""
import os
import urllib.request
import urllib.error


def mask(k):
    if not k:
        return "(empty)"
    if len(k) <= 12:
        return f"{k[:2]}…{k[-2:]}  (len={len(k)})"
    return f"{k[:6]}…{k[-4:]}  (len={len(k)})"


# 1) What is already in the OS environment, BEFORE we load .env?
os_key = os.environ.get("GROQ_API_KEY")
print("1) OS env GROQ_API_KEY (before .env):",
      mask(os_key) if os_key is not None else "(not set)")

# 2) What does the .env file on disk actually contain?
file_key = None
try:
    from dotenv import dotenv_values, find_dotenv
    path = find_dotenv(usecwd=True)
    print("2) .env located at:", path or "(NONE found from current working dir!)")
    vals = dotenv_values(path) if path else {}
    file_key = vals.get("GROQ_API_KEY")
    print("   .env GROQ_API_KEY:",
          mask(file_key) if file_key is not None else "(GROQ_API_KEY not in .env)")
except ImportError:
    print("2) python-dotenv not installed — skipping .env inspection")

# 3) The override gotcha (the #1 'looks right but isn't' cause)
if os_key and file_key and os_key.strip() != file_key.strip():
    print("\n>>> SMOKING GUN: OS env and .env contain DIFFERENT keys.")
    print(">>> load_dotenv() does NOT override existing OS vars by default,")
    print(">>> so your app uses the OS one and ignores the .env one.")
    print(">>> Fix: remove the OS var (unset GROQ_API_KEY / fix the host dashboard),")
    print(">>>      or change your code to load_dotenv(override=True).")

# 4) Reveal hidden characters in whatever key the app will actually use
raw = os_key if os_key else (file_key or "")
key = raw.strip().strip("'\"").strip()
print("\n4) repr of raw key value:", repr(raw))
print("   starts with 'gsk_':", key.startswith("gsk_"))
hidden = [(i, hex(ord(c))) for i, c in enumerate(raw)
          if ord(c) > 126 or (c.isspace() and c != " ")]
print("   hidden / non-ascii chars:", hidden if hidden else "none")

# 5) Ask Groq directly with that exact (cleaned) key
print("\n5) live test against Groq /models ...")
if not key:
    print("   no key to test.")
else:
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/models",
        headers={"Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print(f"   HTTP {resp.status} — key is VALID.")
            print("   => The key is fine. Your app is passing a DIFFERENT value")
            print("      than this script (check load order / caching / wrong dir).")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:400]
        print(f"   HTTP {e.code}")
        print("   Groq says:", body)
        print("   => This exact key is rejected. Create a fresh one at")
        print("      https://console.groq.com/keys")
    except Exception as e:
        print("   request failed (network?):", e)