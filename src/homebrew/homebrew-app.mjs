/**
 * Homebrew Landing Page – ApplicationV2 singleton.
 * Presents category buttons (Monster, Animal, Retainer, Ability).
 */

import { MODULE_ID } from "../config.mjs";
import { MonsterWizardApp } from "./monster-wizard.mjs";

export class HomebrewApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {

  /* -------------------------------------------------- */
  /*  Static                                            */
  /* -------------------------------------------------- */

  static _instance = null;

  static toggle() {
    if (this._instance?.rendered) {
      this._instance.close();
    } else {
      this._instance ??= new this();
      this._instance.render({ force: true });
    }
  }

  /* -------------------------------------------------- */

  static DEFAULT_OPTIONS = {
    id: "homebrew-landing",
    classes: ["draw-steel-homebrew"],
    position: { width: 520, height: 400 },
    window: {
      title: "DSENCOUNTER.Homebrew.WindowTitle",
      resizable: false,
      icon: "fa-solid fa-hammer",
    },
    actions: {
      openMonsterWizard: HomebrewApp.#onOpenMonsterWizard,
    },
  };

  /* -------------------------------------------------- */

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/homebrew/homebrew-landing.hbs`,
    },
  };

  /* -------------------------------------------------- */
  /*  Rendering                                         */
  /* -------------------------------------------------- */

  async _prepareContext() {
    return {
      categories: [
        { key: "monster", icon: "fa-solid fa-dragon", label: game.i18n.localize("DSENCOUNTER.Homebrew.Monster"), enabled: true, action: "openMonsterWizard" },
        { key: "animal", icon: "fa-solid fa-paw", label: game.i18n.localize("DSENCOUNTER.Homebrew.Animal"), enabled: false },
        { key: "retainer", icon: "fa-solid fa-shield-halved", label: game.i18n.localize("DSENCOUNTER.Homebrew.Retainer"), enabled: false },
        { key: "ability", icon: "fa-solid fa-bolt", label: game.i18n.localize("DSENCOUNTER.Homebrew.Ability"), enabled: false },
      ],
    };
  }

  /* -------------------------------------------------- */
  /*  Actions                                           */
  /* -------------------------------------------------- */

  static #onOpenMonsterWizard() {
    this.close();
    MonsterWizardApp.open();
  }
}
