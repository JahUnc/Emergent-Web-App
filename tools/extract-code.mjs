/**
 * @file Pulls the code, settings docs, entity state docs, and test names the explainer shows straight
 * out of the Emergent Society source tree and writes them to src/data/code.json.
 *
 * Methods are found by name, not line number, so the extract keeps working as files change. Every
 * highlight anchor is a piece of text that must appear on exactly one line of its method: if a rule is
 * rewritten and an anchor stops matching, this script throws instead of quietly pointing at the wrong line.
 *
 * Usage: node tools/extract-code.mjs <repo root> <output file>
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { includeDocComment, methodSpan, readLines, summaryBefore } from './lib/csharp.mjs';

/** Which methods the site can show: key -> [file under Core, method name]. */
const METHODS = {
  step: ['Engine/Simulation.cs', 'Step'],
  relUpdate: ['Social/RelationshipSystem.cs', 'Update'],
  bond: ['Social/RelationshipSystem.cs', 'BondWithFedNeighbors'],
  resent: ['Social/RelationshipSystem.cs', 'ResentCellmatesWhoAte'],
  tryConceive: ['Systems/ReproductionSystem.cs', 'TryConceive'],
  isAvailable: ['Systems/ReproductionSystem.cs', 'IsAvailable'],
  wants: ['Systems/ReproductionSystem.cs', 'WantsToReproduce'],
  recovered: ['Systems/ReproductionSystem.cs', 'IsRecovered'],
  findPartners: ['Systems/ReproductionSystem.cs', 'FindPartners'],
  chanceFor: ['Systems/ReproductionSystem.cs', 'ConceptionChanceFor'],
  deliver: ['Systems/ReproductionSystem.cs', 'TryDeliver'],
  deliverIfDue: ['Engine/Simulation.cs', 'DeliverIfDue'],
  inherit: ['Systems/ReproductionSystem.cs', 'InheritTraits'],
  closeKin: ['Entities/LineageRegistry.cs', 'AreCloseKin'],
  distantKin: ['Entities/LineageRegistry.cs', 'AreDistantKin'],
};

/** The line to highlight for each case: key -> [method key, text that appears on exactly that line]. */
const ANCHORS = {
  ready: ['tryConceive', 'mother.BeginPregnancy('],
  justMature: ['wants', 'entity.Age >= _settings.MaturityAge'],
  young: ['wants', 'entity.Age >= _settings.MaturityAge'],
  lowEnergy: ['wants', 'entity.Energy >= _settings.ReproductionThreshold'],
  recovering: ['recovered', '_tick - entity.LastBirthTick.Value >= _settings.ReproductionCooldown'],
  recovered: ['recovered', '_tick - entity.LastBirthTick.Value >= _settings.ReproductionCooldown'],
  pregnant: ['isAvailable', '!entity.IsPregnant'],
  tooFar: ['findPartners', 'for (int offsetX = -1; offsetX <= 1; offsetX++)'],
  sameCell: ['findPartners', 'for (int offsetX = -1; offsetX <= 1; offsetX++)'],
  sameSex: ['findPartners', 'candidate.Sex != entity.Sex'],
  siblings: ['findPartners', '!_lineage.AreCloseKin(entity.Id, candidate.Id)'],
  populationFull: ['tryConceive', 'population >= _settings.MaxPopulation'],
  kinClose: ['findPartners', '!_lineage.AreCloseKin(entity.Id, candidate.Id)'],
  kinDistant: ['chanceFor', 'chance *= _settings.CousinConceptionFactor'],
  kinNone: ['chanceFor', 'double chance = _settings.ConceptionChance'],
  bondGain: ['bond', 'Map.Adjust(entity.Id, other.Id, _settings.RelationshipGain)'],
  resentLoss: ['resent', 'Map.Adjust(entity.Id, other.Id, -_settings.RelationshipLoss)'],
  decay: ['relUpdate', 'Map.Decay(_settings.RelationshipDecay)'],
  birthRoom: ['deliver', 'if (!TryChooseBirthPosition(mother, out (int X, int Y) position))'],
  childTag: ['deliverIfDue', 'child.GroupTag = mother.GroupTag;'],
  inheritTraits: ['inherit', 'StrengthRules.Inherit('],
  phaseShuffle: ['step', 'BuildTurnOrder();'],
  phaseNeeds: ['step', 'RunBasicNeeds();'],
  phaseSocial: ['step', 'RunSocialActions();'],
  phaseUpkeep: ['step', 'RunUpkeep();'],
  phaseOwnership: ['step', 'Ownership.Update(_entities);'],
  phaseCleanup: ['step', 'RemoveDead();'],
};

