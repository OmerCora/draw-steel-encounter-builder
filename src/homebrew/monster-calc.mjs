/**
 * Monster Homebrew Calculation Engine
 * Pure functions implementing the official Draw Steel monster building rules.
 */

/* ══════════════════════════════════════════════════════════════════════════
   LOOKUP TABLES
   ══════════════════════════════════════════════════════════════════════════ */

/** Role Modifier and Damage Modifier per role key. */
export const ROLE_TABLE = {
  noRole:     { roleModifier: 20, damageModifier: 0 },
  ambusher:   { roleModifier: 20, damageModifier: 1 },
  artillery:  { roleModifier: 10, damageModifier: 1 },
  brute:      { roleModifier: 30, damageModifier: 1 },
  controller: { roleModifier: 10, damageModifier: 0 },
  defender:   { roleModifier: 30, damageModifier: 0 },
  harrier:    { roleModifier: 20, damageModifier: 0 },
  hexer:      { roleModifier: 10, damageModifier: 0 },
  mount:      { roleModifier: 20, damageModifier: 0 },
  support:    { roleModifier: 20, damageModifier: 0 },
};

/** Organization modifiers. "ev" is the EV multiplier, "stamina" is the stamina multiplier. */
export const ORG_TABLE = {
  minion:  { ev: 0.5,  stamina: 0.125 },
  horde:   { ev: 0.5,  stamina: 0.5 },
  platoon: { ev: 1,    stamina: 1 },
  elite:   { ev: 2,    stamina: 2 },
  leader:  { ev: 2,    stamina: 2 },
  solo:    { ev: 6,    stamina: 5 },
};

/** Organization role/damage modifiers (applied in addition to the role table). */
export const ORG_ROLE_TABLE = {
  elite:  { roleModifier: 0,  damageModifier: 1 },
  leader: { roleModifier: 30, damageModifier: 1 },
  solo:   { roleModifier: 30, damageModifier: 2 },
};

/** Power roll tier multipliers. */
export const TIER_MULTIPLIER = { 1: 0.6, 2: 1.1, 3: 1.4 };

/* ══════════════════════════════════════════════════════════════════════════
   ECHELON
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Calculate echelon from level.
 * Echelon 1: L1-3, Echelon 2: L4-6, Echelon 3: L7-9, Echelon 4: L10+
 * @param {number} level
 * @returns {number} 1-4
 */
