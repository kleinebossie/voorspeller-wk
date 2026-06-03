const state = {
  matches: [],
  selectedIndex: 0,
  matchOfDayIndex: 0,
  tournamentMarkets: [],
  meta: {
    generatedAt: null,
    missingTournamentMarkets: [],
  },
  sliders: {
    riskFactor: 0,
    goalFactor: 0,
    continentFactor: 0,
  },
};

const elements = {
  matchSelect: document.getElementById("matchSelect"),
  matchTitle: document.getElementById("matchTitle"),
  matchMeta: document.getElementById("matchMeta"),
  bookmaker: document.getElementById("bookmaker"),
  predictions: document.getElementById("predictions"),
  predHomeGoals: document.getElementById("predHomeGoals"),
  predAwayGoals: document.getElementById("predAwayGoals"),
  matchOfDayToggle: document.getElementById("matchOfDay"),
  firstScorerRow: document.getElementById("firstScorerRow"),
  firstScorerInput: document.getElementById("firstScorerInput"),
  championPick: document.getElementById("championPick"),
  thirdPlacePick: document.getElementById("thirdPlacePick"),
  topScorerPick: document.getElementById("topScorerPick"),
  round32Pick: document.getElementById("round32Pick"),
  round16Pick: document.getElementById("round16Pick"),
  quarterPick: document.getElementById("quarterPick"),
  semiPick: document.getElementById("semiPick"),
  thirdPlaceMatchPick: document.getElementById("thirdPlaceMatchPick"),
  finalistPick: document.getElementById("finalistPick"),
  groupTeamsPick: document.getElementById("groupTeamsPick"),
  groupRanking: document.getElementById("groupRanking"),
  championOdds: document.getElementById("championOdds"),
  topScorerOdds: document.getElementById("topScorerOdds"),
  matchOfDaySelect: document.getElementById("matchOfDaySelect"),
  matchOfDayTitle: document.getElementById("matchOfDayTitle"),
  matchOfDayMeta: document.getElementById("matchOfDayMeta"),
  matchOfDayBookmaker: document.getElementById("matchOfDayBookmaker"),
  matchOfDayPredictions: document.getElementById("matchOfDayPredictions"),
  firstScorerList: document.getElementById("firstScorerList"),
  tournamentNote: document.getElementById("tournamentNote"),
  generatedAt: document.getElementById("generatedAt"),
  riskSlider: document.getElementById("riskFactor"),
  goalSlider: document.getElementById("goalFactor"),
  continentSlider: document.getElementById("continentFactor"),
  riskValue: document.getElementById("riskValue"),
  goalValue: document.getElementById("goalValue"),
  continentValue: document.getElementById("continentValue"),
};

const americasTeams = new Set([
  "United States",
  "Canada",
  "Mexico",
  "Costa Rica",
  "Panama",
  "Honduras",
  "Jamaica",
  "Brazil",
  "Argentina",
  "Uruguay",
  "Colombia",
  "Chile",
  "Peru",
  "Ecuador",
  "Paraguay",
  "Venezuela",
  "Bolivia",
]);

const isAmericas = (teamName) => americasTeams.has(teamName);

const formatDate = (isoDate) => {
  if (!isoDate) return "TBD";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
};

const formatDateTime = (isoDate) => {
  if (!isoDate) return "-";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
};

const formatOdds = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toFixed(2);
};

const normalizeImplied = (prices) => {
  if (!prices.length) return [];
  const probs = prices.map((price) => 1 / price);
  const sum = probs.reduce((acc, val) => acc + val, 0);
  return probs.map((prob) => (sum > 0 ? prob / sum : 0));
};

const buildParams = (match) => ({
  ...state.sliders,
  homeAmericas: isAmericas(match.home_team),
  awayAmericas: isAmericas(match.away_team),
});

const updateSliderState = (key, value) => {
  state.sliders[key] = Number.parseFloat(value);
};

