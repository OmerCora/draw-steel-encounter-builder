/**
 * Monster Actor Creation – builds an NPC Actor with embedded signature ability.
 */

import { calcPotency } from "./monster-calc.mjs";

const CHAR_KEYS = ["might", "agility", "reason", "intuition", "presence"];
const HOMEBREW_FOLDER = "Homebrew Monsters";

/**
 * Get or create the "Homebrew Monsters" actor folder.
 * @returns {Promise<Folder>}
 */
async function getOrCreateFolder() {
  let folder = game.folders.find(f => f.type === "Actor" && f.name === HOMEBREW_FOLDER);
  if (!folder) {
    folder = await Folder.create({ name: HOMEBREW_FOLDER, type: "Actor" });
  }
  return folder;
}

/**
 * Build the keyed power.effects object from the wizard's powerRollEffects array.
 * Returns an object keyed by random IDs matching the system CollectionField format.
 */
function buildPowerEffects(wizardEffects, stats) {
  const effects = {};
  for (const eff of wizardEffects) {
    const id = eff.id || foundry.utils.randomID();
    const base = { _id: id, name: eff.name || "", img: null, type: eff.type, sort: 0 };

    switch (eff.type) {
      case "damage": {
        const t1 = eff.tier1Value || String(stats.tierDamage[1]);
        const t2 = eff.tier2Value || String(stats.tierDamage[2]);
        const t3 = eff.tier3Value || String(stats.tierDamage[3]);
        const types = new Set(eff.damageTypes ?? []);
        base.damage = {
          tier1: { value: t1, types, ignoredImmunities: new Set(), potency: { value: "@potency.weak", characteristic: "none" } },
          tier2: { value: t2, types, ignoredImmunities: new Set(), potency: { value: "@potency.average", characteristic: "" } },
          tier3: { value: t3, types, ignoredImmunities: new Set(), potency: { value: "@potency.strong", characteristic: "" } },
        };
        break;
      }
      case "applied": {
        const tiers = {};
        for (const tier of [1, 2, 3]) {
          const condition = eff[`tier${tier}Condition`] || "dazed";
          const endType = eff[`tier${tier}ConditionEnd`] || "";
          const potencyKey = tier === 1 ? "weak" : tier === 2 ? "average" : "strong";
          const charVal = tier === 1 ? "none" : "";
          const effectEntry = { condition: "always", end: endType, properties: new Set() };
          tiers[`tier${tier}`] = {
            display: tier === 1 ? condition : "",
            effects: { [condition]: { ...effectEntry } },
            potency: { value: `@potency.${potencyKey}`, characteristic: charVal },
          };
        }
        base.applied = tiers;
        break;
      }
      case "forced": {
        const tiers = {};
        for (const tier of [1, 2, 3]) {
          const movement = new Set([eff[`tier${tier}Movement`] || "push"]);
          const potencyKey = tier === 1 ? "weak" : tier === 2 ? "average" : "strong";
          const charVal = tier === 1 ? "none" : "";
          tiers[`tier${tier}`] = {
            display: "{{forced}}",
            movement,
            distance: String(eff[`tier${tier}Distance`] ?? tier),
            properties: new Set(),
            potency: { value: `@potency.${potencyKey}`, characteristic: charVal },
          };
        }
        base.forced = tiers;
        break;
      }
      case "other": {
        base.other = {
          tier1: { display: eff.tier1Display || "", potency: { value: "@potency.weak", characteristic: "none" } },
          tier2: { display: eff.tier2Display || "", potency: { value: "@potency.average", characteristic: "" } },
          tier3: { display: eff.tier3Display || "", potency: { value: "@potency.strong", characteristic: "" } },
        };
        break;
      }
      case "resource": {
        const resType = eff.resourceType || "surge";
        base.resource = {
          tier1: { amount: eff.tier1Amount ?? 1, type: resType, display: "", potency: { value: "@potency.weak", characteristic: "none" } },
          tier2: { amount: eff.tier2Amount ?? 2, type: resType, display: "", potency: { value: "@potency.average", characteristic: "" } },
          tier3: { amount: eff.tier3Amount ?? 3, type: resType, display: "", potency: { value: "@potency.strong", characteristic: "" } },
        };
        break;
      }
    }
    effects[id] = base;
  }
  return effects;
}

