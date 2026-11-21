<script setup lang="ts">
/**
 * One line on where the page's content came from: when the data was generated, from which commit,
 * and how the tests did.
 */
import { BUILD, TESTS } from '../lib/catalog';

const date = new Date(BUILD.builtAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const passed = TESTS.filter((t) => t.passed).length;
</script>

<template>
  <footer class="wrap foot">
    <p>
      Scenes are recorded from the real Core and the links are read from its source, generated {{ date }}
      <template v-if="BUILD.commit"> from commit <code>{{ BUILD.commit.hash }}</code> ({{ BUILD.commit.message }})</template>
      <template v-if="BUILD.uncommittedCore"> plus uncommitted changes</template>.
      {{ passed }} of {{ TESTS.length }} test methods passed.
    </p>
  </footer>
</template>

<style scoped>
.foot { border-top: 1px solid var(--line); margin-top: 48px; padding-top: 18px; padding-bottom: 40px; }
.foot p { color: var(--faint); font-size: 0.82rem; max-width: none; }
</style>
