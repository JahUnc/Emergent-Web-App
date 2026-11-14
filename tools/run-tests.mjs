/**
 * @file Runs the Core test suite with dotnet test and saves a per-test summary to src/data/tests.json,
 * so each explainer screen can list the tests that pin its rules and whether they passed.
 *
 * dotnet test writes a TRX report (the standard Visual Studio test results format). This script reads
 * the results from it and groups Theory cases under their test method.
 *
 * Usage:
 *   node tools/run-tests.mjs <repo root> <output file>
 *   node tools/run-tests.mjs <repo root> <output file> --from <tests.json>   (reuse results produced elsewhere)
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Reads the attributes of one XML start tag into an object.
 * @param {string} tag The start tag text, such as '<UnitTestResult testName="..." outcome="Passed">'.
 * @returns {Record<string, string>} Attribute name to unescaped value.
 */
function attributes(tag) {
  const result = {};
  for (const [, name, value] of tag.matchAll(/(\w+)="([^"]*)"/g)) {
    result[name] = value.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }
  return result;
}

/**
 * Turns a TRX report into one entry per test method.
 * @param {string} trx The TRX file contents.
 * @returns {Array<{cls: string, name: string, cases: number, passed: boolean, error: string | null}>} The results.
 */
export function parseTrx(trx) {
  const byMethod = new Map();
  for (const match of trx.matchAll(/<UnitTestResult\b[^>]*>/g)) {
    const { testName = '', outcome = '' } = attributes(match[0]);
    const qualified = testName.split('(')[0];
    const parts = qualified.split('.');
    const name = parts.pop();
    const cls = parts.pop();
    const key = `${cls}.${name}`;
    const entry = byMethod.get(key) ?? { cls, name, cases: 0, passed: true, error: null };
    entry.cases++;
    if (outcome !== 'Passed') {
      entry.passed = false;
      entry.error ??= outcome;
    }
    byMethod.set(key, entry);
  }
  return [...byMethod.values()].sort((a, b) => a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name));
}

/**
 * Runs the test project and writes the summary.
 * @param {string} root The repository root.
 * @param {string} out The output file.
 * @returns {{total: number, passed: number}} Counts of test methods.
 */
export function runTests(root, out) {
  const results = mkdtempSync(join(tmpdir(), 'es-tests-'));
  try {
    try {
      execFileSync('dotnet', ['test', join(root, 'EmergentSociety.Core.Test'), '--logger', 'trx;LogFileName=explainer.trx', '--results-directory', results], { stdio: 'inherit' });
    } catch {
      // A failing test makes dotnet test exit with an error. The TRX report still has every result, so keep going.
    }
    const trx = readdirSync(results).find((f) => f.endsWith('.trx'));
    if (!trx) throw new Error('dotnet test did not produce a TRX report. Check that the test project builds.');
    const tests = parseTrx(readFileSync(join(results, trx), 'utf8'));
    writeFileSync(out, JSON.stringify(tests));
    return { total: tests.length, passed: tests.filter((t) => t.passed).length };
  } finally {
    rmSync(results, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith('run-tests.mjs')) {
  const [root, out, flag, from] = process.argv.slice(2);
  if (flag === '--from') {
    copyFileSync(from, out);
    console.log(`Copied test results from ${from}`);
  } else {
    const { total, passed } = runTests(root, out);
    console.log(`Wrote ${out}: ${passed} of ${total} test methods passed`);
  }
}
