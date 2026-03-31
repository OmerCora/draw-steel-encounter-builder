/**
 * Deploy encounter to the active scene — place tokens in organized grid,
 * create a Combat encounter, assign groups, and set squad captains.
 */

import { MODULE_ID } from "../config.mjs";

/**
 * Deploy all selected monsters to the scene at a user-chosen origin point.
 * Places tokens in organized group grids, creates a Combat, and configures
 * Draw Steel combatant groups with squad captains.
 *
 * @param {Object} data
 * @param {Array} data.selectedMonsters  Array of { id, uuid, name, img, level, ev, role, roleLabel, organization, orgLabel, groupId, isSquadCaptain }
 * @param {Array} data.groups            Array of { id, name }
 */
export async function deployEncounter(data) {
  const { selectedMonsters, groups } = data;
  if (selectedMonsters.length === 0) return;

  // Verify there's an active scene with a canvas
  if (!canvas.scene) {
    ui.notifications.warn(game.i18n.localize("DSENCOUNTER.Deploy.NoScene"));
    return;
  }

  // ── Prompt user to pick a point on the scene ──────────────────────────
  const origin = await pickScenePoint();
  if (!origin) return; // user cancelled

  // ── Resolve compendium actors to world actors ─────────────────────────
  const resolvedActors = await resolveActors(selectedMonsters);

  // ── Build group buckets (ungrouped = virtual group) ───────────────────
  const groupBuckets = buildGroupBuckets(selectedMonsters, groups);

  // ── Calculate placement grid ──────────────────────────────────────────
  const gs = canvas.grid.size;
  const placements = calculatePlacements(groupBuckets, origin, gs);

  // ── Create tokens on the scene ────────────────────────────────────────
  const tokenDataList = [];
  const placementMeta = []; // parallel array tracking monsterId + groupBucketIndex per token
  for (const placement of placements) {
    const actor = resolvedActors.get(placement.monster.uuid);
    if (!actor) continue;
    const td = await actor.getTokenDocument({ x: placement.x, y: placement.y });
    tokenDataList.push(td.toObject());
    placementMeta.push({
      monsterId: placement.monster.id,
      groupBucketIndex: placement.groupBucketIndex,
    });
  }

  const createdTokens = await canvas.scene.createEmbeddedDocuments("Token", tokenDataList);

  // ── Create Combat encounter ───────────────────────────────────────────
  const combat = await createCombatEncounter(createdTokens, placementMeta, tokenDataList, groupBuckets, selectedMonsters);

  ui.notifications.info(game.i18n.localize("DSENCOUNTER.Deploy.Success"));
  return combat;
}

/* ══════════════════════════════════════════════════════════════════════════
   SCENE POINT PICKER
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Let the user click a point on the canvas. Returns {x, y} or null if cancelled.
 * Uses a capture-phase DOM listener to intercept before Foundry/Pixi process the click.
 */
