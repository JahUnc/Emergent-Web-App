/**
 * @file Builds the systems map: which shared state each system reads and which it changes, found by
 * scanning the system's own code, plus the feedback loops that run through them. Writes src/data/systems.json.
 *
 * How it works:
 *  - SYSTEMS lists every system, the tick phase it runs in, and the code that makes it up (whole files,
 *    or single methods when one file holds two systems).
 *  - STATE lists what systems share (energy, food, relationships, shelters...) with the code patterns that
 *    read it and the patterns that change it.
 *  - Comments and string contents are stripped first, so a system only counts as reading something its
 *    code actually touches. Each link keeps the line that created it, so the site can show it.
 *  - LOOPS are chains written in plain language. Every hop must exist in the scanned graph or this script
 *    throws, so a loop can never describe a connection the code no longer has.
 *
 * Usage: node tools/systems-map.mjs <repo root> <output file>
 */

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { methodSpan, readLines, stripLine } from './lib/csharp.mjs';

const PHASES = ['Basic needs', 'Social', 'Upkeep', 'Ownership', 'Cleanup'];

/**
 * key: [label, phase index, sources, plain description, test files].
 * A source is [file, method or null for the whole file, methods to leave out, line filter or null].
 */
const SYSTEMS = {
  shelterSeeking: ['Shelter seeking', 0, [['Systems/ShelterSeeking.cs', null, [], null]],
    'A chilled entity steps toward a shelter it can see or remembers, unless hunger is worse.', ['ShelterTests.cs', 'SightTests.cs']],
  movement: ['Movement', 0, [['Systems/MovementSystem.cs', null, [], null]],
    'Scores the 8 neighbors by food, friends and rivals and steps to the best one.', ['FriendPullTests.cs', 'SightTests.cs', 'ImpulsivenessTests.cs']],
  gathering: ['Gathering and building', 0, [['Systems/GatheringSystem.cs', null, [], null]],
    'Cuts a full tree and carries the wood to a shelter its group owns, then builds.', ['GatheringTests.cs']],
  farming: ['Farming', 0, [['Systems/FarmingSystem.cs', null, ['Decay'], null]],
    'Works the ground under an entity to raise what the cell can grow.', ['FarmingSystemTests.cs', 'FarmingTests.cs']],
  conflict: ['Conflict', 0, [['Systems/ConflictSystem.cs', null, [], null]],
    'A desperate entity in a crowded, foodless cell may attack someone to eat.', ['ConflictTests.cs', 'StrengthTests.cs']],
  feeding: ['Feeding', 0, [['Systems/FeedingSystem.cs', null, [], null]],
    'Hungry entities eat from their cell until full, in turn order.', ['HungerTests.cs', 'SatiationTests.cs', 'SharedFoodTests.cs']],
  relationships: ['Relationships', 1, [['Social/RelationshipSystem.cs', null, [], null]],
    'Pairs fed side by side grow closer; those who went short resent cellmates who ate.', ['RelationshipTests.cs']],
  grudges: ['Grudges', 1, [['Social/GrudgeSystem.cs', null, [], null]],
    'Killings between groups leave grudges that sour relationships and fade over time.', ['GrudgeTests.cs']],
  groupTags: ['Group tags', 1, [['Social/GroupTagSystem.cs', null, [], null]],
    'Entities drift into the group most of their friends belong to.', ['GroupTagTests.cs']],
  mating: ['Mating', 1, [['Systems/ReproductionSystem.cs', null, ['TryDeliver', 'TryChooseBirthPosition'], null]],
    'Willing pairs within 1 cell who are not close kin try to conceive.', ['ConceptionTests.cs', 'MaturityTests.cs', 'KinshipTests.cs', 'EntityTraitsTests.cs']],
  birth: ['Birth', 2, [['Systems/ReproductionSystem.cs', 'TryDeliver', [], null], ['Systems/ReproductionSystem.cs', 'TryChooseBirthPosition', [], null], ['Engine/Simulation.cs', 'DeliverIfDue', [], null]],
    'A due mother gives birth into a nearby cell with room.', ['GestationTests.cs', 'CellLimitTests.cs']],
  upkeep: ['Metabolism and aging', 2, [['Systems/UpkeepSystem.cs', null, [], null]],
    'Every entity pays its energy upkeep and ages a tick.', ['EntityTest.cs']],
  warmth: ['Warmth', 2, [['Systems/WarmthSystem.cs', null, [], null]],
    'Warmth drains outside in the cold and recovers in shelter or mild weather.', ['WarmthTests.cs', 'ClimateTests.cs']],
  shelterMemory: ['Shelter memory', 2, [['Engine/Simulation.cs', 'RunUpkeep', [], /Shelters\.IsShelter|RememberShelter/]],
    'An entity standing in a shelter remembers where it is.', ['ShelterTests.cs']],
  ownership: ['Shelter ownership', 3, [['Social/ShelterOwnership.cs', null, [], null]],
    'A group that keeps standing in a shelter takes ownership of it.', ['ShelterOwnershipTests.cs']],
  deaths: ['Deaths', 4, [['Engine/Simulation.cs', 'RemoveDead', [], null]],
    'The dead are removed and counted by cause.', ['SimulationTests.cs']],
  regrowth: ['Regrowth', 4, [['Engine/Simulation.cs', 'RegrowWorld', [], null]],
    'Food and trees grow back, farmland wears down, worn-out built shelter goes back to soil.', ['ForestTests.cs', 'CellTest.cs']],
};

