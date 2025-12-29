# Shadow-Rift

Design snapshot for enemies and rift mechanics (original IP, 80s horror-inspired).

## Stack

- TypeScript + Phaser 3 (gameplay/rendering)
- Vite (dev server and production build)
- ESLint (linting) and npm scripts (`dev`, `build`, `lint`)

## Game Pillars

- Tactical defense: path control, tower placement pressure, priority targets.
- Horror tension: analog distortion, uneasy silhouettes, muffled static cues.
- Counterplay clarity: readable telegraphs, phase shifts, sealable hazards.

## Rifts (Spawners + Hazard)

- Distorted portals that emit fog, mild slow, and screen warble near the area.
- Spawn pulses synced to a low hum; flare events launch elite waves.
- Optional interaction: channel to weaken spawn rate; fully sealing removes debuff.

## Enemy Roster

- **RiftHound**: Fast melee skirmisher; low armor, medium HP; on taking damage, gains a short burst of speed with erratic zig-zags.
- **VoidPuppeteer**: Slow controller; high HP; aura that alternates between ally speed and regen; stays behind the toughest ally and retreats if frontliners drop.
- **CrawlerSwarm**: Cluster of small units sharing a pooled HP bucket per swarm; partial splash resistance via capped AoE damage per hit; high DPS when surrounding.
- **FleshBrute**: Heavy tank; very high HP/armor; damages towers in melee; knockback-resistant; builds momentum on straight paths.
- **RiftWatcher (Boss)**: Multi-phase; short blink ignoring slows; periodically summons RiftHounds; can reroute path nodes mid-fight; stacking debuff aura that worsens over time.

## AI Behaviors

- State machine: Idle → Advance → Engage → Regroup → Flee (low HP or support survival logic).
- Support positioning: Puppeteer tracks nearest high-HP ally with a distance buffer; if no frontliner, it retreats and calls reinforcements.
- Target selection: Brutes prefer towers; Swarms chase closest low-armor target unless taunted; Hounds dive backline if path is open.
- Path alteration: Boss signals a path rewrite; enemies invalidate current route and recompute to new nodes.

## Combat Readability

- Telegraphs: Hound speed spike shimmer; Puppeteer aura swap pulse; Brute tower-smash windup; Boss blink shimmer and phase-change VFX.
- FX motif: analog noise overlays near casts and rifts; silhouettes with elongated limbs and stuttered motion.

## Tuning Hooks

- Aura radius and magnitude (speed/regen), swarm AoE cap per instance, Brute tower damage and momentum gain, boss summon cadence, rift debuff strength and seal time.

## Web Prototype (Vite + Phaser)

- Install: `npm install`
- Run dev server: `npm run dev` (opens at http://localhost:5173)
- Build: `npm run build`

### Quickstart

1. `npm install`
2. `npm run dev`
3. Open the shown URL (default http://localhost:5173)

### Structure

- `src/main.ts`: game bootstrap and scene registration
- `src/scenes/BootScene.ts`: lightweight generated textures
- `src/scenes/GameScene.ts`: placeholder tower-defense loop (path, towers, bullets, enemy march)

### Notes

- No external assets; all shapes are generated at runtime.
- Arcade physics is available but movement is manual along the path for clarity.

### Controls

- Hold `S` to channel and seal the active rift (reduces slow aura once sealed).
- Move mouse to preview tower placement; green outline = valid. Red means blocked (path, rift, spacing, bounds).
- Click to place an extra tower (cost shown in HUD; blocked if too close to another tower or the path/rift).

### Current Gameplay Pass

- Wave loop with alerts, mixed enemy roster, and placeholder towers plus player-placed towers via clicks.
- Behaviors: Hounds gain brief speed bursts when hit; Puppeteers toggle speed/regen aura; Swarms cap damage per hit; Brutes smash towers in melee; Watchers blink forward, emit aura, summon Hounds, and force path swaps.
- Rift hazard applies local slow until sealed; sealing progress is shown in the HUD with a bar and channel pulses.
- HUD shows next-wave weights, last kill reward, resources, and seal status; path shifts are telegraphed with flashes.

## Immediate Roadmap

- Balance pass: tower cost/damage vs. wave pacing; tune watcher spawn cadence.
- Placement clarity: add placement preview + path-blocking checks.
- FX/audio: add seal-channel loop, path-swap cue, watcher blink tell.
- UI: show wave composition, rift seal bar, resource income per kill.
- Boss depth: add RiftWatcher phase moves (path rewrite frequency, larger summons).
