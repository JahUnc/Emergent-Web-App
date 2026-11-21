<script setup lang="ts">
/**
 * The app shell: header, the current screen, the footer, the command palette, and the one-time start-up
 * sequence.
 *
 * Screens are async components, so each one (and the data it imports) is its own chunk. After the first
 * screen paints, the rest are fetched while the browser is idle, so moving between screens is instant.
 * KeepAlive keeps visited screens in memory with their state (selection, playback position), and each
 * screen's animation loop pauses itself while it is cached and hidden.
 */
import { computed, defineAsyncComponent, onMounted, type Component } from 'vue';
import AppHeader from './components/AppHeader.vue';
import BootSequence from './components/BootSequence.vue';
import BuildFooter from './components/BuildFooter.vue';
import CommandPalette from './components/CommandPalette.vue';
import { useRouter, type RouteName } from './composables/useRouter';

const loaders = {
  overview: () => import('./views/WorldView.vue'),
  systems: () => import('./views/SystemsView.vue'),
  entity: () => import('./views/EntityView.vue'),
  'near-another': () => import('./views/MeetingView.vue'),
} satisfies Record<RouteName, () => Promise<unknown>>;

const views: Record<RouteName, Component> = {
  overview: defineAsyncComponent(loaders.overview),
  systems: defineAsyncComponent(loaders.systems),
  entity: defineAsyncComponent(loaders.entity),
  'near-another': defineAsyncComponent(loaders['near-another']),
};

const { route } = useRouter();
const view = computed(() => views[route.value]);

onMounted(() => {
  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
  idle(() => {
    for (const load of Object.values(loaders)) void load();
    void import('./data/meeting.json');
  });
});
</script>

<template>
  <AppHeader />
  <main class="wrap">
    <KeepAlive :max="4">
      <component :is="view" :key="route" />
    </KeepAlive>
  </main>
  <BuildFooter />
  <CommandPalette />
  <BootSequence />
</template>
