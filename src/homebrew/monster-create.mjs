/**
 * Monster Actor Creation – builds an NPC Actor with embedded ability items.
 */

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
 * Create the NPC Actor with embedded ability items.
 * @param {object} wizardData  – from MonsterWizardApp.#data (with size/sizeLetter merged)
 * @param {object} stats       – from computeAllStats()
 * @param {object[]} abilityItems – pre-built item data from buildAbilityItemData()
 * @returns {Promise<Actor|null>}
 */
export async function createMonsterActor(wizardData, stats, abilityItems = []) {
  const d = wizardData;
  const folder = await getOrCreateFolder();

  // Build characteristics object
  const characteristics = {};
  CHAR_KEYS.forEach((key, i) => {
    characteristics[key] = { value: d.characteristics[i] };
  });

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
    items: abilityItems,
  };

  const actor = await Actor.create(actorData);
  return actor;
}
