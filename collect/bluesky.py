"""Bluesky collector for the MAHA Brand Tracker.

Uses the public, unauthenticated AppView search endpoint (api.bsky.app app.bsky.feed.searchPosts)
to gather every post in the window that matches the MAHA phrase set, then writes weekly volume,
engagement, top posts and top accounts into data/listening.json under "bluesky".
"""
import json, time, datetime as dt, urllib.parse, subprocess, pathlib, collections, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "listening.json"
API = "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts"
UA = "maha-brand-tracker/0.1 (research)"
DAYS = 90
QUERIES = ['"Make America Healthy Again"', '#MAHA', 'MAHA Kennedy', 'MAHA RFK', 'MAHA movement', 'MAHA moms']
# Posts that match only the bare acronym in another sense (Maha Shivaratri, Kumbh, Maha Vajiralongkorn, MAHA
# the Czech car brand) are filtered by requiring a political cue somewhere in the text or by the phrase itself.
CUE = re.compile(r"make america healthy again|rfk|kennedy|hhs|vaccin|maga|trump|#maha|maha mom|maha movement|maha report|maha pac|maha summit|food dye|seed oil|mrna", re.I)


def get(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(4):
        r = subprocess.run(["curl", "-s", "-m", "40", "-A", UA, url], capture_output=True, text=True)
        try:
            d = json.loads(r.stdout)
            if "posts" in d:
                return d
        except json.JSONDecodeError:
            pass
        time.sleep(3 + 3 * i)
    return {"posts": []}


SINCE = (dt.datetime.now(dt.UTC) - dt.timedelta(days=DAYS)).strftime("%Y-%m-%dT00:00:00Z")


def collect():
    since = SINCE
    seen = {}
    for q in QUERIES:
        # The AppView rejects cursor pagination for anonymous callers ("forbidden by administrative
        # rules"), but honours `until`, so walk backwards one page at a time by timestamp.
        until, pages, oldest = None, 0, None
        while pages < 80:
            params = {"q": q, "limit": 100, "sort": "latest", "since": since}
            if until: params["until"] = until
            d = get(params); pages += 1
            batch = d.get("posts", [])
            if not batch:
                break
            for p in batch:
                rec = p.get("record", {}); text = rec.get("text", "")
                ts = rec.get("createdAt", "")
                if ts and (oldest is None or ts < oldest): oldest = ts
                if "make america healthy again" not in text.lower() and not CUE.search(text):
                    continue
                seen[p["uri"]] = {
                    "uri": p["uri"], "date": ts[:10], "handle": p["author"]["handle"],
                    "name": p["author"].get("displayName", ""), "text": text,
                    "likes": p.get("likeCount", 0), "reposts": p.get("repostCount", 0), "replies": p.get("replyCount", 0), "quotes": p.get("quoteCount", 0),
                    "url": f"https://bsky.app/profile/{p['author']['handle']}/post/{p['uri'].rsplit('/', 1)[-1]}",
                }
            if not oldest or oldest <= since or len(batch) < 5:
                break
            nxt = (dt.datetime.fromisoformat(oldest.replace("Z", "+00:00")) - dt.timedelta(seconds=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            if nxt == until: break
            until = nxt
            time.sleep(0.8)
        print(q, "->", len(seen), "unique so far", "pages", pages, "oldest", oldest and oldest[:10])
    return list(seen.values())


def main():
    posts = collect()
    posts = [p for p in posts if p["date"]]
    weeks = collections.Counter(); eng = collections.Counter(); authors = collections.Counter(); author_eng = collections.Counter()
    for p in posts:
        d = dt.date.fromisoformat(p["date"]); monday = (d - dt.timedelta(days=d.weekday())).isoformat()
        e = p["likes"] + p["reposts"] + p["replies"] + p["quotes"]
        weeks[monday] += 1; eng[monday] += e; authors[p["handle"]] += 1; author_eng[p["handle"]] += e
    weekly = [{"week": w, "posts": weeks[w], "engagement": eng[w]} for w in sorted(weeks)]
    # drop the partial current week from trend math but keep it in the series
    top_posts = sorted(posts, key=lambda p: p["likes"] + p["reposts"] + p["quotes"], reverse=True)[:15]
    top_accounts = [{"handle": h, "posts": n, "engagement": author_eng[h]} for h, n in authors.most_common(15)]
    full = [w for w in weekly[:-1]]
    def avg(xs): return sum(xs) / len(xs) if xs else 0
    last4 = avg([w["posts"] for w in full[-4:]]); prev4 = avg([w["posts"] for w in full[-8:-4]])

    existing = json.loads(OUT.read_text()) if OUT.exists() else {}
    existing["updated"] = dt.date.today().isoformat()
    existing["bluesky"] = {
        "source": "Bluesky AppView public search (app.bsky.feed.searchPosts)", "docs": "https://docs.bsky.app/docs/api/app-bsky-feed-search-posts",
        "queries": QUERIES, "window_days": DAYS, "since": SINCE[:10],
        "note": "Every public Bluesky post in the window matching the phrase set, deduplicated across queries. Bare-acronym posts are kept only if the text also carries a political cue (RFK, Kennedy, HHS, vaccine, MAGA, Trump, food dye, seed oil, mRNA, etc.). Engagement = likes + reposts + replies + quotes at collection time. Bluesky skews left of the US electorate; treat it as the critical-outside channel, not a census.",
        "total_posts": len(posts), "weekly": weekly,
        "summary": {"last4w_avg_posts": round(last4, 1), "prev4w_avg_posts": round(prev4, 1), "change_pct": round((last4 - prev4) / prev4 * 100, 1) if prev4 else None, "unique_authors": len(authors)},
        "top_posts": top_posts, "top_accounts": top_accounts,
    }
    OUT.write_text(json.dumps(existing, indent=1))
    print("wrote", OUT, "posts", len(posts), "authors", len(authors), "weeks", len(weekly))


if __name__ == "__main__":
    main()
