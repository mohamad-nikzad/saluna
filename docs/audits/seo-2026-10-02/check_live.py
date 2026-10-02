"""Read-only public SEO audit. Requires Python 3 and curl on PATH.

Run: python docs/audits/seo-2026-10-02/check_live.py
Writes evidence.json beside this script; does not change the website.
"""

import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

ORIGIN = "https://saluna.ir"
DEST = pathlib.Path(__file__).resolve().parent


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.links, self.images, self.resources = [], [], [], []
        self.schema, self.headings, self.text, self.title = [], [], [], []
        self.lang, self.direction = None, None
        self.in_body = False
        self.capture = None
        self.skip = 0
        self.ld = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang, self.direction = a.get("lang"), a.get("dir")
        elif tag == "body":
            self.in_body = True
        elif tag == "meta":
            self.meta.append(a)
        elif tag == "link":
            self.resources.append(a)
        elif tag == "a" and a.get("href"):
            self.links.append(a)
        elif tag == "img":
            self.images.append(a)
        if tag in ("title", "h1", "h2", "h3"):
            self.capture = (tag, [])
        if tag in ("script", "style"):
            self.skip += 1
            if tag == "script" and a.get("type") == "application/ld+json":
                self.ld = []

    def handle_endtag(self, tag):
        if self.capture and self.capture[0] == tag:
            value = " ".join("".join(self.capture[1]).split())
            if tag == "title":
                self.title.append(value)
            else:
                self.headings.append({"tag": tag, "text": value})
            self.capture = None
        if tag == "script" and self.ld is not None:
            try:
                self.schema.append(json.loads("".join(self.ld)))
            except json.JSONDecodeError as exc:
                self.schema.append({"parse_error": str(exc)})
            self.ld = None
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        elif tag == "body":
            self.in_body = False

    def handle_data(self, data):
        if self.ld is not None:
            self.ld.append(data)
        if self.capture:
            self.capture[1].append(data)
        if self.in_body and not self.skip:
            self.text.append(data)


def _fetch(url, user_agent=None, follow=True):
    with tempfile.TemporaryDirectory(prefix="saluna-seo-") as tmp:
        body_path = pathlib.Path(tmp) / "body"
        headers_path = pathlib.Path(tmp) / "headers"
        command = ["curl.exe", "-sS", "--compressed", "--connect-timeout", "8",
                   "--max-time", "20", "-D", str(headers_path), "-o", str(body_path),
                   "-w", "%{json}"]
        if follow:
            command.append("-L")
        if user_agent:
            command.extend(["-A", user_agent])
        command.append(url)
        response = subprocess.run(command, capture_output=True, timeout=25)
        try:
            timing = json.loads(response.stdout)
        except json.JSONDecodeError:
            timing = {}
        body = body_path.read_bytes() if body_path.exists() else b""
        header_text = headers_path.read_text(encoding="utf-8", errors="replace") if headers_path.exists() else ""
        blocks = [b for b in re.split(r"\r?\n\r?\n", header_text) if b.startswith("HTTP/")]
        chain = []
        for block in blocks:
            lines = block.splitlines()
            headers = {}
            for line in lines[1:]:
                if ":" in line:
                    key, value = line.split(":", 1)
                    # Skip cookies; this audit does not need browser identifiers.
                    if key.lower() != "set-cookie":
                        headers[key.lower()] = value.strip()
            chain.append({"status_line": lines[0], "headers": headers})
        info = {
            "url": url, "status": timing.get("http_code"),
            "effective_url": timing.get("url_effective"),
            "remote_ip": timing.get("remote_ip"),
            "seconds": timing.get("time_total"), "ttfb_seconds": timing.get("time_starttransfer"),
            "download_bytes": timing.get("size_download"), "body_bytes": len(body),
            "redirects": chain, "curl_exit": response.returncode,
            "error": response.stderr.decode(errors="replace").strip(),
            "sha256": hashlib.sha256(body).hexdigest(),
        }
        return info, body


def fetch(url, user_agent=None, follow=True):
    info, body = _fetch(url, user_agent, follow)
    if info["curl_exit"]:
        first_attempt = {key: info[key] for key in ("status", "seconds", "curl_exit", "error")}
        info, body = _fetch(url, user_agent, follow)
        info["first_attempt"] = first_attempt
    return info, body


