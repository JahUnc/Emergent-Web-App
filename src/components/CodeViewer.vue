<script setup lang="ts">
/**
 * Shows one or more methods from the real source with line numbers, and lights up chosen lines.
 * Tabs switch between the methods. When the highlight changes, the view scrolls to it.
 */
import { computed, useTemplateRef, watch } from 'vue';
import { CODE } from '../lib/catalog';
import { highlightLine } from '../lib/highlight';

const props = defineProps<{
  /** Method keys from code.json, shown as tabs. */
  methods: string[];
  /** Lines to light up, 1-based file line numbers. */
  lines?: number[];
  /** "fail" colors the highlight pink, for a rule that stopped something. */
  tone?: 'pass' | 'fail';
}>();

/** The method being shown. Two-way bound so a parent can switch tabs when it picks a case. */
const active = defineModel<string>('active', { required: true });

const pre = useTemplateRef<HTMLPreElement>('pre-el');
const method = computed(() => CODE.methods[active.value]!);
const lit = computed(() => new Set(props.lines ?? []));
const rows = computed(() =>
  method.value.code.map((text, i) => ({ n: method.value.start + i, html: highlightLine(text) })),
);

watch([active, () => props.lines], () => {
  const el = pre.value;
  const first = el?.querySelector<HTMLElement>('.hl');
  if (el) el.scrollTop = first ? Math.max(0, first.offsetTop - el.clientHeight / 2 + 12) : 0;
}, { flush: 'post' });
</script>

<template>
  <div class="viewer">
    <div class="bar">
      <span class="file">{{ method.file.replace(/[^/]+$/, '') }}<b>{{ method.file.split('/').pop() }}</b> · lines {{ method.start }} to {{ method.end }}</span>
      <div v-if="methods.length > 1" class="tabs" role="tablist" aria-label="Methods">
        <button
          v-for="key in methods"
          :key="key"
          type="button"
          role="tab"
          :aria-selected="key === active"
          @click="active = key"
        >{{ CODE.methods[key]!.name }}</button>
      </div>
    </div>
    <pre ref="pre-el" tabindex="0"><span
      v-for="row in rows"
      :key="row.n"
      class="ln"
      :class="{ hl: lit.has(row.n), fail: lit.has(row.n) && tone === 'fail' }"
    ><i>{{ row.n }}</i><span v-html="row.html" /></span></pre>
  </div>
</template>

<style scoped>
.viewer { background: var(--code-bg); border: 1px solid var(--line-hi); border-radius: var(--radius); overflow: hidden; box-shadow: inset 0 0 40px rgba(79, 216, 255, 0.04); }
.bar { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-bottom: 1px solid var(--line); flex-wrap: wrap; background: rgba(79, 216, 255, 0.04); }
.file { font-family: var(--mono); font-size: 0.72rem; color: var(--faint); }
.file b { color: var(--hud); font-weight: 500; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
.tabs button { background: transparent; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 2px 9px; font-family: var(--mono); font-size: 0.7rem; color: var(--muted); cursor: pointer; }
.tabs button:hover { border-color: var(--line-hi); color: var(--text); }
.tabs button[aria-selected='true'] { color: var(--hud); border-color: var(--hud); background: rgba(79, 216, 255, 0.12); box-shadow: 0 0 10px rgba(79, 216, 255, 0.25); }
pre { margin: 0; padding: 12px 0; font-family: var(--mono); font-size: 0.8rem; line-height: 1.7; max-height: 440px; overflow: auto; }
.ln { display: block; padding-right: 16px; white-space: pre; border-left: 2px solid transparent; }
.ln i { display: inline-block; width: 3.6em; text-align: right; padding-right: 1.2em; color: #2c4a5a; font-style: normal; user-select: none; }
.ln.hl { background: linear-gradient(90deg, rgba(63, 140, 255, 0.22), rgba(63, 140, 255, 0.04)); border-left-color: var(--male); }
.ln.hl i { color: var(--male); }
.ln.hl.fail { background: linear-gradient(90deg, rgba(255, 79, 154, 0.22), rgba(255, 79, 154, 0.04)); border-left-color: var(--female); }
.ln.hl.fail i { color: var(--female); }
</style>
