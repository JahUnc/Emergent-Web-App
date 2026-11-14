<script setup lang="ts">
/**
 * The sticky header: site name, the four screens, and the search button that opens the command palette.
 */
import { ROUTES, useRouter } from '../composables/useRouter';
import { palette } from '../state/app';

const { route } = useRouter();
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
</script>

<template>
  <header class="top">
    <div class="wrap bar">
      <a class="brand" href="#overview"><b>Emergent Society</b> · how it works</a>
      <nav aria-label="Screens">
        <a
          v-for="r in ROUTES"
          :key="r.name"
          :href="`#${r.name}`"
          :aria-current="route === r.name ? 'page' : undefined"
        >{{ r.label }}</a>
      </nav>
      <button class="search" type="button" aria-haspopup="dialog" @click="palette.open = true">
        Search <kbd>{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
      </button>
    </div>
  </header>
</template>

<style scoped>
.top { position: sticky; top: 0; z-index: 10; background: rgba(8, 12, 22, 0.88); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); view-transition-name: site-header; }
.bar { display: flex; align-items: center; gap: 16px; min-height: 56px; flex-wrap: wrap; }
.brand { font-family: var(--display); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.85rem; color: var(--muted); text-decoration: none; }
.brand b { color: var(--text); font-weight: 600; }
nav { display: flex; gap: 4px; flex-wrap: wrap; }
nav a { text-decoration: none; color: var(--muted); font-size: 0.88rem; padding: 4px 11px; border: 1px solid transparent; border-radius: 999px; transition: color 0.2s, background 0.2s; }
nav a:hover { color: var(--text); }
nav a[aria-current='page'] { color: var(--text); border-color: var(--line); background: var(--panel); }
.search { margin-left: auto; display: inline-flex; gap: 10px; align-items: center; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 4px 6px 4px 12px; color: var(--muted); font-size: 0.86rem; cursor: pointer; }
.search:hover { color: var(--text); border-color: var(--line-hi); }
kbd { font-family: var(--mono); font-size: 0.7rem; border: 1px solid var(--line); border-radius: 5px; padding: 1px 6px; background: var(--ink); }
</style>
