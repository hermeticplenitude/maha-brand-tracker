# Collectors

Scripts that refresh `data/listening.json`. Each is standalone; run from the repository root.

| Script | Source | Auth | Notes |
|---|---|---|---|
| `bluesky.py` | Bluesky AppView public search (`api.bsky.app`) | none | Walks back 90 days by timestamp (anonymous cursor pagination is refused). ~1 min. |
| `gdelt.py` | GDELT DOC 2.0 (`api.gdeltproject.org`) | none | One request per 5 s is the published limit; in practice the long-range series are often throttled. Finished series are cached in `.cache/` so a rerun fetches only what failed. |

Planned: Reddit (OAuth script app), YouTube Data API, X (paid tier).
