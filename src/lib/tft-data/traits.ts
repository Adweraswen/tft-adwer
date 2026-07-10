/**
 * TFT Set 17: Space Gods — trait data.
 *
 * 35 traits total, sourced from metatft.com/new-set + op.gg/tft/set/17.
 *   - Origins (22):  Anima, Arbiter, Bulwark, Commander, Dark Lady, Dark Star,
 *                    Divine Duelist, Doomer, Factory New, Galaxy Hunter,
 *                    Gun Goddess, Mecha, Meeple, N.O.V.A., Oracle,
 *                    Party Animal, Primordian, Psionic, Redeemer, Space Groove,
 *                    Stargazer, Timebreaker
 *   - Classes (13):  Bastion, Brawler, Challenger, Conduit, Eradicator,
 *                    Fateweaver, Marauder, Replicator, Rogue, Shepherd,
 *                    Sniper, Vanguard, Voyager
 *   - Unique (12):   Bulwark, Commander, Dark Lady, Divine Duelist, Doomer,
 *                    Eradicator, Factory New, Galaxy Hunter, Gun Goddess,
 *                    Oracle, Party Animal, Redeemer  (5-cost / special)
 *
 * `type` is the combat role: AD | AP | Tank | Utility | Unique.
 * `breakpoints` are the active tiers shown in-game.
 */
import type { Trait } from './types';

