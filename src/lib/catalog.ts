/**
 * The small, shared data every screen needs: code extracts, the systems map, test results, rules and the
 * build stamp. The large recordings (the seed files and meeting.json) are not here; their screens load them
 * on demand so they land in separate chunks.
 *
 * Everything is frozen with markRaw: it never changes at runtime, so Vue has no reason to make it reactive.
 */
import { markRaw } from 'vue';
import buildJson from '../data/build.json';
import codeJson from '../data/code.json';
import rulesJson from '../data/rules.json';
import systemsJson from '../data/systems.json';
import testsJson from '../data/tests.json';
import type { BuildData, CodeData, MapState, MapSystem, RulesData, SystemsData, TestResult } from '../types/data';

export const CODE = markRaw(codeJson as unknown as CodeData);
export const MAP = markRaw(systemsJson as unknown as SystemsData);
export const TESTS = markRaw(testsJson as unknown as TestResult[]);
export const RULES = markRaw(rulesJson as unknown as RulesData);
export const BUILD = markRaw(buildJson as unknown as BuildData);

/** Baseline settings by name, as numbers. Booleans are read through {@link flag}. */
export const S = RULES.settings as Record<string, number>;

/**
 * Reads a boolean setting.
 * @param name The setting name.
 * @returns The setting's value.
 */
export function flag(name: string): boolean {
  return RULES.settings[name] === true;
}

/** Systems by key. */
export const SYSTEM = new Map<string, MapSystem>(MAP.systems.map((s) => [s.key, s]));

/** Shared state by key. */
export const STATE = new Map<string, MapState>(MAP.state.map((s) => [s.key, s]));

/**
 * The display name of a system or a piece of shared state.
 * @param key A system or state key.
 * @returns Its label.
 */
export function labelOf(key: string): string {
  return SYSTEM.get(key)?.label ?? STATE.get(key)?.label ?? key;
}

/** Test results by "Class.Method". */
const TEST_INDEX = new Map(TESTS.map((t) => [`${t.cls}.${t.name}`, t]));

/**
 * Looks up the result of one test method.
 * @param file The test file, such as "ConceptionTests.cs".
 * @param name The test method name.
 * @returns The result, or undefined if the method did not run.
 */
export function testResult(file: string, name: string): TestResult | undefined {
  return TEST_INDEX.get(`${file.replace(/\.cs$/, '')}.${name}`);
}
