<script setup lang="ts">
/**
 * The world screen: recorded baseline worlds to roll through, a way into the systems map, and the order
 * of phases inside one tick.
 */
import { useRouter } from '../composables/useRouter';
import SeedExplorer from '../components/SeedExplorer.vue';
import TickPhases from '../components/TickPhases.vue';
import { app } from '../state/app';

const { navigate } = useRouter();

function follow(female: boolean) {
  app.sex = female ? 'Female' : 'Male';
  app.followedFromMap = true;
  navigate('entity');
}
</script>

<template>
  <section class="view stack" aria-labelledby="world-title">
    <div class="stack intro">
      <span class="eyebrow">Baseline worlds · recorded from the real Core</span>
      <h1 id="world-title" class="page-title">A society nobody scripted</h1>
      <p class="lede">
        Every dot is an entity on a 40 by 20 grid. No one tells them to form families, groups or rivalries. Each one
        follows a few local rules, and everything you see comes from running those rules. Each seed is a different
        world: a new map, new founders, new luck. Every one is recorded from the real simulation for its first 150
        ticks. <strong>Roll a new world, or click any dot to follow it.</strong>
      </p>
    </div>

    <SeedExplorer @follow="follow" />

    <div class="legend">
      <span><i class="dot f" />female</span>
      <span><i class="dot m" />male</span>
      <span><i class="swatch" style="background: #2d7a68" />food in a cell (brighter is more)</span>
      <span><i class="swatch" style="border: 2px solid #d9b26a" />shelter</span>
      <span><i class="swatch" style="background: #2f6e3f; border-radius: 50%" />tree</span>
      <span><i class="dot" style="background: #fff" />pregnant</span>
      <span><i class="dot" style="background: #a0703c" />carrying wood</span>
      <span><i class="x">✕</i>killed</span>
    </div>

    <a class="cta" href="#systems">See how the systems connect →</a>

    <div class="stack section">
      <h2>One tick, in order</h2>
      <p class="lede">
        Time moves in ticks. Every tick runs the same phases in the same order, and every entity finishes one phase
        before anyone starts the next. Pick a phase to see what happens in it.
      </p>
      <TickPhases />
    </div>
  </section>
</template>

<style scoped>
.view { padding: 28px 0 0; gap: 18px; }
.intro { gap: 8px; }
.page-title { view-transition-name: page-title; }
.x { color: var(--bad); font-style: normal; font-weight: 600; }
.section { margin-top: 22px; }
</style>