/** Settings whose doc comments the site shows. */
const SETTINGS = [
  'RelationshipGain', 'RelationshipLoss', 'RelationshipDecay', 'RelationshipFloor', 'FriendPull',
  'HungerSilencesFriends', 'HungerThreshold', 'MaturityAge', 'ReproductionThreshold', 'ReproductionCooldown',
  'ConceptionChance', 'CousinConceptionFactor', 'ReproductionCost', 'GestationTicks', 'ChildEnergy',
  'MaxEntitiesPerCell', 'MaxPopulation', 'GestationMetabolism', 'GestationMoveCost', 'SightRange', 'ForagingRange',
];

/**
 * Builds code.json from the source tree.
 * @param {string} root The repository root (the folder holding EmergentSociety.Core).
 * @returns {object} The extracted data.
 */
export function extractCode(root) {
  const core = join(root, 'EmergentSociety.Core');
  const tests = join(root, 'EmergentSociety.Core.Test');
  const result = { methods: {}, anchors: {}, settings: {}, entity: [], tests: {} };

  for (const [key, [file, name]] of Object.entries(METHODS)) {
    const lines = readLines(join(core, file));
    const { start: declaration, end } = methodSpan(lines, name);
    const start = includeDocComment(lines, declaration);
    result.methods[key] = {
      file: `EmergentSociety.Core/${file}`, name, start: start + 1, end: end + 1, code: lines.slice(start, end + 1),
    };
  }

  for (const [key, [method, text]] of Object.entries(ANCHORS)) {
    const m = result.methods[method];
    const hits = m.code.flatMap((line, i) => (line.includes(text) ? [m.start + i] : []));
    if (hits.length !== 1) {
      throw new Error(`Anchor ${key}: expected one line containing "${text}" in ${m.name}, found ${hits.length}`);
    }
    result.anchors[key] = { method, line: hits[0] };
  }

  const settingsLines = readLines(join(core, 'Engine/SimulationSettings.cs'));
  for (const name of SETTINGS) {
    const index = settingsLines.findIndex((l) => new RegExp(`public \\w+ ${name} \\{`).test(l));
    if (index < 0) throw new Error(`Setting ${name} not found`);
    const fallback = /=\s*([^;]+);/.exec(settingsLines[index]);
    result.settings[name] = {
      doc: summaryBefore(settingsLines, index), line: index + 1, classDefault: fallback ? fallback[1].trim() : null,
    };
  }

  const entityLines = readLines(join(core, 'Entities/Entities.cs'));
  entityLines.forEach((line, index) => {
    const match = /^\s*public ([\w<>(), ?.]+) (\w+) (\{|=>)/.exec(line);
    if (match) {
      result.entity.push({ name: match[2], type: match[1], line: index + 1, doc: summaryBefore(entityLines, index) });
    }
  });

  for (const file of readdirSync(tests).filter((f) => f.endsWith('.cs')).sort()) {
    const names = [];
    readLines(join(tests, file)).forEach((line, index) => {
      const match = /^\s*public (?:async Task|void) (\w+)\(/.exec(line);
      if (match) names.push({ name: match[1], line: index + 1 });
    });
    if (names.length) result.tests[file] = names;
  }

  return result;
}

if (process.argv[1]?.endsWith('extract-code.mjs')) {
  const [root, out] = process.argv.slice(2);
  const data = extractCode(root);
  writeFileSync(out, JSON.stringify(data));
  console.log(`Wrote ${out}: ${Object.keys(data.methods).length} methods, ${Object.keys(data.anchors).length} anchors, ${data.entity.length} entity members`);
}
