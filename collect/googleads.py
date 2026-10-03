"""Google political-ads collector for the MAHA Brand Tracker.

Downloads Google's Political Advertising transparency bundle (CSV, ~300 MB zip; no key), reads the
advertiser-level files (not the 2.8 GB creative file), and reports 2025–26 cycle spend, last-4-week
spend and weekly series for a watchlist of advertisers: MAHA organizations, the nominees in the
tracker's 20 races, and the main anti-Kennedy groups. Writes the "googleads" block of
data/listening.json. Google reports spend in $100 buckets summed per advertiser; it is Google
Ads / YouTube only, and only ads Google classifies as election ads.
"""
import csv, io, json, zipfile, datetime as dt, pathlib, subprocess, collections, sys
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "listening.json"
URL = "https://storage.googleapis.com/political-csv/google-political-ads-transparency-bundle.zip"
ZIP = pathlib.Path("/tmp/google-political-ads-transparency-bundle.zip")
CYCLE_START = "2025-01-05"

# advertiser_id -> (display, race code or group, side)
WATCH = {
 # MAHA organizations and allies
 "AR09243737723800387585": ("MAHA Action Inc", "MAHA orgs", "maha"),
 "AR08749486236135063553": ("Health Freedom Alliance LLC", "MAHA orgs", "maha"),
 # anti-Kennedy / science groups
 "AR14432060296132558849": ("Protect Our Care (Sixteen Thirty Fund)", "Opposition groups", "anti"),
 "AR18376790532610326529": ("314 Action Fund", "Opposition groups", "anti"),
 "AR06364061674814570497": ("314 Action Fund (2)", "Opposition groups", "anti"),
 "AR04962653505857781761": ("314 Action Victory Fund", "Opposition groups", "anti"),
 # Iowa
 "AR03375837293859307521": ("Lahn for Governor", "US-IA Governor", "R"),
 "AR01018549707540004865": ("Rob Sand for Iowa", "US-IA Governor", "D"),
 "AR07192724006250741761": ("Rob Sand for Iowa (2)", "US-IA Governor", "D"),
 "AR11681363180197511169": ("Josh Turek for Iowa", "US-IA Senate", "D"),
 "AR09634060640809123841": ("Ashley Hinson Victory Committee", "US-IA Senate", "R"),
 # Michigan
 "AR06182605508491345921": ("Abdul for US Senate", "US-MI Senate", "D"),
 "AR15565967499483676673": ("Rogers for Senate", "US-MI Senate", "R"),
 "AR12611418866174656513": ("Jocelyn Benson for Governor", "US-MI Governor", "D"),
 "AR03968079542714630145": ("John James for MI", "US-MI Governor", "R"),
 # Ohio
 "AR17185367154455740417": ("Friends of Sherrod Brown", "US-OH Senate", "D"),
 "AR07847388124375154689": ("Friends of Sherrod Brown (2)", "US-OH Senate", "D"),
 "AR16136352711309262849": ("Husted for Senate", "US-OH Senate", "R"),
 "AR06880288689067393025": ("Ohioans for Amy Acton", "US-OH Governor", "D"),
 "AR02147995891569524737": ("Ramaswamy and McColley for Ohio", "US-OH Governor", "R"),
 # Maine
 "AR07861324734904926209": ("Troy Jackson for Maine", "US-ME Senate", "D"),
 "AR12122792866544091137": ("Jackson for Maine", "US-ME Senate", "D"),
 "AR17941971891853983745": ("Collins for Senator", "US-ME Senate", "R"),
 # New Hampshire
 "AR06125378677044674561": ("Chris Pappas for Senate", "US-NH Senate", "D"),
 "AR01247983338619142145": ("Sununu Senator", "US-NH Senate", "R"),
 # Alaska
 "AR12051724274625413121": ("Mary Peltola for Alaska", "US-AK Senate", "D"),
 "AR14164296229420269569": ("Alaskans for Dan Sullivan", "US-AK Senate", "R"),
 # North Carolina
 "AR14800298542844870657": ("Cooper for North Carolina", "US-NC Senate", "D"),
 "AR01652390587262828545": ("Cooper for North Carolina (2)", "US-NC Senate", "D"),
 "AR11367026919078887425": ("Cooper Victory Fund", "US-NC Senate", "D"),
 "AR11079925165843283969": ("Cooper Victory Fund (2)", "US-NC Senate", "D"),
 "AR03998485548938297345": ("Whatley for Senate", "US-NC Senate", "R"),
 "AR09290753622688137217": ("Whatley Victory Committee", "US-NC Senate", "R"),
 # Texas
 "AR03239100352791838721": ("Talarico for Texas", "US-TX Senate", "D"),
 "AR08315048172430819329": ("Talarico for Texas (2)", "US-TX Senate", "D"),
 "AR04415350573562331137": ("Ken Paxton for Senate", "US-TX Senate", "R"),
 # Georgia
 "AR06203148500276871169": ("Jackson for Governor, Inc.", "US-GA Governor", "R"),
 # Nevada
 "AR07572017034926489601": ("Committee to Elect Aaron Ford", "US-NV Governor", "D"),
 "AR07082385815380164609": ("Lombardo for Governor", "US-NV Governor", "R"),
 "AR02034254987088887809": ("Lombardo for Governor (2)", "US-NV Governor", "R"),
 # Wisconsin
 "AR00233328882948767745": ("Crowley for Wisconsin", "US-WI Governor", "D"),
 "AR15612586122486480897": ("Tiffany for Wisconsin", "US-WI Governor", "R"),
 # Arizona
 "AR14479548203336204289": ("Elect Katie Hobbs", "US-AZ Governor", "D"),
 "AR09698232262574735361": ("Elect Katie Hobbs (2)", "US-AZ Governor", "D"),
 "AR11986358325533999105": ("Biggs for Arizona", "US-AZ Governor", "R"),
 # Pennsylvania, Louisiana, Florida
 "AR08894324078228275201": ("Shapiro for Pennsylvania", "US-PA Governor", "D"),
 "AR07922307145884762113": ("Shapiro for Pennsylvania (2)", "US-PA Governor", "D"),
 "AR13580856747966332929": ("Julia Letlow for Louisiana", "US-LA Senate", "R"),
 "AR06235308253316644865": ("Moody for Florida", "US-FL Senate", "R"),
 "AR01617042138833354753": ("Friends of Byron Donalds PAC", "US-FL Governor", "R"),
 "AR00513950157599932417": ("Byron Donalds", "US-FL Governor", "R"),
 "AR07370724776895053825": ("Byron Donalds for Governor", "US-FL Governor", "R"),
 "AR12480579903047073793": ("David Jolly for Governor", "US-FL Governor", "D"),
}


