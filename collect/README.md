# Collectors

Scripts that refresh `data/listening.json`. Each is standalone; run from the repository root.

| Script | Source | Auth | Notes |
|---|---|---|---|
| `bluesky.py` | Bluesky AppView public search (`api.bsky.app`) | none | Walks back 90 days by timestamp (anonymous cursor pagination is refused). ~1 min. |
| `x.py` | X API v2 `counts/all` + `search/recent` | bearer token via credential proxy (`api_credentials` for api.x.com) | Full daily census of original posts since Aug 2024 for MAHA and MAGA (~52 counts requests, $0.005 each) plus a capped 7-day sample (default 1,000 posts, $0.005 each). `python collect/x.py 1000`. |
| `googlenews.py` | Google News RSS search (US edition) | none for the feed; `pplx_sdk` LLM extraction for labels | Eight MAHA queries over 7 days, merged and deduplicated; each headline labeled tone / origin-of-criticism / theme under a fixed rubric from headline + outlet only. |
| `fec.py` | OpenFEC API | optional personal key (query param `api_key`; DEMO_KEY fallback) | Totals and Schedule E independent expenditures for MAHA PAC (C00821439), MAHA PAC 2024 (C00887893), MAHA Action PAC (C00960799), MAHA Alliance (C00888172), MAHA Moms PAC (C00896936). Same-day cache in /tmp/fec_cache. |
| `googleads.py` | Google Political Advertising transparency bundle | none | Advertiser weekly spend for a watchlist of the 20 races' committees, MAHA orgs and opposition groups; flags new MAHA-named advertisers. |
| `brief.py` | tracker's own data files | none | Writes `data/brief.json` (rendered at the top of the site) and `BRIEF.md` (shareable text) from the latest listening, poll, money and calendar data. Run last. |
| `gdelt.py` | GDELT DOC 2.0 (`api.gdeltproject.org`) | none | One request per 5 s is the published limit; in practice the long-range series are often throttled. Finished series are cached in `.cache/` so a rerun fetches only what failed. |

Planned: Reddit (OAuth script app), YouTube Data API.


Order: `x.py` → `bluesky.py` → `googlenews.py` → `gdelt.py` → `fec.py` → `googleads.py` → `brief.py`, then commit and push. `data/action.json` (registered voters, margins, deadlines, delivery checklist) is maintained by hand with sources inline.
