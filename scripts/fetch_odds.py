import json
import os
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timezone

API_KEY = os.getenv("ODDS_API_KEY")
if not API_KEY:
    raise SystemExit("ODDS_API_KEY is not set")

BASE_URL = "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/"
QUERY = {
    "regions": "eu",
    "markets": "h2h,totals",
    "oddsFormat": "decimal",
    "dateFormat": "iso",
    "apiKey": API_KEY,
}

url = f"{BASE_URL}?{urllib.parse.urlencode(QUERY)}"

with urllib.request.urlopen(url, timeout=30) as response:
    payload = json.loads(response.read().decode("utf-8"))

matches = []
for event in payload:
    home_team = event.get("home_team")
    away_team = event.get("away_team")
    commence_time = event.get("commence_time")
    bookmakers = event.get("bookmakers", [])

    selected_h2h = None
    selected_totals = None
    selected_bookmaker = None

    for bookmaker in bookmakers:
        markets = bookmaker.get("markets", [])
        h2h_market = next((m for m in markets if m.get("key") == "h2h"), None)
        totals_market = next((m for m in markets if m.get("key") == "totals"), None)
        if not h2h_market or not totals_market:
            continue

        h2h_outcomes = {o.get("name"): o.get("price") for o in h2h_market.get("outcomes", [])}
        home_price = h2h_outcomes.get(home_team)
        away_price = h2h_outcomes.get(away_team)
        draw_price = h2h_outcomes.get("Draw") or h2h_outcomes.get("Tie")

        if not (home_price and away_price and draw_price):
            continue

        totals_outcomes = totals_market.get("outcomes", [])
        over_price = None
        under_price = None
        for outcome in totals_outcomes:
            if outcome.get("point") != 2.5:
                continue
            if outcome.get("name") == "Over":
                over_price = outcome.get("price")
            elif outcome.get("name") == "Under":
                under_price = outcome.get("price")

        if not (over_price and under_price):
            continue

        selected_h2h = {"home": home_price, "draw": draw_price, "away": away_price}
        selected_totals = {"over_2_5": over_price, "under_2_5": under_price}
        selected_bookmaker = bookmaker.get("title")
        break

    if not (selected_h2h and selected_totals):
        continue

    matches.append(
        {
            "id": event.get("id"),
            "home_team": home_team,
            "away_team": away_team,
            "commence_time": commence_time,
            "odds": {"h2h": selected_h2h, "totals": selected_totals},
            "meta": {"bookmaker": selected_bookmaker, "league": event.get("sport_title")},
        }
    )

output = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "source": "the-odds-api",
    "matches": matches,
}

output_path = pathlib.Path("public/data/odds.json")
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(output, indent=2, ensure_ascii=True), encoding="utf-8")
