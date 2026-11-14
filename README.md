# Emergent Society Explainer

An interactive companion site for **Emergent Society**, an agent-based simulation written in C# where a society grows out of a few simple, local rules. Nobody scripts the families, groups, rivalries or shelters. Each entity only reacts to what is next to it, and everything else comes from running those rules.

The site shows how the simulation works: its systems, how they connect through shared state, and recorded scenes you can play back. Nothing on the site re-implements a rule. Every scene is recorded from the real simulation, and every link and line of code is read from its source when the data is generated.

![A recorded world, partway through its first 150 ticks](docs/world.png)

## What's on the site

### World
Roll through 100 recorded worlds. Each seed is a different map, different founders and different luck, played from its first tick to tick 150. At the end, a summary shows how that world turned out: who was born, who starved, froze, was killed or died of old age, how much shelter got built, and how many groups formed.

* **Roll a new world** picks a random seed. The next one downloads while the current one plays, so rolling is instant.
* **Go to** jumps to a specific seed, and links like `#seed-37` open that world directly.
* Play, pause, scrub through the ticks, or watch at 1×, 2× or 4× speed.
* Click any entity to zoom in and follow it.

Below the map, **One tick, in order** walks through the six phases every tick runs.

### Systems map
Every system in the simulation, what it changes, and what it uses. Systems on the left change the shared state in the middle, and the systems on the right react to it. Hover anything to trace it and click to keep it selected. Each link shows the line of code that creates it.

The map also has six **feedback loops**, the chains that make behavior emerge, like friends gathering where food is or crowding turning into feuds between groups.

![The systems map with a feedback loop selected](docs/systems-map.png)

### An entity
What a single entity can perceive (food, friends and partners within 1 cell, shelters and trees within 3), what it keeps track of, and the systems behind each part of its life.

### Near another entity
A recorded meeting between two founders: they bond, miss their first chance at a child, conceive, and raise one. Below it, each part is broken out, covering how friendship forms, every condition a pair must meet to conceive, who counts as family, and how birth works. Each case shows the real result and the one line of code that decided it.

![Checking whether a pair can have a child](docs/scene.png)

Press `Ctrl K` (`Cmd K` on a Mac) or `/` anywhere to jump to any system, piece of shared state, loop or screen.

## Running it

Requires [Node.js](https://nodejs.org) 22.12 or newer.

```bash
npm install
npm run dev       # local dev server with hot reload
npm run build     # type-check and build the static site into dist/
npm run preview   # serve the built site locally
```

All the data the site shows is already generated and committed in `src/data`, so building the site does not need .NET or the simulation source.

## Deploying

`dist/` is a plain static site. All of its paths are relative and it only uses `#` links, so it works on any static host without server configuration.

**Netlify:** set the build command to `npm run build` and the publish directory to `dist`.

**GitHub Pages:** build the site and publish the contents of `dist`, either from a `gh-pages` branch or with a GitHub Actions workflow that runs `npm ci` and `npm run build` and uploads `dist`.

## Regenerating the data

The data in `src/data` comes from the simulation itself. Regenerate it after changing the simulation:

```bash
npm run data
```

This needs the [.NET 8 SDK](https://dotnet.microsoft.com/download) and the simulation source. The tools expect this folder to sit inside the Emergent Society repository, next to `EmergentSociety.Core` and `EmergentSociety.Core.Test`. If this site lives in its own repository, run `npm run data` from the copy inside the simulation repository and copy the new `src/data` files across.

`npm run data` runs `tools/build-data.mjs`, which:

1. Runs the trace tool (`tools/trace`, a console project that references the simulation's Core) to record the scenes. That produces `rules.json` and `meeting.json`, plus one file per seed in `src/data/seeds` (100 seeds of 150 ticks by default, about 26 KB each).
2. Extracts the methods, highlighted lines, settings docs and test names the site shows into `code.json`.
3. Scans which shared state each system reads and changes, and checks every feedback loop, writing `systems.json`.
4. Runs the simulation's test suite with `dotnet test` and summarizes the results into `tests.json`.
5. Stamps the build with the date and latest commit in `build.json`.

| Option | What it does |
| --- | --- |
| `--seeds <count>` | How many worlds to record (default 100) |
| `--ticks <count>` | How many ticks to record each world (default 150, at most 254) |
| `--skip-trace` | Keep the existing recordings |
| `--skip-tests` | Keep the existing test results |
| `--tests-from <file>` | Copy test results from a file instead of running the tests |

Pass options after `--`, for example `npm run data -- --seeds 200`.

### When the data step stops with an error

The tools would rather stop than produce a page that is quietly wrong:

* **Anchors.** A highlighted line is found by its text. If that text no longer appears exactly once in its method, the anchor fails. Update it in `ANCHORS` in `tools/extract-code.mjs`.
* **Loops.** A feedback loop is a list of links. If the code no longer has one of them, the loop fails. Update it in `LOOPS` in `tools/systems-map.mjs`.
* **Seed recordings.** The recorder checks its counts of deaths by cause against the simulation's own statistics for every seed.

### Adding a system to the map

Add it to `SYSTEMS` in `tools/systems-map.mjs` with its phase, source files and test files. If it touches a new kind of shared state, add that to `STATE` with the code patterns that read it and the patterns that change it. The links themselves are found by scanning the code.

## How it's built

* **Vue 3.5** with `<script setup>` and **TypeScript** in strict mode, built with **Vite**. `npm run build` type-checks with `vue-tsc` first, and every generated data file has a type.
* **Loads only what's needed.** Each screen is its own chunk, and each recorded world is its own chunk, so a visitor only downloads the worlds they watch. The other screens load in the background while the browser is idle.
* **Compact recordings.** A world packs into about 26 KB: food is stored every 5 ticks as 4 bits per cell and blended in between, and each entity's movement is stored as one byte per tick. The format is described in `tools/trace/SeedRecorder.cs`.
* **Smooth screen changes** with the View Transitions API, and a small hash router that uses plain `#name` links so the site works on any host.
* **Cheap drawing.** Glowing dots are pre-drawn sprites instead of a blur recalculated every frame, the food grid is drawn as one small image and scaled up, and entity positions are worked out once per tick rather than every frame.
* **Animations pause when unseen**: when scrolled out of view, when the tab is hidden, or when their screen isn't showing.
* **Reduced motion** is respected throughout.

## Project layout

```
index.html             entry page
src/
  App.vue              shell: header, current screen, footer, command palette
  views/               the four screens, plus the meeting scene's four panels
  components/          canvases, seed explorer, systems map, code drawers, shared pieces
  composables/         router, animation loop, canvas sizing, async data, reduced motion
  lib/                 data catalog, seed decoder, map layout, drawing, highlighting, text helpers
  state/app.ts         the small amount of state screens share
  types/data.ts        types for every generated data file
  data/                generated by npm run data
docs/                  screenshots for this README
tools/
  build-data.mjs       runs every data step
  trace/               C# console project that records scenes and worlds from the simulation
  extract-code.mjs     methods, anchors, settings docs, test names
  systems-map.mjs      what each system reads and changes, feedback loops
  run-tests.mjs        dotnet test results to tests.json
  lib/csharp.mjs       helpers for reading C# by structure
```