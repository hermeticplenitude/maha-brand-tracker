"""Google News collector for the MAHA Brand Tracker.

Reads Google News RSS search feeds (no key) for the MAHA phrase set over the last 7 days,
deduplicates, and classifies each headline with a fixed rubric via an LLM:
  tone:   positive | critical | neutral          (toward MAHA / its leadership)
  origin: inside | outside | n/a                 (for critical items: criticism from within the
                                                  movement or its allies vs from opponents/press)
  theme:  policy-delivery | politics-midterms | money-pac | vaccines | food-chemicals |
          personnel-leadership | culture-media | science-research | other
Writes the "googlenews" block of data/listening.json. Headline + source only; the classifier
never sees article bodies, and the UI says so.
"""
import json, re, time, datetime as dt, urllib.parse, subprocess, pathlib, collections, html
import xml.etree.ElementTree as ET

from zoneinfo import ZoneInfo


def _today():
    return dt.datetime.now(ZoneInfo("America/New_York")).date()


ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "listening.json"
QUERIES = ['"Make America Healthy Again" when:7d', 'MAHA Kennedy when:7d', 'MAHA RFK when:7d', 'MAHA movement when:7d', 'MAHA midterms when:7d', 'MAHA PAC when:7d', '"MAHA moms" when:7d', 'MAHA Summit when:7d']
UA = "Mozilla/5.0 (compatible; maha-brand-tracker/0.1)"
CUE = re.compile(r"make america healthy again|rfk|kennedy|hhs|maha", re.I)
NOISE = re.compile(r"shivaratri|kumbh|vajiralongkorn|maharashtra|mahakal|maha(?:dev|bharat)", re.I)


def feed(q):
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    xml = subprocess.run(["curl", "-s", "-m", "30", "-A", UA, url], capture_output=True, text=True).stdout
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    out = []
    for it in root.findall(".//item"):
        title = html.unescape(it.findtext("title") or ""); src = it.findtext("source") or ""
        title = re.sub(r"\s+-\s+" + re.escape(src) + r"$", "", title).strip() if src else title
        pub = it.findtext("pubDate") or ""
        try:
            d = dt.datetime.strptime(pub, "%a, %d %b %Y %H:%M:%S %Z").date().isoformat()
        except ValueError:
            d = ""
        out.append({"title": title, "outlet": src, "date": d, "url": it.findtext("link") or ""})
    return out


def classify(items):
    """Headline-only labels via pplx_sdk's structured extraction (fixed rubric, fixed schema)."""
    import pplx_sdk
    instruction = ("Label this news headline about the Make America Healthy Again (MAHA) movement led by HHS Secretary Robert F. Kennedy Jr. "
                   "tone: how the headline frames MAHA, its leadership or its policies: positive, critical or neutral. "
                   "origin: only if tone is critical: 'inside' when the criticism comes from within the movement or its allies (MAHA activists, MAHA moms, Republicans, movement figures, Kennedy allies); "
                   "'outside' when it comes from opponents, scientists, Democrats, public-health establishment or the press itself; otherwise 'na'. "
                   "theme: one of policy-delivery, politics-midterms, money-pac, vaccines, food-chemicals, personnel-leadership, culture-media, science-research, other. "
                   "Use the headline and outlet only; do not infer facts beyond the text.")
    schema = {"type": "object", "properties": {
        "tone": {"type": "string", "enum": ["positive", "critical", "neutral"]},
        "origin": {"type": "string", "enum": ["inside", "outside", "na"]},
        "theme": {"type": "string", "enum": ["policy-delivery", "politics-midterms", "money-pac", "vaccines", "food-chemicals", "personnel-leadership", "culture-media", "science-research", "other"]}},
        "required": ["tone", "origin", "theme"]}
    payload = [{"outlet": x["outlet"], "headline": x["title"]} for x in items]
    out = pplx_sdk.llm.extract_many(items=payload, instruction=instruction, output_schema=schema, chunk_size=10, concurrency=4)
    bad = 0
    for x, r in zip(items, out):
        data = None
        if r.ok and r.result is not None and getattr(r.result, "error", None) is None:
            data = r.result.result if hasattr(r.result, "result") else None
            if data is not None and not isinstance(data, dict): data = dict(data)
        if not isinstance(data, dict):
            bad += 1; data = {}
        x["tone"] = data.get("tone", "neutral"); x["origin"] = data.get("origin", "na") if data.get("tone") == "critical" else "na"; x["theme"] = data.get("theme", "other")
    if bad: print("  unlabeled", bad)
    return items


def main():
    seen, items = set(), []
    for q in QUERIES:
        for x in feed(q):
            k = re.sub(r"\W+", " ", x["title"].lower())[:70]
            if k in seen or not x["title"] or NOISE.search(x["title"]) or not CUE.search(x["title"]):
                continue
            seen.add(k); items.append(x)
        time.sleep(1)
    cutoff = (_today() - dt.timedelta(days=7)).isoformat()
    items = [x for x in items if x["date"] >= cutoff]
    items.sort(key=lambda x: x["date"], reverse=True)
    print("headlines", len(items))
    items = classify(items)
    tone = collections.Counter(x["tone"] for x in items)
    origin = collections.Counter(x["origin"] for x in items if x["tone"] == "critical")
    theme = collections.Counter(x["theme"] for x in items)
    outlets = collections.Counter(x["outlet"] for x in items)
    by_day = collections.Counter(x["date"] for x in items)
    existing = json.loads(OUT.read_text()) if OUT.exists() else {}
    existing["updated"] = _today().isoformat()
    existing["googlenews"] = {
        "source": "Google News RSS search (US edition, English)", "docs": "https://news.google.com/rss/search?q=%22Make+America+Healthy+Again%22&hl=en-US&gl=US&ceid=US:en",
        "queries": QUERIES, "window_days": 7, "collected": _today().isoformat(),
        "note": "Google News returns up to 100 results per query; eight queries are merged and deduplicated by title. Tone, origin and theme are assigned by a language model from headline and outlet only, using a fixed rubric; article bodies are not read. 'Critical, inside' means the criticism in the headline comes from the movement or its allies.",
        "n": len(items), "tone": dict(tone), "critical_origin": dict(origin), "theme": dict(theme.most_common()), "outlets": dict(outlets.most_common(20)), "by_day": dict(sorted(by_day.items())),
        "items": items,
    }
    OUT.write_text(json.dumps(existing, indent=1))
    print("wrote", OUT, dict(tone), dict(origin), theme.most_common(5))


if __name__ == "__main__":
    main()
