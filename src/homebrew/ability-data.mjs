/**
 * Shared ability data constants, factories, and context builders.
 * Used by both the Monster Builder and standalone Ability Wizard.
 */

/* -------------------------------------------------- */
/*  Constants                                         */
/* -------------------------------------------------- */

export const CHAR_KEYS = ["might", "agility", "reason", "intuition", "presence"];
export const CHAR_ABBREVS = ["MGT", "AGI", "REA", "INT", "PRS"];

export const DISTANCE_TYPES = [
  "melee", "ranged", "meleeRanged", "aura", "burst", "cube", "line", "wall", "special", "self",
];

export const CONDITION_TYPES = [
  "bleeding", "dazed", "frightened", "grabbed", "prone",
  "restrained", "slowed", "surprised", "taunted", "weakened",
];

export const EFFECT_TYPES = ["damage", "applied", "forced", "other", "resource"];

export const CONDITION_END_TYPES = ["", "turn", "save", "encounter", "respite"];

export const FORCED_MOVEMENT_TYPES = ["push", "pull", "slide"];

export const RESOURCE_TYPES = ["surge", "heroic", "epic"];

export const POTENCY_CHARS = ["", "none", "might", "agility", "reason", "intuition", "presence"];

export const CONDITION_END_ABBREVIATIONS = {
  "": "",
  turn: "EoT",
  save: "save ends",
  encounter: "EoE",
  respite: "respite ends",
};

export const ABILITY_KEYWORDS = {
  animal:        { label: "Animal",        group: "Fury" },
  animapathy:    { label: "Animapathy",    group: "Talent" },
  area:          { label: "Area" },
  charge:        { label: "Charge" },
  chronopathy:   { label: "Chronopathy",   group: "Talent" },
  cryokinesis:   { label: "Cryokinesis",   group: "Talent" },
  earth:         { label: "Earth",         group: "Elementalist" },
  encounter:     { label: "Encounter" },
  fire:          { label: "Fire",          group: "Elementalist" },
  green:         { label: "Green",         group: "Elementalist" },
  magic:         { label: "Magic" },
  melee:         { label: "Melee" },
  metamorphosis: { label: "Metamorphosis", group: "Talent" },
  psionic:       { label: "Psionic" },
  pyrokinesis:   { label: "Pyrokinesis",   group: "Talent" },
  ranged:        { label: "Ranged" },
  resopathy:     { label: "Resopathy",     group: "Talent" },
  rot:           { label: "Rot",           group: "Elementalist" },
  performance:   { label: "Performance",   group: "Troubador" },
  strike:        { label: "Strike" },
  telekinesis:   { label: "Telekinesis",   group: "Talent" },
  telepathy:     { label: "Telepathy",     group: "Talent" },
  void:          { label: "Void",          group: "Elementalist" },
  weapon:        { label: "Weapon" },
};

export const TARGET_TYPES = [
  "creature", "object", "creatureObject", "enemy", "enemyObject",
  "ally", "selfAlly", "self", "selfOrAlly", "selfOrCreature", "special",
];

/** Target types that display a numeric value field. */
export const TARGET_HAS_VALUE = new Set([
  "creature", "object", "creatureObject", "enemy", "enemyObject", "ally", "selfAlly",
]);

export const DISTANCE_LABELS = {
  melee: "Melee",
  ranged: "Ranged",
  meleeRanged: "Melee / Ranged",
  aura: "Aura",
  burst: "Burst",
  cube: "Cube",
  line: "Line",
  wall: "Wall",
  special: "Special",
  self: "Self",
};

export const DISTANCE_FIELDS = {
  melee:       [{ label: "Melee", dataKey: "distancePrimary" }],
  ranged:      [{ label: "Ranged", dataKey: "distancePrimary" }],
  meleeRanged: [{ label: "Melee", dataKey: "distancePrimary" }, { label: "Ranged", dataKey: "distanceSecondary" }],
  aura:        [{ label: "Aura", dataKey: "distancePrimary" }],
  burst:       [{ label: "Burst", dataKey: "distancePrimary" }],
  cube:        [{ label: "Length", dataKey: "distancePrimary" }, { label: "Ranged", dataKey: "distanceSecondary" }],
  line:        [{ label: "Length", dataKey: "distancePrimary" }, { label: "Width", dataKey: "distanceSecondary" }, { label: "Ranged", dataKey: "distanceTertiary" }],
  wall:        [{ label: "Squares", dataKey: "distancePrimary" }, { label: "Ranged", dataKey: "distanceSecondary" }],
  special:     [],
  self:        [],
};

