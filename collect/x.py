"""X (Twitter) collector for the MAHA Brand Tracker.

Two parts, both via the X API v2 pay-per-use plan:
  1. counts/all  — daily post counts for the MAHA phrase set and for MAGA since Aug 1, 2024.
                   Counts requests are $0.005 each and return no posts; ~30 requests per series.
  2. search/recent — a capped sample of the last 7 days' posts (default 1,000, $0.005 per post)
                   to produce top posts, top accounts and engagement totals.
Writes the "x" block of data/listening.json. Requires the X bearer token to be injected by the
credential proxy (run with api_credentials for api.x.com); nothing secret is stored here.
"""
import json, time, datetime as dt, urllib.parse, subprocess, pathlib, collections, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "listening.json"
CACHE = ROOT / "collect" / ".cache"
API = "https://api.x.com/2/tweets/"
START = "2024-08-01T00:00:00Z"
SAMPLE_CAP = int(sys.argv[1]) if len(sys.argv) > 1 else 1000

Q_MAHA = '("Make America Healthy Again" OR #MAHA OR (MAHA (RFK OR Kennedy OR movement OR moms OR HHS OR report OR PAC OR summit))) -is:retweet'
Q_MAGA = '("Make America Great Again" OR #MAGA) -is:retweet'
Q_SAMPLE = Q_MAHA + " -is:reply lang:en"


def get(path, params):
    url = API + path + "?" + urllib.parse.urlencode(params)
    for i in range(5):
        r = subprocess.run(["curl", "-s", "-m", "60", "-w", "\n%{http_code}", url], capture_output=True, text=True)
        body, _, code = r.stdout.rpartition("\n")
        if code == "200":
            return json.loads(body)
        if code == "429":
            wait = 15 * (i + 1); print(f"  429, waiting {wait}s", file=sys.stderr); time.sleep(wait); continue
        raise SystemExit(f"X API {code}: {body[:300]}")
    raise SystemExit("X API rate limit persisted")