export function calcEchelon(level) {
  if (level >= 10) return 4;
  if (level >= 7) return 3;
  if (level >= 4) return 2;
  return 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   ENCOUNTER VALUE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * EV = ceil(((2 × Level) + 4) × Organization Modifier)
 * For minions, this represents four minions together.
 * @param {number} level
 * @param {string} orgKey
 * @returns {number}
 */
export function calcEV(level, orgKey) {
  const org = ORG_TABLE[orgKey];
  if (!org) return 0;
  return Math.ceil(((2 * level) + 4) * org.ev);
}

/* ══════════════════════════════════════════════════════════════════════════
   STAMINA
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Stamina = ceil(((10 × Level) + Role Modifier) × Organization Modifier)
 * For organizations with their own role modifier (leader/solo), that modifier
 * is used instead of (or in addition to) the role modifier.
 * @param {number} level
 * @param {string} roleKey
 * @param {string} orgKey
 * @param {boolean} [extraStamina=false] Add (3 × Level) + 3 extra stamina
 * @returns {number}
 */
export function calcStamina(level, roleKey, orgKey, extraStamina = false) {
  const role = ROLE_TABLE[roleKey];
  const org = ORG_TABLE[orgKey];
  if (!role || !org) return 0;

  // Organizations like leader/solo have their own role modifier
  const orgRole = ORG_ROLE_TABLE[orgKey];
  const roleModifier = orgRole ? orgRole.roleModifier : role.roleModifier;

  let stamina = Math.ceil(((10 * level) + roleModifier) * org.stamina);
  if (extraStamina) stamina += (3 * level) + 3;
  return stamina;
}

/* ══════════════════════════════════════════════════════════════════════════
   CHARACTERISTICS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Highest characteristic = 1 + echelon.
 * Leaders and solos get +1 (capped at 5).
 * @param {number} level
 * @param {string} orgKey
 * @returns {number}
 */
export function calcHighestChar(level, orgKey) {
  let value = 1 + calcEchelon(level);
  if (orgKey === "leader" || orgKey === "solo") value = Math.min(value + 1, 5);
  return value;
}

/**
 * Suggested characteristic array for a given level/org.
 * Returns [highest, mid, mid, low, low] sorted descending.
 * @param {number} level
 * @param {string} orgKey
 * @returns {number[]} Array of 5 values (might, agility, reason, intuition, presence order)
 */
export function getSuggestedCharArray(level, orgKey) {
  const highest = calcHighestChar(level, orgKey);
  // Decent heuristic: highest, highest-1, 0, -1, -1
  const mid = Math.max(highest - 1, 0);
  return [highest, mid, 0, -1, -1];
}

/* ══════════════════════════════════════════════════════════════════════════
   DAMAGE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Get the combined damage modifier for a role + organization.
 * Elite stacks with role for +1, leader/solo override.
 * @param {string} roleKey
 * @param {string} orgKey
 * @returns {number}
 */
export function getDamageModifier(roleKey, orgKey) {
  const role = ROLE_TABLE[roleKey];
  if (!role) return 0;
  const orgRole = ORG_ROLE_TABLE[orgKey];
  if (!orgRole) return role.damageModifier;
  // Elite stacks with role, leader/solo use own modifier
  if (orgKey === "elite") return role.damageModifier + orgRole.damageModifier;
  return orgRole.damageModifier;
}

/**
 * Calculate base damage for a tier.
 * BaseDamage = ceil((4 + Level + DamageModifier) × TierModifier)
 * For horde/minion: divide by 2.
 * If strike: add highest characteristic.
 * @param {number} level
 * @param {string} roleKey
 * @param {string} orgKey
 * @param {number} tier  1, 2, or 3
 * @param {object} [options]
 * @param {boolean} [options.isStrike=true]
 * @param {number}  [options.highestChar=0]  Highest characteristic value
 * @param {number}  [options.customModifier=0]  Additional per-tier damage modifier
 * @param {number}  [options.targetMultiplier=1]  Damage multiplier for target count adjustments
 * @returns {number}
 */
export function calcTierDamage(level, roleKey, orgKey, tier, options = {}) {
  const { isStrike = true, highestChar = 0, customModifier = 0, targetMultiplier = 1 } = options;
  const damageModifier = getDamageModifier(roleKey, orgKey);

  let damage = Math.ceil((4 + level + damageModifier) * TIER_MULTIPLIER[tier]);

  // Horde and minion: halve damage
  if (orgKey === "horde" || orgKey === "minion") {
    damage = Math.ceil(damage / 2);
  }

  // Strike: add highest characteristic
  if (isStrike) damage += highestChar;

  // Apply custom modifier
  damage += customModifier;

  // Apply target count multiplier
  if (targetMultiplier !== 1) damage = Math.ceil(damage * targetMultiplier);

  return Math.max(1, damage);
}

/**
 * Determine the target count damage multiplier.
 * Expected targets: 1 for minion/horde/platoon, 2 for elite/leader/solo.
 * +1 additional → ×0.8, +2 or more → ×0.5, -1 → ×1.2
 * @param {number} targetCount  Actual target count
 * @param {string} orgKey
 * @returns {number} Multiplier
 */
export function getTargetMultiplier(targetCount, orgKey) {
  const expected = (orgKey === "elite" || orgKey === "leader" || orgKey === "solo") ? 2 : 1;
  const diff = targetCount - expected;
  if (diff <= -1) return 1.2;
  if (diff === 0) return 1;
  if (diff === 1) return 0.8;
  return 0.5; // 2+ additional
}

/* ══════════════════════════════════════════════════════════════════════════
   POTENCY
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Calculate potency values per tier.
 * Potency is based on highest characteristic, minus 1 for each tier below tier 3.
 * Leaders/solos increase potency at all tiers by 1 (to a maximum of 6).
 * @param {number} highestChar
 * @param {string} orgKey
 * @returns {{ tier1: number, tier2: number, tier3: number }}
 */
export function calcPotency(highestChar, orgKey) {
  const bonus = (orgKey === "leader" || orgKey === "solo") ? 1 : 0;
  return {
    tier1: Math.min(highestChar - 2 + bonus, 6),
    tier2: Math.min(highestChar - 1 + bonus, 6),
    tier3: Math.min(highestChar + bonus, 6),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   FREE STRIKE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Free strike damage = tier 1 damage.
 * @param {number} level
 * @param {string} roleKey
 * @param {string} orgKey
 * @param {number} highestChar
 * @returns {number}
 */
export function calcFreeStrike(level, roleKey, orgKey, highestChar) {
  return calcTierDamage(level, roleKey, orgKey, 1, { isStrike: true, highestChar });
}

/* ══════════════════════════════════════════════════════════════════════════
   COMBAT TURNS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Solos get 2 turns per round, all others get 1.
 * @param {string} orgKey
 * @returns {number}
 */
export function calcTurns(orgKey) {
  return orgKey === "solo" ? 2 : 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   SUMMARY — compute all stats at once
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Compute all monster stats from wizard inputs.
 * @param {object} params
 * @param {number} params.level
 * @param {string} params.roleKey
 * @param {string} params.orgKey
 * @param {number[]} params.characteristics  [might, agility, reason, intuition, presence]
 * @param {number} params.targetCount
 * @param {number[]} [params.customDamageMods=[0,0,0]]  Per-tier custom damage modifiers
 * @param {boolean} [params.extraStamina=false]
 * @returns {object} Computed stats
 */
export function computeAllStats(params) {
  const {
    level, roleKey, orgKey, characteristics,
    targetCount = 1, customDamageMods = [0, 0, 0],
    extraStamina = false,
  } = params;

  const echelon = calcEchelon(level);
  const highestChar = Math.max(0, ...characteristics);
  const ev = calcEV(level, orgKey);
  const stamina = calcStamina(level, roleKey, orgKey, extraStamina);
  const turns = calcTurns(orgKey);
  const freeStrike = calcFreeStrike(level, roleKey, orgKey, highestChar);
  const potency = calcPotency(highestChar, orgKey);
  const targetMultiplier = getTargetMultiplier(targetCount, orgKey);

  const tierDamage = {};
  for (const tier of [1, 2, 3]) {
    tierDamage[tier] = calcTierDamage(level, roleKey, orgKey, tier, {
      isStrike: true,
      highestChar,
      customModifier: customDamageMods[tier - 1] ?? 0,
      targetMultiplier,
    });
  }

  // If a higher tier equals its lower tier, bump the higher by 1
  if (tierDamage[2] <= tierDamage[1]) tierDamage[2] = tierDamage[1] + 1;
  if (tierDamage[3] <= tierDamage[2]) tierDamage[3] = tierDamage[2] + 1;

  return {
    echelon,
    highestChar,
    ev,
    stamina,
    turns,
    freeStrike,
    potency,
    targetMultiplier,
    tierDamage,
  };
}
