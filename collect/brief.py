"""Weekly brief generator for the MAHA Brand Tracker.

Reads data/listening.json, data/polls.json, data/midterms.json and data/action.json and writes
data/brief.json (rendered at the top of the site) and BRIEF.md (shareable text). Numbers only;
the one-line 'read' per item is templated from thresholds so the brief is reproducible.
"""
import json, datetime as dt, pathlib
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
D = ROOT / "data"
today = dt.datetime.now(ZoneInfo("America/New_York")).date()
ELECTION = dt.date(2026, 11, 3)


def load(n): return json.loads((D / n).read_text())


def pct(v): return "—" if v is None else f"{v:+.0f}%"


def main():
    L, P, M, A = load("listening.json"), load("polls.json"), load("midterms.json"), load("action.json")
    x, b, g, gn = L.get("x", {}), L.get("bluesky", {}), L.get("gdelt", {}), L.get("googlenews", {})
    items = []
    if x:
        s = x["summary"]; full = x["weekly_counts"][:-1]
        items.append({"k": "X volume", "v": f"{s['last4w_avg_weekly']:,}", "u": "original posts / week", "d": pct(s["change_pct"]),
                      "read": f"{'Falling' if (s['change_pct'] or 0) < -10 else 'Rising' if (s['change_pct'] or 0) > 10 else 'Flat'} month over month; {s['last4w_avg_weekly'] / s['peak_week']['count'] * 100:.1f}% of the election-week peak. MAHA runs at {s['last4w_ratio_to_maga'] * 100:.1f}% of MAGA's X volume.", "href": "#social"})
    if gn:
        n = gn["n"]; crit = gn["tone"].get("critical", 0); inside = gn["critical_origin"].get("inside", 0)
        items.append({"k": "News tone", "v": f"{crit / n * 100:.0f}%", "u": f"of {n} headlines critical", "d": f"{inside / max(crit, 1) * 100:.0f}% from inside",
                      "read": f"Lead theme {list(gn['theme'].keys())[0].replace('-', ' / ')}. {'Inside criticism above one in five critical headlines: watch the base.' if inside / max(crit, 1) >= .2 else 'Inside criticism below one in five critical headlines.'}", "href": "#news"})
    if g and g.get("summary"):
        s = g["summary"]
        items.append({"k": "News volume", "v": f"{s['last4w_volume'] * 1000:.1f}", "u": "per 100k US articles", "d": pct(s["change_pct"]),
                      "read": f"{'Down' if (s['change_pct'] or 0) < 0 else 'Up'} vs the prior four weeks; {s['last4w_volume'] / s['peak_week']['value'] * 100:.0f}% of the Sep 2025 peak.", "href": "#social"})
    if b:
        s = b["summary"]
        items.append({"k": "Bluesky", "v": f"{s['last4w_avg_posts']:.0f}", "u": "posts / week", "d": pct(s["change_pct"]), "read": "Critical-outside channel; steady volume means sustained opposition attention, not growth.", "href": "#social"})
    # newest poll
    polls = sorted(P["identification"], key=lambda p: p["field"].split("/")[1], reverse=True)
    if polls:
        p = polls[0]
        items.append({"k": "Newest poll", "v": f"{p['value']}%", "u": f"{p['construct']} with MAHA ({p['population'].split(' (')[0]})", "d": p["pollster"], "read": (p.get("detail") or "")[:170], "href": "#identification"})
    # money (live from FEC when available)
    fec = L.get("fec", {}).get("committees", {}).get("C00821439")
    if fec and fec.get("totals_2026", {}).get("receipts") is not None:
        t = fec["totals_2026"]
        items.append({"k": "MAHA PAC (FEC)", "v": f"${t['receipts'] / 1e6:.2f}M", "u": "raised vs $100M pledge", "d": "Q3 due Oct 15", "read": f"Through {t['coverage_end'][:10]}: ${t['independent_expenditures'] / 1e3:.0f}K in independent expenditures, ${t['cash_on_hand'] / 1e6:.2f}M cash. MAHA Action PAC (registered Sep 3) files its first report Oct 15.", "href": "#fec-card"})
    else:
        items.append({"k": "MAHA PAC", "v": "$3.18M", "u": "raised vs $100M pledge", "d": "Q3 due Oct 15", "read": "Aug 31 FEC filing; $1.03M cash on hand. The Oct 15 quarterly is the next test.", "href": "#midterms"})
    ga = L.get("googleads")
    if ga:
        tot = sum(v["D"] + v["R"] for v in ga["races"].values()); l4 = sum(v["last4_D"] + v["last4_R"] for v in ga["races"].values())
        items.append({"k": "Google ad spend", "v": f"${tot / 1e6:.1f}M", "u": "by the 20 races' nominees this cycle", "d": f"${l4 / 1e6:.1f}M last 4 wks", "read": f"MAHA organizations: ${ga['maha_orgs_cycle_total']:,.0f} on Google all cycle. The movement is absent from the paid-search and YouTube air war its own races are fighting.", "href": "#c-gads"})
    # next deadlines
    upcoming = []
    for c in A["calendar"]:
        for key, label in (("reg", "registration closes"), ("early", "early voting opens"), ("mail_req", "mail-ballot request deadline")):
            if c.get(key):
                dd = dt.date.fromisoformat(c[key])
                if today <= dd <= today + dt.timedelta(days=10): upcoming.append((dd, f"{c['state']}: {label}"))
    upcoming.sort()
    # checklist counts
    rows = A["checklist"]["rows"]; cnt = {k: sum(1 for r in rows if r["status"] == k) for k in ("delivered", "partial", "none", "reversed")}
    action = (f"{cnt['partial']} of {len(rows)} items on the Democratic 'Reclaiming MAHA' list are proposed or voluntary but not final, {cnt['none']} untouched, {cnt['reversed']} moving the other way, {cnt['delivered']} delivered. "
              "Finalizing any one of the proposed rules (GRAS, front-of-package labels) before Nov 3 removes it from the Democratic list.")
    brief = {"date": today.isoformat(), "days_to_election": (ELECTION - today).days, "items": items,
             "deadlines": [[d.isoformat(), t] for d, t in upcoming[:8]], "action": action, "checklist_counts": cnt}
    (D / "brief.json").write_text(json.dumps(brief, indent=1))
    md = [f"# MAHA by the numbers — week of {today.strftime('%B %-d, %Y')}", f"{brief['days_to_election']} days to Election Day. Source and method for every figure: https://hermeticplenitude.github.io/maha-brand-tracker/", ""]
    for it in items: md.append(f"- **{it['k']}: {it['v']} {it['u']}** ({it['d']}). {it['read']}")
    md += ["", "**Deadlines in the next ten days:** " + ("; ".join(f"{dt.date.fromisoformat(d).strftime('%b %-d')} {t}" for d, t in brief['deadlines']) or "none"), "", "**One thing to act on:** " + action]
    (ROOT / "BRIEF.md").write_text("\n".join(md) + "\n")
    print("\n".join(md))


if __name__ == "__main__":
    main()