def _today(): return dt.datetime.now(ZoneInfo("America/New_York")).date()


def download():
    if ZIP.exists() and (dt.datetime.now().timestamp() - ZIP.stat().st_mtime) < 20 * 3600:
        return
    print("downloading bundle"); r = subprocess.run(["curl", "-s", "-L", "-m", "600", "-o", str(ZIP), URL])
    if r.returncode or not ZIP.exists() or ZIP.stat().st_size < 10_000_000:
        raise SystemExit("bundle download failed")


def main():
    download()
    z = zipfile.ZipFile(ZIP)
    updated = z.read("google-political-ads-updated.csv").decode().strip().splitlines()[-1]
    weekly = collections.defaultdict(dict)
    with z.open("google-political-ads-advertiser-weekly-spend.csv") as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
            if r["Advertiser_ID"] in WATCH:
                weekly[r["Advertiser_ID"]][r["Week_Start_Date"]] = float(r["Spend_USD"] or 0)
    totals = {}
    with z.open("google-political-ads-advertiser-stats.csv") as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
            if r["Advertiser_ID"] in WATCH:
                totals[r["Advertiser_ID"]] = {"all_time": float(r["Spend_USD"] or 0), "creatives": int(r["Total_Creatives"] or 0)}
    # Also scan for any advertiser whose name contains MAHA / health freedom (new entrants)
    new = []
    with z.open("google-political-ads-advertiser-stats.csv") as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
            n = r["Advertiser_Name"].upper()
            import re
            if (re.search(r"\bMAHA\b", n) or "MAKE AMERICA HEALTHY" in n or "HEALTH FREEDOM" in n) and r["Advertiser_ID"] not in WATCH and "US" in r["Regions"]:
                new.append({"id": r["Advertiser_ID"], "name": r["Advertiser_Name"], "spend": float(r["Spend_USD"] or 0)})
    today = _today(); cutoff4 = (today - dt.timedelta(days=28)).isoformat(); cutoff8 = (today - dt.timedelta(days=56)).isoformat()
    rows = []
    for aid, (name, race, side) in WATCH.items():
        w = weekly.get(aid, {})
        cycle = sum(v for k, v in w.items() if k >= CYCLE_START)
        last4 = sum(v for k, v in w.items() if k >= cutoff4)
        prev4 = sum(v for k, v in w.items() if cutoff8 <= k < cutoff4)
        rows.append({"id": aid, "name": name, "race": race, "side": side, "cycle_spend": cycle, "last4w": last4, "prev4w": prev4, "all_time": totals.get(aid, {}).get("all_time", 0), "creatives": totals.get(aid, {}).get("creatives", 0),
                     "weekly": sorted([[k, v] for k, v in w.items() if k >= CYCLE_START])})
    # race aggregates
    races = collections.defaultdict(lambda: {"D": 0.0, "R": 0.0, "last4_D": 0.0, "last4_R": 0.0})
    for r in rows:
        if r["side"] in ("D", "R"):
            races[r["race"]][r["side"]] += r["cycle_spend"]; races[r["race"]]["last4_" + r["side"]] += r["last4w"]
    maha_total = sum(r["cycle_spend"] for r in rows if r["side"] == "maha"); anti_total = sum(r["cycle_spend"] for r in rows if r["side"] == "anti")
    existing = json.loads(OUT.read_text()) if OUT.exists() else {}
    existing["updated"] = today.isoformat()
    existing["googleads"] = {
        "source": "Google Political Advertising transparency bundle (advertiser weekly spend, advertiser stats)", "url": "https://adstransparency.google.com/political?topic=political&region=US", "bundle": URL, "report_updated_pt": updated,
        "note": "Spend on Google Ads and YouTube for ads Google classifies as election ads, reported in $100 increments per advertiser per week. Cycle = weeks from Jan 5, 2025. Campaign committees are matched by Google's verified advertiser name; some campaigns run under several advertiser accounts, all of which are summed. Google only; it says nothing about TV, Meta or mail.",
        "cycle_start": CYCLE_START, "watchlist": rows, "races": races, "maha_orgs_cycle_total": maha_total, "opposition_groups_cycle_total": anti_total, "new_maha_named_advertisers": new,
    }
    OUT.write_text(json.dumps(existing, indent=1))
    print("wrote googleads | report updated", updated, "| MAHA orgs cycle $", maha_total, "| opposition $", anti_total)
    for code, v in sorted(races.items(), key=lambda kv: -(kv[1]["D"] + kv[1]["R"]))[:8]: print(f"  {code}: D ${v['D']:,.0f}  R ${v['R']:,.0f}  (last 4w D ${v['last4_D']:,.0f} / R ${v['last4_R']:,.0f})")


if __name__ == "__main__":
    main()
