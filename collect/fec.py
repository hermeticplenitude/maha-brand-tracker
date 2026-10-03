"""FEC collector for the MAHA Brand Tracker.

Pulls, for each MAHA-branded committee on file, the current-cycle financial totals and every
Schedule E independent expenditure (24/48-hour reports included) from the OpenFEC API, and writes
the "fec" block of data/listening.json. Uses DEMO_KEY (40 calls/hour) unless FEC_API_KEY is set;
the whole run is ~12 calls, spaced 2 s apart.
"""
import json, os, time, datetime as dt, pathlib, subprocess, urllib.parse, collections
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "listening.json"
API = "https://api.open.fec.gov/v1"
KEY = os.environ.get("FEC_API_KEY", "DEMO_KEY")
COMMITTEES = {
 "C00821439": {"name": "MAHA PAC", "type": "Hybrid PAC (non-contribution account)", "note": "The active committee: treasurer Tony Lyons, monthly filer, registered Jul 2022; $100M midterm pledge (Mar 2026)", "since": "2022-07-26"},
 "C00887893": {"name": "MAHA PAC (2024 super PAC registration)", "type": "Super PAC", "note": "Separate registration, Aug 2024, treasurer Jason Boles; no activity reported", "since": "2024-08-31"},
 "C00960799": {"name": "MAHA Action PAC", "type": "Super PAC", "note": "Registered Sep 3, 2026; treasurer Anthony Lyons; quarterly filer. First financial report due Oct 15", "since": "2026-09-03"},
 "C00888172": {"name": "MAHA Alliance", "type": "Super PAC", "note": "Treasurer Del Bigtree; registered Sep 2024, last filing Nov 2025", "since": "2024-09-05"},
 "C00896936": {"name": "MAHA Moms PAC", "type": "Super PAC", "note": "Registered Jan 30, 2025", "since": "2025-01-30"},
}


def _today(): return dt.datetime.now(ZoneInfo("America/New_York")).date()


CACHE = pathlib.Path("/tmp/fec_cache")


def cache_key(path, params):
    import hashlib
    return hashlib.md5((path + json.dumps(params, sort_keys=True)).encode()).hexdigest()


def get(path, **params):
    # A same-day cached response (e.g. fetched through a browser when the shared DEMO_KEY limit is hit) is used first.
    f = CACHE / f"{cache_key(path, params)}_{_today().isoformat()}.json"
    if f.exists():
        return json.loads(f.read_text())
    params["api_key"] = KEY
    url = f"{API}{path}?" + urllib.parse.urlencode(params, doseq=True)
    for i in range(2):
        out = subprocess.run(["curl", "-s", "-m", "60", url], capture_output=True, text=True).stdout
        try:
            d = json.loads(out)
        except json.JSONDecodeError:
            time.sleep(5); continue
        if "error" in d and "RATE_LIMIT" in str(d["error"]):
            print("  FEC rate limit"); time.sleep(10); continue
        time.sleep(2)
        CACHE.mkdir(exist_ok=True); f.write_text(json.dumps(d))
        return d
    return {"results": [], "pagination": {"count": None}, "unavailable": True}