export const DAMAGE_TYPES = [
  "acid", "cold", "corruption", "fire", "holy", "lightning", "poison", "psychic", "sonic",
];

/** Ability categories from the system (abilityCategories). */
export const ABILITY_CATEGORIES = {
  heroic:    { label: "Heroic" },
  freeStrike: { label: "Free Strike" },
  signature: { label: "Signature" },
  villain:   { label: "Villain" },
};

/** Ability types (action types) from the system. */
export const ABILITY_TYPES = {
  action:          { label: "Main Action" },
  maneuver:        { label: "Maneuver" },
  freeManeuver:    { label: "Free Maneuver" },
  triggered:       { label: "Triggered Action", triggered: true },
  freeTriggered:   { label: "Free Triggered Action", triggered: true },
  move:            { label: "Move Action" },
  none:            { label: "No Action (Malice)" },
  villain:         { label: "Villain Action" },
};

/** Display order for ability types in the right-panel preview. */
export const ABILITY_TYPE_ORDER = [
  "action", "maneuver", "freeManeuver", "triggered", "freeTriggered", "move", "none", "villain",
];

/* -------------------------------------------------- */
/*  Data factories                                    */
/* -------------------------------------------------- */

/**
 * Create a new ability data object with sensible defaults.
 * @param {object} [overrides] – fields to override
 * @returns {object}
 */
export function createAbilityData(overrides = {}) {
  return {
    id: foundry.utils.randomID(),
    abilityCategory: "",
    abilityType: "action",
    isMalice: false,
    name: "",
    keywords: [],
    distanceType: "melee",
    distancePrimary: 1,
    distanceSecondary: 1,
    distanceTertiary: 1,
    targetType: "creature",
    targetValue: 1,
    targetCustom: "",
    powerRollChars: [],
    powerRollEffects: [],
    effectAfterText: "",
    trigger: "",
    resourceCost: 0,
    ...overrides,
  };
}

/**
 * Create a new power roll effect data object.
 */
export function createEffectData(type = "damage") {
  return {
    id: foundry.utils.randomID(),
    type,
    name: "",
    tier1Value: "", tier2Value: "", tier3Value: "",
    damageTypes: [],
    tier1Condition: "", tier2Condition: "", tier3Condition: "",
    tier1ConditionEnd: "", tier2ConditionEnd: "", tier3ConditionEnd: "",
    tier1PotencyChar: "none", tier2PotencyChar: "", tier3PotencyChar: "",
    tier1PotencyValue: "@potency.weak", tier2PotencyValue: "@potency.average", tier3PotencyValue: "@potency.strong",
    tier1Display: "", tier2Display: "", tier3Display: "",
    tier1DisplayEdited: false, tier2DisplayEdited: false, tier3DisplayEdited: false,
    tier1Movement: "", tier2Movement: "", tier3Movement: "",
    tier1Distance: 0, tier2Distance: 0, tier3Distance: 0,
    resourceType: "surge",
    tier1Amount: 1, tier2Amount: 2, tier3Amount: 3,
  };
}

/**
 * Compute auto-generated display text for a single tier of an effect.
 */
export function computeAutoDisplay(eff, tier) {
  if (eff.type === "applied") {
    const cond = eff[`tier${tier}Condition`];
    if (!cond) return "";
    const end = eff[`tier${tier}ConditionEnd`];
    const condLabel = cond.charAt(0).toUpperCase() + cond.slice(1);
    const endAbbr = CONDITION_END_ABBREVIATIONS[end] ?? "";
    return endAbbr ? `{{potency}} ${condLabel} (${endAbbr})` : `{{potency}} ${condLabel}`;
  } else if (eff.type === "forced") {
    return (eff[`tier${tier}Movement`] && eff[`tier${tier}Distance`] > 0) ? "{{forced}}" : "";
  }
  return "";
}

/* -------------------------------------------------- */
/*  Context builders                                  */
/* -------------------------------------------------- */