const renderScorePredictions = (container, match) => {
  if (!match) {
    container.innerHTML = "<div class=\"footer-note\">Geen match data.</div>";
    return;
  }

  const predictions = window.ScorePredictor.predictTopScores(match, buildParams(match));
  container.innerHTML = predictions
    .map(
      (item, index) => `
      <div class="prediction-card" data-score="${item.score}">
        <div class="prediction-rank">#${index + 1}</div>
        <div class="prediction-score">${item.score}</div>
        <div class="prediction-prob">${item.percent.toFixed(1)}%</div>
      </div>
    `
    )
    .join("");
};

const renderFirstScorer = (match) => {
  const outcomes = match?.odds?.first_scorer || [];
  if (!outcomes.length) {
    elements.firstScorerList.innerHTML = "<li class=\"footer-note\">Geen first scorer odds.</li>";
    return;
  }

  const topOutcomes = outcomes.slice(0, 5);
  const implied = normalizeImplied(topOutcomes.map((item) => item.price));
  elements.firstScorerList.innerHTML = topOutcomes
    .map(
      (item, index) => `
      <li class="odds-pill">
        <span>${item.name}</span>
        <span>${formatOdds(item.price)} · ${(implied[index] * 100).toFixed(1)}%</span>
      </li>
    `
    )
    .join("");
};

const buildTeamOptions = (teams, selected = []) =>
  teams
    .map((team) => {
      const isSelected = selected.includes(team);
      return `<option value="${team}" ${isSelected ? "selected" : ""}>${team}</option>`;
    })
    .join("");

const setSelectOptions = (selectEl, options, selected = []) => {
  if (!selectEl) return;
  selectEl.innerHTML = buildTeamOptions(options, selected);
};

const renderTournamentOdds = (marketKey, container) => {
  if (!container) return;
  const market = state.tournamentMarkets.find((item) => item.key === marketKey);
  if (!market || !market.outcomes?.length) {
    container.innerHTML = "<div class=\"footer-note\">Geen odds gevonden.</div>";
    return;
  }

  const topOutcomes = market.outcomes.slice(0, 5);
  const implied = normalizeImplied(topOutcomes.map((item) => item.price));
  container.innerHTML = topOutcomes
    .map(
      (item, index) => `
      <div class="odds-pill">
        <span>${item.name}</span>
        <span>${formatOdds(item.price)} · ${(implied[index] * 100).toFixed(1)}%</span>
      </div>
    `
    )
    .join("");
};

const updateTournamentNote = () => {
  const missing = state.meta.missingTournamentMarkets;
  if (!elements.tournamentNote) return;
  if (!missing.length) {
    elements.tournamentNote.textContent = "Toernooi-odds geladen.";
    return;
  }
  elements.tournamentNote.textContent = `Niet beschikbaar: ${missing.join(", ")}`;
};

const updateMatchUI = () => {
  const match = state.matches[state.selectedIndex];
  if (!match) return;
  elements.matchTitle.textContent = `${match.home_team} vs ${match.away_team}`;
  elements.matchMeta.textContent = `Kickoff: ${formatDate(match.commence_time)}`;
  elements.bookmaker.textContent = `Bookmaker: ${match.meta?.bookmaker || "-"}`;
  renderScorePredictions(elements.predictions, match);
};

const updateMatchOfDayUI = () => {
  const match = state.matches[state.matchOfDayIndex];
  if (!match) return;
  elements.matchOfDayTitle.textContent = `${match.home_team} vs ${match.away_team}`;
  elements.matchOfDayMeta.textContent = `Kickoff: ${formatDate(match.commence_time)}`;
  elements.matchOfDayBookmaker.textContent = `Bookmaker: ${match.meta?.bookmaker || "-"}`;
  renderScorePredictions(elements.matchOfDayPredictions, match);
  renderFirstScorer(match);
};

const applyPredictionScore = (score) => {
  const [home, away] = score.split("-").map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(home) || !Number.isFinite(away)) return;
  elements.predHomeGoals.value = home;
  elements.predAwayGoals.value = away;
};

const updateFirstScorerVisibility = () => {
  const isMatchOfDay = elements.matchOfDayToggle?.checked;
  if (!elements.firstScorerRow) return;
  elements.firstScorerRow.style.display = isMatchOfDay ? "flex" : "none";
};

