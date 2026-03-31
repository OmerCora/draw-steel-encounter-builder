/**
 * Pure encounter-building math functions.
 * No Foundry dependencies — all inputs are plain numbers/strings.
 */

/**
 * Encounter strength for a single hero at a given level.
 * Formula: 4 + (2 × level)
 * @param {number} level Hero level (1-10)
 * @returns {number}
 */
export function calcHeroES(level) {
  return 4 + 2 * level;
}

/**
 * Effective number of heroes after factoring in average Victories.
 * Every 2 Victories count as +1 hero for ES purposes.
 * @param {number} numHeroes Actual hero count
 * @param {number} avgVictories Average victories per hero
 * @returns {number}
 */
export function getEffectiveHeroCount(numHeroes, avgVictories) {
  return numHeroes + Math.floor(avgVictories / 2);
}

/**
 * Party encounter strength.
 * @param {number} heroLevel  Level shared by all heroes (1-10)
 * @param {number} numHeroes  Number of heroes (1-8)
 * @param {number} avgVictories Average victories earned (0-16)
 * @returns {number}
 */
export function calcPartyES(heroLevel, numHeroes, avgVictories) {
  const heroES = calcHeroES(heroLevel);
  return heroES * getEffectiveHeroCount(numHeroes, avgVictories);
}

/**
 * Return the budget range {min, max} for a given difficulty.
 * @param {number} partyES  Total party encounter strength
 * @param {number} heroLevel Hero level (used to derive one-hero ES)
 * @param {string} difficulty One of: trivial, easy, standard, hard, extreme
 * @returns {{min: number, max: number}}
 */
export function calcBudgetRange(partyES, heroLevel, difficulty) {
  const oneHeroES = calcHeroES(heroLevel);

  switch (difficulty) {
    case "trivial":
      return { min: 0, max: partyES - oneHeroES - 1 };
    case "easy":
      return { min: partyES - oneHeroES, max: partyES - 1 };
    case "standard":
      return { min: partyES, max: partyES + oneHeroES };
    case "hard":
      return { min: partyES + oneHeroES + 1, max: partyES + 3 * oneHeroES };
    case "extreme":
      return { min: partyES + 3 * oneHeroES + 1, max: Infinity };
    default:
      return { min: partyES, max: partyES + oneHeroES };
  }
}

/**
 * Determine which difficulty a given EV total falls into.
 * @param {number} totalEV  Sum of encounter values selected
 * @param {number} partyES  Total party encounter strength
 * @param {number} heroLevel Hero level
 * @returns {string} difficulty key
 */
export function getDifficulty(totalEV, partyES, heroLevel) {
  const oneHeroES = calcHeroES(heroLevel);

  if (totalEV < partyES - oneHeroES) return "trivial";
  if (totalEV < partyES) return "easy";
  if (totalEV <= partyES + oneHeroES) return "standard";
  if (totalEV <= partyES + 3 * oneHeroES) return "hard";
  return "extreme";
}

/**
 * Recommended creature level range for this party.
 * @param {number} heroLevel   Hero level
 * @param {number} avgVictories Average victories
 * @returns {{min: number, max: number, soloMax: number}}
 */
export function getRecommendedLevelRange(heroLevel, avgVictories) {
  const bonus = avgVictories >= 6 ? 3 : 2;
  return {
    min: 1,
    max: heroLevel + bonus,
    soloMax: heroLevel + 1,
  };
}

/**
 * All difficulties in order, for iteration / dropdown population.
 */
export const DIFFICULTIES = ["trivial", "easy", "standard", "hard", "extreme"];

/**
 * Build adjustment suggestions for ±1 hero.
 * @param {number} heroLevel
 * @param {number} numHeroes
 * @param {number} avgVictories
 * @param {string} difficulty
 * @returns {{addHero: {min: number, max: number}, removeHero: {min: number, max: number}|null}}
 */
export function getAdjustmentSuggestions(heroLevel, numHeroes, avgVictories, difficulty) {
  const addHeroES = calcPartyES(heroLevel, numHeroes + 1, avgVictories);
  const addHeroBudget = calcBudgetRange(addHeroES, heroLevel, difficulty);

  let removeHeroBudget = null;
  if (numHeroes > 1) {
    const removeHeroES = calcPartyES(heroLevel, numHeroes - 1, avgVictories);
    removeHeroBudget = calcBudgetRange(removeHeroES, heroLevel, difficulty);
  }

  return { addHero: addHeroBudget, removeHero: removeHeroBudget };
}
