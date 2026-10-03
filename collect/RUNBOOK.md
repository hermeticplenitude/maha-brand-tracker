# Daily refresh runbook

1. `cd /home/user/workspace/maha-tracker && git pull -q origin main` (GitHub credentials).
2. X: `python collect/x.py 500` — must run with the api.x.com credential handle injected (custom-cred …@api.x.com, the "thread drafting" token). Counts are pennies; 500 posts ≈ $2.50.
3. `python collect/bluesky.py` (no auth).
4. `python collect/googlenews.py` (no auth for feed; labels via pplx_sdk).
5. `python collect/gdelt.py` (no auth; tolerate rate limits — optional series are skipped automatically).
6. `FEC_API_KEY=proxy python collect/fec.py` with the api.open.fec.gov credential handle (custom-cred …@api.open.fec.gov) in api_credentials; the proxy injects the personal key and all Schedule E pages are fetched. Without the handle the script falls back to the shared DEMO_KEY (40 calls/hour) and may mark committees `unavailable`.
7. `python collect/googleads.py` — downloads Google's political-ads bundle (~300 MB, cached for 20 h in /tmp) and recomputes race-by-race spend. Weekly is enough; Google updates nightly.
8. `python collect/brief.py` — regenerates data/brief.json and BRIEF.md.
9. Scan for new MAHA polls and FEC filings (web search; FEC API for committee C00889351 "MAHA PAC" if available). Do NOT edit polls.json or midterms.json automatically; list anything new in the run summary for hand-coding.
10. `git add -A && git commit -m "Daily refresh <date>" && git push origin main` (GitHub credentials). GitHub Pages rebuilds in ~1 minute.
11. Verify https://hermeticplenitude.github.io/maha-brand-tracker/data/brief.json shows today's date.
