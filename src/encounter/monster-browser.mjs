/**
 * Monster compendium index querying and filtering.
 * Loads NPC actors from all draw-steel packs and the world actor list.
 */

import { SYSTEM_ID } from "../config.mjs";

/**
 * @typedef {Object} MonsterEntry
 * @property {string} uuid       Full document UUID
 * @property {string} name       Display name
 * @property {string} img        Portrait/token image path
 * @property {number} level      Creature level
 * @property {number} ev         Encounter value
 * @property {string} role       Role key (ambusher, artillery, etc.) — empty for leader/solo
 * @property {string} roleLabel  Localized role label
 * @property {string} organization  Organization key (minion, horde, platoon, elite, leader, solo)
 * @property {string} orgLabel   Localized organization label
 * @property {string} source     Unique source key (pack ID or "world")
 * @property {string} sourceLabel Display label for the source
 */

/** Pack IDs that should be selected by default in the source filter. */
export const DEFAULT_SOURCE_IDS = new Set(["draw-steel.monsters"]);

/** Indexed fields requested from compendium packs. */
const INDEX_FIELDS = [
  "system.ev",
  "system.monster.ev",
  "system.monster.level",
  "system.monster.role",
  "system.monster.organization",
  "img",
];

/**
 * Build a lightweight monster index from all available compendium packs and world actors.
 * @returns {Promise<MonsterEntry[]>}
 */
export async function loadMonsterIndex() {
  const entries = [];

  const roles = ds.CONFIG.monsters.roles;
  const organizations = ds.CONFIG.monsters.organizations;

  // ── Compendium packs ─────────────────────────────────────────────────────
  for (const pack of game.packs) {
    if (pack.documentName !== "Actor") continue;
    // Only include system packs and module packs that belong to the draw-steel ecosystem
    const meta = pack.metadata;
    if (meta.packageType === "system" && meta.packageName !== SYSTEM_ID) continue;

    try {
      const index = await pack.getIndex({ fields: INDEX_FIELDS });
      // Build a display label: use pack title for default sources, qualified name otherwise
      const packId = meta.id;
      const sourceLabel = DEFAULT_SOURCE_IDS.has(packId)
        ? pack.title
        : `${pack.title} (${meta.packageName})`;

      for (const entry of index) {
        const monster = entry.system?.monster;
        if (!monster) continue; // skip non-NPC actors (heroes, etc.)

        const org = monster.organization ?? "";
        const role = monster.role ?? "";

        entries.push({
          uuid: `Compendium.${meta.id}.Actor.${entry._id}`,
          name: entry.name,
          img: entry.img || "icons/svg/mystery-man.svg",
          level: monster.level ?? 0,
          ev: entry.system?.ev ?? monster.ev ?? 0,
          role,
          roleLabel: roles[role]?.label ?? "",
          organization: org,
          orgLabel: organizations[org]?.label ?? "",
          source: packId,
          sourceLabel,
        });
      }
    } catch (err) {
      console.warn(`draw-steel-encounter-builder | Failed to index pack ${meta.id}:`, err);
    }
  }

  // ── World actors ─────────────────────────────────────────────────────────
  for (const actor of game.actors) {
    if (actor.type !== "npc") continue;
    const monster = actor.system?.monster;
    if (!monster) continue;

    const org = monster.organization ?? "";
    const role = monster.role ?? "";

    entries.push({
      uuid: actor.uuid,
      name: actor.name,
      img: actor.img || "icons/svg/mystery-man.svg",
      level: monster.level ?? 0,
      ev: actor.system?.ev ?? monster.ev ?? 0,
      role,
      roleLabel: roles[role]?.label ?? "",
      organization: org,
      orgLabel: organizations[org]?.label ?? "",
      source: "world",
      sourceLabel: game.i18n.localize("DSENCOUNTER.Source.World"),
    });
  }

  // Sort alphabetically
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

/**
 * Client-side filter on the cached monster index.
 * @param {MonsterEntry[]} index     Full monster index
 * @param {Object} filters
 * @param {string} [filters.search]        Name substring search (case-insensitive)
 * @param {Set<string>} [filters.roles]    Role keys to include (OR logic)
 * @param {string} [filters.organization]  Organization key to match (exact, or "" for all)
 * @param {Set<string>} [filters.sources]  Source keys to include (OR logic). Empty set = all.
 * @param {number} [filters.level]         Level to match (0 = all, -1 = use levelRange)
 * @param {{min: number, max: number, soloMax: number}} [filters.levelRange] Used when level === -1
 * @returns {MonsterEntry[]}
 */
export function filterMonsters(index, { search = "", roles = new Set(), organization = "", sources = new Set(), level = 0, levelRange = null } = {}) {
  const needle = search.toLowerCase().trim();

  return index.filter((m) => {
    if (needle && !m.name.toLowerCase().includes(needle)) return false;
    if (roles.size > 0 && !roles.has(m.role) && !roles.has(m.organization)) return false;
    if (organization && m.organization !== organization) return false;
    if (sources.size > 0 && !sources.has(m.source)) return false;
    if (level > 0 && m.level !== level) return false;
    if (level === -1 && levelRange) {
      const max = m.organization === "solo" ? levelRange.soloMax : levelRange.max;
      if (m.level < levelRange.min || m.level > max) return false;
    }
    return true;
  });
}

/**
 * Collect unique source entries from the monster index.
 * @param {MonsterEntry[]} index
 * @returns {{value: string, label: string, isDefault: boolean}[]} Sorted source options
 */
export function getSourceOptions(index) {
  const map = new Map();
  for (const m of index) {
    if (m.source && !map.has(m.source)) {
      map.set(m.source, {
        value: m.source,
        label: m.sourceLabel,
        isDefault: DEFAULT_SOURCE_IDS.has(m.source),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Return role options from the Draw Steel CONFIG.
 * @returns {{value: string, label: string}[]}
 */
export function getRoleOptions() {
  return Object.entries(ds.CONFIG.monsters.roles).map(([value, { label }]) => ({ value, label }));
}

/**
 * Return organization options from the Draw Steel CONFIG.
 * @returns {{value: string, label: string}[]}
 */
export function getOrganizationOptions() {
  return Object.entries(ds.CONFIG.monsters.organizations).map(([value, { label }]) => ({ value, label }));
}
