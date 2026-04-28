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
import {
  CHAR_KEYS, CHAR_ABBREVS, DAMAGE_TYPES, TARGET_HAS_VALUE,
  ABILITY_TYPES, ABILITY_TYPE_ORDER,
  createAbilityData, createEffectData,
  prepareAbilityEditorContext, prepareAbilityPreviewContext,
  bindAbilityEditorEvents, flushAbilityFocusedInput,
  buildAbilityItemData,
} from "./ability-data.mjs";

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
      createMonster: MonsterWizardApp.onCreateMonster,
      addImmunity: MonsterWizardApp.#onAddImmunity,
      removeImmunity: MonsterWizardApp.#onRemoveImmunity,
      addWeakness: MonsterWizardApp.#onAddWeakness,
      removeWeakness: MonsterWizardApp.#onRemoveWeakness,
      addAbility: MonsterWizardApp.#onAddAbility,
      addMalice: MonsterWizardApp.#onAddMalice,
      addFeature: MonsterWizardApp.#onAddFeature,
      removeFeature: MonsterWizardApp.#onRemoveFeature,
      removeAbility: MonsterWizardApp.#onRemoveAbility,
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
    // Abilities (signature, regular, malice)
    abilities: [],
    // Features (traits)
    features: [],
    // Monster stats
    extraStamina: false,
    speed: 5,
    stability: 0,
    movementTypes: ["walk"],
    sizeCombo: "1M",
    keywords: [],
    immunities: [],
    weaknesses: [],
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
   * Find an ability in the abilities array by ID.
   */
  #getAbility(id) {
    return this.#data.abilities.find(a => a.id === id);
  }

  /* -------------------------------------------------- */
  /*  Rendering                                         */
  /* -------------------------------------------------- */

  /**
   * Override render to support debounced rendering.
   * When {debounce: true} is passed, the render is delayed so that
   * click events on buttons can fire before the DOM is replaced.
   * Non-debounced calls cancel any pending debounced render.
   */
  render(options = {}) {
    const { debounce, ...renderOptions } = options;
    if (debounce) {
      clearTimeout(this._renderTimeout);
      this._renderTimeout = setTimeout(() => {
        this._renderTimeout = null;
        super.render(renderOptions);
      }, 50);
      return;
    }
    clearTimeout(this._renderTimeout);
    this._renderTimeout = null;
    return super.render(renderOptions);
  }

  async _prepareContext() {
    const d = this.#data;
    const sizeInfo = this.#parseSizeCombo();

    // Use first ability's target count for stats (if any)
    const firstAbility = d.abilities[0];
    const targetCount = firstAbility && TARGET_HAS_VALUE.has(firstAbility.targetType)
      ? (firstAbility.targetValue ?? 1) : 1;

    const stats = computeAllStats({
      level: d.level,
      roleKey: d.roleKey,
      orgKey: d.orgKey,
      characteristics: d.characteristics,
      targetCount,
      extraStamina: d.extraStamina,
    });
    const highestChar = calcHighestChar(d.level, d.orgKey);

    const levelOptions = Array.from({ length: 11 }, (_, i) => ({
      value: i + 1,
      selected: (i + 1) === d.level,
    }));

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

    const sizeOptions = SIZE_OPTIONS.map(o => ({
      ...o,
      selected: o.value === d.sizeCombo,
    }));

    const chars = CHAR_KEYS.map((key, i) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      abbrev: CHAR_ABBREVS[i],
      value: d.characteristics[i],
    }));

    const damageTypeOptionsAll = [{ key: "all", label: "All" }].concat(
      DAMAGE_TYPES.map(dt => ({
        key: dt,
        label: dt.charAt(0).toUpperCase() + dt.slice(1),
      }))
    );

    const movementTypeOptions = MOVEMENT_TYPES.map(mt => ({
      key: mt,
      label: mt.charAt(0).toUpperCase() + mt.slice(1),
      selected: d.movementTypes.includes(mt),
    }));

    const keywordOptions = MONSTER_KEYWORDS.map(kw => ({
      key: kw,
      label: kw.charAt(0).toUpperCase() + kw.slice(1),
      selected: d.keywords.includes(kw),
    }));

    // Build ability editor + preview contexts
    const abilityEditors = d.abilities.map(ability => {
      const editorOpts = { stats, showRemove: true };
      if (ability.isMalice) {
        editorOpts.lockType = true;
      } else {
        editorOpts.excludeTypes = ["none"];
      }
      return prepareAbilityEditorContext(ability, editorOpts);
    });
    const abilityPreviews = d.abilities.map(ability =>
      prepareAbilityPreviewContext(ability, stats)
    );

    // Build feature contexts
    const featureEditors = d.features.map(f => ({ ...f }));
    const featurePreviews = d.features.map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
    }));

    // Group abilities by type for right panel display (in defined order)
    const abilityGroups = [];
    for (const typeKey of ABILITY_TYPE_ORDER) {
      const items = abilityPreviews.filter(a => a.abilityType === typeKey);
      if (items.length > 0) {
        // Sort signature abilities above non-signature within the same group
        items.sort((a, b) => {
          const aS = a.abilityCategory === "signature" ? 0 : 1;
          const bS = b.abilityCategory === "signature" ? 0 : 1;
          return aS - bS;
        });
        abilityGroups.push({
          typeKey,
          typeLabel: game.i18n.localize(`DSENCOUNTER.Homebrew.AbilityType.${typeKey}`),
          abilities: items,
        });
      }
    }

    // Computed display strings for stat block preview
    const roleLabel = d.roleKey === "noRole" ? "" : d.roleKey.charAt(0).toUpperCase() + d.roleKey.slice(1);
    const orgLabel = d.orgKey.charAt(0).toUpperCase() + d.orgKey.slice(1);
    const keywordLabels = d.keywords.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(", ");
    const sizeDisplay = sizeInfo.size === 1 ? `${sizeInfo.size}${sizeInfo.letter}` : `${sizeInfo.size}`;

    const nonWalkMovement = d.movementTypes.filter(m => m !== "walk");
    const movementLabel = nonWalkMovement.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(", ");

    const immunityDisplay = d.immunities.map(i => `${i.type} ${i.value}`).join(", ");
    const weaknessDisplay = d.weaknesses.map(w => `${w.type} ${w.value}`).join(", ");

    const isMinion = d.orgKey === "minion";

    return {
      data: d,
      stats,
      highestChar,
      levelOptions,
      chars,
      roleOptions,
      orgOptions,
      sizeOptions,
      damageTypeOptionsAll,
      movementTypeOptions,
      keywordOptions,
      suggestedChars: getSuggestedCharArray(d.level, d.orgKey),
      roleLabel,
      orgLabel,
      keywordLabels,
      sizeDisplay,
      movementLabel,
      immunityDisplay,
      weaknessDisplay,
      isMinion,
      abilityEditors,
      abilityPreviews,
      abilityGroups,
      hasAbilities: d.abilities.length > 0,
      featureEditors,
      featurePreviews,
      hasFeatures: d.features.length > 0,
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

    // Monster-level form inputs (exclude anything inside ability editors)
    html.querySelectorAll("input[type='text'][data-field], input[type='number'][data-field], select[data-field]").forEach(el => {
      if (el.closest("[data-ability-id]")) return; // handled by ability editor
      if (el.closest(".dshomebrew-tag-select")) return;
      el.addEventListener("change", this.#onFieldChange.bind(this));
    });

    // Checkbox fields (extraStamina)
    html.querySelectorAll("input[type='checkbox'][data-field]").forEach(el => {
      if (el.closest("[data-ability-id]")) return;
      if (el.closest(".dshomebrew-tag-select")) return;
      el.addEventListener("change", this.#onFieldChange.bind(this));
    });

    // Monster-level tag selects (keywords, movementTypes)
    html.querySelectorAll(".dshomebrew-tag-select").forEach(container => {
      if (container.closest("[data-ability-id]")) return; // handled by ability editor
      container.querySelectorAll("input[type='checkbox']").forEach(cb => {
        cb.addEventListener("change", this.#onTagChange.bind(this));
      });
    });

    // Immunity/weakness inline inputs
    html.querySelectorAll("[data-field^='immunities-'], [data-field^='weaknesses-']").forEach(el => {
      el.addEventListener("change", this.#onDmgEntryChange.bind(this));
    });

    // Bind ability editor events for each ability section
    const getAbility = (id) => this.#getAbility(id);
    const onRender = () => this.render({ debounce: true });
    html.querySelectorAll("[data-ability-id]").forEach(container => {
      bindAbilityEditorEvents(container, getAbility, onRender);
    });

    // Feature editor inputs
    html.querySelectorAll(".dshomebrew-feature-editor input[data-feature-field], .dshomebrew-feature-editor textarea[data-feature-field]").forEach(el => {
      el.addEventListener("change", this.#onFeatureFieldChange.bind(this));
    });
  }

  /**
   * Apply a monster-level field's value from a DOM element to #data without re-rendering.
   */
  #applyFieldValue(el) {
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
  }

  #onFieldChange(event) {
    this.#applyFieldValue(event.currentTarget);
    this.render({ debounce: true });
  }

  #onTagChange(event) {
    const cb = event.currentTarget;
    const container = cb.closest(".dshomebrew-tag-select");
    const field = container.dataset.field;
    if (!field) return;

    const selected = Array.from(container.querySelectorAll("input[type='checkbox']:checked"))
      .map(el => el.value);
    this.#data[field] = selected;
    this.render({ debounce: true });
  }

  /**
   * Apply an immunity/weakness entry field value without re-rendering.
   */
  #applyDmgEntryValue(el) {
    const field = el.dataset.field;
    const idx = Number(el.dataset.index);
    const [listKey, prop] = field.split("-");

    if (!this.#data[listKey]?.[idx]) return;
    if (prop === "type") this.#data[listKey][idx].type = el.value;
    else if (prop === "value") this.#data[listKey][idx].value = Math.max(0, Number(el.value) || 0);
  }

  #onDmgEntryChange(event) {
    this.#applyDmgEntryValue(event.currentTarget);
    this.render({ debounce: true });
  }

  /**
   * Capture the value of any currently focused input/select into #data
   * so that action handlers get up-to-date state without requiring a blur first.
   */
  #flushFocusedInput() {
    const focused = this.element?.querySelector("input:focus, select:focus");
    if (!focused) return;

    // Check if it's inside an ability editor
    const abilityContainer = focused.closest("[data-ability-id]");
    if (abilityContainer) {
      flushAbilityFocusedInput(abilityContainer, (id) => this.#getAbility(id));
      return;
    }

    // Check if it's inside a feature editor
    const featureContainer = focused.closest(".dshomebrew-feature-editor");
    if (featureContainer) {
      this.#applyFeatureFieldValue(focused);
      return;
    }

    if (focused.dataset.field?.includes("-")) {
      this.#applyDmgEntryValue(focused);
    } else if (focused.dataset.field) {
      this.#applyFieldValue(focused);
    }
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

  static #onAddAbility() {
    this.#data.abilities.push(createAbilityData({}));
    this.render();
  }

  static #onAddMalice() {
    this.#data.abilities.push(createAbilityData({
      abilityType: "none",
      distanceType: "special",
      targetType: "special",
      isMalice: true,
    }));
    this.render();
  }

  static #onAddFeature() {
    this.#data.features.push({
      id: foundry.utils.randomID(),
      name: "",
      description: "",
    });
    this.render();
  }

  static #onRemoveFeature(event, target) {
    const featureId = target.dataset.featureId;
    this.#data.features = this.#data.features.filter(f => f.id !== featureId);
    this.render();
  }

  /**
   * Apply a feature field value from a DOM element.
   */
  #applyFeatureFieldValue(el) {
    const featureId = el.closest(".dshomebrew-feature-editor")?.dataset.featureId;
    const field = el.dataset.featureField;
    if (!featureId || !field) return;
    const feature = this.#data.features.find(f => f.id === featureId);
    if (!feature) return;
    feature[field] = el.value;
  }

  #onFeatureFieldChange(event) {
    this.#applyFeatureFieldValue(event.currentTarget);
    this.render({ debounce: true });
  }

  static #onRemoveAbility(event, target) {
    const abilityId = target.dataset.abilityId;
    this.#data.abilities = this.#data.abilities.filter(a => a.id !== abilityId);
    this.render();
  }

  static #onAddEffect(event, target) {
    const abilityId = target.closest("[data-ability-id]")?.dataset.abilityId;
    const ability = this.#getAbility(abilityId);
    if (ability) {
      ability.powerRollEffects.push(createEffectData("damage"));
      this.render();
    }
  }

  static #onRemoveEffect(event, target) {
    const abilityId = target.closest("[data-ability-id]")?.dataset.abilityId;
    const ability = this.#getAbility(abilityId);
    if (ability) {
      const effectId = target.dataset.effectId;
      ability.powerRollEffects = ability.powerRollEffects.filter(e => e.id !== effectId);
      this.render();
    }
  }

  static async onCreateMonster() {
    // Flush any pending field value from a focused input before creating
    this.#flushFocusedInput();

    const d = this.#data;
    if (!d.name?.trim()) {
      ui.notifications.warn(game.i18n.localize("DSENCOUNTER.Homebrew.Warn.NoName"));
      return;
    }

    const sizeOpt = SIZE_OPTIONS.find(o => o.value === d.sizeCombo) ?? { size: 1, letter: "M" };

    // Use first ability's target count for stats (if any)
    const firstAbility = d.abilities[0];
    const targetCount = firstAbility && TARGET_HAS_VALUE.has(firstAbility.targetType)
      ? (firstAbility.targetValue ?? 1) : 1;

    const stats = computeAllStats({
      level: d.level,
      roleKey: d.roleKey,
      orgKey: d.orgKey,
      characteristics: d.characteristics,
      targetCount,
      extraStamina: d.extraStamina,
    });

    const highestChar = calcHighestChar(d.level, d.orgKey);

    // Merge size info into wizard data for createMonsterActor
    const wizardData = {
      ...d,
      size: sizeOpt.size,
      sizeLetter: sizeOpt.letter,
    };

    // Build ability items from the abilities array
    const abilityItems = d.abilities.map(ability => {
      // Auto-select power roll characteristics if user didn't pick any
      let rollChars;
      if (ability.powerRollChars?.length > 0) {
        rollChars = new Set(ability.powerRollChars);
      } else {
        rollChars = new Set(CHAR_KEYS.filter((_, i) => d.characteristics[i] === highestChar));
      }
      return buildAbilityItemData(ability, stats, { rollChars });
    });

    // Build feature items
    const featureItems = d.features
      .filter(f => f.name?.trim())
      .map(f => ({
        name: f.name,
        type: "feature",
        system: {
          description: { value: f.description ? `<p>${f.description}</p>` : "", director: "" },
        },
      }));

    const actor = await createMonsterActor(wizardData, stats, [...featureItems, ...abilityItems]);
    if (actor) {
      ui.notifications.info(game.i18n.format("DSENCOUNTER.Homebrew.Created", { name: actor.name }));
      actor.sheet.render(true);
      this.close();
    }
  }
}
