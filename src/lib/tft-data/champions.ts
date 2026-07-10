/**
 * TFT Set 17: Space Gods — champion roster.
 *
 * 63 champions across 5 cost tiers, sourced from op.gg/tft/set/17,
 * tftactics.gg/champions and metatft.com (Patch 17.x).
 *
 * Roles are assigned by combat ARCHETYPE (verified against mobalytics.gg +
 * metatft.com Set 17 champion/trait data, Patch 17.x). A champion's role is
 * driven by its CLASS/UNIQUE traits, NOT by its origins:
 *   - tank:    has a frontline CLASS (Bastion / Brawler / Vanguard) or the
 *              Bulwark unique trait — soaks damage, built with tank items.
 *              e.g. Cho'Gath, Poppy, Gragas, Mordekaiser, Rammus, Shen.
 *   - carry:   has a damage CLASS (Sniper, Rogue, Challenger, Marauder) or a
 *              damage UNIQUE (Divine Duelist, Eradicator, Factory New, Galaxy
 *              Hunter, Gun Goddess, Doomer), OR is a backline AP damage dealer
 *              scaling off an AP origin (Dark Star / Psionic / Stargazer).
 *   - support: backline enabler — a utility CLASS (Conduit, Fateweaver,
 *              Shepherd, Voyager) or UNIQUE (Commander, Dark Lady, Oracle,
 *              Party Animal, Redeemer) with no damage/tank class.
 *   - flex:    genuinely ambiguous (mixed signals or origin-only).
 *
 * NOTE: a comp's `carry` field (reroll target) is a different concept — a
 * frontline tank can be a reroll comp's "carry" while still being a TANK by
 * archetype (e.g. Mordekaiser, Aatrox).
 *
 * `items` is best-in-slot by role + AP/AD affinity. Champion names, trait
 * names and item names are the in-game strings — they are matched against
 * VLM output and must remain stable.
 */
import type { Champion, ChampionRole } from './types';

export const CARRY: ChampionRole = 'carry';
export const TANK: ChampionRole = 'tank';
export const SUPPORT: ChampionRole = 'support';
export const FLEX: ChampionRole = 'flex';

// BIS item loadouts by role (reused across champions).
const AD_CARRY_ITEMS = ['Infinity Edge', 'Last Whisper', "Bloodthirster"];
const AP_CARRY_ITEMS = ["Rabadon's Deathcap", 'Jeweled Gauntlet', 'Spear of Shojin'];
const AS_CARRY_ITEMS = ["Guinsoo's Rageblade", 'Statikk Shiv', 'Last Whisper'];
const TANK_ITEMS = ["Warmog's Armor", 'Bramble Vest', 'Gargoyle Stoneplate'];
const SUPPORT_ITEMS = ['Morellonomicon', 'Spear of Shojin', 'Locket of the Iron Solari'];
const FLEX_ITEMS = ["Titan's Resolve", "Bloodthirster", "Warmog's Armor"];

