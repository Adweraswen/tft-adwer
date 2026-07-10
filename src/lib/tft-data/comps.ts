/**
 * TFT Set 17: Space Gods — meta comp data.
 *
 * 25 meta comps rewritten from scratch against Patch 17.6 sources:
 *   - blitz.gg/tft/set17/comps  (Emerald+, 135K+ games — avgPlace / pickRate)
 *   - mobalytics.gg/tft/tierlist/team-comps (Patch 17.6, Diamond+)
 *   - metatft.com/tft/comps (meta tier list)
 *
 * Trait activations have been verified: every `keyTraits` entry hits a valid
 * breakpoint given the `core` roster. Notable Set 17 mechanics accounted for:
 *   - **Mecha transform**: a Mecha unit can transform into "The Mighty Mech"
 *     (a 4-cost), which takes 2 team slots and counts TWICE for the Mecha
 *     trait. So a comp with Aurelion Sol + The Mighty Mech activates Mecha (3).
 *   - **Miss Fortune "Gun Goddess"**: at game start she picks a mode that
 *     grants her Conduit / Challenger / Replicator as a second class trait.
 *   - **Galaxy Hunter Zed**: only obtainable via the "Invader Zed" augment.
 *
 * Each comp has: name, tier (S/A/B), carry, playstyle (reroll/rush8/rush9/
 * standard), difficulty (Easy/Medium/Hard), rerollLevel (6/7/8/9), core
 * champions, key traits, strategy, threeStarTargets, traitBots, winRate,
 * avgPlace, pickRate.
 *
 * Difficulty guide:
 *   Easy   = reroll at L6/L7 for cheap 3-stars, simple decision tree
 *   Medium = L8 standard roll, requires positioning awareness
 *   Hard   = L9 rush or tempo pivots, requires strong economy management
 */
import type { Comp, CompPlaystyle } from './types';

