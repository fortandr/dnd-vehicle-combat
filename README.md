# VVTT — Vehicular Virtual Table Top

A tactical **vehicle combat and chase** tracker for D&D 5e. VVTT runs the combat/chase phase of
vehicular encounters — from the infernal war machines of *Baldur's Gate: Descent into Avernus* to
the ships of *Ghosts of Saltmarsh* — plus any custom vehicles you build yourself.

**Live:** https://vvtt.lukantan.com

## Features

- **Two built-in vehicle rulesets, cleanly separated by pack:**
  - **Avernus war machines** — Devil's Ride, Buzz Killer, Tormentor, Demon Grinder, Scavenger — with
    armor upgrades, magical gadgets, weapon stations, and the mishap system.
  - **Ghosts of Saltmarsh ships** — rowboat, keelboat, longship, sailing ship, warship, galley — with
    per-component HP, siege weapons, and the Superior Ship Upgrades pack.
- **Custom vehicle library** — build your own vehicles in the editor (or duplicate a built-in), saved
  per-user. Content shown on a vehicle adapts to its type automatically.
- **Component combat (ships)** — each part (hull, helm, sails/oars, weapon stations) tracks its own HP
  with targeted damage and repair. Destroying a part has effects: no sails/oars → speed cut, no helm →
  can't turn, weapon destroyed → can't fire, hull destroyed → wrecked.
- **Tactical battlefield** — drag/rotate tokens scaled to real dimensions, cover & arcs, elevation zones,
  weapon range arcs, auto-adjusting combat scales, and a synced player view.
- **Target Status** — per-target cover, arc, distance, range, elevation, and (for ships) each targetable
  component's AC & HP.
- **Crew & passengers** — seat creatures at stations (or create one directly in a seat); ships add a
  Passengers zone and bulk deck-crew counts.
- **Click-to-roll dice** — click any dice notation (weapon damage, to-hit, effects) to roll it.
- **Cloud sync & sharing** — Firebase auth + Firestore, party presets, combat-log export, player view.

## Tech stack

React 18 · TypeScript · Vite · Material UI · Firebase (Auth / Firestore / Hosting / Storage).

## Development

```bash
npm install       # install dependencies
npm run dev       # run locally (Vite dev server)
npx tsc --noEmit  # type-check
npm run build     # production build (tsc -b && vite build)
CI=true npm run deploy   # build + deploy hosting/firestore/storage to Firebase
```

See `CLAUDE.md` for architecture notes and `NAVAL_MECHANICS_SALTMARSH.md` for the transcribed ship rules.