export const CHAMPIONS: Champion[] = [
  // ─── 1-COST (14) ──
  { name: 'Aatrox', cost: 1, traits: ['N.O.V.A.', 'Bastion'], role: TANK, ability: 'Stellar Slash', items: TANK_ITEMS },
  { name: 'Briar', cost: 1, traits: ['Anima', 'Primordian', 'Rogue'], role: CARRY, ability: 'Fish Frenzy', items: AD_CARRY_ITEMS },
  { name: 'Caitlyn', cost: 1, traits: ['N.O.V.A.', 'Fateweaver'], role: SUPPORT, ability: 'Aim For The Head', items: SUPPORT_ITEMS },
  { name: 'Cho\'Gath', cost: 1, traits: ['Dark Star', 'Brawler'], role: TANK, ability: 'Accretion', items: TANK_ITEMS },
  { name: 'Ezreal', cost: 1, traits: ['Timebreaker', 'Sniper'], role: CARRY, ability: 'Temporal Shot', items: AS_CARRY_ITEMS },
  { name: 'Leona', cost: 1, traits: ['Arbiter', 'Vanguard'], role: TANK, ability: 'Shield of Daybreak', items: TANK_ITEMS },
  { name: 'Lissandra', cost: 1, traits: ['Dark Star', 'Shepherd', 'Replicator'], role: SUPPORT, ability: 'Dark Matter', items: SUPPORT_ITEMS },
  { name: 'Nasus', cost: 1, traits: ['Space Groove', 'Vanguard'], role: TANK, ability: 'Groovin\' Susan', items: TANK_ITEMS },
  { name: 'Poppy', cost: 1, traits: ['Meeple', 'Bastion'], role: TANK, ability: 'Huddle Up!', items: TANK_ITEMS },
  { name: 'Rek\'Sai', cost: 1, traits: ['Primordian', 'Brawler'], role: TANK, ability: 'Upheaval', items: TANK_ITEMS },
  { name: 'Talon', cost: 1, traits: ['Stargazer', 'Rogue'], role: CARRY, ability: 'Diviner\'s Judgment', items: AD_CARRY_ITEMS },
  { name: 'Teemo', cost: 1, traits: ['Space Groove', 'Shepherd'], role: SUPPORT, ability: 'Double Time', items: SUPPORT_ITEMS },
  { name: 'Twisted Fate', cost: 1, traits: ['Stargazer', 'Fateweaver'], role: SUPPORT, ability: 'Fate\'s Gambit', items: SUPPORT_ITEMS },
  { name: 'Veigar', cost: 1, traits: ['Meeple', 'Replicator'], role: CARRY, ability: 'Meepteor Shower', items: AP_CARRY_ITEMS },

  // ─── 2-COST (13) ──
  { name: 'Akali', cost: 2, traits: ['N.O.V.A.', 'Marauder'], role: CARRY, ability: 'Star Strike', items: AD_CARRY_ITEMS },
  { name: 'Bel\'Veth', cost: 2, traits: ['Primordian', 'Challenger', 'Marauder'], role: CARRY, ability: 'Tidal Slashes', items: AS_CARRY_ITEMS },
  { name: 'Gnar', cost: 2, traits: ['Meeple', 'Sniper'], role: FLEX, ability: 'Slingshot Maneuver', items: FLEX_ITEMS },
  { name: 'Gragas', cost: 2, traits: ['Psionic', 'Brawler'], role: TANK, ability: 'Chemical Rage', items: TANK_ITEMS },
  { name: 'Gwen', cost: 2, traits: ['Space Groove', 'Rogue'], role: CARRY, ability: 'Dance n\' Dice', items: AD_CARRY_ITEMS },
  { name: 'Jax', cost: 2, traits: ['Stargazer', 'Bastion'], role: TANK, ability: 'Counter Star-ike', items: TANK_ITEMS },
  { name: 'Jinx', cost: 2, traits: ['Anima', 'Challenger'], role: CARRY, ability: 'Explosive Attitude', items: AS_CARRY_ITEMS },
  { name: 'Meepsie', cost: 2, traits: ['Meeple', 'Shepherd', 'Voyager'], role: SUPPORT, ability: 'Meep Impact', items: SUPPORT_ITEMS },
  { name: 'Milio', cost: 2, traits: ['Timebreaker', 'Fateweaver'], role: SUPPORT, ability: 'Mega Time Kick', items: SUPPORT_ITEMS },
  { name: 'Mordekaiser', cost: 2, traits: ['Dark Star', 'Conduit', 'Vanguard'], role: TANK, ability: 'Indestructible', items: TANK_ITEMS },
  { name: 'Pantheon', cost: 2, traits: ['Timebreaker', 'Brawler', 'Replicator'], role: TANK, ability: 'Advanced Defences', items: TANK_ITEMS },
  { name: 'Pyke', cost: 2, traits: ['Psionic', 'Voyager'], role: CARRY, ability: 'Marked for Death', items: AP_CARRY_ITEMS },
  { name: 'Zoe', cost: 2, traits: ['Arbiter', 'Conduit'], role: SUPPORT, ability: 'Paddle Star', items: SUPPORT_ITEMS },

  // ─── 3-COST (13) ──
  { name: 'Aurora', cost: 3, traits: ['Anima', 'Voyager'], role: SUPPORT, ability: 'Hopped-Up Hacks', items: SUPPORT_ITEMS },
  { name: 'Diana', cost: 3, traits: ['Arbiter', 'Challenger'], role: CARRY, ability: 'Pale Cascade', items: AS_CARRY_ITEMS },
  { name: 'Fizz', cost: 3, traits: ['Meeple', 'Rogue'], role: CARRY, ability: 'Meep Bait', items: AD_CARRY_ITEMS },
  { name: 'Illaoi', cost: 3, traits: ['Anima', 'Vanguard', 'Shepherd'], role: TANK, ability: 'Test of Spirit', items: TANK_ITEMS },
  { name: 'Kai\'Sa', cost: 3, traits: ['Dark Star', 'Rogue'], role: CARRY, ability: 'Bullet Cluster', items: AD_CARRY_ITEMS },
  { name: 'Lulu', cost: 3, traits: ['Stargazer', 'Replicator'], role: SUPPORT, ability: 'It\'s Raining Stars', items: SUPPORT_ITEMS },
  { name: 'Maokai', cost: 3, traits: ['N.O.V.A.', 'Brawler'], role: TANK, ability: 'Grasp of Convergence', items: TANK_ITEMS },
  { name: 'Miss Fortune', cost: 3, traits: ['Gun Goddess', 'Choose Trait'], role: CARRY, ability: 'Gun Goddess Arsenal', items: AD_CARRY_ITEMS },
  { name: 'Ornn', cost: 3, traits: ['Space Groove', 'Bastion'], role: TANK, ability: 'Disco Inferno', items: TANK_ITEMS },
  { name: 'Rhaast', cost: 3, traits: ['Redeemer'], role: FLEX, ability: 'Divine Scythe', items: FLEX_ITEMS },
  { name: 'Samira', cost: 3, traits: ['Space Groove', 'Sniper'], role: CARRY, ability: 'Jump and Jive', items: AS_CARRY_ITEMS },
  { name: 'Urgot', cost: 3, traits: ['Mecha', 'Brawler', 'Marauder'], role: TANK, ability: 'Unstoppable Dreadnought', items: TANK_ITEMS },
  { name: 'Viktor', cost: 3, traits: ['Psionic', 'Conduit'], role: CARRY, ability: 'Psionic Storm', items: AP_CARRY_ITEMS },

  // ─── 4-COST (14) ──
  { name: 'Aurelion Sol', cost: 4, traits: ['Mecha', 'Conduit'], role: CARRY, ability: 'Deathbeam', items: AP_CARRY_ITEMS },
  { name: 'Corki', cost: 4, traits: ['Meeple', 'Fateweaver'], role: CARRY, ability: 'Asteroid Blaster', items: AP_CARRY_ITEMS },
  { name: 'Karma', cost: 4, traits: ['Dark Star', 'Voyager'], role: FLEX, ability: 'Singularity', items: FLEX_ITEMS },
  { name: 'Kindred', cost: 4, traits: ['N.O.V.A.', 'Challenger'], role: CARRY, ability: 'Cosmic Pursuit', items: AS_CARRY_ITEMS },
  { name: 'LeBlanc', cost: 4, traits: ['Arbiter', 'Shepherd'], role: SUPPORT, ability: 'Fracture Reality', items: SUPPORT_ITEMS },
  { name: 'Master Yi', cost: 4, traits: ['Psionic', 'Marauder'], role: CARRY, ability: 'Psi Strikes', items: AD_CARRY_ITEMS },
  { name: 'Morgana', cost: 4, traits: ['Dark Lady'], role: SUPPORT, ability: 'Dark Form', items: SUPPORT_ITEMS },
  { name: 'Nami', cost: 4, traits: ['Space Groove', 'Replicator'], role: FLEX, ability: 'Bubble Pop', items: FLEX_ITEMS },
  { name: 'Nunu & Willump', cost: 4, traits: ['Stargazer', 'Vanguard'], role: TANK, ability: 'Calamity', items: TANK_ITEMS },
  { name: 'Rammus', cost: 4, traits: ['Meeple', 'Bastion'], role: TANK, ability: 'Gravitational Spin', items: TANK_ITEMS },
  { name: 'Riven', cost: 4, traits: ['Timebreaker', 'Rogue'], role: CARRY, ability: 'Time Warp', items: AD_CARRY_ITEMS },
  { name: 'Tahm Kench', cost: 4, traits: ['Oracle', 'Brawler'], role: TANK, ability: 'Tounge Lash', items: TANK_ITEMS },
  { name: 'The Mighty Mech', cost: 4, traits: ['Mecha', 'Voyager'], role: TANK, ability: 'Gravity Matrix', items: TANK_ITEMS },
  { name: 'Xayah', cost: 4, traits: ['Stargazer', 'Sniper'], role: CARRY, ability: 'Stellar Ricochet', items: AS_CARRY_ITEMS },

  // ─── 5-COST (9) ──
  { name: 'Bard', cost: 5, traits: ['Meeple', 'Conduit'], role: SUPPORT, ability: 'Ultra Friendly Object', items: SUPPORT_ITEMS },
  { name: 'Blitzcrank', cost: 5, traits: ['Party Animal', 'Space Groove', 'Vanguard'], role: TANK, ability: 'Party Crasher', items: TANK_ITEMS },
  { name: 'Fiora', cost: 5, traits: ['Divine Duelist', 'Anima', 'Marauder'], role: CARRY, ability: 'Perfect Bladework', items: AD_CARRY_ITEMS },
  { name: 'Graves', cost: 5, traits: ['Factory New'], role: CARRY, ability: 'Collateral Damage', items: AD_CARRY_ITEMS },
  { name: 'Jhin', cost: 5, traits: ['Dark Star', 'Eradicator', 'Sniper'], role: CARRY, ability: 'Space Opera', items: AD_CARRY_ITEMS },
  { name: 'Shen', cost: 5, traits: ['Bulwark', 'Bastion'], role: TANK, ability: 'Reality Tear', items: TANK_ITEMS },
  { name: 'Sona', cost: 5, traits: ['Commander', 'Psionic', 'Shepherd'], role: SUPPORT, ability: 'Psionic Crush', items: SUPPORT_ITEMS },
  { name: 'Vex', cost: 5, traits: ['Doomer'], role: CARRY, ability: 'Lend Me a Hand, Shadow!', items: AP_CARRY_ITEMS },
  { name: 'Zed', cost: 5, traits: ['Galaxy Hunter'], role: CARRY, ability: 'Quantum Clone', items: AD_CARRY_ITEMS },

];

