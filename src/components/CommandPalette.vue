<script setup lang="ts">
/**
 * A command palette for jumping anywhere: a screen, a system, a piece of shared state, or a feedback loop.
 * Open it with Ctrl+K (Cmd+K on a Mac) or "/", type a few letters, and press Enter.
 *
 * Matching is a forgiving subsequence match ("grdg" finds "Grudges") that ranks consecutive and
 * word-start matches higher. Arrow keys move the selection and Escape closes it.
 */
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import { MAP } from '../lib/catalog';
import { ROUTES, useRouter, type RouteName } from '../composables/useRouter';
import { app, palette } from '../state/app';

interface Item {
  id: string;
  label: string;
  kind: string;
  hint: string;
  run: () => void;
}

const { navigate } = useRouter();
const query = ref('');
const active = ref(0);
const input = useTemplateRef<HTMLInputElement>('input-el');

const items: Item[] = [
  ...ROUTES.map((r) => ({ id: `screen-${r.name}`, label: r.label, kind: 'Screen', hint: '', run: () => navigate(r.name as RouteName) })),
  ...MAP.systems.map((s) => ({
    id: `system-${s.key}`, label: s.label, kind: 'System', hint: s.desc,
    run: () => { app.mapFocus = { kind: 'system', key: s.key, side: 'L' }; navigate('systems'); },
  })),
  ...MAP.state.map((s) => ({
    id: `state-${s.key}`, label: s.label, kind: 'Shared state', hint: s.desc,
    run: () => { app.mapFocus = { kind: 'state', key: s.key }; navigate('systems'); },
  })),
  ...MAP.loops.map((l, index) => ({
    id: `loop-${index}`, label: l.title, kind: 'Feedback loop', hint: l.story,
    run: () => { app.mapFocus = { kind: 'loop', index }; navigate('systems'); },
  })),
];

/**
 * Scores how well a query matches a label as a subsequence. Higher is better; -1 means no match.
 * @param label The text to search.
 * @param q The lowercase query.
 * @returns The score.
 */
function score(label: string, q: string): number {
  const text = label.toLowerCase();
  let at = -1;
  let total = 0;
  for (const ch of q) {
    const next = text.indexOf(ch, at + 1);
    if (next < 0) return -1;
    total += next === at + 1 ? 3 : 1;
    if (next === 0 || text[next - 1] === ' ') total += 2;
    at = next;
  }
  return total - text.length * 0.01;
}

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return items.slice(0, 12);
  return items
    .map((item) => ({ item, s: Math.max(score(item.label, q), score(item.kind, q) - 4) }))
    .filter((r) => r.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 12)
    .map((r) => r.item);
});

watch(results, () => (active.value = 0));
watch(() => palette.open, async (open) => {
  if (!open) return;
  query.value = '';
  await nextTick();
  input.value?.focus();
});

function choose(item: Item | undefined) {
  if (!item) return;
  palette.open = false;
  item.run();
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = (active.value + 1) % Math.max(1, results.value.length); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = (active.value - 1 + results.value.length) % Math.max(1, results.value.length); }
  else if (e.key === 'Enter') { e.preventDefault(); choose(results.value[active.value]); }
  else if (e.key === 'Escape') { palette.open = false; }
}

function onGlobalKey(e: KeyboardEvent) {
  const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName));
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
    e.preventDefault();
    palette.open = !palette.open;
  }
}
window.addEventListener('keydown', onGlobalKey);
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="palette.open" class="backdrop" @mousedown.self="palette.open = false">
        <div class="box" role="dialog" aria-modal="true" aria-label="Jump to">
          <input
            ref="input-el"
            v-model="query"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            :aria-activedescendant="results[active]?.id"
            placeholder="Jump to a system, state, loop or screen"
            @keydown="onKey"
          />
          <ul id="palette-list" role="listbox">
            <li
              v-for="(item, i) in results"
              :id="item.id"
              :key="item.id"
              role="option"
              :aria-selected="i === active"
              @mouseenter="active = i"
              @click="choose(item)"
            >
              <span class="label">{{ item.label }}</span>
              <span class="kind">{{ item.kind }}</span>
              <span v-if="item.hint" class="hint">{{ item.hint }}</span>
            </li>
            <li v-if="!results.length" class="empty">Nothing matches “{{ query }}”.</li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(1, 5, 10, 0.66); backdrop-filter: blur(6px); display: grid; place-items: start center; padding: 12vh 16px 16px; }
.box { --bk-c: var(--hud); width: min(640px, 100%); background: var(--brackets), rgba(2, 10, 18, 0.95); border: 1px solid var(--line-hi); border-radius: var(--radius); box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6); overflow: hidden; }
.box::before { content: ''; display: block; height: 14px; margin: 0 20px; background: var(--ruler); }
input { width: 100%; background: transparent; border: 0; border-bottom: 1px solid var(--line); color: var(--text); font: inherit; font-family: var(--mono); font-size: 1rem; padding: 16px 20px; caret-color: var(--hud); outline: none; }
input::placeholder { color: var(--faint); }
ul { list-style: none; margin: 0; padding: 8px; max-height: 52vh; overflow: auto; }
li { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 10px 14px; border-radius: var(--radius-sm); cursor: pointer; }
li[aria-selected='true'] { background: rgba(79, 216, 255, 0.1); box-shadow: inset 2px 0 0 var(--hud); }
.label { font-weight: 700; }
.kind { font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--hud); align-self: center; }
.hint { grid-column: 1 / -1; color: var(--muted); font-size: 0.84rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty { color: var(--muted); cursor: default; }
.palette-enter-active, .palette-leave-active { transition: opacity 0.2s; }
.palette-enter-active .box, .palette-leave-active .box { transition: transform 0.25s var(--ease); }
.palette-enter-from, .palette-leave-to { opacity: 0; }
.palette-enter-from .box, .palette-leave-to .box { transform: translateY(-10px) scale(0.98); }
</style>
