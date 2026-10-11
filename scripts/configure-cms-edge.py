#!/usr/bin/env python3
"""Prepare Arvan's CMS cache rules and first-administrator setup guard."""

import argparse
import ipaddress
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request


DOMAIN = "saluna.ir"
API = f"https://napi.arvancloud.ir/cdn/4.0/domains/{DOMAIN}"
PATTERNS = [f"{DOMAIN}/{prefix}*" for prefix in ("_emdash", "blog", "guides")]
GUARD = "Saluna EmDash initial setup"
# Keep setup/status available for deployment health checks. Only bootstrap writes
# are restricted; normal login, invitations and media remain available.
SETUP_FILTER = (
    'http.host == "saluna.ir" and '
    'http.request.uri.path matches "^/_emdash/api/(setup|auth/oauth)(/|$)" and '
    'http.request.uri.path != "/_emdash/api/setup/status"'
)


def api_key(env_file):
    key = os.environ.get("ARVAN_API_KEY")
    if not key:
        for line in Path(env_file).read_text().splitlines():
            if line.strip().startswith("ARVAN_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("\"'")
    if not key:
        raise ValueError("ARVAN_API_KEY is missing")
    return key if key.lower().startswith("apikey ") else "Apikey " + key


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["plan", "prepare", "bootstrap", "release"])
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--ip", help="Operator's public IP for the bootstrap window")
    parser.add_argument("--backup-dir", default=".codex/deploy/cms-edge")
    args = parser.parse_args()
    if args.action == "bootstrap" and not args.ip:
        parser.error("bootstrap requires --ip")
    operator_ip = str(ipaddress.ip_address(args.ip)) if args.ip else None
    key = api_key(args.env_file)

    def request(path, method="GET", body=None):
        req = urllib.request.Request(
            API + path,
            method=method,
            headers={"Authorization": key, "Accept": "application/json", "Content-Type": "application/json"},
            data=json.dumps(body).encode() if body is not None else None,
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as response:
                return json.load(response) if response.status != 204 else {}
        except urllib.error.HTTPError as error:
            # Never print request headers, credentials or arbitrary API responses.
            raise RuntimeError(f"Arvan {method} {path} returned HTTP {error.code}") from None

    pages = request("/page-rules?per_page=100")["data"]
    rules = request("/firewall/rules?per_page=100")["data"]
    guards = [rule for rule in rules if rule["name"] == GUARD]
    if len(guards) > 1:
        raise ValueError("Multiple setup guards found; resolve them before continuing")
    if args.action == "plan":
        for pattern in PATTERNS:
            matches = [page for page in pages if page["url"] == pattern]
            print(pattern, "configured" if matches and matches[0]["cache_level"] == "off" and matches[0]["status"] else "needs preparation")
        print("Setup guard:", "enabled" if guards and guards[0]["is_enabled"] else "disabled or missing")
        return

    if args.action == "release":
        with urllib.request.urlopen(f"https://{DOMAIN}/_emdash/api/setup/status", timeout=15) as response:
            status = json.load(response)["data"]
        if status.get("needsSetup") is not False:
            raise ValueError("Initial administrator setup is incomplete; keep the guard enabled")

    backup = Path(args.backup_dir)
    backup.mkdir(parents=True, exist_ok=True, mode=0o700)
    snapshot = backup / "before.json"
    # Retain the original configuration, including after retries.
    if not snapshot.exists():
        with snapshot.open("x") as output:
            os.chmod(snapshot, 0o600)
            json.dump({"page_rules": pages, "firewall_rules": rules}, output, indent=2)

    if args.action == "prepare":
        missing = [pattern for pattern in PATTERNS if not any(page["url"] == pattern for page in pages)]
        # The basic plan includes five custom rules. Never create billable extras.
        if len([page for page in pages if not page.get("is_protected")]) + len(missing) > 5:
            raise ValueError("CMS rules would exceed the five included page rules")
        for pattern in PATTERNS:
            matches = [page for page in pages if page["url"] == pattern]
            if matches:
                if len(matches) != 1 or matches[0]["cache_level"] != "off" or not matches[0]["status"]:
                    raise ValueError(f"Conflicting existing page rule for {pattern}")
                print("Already configured:", pattern)
                continue
            request("/page-rules", "POST", {
                "url": pattern, "seq": max((page["seq"] for page in pages), default=0) + 1,
                "cache_level": "off", "cache_200": "0s", "cache_any": "0s",
                "cache_browser": "default", "status": True,
            })
            pages = request("/page-rules?per_page=100")["data"]
            print("Disabled CDN caching:", pattern)

    if args.action == "prepare" and guards:
        if not guards[0]["is_enabled"]:
            raise ValueError("Setup guard was released already; do not relock an initialized site")
        existing_filter = guards[0]["filter_expr"]
        if existing_filter == SETUP_FILTER:
            print("Setup guard already enabled")
            return
        if " and ip.src != " in existing_filter:
            operator_ip = str(ipaddress.ip_address(existing_filter.rsplit(" and ip.src != ", 1)[1]))
    if args.action != "prepare" and not guards:
        raise ValueError("Run prepare before changing the setup guard")
    firewall = {
        "name": GUARD, "filter_expr": SETUP_FILTER,
        "action": "deny", "is_enabled": args.action != "release",
        "note": "Prepared before CMS deployment. Restricts initial setup writes only.",
    }
    if operator_ip:
        firewall["filter_expr"] += f" and ip.src != {operator_ip}"
    if len(firewall["filter_expr"]) > 250:
        raise ValueError("Setup guard exceeds the basic-plan expression limit")
    if guards:
        request(f'/firewall/rules/{guards[0]["id"]}', "PATCH", firewall)
    else:
        request("/firewall/rules", "POST", firewall)
    print("Setup guard:", "released" if args.action == "release" else "operator IP permitted" if operator_ip else "locked until bootstrap")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
