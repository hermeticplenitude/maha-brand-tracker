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

## Election night (Nov 3–4)

Results live in `data/results.json`, one object per race under `races[]`. For each called race set `result.status` ("called" / "too close" / "runoff"), `reporting_pct`, `dem_pct`, `rep_pct`, `margin` (R minus D, points), `winner`, `source` (AP or state canvass URL) and `as_of`. Set top-level `results_as_of` and, once known, `national_env.house_popular_vote_margin`. The War Room page (`/war-room/`) computes the swing, the backed-vs-non-backed means and the chart from these fields; nothing else needs editing. Baselines (2024 presidential margin; last comparable race) are locked and must not change.

## Google Trends refresh (manual, weekly)

Google returns HTTP 429 to the sandbox. Open a cloud browser on trends.google.com, then call `/trends/api/explore` and `/trends/api/widgetdata/multiline` from inside the page (same origin), one request every few seconds. Keep the term sets fixed: weekly US 2024→today [`Make America Healthy Again`, `/g/11x8sdrsf0`, `maha movement`, `what is maha`, `maha moms`]; `MAHA` vs `MAGA` terms from 2024-07-28; MAHA vs MAGA topics [`/g/11x8sdrsf0`, `/g/11bw1_6lwn`] from 2024-07-28; phrase monthly from 2016-01-01; 12-month [`/g/11x8sdrsf0`, `/m/02l5km`, `/g/11bw1_6lwn`, phrase]. Write into data/trends.json and set `retrieved` plus `retrieved_note` naming any series left on an older pull. Last full refresh: Oct 15, 2026 (12-month topic comparison, geography and related queries still Oct 2).
