# Daily refresh runbook

1. `cd /home/user/workspace/maha-tracker && git pull -q origin main` (GitHub credentials).
2. X: `python collect/x.py 500` — must run with the api.x.com credential handle injected (custom-cred …@api.x.com, the "thread drafting" token). Counts are pennies; 500 posts ≈ $2.50.
3. `python collect/bluesky.py` (no auth).
4. `python collect/googlenews.py` (no auth for feed; labels via pplx_sdk).
5. `python collect/gdelt.py` (no auth; tolerate rate limits — optional series are skipped automatically).
6. `python collect/brief.py` — regenerates data/brief.json and BRIEF.md.
7. Scan for new MAHA polls and FEC filings (web search; FEC API for committee C00889351 "MAHA PAC" if available). Do NOT edit polls.json or midterms.json automatically; list anything new in the run summary for hand-coding.
8. `git add -A && git commit -m "Daily refresh <date>" && git push origin main` (GitHub credentials). GitHub Pages rebuilds in ~1 minute.
9. Verify https://hermeticplenitude.github.io/maha-brand-tracker/data/brief.json shows today's date.