const updateTournamentPicks = () => {
  const teamSet = new Set();
  state.matches.forEach((match) => {
    teamSet.add(match.home_team);
    teamSet.add(match.away_team);
  });
  state.tournamentMarkets.forEach((market) => {
    (market.outcomes || []).forEach((outcome) => teamSet.add(outcome.name));
  });

  const teams = Array.from(teamSet).sort((a, b) => a.localeCompare(b));
  setSelectOptions(elements.championPick, teams);
  setSelectOptions(elements.thirdPlacePick, teams);
  setSelectOptions(elements.round32Pick, teams);
  setSelectOptions(elements.round16Pick, teams);
  setSelectOptions(elements.quarterPick, teams);
  setSelectOptions(elements.semiPick, teams);
  setSelectOptions(elements.thirdPlaceMatchPick, teams);
  setSelectOptions(elements.finalistPick, teams);
  setSelectOptions(elements.groupTeamsPick, teams);

  const topScorerMarket = state.tournamentMarkets.find((item) => item.key === "top_scorer");
  const scorerOptions = topScorerMarket?.outcomes?.map((outcome) => outcome.name) || [];
  setSelectOptions(elements.topScorerPick, scorerOptions.length ? scorerOptions : teams);

  renderTournamentOdds("outrights", elements.championOdds);
  renderTournamentOdds("top_scorer", elements.topScorerOdds);
};

const bindSlider = (slider, valueEl, key) => {
  slider.addEventListener("input", (event) => {
    updateSliderState(key, event.target.value);
    valueEl.textContent = Number.parseFloat(event.target.value).toFixed(2);
    updateMatchUI();
    updateMatchOfDayUI();
  });
};

const initUI = () => {
  bindSlider(elements.riskSlider, elements.riskValue, "riskFactor");
  bindSlider(elements.goalSlider, elements.goalValue, "goalFactor");
  bindSlider(elements.continentSlider, elements.continentValue, "continentFactor");

  elements.matchSelect.addEventListener("change", (event) => {
    state.selectedIndex = Number.parseInt(event.target.value, 10);
    updateMatchUI();
  });

  elements.matchOfDaySelect.addEventListener("change", (event) => {
    state.matchOfDayIndex = Number.parseInt(event.target.value, 10);
    updateMatchOfDayUI();
  });

  elements.matchOfDayToggle.addEventListener("change", updateFirstScorerVisibility);

  elements.predictions.addEventListener("click", (event) => {
    const card = event.target.closest(".prediction-card");
    if (!card) return;
    const score = card.getAttribute("data-score");
    if (score) applyPredictionScore(score);
  });

  elements.matchOfDayPredictions.addEventListener("click", (event) => {
    const card = event.target.closest(".prediction-card");
    if (!card) return;
    const score = card.getAttribute("data-score");
    if (score) applyPredictionScore(score);
  });

  updateFirstScorerVisibility();
};

fetch("data/odds.json")
  .then((response) => response.json())
  .then((data) => {
    state.matches = data.matches || [];
    state.tournamentMarkets = data.tournament_markets || [];
    state.meta = {
      generatedAt: data.generated_at,
      missingTournamentMarkets: data.notes?.missing_tournament_markets || [],
    };
    elements.matchSelect.innerHTML = state.matches
      .map(
        (match, index) =>
          `<option value="${index}">${match.home_team} vs ${match.away_team}</option>`
      )
      .join("");

    elements.matchOfDaySelect.innerHTML = elements.matchSelect.innerHTML;
    state.matchOfDayIndex = state.selectedIndex;
    elements.matchOfDaySelect.value = String(state.matchOfDayIndex);

    initUI();
    updateMatchUI();
    updateMatchOfDayUI();
    updateTournamentPicks();
    updateTournamentNote();
    elements.generatedAt.textContent = formatDateTime(state.meta.generatedAt);
  })
  .catch(() => {
    elements.matchTitle.textContent = "Unable to load odds data";
  });