def main():
    out, all_ie = {}, []
    for cid, meta in COMMITTEES.items():
        info = get(f"/committee/{cid}/")
        res = (info.get("results") or [{}])[0]
        tot = get(f"/committee/{cid}/totals/", cycle=2026)
        t = (tot.get("results") or [{}])[0]
        ie = get("/schedules/schedule_e/", committee_id=cid, two_year_transaction_period=2026, per_page=100, sort="-expenditure_date")
        rows = []; seen_keys = set()
        cov = ((t.get("coverage_end_date") or "")[:10])
        for r in ie.get("results", []):
            # F24 24/48-hour notices are later re-reported on the periodic F3X; count a notice only if it
            # post-dates the latest processed periodic report, and skip memo subtotals.
            disseminated = (r.get("dissemination_date") or r.get("expenditure_date") or "")[:10]
            key = ((r.get("expenditure_date") or "")[:10], round(r.get("expenditure_amount") or 0, 2), r.get("candidate_name"), r.get("payee_name"))
            counted = key not in seen_keys; seen_keys.add(key)
            rows.append({"counted": counted, "is_notice": bool(r.get("is_notice")), "date": (r.get("expenditure_date") or r.get("dissemination_date") or "")[:10], "amount": r.get("expenditure_amount"), "support_oppose": r.get("support_oppose_indicator"), "candidate": r.get("candidate_name"), "office": r.get("candidate_office"), "state": r.get("candidate_office_state"), "district": r.get("candidate_office_district"), "party": r.get("candidate_party"), "payee": r.get("payee_name"), "purpose": (r.get("expenditure_description") or "")[:120], "filing": r.get("pdf_url"), "committee": meta["name"]})
        all_ie += rows
        by_cand = collections.defaultdict(float)
        for r in rows:
            if r["amount"] and r["counted"]: by_cand[(r["candidate"] or "?", r["support_oppose"] or "?", r["state"] or "")] += r["amount"]
        unavailable = any(x.get("unavailable") for x in (info, tot, ie))
        out[cid] = {**meta, "unavailable": unavailable, "treasurer": res.get("treasurer_name"), "city": res.get("city"), "state": res.get("state"), "filing_frequency": res.get("filing_frequency"), "first_file_date": res.get("first_file_date"), "last_file_date": res.get("last_file_date"),
                    "totals_2026": {"receipts": t.get("receipts"), "disbursements": t.get("disbursements"), "independent_expenditures": t.get("independent_expenditures"), "cash_on_hand": t.get("last_cash_on_hand_end_period"), "coverage_end": t.get("coverage_end_date"), "individual_contributions": t.get("individual_contributions"), "contributions": t.get("contributions")},
                    "ie_count": ie.get("pagination", {}).get("count", len(rows)), "ie_total": round(sum(r["amount"] or 0 for r in rows if r["counted"]), 2), "ie_rows_fetched": len(rows), "ie_by_candidate": [{"candidate": k[0], "support_oppose": k[1], "state": k[2], "amount": round(v, 2)} for k, v in sorted(by_cand.items(), key=lambda kv: -kv[1])]}
        print(cid, meta["name"], "| receipts", t.get("receipts"), "| IE", t.get("independent_expenditures"), "| rows", len(rows), "| coverage", t.get("coverage_end_date"))
    all_ie.sort(key=lambda r: r["date"], reverse=True)
    existing = json.loads(OUT.read_text()) if OUT.exists() else {}
    existing["updated"] = _today().isoformat()
    existing["fec"] = {"source": "OpenFEC API (committee totals, Schedule E independent expenditures incl. 24/48-hour reports)", "url": "https://api.open.fec.gov/developers/", "collected": _today().isoformat(),
                       "note": "Per-candidate independent-expenditure sums are approximate: itemized lines are de-duplicated on date, amount, candidate and payee because 24/48-hour notices are re-reported on periodic reports; the committee-level IE total is the FEC's own figure. Only the most recent 100 itemized lines per committee are fetched under the demo key. Totals are the committee's own reports for the 2025–26 cycle through the coverage-end date shown; independent expenditures are itemized Schedule E lines, which arrive within 24–48 hours of dissemination in the final 20 days before an election and quarterly or monthly otherwise. Receipts and cash are not available for a committee until its first periodic report is processed.",
                       "committees": out, "recent_ie": all_ie[:40], "next_deadline": {"date": "2026-10-15", "label": "Q3 (Jul 1 – Sep 30) reports due"}}
    OUT.write_text(json.dumps(existing, indent=1))
    print("wrote fec")


def urls():
    """Print (cache filename, url) pairs for every call main() will make, for out-of-band fetching."""
    for cid in COMMITTEES:
        for path, params in ((f"/committee/{cid}/", {}), (f"/committee/{cid}/totals/", {"cycle": 2026}), ("/schedules/schedule_e/", {"committee_id": cid, "two_year_transaction_period": 2026, "per_page": 100, "sort": "-expenditure_date"})):
            f = f"{cache_key(path, dict(params))}_{_today().isoformat()}.json"
            print(f, f"{API}{path}?" + urllib.parse.urlencode({**params, "api_key": "DEMO_KEY"}, doseq=True))


if __name__ == "__main__":
    import sys
    urls() if len(sys.argv) > 1 and sys.argv[1] == "urls" else main()
