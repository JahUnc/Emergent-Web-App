<script setup lang="ts">
/**
 * Where the page's content came from: when the data was generated, from which commit, and how the tests
 * did. Laid out as a system log line under a measuring ruler, echoing the stage frames.
 */
import { BUILD, TESTS } from '../lib/catalog';

const date = new Date(BUILD.builtAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const passed = TESTS.filter((t) => t.passed).length;
</script>

<template>
  <footer class="foot">
    <div class="wrap inner">
      <p>
        Scenes are recorded from the real Core and the links are read from its source, generated {{ date }}
        <template v-if="BUILD.commit"> from commit <code>{{ BUILD.commit.hash }}</code> ({{ BUILD.commit.message }})</template>
        <template v-if="BUILD.uncommittedCore"> plus uncommitted changes</template>.
      </p>
      <p class="tests"><b>{{ passed }}/{{ TESTS.length }}</b> test methods passed</p>
    </div>
  </footer>
</template>

<style scoped>
.foot { margin-top: 96px; position: relative; }
.foot::before { content: ''; display: block; height: 14px; background: var(--ruler); border-bottom: 1px solid var(--line); opacity: 0.8; }
.inner { display: flex; gap: 12px 32px; justify-content: space-between; align-items: baseline; flex-wrap: wrap; padding-top: 22px; padding-bottom: 48px; }
.foot p { color: var(--faint); font-size: 0.84rem; }
.foot code { color: var(--hud); }
.tests { font-family: var(--mono); font-size: 0.74rem !important; text-transform: uppercase; letter-spacing: 0.12em; }
.tests b { color: var(--good); font-weight: 500; text-shadow: 0 0 8px rgba(61, 255, 180, 0.6); }
</style>
