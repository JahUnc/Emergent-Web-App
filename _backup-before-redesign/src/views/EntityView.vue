<script setup lang="ts">
/**
 * The entity screen: what an entity is, what it can perceive, what it can end up doing (each linked to
 * its system), and everything it keeps track of.
 */
import { computed } from 'vue';
import EntityRings from '../components/EntityRings.vue';
import { CODE, S, SYSTEM } from '../lib/catalog';
import { useRouter } from '../composables/useRouter';
import { app } from '../state/app';

const { navigate } = useRouter();

const actions = [
  { title: 'Near another entity', desc: 'Bond over shared meals, check whether a pair can have a child, and keep close family apart.', systems: ['relationships', 'mating', 'birth'], scene: true },
  { title: 'Choose where to move', desc: 'Score the 8 neighbors by food, friends and rivals, and pay to move.', systems: ['movement'] },
  { title: 'Eat', desc: 'Start eating below the hunger line and keep going until full.', systems: ['feeding'] },
  { title: 'Fight when desperate', desc: 'Attack only after starving for a while with no food in reach.', systems: ['conflict', 'grudges'] },
  { title: 'Get warm', desc: 'Head for a shelter it can see or remembers when the cold bites.', systems: ['warmth', 'shelterSeeking'] },
  { title: 'Gather and build', desc: 'Cut a full tree and carry the wood to a shelter its group owns.', systems: ['gathering'] },
  { title: 'Farm', desc: 'Work the ground to raise what a cell can grow.', systems: ['farming'] },
];

/**
 * The source files behind some systems, for the footnote on each card.
 * @param keys System keys.
 * @returns Such as "MovementSystem.cs".
 */
function filesFor(keys: readonly string[]): string {
  return [...new Set(keys.flatMap((k) => SYSTEM.get(k)?.files ?? []))].join(' · ');
}

function open(action: (typeof actions)[number]) {
  if (action.scene) {
    app.meetPanel = 0;
    navigate('near-another');
  } else {
    app.mapFocus = { kind: 'system', key: action.systems[0]!, side: 'L' };
    navigate('systems');
  }
}

const groups: [string, string[]][] = [
  ['Body', ['Energy', 'MaxEnergy', 'Age', 'MaxAge', 'Warmth', 'IsAlive']],
  ['Inherited', ['Traits', 'Sex']],
  ['Family', ['LastBirthTick', 'Pregnancy', 'IsPregnant']],
  ['Belonging', ['GroupTag']],
  ['Memory and work', ['KnownShelters', 'CarriedWood', 'WoodForShelter']],
  ['Hunger and fights', ['IsRefilling', 'IsWarming', 'TicksDesperate', 'WeakenedUntilTick', 'IsKilled']],
  ['Place', ['Id', 'X', 'Y']],
];
const members = new Map(CODE.entity.map((m) => [m.name, m]));
const stateGroups = computed(() => {
  const used = new Set(groups.flatMap(([, names]) => names));
  const list = groups.map(([title, names]) => ({ title, items: names.flatMap((n) => members.get(n) ?? []) }));
  const rest = CODE.entity.filter((m) => !used.has(m.name));
  if (rest.length) list.push({ title: 'Other', items: rest });
  return list;
});
</script>

<template>
  <section class="view stack" aria-labelledby="entity-title">
    <div class="hero">
      <EntityRings :sex="app.sex" />
      <div class="stack">
        <span class="eyebrow">{{ app.followedFromMap ? `Followed from the world map · ${app.sex.toLowerCase()}` : 'One entity' }}</span>
        <h1 id="entity-title" class="page-title">An entity</h1>
        <p class="lede">
          An entity is one person in the world. Nothing in it says what it is for. Parent, friend, rival and group member
          are all relationships it ends up in, never types it is born as.
        </p>
        <p class="lede">
          Each tick it only reacts to what is close. It weighs food, friends and partners within
          <strong>{{ S.ForagingRange }} cell</strong> and spots shelters and trees within <strong>{{ S.SightRange }} cells</strong>.
          “Within 1” means its own cell and the 8 around it.
        </p>
        <div class="row">
          <span class="eyebrow">Show as</span>
          <div class="toggle" role="radiogroup" aria-label="Sex shown">
            <button type="button" role="radio" :aria-checked="app.sex === 'Female'" @click="app.sex = 'Female'">female</button>
            <button type="button" role="radio" :aria-checked="app.sex === 'Male'" @click="app.sex = 'Male'">male</button>
          </div>
        </div>
      </div>
    </div>

    <div class="stack section">
      <h2>What happens to it next</h2>
      <p class="lede">Each card is a part of its life and the systems behind it. The first has a full scene; the rest open on the systems map.</p>
      <div class="actions">
        <button v-for="a in actions" :key="a.title" type="button" class="action" :class="{ live: a.scene }" @click="open(a)">
          <span class="pill">{{ a.scene ? 'open the scene' : 'open on the map' }}</span>
          <span class="t">{{ a.title }}</span>
          <span class="d">{{ a.desc }}</span>
          <span class="f">{{ filesFor(a.systems) }}</span>
        </button>
      </div>
    </div>

    <div class="stack section">
      <h2>What it keeps track of</h2>
      <p class="lede">Everything an entity knows about itself, read from the properties and doc comments in <code>Entities.cs</code>.</p>
      <div class="state">
        <div v-for="g in stateGroups" :key="g.title" class="g">
          <h3>{{ g.title }}</h3>
          <div v-for="m in g.items" :key="m.name" class="p">
            <code>{{ m.name }}</code>
            <span>{{ m.doc }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.view { padding: 28px 0 0; gap: 18px; }
.page-title { view-transition-name: page-title; }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 26px; align-items: center; }
@media (max-width: 920px) { .hero { grid-template-columns: 1fr; } }
.section { margin-top: 18px; }
.toggle { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
.toggle button { background: transparent; border: 0; padding: 4px 14px; cursor: pointer; font-size: 0.85rem; color: var(--muted); }
.toggle button[aria-checked='true'] { background: var(--panel-hi); color: var(--text); }
.actions { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.action { text-align: left; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; transition: border-color 0.2s, transform 0.2s; }
.action:hover { border-color: var(--line-hi); transform: translateY(-2px); }
.action.live { border-color: rgba(255, 111, 174, 0.55); }
.action.live:hover { border-color: var(--female); }
.action.live .pill { border-color: var(--female); color: var(--female); }
.t { font-family: var(--display); font-weight: 600; font-size: 1.02rem; }
.d { color: var(--muted); font-size: 0.86rem; }
.f { font-family: var(--mono); font-size: 0.68rem; color: var(--faint); margin-top: auto; }
.state { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.g { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.g h3 { font-size: 0.82rem; margin-bottom: 6px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
.p { font-size: 0.84rem; margin: 7px 0; }
.p span { color: var(--muted); display: block; }
</style>
