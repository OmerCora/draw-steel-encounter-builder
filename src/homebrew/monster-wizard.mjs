/**
 * Monster Builder – two-panel ApplicationV2.
 * Left panel: input fields. Right panel: live stat block preview.
 */

import { MODULE_ID } from "../config.mjs";
import {
  ROLE_TABLE, ORG_TABLE,
  calcHighestChar, getSuggestedCharArray, computeAllStats,
} from "./monster-calc.mjs";
import { createMonsterActor } from "./monster-create.mjs";

const CHAR_KEYS = ["might", "agility", "reason", "intuition", "presence"];
const CHAR_ABBREVS = ["MGT", "AGI", "REA", "INT", "PRS"];
const DISTANCE_TYPES = [
  "melee", "ranged", "meleeRanged", "aura", "burst", "cube", "line", "wall", "special", "self",
];

const CONDITION_TYPES = [
  "bleeding", "dazed", "frightened", "grabbed", "prone",
  "restrained", "slowed", "surprised", "taunted", "weakened",
];

const EFFECT_TYPES = ["damage", "applied", "forced", "other", "resource"];

const CONDITION_END_TYPES = ["", "turn", "save", "encounter", "respite"];

const FORCED_MOVEMENT_TYPES = ["push", "pull", "slide"];

const RESOURCE_TYPES = ["surge", "heroic", "epic"];

const TARGET_TYPES = [
  "creature", "object", "creatureObject", "enemy", "enemyObject",
  "ally", "selfAlly", "self", "selfOrAlly", "selfOrCreature", "special",
];

/** Target types that display a numeric value field. */
const TARGET_HAS_VALUE = new Set([
  "creature", "object", "creatureObject", "enemy", "enemyObject", "ally", "selfAlly",
]);

