<script setup lang="ts">
/**
 * The code behind a scene, kept out of the way until wanted. The one line that decides the case on
 * screen is always shown, so the link from rule to code is visible at a glance. The whole method and
 * the tests that pin the rule sit behind a toggle.
 */
import { computed, ref, watch } from 'vue';
import { CODE } from '../lib/catalog';
import { highlightLine } from '../lib/highlight';
import CodeViewer from './CodeViewer.vue';
import TestList from './TestList.vue';

const props = defineProps<{
  /** Method keys to offer as tabs. */
  methods: string[];
  /** The anchor (from code.json) for the line that decides the current case. */
  anchor?: string | null;
  /** A method to show when there is no anchor. */
  method?: string | null;
  tone?: 'pass' | 'fail';
  /** Test files to list. */
  tests?: string[];
}>();

const open = ref(false);
const active = ref(props.methods[0]!);
const point = computed(() => (props.anchor ? CODE.anchors[props.anchor] : undefined));
const keyLine = computed(() => {
  const a = point.value;
  if (!a) return null;
  const m = CODE.methods[a.method]!;
  return { file: m.file.split('/').pop(), n: a.line, html: highlightLine(m.code[a.line - m.start]!.trim()), name: m.name };
});

watch(() => [props.anchor, props.method], () => {
  active.value = point.value?.method ?? props.method ?? active.value;
}, { immediate: true });
</script>

<template>
  <div class="drawer">
    <div v-if="keyLine" class="key" :class="tone">
      <span class="eyebrow">The line that decides this</span>
      <code v-html="keyLine.html" />
      <span class="where">{{ keyLine.name }} · {{ keyLine.file }}:{{ keyLine.n }}</span>
    </div>
    <button type="button" class="toggle" :aria-expanded="open" @click="open = !open">
      {{ open ? 'Hide the code' : 'See the code' }}
      <span class="small">{{ methods.length }} method{{ methods.length > 1 ? 's' : '' }}{{ tests?.length ? ' and its tests' : '' }}</span>
    </button>
    <div v-if="open" class="body">
      <CodeViewer v-model:active="active" :methods="methods" :lines="point ? [point.line] : []" :tone="tone" />
      <TestList v-if="tests?.length" :files="tests" />
    </div>
  </div>
</template>

<style scoped>
.drawer { display: flex; flex-direction: column; gap: 12px; }
.key { --bk-c: var(--male); --bk: 10px; display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: var(--radius); background: var(--brackets), var(--code-bg); border: 1px solid rgba(63, 140, 255, 0.3); box-shadow: inset 0 0 30px rgba(63, 140, 255, 0.06); }
.key.fail { --bk-c: var(--female); border-color: rgba(255, 79, 154, 0.35); box-shadow: inset 0 0 30px rgba(255, 79, 154, 0.06); }
.key code { font-size: 0.86rem; white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
.where { font-family: var(--mono); font-size: 0.7rem; color: var(--faint); letter-spacing: 0.04em; }
.toggle { all: unset; cursor: pointer; display: inline-flex; gap: 10px; align-items: baseline; color: var(--hud); font-weight: 600; font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase; }
.toggle .small { text-transform: none; letter-spacing: 0; font-weight: 400; }
.toggle:hover { text-shadow: var(--hud-glow); }
.toggle:focus-visible { outline: 1.5px solid var(--select); outline-offset: 3px; }
.body { display: flex; flex-direction: column; gap: 12px; }
</style>
