import importlib.util
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path


SCRIPT = Path(__file__).with_name("publish_release_announcement.py")
SPEC = importlib.util.spec_from_file_location("publish_release_announcement", SCRIPT)
assert SPEC and SPEC.loader
publisher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publisher)


class Response:
    def __init__(self, payload=None):
        self.payload = payload or {"ok": True, "result": {"message_id": 1}}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self):
        return json.dumps(self.payload).encode()


class ReleaseAnnouncementTest(unittest.TestCase):
    def setUp(self):
        self.config = {
            "TELEGRAM_ENABLED": "true",
            "TELEGRAM_BOT_TOKEN": "telegram-token",
            "TELEGRAM_RELEASE_CHANNEL_ID": "@saluna",
            "BALE_ENABLED": "true",
            "BALE_BOT_TOKEN": "bale-token",
            "BALE_RELEASE_CHANNEL_ID": "@saluna",
        }

    def test_formats_persian_notes_and_rejects_blank_notes(self):
        notes = 'ویژگی «تقویم» اضافه شد.\nنشانی: https://saluna.ir/?a=1&b="دو"'
        message = publisher.format_message(notes)
        self.assertIn(notes, message)
        self.assertTrue(message.startswith("✨ به‌روزرسانی جدید سالونا\n\n"))
        with self.assertRaises(publisher.AnnouncementError):
            publisher.format_message("  ")
        with self.assertRaises(publisher.AnnouncementError):
            publisher.format_message("x" * (publisher.MAX_NOTES_LENGTH + 1))

    def test_sends_both_providers_once(self):
        requests = []

        def open_ok(request, timeout):
            self.assertEqual(timeout, 20)
            requests.append(request)
            return Response()

        with tempfile.TemporaryDirectory() as directory:
            args = dict(
                config=self.config,
                revision="abc123",
                apps="api,pwa",
                notes='ویژگی "جدید"',
                state_dir=Path(directory),
                opener=open_ok,
            )
            self.assertEqual(
                publisher.publish_release(**args),
                {"telegram": "sent", "bale": "sent"},
            )
            self.assertEqual(
                publisher.publish_release(**args),
                {"telegram": "already sent", "bale": "already sent"},
            )

        self.assertEqual(len(requests), 2)
        bodies = [json.loads(request.data.decode()) for request in requests]
        self.assertEqual([body["chat_id"] for body in bodies], ["@saluna", "@saluna"])
        self.assertIn('ویژگی "جدید"', bodies[0]["text"])

    def test_retry_only_sends_the_failed_provider(self):
        attempts = []

        def fail_bale(request, timeout):
            self.assertEqual(timeout, 20)
            attempts.append(request.full_url)
            if "tapi.bale.ai" in request.full_url:
                raise urllib.error.URLError("temporary failure")
            return Response()

        with tempfile.TemporaryDirectory() as directory:
            args = dict(
                config=self.config,
                revision="abc123",
                apps="web",
                notes="بهبود سرعت",
                state_dir=Path(directory),
            )
            first = publisher.publish_release(**args, opener=fail_bale)
            second = publisher.publish_release(
                **args, opener=lambda _request, timeout: Response()
            )

        self.assertEqual(first["telegram"], "sent")
        self.assertTrue(first["bale"].startswith("failed:"))
        self.assertEqual(second, {"telegram": "already sent", "bale": "sent"})
        self.assertEqual(len(attempts), 2)

    def test_skips_disabled_telegram(self):
        requests = []
        config = {
            "TELEGRAM_ENABLED": "false",
            "BALE_ENABLED": "true",
            "BALE_BOT_TOKEN": "bale-token",
            "BALE_RELEASE_CHANNEL_ID": "@saluna",
        }

        with tempfile.TemporaryDirectory() as directory:
            results = publisher.publish_release(
                config=config,
                revision="abc123",
                apps="pwa",
                notes="بهبود سرعت",
                state_dir=Path(directory),
                opener=lambda request, timeout: requests.append(request) or Response(),
            )

        self.assertEqual(results, {"telegram": "disabled", "bale": "sent"})
        self.assertEqual(len(requests), 1)
        self.assertIn("tapi.bale.ai", requests[0].full_url)

    def test_missing_configuration_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env.production"
            env_file.write_text(
                "TELEGRAM_ENABLED=false\n"
                "BALE_ENABLED=true\n"
                "BALE_BOT_TOKEN=token\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                publisher.AnnouncementError, "BALE_RELEASE_CHANNEL_ID"
            ):
                publisher.load_config(env_file)

    def test_load_config_only_requires_enabled_providers(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env.production"
            env_file.write_text(
                "TELEGRAM_ENABLED=false\n"
                "BALE_ENABLED=true\n"
                "BALE_BOT_TOKEN=token\n"
                "BALE_RELEASE_CHANNEL_ID=@saluna\n",
                encoding="utf-8",
            )

            self.assertEqual(
                publisher.load_config(env_file),
                {
                    "TELEGRAM_ENABLED": "false",
                    "BALE_ENABLED": "true",
                    "BALE_BOT_TOKEN": "token",
                    "BALE_RELEASE_CHANNEL_ID": "@saluna",
                },
            )


if __name__ == "__main__":
    unittest.main()
