<script setup lang="ts">
/**
 * Lists the test methods in some test files, with whether each passed when the data was generated.
 */
import { computed } from 'vue';
import { CODE, testResult } from '../lib/catalog';
import { prettyTestName } from '../lib/text';

const props = defineProps<{ files: string[] }>();

const rows = computed(() =>
  props.files.flatMap((file) =>
    (CODE.tests[file] ?? []).map((t) => ({ file, ...t, result: testResult(file, t.name) })),
  ),
);
const passed = computed(() => rows.value.filter((r) => r.result?.passed).length);
</script>

<template>
  <details class="tests">
    <summary>Tests that pin this: {{ passed }} of {{ rows.length }} passed</summary>
    <ul>
      <li v-for="row in rows" :key="row.file + row.name">
        <span :class="row.result?.passed ? 'ok' : 'no'">{{ row.result ? (row.result.passed ? 'pass' : 'fail') : 'not run' }}</span>
        <span :title="row.name">{{ prettyTestName(row.name) }}</span>
        <span class="where">{{ row.file }}:{{ row.line }}</span>
      </li>
    </ul>
  </details>
</template>

<style scoped>
.tests summary { cursor: pointer; color: var(--muted); font-size: 0.84rem; }
ul { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 0.83rem; }
li { display: flex; gap: 8px; align-items: baseline; }
.ok { color: var(--good); font-family: var(--mono); font-size: 0.72rem; }
.no { color: var(--bad); font-family: var(--mono); font-size: 0.72rem; }
.where { color: var(--faint); font-family: var(--mono); font-size: 0.7rem; margin-left: auto; white-space: nowrap; }
</style>