const NOT_ASSIGN = String.raw`(?!\s*[-+*/]?=(?!=))`;
const ASSIGN = String.raw`\s*(?:[-+*/]?=(?!=)|\+\+|--)`;
const r = (...parts) => new RegExp(parts.join(''));

/** key: [label, group, read patterns, write patterns, plain description]. Earlier patterns are preferred as evidence. */
const STATE = {
  energy: ['Energy', 'Body', [r(String.raw`\.Energy\b`, NOT_ASSIGN), /\bMaxEnergy\b/],
    [/\.(Eat|Metabolize|TrySpendEnergy|PayAttackCostAndEat|TryMove)\(/],
    'How much an entity has left. Spent on moving, working and having children; refilled by eating.'],
  age: ['Age', 'Body', [r(String.raw`\.Age\b`, NOT_ASSIGN), /\bMaxAge\b/], [/\.AdvanceAge\(/],
    'Ticks lived. Gates mating and shapes strength.'],
  traits: ['Traits and strength', 'Body', [/\.Traits\b/, /StrengthRules\.(Current|MoveCostMultiplier)/],
    [/InheritTraits\(/, /StrengthRules\.Inherit\(/],
    'Inherited max energy, lifespan, impulsiveness and strength potential.'],
  warmthState: ['Body warmth', 'Body', [r(String.raw`\.Warmth\b`, NOT_ASSIGN), r(String.raw`\bIsWarming\b`, NOT_ASSIGN), /_warmth\.\w+\(/],
    [/\.(Chill|Warm)\(/, r(String.raw`\bIsWarming`, ASSIGN)],
    'From 0 to 100. Zero means death from cold.'],
  hunger: ['Hunger and meals', 'Body', [r(String.raw`\bIsRefilling\b`, NOT_ASSIGN), /_feeding\.\w+\(/, /\bIsFed\(/, /\bRecordMeal\(/, /\bFeedingOutcome\b/],
    [r(String.raw`\bIsRefilling`, ASSIGN), /new FeedingOutcome\b/],
    'Whether an entity is hungry, refilling, or got its meal this tick.'],
  fights: ['Desperation and fights', 'Body', [r(String.raw`\bTicksDesperate\b`, NOT_ASSIGN), r(String.raw`\bWeakenedUntilTick\b`, NOT_ASSIGN), /\.IsKilled\b/],
    [r(String.raw`\b(TicksDesperate|WeakenedUntilTick)`, ASSIGN), /\.MarkKilled\(/],
    'How long an entity has been starving, and who was killed or weakened in a fight.'],
  position: ['Position and crowding', 'World', [/\.X\b/, /\.Y\b/, /GetEntitiesAt\(/, /Count(Living)?At\(/, /\.(Eat|PayAttackCostAndEat)\(/],
    [/\.TryMove\(/, /_occupancy\.(Move|Add|Remove)\(/],
    'Which cell each entity stands in and how crowded each cell is.'],
  food: ['Food', 'World', [/\.Food\b/, /\.FoodCapacity\b/, /\.(Eat|PayAttackCostAndEat)\(/],
    [/\.Consume\(/, /\.Eat\(/, /PayAttackCostAndEat\(/, /Grid\.Regrow\(/],
    'What each cell holds right now.'],
  farmland: ['Farmland and soil', 'World', [/\.IsFarmed\b/, /\bNaturalCapacity\b/, /\bFertileCapacity\b/, /\.IsBarren\b/, /Grid\.Regrow\(/],
    [/\.Farm\(/, /\.Decay\(capacityLoss/, /_farming\.Decay\(/, /\.RestoreFertility\(/, /\.MakeBarren\(/],
    'What each cell can grow: raised by farming, lost under shelters, worn down over time.'],
  climate: ['Temperature', 'World', [/\b(ColdnessAt|TemperatureAt)\(/], [],
    'Set by the season and how far north a row is. Nothing in the sim changes it.'],
  trees: ['Trees', 'World', [/\b(IsTree|IsFull|WoodAt)\(/], [/_forest\.Cut\(|\.Cut\(/, /Forest\.Regrow\(/],
    'Wood on the map. A full tree holds 10 and regrows after it is cut.'],
  shelters: ['Shelters', 'Shelter', [/\b(IsShelter|ShelterAt|IsBuilt)\(/, /\.Locations\b/],
    [/_shelters\.Build\(|\.Build\(\w+, /, /RemoveWornOut\(/],
    'Natural shelters plus the cells built onto them.'],
  shelterMemoryState: ['Known shelters', 'Shelter', [/\bKnownShelters\b/], [/\.RememberShelter\(/],
    'Every shelter an entity has stood in. Newborns inherit their mother\'s.'],
  ownershipState: ['Shelter owners', 'Shelter', [/\b(OwnerOf|PresenceOf)\(/], [r(String.raw`_owners\[[^\]]+\]`, ASSIGN), /_owners\.(Remove|Clear)\(/],
    'Which group holds each shelter.'],
  wood: ['Carried wood', 'Shelter', [r(String.raw`\bCarriedWood\b`, NOT_ASSIGN), r(String.raw`\bWoodForShelter\b`, NOT_ASSIGN)],
    [r(String.raw`\b(CarriedWood|WoodForShelter)`, ASSIGN)],
    'Wood in an entity\'s hands and the shelter it is meant for.'],
  relationshipsState: ['Relationships', 'Social', [/_relationships\.Get\(|Map\.Get\(|_map\.Get\(|relationships\.Get\(/, /\.PartnersOf\(/],
    [/\.Adjust\(/, /Map\.Decay\(/, /\.RemoveEntity\(/],
    'How much each pair likes or resents each other.'],
  grudgesState: ['Grudges', 'Social', [/Ledger\.Get\(/, /_grudges\.Threat\(/], [/Ledger\.(Add|Fade)\(/, /_grudges\??\.RecordKilling\(/],
    'How much each group holds against each other group.'],
  tags: ['Group tags', 'Social', [r(String.raw`\.GroupTag\b`, NOT_ASSIGN)], [r(String.raw`\.GroupTag`, ASSIGN)],
    'The group each entity feels it belongs to.'],
  pregnancy: ['Pregnancy', 'Family', [/\bIsPregnant\b/, /\.Pregnancy\b/, /\bLastBirthTick\b/],
    [/\.BeginPregnancy\(/, /\.EndPregnancy\(/, /\.RecordBirth\(/],
    'Who is carrying a child, when it is due, and when each parent last conceived.'],
  lineage: ['Family tree', 'Family', [/\b(AreCloseKin|AreDistantKin|AreCousins|AreAuntOrUncle)\(/, /[Ll]ineage\.TryGet\(/],
    [/[Ll]ineage\.Add\(/, /[Ll]ineage\.RecordKilling\(/],
    'Every entity that ever lived and who its parents were.'],
  population: ['Population', 'Family', [/\bpopulation\b/, /_entities\.Count\b/], [/_entities\.(Add|RemoveAt)\(/],
    'Who is alive. Births add to it and deaths take away.'],
};

/** When one system asks another for a decision, the asked system guides the asking one. key: call pattern. */
const GUIDES = {
  shelterSeeking: /_shelterSeeking\??\./,
  gathering: /_gathering\??\./,
  grudges: /_grudges\??\.Threat\(/,
  feeding: /_feeding\??\./,
  warmth: /_warmth\??\./,
};

/** Feedback loops: [title, plain story, hops]. Every hop must exist in the scanned graph. */
const LOOPS = [
  ['Friends gather where food is',
    'Entities that eat well side by side grow closer. Content entities move toward friends, so friends end up eating at the same cells, which keeps the friendship going until the food runs short.',
    [['feeding', 'hunger'], ['hunger', 'relationships'], ['relationships', 'relationshipsState'], ['relationshipsState', 'movement'], ['movement', 'position'], ['position', 'feeding']]],
  ['Crowding turns into feuds',
    'Crowded cells run out of food. A desperate entity attacks, the killing leaves a grudge between groups, and grudges push groups away from each other when they move.',
    [['food', 'conflict'], ['conflict', 'fights'], ['conflict', 'grudgesState'], ['grudgesState', 'grudges'], ['grudges', 'movement'], ['movement', 'position'], ['position', 'conflict']]],
  ['Friendship becomes territory',
    'Friends pull each other into the same group. A group that keeps standing in a shelter owns it, and only members of an owning group gather wood to build it out.',
    [['relationshipsState', 'groupTags'], ['groupTags', 'tags'], ['tags', 'ownership'], ['ownership', 'ownershipState'], ['ownershipState', 'gathering'], ['gathering', 'shelters']]],
  ['Building trades food for warmth',
    'Built shelter cells keep entities warm, but they grow no food until they wear out. More shelter means fewer cold deaths and less to eat nearby.',
    [['gathering', 'shelters'], ['gathering', 'farmland'], ['shelters', 'warmth'], ['warmth', 'warmthState'], ['farmland', 'regrowth'], ['regrowth', 'food']]],
  ['The cold sends entities home',
    'Temperature drains warmth outside of shelters. A chilled entity heads for a shelter it remembers, and standing in one adds it to the shelters it knows, which its children inherit.',
    [['climate', 'warmth'], ['warmth', 'warmthState'], ['warmthState', 'shelterSeeking'], ['shelterMemoryState', 'shelterSeeking'], ['shelterSeeking', 'movement'], ['movement', 'position'], ['position', 'shelterMemory'], ['shelterMemory', 'shelterMemoryState'], ['shelterMemoryState', 'birth']]],
  ['More mouths, less food',
    'Fed entities have the energy to have children. Every birth is another mouth at the same cells, and food per entity falls until starvation balances births.',
    [['energy', 'mating'], ['mating', 'pregnancy'], ['pregnancy', 'birth'], ['birth', 'population'], ['birth', 'position'], ['position', 'feeding'], ['feeding', 'food'], ['feeding', 'energy']]],
];

/**
 * Gets [file, line number, code without comments, original text] for one source spec.
 * @param {string} core The Core project folder.
 * @param {Array} spec [file, method, exclude, line filter].
 * @returns {Array<[string, number, string, string]>} The source lines.
 */
function sourceLines(core, [file, method, exclude, lineFilter]) {
  const raw = readLines(join(core, file));
  let keep = new Set(raw.map((_, i) => i));
  if (method) {
    const { start, end } = methodSpan(raw, method);
    keep = new Set(Array.from({ length: end - start + 1 }, (_, i) => start + i));
  }
  for (const name of exclude) {
    const { start, end } = methodSpan(raw, name);
    for (let i = start; i <= end; i++) keep.delete(i);
  }
  return [...keep].sort((a, b) => a - b).flatMap((i) => {
    const code = stripLine(raw[i]);
    if (!code.trim() || (lineFilter && !lineFilter.test(code))) return [];
    return [[file.split('/').pop(), i + 1, code, raw[i].trim()]];
  });
}

/**
 * Returns up to two matching lines as evidence, preferring earlier patterns in the list.
 * @param {Array} lines Source lines from sourceLines.
 * @param {RegExp[]} patterns Patterns in order of preference.
 * @returns {Array<{file: string, line: number, text: string}>} The evidence.
 */
function find(lines, patterns) {
  const hits = [];
  for (const pattern of patterns) {
    for (const [file, number, code, text] of lines) {
      if (pattern.test(code) && !hits.some((h) => h.line === number && h.file === file)) {
        hits.push({ file, line: number, text: text.slice(0, 160) });
        if (hits.length === 2) return hits;
      }
    }
  }
  return hits;
}

/**
 * Scans the source tree and builds the systems map.
 * @param {string} root The repository root.
 * @returns {object} The systems map data.
 */
export function buildSystemsMap(root) {
  const core = join(root, 'EmergentSociety.Core');
  const testsFolder = join(root, 'EmergentSociety.Core.Test');
  const edges = [];
  const matrix = {};
  const codeOf = {};

  for (const [key, [, , sources]] of Object.entries(SYSTEMS)) {
    const lines = sources.flatMap((spec) => sourceLines(core, spec));
    codeOf[key] = lines;
    const reads = [];
    const writes = [];
    for (const [state, [, , readPatterns, writePatterns]] of Object.entries(STATE)) {
      const w = find(lines, writePatterns);
      const rd = find(lines, readPatterns);
      if (w.length) { writes.push(state); edges.push({ from: key, to: state, kind: 'writes', evidence: w }); }
      if (rd.length) { reads.push(state); edges.push({ from: state, to: key, kind: 'reads', evidence: rd }); }
    }
    matrix[key] = { reads, writes, guides: [] };
  }

  for (const key of Object.keys(SYSTEMS)) {
    for (const [other, pattern] of Object.entries(GUIDES)) {
      if (other === key) continue;
      const hits = find(codeOf[key], [pattern]);
      if (hits.length) {
        edges.push({ from: other, to: key, kind: 'guides', evidence: hits });
        matrix[other].guides.push(key);
      }
    }
  }

  const edgeSet = new Set(edges.map((e) => `${e.from}>${e.to}`));
  for (const [title, , hops] of LOOPS) {
    for (const [a, b] of hops) {
      if (!edgeSet.has(`${a}>${b}`)) throw new Error(`Loop "${title}": the code no longer has the link ${a} -> ${b}`);
    }
  }

  for (const [key, system] of Object.entries(SYSTEMS)) {
    for (const file of system[4]) {
      if (!existsSync(join(testsFolder, file))) throw new Error(`System ${key}: test file ${file} not found`);
    }
  }

  return {
    phases: PHASES,
    systems: Object.entries(SYSTEMS).map(([key, [label, phase, sources, desc, tests]]) => ({
      key, label, phase, desc, tests,
      files: [...new Set(sources.map((s) => s[0].split('/').pop()))].sort(),
      ...matrix[key],
    })),
    state: Object.entries(STATE).map(([key, [label, group, , , desc]]) => ({ key, label, group, desc })),
    edges,
    loops: LOOPS.map(([title, story, hops]) => ({ title, story, hops })),
  };
}

if (process.argv[1]?.endsWith('systems-map.mjs')) {
  const [root, out] = process.argv.slice(2);
  const data = buildSystemsMap(root);
  writeFileSync(out, JSON.stringify(data));
  console.log(`Wrote ${out}: ${data.systems.length} systems, ${data.state.length} kinds of state, ${data.edges.length} links, ${data.loops.length} loops`);
}
