"""GDELT DOC 2.0 collector for the MAHA Brand Tracker.

Pulls daily news-coverage volume (share of all GDELT-monitored articles) and average tone
for the MAHA phrase set, plus the week's most-covered articles, and writes data/listening.json
(merging with any other platform blocks already present). No API key. GDELT asks for one
request every 5 seconds, so this script sleeps between calls.
"""
import json, time, datetime as dt, urllib.parse, urllib.request, pathlib, sys

from zoneinfo import ZoneInfo


def _today():
    return dt.datetime.now(ZoneInfo("America/New_York")).date()


ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "listening.json"
BASE = "https://api.gdeltproject.org/api/v2/doc/doc"
UA = "maha-brand-tracker/0.1 (research; github.com/hermeticplenitude/maha-brand-tracker)"

# Full phrase only: news style guides spell out the acronym on first reference, and the bare
# acronym collides with the Maha Shivaratri / Kumbh / Indian-political namespace. US sources only.
Q_MAHA = '"Make America Healthy Again" sourcecountry:US'
Q_MAGA = '"Make America Great Again" sourcecountry:US'
START = "20240801000000"


def get(params, retries=2):
    url = BASE + "?" + urllib.parse.urlencode(params)
    import subprocess
    for i in range(retries):
        try:
            body = subprocess.run(["curl", "-s", "-m", "150", "-A", UA, url], capture_output=True, text=True, timeout=160).stdout
            if body.startswith("Please limit") or not body.strip():
                raise RuntimeError("rate limit or empty response")
            return json.loads(body)
        except Exception as e:  # noqa: BLE001
            wait = 20 + 15 * i
            print(f"  retry {i+1} after {wait}s: {e}", file=sys.stderr)
            time.sleep(wait)
    raise SystemExit("GDELT unavailable")


def series(query, mode):
    now = dt.datetime.now(dt.UTC).strftime("%Y%m%d%H%M%S")
    d = get({"query": query, "mode": mode, "startdatetime": START, "enddatetime": now, "format": "json", "timelinesmooth": 0})
    pts = d["timeline"][0]["data"]
    return [{"date": p["date"][:4] + "-" + p["date"][4:6] + "-" + p["date"][6:8], "value": round(p["value"], 4)} for p in pts]


def weekly(daily):
    """Aggregate daily points to ISO weeks (mean), keyed by the Monday."""
    buckets = {}
    for p in daily:
        d = dt.date.fromisoformat(p["date"])
        monday = (d - dt.timedelta(days=d.weekday())).isoformat()
        buckets.setdefault(monday, []).append(p["value"])
    return [{"week": k, "value": round(sum(v) / len(v), 4)} for k, v in sorted(buckets.items())]


def top_articles(query, timespan="7d", n=12):
    d = get({"query": query, "mode": "artlist", "timespan": timespan, "maxrecords": 75, "sort": "hybridrel", "format": "json"})
    seen, out = set(), []
    for a in d.get("articles", []):
        key = a["title"].strip().lower()[:60]
        if key in seen:
            continue
        seen.add(key)
        out.append({"date": a["seendate"][:4] + "-" + a["seendate"][4:6] + "-" + a["seendate"][6:8], "outlet": a["domain"], "title": a["title"].strip(), "url": a["url"]})
        if len(out) >= n:
            break
    return out


CACHE = ROOT / "collect" / ".cache"


def cached(name, fn, optional=False):
    """GDELT throttles hard; keep each finished series on disk so a rerun only fetches what failed."""
    CACHE.mkdir(exist_ok=True)
    f = CACHE / f"gdelt_{name}_{_today().isoformat()}.json"
    if f.exists():
        return json.loads(f.read_text())
    print(name)
    try:
        val = fn()
    except SystemExit:
        if optional:
            print("  skipped (rate limited)"); return None
        raise
    f.write_text(json.dumps(val)); time.sleep(12)
    return val


def main():
    vol_maha = cached("vol_maha", lambda: series(Q_MAHA, "timelinevol"))
    tone_maha = cached("tone_maha", lambda: series(Q_MAHA, "timelinetone"), optional=True)
    vol_maga = cached("vol_maga", lambda: series(Q_MAGA, "timelinevol"), optional=True)
    arts = cached("articles", lambda: top_articles(Q_MAHA), optional=True)

    wk_maha = weekly(vol_maha); wk_tone = weekly(tone_maha) if tone_maha else []; wk_maga = weekly(vol_maga) if vol_maga else []
    # Trailing 4 weeks vs the prior 4 weeks
    def avg(xs): return sum(xs) / len(xs) if xs else 0
    last4 = avg([w["value"] for w in wk_maha[-5:-1]]); prev4 = avg([w["value"] for w in wk_maha[-9:-5]])
    tone4 = avg([w["value"] for w in wk_tone[-5:-1]])
    ratio = [{"week": a["week"], "value": round(a["value"] / b["value"], 3) if b["value"] else None} for a, b in zip(wk_maha, wk_maga) if a["week"] == b["week"]]

    existing = json.loads(OUT.read_text()) if OUT.exists() else {}
    existing["updated"] = _today().isoformat()
    existing["gdelt"] = {
        "source": "GDELT DOC 2.0 API", "url": "https://api.gdeltproject.org/api/v2/doc/doc", "docs": "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
        "query": Q_MAHA, "comparison_query": Q_MAGA, "start": "2024-08-01",
        "note": "Volume is GDELT's 'timelinevol': the share (percent) of all monitored US-source articles that match the query, by day, averaged to weeks. Tone is GDELT's document tone score (negative = more negative language; typical news runs -2 to -4). Both are machine measures over a global multilingual news crawl, not hand-coded.",
        "weekly_volume": wk_maha, "weekly_tone": wk_tone, "weekly_volume_maga": wk_maga, "weekly_ratio_maha_to_maga": ratio,
        "summary": {"last4w_volume": round(last4, 4), "prev4w_volume": round(prev4, 4), "change_pct": round((last4 - prev4) / prev4 * 100, 1) if prev4 else None, "last4w_tone": round(tone4, 2) if wk_tone else None, "peak_week": max(wk_maha, key=lambda w: w["value"])},
        "top_articles_7d": arts or [], "pending": [k for k, v in {"weekly_tone": tone_maha, "weekly_volume_maga": vol_maga, "top_articles_7d": arts}.items() if not v],
    }
    OUT.write_text(json.dumps(existing, indent=1))
    print("wrote", OUT, "weeks", len(wk_maha), "last4w", round(last4, 4), "tone", round(tone4, 2))


if __name__ == "__main__":
    main()
