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
 * @property {Set<string>} keywords  Monster keyword keys (abyssal, beast, etc.)
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
  "system.monster.keywords",
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

  // ── Compendium packs (parallel) ──────────────────────────────────────────
  const actorPacks = game.packs.filter(pack => {
    if (pack.documentName !== "Actor") return false;
    const meta = pack.metadata;
    if (meta.packageType === "system" && meta.packageName !== SYSTEM_ID) return false;
    return true;
  });

  const packResults = await Promise.all(actorPacks.map(async (pack) => {
    const meta = pack.metadata;
    try {
      const index = await pack.getIndex({ fields: INDEX_FIELDS });
      const packId = meta.id;
      const sourceLabel = DEFAULT_SOURCE_IDS.has(packId)
        ? pack.title
        : `${pack.title} (${meta.packageName})`;

      const packEntries = [];
      for (const entry of index) {
        const monster = entry.system?.monster;
        if (!monster) continue;

        const org = monster.organization ?? "";
        const role = monster.role ?? "";

        packEntries.push({
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
          keywords: new Set(monster.keywords ?? []),
        });
      }
      return packEntries;
    } catch (err) {
      console.warn(`draw-steel-encounter-builder | Failed to index pack ${meta.id}:`, err);
      return [];
    }
  }));

  for (const packEntries of packResults) {
    entries.push(...packEntries);
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
      keywords: new Set(monster.keywords ?? []),
    });
  }

  // Sort alphabetically
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

/** @type {Promise<MonsterEntry[]>|null} Shared cache for the monster index. */
let _indexPromise = null;

/**
 * Return the cached monster index, loading it if necessary.
 * Multiple callers will share the same in-flight promise.
 * @param {boolean} [force=false] Force a fresh reload.
 * @returns {Promise<MonsterEntry[]>}
 */
export function getCachedMonsterIndex(force = false) {
  if (!_indexPromise || force) {
    _indexPromise = loadMonsterIndex();
  }
  return _indexPromise;
}

/**
 * Pre-warm the monster index cache (call from the ready hook).
 * Does not block — just starts the async load.
 */
export function preloadMonsterIndex() {
  getCachedMonsterIndex();
}

/**
 * Client-side filter on the cached monster index.
 * @param {MonsterEntry[]} index     Full monster index
 * @param {Object} filters
 * @param {string} [filters.search]        Name substring search (case-insensitive)
 * @param {Set<string>} [filters.roles]    Role keys to include (OR logic)
 * @param {string} [filters.organization]  Organization key to match (exact, or "" for all)
 * @param {Set<string>} [filters.sources]  Source keys to include (OR logic). Empty set = all.
 * @param {Set<string>} [filters.keywords]  Keyword keys to include (AND logic). Empty set = all.
 * @param {number} [filters.level]         Level to match (0 = all, -1 = use levelRange)
 * @param {{min: number, max: number, soloMax: number}} [filters.levelRange] Used when level === -1
 * @returns {MonsterEntry[]}
 */
export function filterMonsters(index, { search = "", roles = new Set(), organization = "", sources = new Set(), keywords = new Set(), level = 0, levelRange = null } = {}) {
  const needle = search.toLowerCase().trim();

  return index.filter((m) => {
    if (needle && !m.name.toLowerCase().includes(needle)) return false;
    if (roles.size > 0 && !roles.has(m.role) && !roles.has(m.organization)) return false;
    if (organization && m.organization !== organization) return false;
    if (sources.size > 0 && !sources.has(m.source)) return false;
    if (keywords.size > 0) {
      let hasAny = false;
      for (const kw of keywords) {
        if (m.keywords.has(kw)) { hasAny = true; break; }
      }
      if (!hasAny) return false;
    }
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

/**
 * Return keyword options from the Draw Steel CONFIG.
 * @returns {{value: string, label: string}[]}
 */
export function getKeywordOptions() {
  return Object.entries(ds.CONFIG.monsters.keywords).map(([value, { label }]) => ({ value, label }));
}
