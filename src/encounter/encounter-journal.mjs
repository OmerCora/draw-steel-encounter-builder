/**
 * Journal entry creation for encounter output.
 * Builds a JournalEntry with a text page containing @UUID links to selected monsters.
 */

import { MODULE_ID } from "../config.mjs";
import {
  calcPartyES, calcBudgetRange, calcHeroES,
  getDifficulty, getEffectiveHeroCount, getAdjustmentSuggestions,
} from "./encounter-calc.mjs";

/**
 * Create a JournalEntry summarizing the encounter.
 * @param {Object} data
 * @param {number} data.heroLevel
 * @param {number} data.numHeroes
 * @param {number} data.avgVictories
 * @param {string} data.difficulty
 * @param {Array} data.selectedMonsters
 * @param {Array} data.groups
 */
export async function createEncounterJournal(data) {
  const { heroLevel, numHeroes, avgVictories, difficulty, selectedMonsters, groups } = data;

  const partyES = calcPartyES(heroLevel, numHeroes, avgVictories);
  const budget = calcBudgetRange(partyES, heroLevel, difficulty);
  const totalEV = calcSelectedEV(selectedMonsters);
  const heroES = calcHeroES(heroLevel);
  const effectiveHeroes = getEffectiveHeroCount(numHeroes, avgVictories);
  const currentDifficulty = getDifficulty(totalEV, partyES, heroLevel);
  const adjustments = getAdjustmentSuggestions(heroLevel, numHeroes, avgVictories, difficulty);

  const difficultyLabel = game.i18n.localize(`DSENCOUNTER.Difficulty.${capitalize(difficulty)}`);
  const currentDiffLabel = game.i18n.localize(`DSENCOUNTER.Difficulty.${capitalize(currentDifficulty)}`);

  // ── Build HTML content ──────────────────────────────────────────────────
  let html = `<h2>${game.i18n.localize("DSENCOUNTER.Journal.EncounterSummary")}</h2>`;

  // Summary table
  html += `<table><tbody>`;
  html += row(game.i18n.localize("DSENCOUNTER.Journal.TargetDifficulty"), difficultyLabel);
  html += row(game.i18n.localize("DSENCOUNTER.Journal.ActualDifficulty"), `<strong>${currentDiffLabel}</strong>`);
  html += row(game.i18n.localize("DSENCOUNTER.Journal.TotalEV"), totalEV);
  html += row(game.i18n.localize("DSENCOUNTER.Journal.BudgetRange"),
    isFinite(budget.max) ? `${budget.min} – ${budget.max}` : `${budget.min}+`);
  html += row(game.i18n.localize("DSENCOUNTER.Journal.PartyES"), partyES);
  html += row(game.i18n.localize("DSENCOUNTER.Journal.HeroLevel"), heroLevel);
  html += row(game.i18n.localize("DSENCOUNTER.Journal.NumHeroes"), numHeroes);
  if (avgVictories > 0) {
    html += row(game.i18n.localize("DSENCOUNTER.Journal.AvgVictories"), avgVictories);
    html += row(game.i18n.localize("DSENCOUNTER.Journal.EffectiveHeroes"), effectiveHeroes);
  }
  html += `</tbody></table>`;

  // ── Monster list ────────────────────────────────────────────────────────
  html += `<h2>${game.i18n.localize("DSENCOUNTER.Journal.Creatures")}</h2>`;

  // Ungrouped monsters
  const ungrouped = selectedMonsters.filter((m) => !m.groupId);
  if (ungrouped.length > 0) {
    html += buildMonsterListHTML(ungrouped);
  }

  // Grouped monsters
  for (const group of groups) {
    const groupMonsters = selectedMonsters.filter((m) => m.groupId === group.id);
    if (groupMonsters.length === 0) continue;

    html += `<h3>${escapeHTML(group.name)}</h3>`;
    const captain = groupMonsters.find((m) => m.isSquadCaptain);
    if (captain) {
      html += `<p><em>${game.i18n.localize("DSENCOUNTER.Journal.SquadCaptain")}: @UUID[${captain.uuid}]{${escapeHTML(captain.name)}}</em></p>`;
    }
    html += buildMonsterListHTML(groupMonsters);
  }

  // ── Adjustment suggestions ──────────────────────────────────────────────
  html += `<h2>${game.i18n.localize("DSENCOUNTER.Journal.Adjustments")}</h2>`;
  html += `<ul>`;
  html += `<li>${game.i18n.format("DSENCOUNTER.Journal.AddHero", {
    heroes: numHeroes + 1,
    min: adjustments.addHero.min,
    max: isFinite(adjustments.addHero.max) ? adjustments.addHero.max : `${adjustments.addHero.min}+`,
  })}</li>`;
  if (adjustments.removeHero) {
    html += `<li>${game.i18n.format("DSENCOUNTER.Journal.RemoveHero", {
      heroes: numHeroes - 1,
      min: adjustments.removeHero.min,
      max: isFinite(adjustments.removeHero.max) ? adjustments.removeHero.max : `${adjustments.removeHero.min}+`,
    })}</li>`;
  }
  html += `</ul>`;

  // ── Create the JournalEntry ─────────────────────────────────────────────
  const journalName = `${game.i18n.localize("DSENCOUNTER.Journal.EncounterPrefix")}: ${difficultyLabel} (EV ${totalEV})`;

  const journal = await JournalEntry.create({
    name: journalName,
    pages: [{
      name: game.i18n.localize("DSENCOUNTER.Journal.EncounterDetails"),
      type: "text",
      text: { content: html },
    }],
  });

  // Open the journal
  journal.sheet.render(true);

  ui.notifications.info(game.i18n.format("DSENCOUNTER.Journal.Created", { name: journalName }));
}

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

function row(label, value) {
  return `<tr><td><strong>${label}</strong></td><td>${value}</td></tr>`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function buildMonsterListHTML(monsters) {
  // Aggregate by UUID
  const map = new Map();
  for (const m of monsters) {
    const existing = map.get(m.uuid);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(m.uuid, { ...m, count: 1 });
    }
  }

  let html = `<ul>`;
  for (const m of map.values()) {
    const countStr = m.count > 1 ? ` (×${m.count})` : "";
    const roleStr = m.roleLabel || m.orgLabel;
    const captainStr = m.isSquadCaptain ? ` ⚔️` : "";
    html += `<li>@UUID[${m.uuid}]{${escapeHTML(m.name)}}${countStr} — ${roleStr}, `;
    html += `${game.i18n.localize("DSENCOUNTER.Journal.Level")} ${m.level} (EV ${m.ev})${captainStr}</li>`;
  }
  html += `</ul>`;
  return html;
}

function calcSelectedEV(selectedMonsters) {
  let total = 0;
  const uuidCounts = new Map();
  for (const m of selectedMonsters) {
    uuidCounts.set(m.uuid, (uuidCounts.get(m.uuid) || 0) + 1);
  }
  const counted = new Set();
  for (const m of selectedMonsters) {
    if (counted.has(m.uuid)) continue;
    counted.add(m.uuid);
    const count = uuidCounts.get(m.uuid);
    if (m.organization === "minion") {
      total += Math.ceil(count / 4) * m.ev;
    } else {
      total += count * m.ev;
    }
  }
  return total;
}
