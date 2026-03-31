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

  // Register settings
  game.settings.register(MODULE_ID, "numHeroes", {
    name: "Number of Heroes",
    scope: "client",
    config: false,
    type: Number,
    default: 5,
  });

  game.settings.register(MODULE_ID, "heroLevel", {
    name: "Hero Level",
    scope: "client",
    config: false,
    type: Number,
    default: 1,
  });

  game.settings.register(MODULE_ID, "sourceFilters", {
    name: "Source Filters",
    scope: "client",
    config: false,
    type: String,
    default: "",
  });

  // Load templates
  foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/encounter-builder.hbs`,
  ]);

  // ── Handlebars helpers ───────────────────────────────────────────────────
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => a > b);
  Handlebars.registerHelper("and", (a, b) => !!a && !!b);
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

// ── Canvas drop handler: reuse or import actors into folder ──────────────────

async function getOrCreateEncounterFolder() {
  const folderName = "Encounter Builder";
  let folder = game.folders.find((f) => f.type === "Actor" && f.name === folderName);
  if (!folder) {
    folder = await Folder.create({ name: folderName, type: "Actor" });
  }
  return folder;
}

Hooks.on("dropCanvasData", (canvas, data) => {
  if (!_systemValid) return true;
  if (data.type !== "Actor" || !data.dsencounter) return true;
  if (!data.uuid?.startsWith("Compendium.")) return true;

  // Return false synchronously to prevent Foundry's default import,
  // then handle the async import/spawn in the background.
  _handleEncounterDrop(canvas, data);
  return false;
});

async function _handleEncounterDrop(canvas, data) {
  // Check for an already-imported world actor from this compendium entry
  let actor = game.actors.find((a) => a.flags?.core?.sourceId === data.uuid);

  if (!actor) {
    // Import into the Encounter Builder folder
    const folder = await getOrCreateEncounterFolder();
    const doc = await fromUuid(data.uuid);
    if (!doc) return;
    const actorData = doc.toObject();
    actorData.folder = folder.id;
    // Set sourceId flag so future drops reuse this actor
    foundry.utils.setProperty(actorData, "flags.core.sourceId", data.uuid);
    actor = await Actor.create(actorData);
  }

  // Snap to the center of the hovered grid cell, then offset to top-left (tokens position by top-left)
  const center = canvas.grid.getSnappedPoint({x: data.x, y: data.y}, {mode: CONST.GRID_SNAPPING_MODES.CENTER});
  const gs = canvas.grid.size;
  const x = center.x - gs / 2;
  const y = center.y - gs / 2;

  // Create token at the snapped position
  const td = await actor.getTokenDocument({x, y});
  await canvas.scene.createEmbeddedDocuments("Token", [td.toObject()]);
}
