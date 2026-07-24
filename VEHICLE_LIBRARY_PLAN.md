# Vehicle Library — Plan

## Goal
Evolve VVTT from an Avernus-specific tracker into a general vehicular VTT by letting
**users author their own vehicle templates**. Ship a **personal (private) template library
first**; design toward an eventual **shared community library** so vehicles can be reused
across users and campaigns (land chases, naval/boat combat, other settings).

The 5 built-in Avernus vehicles remain as first-class entries — nothing about the current
experience regresses.

## Decisions (as of 2026-07-24)
- **Start:** write this doc, then Phase 0 → Phase 1 (personal library). No public tier yet.
- **Sharing model:** personal-only for now; community/shared tier deferred.
- **IP posture (for the eventual shared tier):** allow any content, **moderate reactively**
  (report + takedown) rather than gating uploads. See risk note under "Trust & Safety".

## Current State

### What's already good
- `VehicleTemplate` is a clean, campaign-agnostic interface — `src/types/index.ts:185`
  (id, name, `maxHp`, `ac`, `speed`, `damageThreshold`, `mishapThreshold`, `crewCapacity`,
  `zones[]`, `weapons[]`, `traits`, `reactions`, `size`, `immunities`). Nothing in the shape
  is inherently Avernus.
- A `Vehicle` **instance embeds a full copy of its template** — `src/types/index.ts:210`
  (`template: VehicleTemplate`). Adding a template to an encounter takes a **snapshot**, so a
  later edit/delete of the source template cannot break saved encounters. This is the key
  property that makes a shared library safe.
- Consumers go through **one seam**: `getTemplate(id)` and the `VEHICLE_TEMPLATES` array
  (`src/data/vehicleTemplates.ts:720`, `:729`). ~11 files import from this module but almost
  all resolve via that seam.

### What's Avernus-coupled (the actual work)
- **The data, not the shape:** `VEHICLE_TEMPLATES` is a hard-coded array of 5 vehicles —
  Devil's Ride, Buzz Killer, Tormentor, Demon Grinder, Scavenger
  (`src/data/vehicleTemplates.ts:335-720`).
- **Flavored subsystems** shipped alongside vehicles, all land-chase / infernal-specific:
  - Armor upgrades — `ARMOR_UPGRADES` (Canian, Gilded Death, Soul Spike), `:96`
  - Magical gadgets — `MAGICAL_GADGETS` (Necrotic Smoke Screen, Teleporter), `:139`
  - Mishap table — `src/data/mishapTable.ts`
  - Chase complications — `src/data/chaseComplications.ts`
- **Storage is per-user** — Firestore rules scope everything to `users/{uid}/…`
  (`firestore.rules`). A *globally shared* collection is new rule surface.

## Architecture — Three-Tier Template Registry

Replace the static `VEHICLE_TEMPLATES` array + direct `getTemplate()` with a **template
provider** that merges sources behind one interface. Downstream code keeps asking for a
template by id and does not care where it came from.

| Tier | Storage | Visibility | Notes |
|---|---|---|---|
| **Built-in** | shipped in code (as today) | everyone | Avernus vehicles + small generic/boat starter set. Offline-safe, never breaks. |
| **Personal** | `users/{uid}/vehicleTemplates` | that user only | Homebrew. **Zero moderation risk — build first.** |
| **Community** *(deferred)* | top-level `sharedVehicleTemplates/{id}` | everyone reads; author writes | The shared library. Not in initial scope. |

### The seam
- Today: `getTemplate(id)` is a synchronous lookup over a static array.
- Target: a registry/provider (mirrors the existing `storageService` abstraction) that
  aggregates built-in + personal (+ later community) templates. Likely becomes async /
  cached. All current call sites route through it.
- Because instances snapshot their template, the registry only matters at **add-vehicle
  time** and in the **library/editor UI** — not in combat rendering.

## De-Avernus-ifying Mechanics

Extract campaign-flavored systems into a **ruleset / campaign pack** a template references,
instead of hard-wiring them:

- **Mishap table & chase complications** are land-chase-specific. A naval pack wants its own
  ("taking on water", "sails torn", "boarding"). Templates point at a `mishapTableId` /
  `complicationTableId` rather than assuming the Avernus tables.
- **Armor upgrades & magical gadgets** → move into the Avernus pack; gate the upgrades UI on
  the vehicle's pack so a rowboat doesn't show infernal gadget slots.