function pickScenePoint() {
  return new Promise((resolve) => {
    ui.notifications.info(game.i18n.localize("DSENCOUNTER.Deploy.PickPoint"));

    const canvasEl = canvas.app.view;
    const prevCursor = canvasEl.style.cursor;
    canvasEl.style.cursor = "crosshair";

    function onMouseDown(event) {
      if (event.button === 2) {
        // Right-click: cancel
        event.preventDefault();
        event.stopImmediatePropagation();
        cleanup();
        resolve(null);
        return;
      }
      if (event.button !== 0) return; // Ignore middle-click etc.

      event.preventDefault();
      event.stopImmediatePropagation();
      cleanup();

      // Convert DOM coordinates to canvas world coordinates
      const rect = canvasEl.getBoundingClientRect();
      const scaleX = canvasEl.width / rect.width;
      const scaleY = canvasEl.height / rect.height;
      const pixelX = (event.clientX - rect.left) * scaleX;
      const pixelY = (event.clientY - rect.top) * scaleY;
      const t = canvas.stage.worldTransform;
      const worldX = (pixelX - t.tx) / t.a;
      const worldY = (pixelY - t.ty) / t.d;

      // Snap to grid cell top-left
      const snapped = canvas.grid.getSnappedPoint(
        { x: worldX, y: worldY },
        { mode: CONST.GRID_SNAPPING_MODES.CENTER }
      );
      const gs = canvas.grid.size;
      resolve({ x: snapped.x - gs / 2, y: snapped.y - gs / 2 });
    }

    function onContextMenu(event) {
      event.preventDefault();
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        cleanup();
        resolve(null);
      }
    }

    function cleanup() {
      canvasEl.style.cursor = prevCursor;
      canvasEl.removeEventListener("mousedown", onMouseDown, true);
      canvasEl.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("keydown", onKeyDown);
    }

    canvasEl.addEventListener("mousedown", onMouseDown, { capture: true });
    canvasEl.addEventListener("contextmenu", onContextMenu, { capture: true });
    document.addEventListener("keydown", onKeyDown);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   ACTOR RESOLUTION (compendium → world)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ensure all selected monsters have world actors. Returns a map of uuid → Actor.
 */
async function resolveActors(selectedMonsters) {
  const folderName = "Encounter Builder";
  let folder = game.folders.find((f) => f.type === "Actor" && f.name === folderName);
  if (!folder) {
    folder = await Folder.create({ name: folderName, type: "Actor" });
  }

  const resolved = new Map();
  const uniqueUuids = [...new Set(selectedMonsters.map((m) => m.uuid))];

  for (const uuid of uniqueUuids) {
    if (uuid.startsWith("Compendium.")) {
      // Check for existing import
      let actor = game.actors.find((a) => a.flags?.core?.sourceId === uuid);
      if (!actor) {
        const doc = await fromUuid(uuid);
        if (!doc) continue;
        const actorData = doc.toObject();
        actorData.folder = folder.id;
        foundry.utils.setProperty(actorData, "flags.core.sourceId", uuid);
        actor = await Actor.create(actorData);
      }
      resolved.set(uuid, actor);
    } else {
      // World actor — resolve directly
      const actor = await fromUuid(uuid);
      if (actor) resolved.set(uuid, actor);
    }
  }

  return resolved;
}

/* ══════════════════════════════════════════════════════════════════════════
   GROUP BUCKETING
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Organize monsters into group buckets for placement.
 * Each bucket: { groupId, name, monsters[], captain }
 * Ungrouped monsters form their own bucket (groupId = null).
 */
function buildGroupBuckets(selectedMonsters, groups) {
  const buckets = [];

  // Ungrouped monsters
  const ungrouped = selectedMonsters.filter((m) => !m.groupId);
  if (ungrouped.length > 0) {
    buckets.push({
      groupId: null,
      name: null,
      monsters: ungrouped,
      captain: null,
    });
  }

  // Named groups
  for (const group of groups) {
    const members = selectedMonsters.filter((m) => m.groupId === group.id);
    if (members.length === 0) continue;
    const captain = members.find((m) => m.isSquadCaptain) ?? null;
    buckets.push({
      groupId: group.id,
      name: group.name,
      monsters: members,
      captain,
    });
  }

  return buckets;
}

/* ══════════════════════════════════════════════════════════════════════════
   PLACEMENT CALCULATION
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Calculate the grid dimension needed to fit `count` items in a square.
 * e.g. 1-4 → 2, 5-9 → 3, 10-16 → 4, etc.
 */
function groupGridSize(count) {
  if (count <= 1) return 1;
  return Math.ceil(Math.sqrt(count));
}

/**
 * Calculate the meta-grid dimension for arranging N group blocks.
 * Same logic as groupGridSize — arrange groups in a square grid.
 */
function metaGridSize(count) {
  if (count <= 1) return 1;
  return Math.ceil(Math.sqrt(count));
}

/**
 * Calculate {x, y} placements for every monster across all groups.
 * Groups are laid out in a meta-grid of squares with 1-cell gaps between them.
 *
 * @param {Array} groupBuckets  Array of { monsters[] }
 * @param {{x: number, y: number}} origin  Top-left corner (already snapped to grid)
 * @param {number} gs  Grid cell size in pixels
 * @returns {Array<{x: number, y: number, monster: Object, groupBucketIndex: number}>}
 */
function calculatePlacements(groupBuckets, origin, gs) {
  const placements = [];
  const numGroups = groupBuckets.length;
  const metaSize = metaGridSize(numGroups);

  // First pass: determine each group's internal grid size so we can compute
  // how much space each meta-row/meta-col needs (with 1-cell gap).
  const groupSizes = groupBuckets.map((b) => groupGridSize(b.monsters.length));

  // For each meta-row, the row height is the maximum group grid size in that row.
  // For each meta-col, the col width is the maximum group grid size in that column.
  const metaRowHeights = [];
  const metaColWidths = [];
  for (let r = 0; r < metaSize; r++) {
    let maxH = 0;
    for (let c = 0; c < metaSize; c++) {
      const idx = r * metaSize + c;
      if (idx < numGroups) maxH = Math.max(maxH, groupSizes[idx]);
    }
    metaRowHeights.push(maxH);
  }
  for (let c = 0; c < metaSize; c++) {
    let maxW = 0;
    for (let r = 0; r < metaSize; r++) {
      const idx = r * metaSize + c;
      if (idx < numGroups) maxW = Math.max(maxW, groupSizes[idx]);
    }
    metaColWidths.push(maxW);
  }

  // Calculate offsets: cumulative cell counts + 1-cell gaps
  const metaColOffsets = [0];
  for (let c = 1; c < metaSize; c++) {
    metaColOffsets.push(metaColOffsets[c - 1] + metaColWidths[c - 1] + 1);
  }
  const metaRowOffsets = [0];
  for (let r = 1; r < metaSize; r++) {
    metaRowOffsets.push(metaRowOffsets[r - 1] + metaRowHeights[r - 1] + 1);
  }

  // Place each group
  for (let gi = 0; gi < numGroups; gi++) {
    const metaRow = Math.floor(gi / metaSize);
    const metaCol = gi % metaSize;
    const groupOriginX = origin.x + metaColOffsets[metaCol] * gs;
    const groupOriginY = origin.y + metaRowOffsets[metaRow] * gs;

    const bucket = groupBuckets[gi];
    const gSize = groupSizes[gi];

    for (let mi = 0; mi < bucket.monsters.length; mi++) {
      const row = Math.floor(mi / gSize);
      const col = mi % gSize;
      placements.push({
        x: groupOriginX + col * gs,
        y: groupOriginY + row * gs,
        monster: bucket.monsters[mi],
        groupBucketIndex: gi,
      });
    }
  }

  return placements;
}

/* ══════════════════════════════════════════════════════════════════════════
   COMBAT ENCOUNTER CREATION
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a Draw Steel Combat encounter with groups and squad captains.
 *
 * @param {TokenDocument[]} createdTokens  The token documents created on the scene
 * @param {Object[]} placementMeta         Parallel array (same order as tokenDataList) with { monsterId, groupBucketIndex }
 * @param {Object[]} tokenDataList         The original token data submitted to createEmbeddedDocuments
 * @param {Array} groupBuckets             Group bucket definitions
 * @param {Array} selectedMonsters         Original selected monster entries
 */
async function createCombatEncounter(createdTokens, placementMeta, tokenDataList, groupBuckets, selectedMonsters) {
  // Create a fresh combat
  const combat = await Combat.create({ scene: canvas.scene.id });

  // Add all tokens as combatants
  const combatantData = createdTokens.map((token) => ({
    actorId: token.actorId,
    tokenId: token.id,
    sceneId: canvas.scene.id,
  }));
  const combatants = await combat.createEmbeddedDocuments("Combatant", combatantData);

  // Build a map of token.id → combatant for fast lookup
  const tokenToCombatant = new Map();
  for (const c of combatants) {
    tokenToCombatant.set(c.tokenId, c);
  }

  // Match created tokens to placement metadata by position, since
  // createEmbeddedDocuments may return tokens in a different order than the input.
  const posToMeta = new Map();
  for (let i = 0; i < tokenDataList.length; i++) {
    const td = tokenDataList[i];
    posToMeta.set(`${td.x},${td.y}`, placementMeta[i]);
  }

  const monsterIdToCombatant = new Map();
  for (const token of createdTokens) {
    const meta = posToMeta.get(`${token.x},${token.y}`);
    if (!meta) continue;
    const combatant = tokenToCombatant.get(token.id);
    if (combatant) monsterIdToCombatant.set(meta.monsterId, combatant);
  }

  // Create combatant groups and assign members
  for (let gi = 0; gi < groupBuckets.length; gi++) {
    const bucket = groupBuckets[gi];

    // Get combatants for this group
    const groupCombatants = bucket.monsters
      .map((m) => monsterIdToCombatant.get(m.id))
      .filter(Boolean);

    if (groupCombatants.length === 0) continue;

    // Ungrouped monsters are not placed into a combat group
    if (bucket.groupId === null) continue;

    // Determine group type: squad if any member is a minion, base otherwise
    const hasMinions = bucket.monsters.some((m) => m.organization === "minion");
    const type = hasMinions ? "squad" : "base";

    // Use first token's image for group image
    const firstCombatant = groupCombatants[0];
    const firstToken = canvas.scene.tokens.get(firstCombatant.tokenId);

    const group = await CombatantGroup.create({
      type,
      name: bucket.name,
      img: firstToken?.texture?.src ?? null,
    }, { parent: combat });

    // Assign combatants to the group
    const updateData = groupCombatants.map((c) => ({ _id: c.id, group: group.id }));
    await combat.updateEmbeddedDocuments("Combatant", updateData);

    // Initialize squad stamina pool
    if (type === "squad") {
      await group.update({ "system.staminaValue": group.system.staminaMax });
    }

    // Set squad captain if designated
    if (bucket.captain && type === "squad") {
      const captainCombatant = monsterIdToCombatant.get(bucket.captain.id);
      if (captainCombatant) {
        await group.update({ "system.captainId": captainCombatant.id });
      }
    }
  }

  return combat;
}