/** Name → Champion lookup (case-insensitive). */
export const CHAMPION_MAP: Record<string, Champion> = Object.fromEntries(
  CHAMPIONS.map((c) => [c.name.toLowerCase(), c]),
);

/** All champion names in alphabetical order. */
export const CHAMPION_NAMES: string[] = CHAMPIONS.map((c) => c.name).sort();

// ─── Helpers ──

/** Get a champion by name (case-insensitive). */
export function getChampion(name: string): Champion | undefined {
  return CHAMPION_MAP[name.toLowerCase()];
}

/** Return all champions of the given cost. */
export function getChampionsByCost(cost: Champion['cost']): Champion[] {
  return CHAMPIONS.filter((c) => c.cost === cost);
}

/** Return all champions sharing at least one trait. */
export function getChampionsByTrait(trait: string): Champion[] {
  return CHAMPIONS.filter((c) => c.traits.includes(trait));
}

/** Return all champions of the given role. */
export function getChampionsByRole(role: ChampionRole): Champion[] {
  return CHAMPIONS.filter((c) => c.role === role);
}

/** Total champion count by cost tier. */
export const CHAMPION_COUNT_BY_COST: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: CHAMPIONS.filter((c) => c.cost === 1).length,
  2: CHAMPIONS.filter((c) => c.cost === 2).length,
  3: CHAMPIONS.filter((c) => c.cost === 3).length,
  4: CHAMPIONS.filter((c) => c.cost === 4).length,
  5: CHAMPIONS.filter((c) => c.cost === 5).length,
};
