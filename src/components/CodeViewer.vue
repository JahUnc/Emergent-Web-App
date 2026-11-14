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
.viewer { background: #0a0f1d; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.file { font-family: var(--mono); font-size: 0.74rem; color: var(--muted); }
.file b { color: var(--text); font-weight: 600; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
.tabs button { background: transparent; border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; font-family: var(--mono); font-size: 0.72rem; color: var(--muted); cursor: pointer; }
.tabs button[aria-selected='true'] { color: var(--text); border-color: var(--male); }
pre { margin: 0; padding: 10px 0; font-family: var(--mono); font-size: 0.78rem; line-height: 1.6; max-height: 440px; overflow: auto; }
.ln { display: block; padding-right: 14px; white-space: pre; border-left: 3px solid transparent; }
.ln i { display: inline-block; width: 3.6em; text-align: right; padding-right: 1.1em; color: #46516d; font-style: normal; user-select: none; }
.ln.hl { background: rgba(90, 169, 255, 0.14); border-left-color: var(--male); }
.ln.hl.fail { background: rgba(255, 111, 174, 0.14); border-left-color: var(--female); }
</style>