def inspect(url):
    info, body = fetch(url)
    if body and "html" in info["redirects"][-1]["headers"].get("content-type", ""):
        page = Page()
        page.feed(body.decode("utf-8", errors="replace"))
        text = " ".join(" ".join(page.text).split())
        canonical = [x.get("href") for x in page.resources if x.get("rel") == "canonical"]
        internal = sorted({urllib.parse.urljoin(url, x["href"]).split("#")[0]
                           for x in page.links if not x["href"].startswith("#")
                           and urllib.parse.urlparse(urllib.parse.urljoin(url, x["href"])).netloc == "saluna.ir"})
        faqs = []
        for block in page.schema:
            if isinstance(block, dict) and block.get("@type") == "FAQPage":
                for item in block.get("mainEntity", []):
                    question = item.get("name", "")
                    answer = item.get("acceptedAnswer", {}).get("text", "")
                    faqs.append({"question": question, "question_in_body": question in text,
                                 "answer_in_body": answer in text})
        info["page"] = {
            "titles": page.title, "lang": page.lang, "dir": page.direction,
            "meta": page.meta, "canonical": canonical, "headings": page.headings,
            "text_chars": len(text), "text_words": len(text.split()), "body_text": text,
            "internal_page_links": internal, "links": page.links, "images": page.images,
            "head_resources": page.resources, "json_ld": page.schema, "faq_visibility": faqs,
        }
    return info


def sitemap(url):
    info, body = fetch(url)
    info["xml"] = body.decode("utf-8", errors="replace")
    info["locations"] = []
    try:
        root = ET.fromstring(body)
        info["xml_root"] = root.tag.rsplit("}", 1)[-1]
        info["locations"] = [e.text for e in root.iter() if e.tag.rsplit("}", 1)[-1] == "loc"]
    except ET.ParseError as exc:
        info["xml_error"] = str(exc)
    return info


def main():
    static_index = sitemap(ORIGIN + "/sitemap-index.xml")
    sitemaps = [static_index]
    if static_index.get("xml_root") == "sitemapindex":
        sitemaps.extend(sitemap(url) for url in static_index["locations"])
    sitemaps.append(sitemap(ORIGIN + "/salons-sitemap.xml"))
    urls = sorted({u for s in sitemaps if s.get("xml_root") == "urlset" for u in s["locations"]})
    # Known public URL variants, missing routes, and an intentionally nonexistent Salon.
    extra = ["http://saluna.ir/", "http://www.saluna.ir/", "https://www.saluna.ir/",
             ORIGIN + "/about", ORIGIN + "/services", ORIGIN + "/blog/", ORIGIN + "/guides/",
             ORIGIN + "/seo-audit-nonexistent-20261002", ORIGIN + "/salons/seo-audit-nonexistent-20261002",
             "https://app.saluna.ir/auth", "https://app.saluna.ir/robots.txt"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        pages = list(pool.map(inspect, sorted(set(urls + extra))))
    robots_info, robots_body = fetch(ORIGIN + "/robots.txt")
    robots_info["text"] = robots_body.decode(errors="replace")
    assets = []
    for path in ("/favicon-32.png", "/apple-touch-icon.png", "/favicon.ico", "/og/landing.png"):
        info, body = fetch(ORIGIN + path)
        if body.startswith(b"\x89PNG\r\n\x1a\n"):
            info["dimensions"] = [int.from_bytes(body[16:20], "big"), int.from_bytes(body[20:24], "big")]
        assets.append(info)
    ua_checks = []
    for url, ua in [(ORIGIN + "/", "Googlebot"),
                    (ORIGIN + "/apple-touch-icon.png", "Googlebot-Image/1.0")]:
        info, _ = fetch(url, ua)
        info["user_agent"] = ua
        ua_checks.append(info)
    evidence = {
        "checked_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "Point-in-time checks from one Windows network; UA checks do not verify Google's IP access.",
        "sitemap_urls": urls, "sitemaps": sitemaps, "robots": robots_info,
        "pages": pages, "assets": assets, "user_agent_checks": ua_checks,
    }
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    for item in pages:
        page = item.get("page", {})
        print(json.dumps({"url": item["url"], "status": item["status"], "seconds": item["seconds"],
                          "canonical": page.get("canonical"), "title": page.get("titles"),
                          "text_words": page.get("text_words"), "internal_links": len(page.get("internal_page_links", [])),
                          "schema": [s.get("@type") for s in page.get("json_ld", []) if isinstance(s, dict)],
                          "error": item["error"]}, ensure_ascii=False))
    print("Evidence written to", DEST / "evidence.json")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
