/**
 * @file Regenerates everything the explainer shows from the current source tree. Run with "npm run data".
 *
 * Steps:
 *  1. Records scenes from the real Core with the trace tool: rules.json, meeting.json, and one file per
 *     seed in src/data/seeds for the world screen.
 *  2. Extracts methods, highlight anchors, settings docs and test names (code.json).
 *  3. Scans which state each system reads and changes, and checks every feedback loop (systems.json).
 *  4. Runs the test suite and summarizes the results (tests.json).
 *  5. Stamps the build with the date and the latest commit (build.json).
 *
 * Options:
 *   --skip-trace          keep the existing scene recordings
 *   --seeds <count>       how many seeds to record for the world screen (default 100)
 *   --ticks <count>       how many ticks to record each seed (default 150, at most 254)
 *   --skip-tests          keep the existing test results
 *   --tests-from <file>   copy test results from a file instead of running dotnet test
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCode } from './extract-code.mjs';
import { runTests } from './run-tests.mjs';
import { buildSystemsMap } from './systems-map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const explainer = resolve(here, '..');
const root = resolve(explainer, '..');
const data = join(explainer, 'src', 'data');
const args = process.argv.slice(2);
const option = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

/**
 * Prints a step heading.
 * @param {string} text The step description.
 */
function step(text) {
  console.log(`\n> ${text}`);
}

/**
 * Reads the latest commit's short hash and message from the git reflog, without needing git installed.
 * Only the hash and message are kept; the author line is never read into the output.
 * @returns {{hash: string, message: string} | null} The latest commit, or null if there is no reflog.
 */
function latestCommit() {
  const log = join(root, '.git', 'logs', 'HEAD');
  if (!existsSync(log)) return null;
  const last = readFileSync(log, 'utf8').trim().split(/\r?\n/).pop() ?? '';
  const [head, message = ''] = last.split('\t');
  const hash = head.split(' ')[1] ?? '';
  return { hash: hash.slice(0, 7), message: message.replace(/^commit( \(initial\))?: /, '') };
}

/**
 * Asks git whether Core has changes that are not committed yet. Returns null when git is not available.
 * @returns {boolean | null} True if Core has uncommitted changes.
 */
function coreHasUncommittedChanges() {
  try {
    const out = execFileSync('git', ['-C', root, 'status', '--porcelain', '--', 'EmergentSociety.Core'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().length > 0;
  } catch {
    return null;
  }
}

if (!option('--skip-trace')) {
  step('Recording scenes from Core');
  const seeds = value('--seeds') ?? '100';
  const ticks = value('--ticks') ?? '150';
  execFileSync('dotnet', ['run', '--project', join(here, 'trace'), '-c', 'Release', '--', data, seeds, ticks], { stdio: 'inherit' });
}

step('Extracting code, settings and test names');
writeFileSync(join(data, 'code.json'), JSON.stringify(extractCode(root)));

step('Scanning how the systems connect');
const map = buildSystemsMap(root);
writeFileSync(join(data, 'systems.json'), JSON.stringify(map));
console.log(`${map.systems.length} systems, ${map.edges.length} links, ${map.loops.length} loops checked`);

if (value('--tests-from')) {
  step('Copying test results');
  copyFileSync(value('--tests-from'), join(data, 'tests.json'));
} else if (!option('--skip-tests')) {
  step('Running the test suite');
  const { total, passed } = runTests(root, join(data, 'tests.json'));
  console.log(`${passed} of ${total} test methods passed`);
}

step('Stamping the build');
const build = { builtAt: new Date().toISOString(), commit: latestCommit(), uncommittedCore: coreHasUncommittedChanges() };
writeFileSync(join(data, 'build.json'), JSON.stringify(build));
console.log(JSON.stringify(build));
