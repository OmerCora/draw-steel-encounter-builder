/**
 * Ability Wizard – standalone two-panel ApplicationV2.
 * Left panel: ability editor (shared with monster wizard). Right panel: live preview.
 * Creates a standalone ability Item in a "Homebrew Abilities" folder.
 */

import { MODULE_ID } from "../config.mjs";
import {
  CHAR_KEYS,
  createAbilityData, createEffectData,
  prepareAbilityEditorContext, prepareAbilityPreviewContext,
  bindAbilityEditorEvents, flushAbilityFocusedInput,
  buildAbilityItemData,
} from "./ability-data.mjs";

const HOMEBREW_FOLDER = "Homebrew Abilities";

/**
 * Get or create the "Homebrew Abilities" items folder.
 */
async function getOrCreateFolder() {
  let folder = game.folders.find(f => f.type === "Item" && f.name === HOMEBREW_FOLDER);
  if (!folder) {
    folder = await Folder.create({ name: HOMEBREW_FOLDER, type: "Item" });
  }
  return folder;
}

export class AbilityWizardApp extends foundry.applications.api.HandlebarsApplicationMixin(
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
    id: "ability-wizard",
    classes: ["draw-steel-homebrew", "draw-steel-ability-wizard"],
    position: { width: 780, height: 650 },
    window: {
      title: "DSENCOUNTER.Homebrew.AbilityWizardTitle",
      resizable: true,
      icon: "fa-solid fa-bolt",
    },
    actions: {
      addEffect: AbilityWizardApp.#onAddEffect,
      removeEffect: AbilityWizardApp.#onRemoveEffect,
      createAbility: AbilityWizardApp.onCreateAbility,
    },
  };

  /* -------------------------------------------------- */

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/homebrew/ability-wizard.hbs`,
    },
  };

  /* -------------------------------------------------- */
  /*  Instance state                                    */
  /* -------------------------------------------------- */

  #ability = createAbilityData({});

  /* -------------------------------------------------- */
  /*  Rendering                                         */
  /* -------------------------------------------------- */

  /**
   * Override render to support debounced rendering.
   * When {debounce: true} is passed, the render is delayed so that
   * click events on buttons can fire before the DOM is replaced.
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
    const ability = this.#ability;

    // No stats in standalone mode – damage placeholders will be empty
    const editorCtx = prepareAbilityEditorContext(ability, {});
    const previewCtx = prepareAbilityPreviewContext(ability, {});

    return {
      editor: editorCtx,
      preview: previewCtx,
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

    // Track scroll positions
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

    // Bind ability editor events
    const getAbility = () => this.#ability;
    const onRender = () => this.render({ debounce: true });
    const container = html.querySelector("[data-ability-id]");
    if (container) {
      bindAbilityEditorEvents(container, getAbility, onRender);
    }
  }

  /**
   * Flush focused input before actions.
   */
  #flushFocusedInput() {
    const container = this.element?.querySelector("[data-ability-id]");
    if (container) {
      flushAbilityFocusedInput(container, () => this.#ability);
    }
  }

  /* -------------------------------------------------- */
  /*  Actions                                           */
  /* -------------------------------------------------- */

  static #onAddEffect() {
    this.#ability.powerRollEffects.push(createEffectData("damage"));
    this.render();
  }

  static #onRemoveEffect(event, target) {
    const effectId = target.dataset.effectId;
    this.#ability.powerRollEffects = this.#ability.powerRollEffects.filter(e => e.id !== effectId);
    this.render();
  }

  static async onCreateAbility() {
    this.#flushFocusedInput();

    const ability = this.#ability;
    if (!ability.name?.trim()) {
      ui.notifications.warn(game.i18n.localize("DSENCOUNTER.Homebrew.Warn.NoAbilityName"));
      return;
    }

    const folder = await getOrCreateFolder();
    const itemData = buildAbilityItemData(ability, {});
    itemData.folder = folder.id;

    const item = await Item.create(itemData);
    if (item) {
      ui.notifications.info(game.i18n.format("DSENCOUNTER.Homebrew.AbilityCreated", { name: item.name }));
      item.sheet.render(true);
      this.close();
    }
  }
}
