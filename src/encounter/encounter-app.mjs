/**
 * Encounter Builder – main ApplicationV2 singleton.
 * Provides the GM-facing UI for building balanced encounters.
 */

import { MODULE_ID } from "../config.mjs";
import {
  calcPartyES, calcBudgetRange, calcHeroES,
  getDifficulty, getRecommendedLevelRange, DIFFICULTIES,
} from "./encounter-calc.mjs";
import { loadMonsterIndex, getCachedMonsterIndex, filterMonsters, getRoleOptions, getOrganizationOptions, getSourceOptions, getKeywordOptions, DEFAULT_SOURCE_IDS } from "./monster-browser.mjs";
import { createEncounterJournal } from "./encounter-journal.mjs";
import { deployEncounter } from "./encounter-deploy.mjs";
import { HomebrewApp } from "../homebrew/homebrew-app.mjs";

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

  static refreshOpenInstance() {
    if (!this._instance?.rendered) return;
    this._instance.#indexLoaded = false;
    this._instance.#displayLimit = 30;
    this._instance.render({ force: true, parts: ["browser"] });
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
      incrementHeroes: EncounterBuilderApp.#onIncrementHeroes,
      decrementHeroes: EncounterBuilderApp.#onDecrementHeroes,
      incrementVictories: EncounterBuilderApp.#onIncrementVictories,
      decrementVictories: EncounterBuilderApp.#onDecrementVictories,
      addMonster: EncounterBuilderApp.#onAddMonster,
      removeMonster: EncounterBuilderApp.#onRemoveMonster,
      incrementMonster: EncounterBuilderApp.#onIncrementMonster,
      decrementMonster: EncounterBuilderApp.#onDecrementMonster,
      createGroup: EncounterBuilderApp.#onCreateGroup,
      deleteGroup: EncounterBuilderApp.#onDeleteGroup,
      toggleCaptain: EncounterBuilderApp.#onToggleCaptain,
      saveToJournal: EncounterBuilderApp.#onSaveToJournal,
      deployToScene: EncounterBuilderApp.#onDeployToScene,
      removeRoleFilter: EncounterBuilderApp.#onRemoveRoleFilter,
      removeKeywordFilter: EncounterBuilderApp.#onRemoveKeywordFilter,
      removeSourceFilter: EncounterBuilderApp.#onRemoveSourceFilter,
      refreshIndex: EncounterBuilderApp.#onRefreshIndex,
      clearSearch: EncounterBuilderApp.#onClearSearch,
      previewMonster: EncounterBuilderApp.#onPreviewMonster,
      openHomebrew: EncounterBuilderApp.onOpenHomebrew,
    },
  };

  /* -------------------------------------------------- */

  static PARTS = {
    topBar: {
      template: `modules/${MODULE_ID}/templates/parts/encounter-topbar.hbs`,
    },
    browser: {
      template: `modules/${MODULE_ID}/templates/parts/encounter-browser.hbs`,
      scrollable: [".dsencounter-browser-list"],
    },
    selected: {
      template: `modules/${MODULE_ID}/templates/parts/encounter-selected.hbs`,
      scrollable: [".dsencounter-selected-list"],
    },
    actionBar: {
      template: `modules/${MODULE_ID}/templates/parts/encounter-actionbar.hbs`,
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

  constructor(...args) {
    super(...args);
    this.#heroLevel = game.settings.get(MODULE_ID, "heroLevel") ?? 1;
    this.#numHeroes = game.settings.get(MODULE_ID, "numHeroes") ?? 5;
  }

  /** Filters for the monster browser. */
  #searchText = "";
  #roleFilters = new Set();
  #keywordFilters = new Set();
  #orgFilter = "";
  #sourceFilters = new Set();
  #sourceFiltersInitialized = false;
  #levelFilter = -1;
  #sortOrder = "ev"; // "ev" (default) or "name"

  /** How many monsters to show in the browser at once. Grows via scroll. */
  #displayLimit = 30;

  /** Cached filtered+sorted monster list for scroll append. */
  #lastFilteredMonsters = [];
  #cachedLevelRange = null;

  /** Cached option arrays (rebuilt only when index changes). */
  #cachedRoleOptions = null;
  #cachedKeywordOptions = null;
  #cachedOrgOptions = null;
  #cachedSourceOptions = null;

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

  /** Debounce timer for rendering. */
  #renderDebounce = null;

  /** Queue a debounced render. Pass a parts array for selective re-rendering. */
  #debouncedRender(delay = 80, parts) {
    clearTimeout(this.#renderDebounce);
    this.#renderDebounce = setTimeout(() => this.render({ parts }), delay);
  }

  /* -------------------------------------------------- */
  /*  Lifecycle                                         */
  /* -------------------------------------------------- */

  async _prepareContext(_options) {
    // Lazy-load monster index (uses shared cache)
    if (!this.#indexLoaded) {
      this.#monsterIndex = await getCachedMonsterIndex();
      this.#indexLoaded = true;
      // Build option caches once when index loads
      this.#cachedRoleOptions = getRoleOptions();
      this.#cachedKeywordOptions = getKeywordOptions();
      this.#cachedOrgOptions = getOrganizationOptions();
      this.#cachedSourceOptions = getSourceOptions(this.#monsterIndex);
    }

    // Initialize source filters (once, when sources become available)
    if (!this.#sourceFiltersInitialized) {
      const allSources = this.#cachedSourceOptions ?? [];
      if (allSources.length > 0) {
        this.#sourceFiltersInitialized = true;
        const validSourceIds = new Set(allSources.map((s) => s.value));
        const stored = game.settings.get(MODULE_ID, "sourceFilters");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            for (const id of parsed) {
              if (validSourceIds.has(id)) this.#sourceFilters.add(id);
            }
          } catch { /* ignore corrupt data */ }
        }
        if (this.#sourceFilters.size === 0) {
          for (const s of allSources) {
            if (s.isDefault) this.#sourceFilters.add(s.value);
          }
        }
      }
    }

    // ── Shared encounter math (cheap arithmetic) ──────────────────────────
    const partyES = calcPartyES(this.#heroLevel, this.#numHeroes, this.#avgVictories);
    const budget = calcBudgetRange(partyES, this.#heroLevel, this.#difficulty);
    const totalEV = this.#calcTotalEV();
    const levelRange = getRecommendedLevelRange(this.#heroLevel, this.#avgVictories);
    this.#cachedLevelRange = levelRange;

    return {
      heroLevel: this.#heroLevel,
      numHeroes: this.#numHeroes,
      avgVictories: this.#avgVictories,
      difficulty: this.#difficulty,
      difficulties: DIFFICULTIES,
      levelOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      partyES,
      budget,
      totalEV,
      levelRange,
      hasSelections: this.#selectedMonsters.length > 0,
    };
  }

  /* -------------------------------------------------- */

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);

    switch (partId) {
      case "browser":
        return this.#prepareBrowserContext(context);
      case "selected":
        return this.#prepareSelectedContext(context);
      default:
        return context;
    }
  }

  /* -------------------------------------------------- */

  #prepareBrowserContext(context) {
    const levelRange = this.#cachedLevelRange;

    // ── Filter + sort ─────────────────────────────────────────────────────
    const filteredMonsters = filterMonsters(this.#monsterIndex, {
      search: this.#searchText,
      roles: this.#roleFilters,
      organization: this.#orgFilter,
      sources: this.#sourceFilters,
      keywords: this.#keywordFilters,
      level: this.#levelFilter,
      levelRange,
    });

    if (this.#sortOrder === "name") {
      filteredMonsters.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filteredMonsters.sort((a, b) => a.ev - b.ev || a.name.localeCompare(b.name));
    }

    this.#lastFilteredMonsters = filteredMonsters;

    // ── Limit + annotate ──────────────────────────────────────────────────
    const totalMatches = filteredMonsters.length;
    const displayedMonsters = filteredMonsters.slice(0, this.#displayLimit);
    for (const m of displayedMonsters) {
      const maxLvl = m.organization === "solo" ? levelRange.soloMax : levelRange.max;
      m.levelWarning = m.level > maxLvl ? "danger" : "";
    }

    // ── Filter UI state ───────────────────────────────────────────────────
    const allRoles = this.#cachedRoleOptions ?? getRoleOptions();
    const allSources = this.#cachedSourceOptions ?? getSourceOptions(this.#monsterIndex);

    context.monsters = displayedMonsters;
    context.totalMatches = totalMatches;
    context.displayLimit = this.#displayLimit;
    context.isCapped = totalMatches > this.#displayLimit;
    context.searchText = this.#searchText;
    context.roleChips = allRoles.filter((r) => this.#roleFilters.has(r.value));
    context.availableRoles = allRoles.filter((r) => !this.#roleFilters.has(r.value));

    const allKeywords = this.#cachedKeywordOptions ?? getKeywordOptions();
    context.keywordChips = allKeywords.filter((k) => this.#keywordFilters.has(k.value));
    context.availableKeywords = allKeywords.filter((k) => !this.#keywordFilters.has(k.value));

    context.orgFilter = this.#orgFilter;
    context.orgOptions = [
      { value: "", label: game.i18n.localize("DSENCOUNTER.Filter.AllOrganizations") },
      ...(this.#cachedOrgOptions ?? getOrganizationOptions()),
    ];
    context.sourceChips = allSources.filter((s) => this.#sourceFilters.has(s.value));
    context.availableSources = allSources.filter((s) => !this.#sourceFilters.has(s.value));
    context.levelFilter = this.#levelFilter;
    context.levelFilterOptions = [
      { value: 0, label: game.i18n.localize("DSENCOUNTER.Filter.AllLevels") },
      { value: -1, label: game.i18n.localize("DSENCOUNTER.Filter.SuggestedLevels") },
      ...Array.from({ length: 11 }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    ];
    context.sortOrder = this.#sortOrder;
    context.sortOptions = [
      { value: "ev", label: game.i18n.localize("DSENCOUNTER.Filter.SortByEV") },
      { value: "name", label: game.i18n.localize("DSENCOUNTER.Filter.SortByName") },
    ];

    return context;
  }

  /* -------------------------------------------------- */

  #prepareSelectedContext(context) {
    const { budget, totalEV } = context;
    context.currentDifficulty = getDifficulty(totalEV, context.partyES, this.#heroLevel);
    context.progressBar = this.#buildProgressBar(budget, totalEV);

    // ── Aggregate selected monsters ───────────────────────────────────────
    const ungrouped = this.#selectedMonsters.filter((m) => !m.groupId);
    const groupedData = this.#groups.map((g) => ({
      ...g,
      monsters: this.#selectedMonsters.filter((m) => m.groupId === g.id),
    }));

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

    context.ungrouped = aggregateList(ungrouped);
    context.groups = groupedData.map((g) => ({
      ...g,
      monsters: aggregateList(g.monsters),
    }));

    return context;
  }

  /* -------------------------------------------------- */

  _onRender(_context, options) {
    const html = this.element;
    const parts = options.parts;

    if (parts.includes("topBar")) this.#setupTopBarListeners(html);
    if (parts.includes("browser")) this.#setupBrowserListeners(html);
    if (parts.includes("selected")) this.#setupSelectedListeners(html);
  }

  /* -------------------------------------------------- */
  /*  Per-part listener setup                           */
  /* -------------------------------------------------- */

  #setupTopBarListeners(html) {
    html.querySelector('[name="heroLevel"]')?.addEventListener("change", (e) => {
      this.#heroLevel = Number(e.target.value) || 1;
      game.settings.set(MODULE_ID, "heroLevel", this.#heroLevel);
      this.#debouncedRender(80, ["topBar", "browser", "selected"]);
    });
    html.querySelector('[name="difficulty"]')?.addEventListener("change", (e) => {
      this.#difficulty = e.target.value;
      this.#debouncedRender(80, ["topBar", "selected"]);
    });
  }

  #setupBrowserListeners(html) {
    // Search input (debounced)
    const searchInput = html.querySelector('[name="monsterSearch"]');
    if (searchInput) {
      searchInput.value = this.#searchText;
      let debounce;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.#searchText = e.target.value;
          this.#displayLimit = 30;
          this.#debouncedRender(80, ["browser"]);
        }, 250);
      });
    }

    // Role filter input
    const roleInput = html.querySelector('[name="roleSearch"]');
    if (roleInput) {
      roleInput.addEventListener("change", (e) => {
        const value = e.target.value;
        if (value) {
          this.#roleFilters.add(value);
          e.target.value = "";
          this.#displayLimit = 30;
          this.#debouncedRender(80, ["browser"]);
        }
      });
    }

    // Keyword filter input
    const keywordInput = html.querySelector('[name="keywordSearch"]');
    if (keywordInput) {
      keywordInput.addEventListener("change", (e) => {
        const value = e.target.value;
        if (value) {
          this.#keywordFilters.add(value);
          e.target.value = "";
          this.#displayLimit = 30;
          this.#debouncedRender(80, ["browser"]);
        }
      });
    }

    // Organization dropdown
    html.querySelector('[name="orgFilter"]')?.addEventListener("change", (e) => {
      this.#orgFilter = e.target.value;
      this.#displayLimit = 30;
      this.#debouncedRender(80, ["browser"]);
    });

    // Source filter input
    const sourceInput = html.querySelector('[name="sourceSearch"]');
    if (sourceInput) {
      sourceInput.addEventListener("change", (e) => {
        const value = e.target.value;
        if (value) {
          this.#sourceFilters.add(value);
          game.settings.set(MODULE_ID, "sourceFilters", JSON.stringify([...this.#sourceFilters]));
          e.target.value = "";
          this.#displayLimit = 30;
          this.#debouncedRender(80, ["browser"]);
        }
      });
    }

    // Level filter dropdown
    html.querySelector('[name="levelFilter"]')?.addEventListener("change", (e) => {
      this.#levelFilter = Number(e.target.value) || 0;
      this.#displayLimit = 30;
      this.#debouncedRender(80, ["browser"]);
    });

    // Sort dropdown
    html.querySelector('[name="sortOrder"]')?.addEventListener("change", (e) => {
      this.#sortOrder = e.target.value;
      this.#displayLimit = 30;
      this.#debouncedRender(80, ["browser"]);
    });

    // Infinite scroll on browser list
    const browserList = html.querySelector(".dsencounter-browser-list");
    if (browserList) {
      let scrollCooldown = false;
      browserList.addEventListener("scroll", () => {
        if (scrollCooldown) return;
        const { scrollTop, scrollHeight, clientHeight } = browserList;
        if (scrollTop + clientHeight >= scrollHeight - 60) {
          if (this.#displayLimit < this.#lastFilteredMonsters.length) {
            scrollCooldown = true;
            const oldLimit = this.#displayLimit;
            this.#displayLimit = Math.min(oldLimit + 30, this.#lastFilteredMonsters.length);
            const newMonsters = this.#lastFilteredMonsters.slice(oldLimit, this.#displayLimit);
            this.#appendBrowserRows(browserList, newMonsters);
            setTimeout(() => { scrollCooldown = false; }, 300);
          }
        }
      }, { passive: true });

      // Browser row drag (event delegation)
      browserList.addEventListener("dragstart", (e) => {
        const row = e.target.closest(".dsencounter-monster-row");
        if (!row) return;
        const uuid = row.dataset.uuid;
        e.dataTransfer.setData("application/x-dsencounter-browser", uuid);
        e.dataTransfer.setData("text/plain", JSON.stringify({ type: "Actor", uuid, dsencounter: true }));
        e.dataTransfer.effectAllowed = "copyMove";
      });
    }
  }

  #setupSelectedListeners(html) {
    // Make selected monster rows draggable
    for (const row of html.querySelectorAll(".dsencounter-selected-row[draggable]")) {
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("application/x-dsencounter-selection", row.dataset.selectionId);
        const uuid = row.dataset.uuid;
        if (uuid) {
          e.dataTransfer.setData("text/plain", JSON.stringify({ type: "Actor", uuid, dsencounter: true }));
        }
        e.dataTransfer.effectAllowed = "copyMove";
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
        const selectionData = e.dataTransfer.getData("application/x-dsencounter-selection");
        if (selectionData) {
          const selectionId = Number(selectionData);
          const targetGroupId = zone.dataset.groupId ? Number(zone.dataset.groupId) : null;
          this.#moveMonsterToGroup(selectionId, targetGroupId);
          return;
        }
        const browserUuid = e.dataTransfer.getData("application/x-dsencounter-browser");
        if (browserUuid) {
          const targetGroupId = zone.dataset.groupId ? Number(zone.dataset.groupId) : null;
          this.#addMonsterToGroup(browserUuid, targetGroupId);
          return;
        }
      });
    }

    // Allow dropping on the selected-list container itself (empty space → ungrouped)
    const selectedList = html.querySelector(".dsencounter-selected-list");
    if (selectedList) {
      selectedList.addEventListener("dragover", (e) => {
        if (e.target.closest(".dsencounter-drop-zone")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      selectedList.addEventListener("drop", (e) => {
        if (e.target.closest(".dsencounter-drop-zone")) return;
        e.preventDefault();
        const selectionData = e.dataTransfer.getData("application/x-dsencounter-selection");
        if (selectionData) {
          this.#moveMonsterToGroup(Number(selectionData), null);
          return;
        }
        const browserUuid = e.dataTransfer.getData("application/x-dsencounter-browser");
        if (browserUuid) {
          this.#addMonsterToGroup(browserUuid, null);
          return;
        }
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
    const currentPct = totalEV === 0 ? 0 : Math.min((totalEV / visualMax) * 100, 100);

    let zone = "under";
    if (totalEV >= budget.min && totalEV <= budget.max) zone = "good";
    else if (totalEV > budget.max && isFinite(budget.max)) zone = "over";

    return { minPct, maxPct, currentPct, zone, visualMax, isInfinite };
  }

  #moveMonsterToGroup(selectionId, targetGroupId) {
    const monster = this.#selectedMonsters.find((m) => m.id === selectionId);
    if (!monster) return;

    // For minions, move a set of 4 from the same UUID and source group
    if (monster.organization === "minion") {
      const sourceGroupId = monster.groupId;
      if (sourceGroupId === targetGroupId) return; // same group, nothing to do
      const batch = this.#selectedMonsters.filter(
        (m) => m.uuid === monster.uuid && m.groupId === sourceGroupId
      );
      const toMove = batch.slice(0, 4);
      for (const m of toMove) {
        m.groupId = targetGroupId;
        if (!targetGroupId) m.isSquadCaptain = false;
      }
    } else {
      monster.groupId = targetGroupId;
      // If moving out of a group, clear captain status
      if (!targetGroupId) monster.isSquadCaptain = false;
    }
    this.#debouncedRender(80, ["selected"]);
  }

  /**
   * Add a monster (by UUID) to the selection, optionally into a specific group.
   * @param {string} uuid
   * @param {number|null} groupId
   */
  #addMonsterToGroup(uuid, groupId) {
    const entry = this.#monsterIndex.find((m) => m.uuid === uuid);
    if (!entry) return;
    const isMinion = entry.organization === "minion";
    const count = isMinion ? 4 : 1;
    for (let i = 0; i < count; i++) {
      this.#selectedMonsters.push({
        id: this.#nextSelectionId++,
        uuid: entry.uuid, name: entry.name, img: entry.img,
        level: entry.level, ev: entry.ev,
        role: entry.role, roleLabel: entry.roleLabel,
        organization: entry.organization, orgLabel: entry.orgLabel,
        groupId,
        isSquadCaptain: false,
      });
    }
    this.#debouncedRender(80, ["selected", "actionBar"]);
  }

  /**
   * Append monster rows directly to the browser list DOM for scroll pagination.
   * Avoids a full re-render — only creates and inserts new elements.
   */
  #appendBrowserRows(container, monsters) {
    const sentinel = container.querySelector(".dsencounter-scroll-sentinel");
    const levelRange = this.#cachedLevelRange;
    const previewTooltip = game.i18n.localize("DSENCOUNTER.Action.Preview");
    const fragment = document.createDocumentFragment();

    for (const m of monsters) {
      const maxLvl = m.organization === "solo" ? levelRange.soloMax : levelRange.max;
      const warning = m.level > maxLvl ? "danger" : "";

      const row = document.createElement("div");
      row.className = `dsencounter-monster-row${warning ? ` dsencounter-level-${warning}` : ""}`;
      row.setAttribute("data-action", "addMonster");
      row.dataset.uuid = m.uuid;
      row.draggable = true;

      const left = document.createElement("div");
      left.className = "dsencounter-monster-left";

      const imgWrap = document.createElement("div");
      imgWrap.className = "dsencounter-monster-img-wrapper";
      imgWrap.dataset.uuid = m.uuid;
      const img = document.createElement("img");
      img.className = "dsencounter-monster-img";
      img.src = m.img;
      img.alt = "";
      img.loading = "lazy";
      imgWrap.appendChild(img);
      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className = "dsencounter-preview-btn";
      previewBtn.setAttribute("data-action", "previewMonster");
      previewBtn.dataset.uuid = m.uuid;
      previewBtn.dataset.tooltip = previewTooltip;
      previewBtn.innerHTML = '<i class="fa-solid fa-book-open"></i>';
      imgWrap.appendChild(previewBtn);
      left.appendChild(imgWrap);

      const nameSpan = document.createElement("span");
      nameSpan.className = "dsencounter-monster-name";
      nameSpan.textContent = m.name;
      if (m.roleLabel || m.orgLabel) {
        nameSpan.textContent += " ";
        const roleSpan = document.createElement("span");
        roleSpan.className = "dsencounter-monster-role";
        const labelText = m.orgLabel && m.roleLabel ? `${m.orgLabel} / ${m.roleLabel}` : (m.roleLabel || m.orgLabel);
        roleSpan.textContent = `(${labelText})`;
        nameSpan.appendChild(roleSpan);
      }
      left.appendChild(nameSpan);

      const right = document.createElement("div");
      right.className = "dsencounter-monster-right";
      if (warning) {
        const skull = document.createElement("span");
        skull.className = "dsencounter-danger-icon";
        skull.textContent = "☠️";
        right.appendChild(skull);
      }
      const lvlSpan = document.createElement("span");
      lvlSpan.className = "dsencounter-monster-level";
      lvlSpan.textContent = m.level;
      right.appendChild(lvlSpan);
      const evSpan = document.createElement("span");
      evSpan.className = "dsencounter-monster-ev";
      evSpan.textContent = `(EV ${m.ev})`;
      right.appendChild(evSpan);

      row.appendChild(left);
      row.appendChild(right);
      fragment.appendChild(row);
    }

    if (sentinel) container.insertBefore(fragment, sentinel);
    else container.appendChild(fragment);

    // Update or remove the sentinel
    if (this.#displayLimit >= this.#lastFilteredMonsters.length) {
      sentinel?.remove();
    } else if (sentinel) {
      const msg = sentinel.querySelector(".dsencounter-capped-msg");
      if (msg) {
        msg.textContent = game.i18n.format("DSENCOUNTER.Browser.ShowingResults", {
          limit: this.#displayLimit,
          total: this.#lastFilteredMonsters.length,
        });
      }
    }
  }

  /* -------------------------------------------------- */
  /*  Action Handlers                                   */
  /* -------------------------------------------------- */

  static #onIncrementHeroes() {
    this.#numHeroes += 1;
    game.settings.set(MODULE_ID, "numHeroes", this.#numHeroes);
    this.#debouncedRender(80, ["topBar", "selected"]);
  }

  static #onDecrementHeroes() {
    this.#numHeroes = Math.max(this.#numHeroes - 1, 1);
    game.settings.set(MODULE_ID, "numHeroes", this.#numHeroes);
    this.#debouncedRender(80, ["topBar", "selected"]);
  }

  static #onIncrementVictories() {
    this.#avgVictories = Math.min(this.#avgVictories + 2, 16);
    this.#debouncedRender(80, ["topBar", "browser", "selected"]);
  }

  static #onDecrementVictories() {
    this.#avgVictories = Math.max(this.#avgVictories - 2, 0);
    this.#debouncedRender(80, ["topBar", "browser", "selected"]);
  }

  static #onAddMonster(event, target) {
    const uuid = target.dataset.uuid;
    this.#addMonsterToGroup(uuid, null);
  }

  static #onRemoveMonster(_event, target) {
    const uuid = target.dataset.uuid;
    const groupId = target.closest("[data-group-id]")?.dataset.groupId;
    const targetGroupId = groupId ? Number(groupId) : null;

    // Remove ALL instances of this UUID in the same group context
    this.#selectedMonsters = this.#selectedMonsters.filter((m) => {
      return !(m.uuid === uuid && m.groupId === targetGroupId);
    });
    this.#debouncedRender(80, ["selected", "actionBar"]);
  }

  static #onIncrementMonster(_event, target) {
    const uuid = target.dataset.uuid;
    const groupIdAttr = target.closest("[data-group-id]")?.dataset.groupId;
    const groupId = groupIdAttr ? Number(groupIdAttr) : null;
    this.#addMonsterToGroup(uuid, groupId);
  }

  static #onDecrementMonster(_event, target) {
    const uuid = target.dataset.uuid;
    const groupIdAttr = target.closest("[data-group-id]")?.dataset.groupId;
    const targetGroupId = groupIdAttr ? Number(groupIdAttr) : null;

    const isMinion = this.#selectedMonsters.find((m) => m.uuid === uuid)?.organization === "minion";
    const removeCount = isMinion ? 4 : 1;

    const inContext = this.#selectedMonsters.filter(
      (m) => m.uuid === uuid && m.groupId === targetGroupId
    );

    // If at or below one set, remove all (same as trash)
    if (inContext.length <= removeCount) {
      this.#selectedMonsters = this.#selectedMonsters.filter(
        (m) => !(m.uuid === uuid && m.groupId === targetGroupId)
      );
    } else {
      let removed = 0;
      this.#selectedMonsters = this.#selectedMonsters.filter((m) => {
        if (removed >= removeCount) return true;
        if (m.uuid === uuid && m.groupId === targetGroupId) {
          removed++;
          return false;
        }
        return true;
      });
    }
    this.#debouncedRender(80, ["selected", "actionBar"]);
  }

  static #onCreateGroup() {
    const displayNum = this.#groups.length + 1;
    this.#groups.push({ id: this.#nextGroupNum, name: `${game.i18n.localize("DSENCOUNTER.Group")} ${displayNum}` });
    this.#nextGroupNum++;
    this.#debouncedRender(80, ["selected"]);
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
    this.#debouncedRender(80, ["selected", "actionBar"]);
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
    this.#debouncedRender(80, ["selected"]);
  }

  static #onRemoveRoleFilter(_event, target) {
    this.#roleFilters.delete(target.dataset.role);
    this.#displayLimit = 30;
    this.#debouncedRender(80, ["browser"]);
  }

  static #onRemoveKeywordFilter(_event, target) {
    this.#keywordFilters.delete(target.dataset.keyword);
    this.#displayLimit = 30;
    this.#debouncedRender(80, ["browser"]);
  }

  static #onRemoveSourceFilter(_event, target) {
    this.#sourceFilters.delete(target.dataset.source);
    game.settings.set(MODULE_ID, "sourceFilters", JSON.stringify([...this.#sourceFilters]));
    this.#displayLimit = 30;
    this.#debouncedRender(80, ["browser"]);
  }

  static async #onRefreshIndex() {
    this.#indexLoaded = false;
    this.#monsterIndex = await getCachedMonsterIndex(true);
    this.#indexLoaded = true;
    // Rebuild option caches after index refresh
    this.#cachedRoleOptions = getRoleOptions();
    this.#cachedKeywordOptions = getKeywordOptions();
    this.#cachedOrgOptions = getOrganizationOptions();
    this.#cachedSourceOptions = getSourceOptions(this.#monsterIndex);
    this.#displayLimit = 30;
    this.#debouncedRender(80, ["browser"]);
  }

  static #onClearSearch() {
    this.#searchText = "";
    this.#displayLimit = 30;
    this.#debouncedRender(80, ["browser"]);
  }

  static async #onPreviewMonster(event, target) {
    event.stopPropagation(); // Don't trigger addMonster on the parent row
    const uuid = target.dataset.uuid;
    const doc = await fromUuid(uuid);
    if (doc) doc.sheet.render(true);
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

  static async #onDeployToScene() {
    if (this.#selectedMonsters.length === 0) return;
    this.minimize();
    try {
      const combat = await deployEncounter({
        selectedMonsters: this.#selectedMonsters,
        groups: this.#groups,
      });
      if (combat) await combat.activate();
    } finally {
      this.maximize();
    }
  }

  static onOpenHomebrew() {
    HomebrewApp.toggle();
  }
}
