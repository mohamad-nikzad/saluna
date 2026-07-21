#!/usr/bin/env python3
"""Publish one release announcement to the Saluna Telegram and Bale channels."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable


MAX_NOTES_LENGTH = 3500
PROVIDERS = {
    "telegram": (
        "TELEGRAM_ENABLED",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_RELEASE_CHANNEL_ID",
        "https://api.telegram.org",
    ),
    "bale": (
        "BALE_ENABLED",
        "BALE_BOT_TOKEN",
        "BALE_RELEASE_CHANNEL_ID",
        "https://tapi.bale.ai",
    ),
}


class AnnouncementError(Exception):
    pass


def format_message(notes: str) -> str:
    notes = notes.strip()
    if not notes:
        raise AnnouncementError("Release notes are required when announcing a release.")
    if len(notes) > MAX_NOTES_LENGTH:
        raise AnnouncementError(
            f"Release notes must be at most {MAX_NOTES_LENGTH} characters."
        )
    return f"✨ به‌روزرسانی جدید سالونا\n\n{notes}\n\nمشاهده سالونا:\nhttps://saluna.ir"


def load_config(env_file: Path) -> dict[str, str]:
    if not env_file.is_file():
        raise AnnouncementError(f"Missing environment file: {env_file}")

    values: dict[str, str] = {}
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.removeprefix("export ").split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value

    config: dict[str, str] = {}
    missing: list[str] = []
    enabled_count = 0
    for enabled_key, token_key, channel_key, _ in PROVIDERS.values():
        enabled = os.environ.get(enabled_key, values.get(enabled_key, "false")).strip().lower()
        if enabled not in {"true", "false"}:
            raise AnnouncementError(f"{enabled_key} must be true or false.")
        config[enabled_key] = enabled
        if enabled == "false":
            continue
        enabled_count += 1
        for key in (token_key, channel_key):
            value = os.environ.get(key, values.get(key, "")).strip()
            if value:
                config[key] = value
            else:
                missing.append(key)
    if missing:
        raise AnnouncementError(
            "Missing release announcement configuration: " + ", ".join(missing)
        )
    if enabled_count == 0:
        raise AnnouncementError("No release announcement provider is enabled.")
    return config


def announcement_key(revision: str, apps: str, notes: str) -> str:
    value = "\0".join((revision.strip(), apps.strip(), notes.strip()))
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def publish_release(
    *,
    config: dict[str, str],
    revision: str,
    apps: str,
    notes: str,
    state_dir: Path,
    opener: Callable[..., object] | None = None,
) -> dict[str, str]:
    message = format_message(notes)
    key = announcement_key(revision, apps, notes)
    release_dir = state_dir / key
    release_dir.mkdir(parents=True, exist_ok=True)
    open_url = opener or urllib.request.urlopen
    results: dict[str, str] = {}

    for provider, (enabled_key, token_key, channel_key, api_base) in PROVIDERS.items():
        if config[enabled_key] == "false":
            results[provider] = "disabled"
            continue
        marker = release_dir / f"{provider}.sent"
        if marker.exists():
            results[provider] = "already sent"
            continue

        request = urllib.request.Request(
            f"{api_base}/bot{config[token_key]}/sendMessage",
            data=json.dumps(
                {"chat_id": config[channel_key], "text": message},
                ensure_ascii=False,
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with open_url(request, timeout=20) as response:  # type: ignore[attr-defined]
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, dict) or payload.get("ok") is not True:
                description = (
                    payload.get("description", "API returned ok=false")
                    if isinstance(payload, dict)
                    else "API returned an invalid response"
                )
                raise AnnouncementError(str(description))
        except (AnnouncementError, OSError, ValueError) as error:
            results[provider] = f"failed: {error}"
            continue

        marker.write_text("sent\n", encoding="utf-8")
        results[provider] = "sent"

    return results


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env-file",
        type=Path,
        default=Path("/opt/saluna/.env.production"),
    )
    parser.add_argument(
        "--state-dir",
        type=Path,
        default=Path("/opt/saluna/release-announcements"),
    )
    parser.add_argument("--revision", required=True)
    parser.add_argument("--apps", required=True)
    parser.add_argument("--notes", required=True)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        message = format_message(args.notes)
        config = load_config(args.env_file)
        if args.dry_run:
            print(message)
            enabled = [
                provider
                for provider, (enabled_key, *_rest) in PROVIDERS.items()
                if config[enabled_key] == "true"
            ]
            print(f"\nDry run: configuration is present for {', '.join(enabled)}.")
            return 0
        results = publish_release(
            config=config,
            revision=args.revision,
            apps=args.apps,
            notes=args.notes,
            state_dir=args.state_dir,
        )
    except AnnouncementError as error:
        print(f"Release announcement failed: {error}", file=sys.stderr)
        return 1

    for provider, result in results.items():
        print(f"{provider}: {result}")
    return 1 if any(result.startswith("failed:") for result in results.values()) else 0


if __name__ == "__main__":
    raise SystemExit(main())
