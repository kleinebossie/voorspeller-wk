import json
import os
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError

API_KEY = os.getenv("ODDS_API_KEY")
if not API_KEY:
    raise SystemExit("ODDS_API_KEY is not set")

BASE_URL = "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/"
BASE_QUERY = {
    "regions": "eu",
    "oddsFormat": "decimal",
    "dateFormat": "iso",
    "apiKey": API_KEY,
}

MATCH_MARKETS = ["h2h", "totals", "player_first_goal_scorer"]
FIRST_SCORER_KEYS = ["player_first_goal_scorer", "first_goal_scorer"]

TOURNAMENT_MARKETS = [
    {"key": "outrights", "label": "Champion"},
    {"key": "top_scorer", "label": "Topscorer"},
    {"key": "to_win_group", "label": "Group Winner"},
    {"key": "to_reach_round_of_32", "label": "Round of 32"},
    {"key": "to_reach_round_of_16", "label": "Round of 16"},
    {"key": "to_reach_quarter_finals", "label": "Quarter Finalist"},
    {"key": "to_reach_semi_finals", "label": "Semi-Finalist"},
    {"key": "to_reach_final", "label": "Finalist"},
    {"key": "to_reach_third_place_playoff", "label": "Match for 3rd place"},
    {"key": "to_finish_3rd", "label": "3rd Place"},
]


def fetch_odds(markets):
    query = {**BASE_QUERY, "markets": ",".join(markets)}
    url = f"{BASE_URL}?{urllib.parse.urlencode(query)}"
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_first_scorer(market):
    if not market:
        return []

    outcomes = []
    for outcome in market.get("outcomes", []):
        name = outcome.get("name")
        price = outcome.get("price")
        if not (name and price):
            continue
        outcomes.append({"name": name, "price": price})

    outcomes.sort(key=lambda item: item["price"])
    return outcomes


def parse_match_events(payload):
    matches = []
    for event in payload:
        home_team = event.get("home_team")
        away_team = event.get("away_team")
        commence_time = event.get("commence_time")
        bookmakers = event.get("bookmakers", [])

        selected_h2h = None
        selected_totals = None
        selected_first_scorer = []
        selected_bookmaker = None

        for bookmaker in bookmakers:
            markets = bookmaker.get("markets", [])
            h2h_market = next((m for m in markets if m.get("key") == "h2h"), None)
            totals_market = next((m for m in markets if m.get("key") == "totals"), None)
            scorer_market = next(
                (m for m in markets if m.get("key") in FIRST_SCORER_KEYS), None
            )
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
            selected_first_scorer = parse_first_scorer(scorer_market)
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
                "odds": {
                    "h2h": selected_h2h,
                    "totals": selected_totals,
                    "first_scorer": selected_first_scorer,
                },
                "meta": {
                    "bookmaker": selected_bookmaker,
                    "league": event.get("sport_title"),
                },
            }
        )

    return matches


def parse_tournament_market(payload, key, label):
    for event in payload:
        bookmakers = event.get("bookmakers", [])
        for bookmaker in bookmakers:
            markets = bookmaker.get("markets", [])
            market = next((m for m in markets if m.get("key") == key), None)
            if not market:
                continue

            outcomes = []
            for outcome in market.get("outcomes", []):
                name = outcome.get("name")
                price = outcome.get("price")
                if not (name and price):
                    continue
                outcomes.append({"name": name, "price": price})

            if not outcomes:
                continue

            outcomes.sort(key=lambda item: item["price"])
            return {
                "key": key,
                "label": label,
                "outcomes": outcomes,
                "meta": {
                    "bookmaker": bookmaker.get("title"),
                    "event": event.get("name") or event.get("sport_title"),
                    "last_update": market.get("last_update"),
                },
            }

    return None


missing_match_markets = []
try:
    match_payload = fetch_odds(MATCH_MARKETS)
except (HTTPError, URLError):
    match_payload = fetch_odds(["h2h", "totals"])
    missing_match_markets.append("player_first_goal_scorer")

matches = parse_match_events(match_payload)

tournament_markets = []
missing_tournament_markets = []

for market in TOURNAMENT_MARKETS:
    try:
        payload = fetch_odds([market["key"]])
    except (HTTPError, URLError):
        missing_tournament_markets.append(market["key"])
        continue

    parsed = parse_tournament_market(payload, market["key"], market["label"])
    if parsed:
        tournament_markets.append(parsed)
    else:
        missing_tournament_markets.append(market["key"])

output = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "source": "the-odds-api",
    "matches": matches,
    "tournament_markets": tournament_markets,
    "notes": {
        "missing_tournament_markets": missing_tournament_markets,
        "missing_match_markets": missing_match_markets,
    },
}

output_path = pathlib.Path("public/data/odds.json")
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(output, indent=2, ensure_ascii=True), encoding="utf-8")
