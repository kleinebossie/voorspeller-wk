const state = {
  matches: [],
  selectedIndex: 0,
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

const updateSliderState = (key, value) => {
  state.sliders[key] = Number.parseFloat(value);
};

const updatePredictionUI = () => {
  const match = state.matches[state.selectedIndex];
  if (!match) return;

  const params = {
    ...state.sliders,
    homeAmericas: isAmericas(match.home_team),
    awayAmericas: isAmericas(match.away_team),
  };

  const predictions = window.ScorePredictor.predictTopScores(match, params);
  elements.predictions.innerHTML = predictions
    .map(
      (item, index) => `
      <div class="prediction-card">
        <div class="prediction-rank">#${index + 1}</div>
        <div class="prediction-score">${item.score}</div>
        <div class="prediction-prob">${item.percent.toFixed(1)}%</div>
      </div>
    `
    )
    .join("");
};

const updateMatchUI = () => {
  const match = state.matches[state.selectedIndex];
  if (!match) return;
  elements.matchTitle.textContent = `${match.home_team} vs ${match.away_team}`;
  elements.matchMeta.textContent = `Kickoff: ${formatDate(match.commence_time)}`;
  elements.bookmaker.textContent = `Bookmaker: ${match.meta?.bookmaker || "-"}`;
  updatePredictionUI();
};

const bindSlider = (slider, valueEl, key) => {
  slider.addEventListener("input", (event) => {
    updateSliderState(key, event.target.value);
    valueEl.textContent = Number.parseFloat(event.target.value).toFixed(2);
    updatePredictionUI();
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
};

fetch("data/odds.json")
  .then((response) => response.json())
  .then((data) => {
    state.matches = data.matches || [];
    elements.matchSelect.innerHTML = state.matches
      .map(
        (match, index) =>
          `<option value="${index}">${match.home_team} vs ${match.away_team}</option>`
      )
      .join("");

    initUI();
    updateMatchUI();
  })
  .catch(() => {
    elements.matchTitle.textContent = "Unable to load odds data";
  });
