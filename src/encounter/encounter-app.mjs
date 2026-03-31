/**
 * Encounter Builder – main ApplicationV2 singleton.
 * Provides the GM-facing UI for building balanced encounters.
 */

import { MODULE_ID } from "../config.mjs";
import {
  calcPartyES, calcBudgetRange, calcHeroES,
  getDifficulty, getRecommendedLevelRange, DIFFICULTIES,
} from "./encounter-calc.mjs";
import { loadMonsterIndex, filterMonsters, getRoleOptions, getOrganizationOptions } from "./monster-browser.mjs";
import { createEncounterJournal } from "./encounter-journal.mjs";

export class EncounterBuilderApp extends foundry.applications.api.HandlebarsApplicationMixin(
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
    id: "encounter-builder",
    classes: ["draw-steel-encounter-builder"],
    position: { width: 1100, height: 820 },
    window: {
      title: "DSENCOUNTER.WindowTitle",
      resizable: true,
      icon: "fa-solid fa-swords",
    },
    actions: {
      addMonster: EncounterBuilderApp.#onAddMonster,
      removeMonster: EncounterBuilderApp.#onRemoveMonster,
      incrementMonster: EncounterBuilderApp.#onIncrementMonster,
      decrementMonster: EncounterBuilderApp.#onDecrementMonster,
      createGroup: EncounterBuilderApp.#onCreateGroup,
      deleteGroup: EncounterBuilderApp.#onDeleteGroup,
      toggleCaptain: EncounterBuilderApp.#onToggleCaptain,
      saveToJournal: EncounterBuilderApp.#onSaveToJournal,
      removeRoleFilter: EncounterBuilderApp.#onRemoveRoleFilter,
      refreshIndex: EncounterBuilderApp.#onRefreshIndex,
    },
  };

  /* -------------------------------------------------- */

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/encounter-builder.hbs`,
      scrollable: [".dsencounter-browser-list", ".dsencounter-selected-list"],
    },
  };

  /* -------------------------------------------------- */
  /*  Instance state (in-memory, not persisted)         */
  /* -------------------------------------------------- */

  /** @type {MonsterEntry[]} Cached full monster index. */
  #monsterIndex = [];
  #indexLoaded = false;

  /** Encounter parameters. */
  #heroLevel = 1;
  #numHeroes = 5;
  #avgVictories = 0;
  #difficulty = "standard";

  /** Filters for the monster browser. */
  #searchText = "";
  #roleFilters = new Set();
  #orgFilter = "";

  /**
   * Selected monsters.
   * Each entry: { id, uuid, name, img, level, ev, role, roleLabel, organization, orgLabel, groupId, isSquadCaptain }
   * id is a unique selection ID (not the document id).
   */
  #selectedMonsters = [];
  #nextSelectionId = 1;

  /**
   * Groups. Each: { id, name }
   */
  #groups = [];
  #nextGroupNum = 1;

  /* -------------------------------------------------- */
  /*  Lifecycle                                         */
  /* -------------------------------------------------- */

  async _prepareContext(_options) {
    // Lazy-load monster index
    if (!this.#indexLoaded) {
      this.#monsterIndex = await loadMonsterIndex();
      this.#indexLoaded = true;
    }

    // ── Encounter math ────────────────────────────────────────────────────
    const partyES = calcPartyES(this.#heroLevel, this.#numHeroes, this.#avgVictories);
    const budget = calcBudgetRange(partyES, this.#heroLevel, this.#difficulty);
    const totalEV = this.#calcTotalEV();
    const currentDifficulty = getDifficulty(totalEV, partyES, this.#heroLevel);
    const levelRange = getRecommendedLevelRange(this.#heroLevel, this.#avgVictories);

    // ── Progress bar data ─────────────────────────────────────────────────
    const progressBar = this.#buildProgressBar(budget, totalEV);

    // ── Filtered monster list ─────────────────────────────────────────────
    const filteredMonsters = filterMonsters(this.#monsterIndex, {
      search: this.#searchText,
      roles: this.#roleFilters,
      organization: this.#orgFilter,
    });

    // Annotate with level appropriateness
    for (const m of filteredMonsters) {
      if (m.organization === "solo") {
        m.levelWarning = m.level > levelRange.soloMax ? "danger" : "";
      } else {
        m.levelWarning = m.level > levelRange.max ? "danger" : "";
      }
    }

    // ── Selected monsters aggregated ──────────────────────────────────────
    const ungrouped = this.#selectedMonsters.filter((m) => !m.groupId);
    const groupedData = this.#groups.map((g) => ({
      ...g,
      monsters: this.#selectedMonsters.filter((m) => m.groupId === g.id),
    }));

    // Aggregate duplicate counts for display
    const aggregateList = (list) => {
      const map = new Map();
      for (const m of list) {
        const existing = map.get(m.uuid);
        if (existing) {
          existing.count += 1;
          existing.ids.push(m.id);
        } else {
          map.set(m.uuid, { ...m, count: 1, ids: [m.id] });
        }
      }
      return Array.from(map.values());
    };

    const ungroupedAggregated = aggregateList(ungrouped);
    const groupedAggregated = groupedData.map((g) => ({
      ...g,
      monsters: aggregateList(g.monsters),
    }));

    // ── Role filter chips ─────────────────────────────────────────────────
    const allRoles = getRoleOptions();
    const roleChips = allRoles.filter((r) => this.#roleFilters.has(r.value));
    const availableRoles = allRoles.filter((r) => !this.#roleFilters.has(r.value));

    // ── Organization dropdown ─────────────────────────────────────────────
    const orgOptions = [
      { value: "", label: game.i18n.localize("DSENCOUNTER.Filter.AllOrganizations") },
      ...getOrganizationOptions(),
    ];

    return {
      // Inputs
      heroLevel: this.#heroLevel,
      numHeroes: this.#numHeroes,
      avgVictories: this.#avgVictories,
      difficulty: this.#difficulty,
      difficulties: DIFFICULTIES,

      // Computed
      partyES,
      budget,
      totalEV,
      currentDifficulty,
      levelRange,
      progressBar,

      // Browser
      monsters: filteredMonsters,
      searchText: this.#searchText,
      roleChips,
      availableRoles,
      orgFilter: this.#orgFilter,
      orgOptions,

      // Selected
      ungrouped: ungroupedAggregated,
      groups: groupedAggregated,
      hasSelections: this.#selectedMonsters.length > 0,
    };
  }

  /* -------------------------------------------------- */

  _onRender(_context, _options) {
    const html = this.element;

    // ── Input change listeners ────────────────────────────────────────────
    html.querySelector('[name="heroLevel"]')?.addEventListener("change", (e) => {
      this.#heroLevel = Math.clamped(Number(e.target.value) || 1, 1, 10);
      this.render({ force: false });
    });
    html.querySelector('[name="numHeroes"]')?.addEventListener("change", (e) => {
      this.#numHeroes = Math.clamped(Number(e.target.value) || 1, 1, 8);
      this.render({ force: false });
    });
    html.querySelector('[name="avgVictories"]')?.addEventListener("change", (e) => {
      this.#avgVictories = Math.clamped(Number(e.target.value) || 0, 0, 16);
      this.render({ force: false });
    });
    html.querySelector('[name="difficulty"]')?.addEventListener("change", (e) => {
      this.#difficulty = e.target.value;
      this.render({ force: false });
    });

    // ── Search input (debounced) ──────────────────────────────────────────
    const searchInput = html.querySelector('[name="monsterSearch"]');
    if (searchInput) {
      searchInput.value = this.#searchText;
      let debounce;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.#searchText = e.target.value;
          this.render({ force: false });
        }, 250);
      });
    }

    // ── Role filter input ─────────────────────────────────────────────────
    const roleInput = html.querySelector('[name="roleSearch"]');
    if (roleInput) {
      roleInput.addEventListener("change", (e) => {
        const value = e.target.value;
        if (value) {
          this.#roleFilters.add(value);
          e.target.value = "";
          this.render({ force: false });
        }
      });
    }

    // ── Organization dropdown ─────────────────────────────────────────────
    html.querySelector('[name="orgFilter"]')?.addEventListener("change", (e) => {
      this.#orgFilter = e.target.value;
      this.render({ force: false });
    });

    // ── Drag & Drop for selected monsters ─────────────────────────────────
    this.#setupDragDrop(html);
  }

  /* -------------------------------------------------- */
  /*  Drag and Drop                                     */
  /* -------------------------------------------------- */

  #setupDragDrop(html) {
    // Make selected monster rows draggable
    for (const row of html.querySelectorAll(".dsencounter-selected-row[draggable]")) {
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", row.dataset.selectionId);
        e.dataTransfer.effectAllowed = "move";
        row.classList.add("dsencounter-dragging");
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("dsencounter-dragging");
      });
    }

    // Make group containers and ungrouped zone drop targets
    for (const zone of html.querySelectorAll(".dsencounter-drop-zone")) {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        zone.classList.add("dsencounter-drag-over");
      });
      zone.addEventListener("dragleave", () => {
        zone.classList.remove("dsencounter-drag-over");
      });
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dsencounter-drag-over");
        const selectionId = Number(e.dataTransfer.getData("text/plain"));
        const targetGroupId = zone.dataset.groupId ? Number(zone.dataset.groupId) : null;
        this.#moveMonsterToGroup(selectionId, targetGroupId);
      });
    }
  }

  /* -------------------------------------------------- */
  /*  Helpers                                           */
  /* -------------------------------------------------- */

  #calcTotalEV() {
    let total = 0;
    // Build a map of uuid → count for minion EV handling
    const uuidCounts = new Map();
    for (const m of this.#selectedMonsters) {
      const key = m.uuid;
      uuidCounts.set(key, (uuidCounts.get(key) || 0) + 1);
    }
    // For non-minions, each instance adds EV
    // For minions, EV is per group-of-4 (they are added 4 at a time)
    const counted = new Set();
    for (const m of this.#selectedMonsters) {
      if (counted.has(m.uuid)) continue;
      counted.add(m.uuid);
      const count = uuidCounts.get(m.uuid);
      if (m.organization === "minion") {
        // EV is collective for 4 — each set of 4 costs m.ev
        total += Math.ceil(count / 4) * m.ev;
      } else {
        total += count * m.ev;
      }
    }
    return total;
  }

  #buildProgressBar(budget, totalEV) {
    // The bar represents 0 → budget.max + some overflow room
    // Zones: 0→min (orange), min→max (green), max+ (red overflow)
    const visualMax = Math.max(budget.max * 1.3, totalEV * 1.1, budget.max + 20);
    const isInfinite = !isFinite(budget.max);

    const minPct = isInfinite ? 0 : (budget.min / visualMax) * 100;
    const maxPct = isInfinite ? 100 : (budget.max / visualMax) * 100;
    const currentPct = Math.min((totalEV / visualMax) * 100, 100);

    let zone = "under";
    if (totalEV >= budget.min && totalEV <= budget.max) zone = "good";
    else if (totalEV > budget.max && isFinite(budget.max)) zone = "over";

    return { minPct, maxPct, currentPct, zone, visualMax, isInfinite };
  }

  #moveMonsterToGroup(selectionId, targetGroupId) {
    const monster = this.#selectedMonsters.find((m) => m.id === selectionId);
    if (!monster) return;
    monster.groupId = targetGroupId;
    // If moving out of a group, clear captain status
    if (!targetGroupId) monster.isSquadCaptain = false;
    this.render({ force: false });
  }

  /* -------------------------------------------------- */
  /*  Action Handlers                                   */
  /* -------------------------------------------------- */

  static #onAddMonster(event, target) {
    const uuid = target.dataset.uuid;
    const entry = this.#monsterIndex.find((m) => m.uuid === uuid);
    if (!entry) return;

    const isMinion = entry.organization === "minion";
    const count = isMinion ? 4 : 1;

    for (let i = 0; i < count; i++) {
      this.#selectedMonsters.push({
        id: this.#nextSelectionId++,
        uuid: entry.uuid,
        name: entry.name,
        img: entry.img,
        level: entry.level,
        ev: entry.ev,
        role: entry.role,
        roleLabel: entry.roleLabel,
        organization: entry.organization,
        orgLabel: entry.orgLabel,
        groupId: null,
        isSquadCaptain: false,
      });
    }
    this.render({ force: false });
  }

  static #onRemoveMonster(_event, target) {
    const uuid = target.dataset.uuid;
    const groupId = target.closest("[data-group-id]")?.dataset.groupId;
    const targetGroupId = groupId ? Number(groupId) : null;

    // Find all instances of this UUID in the same group context
    const isMinion = this.#selectedMonsters.find((m) => m.uuid === uuid)?.organization === "minion";
    const removeCount = isMinion ? 4 : 1;

    let removed = 0;
    this.#selectedMonsters = this.#selectedMonsters.filter((m) => {
      if (removed >= removeCount) return true;
      if (m.uuid === uuid && m.groupId === targetGroupId) {
        removed++;
        return false;
      }
      return true;
    });
    this.render({ force: false });
  }

  static #onIncrementMonster(_event, target) {
    const uuid = target.dataset.uuid;
    const entry = this.#monsterIndex.find((m) => m.uuid === uuid);
    if (!entry) return;

    const groupIdAttr = target.closest("[data-group-id]")?.dataset.groupId;
    const groupId = groupIdAttr ? Number(groupIdAttr) : null;
    const isMinion = entry.organization === "minion";
    const count = isMinion ? 4 : 1;

    for (let i = 0; i < count; i++) {
      this.#selectedMonsters.push({
        id: this.#nextSelectionId++,
        uuid: entry.uuid,
        name: entry.name,
        img: entry.img,
        level: entry.level,
        ev: entry.ev,
        role: entry.role,
        roleLabel: entry.roleLabel,
        organization: entry.organization,
        orgLabel: entry.orgLabel,
        groupId,
        isSquadCaptain: false,
      });
    }
    this.render({ force: false });
  }

  static #onDecrementMonster(_event, target) {
    const uuid = target.dataset.uuid;
    const groupIdAttr = target.closest("[data-group-id]")?.dataset.groupId;
    const targetGroupId = groupIdAttr ? Number(groupIdAttr) : null;

    const isMinion = this.#selectedMonsters.find((m) => m.uuid === uuid)?.organization === "minion";
    const removeCount = isMinion ? 4 : 1;

    // Only decrement if more than the minimum remain in that group context
    const inContext = this.#selectedMonsters.filter(
      (m) => m.uuid === uuid && m.groupId === targetGroupId
    );
    if (inContext.length <= removeCount) return; // Can't go below 1 set — use remove instead

    let removed = 0;
    this.#selectedMonsters = this.#selectedMonsters.filter((m) => {
      if (removed >= removeCount) return true;
      if (m.uuid === uuid && m.groupId === targetGroupId) {
        removed++;
        return false;
      }
      return true;
    });
    this.render({ force: false });
  }

  static #onCreateGroup() {
    this.#groups.push({ id: this.#nextGroupNum, name: `${game.i18n.localize("DSENCOUNTER.Group")} ${this.#nextGroupNum}` });
    this.#nextGroupNum++;
    this.render({ force: false });
  }

  static #onDeleteGroup(_event, target) {
    const groupId = Number(target.dataset.groupId);
    // Remove monsters in this group
    this.#selectedMonsters = this.#selectedMonsters.filter((m) => m.groupId !== groupId);
    // Remove the group
    this.#groups = this.#groups.filter((g) => g.id !== groupId);
    // Renumber group names
    this.#groups.forEach((g, i) => {
      g.name = `${game.i18n.localize("DSENCOUNTER.Group")} ${i + 1}`;
    });
    this.render({ force: false });
  }

  static #onToggleCaptain(_event, target) {
    const selectionId = Number(target.dataset.selectionId);
    const monster = this.#selectedMonsters.find((m) => m.id === selectionId);
    if (!monster || !monster.groupId) return;

    // Validate: non-mount, non-minion
    if (monster.organization === "minion" || monster.role === "mount") return;

    if (monster.isSquadCaptain) {
      monster.isSquadCaptain = false;
    } else {
      // Only one captain per group — clear any existing
      for (const m of this.#selectedMonsters) {
        if (m.groupId === monster.groupId) m.isSquadCaptain = false;
      }
      monster.isSquadCaptain = true;
    }
    this.render({ force: false });
  }

  static #onRemoveRoleFilter(_event, target) {
    this.#roleFilters.delete(target.dataset.role);
    this.render({ force: false });
  }

  static async #onRefreshIndex() {
    this.#indexLoaded = false;
    this.#monsterIndex = await loadMonsterIndex();
    this.#indexLoaded = true;
    this.render({ force: false });
  }

  static async #onSaveToJournal() {
    if (this.#selectedMonsters.length === 0) return;
    await createEncounterJournal({
      heroLevel: this.#heroLevel,
      numHeroes: this.#numHeroes,
      avgVictories: this.#avgVictories,
      difficulty: this.#difficulty,
      selectedMonsters: this.#selectedMonsters,
      groups: this.#groups,
    });
  }
}