export const COMPS: Comp[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // S-TIER (9)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Mecha Conduit Aurelion Sol',
    tier: 'S',
    carry: 'Aurelion Sol',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['Aurelion Sol', 'The Mighty Mech', 'Bard', 'Mordekaiser', 'Karma', 'Blitzcrank', 'Morgana', 'Rhaast'],
    keyTraits: ['Mecha', 'Conduit', 'Dark Star'],
    strategy: 'Rush 9 for Aurelion Sol 2-star. Transform a Mecha unit into The Mighty Mech (counts 2×) to activate Mecha (3) for a huge HP frontline. Conduit (3) (Bard, Mordekaiser, Aurelion Sol) speeds up ASol\'s deathbeam casts. Dark Star (2) (Karma, Mordekaiser) adds black hole control. Rhaast scales off the many active traits.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['Morgana', 'Rhaast'],
    winRate: 62.5,
    avgPlace: 3.85,
    pickRate: 7.5,
  },
  {
    name: 'Space Groove Ornn Sniper',
    tier: 'S',
    carry: 'Ornn',
    playstyle: 'standard',
    rerollLevel: 8,
    core: ['Blitzcrank', 'Nami', 'Ornn', 'Samira', 'Gwen', 'Nasus', 'Teemo', 'Jhin', 'Shen'],
    keyTraits: ['Space Groove', 'Bastion', 'Sniper'],
    strategy: 'Standard level 8 board stacking 7 Space Groove (Blitzcrank, Nami, Ornn, Samira, Gwen, Nasus, Teemo) for max groove bonuses. Bastion (2) (Ornn, Shen) frontline; Sniper (2) (Samira, Jhin) amplifies backline damage. Position Blitzcrank to hook priority targets.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['Jhin', 'Shen'],
    winRate: 64.2,
    avgPlace: 3.65,
    pickRate: 9.5,
  },
  {
    name: 'Meeple Voyager Gnar',
    tier: 'S',
    carry: 'Gnar',
    playstyle: 'standard',
    rerollLevel: 8,
    core: ['Gnar', 'Bard', 'Corki', 'Rammus', 'Fizz', 'Meepsie', 'Poppy', 'The Mighty Mech', 'Jhin'],
    keyTraits: ['Meeple', 'Voyager', 'Sniper'],
    strategy: 'Standard 8 board with 7 Meeple (Bard, Corki, Rammus, Gnar, Fizz, Meepsie, Poppy) for the cloning slot and max meep empower. Gnar is the main Sniper carry alongside Jhin. Voyager (2) (Meepsie, The Mighty Mech) shields the transformed Mecha frontline.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['The Mighty Mech', 'Jhin'],
    winRate: 64.0,
    avgPlace: 3.65,
    pickRate: 5.6,
  },
  {
    name: 'N.O.V.A. Bastion Vex',
    tier: 'S',
    carry: 'Vex',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['Vex', 'Fiora', 'Graves', 'Shen', 'Blitzcrank', 'Nunu & Willump', 'Akali', 'Aatrox', 'Rhaast'],
    keyTraits: ['N.O.V.A.', 'Bastion', 'Vanguard'],
    strategy: 'Fast 9 highroll board stacking 5-cost legendaries (Vex, Fiora, Graves, Blitzcrank, Shen). N.O.V.A. (2) (Aatrox, Akali) power surge + Bastion (2) (Shen) + Vanguard (2) (Blitzcrank, Nunu) frontline. Vex\'s Doomer trait steals enemy AD/AP. Rhaast scales off the many active unique traits.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['Rhaast', 'Akali'],
    winRate: 63.5,
    avgPlace: 3.65,
    pickRate: 14.5,
  },
  {
    name: 'Turbo Doomer Vex',
    tier: 'S',
    carry: 'Vex',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['Vex', 'Nunu & Willump', 'Blitzcrank', 'Mordekaiser', 'Sona', 'Bard', 'Karma', 'Illaoi', 'Meepsie'],
    keyTraits: ['Doomer', 'Vanguard', 'Shepherd'],
    strategy: 'Fast 9 for Vex 2-star with Vanguard (4) tanky frontline (Nunu & Willump, Blitzcrank, Mordekaiser). Shepherd (3) (Sona, Illaoi, Meepsie) summons Bia to amplify the board. Sona\'s Commander mods boost Vex; Conduit (2) (Bard, Mordekaiser) for faster casts.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['Bard', 'Meepsie'],
    winRate: 62.0,
    avgPlace: 3.85,
    pickRate: 8.0,
  },
  {
    name: 'Eradicator Sniper Jhin',
    tier: 'S',
    carry: 'Jhin',
    playstyle: 'rush8',
    rerollLevel: 8,
    core: ['Jhin', 'Xayah', 'Nunu & Willump', 'Blitzcrank', 'Tahm Kench', 'Maokai', 'Jax', 'Aatrox', 'Rhaast'],
    keyTraits: ['Eradicator', 'Sniper', 'N.O.V.A.'],
    strategy: 'Fast 8 for Jhin 2-star. Eradicator shreds resistances so Jhin\'s 4th shot one-shots the backline. Sniper (2) (Jhin, Xayah) amps damage; N.O.V.A. (2) (Maokai, Aatrox) grants a power surge 6 seconds in. Frontline of Tahm Kench, Jax, Nunu & Willump keeps Jhin alive.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['Rhaast', 'Maokai'],
    winRate: 62.5,
    avgPlace: 3.75,
    pickRate: 11.0,
  },
  {
    name: 'Twin Blades Fiora',
    tier: 'S',
    carry: 'Fiora',
    playstyle: 'rush8',
    rerollLevel: 8,
    core: ['Fiora', 'Master Yi', 'Akali', 'Urgot', 'Kindred', 'Tahm Kench', 'Aatrox', 'Shen'],
    keyTraits: ['Divine Duelist', 'Marauder', 'N.O.V.A.'],
    strategy: 'Fast 8 for Fiora 2-star with 4 Marauder (Fiora, Master Yi, Akali, Urgot) omnivamp. Divine Duelist makes Fiora win every duel; Kindred adds Challenger backline access. Bastion (2) (Aatrox, Shen) frontline keeps the carries alive.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['Kindred', 'Tahm Kench'],
    winRate: 62.0,
    avgPlace: 3.85,
    pickRate: 7.5,
  },
  {
    name: 'Feed the Stars Jhin',
    tier: 'S',
    carry: 'Jhin',
    playstyle: 'rush8',
    rerollLevel: 8,
    core: ['Jhin', 'Karma', 'Kai\'Sa', 'Mordekaiser', 'Cho\'Gath', 'Aurelion Sol', 'The Mighty Mech', 'Nunu & Willump', 'Tahm Kench'],
    keyTraits: ['Dark Star', 'Mecha', 'Eradicator'],
    strategy: 'Fast 8 for Jhin 2-star with 4 Dark Star (Jhin, Karma, Kai\'Sa, Mordekaiser, Cho\'Gath) black hole. Mecha (3) via Aurelion Sol + The Mighty Mech (2×) gives a transformed frontline. Jhin\'s Eradicator shreds resistances; Karma adds AoE control.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['The Mighty Mech', 'Kai\'Sa'],
    winRate: 61.5,
    avgPlace: 3.85,
    pickRate: 9.0,
  },
  {
    name: 'Mirror Mayhem LeBlanc',
    tier: 'S',
    carry: 'LeBlanc',
    playstyle: 'rush8',
    rerollLevel: 8,
    core: ['LeBlanc', 'Lissandra', 'Sona', 'Leona', 'Nasus', 'Nunu & Willump', 'Morgana', 'Karma'],
    keyTraits: ['Shepherd', 'Arbiter', 'Vanguard'],
    strategy: 'Fast 8 for LeBlanc 2-star with Shepherd (3) (LeBlanc, Lissandra, Sona) summons. Arbiter (2) (LeBlanc, Leona) scribes a divine law for damage amp. Vanguard (2) (Leona, Nasus, Nunu) provides shield frontline. Morgana Dark Lady + Karma Voyager add control.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['Morgana', 'Karma'],
    winRate: 61.0,
    avgPlace: 3.9,
    pickRate: 6.5,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // A-TIER (11)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Vanguard Shepherd Nunu',
    tier: 'A',
    carry: 'Nunu & Willump',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['Nunu & Willump', 'Blitzcrank', 'Mordekaiser', 'Sona', 'Illaoi', 'Meepsie', 'Bard', 'Karma', 'Vex'],
    keyTraits: ['Vanguard', 'Shepherd', 'Doomer'],
    strategy: 'Fast 9 for Nunu & Willump 2-star with Vanguard (4) (Nunu, Blitzcrank, Mordekaiser) shield frontline. Shepherd (3) (Sona, Illaoi, Meepsie) summons Bia. Vex Doomer caps the board with massive AoE; Conduit (2) (Bard, Mordekaiser) speeds up casts.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['Bard', 'Meepsie'],
    winRate: 60.0,
    avgPlace: 3.82,
    pickRate: 13.5,
  },
  {
    name: 'Shepherd LeBlanc Rush 9',
    tier: 'A',
    carry: 'LeBlanc',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['LeBlanc', 'Sona', 'Illaoi', 'Meepsie', 'Lissandra', 'Karma', 'The Mighty Mech', 'Blitzcrank', 'Morgana'],
    keyTraits: ['Shepherd', 'Voyager', 'Vanguard'],
    strategy: 'Fast 9 for LeBlanc 2-star with 5 Shepherd (LeBlanc, Sona, Illaoi, Meepsie, Lissandra) for max summons. Voyager (3) (Karma, Meepsie, The Mighty Mech) shields the frontline. Morgana Dark Lady + Blitzcrank Vanguard add control and a hook.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['Morgana', 'The Mighty Mech'],
    winRate: 60.0,
    avgPlace: 3.93,
    pickRate: 9.5,
  },
  {
    name: 'Shepherd Vanguard LeBlanc',
    tier: 'A',
    carry: 'LeBlanc',
    playstyle: 'standard',
    rerollLevel: 8,
    core: ['LeBlanc', 'Sona', 'Illaoi', 'Meepsie', 'Lissandra', 'Nunu & Willump', 'Blitzcrank', 'Leona', 'Karma'],
    keyTraits: ['Shepherd', 'Vanguard', 'Arbiter'],
    strategy: 'Standard level 8 board with 5 Shepherd (LeBlanc, Sona, Illaoi, Meepsie, Lissandra) for max summons + 4 Vanguard (Nunu, Blitzcrank, Leona) shield frontline. Arbiter (2) (LeBlanc, Leona) amps damage. Karma adds Voyager (2) shields.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['Karma', 'Meepsie'],
    winRate: 59.5,
    avgPlace: 3.98,
    pickRate: 4.0,
  },
  {
    name: 'Space Groove Samira Reroll',
    tier: 'A',
    carry: 'Samira',
    playstyle: 'reroll',
    rerollLevel: 7,
    core: ['Samira', 'Ornn', 'Nami', 'Nasus', 'Blitzcrank', 'Jhin', 'Shen'],
    keyTraits: ['Space Groove', 'Sniper', 'Bastion'],
    strategy: 'Slow roll at 7 for Samira 3-star (and Ornn 3-star). 5 Space Groove (Samira, Ornn, Nami, Nasus, Blitzcrank) for groove bonuses. Sniper (2) (Samira, Jhin) amplifies Samira\'s DPS. Bastion (2) (Ornn, Shen) + Vanguard (2) (Nasus, Blitzcrank) frontline.',
    difficulty: 'Easy',
    threeStarTargets: ['Samira', 'Ornn'],
    traitBots: ['Blitzcrank', 'Jhin'],
    winRate: 60.0,
    avgPlace: 3.7,
    pickRate: 9.0,
  },
  {
    name: 'Primordian Challenger Reroll',
    tier: 'A',
    carry: 'Jinx',
    playstyle: 'reroll',
    rerollLevel: 6,
    core: ['Jinx', 'Bel\'Veth', 'Briar', 'Rek\'Sai', 'Kindred', 'Akali', 'Maokai', 'Rhaast'],
    keyTraits: ['Primordian', 'Challenger', 'Marauder'],
    strategy: 'Slow roll at 6 for Jinx 3-star (and Briar / Rek\'Sai). Primordian (3) (Bel\'Veth, Briar, Rek\'Sai) spawns Swarmlings. Challenger (3) (Bel\'Veth, Jinx, Kindred) for attack-speed dashing. Marauder (2) (Akali, Bel\'Veth) adds omnivamp. Rhaast scales off trait count.',
    difficulty: 'Easy',
    threeStarTargets: ['Jinx', 'Briar'],
    traitBots: ['Rhaast', 'Kindred'],
    winRate: 58.0,
    avgPlace: 4.2,
    pickRate: 15.0,
  },
  {
    name: 'Dark Star Karma Control',
    tier: 'A',
    carry: 'Karma',
    playstyle: 'standard',
    rerollLevel: 8,
    core: ['Karma', 'Jhin', 'Kai\'Sa', 'Mordekaiser', 'Cho\'Gath', 'Aurelion Sol', 'The Mighty Mech', 'Nunu & Willump', 'Tahm Kench'],
    keyTraits: ['Dark Star', 'Mecha', 'Voyager'],
    strategy: 'Standard level 8 board with 4 Dark Star (Karma, Kai\'Sa, Mordekaiser, Cho\'Gath, Jhin) black hole. Mecha (3) via Aurelion Sol + The Mighty Mech (2×) transform frontline. Voyager (2) (Karma, The Mighty Mech) shields tanks. Karma deletes the backline.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['The Mighty Mech', 'Kai\'Sa'],
    winRate: 58.5,
    avgPlace: 4.1,
    pickRate: 8.5,
  },
  {
    name: 'N.O.V.A. Vex Fast 9',
    tier: 'A',
    carry: 'Vex',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['Vex', 'Aatrox', 'Akali', 'Maokai', 'Fiora', 'Shen', 'Graves', 'Tahm Kench', 'Morgana'],
    keyTraits: ['N.O.V.A.', 'Bastion', 'Doomer'],
    strategy: 'Fast 9 highroll board with Vex Doomer carry. N.O.V.A. (2) (Aatrox, Akali) power surge + Bastion (2) (Aatrox, Shen) frontline. Graves Factory New + Fiora Divine Duelist + Morgana Dark Lady stack unique-trait power that amplifies the board. Tahm Kench adds Brawler frontline.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['Morgana', 'Maokai'],
    winRate: 60.0,
    avgPlace: 3.7,
    pickRate: 4.5,
  },
  {
    name: 'Space Groove Nami Standard',
    tier: 'A',
    carry: 'Nami',
    playstyle: 'standard',
    rerollLevel: 8,
    core: ['Nami', 'Blitzcrank', 'Ornn', 'Gwen', 'Riven', 'Tahm Kench', 'Pantheon', 'Shen', 'Nunu & Willump'],
    keyTraits: ['Space Groove', 'Vanguard', 'Rogue'],
    strategy: 'Standard level 8 board with 3 Space Groove (Nami, Blitzcrank, Ornn, Gwen) for base groove. Nami Replicator echoes abilities; Rogue (2) (Riven, Gwen) provides backline access. Vanguard (2) (Blitzcrank, Nunu) + Brawler (2) (Tahm Kench, Pantheon) frontline; Shen Bulwark protects.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['Shen', 'Pantheon'],
    winRate: 58.5,
    avgPlace: 4.1,
    pickRate: 9.0,
  },
  {
    name: 'Mecha Dark Star Fiora',
    tier: 'A',
    carry: 'Fiora',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['Fiora', 'Aurelion Sol', 'The Mighty Mech', 'Urgot', 'Karma', 'Mordekaiser', 'Blitzcrank', 'Tahm Kench'],
    keyTraits: ['Mecha', 'Dark Star', 'Marauder'],
    strategy: 'Fast 9 for Fiora 2-star with 4 Mecha (Aurelion Sol, The Mighty Mech (2×), Urgot) transform frontline. Dark Star (2) (Karma, Mordekaiser) black hole. Marauder (2) (Fiora, Urgot) omnivamp. Blitzcrank Vanguard + Tahm Kench Brawler frontline.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['Blitzcrank', 'Tahm Kench'],
    winRate: 58.5,
    avgPlace: 4.05,
    pickRate: 7.5,
  },
  {
    name: 'Challenger Takeover Miss Fortune',
    tier: 'A',
    carry: 'Miss Fortune',
    playstyle: 'reroll',
    rerollLevel: 7,
    core: ['Miss Fortune', 'Diana', 'Bel\'Veth', 'Kindred', 'Ornn', 'Leona', 'Maokai'],
    keyTraits: ['Challenger', 'Arbiter', 'N.O.V.A.'],
    strategy: 'Slow roll at 7 for Miss Fortune 3-star with Gun Goddess → Challenger mode. Challenger (4) (MF, Diana, Bel\'Veth, Kindred) for max attack-speed dashing. Arbiter (2) (Diana, Leona) amps damage; N.O.V.A. (2) (Kindred, Maokai) power surge. Ornn tanks.',
    difficulty: 'Medium',
    threeStarTargets: ['Miss Fortune', 'Diana'],
    traitBots: ['Ornn', 'Maokai'],
    winRate: 57.5,
    avgPlace: 4.3,
    pickRate: 6.5,
  },
  {
    name: 'Shepherd Voyager Viktor',
    tier: 'A',
    carry: 'Viktor',
    playstyle: 'standard',
    rerollLevel: 8,
    core: ['Viktor', 'Mordekaiser', 'Illaoi', 'Meepsie', 'Lissandra', 'Pyke', 'Nami', 'Rhaast'],
    keyTraits: ['Shepherd', 'Voyager', 'Conduit'],
    strategy: 'Standard level 8 board with Shepherd (3) (Illaoi, Meepsie, Lissandra) summons + Voyager (2) (Meepsie, Pyke) shields on tanks (Illaoi, Mordekaiser). Conduit (2) (Viktor, Mordekaiser) for fast Viktor casts. Nami Replicator echoes Viktor\'s Psionic Storm.',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['Rhaast', 'Nami'],
    winRate: 57.5,
    avgPlace: 4.2,
    pickRate: 4.5,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // B-TIER (5)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Dark Star Cho\'Gath Reroll',
    tier: 'B',
    carry: 'Lissandra',
    playstyle: 'reroll',
    rerollLevel: 6,
    core: ['Cho\'Gath', 'Lissandra', 'Karma', 'Kai\'Sa', 'Mordekaiser', 'Jhin', 'Pantheon', 'The Mighty Mech', 'Ezreal'],
    keyTraits: ['Dark Star', 'Brawler', 'Voyager'],
    strategy: 'Slow roll at 6 for Cho\'Gath + Lissandra 3-stars. 6 Dark Star (Cho\'Gath, Lissandra, Karma, Kai\'Sa, Mordekaiser, Jhin) for the big black hole. Brawler (2) (Cho\'Gath, Pantheon) frontline. Voyager (2) (Karma, The Mighty Mech) shields tanks. The Mighty Mech + Ezreal add late-game scaling.',
    difficulty: 'Easy',
    threeStarTargets: ['Cho\'Gath', 'Lissandra'],
    traitBots: ['The Mighty Mech', 'Ezreal'],
    winRate: 55.5,
    avgPlace: 4.3,
    pickRate: 6.5,
  },
  {
    name: 'Meeple Corki Fast 9',
    tier: 'B',
    carry: 'Corki',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['Corki', 'Bard', 'Rammus', 'Fizz', 'Meepsie', 'Milio', 'The Mighty Mech', 'Riven', 'Shen'],
    keyTraits: ['Meeple', 'Voyager', 'Bastion'],
    strategy: 'Fast 9 for Corki 2-star with 5 Meeple (Corki, Bard, Rammus, Fizz, Meepsie) for cloning bonuses. Voyager (2) (Meepsie, The Mighty Mech) shields the transformed Mecha frontline. Bastion (2) (Rammus, Shen) + Rogue (2) (Riven, Fizz) round out the board. Fateweaver (2) (Corki, Milio) makes Corki\'s rockets Lucky.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['The Mighty Mech', 'Riven'],
    winRate: 55.5,
    avgPlace: 4.3,
    pickRate: 7.0,
  },
  {
    name: 'Brawler Marauder Master Yi',
    tier: 'B',
    carry: 'Master Yi',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['Master Yi', 'Urgot', 'Bel\'Veth', 'Fiora', 'Tahm Kench', 'Maokai', 'Gragas', 'Kindred', 'Rhaast'],
    keyTraits: ['Brawler', 'Marauder', 'Challenger'],
    strategy: 'Fast 9 for Master Yi 2-star with 4 Brawler (Tahm Kench, Maokai, Urgot, Gragas) HP scaling + 4 Marauder (Master Yi, Urgot, Bel\'Veth, Fiora) omnivamp. Challenger (2) (Bel\'Veth, Kindred) for attack speed. Fiora Divine Duelist + Rhaast cap the board.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['Rhaast', 'Fiora'],
    winRate: 55.0,
    avgPlace: 4.35,
    pickRate: 8.5,
  },
  {
    name: 'Invader Zed',
    tier: 'B',
    carry: 'Zed',
    playstyle: 'rush9',
    rerollLevel: 9,
    core: ['Zed', 'Vex', 'Sona', 'Karma', 'Bard', 'Nunu & Willump', 'Blitzcrank', 'Tahm Kench'],
    keyTraits: ['Galaxy Hunter', 'Doomer', 'Vanguard'],
    strategy: 'Requires the Invader Zed augment. Rush 9 for Zed 2-star; Galaxy Hunter clones spread buffs across the board. Sona\'s Commander mods amplify Zed; Vex Doomer adds AoE cleanup. Vanguard (2) (Nunu & Willump, Blitzcrank) frontline protects Zed while clones multiply.',
    difficulty: 'Hard',
    threeStarTargets: [],
    traitBots: ['Bard', 'Vex'],
    winRate: 54.5,
    avgPlace: 4.5,
    pickRate: 3.0,
  },
  {
    name: 'Stargazer Timebreaker Reroll',
    tier: 'B',
    carry: 'Lulu',
    playstyle: 'standard',
    rerollLevel: 8,
    core: ['Lulu', 'Twisted Fate', 'Jax', 'Milio', 'Pantheon', 'Riven', 'Aatrox', 'Corki', 'Maokai'],
    keyTraits: ['Stargazer', 'Timebreaker', 'Bastion'],
    strategy: 'Standard level 8 board with 3 Stargazer (Lulu, Jax, Twisted Fate) empowered hexes + 3 Timebreaker (Milio, Pantheon, Riven) attack speed on loss. Bastion (2) (Jax, Aatrox) frontline. Corki adds Fateweaver (2); Lulu Replicator echoes abilities. Maokai rounds out N.O.V.A. (2).',
    difficulty: 'Medium',
    threeStarTargets: [],
    traitBots: ['Corki', 'Riven'],
    winRate: 54.5,
    avgPlace: 4.35,
    pickRate: 6.5,
  },
];

