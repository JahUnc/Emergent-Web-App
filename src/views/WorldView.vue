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
    <div class="intro-split">
      <div class="title-block">
        <span class="eyebrow">Baseline worlds // recorded from the real Core</span>
        <h1 id="world-title" class="page-title">A society nobody scripted</h1>
      </div>
      <p class="lede">
        Every dot is an entity on a 40 by 20 grid. No one tells them to form families, groups or rivalries. Each one
        follows a few local rules, and everything you see comes from running those rules. Each seed is a new map, new
        founders and new luck, recorded from the real simulation for its first 150 ticks.
        <strong>Roll a new world, or click any dot to follow it.</strong>
      </p>
    </div>

    <SeedExplorer @follow="follow" />

    <div class="under">
      <div class="legend" aria-label="Map key">
        <span><i class="dot f" />female</span>
        <span><i class="dot m" />male</span>
        <span><i class="swatch food" />food in a cell, brighter is more</span>
        <span><i class="swatch shelter" />shelter</span>
        <span><i class="swatch tree" />tree</span>
        <span><i class="dot pregnant" />pregnant</span>
        <span><i class="dot wood" />carrying wood</span>
        <span><i class="x">✕</i>killed</span>
      </div>
      <a class="btn next" href="#systems">See how the systems connect</a>
    </div>

    <div class="tick-section">
      <div class="intro-split small-intro">
        <div class="title-block">
          <span class="eyebrow">Inside one tick</span>
          <h2>Six phases, in order</h2>
        </div>
        <p class="lede">
          Time moves in ticks. Every tick runs the same six phases in the same order, and every entity finishes one
          phase before anyone starts the next. Pick a phase to see what happens in it and the line of code that runs it.
        </p>
      </div>
      <TickPhases />
    </div>
  </section>
</template>

<style scoped>
.view { padding: clamp(40px, 6vw, 80px) 0 0; gap: 30px; }
.under { display: flex; gap: 16px 32px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-top: -6px; }
.swatch.food { background: linear-gradient(90deg, #08324a, #1880a0); }
.swatch.shelter { border: 1.5px solid var(--select); box-shadow: 0 0 6px rgba(255, 197, 61, 0.6); }
.swatch.tree { border: 1.5px solid var(--good); border-radius: 50%; }
.dot.pregnant { background: #fff; box-shadow: 0 0 8px #fff; }
.dot.wood { background: var(--wood); }
.next { padding: 9px 18px; }
.x { color: var(--bad); font-style: normal; font-weight: 700; }
.tick-section { display: flex; flex-direction: column; gap: 28px; margin-top: 64px; }
.small-intro { align-items: end; }
</style>