def counts(query, name):
    CACHE.mkdir(exist_ok=True)
    f = CACHE / f"x_counts_{name}_{dt.date.today().isoformat()}.json"
    if f.exists():
        return json.loads(f.read_text())
    out, token, end = [], None, dt.datetime.now(dt.UTC).replace(microsecond=0) - dt.timedelta(minutes=5)
    params = {"query": query, "granularity": "day", "start_time": START, "end_time": end.strftime("%Y-%m-%dT%H:%M:%SZ")}
    while True:
        if token: params["next_token"] = token
        d = get("counts/all", params)
        out += [{"date": x["start"][:10], "count": x["tweet_count"]} for x in d.get("data", [])]
        token = d.get("meta", {}).get("next_token")
        if not token: break
        time.sleep(1.2)
    out.sort(key=lambda x: x["date"])
    # the API returns partial first/last buckets; keep them, the UI marks the current week partial
    f.write_text(json.dumps(out))
    print(name, "days", len(out), "requests ~", len(out) // 31 + 1)
    return out


def weekly(daily, key="count"):
    b = collections.OrderedDict()
    for p in daily:
        d = dt.date.fromisoformat(p["date"]); mon = (d - dt.timedelta(days=d.weekday())).isoformat()
        b[mon] = b.get(mon, 0) + p[key]
    return [{"week": k, "count": v} for k, v in sorted(b.items())]


def sample(cap):
    posts, users, token, n = [], {}, None, 0
    while n < cap:
        params = {"query": Q_SAMPLE, "max_results": 100, "tweet.fields": "created_at,public_metrics,author_id,lang", "expansions": "author_id", "user.fields": "username,name,public_metrics,verified"}
        if token: params["next_token"] = token
        d = get("search/recent", params)
        for u in d.get("includes", {}).get("users", []): users[u["id"]] = u
        batch = d.get("data", [])
        posts += batch; n += len(batch)
        token = d.get("meta", {}).get("next_token")
        if not token or not batch: break
        time.sleep(1.2)
    out = []
    for p in posts:
        u = users.get(p["author_id"], {}); m = p.get("public_metrics", {})
        out.append({"id": p["id"], "date": p["created_at"][:10], "handle": u.get("username", "?"), "name": u.get("name", ""), "followers": u.get("public_metrics", {}).get("followers_count"),
                    "text": p["text"], "likes": m.get("like_count", 0), "reposts": m.get("retweet_count", 0), "replies": m.get("reply_count", 0), "quotes": m.get("quote_count", 0), "views": m.get("impression_count"),
                    "url": f"https://x.com/{u.get('username', 'i')}/status/{p['id']}"})
    return out


def main():
    maha = counts(Q_MAHA, "maha"); time.sleep(1.5)
    maga = counts(Q_MAGA, "maga")
    wk_maha, wk_maga = weekly(maha), weekly(maga)
    ratio = [{"week": a["week"], "value": round(a["count"] / b["count"], 4) if b["count"] else None} for a, b in zip(wk_maha, wk_maga) if a["week"] == b["week"]]
    full = wk_maha[:-1]
    def avg(xs): return sum(xs) / len(xs) if xs else 0
    last4 = avg([w["count"] for w in full[-4:]]); prev4 = avg([w["count"] for w in full[-8:-4]])
    peak = max(wk_maha, key=lambda w: w["count"])
    print("sampling up to", SAMPLE_CAP, "recent posts")
    smp = sample(SAMPLE_CAP)
    smp_sorted = sorted(smp, key=lambda p: p["likes"] + p["reposts"] + p["quotes"], reverse=True)
    acc = collections.Counter(p["handle"] for p in smp); acc_eng = collections.Counter()
    for p in smp: acc_eng[p["handle"]] += p["likes"] + p["reposts"] + p["replies"] + p["quotes"]
    since = min((p["date"] for p in smp), default=None)

    existing = json.loads(OUT.read_text()) if OUT.exists() else {}
    existing["updated"] = dt.date.today().isoformat()
    existing["x"] = {
        "source": "X API v2 (pay-per-use): GET /2/tweets/counts/all and /2/tweets/search/recent", "docs": "https://docs.x.com/x-api/posts/counts/introduction",
        "query": Q_MAHA, "comparison_query": Q_MAGA, "sample_query": Q_SAMPLE, "start": START[:10],
        "note": "Counts are X's own daily totals of original posts (retweets excluded) matching the query, so they are a census, not a sample. The phrase set is the full phrase, #MAHA, or the acronym alongside a political cue; it misses bare 'MAHA' with no cue and catches a little unrelated noise. The 7-day post sample is capped to control cost and is drawn most-recent-first, so 'top posts' means top within the sampled window.",
        "weekly_counts": wk_maha, "weekly_counts_maga": wk_maga, "weekly_ratio_maha_to_maga": ratio,
        "summary": {"total_posts_since_start": sum(p["count"] for p in maha), "last4w_avg_weekly": round(last4), "prev4w_avg_weekly": round(prev4), "change_pct": round((last4 - prev4) / prev4 * 100, 1) if prev4 else None,
                    "peak_week": peak, "last4w_ratio_to_maga": round(avg([r["value"] for r in ratio[-5:-1] if r["value"]]), 4)},
        "sample": {"n": len(smp), "since": since, "unique_authors": len(acc), "top_posts": smp_sorted[:15], "top_accounts": [{"handle": h, "posts": n, "engagement": acc_eng[h]} for h, n in acc.most_common(15)]},
    }
    OUT.write_text(json.dumps(existing, indent=1))
    print("wrote", OUT, "| weeks", len(wk_maha), "| total since Aug 2024", existing["x"]["summary"]["total_posts_since_start"], "| last4w/wk", round(last4), "| sample", len(smp))


if __name__ == "__main__":
    main()