export const TRAITS: Trait[] = [
  {
    name: 'Anima',
    category: 'origin',
    type: 'Utility',
    breakpoints: [3, 6],
    desc: 'After losing a player combat, gain Tech plus additional Tech equal to 5 times the length of your loss streak. Each time Animas get 100 Tech, they prototype new Anima Weapons you can take or save for m',
  },
  {
    name: 'Arbiter',
    category: 'origin',
    type: 'Utility',
    breakpoints: [2, 3],
    desc: 'Scribe a unique divine law, allowing you to choose an effect to apply to Arbiters when a chosen cause occurs. (3) Effects are stronger.',
  },
  {
    name: 'Dark Star',
    category: 'origin',
    type: 'AP',
    breakpoints: [2, 4, 6, 9],
    desc: 'Dark Stars create a black hole that consumes enemies. At higher breakpoints they gain damage amp, supermassive status, and at 9 all Dark Stars become supermassive.',
  },
  {
    name: 'Mecha',
    category: 'origin',
    type: 'Utility',
    breakpoints: [3, 4, 6],
    desc: 'Innate: Mecha units can transform into their Ultimate form (The Mighty Mech), upgrading their ability and gaining 40% Health. Transformed Mechas take up two team slots and count twice for the Mecha tr',
  },
  {
    name: 'Meeple',
    category: 'origin',
    type: 'Utility',
    breakpoints: [3, 5, 7, 10],
    desc: 'Meeple attract Meeps that empower Meeple abilities. They also gain bonus Health. At (7) create a Cloning Slot on your bench; at (10) summon the Four Meelords.',
  },
  {
    name: 'N.O.V.A.',
    category: 'origin',
    type: 'Utility',
    breakpoints: [2, 5],
    desc: '6 seconds into combat, N.O.V.A. grant a power surge to allies based on champions. At (5) gain a Striker selector — the chosen N.O.V.A. activates their Strike during the power surge.',
  },
  {
    name: 'Primordian',
    category: 'origin',
    type: 'Utility',
    breakpoints: [2, 3],
    desc: 'Dealing damage spawns Swarmlings based on unique Primordian star level. At (3) spawn 45% more Swarmlings! After each player combat, gain a random 1 or 2-cost champion. 8% of damage taken contributes t',
  },
  {
    name: 'Psionic',
    category: 'origin',
    type: 'AP',
    breakpoints: [2, 4],
    desc: 'Gain Psionic items that can be equipped to any ally. At (4) Psionic items gain extra effects on Psionic units.',
  },
  {
    name: 'Space Groove',
    category: 'origin',
    type: 'Utility',
    breakpoints: [1, 3, 5, 7, 10],
    desc: 'Groovians can enter The Groove, gaining Attack Speed and max Health Regen. Higher breakpoints add combat-start Groove, stacking AD/AP, increased effects, and at 10 the groove peaks.',
  },
  {
    name: 'Stargazer',
    category: 'origin',
    type: 'AP',
    breakpoints: [3, 4, 5, 6],
    desc: 'Stargazers chart a different constellation every game. Allies in empowered hexes gain Health, AD, and AP. Stargazers gain more. Gold is earned after winning player combat.',
  },
  {
    name: 'Timebreaker',
    category: 'origin',
    type: 'Utility',
    breakpoints: [2, 3, 4],
    desc: 'Allies gain 15% Attack Speed. (3) When you lose, gain free rerolls; when you win, store XP in a Temporal Core. (4) Timebreakers gain an additional 50% Attack Speed.',
  },
  {
    name: 'Bastion',
    category: 'class',
    type: 'Tank',
    breakpoints: [2, 4, 6],
    desc: 'Your team gains 15 Armor and Magic Resist. Bastions gain more, and the value doubles in the first 10 seconds of combat.',
  },
  {
    name: 'Brawler',
    category: 'class',
    type: 'Tank',
    breakpoints: [2, 4, 6],
    desc: 'Your team gains 5% Health. Brawlers gain more (+25%/+45%/+65% max Health at breakpoints).',
  },
  {
    name: 'Challenger',
    category: 'class',
    type: 'AD',
    breakpoints: [2, 3, 4, 5],
    desc: 'Your team gains 10% Attack Speed. Challengers gain bonus Attack Speed (15%/28%/42%/55%). When their target dies, Challengers dash to a new target and increase their Attack Speed bonus by 50% for 2.5 s',
  },
  {
    name: 'Conduit',
    category: 'class',
    type: 'Utility',
    breakpoints: [2, 3, 4, 5],
    desc: 'Innate: Conduits gain 20% additional Mana from all sources. Your team gains Mana Regen, increased for Conduits (1|3 / 1|5 / 2|7 / 3|9).',
  },
  {
    name: 'Fateweaver',
    category: 'class',
    type: 'Utility',
    breakpoints: [2, 4],
    desc: 'Innate: Fateweavers have Precision. (2) Chance effects on abilities are Lucky. (4) Gain 20% Crit Chance and 20% Crit Damage. Critical strikes are also Lucky.',
  },
  {
    name: 'Marauder',
    category: 'class',
    type: 'AD',
    breakpoints: [2, 4, 6],
    desc: 'Your team gains 5% Omnivamp. Marauders gain more Omnivamp, Attack Damage, and their Omnivamp overhealing is converted into Shield (up to 25% max Health).',
  },
  {
    name: 'Replicator',
    category: 'class',
    type: 'Unique',
    breakpoints: [2, 4],
    desc: 'Replicator abilities occur a second time at reduced effectiveness (22% at 2, 45% at 4).',
  },
  {
    name: 'Rogue',
    category: 'class',
    type: 'AD',
    breakpoints: [2, 3, 4, 5],
    desc: 'Rogues gain Attack Damage and Ability Power. The first time they fall below 50% health, they slip into shadows. Enemies targeting them are redirected to a nearby unit, preferring Tanks.',
  },
  {
    name: 'Shepherd',
    category: 'class',
    type: 'Utility',
    breakpoints: [3, 5, 7],
    desc: 'Shepherds summon the Bond of the Stars to aid them in battle. (3) Summon Bia, (5) Summon Bayin, (7) Bia and Bayin grow deeper. Their power is increased by the total star level of all Shepherds.',
  },
  {
    name: 'Sniper',
    category: 'class',
    type: 'AD',
    breakpoints: [2, 3, 4],
    desc: 'Snipers gain Damage Amp, increased against targets farther away (18%/25%/35%; +2%/+3%/+4% per hex).',
  },
  {
    name: 'Vanguard',
    category: 'class',
    type: 'Tank',
    breakpoints: [2, 4, 6],
    desc: 'Vanguards gain 5% Durability while Shielded. Combat start and at 50% Health, gain a max Health Shield for 10 seconds.',
  },
  {
    name: 'Voyager',
    category: 'class',
    type: 'Utility',
    breakpoints: [2, 3, 4, 5, 6],
    desc: 'Combat Start: Your Tanks gain a Shield for 15 seconds. Your other allies gain Damage Amp. Voyagers gain double.',
  },
  {
    name: 'Bulwark',
    category: 'unique',
    type: 'Tank',
    breakpoints: [1],
    desc: 'Summon a placeable relic. At the start of combat, it grants adjacent allies a 10% max Health shield and 10% Attack Speed.',
    unique: true,
  },
  {
    name: 'Commander',
    category: 'unique',
    type: 'Utility',
    breakpoints: [1],
    desc: 'Sona gives you a random Command Mod every 2 rounds which allows you to alter the way an ally behaves during combat. Command Mods last 2 player combats even if they are not equipped.',
    unique: true,
  },
  {
    name: 'Dark Lady',
    category: 'unique',
    type: 'Utility',
    breakpoints: [1],
    desc: 'Your team gains 4% Durability, increased to 10% when Morgana is in her Dark Form.',
    unique: true,
  },
  {
    name: 'Divine Duelist',
    category: 'unique',
    type: 'AD',
    breakpoints: [1],
    desc: 'Your Tactician heals for 15% of player damage dealt from winning. Fiora always wins a one-on-one duel.',
    unique: true,
  },
  {
    name: 'Doomer',
    category: 'unique',
    type: 'AP',
    breakpoints: [1],
    desc: 'Combat Start: Mark all enemies with Doom. The first time enemies are damaged each combat, their Doom is consumed, stealing 12% Attack Damage and Ability Power from them and granting it to your stronge',
    unique: true,
  },
  {
    name: 'Eradicator',
    category: 'unique',
    type: 'AD',
    breakpoints: [1],
    desc: 'Enemies have 10% less Armor and Magic Resist.',
    unique: true,
  },
  {
    name: 'Factory New',
    category: 'unique',
    type: 'AD',
    breakpoints: [1],
    desc: 'After participating in combat, open an armory to purchase a permanent upgrade for your strongest Graves. Every 3 upgrades, future upgrades will take an additional round.',
    unique: true,
  },
  {
    name: 'Galaxy Hunter',
    category: 'unique',
    type: 'AD',
    breakpoints: [1],
    desc: 'Zed is obtained from the Invader Zed augment. While at least one clone is alive, Zed gains 40% bonus Attack Damage.',
    unique: true,
  },
  {
    name: 'Gun Goddess',
    category: 'unique',
    type: 'AD',
    breakpoints: [1],
    desc: 'When you field Miss Fortune, choose between Conduit Mode, Challenger Mode, and Replicator Mode. Miss Fortune has a unique ability based on her mode and gains the associated trait.',
    unique: true,
  },
  {
    name: 'Choose Trait',
    category: 'unique',
    type: 'Utility',
    breakpoints: [],
    desc: 'Miss Fortune\'s second trait slot is chosen by the player at the start of the game (Conduit, Challenger, or Replicator mode).',
    unique: true,
  },
  {
    name: 'Oracle',
    category: 'unique',
    type: 'Utility',
    breakpoints: [1],
    desc: 'Every 3 rounds, Tahm Kench grants a reward!',
    unique: true,
  },
  {
    name: 'Party Animal',
    category: 'unique',
    type: 'Utility',
    breakpoints: [1],
    desc: 'Once per combat, after falling below 45% Health, become untargetable and repair 15% max Health per second. Upon reaching full Health or when no other allies remain, return to combat.',
    unique: true,
  },
  {
    name: 'Redeemer',
    category: 'unique',
    type: 'Utility',
    breakpoints: [1],
    desc: 'For each non-unique trait you have active, your team gains 2% Attack Speed, and 2 Armor and Magic Resist.',
    unique: true,
  },
];

/** Name → Trait lookup. */
export const TRAIT_MAP: Record<string, Trait> = Object.fromEntries(
  TRAITS.map((t) => [t.name.toLowerCase(), t]),
);

// ─── Helpers ──

/** All trait names in alphabetical order. */
export const TRAIT_NAMES: string[] = TRAITS.map((t) => t.name).sort();

/** All origin traits. */
export const ORIGIN_TRAITS: Trait[] = TRAITS.filter((t) => t.category === 'origin');

/** All class traits. */
export const CLASS_TRAITS: Trait[] = TRAITS.filter((t) => t.category === 'class');

/** All unique 5-cost / special traits. */
export const UNIQUE_TRAITS: Trait[] = TRAITS.filter((t) => t.category === 'unique');

/** Get a trait by name (case-insensitive). */
export function getTrait(name: string): Trait | undefined {
  return TRAIT_MAP[name.toLowerCase()];
}
