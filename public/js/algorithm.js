(() => {
  const MAX_SCORE = 6;

  const factorial = (n) => {
    let result = 1;
    for (let i = 2; i <= n; i += 1) {
      result *= i;
    }
    return result;
  };

  const poissonPmf = (lambda, k) => {
    if (k < 0) return 0;
    return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
  };

  const bivariatePoissonPmf = (x, y, lambda1, lambda2, lambda3) => {
    const maxShared = Math.min(x, y);
    const base = Math.exp(-(lambda1 + lambda2 + lambda3));
    let sum = 0;
    for (let k = 0; k <= maxShared; k += 1) {
      const term =
        (Math.pow(lambda1, x - k) / factorial(x - k)) *
        (Math.pow(lambda2, y - k) / factorial(y - k)) *
        (Math.pow(lambda3, k) / factorial(k));
      sum += term;
    }
    return base * sum;
  };

  const normalizeImplied = (odds) => {
    const probs = odds.map((odd) => 1 / odd);
    const sum = probs.reduce((acc, val) => acc + val, 0);
    return probs.map((p) => p / sum);
  };

  const solveLambdaFromOverProb = (pOver) => {
    let low = 0.2;
    let high = 6.0;
    for (let i = 0; i < 40; i += 1) {
      const mid = (low + high) / 2;
      const p0 = Math.exp(-mid);
      const p1 = p0 * mid;
      const p2 = p1 * mid / 2;
      const pUnder = p0 + p1 + p2;
      const pMidOver = 1 - pUnder;
      if (pMidOver > pOver) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return (low + high) / 2;
  };

  const drawProbability = (meanA, meanB, lambda3, limit = 10) => {
    const lambda1 = Math.max(0.0001, meanA - lambda3);
    const lambda2 = Math.max(0.0001, meanB - lambda3);
    let total = 0;
    for (let k = 0; k <= limit; k += 1) {
      total += bivariatePoissonPmf(k, k, lambda1, lambda2, lambda3);
    }
    return total;
  };

  const fitLambda3 = (meanA, meanB, targetDraw) => {
    const maxLambda3 = Math.max(0, Math.min(meanA, meanB) - 0.001);
    if (maxLambda3 <= 0) return 0;

    let low = 0;
    let high = maxLambda3;
    for (let i = 0; i < 30; i += 1) {
      const mid = (low + high) / 2;
      const draw = drawProbability(meanA, meanB, mid, 12);
      if (draw > targetDraw) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return (low + high) / 2;
  };

  const computeExpectedGoals = (odds) => {
    const h2hOdds = [odds.h2h.home, odds.h2h.draw, odds.h2h.away];
    const [pHome, pDraw, pAway] = normalizeImplied(h2hOdds);

    const totalsOdds = [odds.totals.over_2_5, odds.totals.under_2_5];
    const [pOver] = normalizeImplied(totalsOdds);
    const lambdaTotal = solveLambdaFromOverProb(pOver);

    const shareHome = pHome + 0.5 * pDraw;
    const shareAway = pAway + 0.5 * pDraw;

    return {
      pHome,
      pDraw,
      pAway,
      meanHome: lambdaTotal * shareHome,
      meanAway: lambdaTotal * shareAway,
    };
  };

  const predictTopScores = (match, params) => {
    const base = computeExpectedGoals(match.odds);

    let meanHome = base.meanHome;
    let meanAway = base.meanAway;

    const avg = (meanHome + meanAway) / 2;
    const diff = meanHome - meanAway;
    const diffAdjusted = diff * params.riskFactor;
    meanHome = avg + diffAdjusted / 2;
    meanAway = avg - diffAdjusted / 2;

    meanHome *= params.goalFactor;
    meanAway *= params.goalFactor;

    if (params.homeAmericas) {
      meanHome *= 1 + 0.1 * params.continentFactor;
    }
    if (params.awayAmericas) {
      meanAway *= 1 + 0.1 * params.continentFactor;
    }

    const chaosMultiplier = 1 + 0.05 * params.chaosFactor;
    meanHome *= chaosMultiplier;
    meanAway *= chaosMultiplier;

    const targetDraw = Math.min(0.55, base.pDraw + 0.04 * params.chaosFactor);
    let lambda3 = fitLambda3(meanHome, meanAway, targetDraw);
    const chaosLambda = lambda3 * (1 + 0.15 * params.chaosFactor);
    lambda3 = Math.max(0, Math.min(chaosLambda, Math.min(meanHome, meanAway) - 0.001));

    const lambda1 = Math.max(0.0001, meanHome - lambda3);
    const lambda2 = Math.max(0.0001, meanAway - lambda3);

    const results = [];
    let totalProb = 0;

    for (let home = 0; home <= MAX_SCORE; home += 1) {
      for (let away = 0; away <= MAX_SCORE; away += 1) {
        const probability = bivariatePoissonPmf(home, away, lambda1, lambda2, lambda3);
        totalProb += probability;
        results.push({ score: `${home}-${away}`, probability });
      }
    }

    results.sort((a, b) => b.probability - a.probability);

    return results.slice(0, 3).map((item) => ({
      score: item.score,
      percent: (item.probability / totalProb) * 100,
    }));
  };

  window.ScorePredictor = { predictTopScores };
})();