- **Environment:** add `environment: 'land' | 'water' | 'air'` to templates/encounters.
  The existing arc system (`front/rear/left/right`, `visibleFromArcs`) already models
  **broadsides**, so naval combat largely falls out of the current zone/arc model.
- Make Avernus-only fields **optional** so non-infernal vehicles aren't forced to define
  mishap thresholds, gadget slots, etc.

## Template Metadata (additions to `VehicleTemplate`)
All additive and optional so existing saved encounters deserialize unchanged:
- `source: 'builtin' | 'personal' | 'community'`
- `authorId?`, `authorName?` (attribution)
- `pack?` / `campaign?` (e.g. `'avernus'`, `'generic'`, `'naval'`)
- `environment?: 'land' | 'water' | 'air'`
- `tags?: string[]`, `createdAt?`, `updatedAt?`, `version?`
- `mishapTableId?`, `complicationTableId?` (ruleset references)

## Scope — What to Build (initial: Phases 0–1)

### Phase 0 — Registry refactor (no behavior change)
- Introduce the template provider; route `getTemplate()` / list access through it.
- Built-in tier = today's `VEHICLE_TEMPLATES`. **No user-visible change.** Pure de-risk.

### Phase 1 — Personal library + template editor
- Firestore collection `users/{uid}/vehicleTemplates` + a `vehicleTemplateService`
  (mirror `storageService`/`firestoreService` pattern).
- **Template builder UI** ("vehicle template entry capability"): create / edit / duplicate /
  delete a vehicle template — stats, zones, weapons, traits, size, environment.
  - Consider "duplicate a built-in as a starting point" for fast authoring.
- Add-vehicle picker surfaces **Built-in + My Templates**.
- No moderation needed (private data under existing per-user rules).

### Deferred (later phases)
- **Phase 2 — Community tier:** publish personal → shared, read to all. Open uploads with
  **reactive moderation** (report button + admin takedown), attribution, usage counts,
  optional "official" badge. New Firestore rules for `sharedVehicleTemplates`.
- **Phase 3 — Rulesets/packs + environments:** naval pack, generic pack, per-pack mishap /
  complication tables, water/air movement.

## Trust & Safety (applies when the community tier is built)
- Chosen posture: **allow any content, moderate reactively.**
- **Risk note (flagged, not blocking):** reactive moderation of a public, user-writable
  library carries real exposure — spam/offensive content and **copyright** (users uploading
  official published statblocks). Mitigations to design in later: report/flag path, admin
  takedown + soft-delete, author attribution, rate limits, and Firestore-rule schema
  validation on the untrusted `sharedVehicleTemplates` writes. Keeping official content in
  the built-in tier (vs. re-published by users) reduces IP surface.

## Safety — Will This Disrupt Saved Sessions?
**No, if we follow the same additive rules as the combat-log plan:**
- Instances embed a template snapshot → existing encounters are immune to template edits.
- **Only add, never rename/restructure** `VehicleTemplate` / `Vehicle`; new fields optional.
- Migration on load must tolerate templates lacking the new metadata (default
  `source: 'builtin'`, no `pack`, etc.), same way `faction` was back-filled on creatures.

## Files to Touch (Phases 0–1)
- `src/data/vehicleTemplates.ts` — becomes the built-in tier; extract `getTemplate` seam.
- `src/services/` — new `vehicleTemplateService.ts` (+ Firestore/local impls).
- `src/types/index.ts` — additive metadata fields on `VehicleTemplate`.
- New: `src/components/vehicles/VehicleTemplateEditor.tsx` (builder UI) + a library/picker view.
- `src/context/CombatContext.tsx` — route template resolution through the registry.
- `firestore.rules` — rules for `users/{uid}/vehicleTemplates`.

## Open Questions
- Editor depth: guided builder vs. raw stat form (or both — advanced/JSON mode)?
- Do we ship a small **generic/SRD-safe starter set** in built-in (e.g. rowboat, wagon,
  sailing ship) to prove "beyond Avernus" before any community tier exists?
- Naming: are per-vehicle mishap/complication tables worth it in Phase 1, or defer entirely
  to the ruleset-pack phase and keep Phase 1 vehicles reusing the Avernus tables?
- Should personal templates be exportable/importable as JSON (a poor-man's sharing path that
  sidesteps moderation entirely)?