const DISTANCE_LABELS = {
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

/**
 * Per-distance-type field definitions matching the system AbilityDistance schema.
 * Each entry lists { label, dataKey } for the primary/secondary/tertiary fields.
 */
const DISTANCE_FIELDS = {
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

const DAMAGE_TYPES = [
  "acid", "cold", "corruption", "fire", "holy", "lightning", "poison", "psychic", "sonic",
];

const MOVEMENT_TYPES = ["walk", "fly", "swim", "climb", "burrow", "teleport"];

const MONSTER_KEYWORDS = [
  "abyssal", "accursed", "animal", "beast", "construct", "dragon", "elemental",
  "fey", "giant", "horror", "humanoid", "infernal", "ooze", "plant", "soulless",
  "swarm", "undead",
];

const SIZE_OPTIONS = [
  { value: "1T", label: "1T (Tiny)", size: 1, letter: "T" },
  { value: "1S", label: "1S (Small)", size: 1, letter: "S" },
  { value: "1M", label: "1M (Medium)", size: 1, letter: "M" },
  { value: "1L", label: "1L (Large)", size: 1, letter: "L" },
  { value: "2", label: "2", size: 2, letter: "" },
  { value: "3", label: "3", size: 3, letter: "" },
  { value: "4", label: "4", size: 4, letter: "" },
  { value: "5", label: "5", size: 5, letter: "" },
];

export class MonsterWizardApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {

  /* -------------------------------------------------- */
  /*  Static                                            */
  /* -------------------------------------------------- */

  static _instance = null;

  static open() {
    if (this._instance?.rendered) {
      this._instance.bringToFront();
    } else {
      this._instance = new this();
      this._instance.render({ force: true });
    }
  }

  /* -------------------------------------------------- */

  static DEFAULT_OPTIONS = {
    id: "monster-wizard",
    classes: ["draw-steel-homebrew", "draw-steel-monster-wizard"],
    position: { width: 780, height: 700 },
    window: {
      title: "DSENCOUNTER.Homebrew.WizardTitle",
      resizable: true,
      icon: "fa-solid fa-dragon",
    },
    actions: {
      applySuggested: MonsterWizardApp.#onApplySuggested,
      createMonster: MonsterWizardApp.#onCreateMonster,
      addImmunity: MonsterWizardApp.#onAddImmunity,
      removeImmunity: MonsterWizardApp.#onRemoveImmunity,
      addWeakness: MonsterWizardApp.#onAddWeakness,
      removeWeakness: MonsterWizardApp.#onRemoveWeakness,
      addSignatureAbility: MonsterWizardApp.#onAddSignatureAbility,
      removeSignatureAbility: MonsterWizardApp.#onRemoveSignatureAbility,
      addEffect: MonsterWizardApp.#onAddEffect,
      removeEffect: MonsterWizardApp.#onRemoveEffect,
    },
  };

  /* -------------------------------------------------- */

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/homebrew/monster-wizard.hbs`,
    },
  };

  /* -------------------------------------------------- */
  /*  Instance state                                    */
  /* -------------------------------------------------- */

  #data = {
    name: "",
    level: 1,
    roleKey: "brute",
    orgKey: "platoon",
    characteristics: [2, 1, 0, -1, -1],
    // Signature ability
    hasSignature: false,
    abilityName: "",
    abilityKeywords: [],
    distanceType: "melee",
    distancePrimary: 1,
    distanceSecondary: 1,
    distanceTertiary: 1,
    targetType: "creature",
    targetValue: 1,
    targetCustom: "",
    powerRollChars: [],
    powerRollEffects: [],   // Array of effect objects (see _createEffect)
    // Monster stats
    extraStamina: false,
    speed: 5,
    stability: 0,
    movementTypes: ["walk"],
    sizeCombo: "1M",
    keywords: [],
    immunities: [],   // [{ type: "fire", value: 5 }, ...]
    weaknesses: [],   // [{ type: "fire", value: 5 }, ...]
  };

  /* -------------------------------------------------- */

  /**
   * Parse the sizeCombo into size+letter.
   */
  #parseSizeCombo() {
    const opt = SIZE_OPTIONS.find(o => o.value === this.#data.sizeCombo);
    return opt ?? { size: 1, letter: "M" };
  }

  /**
   * Create a new power roll effect data object.
   */
  static createEffect(type = "damage") {
    return {
      id: foundry.utils.randomID(),
      type,
      name: "",
      // Damage
      tier1Value: "",
      tier2Value: "",
      tier3Value: "",
      damageTypes: [],
      // Applied (per-tier)
      tier1Condition: "dazed",
      tier2Condition: "dazed",
      tier3Condition: "dazed",
      tier1ConditionEnd: "",
      tier2ConditionEnd: "",
      tier3ConditionEnd: "",
      // Forced (per-tier)
      tier1Movement: "push",
      tier2Movement: "push",
      tier3Movement: "push",
      tier1Distance: 1,
      tier2Distance: 2,
      tier3Distance: 3,
      // Other
      tier1Display: "",
      tier2Display: "",
      tier3Display: "",
      // Resource
      resourceType: "surge",
      tier1Amount: 1,
      tier2Amount: 2,
      tier3Amount: 3,
    };
  }

  /* -------------------------------------------------- */
  /*  Rendering                                         */
  /* -------------------------------------------------- */

  async _prepareContext() {
    const d = this.#data;
    const sizeInfo = this.#parseSizeCombo();

    const stats = computeAllStats({
      level: d.level,
      roleKey: d.roleKey,
      orgKey: d.orgKey,
      characteristics: d.characteristics,
      targetCount: TARGET_HAS_VALUE.has(d.targetType) ? (d.targetValue ?? 1) : 1,
      extraStamina: d.extraStamina,
    });
    const highestChar = calcHighestChar(d.level, d.orgKey);

    // Level options (1-11)
    const levelOptions = Array.from({ length: 11 }, (_, i) => ({
      value: i + 1,
      selected: (i + 1) === d.level,
    }));

    // Role & org options
    const roleOptions = Object.keys(ROLE_TABLE).map(k => ({
      key: k,
      label: k === "noRole" ? "No Role" : k.charAt(0).toUpperCase() + k.slice(1),
      selected: k === d.roleKey,
    }));
    const orgOptions = Object.keys(ORG_TABLE).map(k => ({
      key: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
      selected: k === d.orgKey,
    }));

    // Size options
    const sizeOptions = SIZE_OPTIONS.map(o => ({
      ...o,
      selected: o.value === d.sizeCombo,
    }));

    // Characteristics
    const chars = CHAR_KEYS.map((key, i) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      abbrev: CHAR_ABBREVS[i],
      value: d.characteristics[i],
    }));

    // Distance type options
    const distanceOptions = DISTANCE_TYPES.map(dt => ({
      key: dt,
      label: DISTANCE_LABELS[dt] ?? dt,
      selected: dt === d.distanceType,
    }));

    // Dynamic distance value fields for current distance type
    const distanceFields = (DISTANCE_FIELDS[d.distanceType] ?? []).map(f => ({
      label: f.label,
      dataKey: f.dataKey,
      value: d[f.dataKey] ?? 1,
    }));

    // Target type options
    const targetTypeOptions = TARGET_TYPES.map(t => ({
      key: t,
      label: game.i18n.localize(`DSENCOUNTER.Homebrew.TargetType.${t}`),
      selected: t === d.targetType,
    }));
    const targetHasValue = TARGET_HAS_VALUE.has(d.targetType);

    // Power roll characteristic options
    const charSelectOptions = CHAR_KEYS.map(k => ({
      key: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
      selected: d.powerRollChars.includes(k),
    }));

    // Build power roll effect editor data
    const effects = d.powerRollEffects.map(eff => {
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

      // Damage: show auto values as placeholders
      if (e.isDamage) {
        e.tier1Placeholder = String(stats.tierDamage[1]);
        e.tier2Placeholder = String(stats.tierDamage[2]);
        e.tier3Placeholder = String(stats.tierDamage[3]);
        e.damageTypeOptions = DAMAGE_TYPES.map(dt => ({
          key: dt,
          label: dt.charAt(0).toUpperCase() + dt.slice(1),
          selected: (eff.damageTypes ?? []).includes(dt),
        }));
      }
      // Applied (per-tier)
      if (e.isApplied) {
        for (const tier of [1, 2, 3]) {
          e[`tier${tier}ConditionOptions`] = CONDITION_TYPES.map(c => ({
            key: c,
            label: c.charAt(0).toUpperCase() + c.slice(1),
            selected: c === eff[`tier${tier}Condition`],
          }));
          e[`tier${tier}ConditionEndOptions`] = CONDITION_END_TYPES.map(ce => ({
            key: ce,
            label: ce ? game.i18n.localize(`DSENCOUNTER.Homebrew.ConditionEnd.${ce}`) : game.i18n.localize("DSENCOUNTER.Homebrew.ConditionEnd.none"),
            selected: ce === eff[`tier${tier}ConditionEnd`],
          }));
        }
      }
      // Forced (per-tier)
      if (e.isForced) {
        for (const tier of [1, 2, 3]) {
          e[`tier${tier}MovementOptions`] = FORCED_MOVEMENT_TYPES.map(m => ({
            key: m,
            label: game.i18n.localize(`DSENCOUNTER.Homebrew.Movement.${m}`),
            selected: m === eff[`tier${tier}Movement`],
          }));
        }
      }
      // Resource
      if (e.isResource) {
        e.resourceTypeOptions = RESOURCE_TYPES.map(rt => ({
          key: rt,
          label: game.i18n.localize(`DSENCOUNTER.Homebrew.ResourceType.${rt}`),
          selected: rt === eff.resourceType,
        }));
      }
      return e;
    });

    // All damage types (for immunities/weaknesses dropdown)
    const damageTypeOptionsAll = [{ key: "all", label: "All" }].concat(
      DAMAGE_TYPES.map(dt => ({
        key: dt,
        label: dt.charAt(0).toUpperCase() + dt.slice(1),
      }))
    );

    // Movement type options
    const movementTypeOptions = MOVEMENT_TYPES.map(mt => ({
      key: mt,
      label: mt.charAt(0).toUpperCase() + mt.slice(1),
      selected: d.movementTypes.includes(mt),
    }));

    // Monster keyword options
    const keywordOptions = MONSTER_KEYWORDS.map(kw => ({
      key: kw,
      label: kw.charAt(0).toUpperCase() + kw.slice(1),
      selected: d.keywords.includes(kw),
    }));

    // Computed display strings for the stat block preview
    const roleLabel = d.roleKey === "noRole" ? "" : d.roleKey.charAt(0).toUpperCase() + d.roleKey.slice(1);
    const orgLabel = d.orgKey.charAt(0).toUpperCase() + d.orgKey.slice(1);
    const keywordLabels = d.keywords.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(", ");
    const sizeDisplay = sizeInfo.size === 1
      ? `${sizeInfo.size}${sizeInfo.letter}`
      : `${sizeInfo.size}`;

    // Movement label (excluding "walk" as it's the default)
    const nonWalkMovement = d.movementTypes.filter(m => m !== "walk");
    const movementLabel = nonWalkMovement.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(", ");

    // Immunity/weakness display
    const immunityDisplay = d.immunities
      .map(i => `${i.type} ${i.value}`)
      .join(", ");
    const weaknessDisplay = d.weaknesses
      .map(w => `${w.type} ${w.value}`)
      .join(", ");

    // Signature ability preview strings
    const sigCharLabel = d.powerRollChars.length > 0
      ? d.powerRollChars.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(" or ")
      : "—";

    // Build distance label from per-type fields
    let sigDistanceLabel = "";
    const fields = DISTANCE_FIELDS[d.distanceType] ?? [];
    if (fields.length === 0) {
      sigDistanceLabel = DISTANCE_LABELS[d.distanceType] ?? d.distanceType;
    } else if (d.distanceType === "meleeRanged") {
      sigDistanceLabel = `Melee ${d.distancePrimary} / Ranged ${d.distanceSecondary}`;
    } else if (d.distanceType === "line") {
      sigDistanceLabel = `Line ${d.distancePrimary}×${d.distanceSecondary}, Ranged ${d.distanceTertiary}`;
    } else {
      sigDistanceLabel = fields.map(f => `${f.label} ${d[f.dataKey] ?? 1}`).join(", ");
    }
    const sigAbilityKeywordLabels = d.abilityKeywords.length > 0
      ? d.abilityKeywords.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(", ")
      : "";

    // Build per-tier preview lines from all effects
    const tierLines = { 1: [], 2: [], 3: [] };
    for (const eff of d.powerRollEffects) {
      if (eff.type === "damage") {
        const v1 = eff.tier1Value || stats.tierDamage[1];
        const v2 = eff.tier2Value || stats.tierDamage[2];
        const v3 = eff.tier3Value || stats.tierDamage[3];
        const typeLabel = (eff.damageTypes ?? []).length > 0
          ? " " + eff.damageTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join("/")
          : "";
        tierLines[1].push(`${v1}${typeLabel} damage`);
        tierLines[2].push(`${v2}${typeLabel} damage`);
        tierLines[3].push(`${v3}${typeLabel} damage`);
      } else if (eff.type === "applied") {
        for (const tier of [1, 2, 3]) {
          const cond = eff[`tier${tier}Condition`];
          const end = eff[`tier${tier}ConditionEnd`];
          const label = cond ? cond.charAt(0).toUpperCase() + cond.slice(1) : "";
          const endLabel = end ? ` (${game.i18n.localize(`DSENCOUNTER.Homebrew.ConditionEnd.${end}`)})` : "";
          if (label) tierLines[tier].push(label + endLabel);
        }
      } else if (eff.type === "forced") {
        for (const tier of [1, 2, 3]) {
          const dir = eff[`tier${tier}Movement`];
          const dirLabel = dir ? dir.charAt(0).toUpperCase() + dir.slice(1) : "Push";
          tierLines[tier].push(`${dirLabel} ${eff[`tier${tier}Distance`]}`);
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
    const sigTierPreview = {
      1: tierLines[1].join("; "),
      2: tierLines[2].join("; "),
      3: tierLines[3].join("; "),
    };
    const hasEffects = d.powerRollEffects.length > 0;

    const isMinion = d.orgKey === "minion";

    // Build target label for preview
    let sigTargetLabel;
    if (d.targetCustom) {
      sigTargetLabel = d.targetCustom;
    } else {
      const tLabel = game.i18n.localize(`DSENCOUNTER.Homebrew.TargetType.${d.targetType}`);
      sigTargetLabel = TARGET_HAS_VALUE.has(d.targetType) ? `${d.targetValue ?? 1} ${tLabel}` : tLabel;
    }

    return {
      data: d,
      stats,
      highestChar,
      levelOptions,
      chars,
      roleOptions,
      orgOptions,
      sizeOptions,
      distanceOptions,
      distanceFields,
      targetTypeOptions,
      targetHasValue,
      damageTypeOptionsAll,
      movementTypeOptions,
      keywordOptions,
      charSelectOptions,
      effects,
      suggestedChars: getSuggestedCharArray(d.level, d.orgKey),
      hasSignature: d.hasSignature,
      showSignatureEditor: d.hasSignature,
      roleLabel,
      orgLabel,
      keywordLabels,
      sizeDisplay,
      movementLabel,
      immunityDisplay,
      weaknessDisplay,
      isMinion,
      sigCharLabel,
      sigDistanceLabel,
      sigAbilityKeywordLabels,
      sigTierPreview,
      sigTargetLabel,
      hasEffects,
    };
  }

  /* -------------------------------------------------- */
  /*  Form handling                                     */
  /* -------------------------------------------------- */

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;

    // Restore scroll positions after re-render
    if (this._scrollPositions) {
      const left = html.querySelector(".dshomebrew-input-panel");
      const right = html.querySelector(".dshomebrew-preview-panel");
      if (left) left.scrollTop = this._scrollPositions.left ?? 0;
      if (right) right.scrollTop = this._scrollPositions.right ?? 0;
    }

    // Track scroll positions before next render
    const leftPanel = html.querySelector(".dshomebrew-input-panel");
    const rightPanel = html.querySelector(".dshomebrew-preview-panel");
    const saveScroll = () => {
      this._scrollPositions = {
        left: leftPanel?.scrollTop ?? 0,
        right: rightPanel?.scrollTop ?? 0,
      };
    };
    leftPanel?.addEventListener("scroll", saveScroll);
    rightPanel?.addEventListener("scroll", saveScroll);

    // Standard form inputs
    html.querySelectorAll("input[type='text'], input[type='number'], select:not([multiple])").forEach(el => {
      if (el.closest(".dshomebrew-tag-select")) return;
      if (el.dataset.effectId) return; // handled by effect handler
      el.addEventListener("change", this.#onFieldChange.bind(this));
    });

    // Checkbox fields (extraStamina)
    html.querySelectorAll("input[type='checkbox'][data-field]").forEach(el => {
      el.addEventListener("change", this.#onFieldChange.bind(this));
    });

    // Tag select toggles (keywords, movement types, damage types)
    html.querySelectorAll(".dshomebrew-tag-select").forEach(container => {
      container.querySelectorAll("input[type='checkbox']").forEach(cb => {
        cb.addEventListener("change", this.#onTagChange.bind(this));
      });
    });

    // Effect-level field inputs (within effect cards)
    html.querySelectorAll("[data-effect-id]").forEach(el => {
      if (el.dataset.action) return; // skip action buttons
      if (el.closest(".dshomebrew-tag-select")) return; // handled above
      if (el.tagName === "INPUT" || el.tagName === "SELECT") {
        el.addEventListener("change", this.#onEffectFieldChange.bind(this));
      }
    });

    // Immunity/weakness inline inputs
    html.querySelectorAll("[data-field^='immunities-'], [data-field^='weaknesses-']").forEach(el => {
      el.addEventListener("change", this.#onDmgEntryChange.bind(this));
    });
  }

  #onFieldChange(event) {
    const el = event.currentTarget;
    const field = el.dataset.field;
    if (!field) return;

    const d = this.#data;
    switch (field) {
      case "name":
        d.name = el.value;
        break;
      case "level":
        d.level = Math.min(Math.max(Number(el.value) || 1, 1), 11);
        break;
      case "roleKey":
        d.roleKey = el.value;
        break;
      case "orgKey":
        d.orgKey = el.value;
        // Leader and Solo don't use roles — auto-set to No Role
        if ((d.orgKey === "leader" || d.orgKey === "solo") && d.roleKey !== "noRole") {
          d.roleKey = "noRole";
        }
        break;
      case "sizeCombo":
        d.sizeCombo = el.value;
        break;
      case "characteristics": {
        const idx = Number(el.dataset.index);
        d.characteristics[idx] = Number(el.value) || 0;
        break;
      }
      case "abilityName":
        d.abilityName = el.value;
        break;
      case "distanceType":
        d.distanceType = el.value;
        break;
      case "distancePrimary":
        d.distancePrimary = Math.max(1, Number(el.value) || 1);
        break;
      case "distanceSecondary":
        d.distanceSecondary = Math.max(1, Number(el.value) || 1);
        break;
      case "distanceTertiary":
        d.distanceTertiary = Math.max(1, Number(el.value) || 1);
        break;
      case "targetType":
        d.targetType = el.value;
        break;
      case "targetValue":
        d.targetValue = Math.max(1, Number(el.value) || 1);
        break;
      case "targetCustom":
        d.targetCustom = el.value;
        break;
      case "extraStamina":
        d.extraStamina = el.checked;
        break;
      case "speed":
        d.speed = Math.max(0, Number(el.value) || 5);
        break;
      case "stability":
        d.stability = Math.max(0, Number(el.value) || 0);
        break;
    }

    this.render();
  }

  #onEffectFieldChange(event) {
    const el = event.currentTarget;
    const effectId = el.dataset.effectId;
    const field = el.dataset.effectField;
    if (!effectId || !field) return;

    const eff = this.#data.powerRollEffects.find(e => e.id === effectId);
    if (!eff) return;

    switch (field) {
      case "type":
        eff.type = el.value;
        break;
      case "name":
        eff.name = el.value;
        break;
      case "tier1Value":
      case "tier2Value":
      case "tier3Value":
        eff[field] = el.value;
        break;
      case "tier1Condition":
      case "tier2Condition":
      case "tier3Condition":
        eff[field] = el.value;
        break;
      case "tier1ConditionEnd":
      case "tier2ConditionEnd":
      case "tier3ConditionEnd":
        eff[field] = el.value;
        break;
      case "tier1Movement":
      case "tier2Movement":
      case "tier3Movement":
        eff[field] = el.value;
        break;
      case "tier1Distance":
      case "tier2Distance":
      case "tier3Distance":
        eff[field] = Math.max(0, Number(el.value) || 0);
        break;
      case "tier1Display":
      case "tier2Display":
      case "tier3Display":
        eff[field] = el.value;
        break;
      case "resourceType":
        eff.resourceType = el.value;
        break;
      case "tier1Amount":
      case "tier2Amount":
      case "tier3Amount":
        eff[field] = Math.max(0, Number(el.value) || 0);
        break;
    }

    this.render();
  }

  #onTagChange(event) {
    const cb = event.currentTarget;
    const container = cb.closest(".dshomebrew-tag-select");
    const field = container.dataset.field;
    if (!field) return;

    const selected = Array.from(container.querySelectorAll("input[type='checkbox']:checked"))
      .map(el => el.value);

    // Check if this is inside an effect card
    const effectId = container.dataset.effectId;
    if (effectId) {
      const eff = this.#data.powerRollEffects.find(e => e.id === effectId);
      if (eff) eff[field] = selected;
    } else {
      this.#data[field] = selected;
    }
    this.render();
  }

  #onDmgEntryChange(event) {
    const el = event.currentTarget;
    const field = el.dataset.field; // e.g. "immunities-type" or "weaknesses-value"
    const idx = Number(el.dataset.index);
    const [listKey, prop] = field.split("-"); // "immunities", "type"

    if (!this.#data[listKey]?.[idx]) return;
    if (prop === "type") this.#data[listKey][idx].type = el.value;
    else if (prop === "value") this.#data[listKey][idx].value = Math.max(0, Number(el.value) || 0);

    this.render();
  }

  /* -------------------------------------------------- */
  /*  Actions                                           */
  /* -------------------------------------------------- */

  static #onApplySuggested() {
    const suggested = getSuggestedCharArray(this.#data.level, this.#data.orgKey);
    this.#data.characteristics = [...suggested];
    this.render();
  }

  static #onAddImmunity() {
    this.#data.immunities.push({ type: "fire", value: 0 });
    this.render();
  }

  static #onRemoveImmunity(event, target) {
    const idx = Number(target.dataset.index);
    this.#data.immunities.splice(idx, 1);
    this.render();
  }

  static #onAddWeakness() {
    this.#data.weaknesses.push({ type: "fire", value: 0 });
    this.render();
  }

  static #onRemoveWeakness(event, target) {
    const idx = Number(target.dataset.index);
    this.#data.weaknesses.splice(idx, 1);
    this.render();
  }

  static #onAddSignatureAbility() {
    this.#data.hasSignature = true;
    this.render();
  }

  static #onRemoveSignatureAbility() {
    this.#data.hasSignature = false;
    this.render();
  }

  static #onAddEffect() {
    this.#data.powerRollEffects.push(MonsterWizardApp.createEffect("damage"));
    this.render();
  }

  static #onRemoveEffect(event, target) {
    const effectId = target.dataset.effectId;
    this.#data.powerRollEffects = this.#data.powerRollEffects.filter(e => e.id !== effectId);
    this.render();
  }

  static async #onCreateMonster() {
    const d = this.#data;
    if (!d.name?.trim()) {
      ui.notifications.warn(game.i18n.localize("DSENCOUNTER.Homebrew.Warn.NoName"));
      return;
    }

    const sizeOpt = SIZE_OPTIONS.find(o => o.value === d.sizeCombo) ?? { size: 1, letter: "M" };

    const stats = computeAllStats({
      level: d.level,
      roleKey: d.roleKey,
      orgKey: d.orgKey,
      characteristics: d.characteristics,
      targetCount: TARGET_HAS_VALUE.has(d.targetType) ? (d.targetValue ?? 1) : 1,
      extraStamina: d.extraStamina,
    });

    // Merge size info into wizard data for createMonsterActor
    const wizardData = {
      ...d,
      size: sizeOpt.size,
      sizeLetter: sizeOpt.letter,
    };

    const actor = await createMonsterActor(wizardData, stats);
    if (actor) {
      ui.notifications.info(game.i18n.format("DSENCOUNTER.Homebrew.Created", { name: actor.name }));
      actor.sheet.render(true);
      this.close();
    }
  }
}