/**
 * Build the distance object from wizard data, supporting all 10 distance types.
 */
function buildDistance(d) {
  const dist = { type: d.distanceType };
  switch (d.distanceType) {
    case "melee":
    case "ranged":
    case "aura":
    case "burst":
      dist.primary = d.distancePrimary ?? 1;
      break;
    case "meleeRanged":
      dist.primary = d.distancePrimary ?? 1;
      dist.secondary = d.distanceSecondary ?? 1;
      break;
    case "cube":
    case "wall":
      dist.primary = d.distancePrimary ?? 1;
      dist.secondary = d.distanceSecondary ?? 1;
      break;
    case "line":
      dist.primary = d.distancePrimary ?? 1;
      dist.secondary = d.distanceSecondary ?? 1;
      dist.tertiary = d.distanceTertiary ?? 1;
      break;
    // special and self have no numeric fields
  }
  return dist;
}

/**
 * Create the NPC Actor with embedded signature ability item.
 * @param {object} wizardData  – from MonsterWizardApp.#data (with size/sizeLetter merged)
 * @param {object} stats       – from computeAllStats()
 * @returns {Promise<Actor|null>}
 */
export async function createMonsterActor(wizardData, stats) {
  const d = wizardData;
  const folder = await getOrCreateFolder();

  // Build characteristics object
  const characteristics = {};
  CHAR_KEYS.forEach((key, i) => {
    characteristics[key] = { value: d.characteristics[i] };
  });

  // Determine highest characteristic for potency
  const highestChar = Math.max(0, ...d.characteristics);
  const potency = calcPotency(highestChar, d.orgKey);

  // Build immunities object
  const immunities = {};
  for (const entry of (d.immunities ?? [])) {
    immunities[entry.type] = entry.value;
  }

  // Build weaknesses object
  const weaknesses = {};
  for (const entry of (d.weaknesses ?? [])) {
    weaknesses[entry.type] = entry.value;
  }

  // Items array (abilities)
  const items = [];

  // Signature ability (only if user added one)
  if (d.hasSignature) {
    const distance = buildDistance(d);

    // Auto-select power roll characteristics or use user's selection
    const rollChars = d.powerRollChars?.length > 0
      ? new Set(d.powerRollChars)
      : new Set(CHAR_KEYS.filter((_, i) => d.characteristics[i] === highestChar));

    const powerEffects = buildPowerEffects(d.powerRollEffects ?? [], stats);

    const abilityData = {
      type: "ability",
      name: d.abilityName || `${d.name} Strike`,
      system: {
        category: "signature",
        type: "action",
        keywords: new Set(d.abilityKeywords || []),
        distance,
        target: {
          type: d.targetType ?? "creature",
          value: d.targetValue ?? 1,
          custom: d.targetCustom ?? "",
        },
        power: {
          roll: {
            formula: "",
            characteristics: rollChars,
          },
          effects: powerEffects,
        },
      },
    };
    items.push(abilityData);
  }

  // Build the NPC actor data
  const actorData = {
    name: d.name,
    type: "npc",
    folder: folder.id,
    system: {
      ev: stats.ev,
      stamina: { max: stats.stamina },
      characteristics,
      combat: {
        size: { value: d.size, letter: d.sizeLetter },
        stability: d.stability,
        turns: stats.turns,
      },
      movement: {
        value: d.speed,
        types: new Set(d.movementTypes),
      },
      monster: {
        level: d.level,
        role: d.roleKey,
        organization: d.orgKey,
        freeStrike: stats.freeStrike,
        keywords: new Set(d.keywords ?? []),
      },
      damage: {
        immunities,
        weaknesses,
      },
    },
    items,
  };

  const actor = await Actor.create(actorData);
  return actor;
}