/**
 * Build the Handlebars context for one ability's editor panel.
 * @param {object} ability – the ability data object
 * @param {object} [options]
 * @param {object} [options.stats]          – computeAllStats result (for damage placeholders)
 * @param {string[]} [options.excludeTypes] – abilityType keys to exclude from dropdown
 * @param {boolean} [options.lockType]      – if true, don't show the abilityType dropdown
 * @param {boolean} [options.lockCategory]  – if true, don't show category dropdown (e.g. signature)
 * @returns {object}
 */
export function prepareAbilityEditorContext(ability, options = {}) {
  const stats = options.stats ?? {};
  const excludeTypes = new Set(options.excludeTypes ?? []);

  // Auto-fill display text for non-edited effects
  for (const eff of ability.powerRollEffects) {
    if (eff.type === "applied" || eff.type === "forced") {
      for (const tier of [1, 2, 3]) {
        if (!eff[`tier${tier}DisplayEdited`]) {
          eff[`tier${tier}Display`] = computeAutoDisplay(eff, tier);
        }
      }
    }
  }

  const ctx = { ...ability };
  ctx.showRemove = options.showRemove ?? false;

  // Category options (with empty option)
  ctx.showCategory = !options.lockCategory;
  ctx.abilityCategoryOptions = [
    { key: "", label: "—", selected: !ability.abilityCategory },
    ...Object.entries(ABILITY_CATEGORIES).map(([k, v]) => ({
      key: k,
      label: game.i18n.localize(`DSENCOUNTER.Homebrew.AbilityCategory.${k}`),
      selected: k === ability.abilityCategory,
    })),
  ];

  // Type options
  ctx.showType = !options.lockType;
  ctx.isTriggered = ABILITY_TYPES[ability.abilityType]?.triggered ?? false;
  ctx.abilityTypeOptions = Object.entries(ABILITY_TYPES)
    .filter(([k]) => !excludeTypes.has(k))
    .map(([k, v]) => ({
      key: k,
      label: game.i18n.localize(`DSENCOUNTER.Homebrew.AbilityType.${k}`),
      selected: k === ability.abilityType,
    }));

  // Distance type options
  ctx.distanceOptions = DISTANCE_TYPES.map(dt => ({
    key: dt,
    label: DISTANCE_LABELS[dt] ?? dt,
    selected: dt === ability.distanceType,
  }));

  // Dynamic distance value fields
  ctx.distanceFields = (DISTANCE_FIELDS[ability.distanceType] ?? []).map(f => ({
    label: f.label,
    dataKey: f.dataKey,
    value: ability[f.dataKey] ?? 1,
  }));

  // Target type options
  ctx.targetTypeOptions = TARGET_TYPES.map(t => ({
    key: t,
    label: game.i18n.localize(`DSENCOUNTER.Homebrew.TargetType.${t}`),
    selected: t === ability.targetType,
  }));
  ctx.targetHasValue = TARGET_HAS_VALUE.has(ability.targetType);

  // Power roll characteristic options
  ctx.charSelectOptions = CHAR_KEYS.map(k => ({
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
    selected: ability.powerRollChars.includes(k),
  }));

  // Ability keyword options (sorted: ungrouped first, then by group)
  const entries = Object.entries(ABILITY_KEYWORDS);
  const ungrouped = entries.filter(([, v]) => !v.group).sort(([, a], [, b]) => a.label.localeCompare(b.label));
  const grouped = entries.filter(([, v]) => v.group).sort(([, a], [, b]) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  ctx.abilityKeywordOptions = [...ungrouped, ...grouped].map(([key, val]) => ({
    key,
    label: val.label,
    group: val.group ?? "",
    selected: ability.keywords.includes(key),
  }));

  // Build power roll effect editor data
  ctx.effects = ability.powerRollEffects.map(eff => {
    const e = { ...eff };
    e.typeOptions = EFFECT_TYPES.map(t => ({
      key: t,
      label: game.i18n.localize(`DSENCOUNTER.Homebrew.EffectType.${t}`),
      selected: t === eff.type,
    }));
    e.isDamage = eff.type === "damage";
    e.isApplied = eff.type === "applied";
    e.isForced = eff.type === "forced";
    e.isOther = eff.type === "other";
    e.isResource = eff.type === "resource";

    const placeholderMap = {
      damage: game.i18n.localize("DSENCOUNTER.Homebrew.Placeholder.EffectNameDamage"),
      applied: game.i18n.localize("DSENCOUNTER.Homebrew.Placeholder.EffectNameApplied"),
      forced: game.i18n.localize("DSENCOUNTER.Homebrew.Placeholder.EffectNameForced"),
      other: game.i18n.localize("DSENCOUNTER.Homebrew.Placeholder.EffectNameOther"),
      resource: game.i18n.localize("DSENCOUNTER.Homebrew.Placeholder.EffectNameResource"),
    };
    e.namePlaceholder = placeholderMap[eff.type] ?? "";

    if (e.isApplied || e.isForced || e.isOther || e.isResource) {
      for (const tier of [1, 2, 3]) {
        e[`tier${tier}PotencyCharOptions`] = POTENCY_CHARS.map(pc => ({
          key: pc,
          label: pc === "" ? game.i18n.localize("DSENCOUNTER.Homebrew.Potency.Default")
            : pc === "none" ? game.i18n.localize("DSENCOUNTER.Homebrew.Potency.None")
            : pc.charAt(0).toUpperCase() + pc.slice(1),
          selected: pc === (eff[`tier${tier}PotencyChar`] ?? (tier === 1 ? "none" : "")),
        }));
      }
    }

    if (e.isDamage) {
      e.tier1Placeholder = String(stats.tierDamage?.[1] ?? "");
      e.tier2Placeholder = String(stats.tierDamage?.[2] ?? "");
      e.tier3Placeholder = String(stats.tierDamage?.[3] ?? "");
      e.damageTypeOptions = DAMAGE_TYPES.map(dt => ({
        key: dt,
        label: dt.charAt(0).toUpperCase() + dt.slice(1),
        selected: (eff.damageTypes ?? []).includes(dt),
      }));
    }

    if (e.isApplied) {
      for (const tier of [1, 2, 3]) {
        e[`tier${tier}ConditionOptions`] = [
          { key: "", label: "—", selected: !eff[`tier${tier}Condition`] },
          ...CONDITION_TYPES.map(c => ({
            key: c,
            label: c.charAt(0).toUpperCase() + c.slice(1),
            selected: c === eff[`tier${tier}Condition`],
          })),
        ];
        e[`tier${tier}ConditionEndOptions`] = CONDITION_END_TYPES.map(ce => ({
          key: ce,
          label: ce ? game.i18n.localize(`DSENCOUNTER.Homebrew.ConditionEnd.${ce}`) : game.i18n.localize("DSENCOUNTER.Homebrew.ConditionEnd.none"),
          selected: ce === eff[`tier${tier}ConditionEnd`],
        }));
      }
    }

    if (e.isForced) {
      for (const tier of [1, 2, 3]) {
        e[`tier${tier}MovementOptions`] = [
          { key: "", label: "—", selected: !eff[`tier${tier}Movement`] },
          ...FORCED_MOVEMENT_TYPES.map(m => ({
            key: m,
            label: game.i18n.localize(`DSENCOUNTER.Homebrew.Movement.${m}`),
            selected: m === eff[`tier${tier}Movement`],
          })),
        ];
      }
    }

    if (e.isResource) {
      e.resourceTypeOptions = RESOURCE_TYPES.map(rt => ({
        key: rt,
        label: game.i18n.localize(`DSENCOUNTER.Homebrew.ResourceType.${rt}`),
        selected: rt === eff.resourceType,
      }));
    }
    return e;
  });

  ctx.hasEffects = ability.powerRollEffects.length > 0;

  return ctx;
}

/**
 * Build preview context for one ability (used in the right panel).
 * @param {object} ability – the ability data object
 * @param {object} [stats] – computeAllStats result
 * @returns {object}
 */
export function prepareAbilityPreviewContext(ability, stats = {}) {
  const charLabel = ability.powerRollChars.length > 0
    ? ability.powerRollChars.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(" or ")
    : "—";

  // Distance label
  let distanceLabel = "";
  const fields = DISTANCE_FIELDS[ability.distanceType] ?? [];
  if (fields.length === 0) {
    distanceLabel = DISTANCE_LABELS[ability.distanceType] ?? ability.distanceType;
  } else if (ability.distanceType === "meleeRanged") {
    distanceLabel = `Melee ${ability.distancePrimary} / Ranged ${ability.distanceSecondary}`;
  } else if (ability.distanceType === "line") {
    distanceLabel = `Line ${ability.distancePrimary}×${ability.distanceSecondary}, Ranged ${ability.distanceTertiary}`;
  } else {
    distanceLabel = fields.map(f => `${f.label} ${ability[f.dataKey] ?? 1}`).join(", ");
  }

  // Target label
  let targetLabel;
  if (ability.targetCustom) {
    targetLabel = ability.targetCustom;
  } else {
    const tLabel = game.i18n.localize(`DSENCOUNTER.Homebrew.TargetType.${ability.targetType}`);
    targetLabel = TARGET_HAS_VALUE.has(ability.targetType) ? `${ability.targetValue ?? 1} ${tLabel}` : tLabel;
  }

  // Keyword labels
  const keywordLabels = ability.keywords.length > 0
    ? ability.keywords.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(", ")
    : "";

  // Tier lines from effects
  const tierLines = { 1: [], 2: [], 3: [] };
  for (const eff of ability.powerRollEffects) {
    if (eff.type === "damage") {
      const v1 = eff.tier1Value || (stats.tierDamage?.[1] ?? "?");
      const v2 = eff.tier2Value || (stats.tierDamage?.[2] ?? "?");
      const v3 = eff.tier3Value || (stats.tierDamage?.[3] ?? "?");
      const typeLabel = (eff.damageTypes ?? []).length > 0
        ? " " + eff.damageTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join("/")
        : "";
      tierLines[1].push(`${v1}${typeLabel} damage`);
      tierLines[2].push(`${v2}${typeLabel} damage`);
      tierLines[3].push(`${v3}${typeLabel} damage`);
    } else if (eff.type === "applied") {
      for (const tier of [1, 2, 3]) {
        if (eff[`tier${tier}Display`]) {
          tierLines[tier].push(eff[`tier${tier}Display`]);
        } else {
          const cond = eff[`tier${tier}Condition`];
          const end = eff[`tier${tier}ConditionEnd`];
          const label = cond ? cond.charAt(0).toUpperCase() + cond.slice(1) : "";
          const endLabel = end ? ` (${game.i18n.localize(`DSENCOUNTER.Homebrew.ConditionEnd.${end}`)})` : "";
          if (label) tierLines[tier].push(label + endLabel);
        }
      }
    } else if (eff.type === "forced") {
      for (const tier of [1, 2, 3]) {
        if (eff[`tier${tier}Display`]) {
          tierLines[tier].push(eff[`tier${tier}Display`]);
        } else {
          const dir = eff[`tier${tier}Movement`];
          const dist = eff[`tier${tier}Distance`];
          if (dir && dist > 0) {
            const dirLabel = dir.charAt(0).toUpperCase() + dir.slice(1);
            tierLines[tier].push(`${dirLabel} ${dist}`);
          }
        }
      }
    } else if (eff.type === "other") {
      if (eff.tier1Display) tierLines[1].push(eff.tier1Display);
      if (eff.tier2Display) tierLines[2].push(eff.tier2Display);
      if (eff.tier3Display) tierLines[3].push(eff.tier3Display);
    } else if (eff.type === "resource") {
      const rtLabel = game.i18n.localize(`DSENCOUNTER.Homebrew.ResourceType.${eff.resourceType}`);
      tierLines[1].push(`Gain ${eff.tier1Amount} ${rtLabel}`);
      tierLines[2].push(`Gain ${eff.tier2Amount} ${rtLabel}`);
      tierLines[3].push(`Gain ${eff.tier3Amount} ${rtLabel}`);
    }
  }

  const typeLabel = ABILITY_TYPES[ability.abilityType]?.label ?? ability.abilityType;
  const categoryLabel = ABILITY_CATEGORIES[ability.abilityCategory]?.label ?? "";

  return {
    id: ability.id,
    name: ability.name,
    abilityType: ability.abilityType,
    abilityCategory: ability.abilityCategory,
    typeLabel: game.i18n.localize(`DSENCOUNTER.Homebrew.AbilityType.${ability.abilityType}`),
    categoryLabel: ability.abilityCategory ? game.i18n.localize(`DSENCOUNTER.Homebrew.AbilityCategory.${ability.abilityCategory}`) : "",
    isMalice: ability.isMalice,
    resourceCost: ability.resourceCost,
    charLabel,
    distanceLabel,
    targetLabel,
    keywordLabels,
    tierPreview: {
      1: tierLines[1].join("; "),
      2: tierLines[2].join("; "),
      3: tierLines[3].join("; "),
    },
    hasEffects: ability.powerRollEffects.length > 0,
    effectAfter: ability.effectAfterText || "",
    trigger: ability.trigger || "",
    isTriggered: ABILITY_TYPES[ability.abilityType]?.triggered ?? false,
    hasPowerRoll: ability.powerRollChars.length > 0 || ability.powerRollEffects.length > 0,
  };
}

/* -------------------------------------------------- */
/*  Field change helpers                              */
/* -------------------------------------------------- */

/**
 * Apply a field value from a DOM element to an ability data object.
 * @param {object} ability – the ability data object to mutate
 * @param {HTMLElement} el – the DOM element with data-ability-field
 */
export function applyAbilityFieldValue(ability, el) {
  const field = el.dataset.abilityField;
  if (!field) return;

  switch (field) {
    case "abilityCategory":
      ability.abilityCategory = el.value;
      break;
    case "abilityType":
      ability.abilityType = el.value;
      if (el.value === "none") {
        ability.distanceType = "special";
        ability.targetType = "special";
      }
      break;
    case "name":
      ability.name = el.value;
      break;
    case "distanceType":
      ability.distanceType = el.value;
      break;
    case "distancePrimary":
      ability.distancePrimary = Math.max(1, Number(el.value) || 1);
      break;
    case "distanceSecondary":
      ability.distanceSecondary = Math.max(1, Number(el.value) || 1);
      break;
    case "distanceTertiary":
      ability.distanceTertiary = Math.max(1, Number(el.value) || 1);
      break;
    case "targetType":
      ability.targetType = el.value;
      break;
    case "targetValue":
      ability.targetValue = Math.max(1, Number(el.value) || 1);
      break;
    case "targetCustom":
      ability.targetCustom = el.value;
      break;
    case "effectAfterText":
      ability.effectAfterText = el.value;
      break;
    case "trigger":
      ability.trigger = el.value;
      break;
    case "resourceCost":
      ability.resourceCost = Math.max(0, Number(el.value) || 0);
      break;
  }
}

/**
 * Apply an effect field value from a DOM element to the matching effect in an ability.
 * @param {object} ability – the ability data object
 * @param {HTMLElement} el – the DOM element with data-effect-id and data-effect-field
 */
export function applyEffectFieldValue(ability, el) {
  const effectId = el.dataset.effectId;
  const field = el.dataset.effectField;
  if (!effectId || !field) return;

  const eff = ability.powerRollEffects.find(e => e.id === effectId);
  if (!eff) return;

  switch (field) {
    case "type":
      eff.type = el.value;
      break;
    case "name":
      eff.name = el.value;
      break;
    case "tier1Value": case "tier2Value": case "tier3Value":
      eff[field] = el.value;
      break;
    case "tier1Condition": case "tier2Condition": case "tier3Condition":
    case "tier1ConditionEnd": case "tier2ConditionEnd": case "tier3ConditionEnd":
    case "tier1Movement": case "tier2Movement": case "tier3Movement":
      eff[field] = el.value;
      break;
    case "tier1Distance": case "tier2Distance": case "tier3Distance":
      eff[field] = Math.max(0, Number(el.value) || 0);
      break;
    case "tier1Display": case "tier2Display": case "tier3Display":
      eff[field] = el.value;
      eff[field.replace("Display", "DisplayEdited")] = true;
      break;
    case "tier1PotencyChar": case "tier2PotencyChar": case "tier3PotencyChar":
    case "tier1PotencyValue": case "tier2PotencyValue": case "tier3PotencyValue":
      eff[field] = el.value;
      break;
    case "resourceType":
      eff.resourceType = el.value;
      break;
    case "tier1Amount": case "tier2Amount": case "tier3Amount":
      eff[field] = Math.max(0, Number(el.value) || 0);
      break;
  }
}

/**
 * Wire up DOM event listeners for an ability editor section.
 * @param {HTMLElement} container – the root element of the ability editor
 * @param {Function} getAbility  – returns the ability data object for the given ability id
 * @param {Function} onRender    – called after a field change (typically this.render())
 */
export function bindAbilityEditorEvents(container, getAbility, onRender) {
  // Standard ability-level fields
  container.querySelectorAll("[data-ability-field]").forEach(el => {
    if (el.closest(".dshomebrew-tag-select")) return;
    if (el.tagName === "INPUT" || el.tagName === "SELECT") {
      el.addEventListener("change", (event) => {
        const abilityId = el.closest("[data-ability-id]")?.dataset.abilityId;
        const ability = getAbility(abilityId);
        if (ability) applyAbilityFieldValue(ability, event.currentTarget);
        onRender();
      });
    }
  });

  // Effect-level fields
  container.querySelectorAll("[data-effect-id]").forEach(el => {
    if (el.dataset.action) return;
    if (el.closest(".dshomebrew-tag-select")) return;
    if (el.tagName === "INPUT" || el.tagName === "SELECT") {
      el.addEventListener("change", (event) => {
        const abilityId = el.closest("[data-ability-id]")?.dataset.abilityId;
        const ability = getAbility(abilityId);
        if (ability) applyEffectFieldValue(ability, event.currentTarget);
        onRender();
      });
    }
  });

  // Tag selects (keywords, damage types, power roll chars) within abilities
  container.querySelectorAll(".dshomebrew-tag-select").forEach(tagContainer => {
    tagContainer.querySelectorAll("input[type='checkbox']").forEach(cb => {
      cb.addEventListener("change", () => {
        const abilityId = tagContainer.closest("[data-ability-id]")?.dataset.abilityId;
        const ability = getAbility(abilityId);
        if (!ability) return;

        const field = tagContainer.dataset.field;
        const selected = Array.from(tagContainer.querySelectorAll("input[type='checkbox']:checked"))
          .map(el => el.value);

        const effectId = tagContainer.dataset.effectId;
        if (effectId) {
          const eff = ability.powerRollEffects.find(e => e.id === effectId);
          if (eff) eff[field] = selected;
        } else {
          ability[field] = selected;
        }
        onRender();
      });
    });
  });
}

/**
 * Flush the currently focused input within an ability editor to the ability data.
 * @param {HTMLElement} container – ability editor root element
 * @param {Function} getAbility  – returns the ability for a given id
 */
export function flushAbilityFocusedInput(container, getAbility) {
  const focused = container?.querySelector("input:focus, select:focus");
  if (!focused) return;
  const abilityId = focused.closest("[data-ability-id]")?.dataset.abilityId;
  const ability = getAbility(abilityId);
  if (!ability) return;

  if (focused.dataset.abilityField) {
    applyAbilityFieldValue(ability, focused);
  } else if (focused.dataset.effectId && focused.dataset.effectField) {
    applyEffectFieldValue(ability, focused);
  }
}

/* -------------------------------------------------- */
/*  Item creation helpers                             */
/* -------------------------------------------------- */

/**
 * Build the Foundry distance object from ability data.
 */
export function buildDistance(ability) {
  const dist = { type: ability.distanceType };
  switch (ability.distanceType) {
    case "melee": case "ranged": case "aura": case "burst":
      dist.primary = ability.distancePrimary ?? 1;
      break;
    case "meleeRanged":
      dist.primary = ability.distancePrimary ?? 1;
      dist.secondary = ability.distanceSecondary ?? 1;
      break;
    case "cube": case "wall":
      dist.primary = ability.distancePrimary ?? 1;
      dist.secondary = ability.distanceSecondary ?? 1;
      break;
    case "line":
      dist.primary = ability.distancePrimary ?? 1;
      dist.secondary = ability.distanceSecondary ?? 1;
      dist.tertiary = ability.distanceTertiary ?? 1;
      break;
  }
  return dist;
}

/**
 * Build the power.effects object from an ability's powerRollEffects array.
 */
export function buildPowerEffects(wizardEffects, stats = {}) {
  const effects = {};
  for (const eff of wizardEffects) {
    const id = eff.id || foundry.utils.randomID();
    const base = { _id: id, name: eff.name || "", img: null, type: eff.type, sort: 0 };

    switch (eff.type) {
      case "damage": {
        const t1 = eff.tier1Value || String(stats.tierDamage?.[1] ?? "0");
        const t2 = eff.tier2Value || String(stats.tierDamage?.[2] ?? "0");
        const t3 = eff.tier3Value || String(stats.tierDamage?.[3] ?? "0");
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
          const condition = eff[`tier${tier}Condition`] || "";
          const endType = eff[`tier${tier}ConditionEnd`] || "";
          const potencyChar = eff[`tier${tier}PotencyChar`] ?? (tier === 1 ? "none" : "");
          const potencyValue = eff[`tier${tier}PotencyValue`] || `@potency.${tier === 1 ? "weak" : tier === 2 ? "average" : "strong"}`;
          const display = eff[`tier${tier}Display`] || "";
          const effs = {};
          if (condition) {
            effs[condition] = { condition: "failure", end: endType, properties: new Set() };
          }
          tiers[`tier${tier}`] = {
            display,
            effects: effs,
            potency: { value: potencyValue, characteristic: potencyChar },
          };
        }
        base.applied = tiers;
        break;
      }
      case "forced": {
        const tiers = {};
        for (const tier of [1, 2, 3]) {
          const mvmt = eff[`tier${tier}Movement`] || "";
          const movement = mvmt ? new Set([mvmt]) : new Set();
          const potencyChar = eff[`tier${tier}PotencyChar`] ?? (tier === 1 ? "none" : "");
          const potencyValue = eff[`tier${tier}PotencyValue`] || `@potency.${tier === 1 ? "weak" : tier === 2 ? "average" : "strong"}`;
          const display = eff[`tier${tier}Display`] || "";
          tiers[`tier${tier}`] = {
            display,
            movement,
            distance: String(eff[`tier${tier}Distance`] ?? 0),
            properties: new Set(),
            potency: { value: potencyValue, characteristic: potencyChar },
          };
        }
        base.forced = tiers;
        break;
      }
      case "other": {
        base.other = {};
        for (const tier of [1, 2, 3]) {
          const potencyChar = eff[`tier${tier}PotencyChar`] ?? (tier === 1 ? "none" : "");
          const potencyValue = eff[`tier${tier}PotencyValue`] || `@potency.${tier === 1 ? "weak" : tier === 2 ? "average" : "strong"}`;
          base.other[`tier${tier}`] = {
            display: eff[`tier${tier}Display`] || "",
            potency: { value: potencyValue, characteristic: potencyChar },
          };
        }
        break;
      }
      case "resource": {
        const resType = eff.resourceType || "surge";
        base.resource = {};
        for (const tier of [1, 2, 3]) {
          const potencyChar = eff[`tier${tier}PotencyChar`] ?? (tier === 1 ? "none" : "");
          const potencyValue = eff[`tier${tier}PotencyValue`] || `@potency.${tier === 1 ? "weak" : tier === 2 ? "average" : "strong"}`;
          base.resource[`tier${tier}`] = {
            amount: eff[`tier${tier}Amount`] ?? tier,
            type: resType,
            display: "",
            potency: { value: potencyValue, characteristic: potencyChar },
          };
        }
        break;
      }
    }
    effects[id] = base;
  }
  return effects;
}

