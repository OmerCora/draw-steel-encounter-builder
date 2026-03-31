/**
 * Draw Steel Encounter Builder
 * Main module entry point — registers hooks, sidebar button, and module API.
 */

import { MODULE_ID, SYSTEM_ID } from "./config.mjs";
import { EncounterBuilderApp } from "./encounter/encounter-app.mjs";

const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

let _systemValid = false;

// ── Init ─────────────────────────────────────────────────────────────────────

Hooks.once("init", () => {
  if (game.system?.id !== SYSTEM_ID) return;
  _systemValid = true;

  // Load templates
  foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/encounter-builder.hbs`,
  ]);

  // ── Handlebars helpers ───────────────────────────────────────────────────
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => a > b);
  Handlebars.registerHelper("math", (a, op, b) => {
    a = Number(a); b = Number(b);
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b !== 0 ? a / b : 0;
      default: return 0;
    }
  });
  Handlebars.registerHelper("capitalize", (str) => {
    if (typeof str !== "string") return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  Handlebars.registerHelper("concat", (...args) => {
    // Last arg is the Handlebars options hash — exclude it
    return args.slice(0, -1).join("");
  });

  log("Initialized");
});

// ── Ready ────────────────────────────────────────────────────────────────────

Hooks.once("ready", () => {
  if (!_systemValid) return;

  // Public API
  game.modules.get(MODULE_ID).api = { EncounterBuilderApp };

  log("Ready — use game.modules.get('" + MODULE_ID + "').api.EncounterBuilderApp.toggle()");
});

// ── Scene-control button (Foundry v13 object API) ────────────────────────────

Hooks.on("getSceneControlButtons", (controls) => {
  if (!_systemValid) return;
  if (!game.user.isGM) return; // GM-only tool

  const tokenGroup = controls.tokens ?? controls.token;
  if (!tokenGroup) return;

  tokenGroup.tools.dsencounter = {
    name: "dsencounter",
    title: game.i18n.localize("DSENCOUNTER.SidebarButton"),
    icon: "fa-solid fa-swords",
    button: true,
    onChange: () => EncounterBuilderApp.toggle(),
  };
});