/** Name → Comp lookup. */
export const COMP_MAP: Record<string, Comp> = Object.fromEntries(
  COMPS.map((c) => [c.name, c]),
);

// ─── Playstyle metadata ──

export interface PlaystyleInfo {
  label: string;
  desc: string;
  color: string;
  targetLevel: string;
}

export const PLAYSTYLE_INFO: Record<CompPlaystyle, PlaystyleInfo> = {
  reroll: {
    label: 'Reroll',
    desc: 'Slow roll at low level for 3-star carries',
    color: '#22c55e',
    targetLevel: '6-7',
  },
  rush8: {
    label: 'Rush 8',
    desc: 'Fast 8 for 4-cost carries',
    color: '#f59e0b',
    targetLevel: '8',
  },
  rush9: {
    label: 'Rush 9',
    desc: 'Fast 9 for 5-cost legendaries',
    color: '#ef4444',
    targetLevel: '9',
  },
  standard: {
    label: 'Standard',
    desc: 'Balanced leveling and rolling',
    color: '#3b82f6',
    targetLevel: '8',
  },
};

// ─── Difficulty metadata ──

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; desc: string; color: string }> = {
  Easy:   { label: 'Kolay',  desc: 'Reroll at L6-L7, basit karar ağacı',     color: '#22c55e' },
  Medium: { label: 'Orta',   desc: 'L8 standard roll, pozisyonlama önemli',  color: '#f59e0b' },
  Hard:   { label: 'Zor',    desc: 'L9 rush veya tempo pivot, ekonomi yönetimi', color: '#ef4444' },
};

// ─── Helpers ──

/** Get a comp by name (case-insensitive). */
export function getComp(name: string): Comp | undefined {
  return COMPS.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

/** Return all comps of the given tier. */
export function getCompsByTier(tier: Comp['tier']): Comp[] {
  return COMPS.filter((c) => c.tier === tier);
}

/** Return all comps that include the given champion as a core member. */
export function getCompsForChampion(champion: string): Comp[] {
  return COMPS.filter((c) => c.core.includes(champion));
}

/** Return comps sorted by tier (S → A → B) then win rate (desc). */
export function getSortedComps(): Comp[] {
  const tierRank: Record<Comp['tier'], number> = { S: 0, A: 1, B: 2 };
  return [...COMPS].sort((a, b) => {
    if (tierRank[a.tier] !== tierRank[b.tier]) {
      return tierRank[a.tier] - tierRank[b.tier];
    }
    return b.winRate - a.winRate;
  });
}