/**
 * Build Foundry Item data from a wizard ability object.
 * @param {object} ability – wizard ability data
 * @param {object} [stats] – computeAllStats result
 * @param {object} [options]
 * @param {Set<string>} [options.rollChars] – override power roll characteristics
 * @returns {object} – item data suitable for Item.create or actor items[]
 */
export function buildAbilityItemData(ability, stats = {}, options = {}) {
  const distance = buildDistance(ability);
  const rollChars = options.rollChars ?? new Set(ability.powerRollChars ?? []);
  const powerEffects = buildPowerEffects(ability.powerRollEffects ?? [], stats);

  // Map our abilityType keys to the system's type field
  const systemType = ability.abilityType || "action";

  return {
    type: "ability",
    name: ability.name || "New Ability",
    system: {
      category: ability.abilityCategory || "",
      type: systemType,
      keywords: new Set(ability.keywords || []),
      distance,
      target: {
        type: ability.targetType ?? "creature",
        value: ability.targetValue ?? 1,
        custom: ability.targetCustom ?? "",
      },
      trigger: ability.trigger ?? "",
      effect: {
        after: ability.effectAfterText || "",
      },
      power: {
        roll: {
          formula: "",
          characteristics: rollChars,
        },
        effects: powerEffects,
      },
      resource: ability.resourceCost > 0 ? ability.resourceCost : null,
    },
  };
}
