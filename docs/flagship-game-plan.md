# Flagship Game Plan

## Goal

Build one highest-quality static web game that can run on GitHub Pages while preserving this repository's no-build, local-first constraints.

This is separate from the daily game pipeline. Daily games optimize for fast, reliable production. The flagship game optimizes for depth, polish, replayability, and technical craft.

## Working Title

**Deep Station: Recovery Log**

## Core Pitch

Pilot a small repair drone through a failing underwater research station. Each sector is a compact grid-based map with live systems, hazards, and repair objectives. The player must restore enough power, oxygen, and door control to reach the exit before the station collapses.

The game should feel like a dense micro-immersive sim rather than a single-mechanic minigame.

## Static Hosting Constraints

- Ship as static files only.
- Use local `html`, `css`, and `javascript`.
- No server, database, build step, external libraries, external network calls, or downloaded assets.
- Local generated assets are allowed only if they are plain text/code-native, such as CSS, inline SVG markup, canvas drawing routines, procedural data, or Web Audio synthesis.
- Prefer local ES modules for maintainability when the game grows beyond one script file.

## Proposed Location

Use a dedicated folder outside the daily dated pipeline:

```text
flagship/deep-station-recovery-log/
  index.html
  style.css
  meta.json
  src/
    main.js
    engine.js
    state.js
    input.js
    render.js
    audio.js
    sectors.js
    storage.js
```

Rationale:

- Avoids pretending this is a one-day minigame.
- Keeps daily `games/YYYY-MM-DD-slug/` verification stable.
- Makes larger code easier to inspect than a single 30k+ line-adjacent script.

## Experience Pillars

1. **Readable Depth**
   - A new player understands the first objective within 30 seconds.
   - The system depth comes from interacting pressures, not hidden rules.

2. **Tactical Motion**
   - Movement is deliberate and mobile-friendly.
   - Each step or impulse matters because oxygen, power, enemy patrols, or floods change over time.

3. **Procedural Replayability**
   - Sectors are generated from constrained templates.
   - Runs vary through layout, objective placement, hazard mix, and event timing.

4. **High Polish Without Assets**
   - Canvas lighting, fog, scanlines, particles, screen shake, and generated audio replace image/sound assets.
   - UI stays restrained and readable, matching the archive's design direction.

5. **Persistent Progress**
   - `localStorage` stores best sector, unlocked logs, settings, and run stats.
   - Failure resets the run to sector 1, but discovered logs and best records remain.

## Game Loop

1. Enter a sector with partial map visibility.
2. Read objectives and hazards.
3. Navigate the drone through rooms and corridors.
4. Repair or reroute key systems:
   - Power relays
   - Oxygen valves
   - Door locks
   - Pump nodes
5. Escape through the exit hatch.
6. Advance to a harder sector immediately.
7. On failure, restart at sector 1 while keeping persistent records.

## Core Systems

### Sector Grid

- Tile types: floor, wall, door, water, vent, relay, valve, terminal, exit, hazard.
- Grid size starts small and scales gradually.
- Generation must guarantee solvability.

### Drone

- Mobile-first controls: directional pad or swipe-to-step.
- Desktop fallback: arrow keys and WASD.
- Optional action button for repair/interact.

### Resources

- Oxygen: drains over time or per move.
- Battery: used for repairs, lights, or scanner pulses.
- Integrity: lost from hazards or pressure events.

### Systems

- Power opens some doors and activates terminals.
- Pumps lower flooded rooms.
- Valves stabilize oxygen.
- Terminals reveal map or reroute locks.

### Hazards

- Flood expansion.
- Patrol drones or pressure pulses.
- Electrical arcs with predictable timing.
- Locked doors that require alternate routing.

## Visual Direction

- Base UI remains grayscale-first and calm.
- Gameplay canvas can use local functional color:
  - Blue-gray for water/fog.
  - Amber for power.
  - Green for oxygen.
  - Red only for critical danger.
- Use layered canvas rendering:
  - Tile base layer
  - Entity layer
  - Lighting/fog layer
  - Particle layer
  - HUD overlay

## Audio Direction

Use Web Audio only, generated at runtime:

- Short repair blips.
- Low oxygen warning pulse.
- Door unlock click.
- Soft ambience drone.
- Mute toggle stored in `localStorage`.

No audio files.

## Difficulty Model

Sector difficulty should increase through:

- Larger map.
- More required repairs.
- Tighter oxygen/battery budget.
- More hazards.
- Less initial visibility.
- More interaction between systems.

Avoid raw speed increases as the main difficulty lever.

## MVP Scope

The first playable milestone should include:

- Title/start/settings overlay.
- One generated sector template family.
- Drone movement and interaction.
- Power relay and exit unlock.
- Oxygen or battery pressure.
- Win advances to next sector.
- Failure returns to sector 1.
- Canvas rendering with lighting/fog.
- `localStorage` best sector and mute setting.
- Static verification and manual browser smoke test notes.

## Stretch Scope

- Multiple biome/sector themes.
- Log entries unlocked by reaching sector thresholds.
- Minimap scanner pulse.
- Patrol route hazards.
- Procedural event director.
- Accessibility settings for reduced motion and high contrast.
- Deterministic seeded runs.

## Quality Bar

Before calling it flagship-quality:

- Loads directly from `file://` and GitHub Pages.
- No console errors during start, sector clear, failure, restart, and settings changes.
- Mobile portrait layout is playable without precision frustration.
- Desktop keyboard controls are complete.
- The first sector teaches itself without a wall of text.
- A run has meaningful decisions after the first minute.
- Visual/audio feedback makes state changes obvious.
- Code is modular enough that another agent can modify one subsystem without reading the whole game.

## Implementation Sequence

1. Add flagship repository rules and plan document.
2. Add a minimal `flagship/deep-station-recovery-log/` shell.
3. Implement engine loop, input, and canvas renderer.
4. Implement one handcrafted sector to validate the feel.
5. Add procedural sector generation after the handcrafted loop works.
6. Add resource pressure, hazards, and sector progression.
7. Add generated audio, particles, lighting polish, and persistence.
8. Add browser smoke test or documented manual QA checklist.

## Open Decisions

- Whether the root catalog should include a separate featured flagship card.
- Whether flagship verification should be added to `tools/verify-repo.js` or kept as a separate `tools/verify-flagship.js`.
- Whether local ES modules should be allowed for daily games too, or only for flagship games.
- Whether generated inline SVG is acceptable if stored as code rather than as an asset file.
