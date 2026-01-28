# Vehicle Combat Tracker - Roadmap

## Planned Features

### Ship Combat Support (Ghosts of Saltmarsh)

**Goal**: Extend the tracker to support naval combat from Ghosts of Saltmarsh and similar modules.

#### Phase 1: Foundation
- [ ] Add `category` field to vehicle templates: `'land' | 'water' | 'air'`
- [ ] Create ship templates from GoS:
  - Galley (HP 500, AC 15, Speed 4 mph)
  - Keelboat (HP 100, AC 15, Speed 1 mph)
  - Longship (HP 300, AC 15, Speed 3 mph)
  - Rowboat (HP 50, AC 11, Speed 1.5 mph)
  - Sailing Ship (HP 300, AC 15, Speed 2 mph)
  - Warship (HP 500, AC 15, Speed 2.5 mph)
- [ ] Add ship zones: Hull, Deck, Helm, Crow's Nest, Below Deck
- [ ] Add ship weapons: Ballista, Mangonel, Cannon (if using firearms)

#### Phase 2: Ship-Specific Mechanics
- [ ] **Component Targeting**: Ships have components that can be targeted separately
  - Hull (structure)
  - Sails/Oars (propulsion)
  - Helm (steering)
  - Each has its own AC and HP
  - Destroying components has specific effects
- [ ] **Officer Roles**: Special crew positions with unique abilities
  - Captain: Commands, grants bonuses
  - First Mate: Coordinates crew
  - Bosun: Repairs, maintains ship
  - Quartermaster: Manages supplies
  - Surgeon: Heals crew
- [ ] **Ship Actions**: Ram, Boarding, Shearing

#### Phase 3: Environmental Mechanics
- [ ] **Wind System**:
  - Wind direction indicator on map
  - Wind strength: Calm, Light, Moderate, Strong, Gale
  - Effect on sailing speed (with/against/across wind)
  - Random wind changes per round option
- [ ] **Current System**:
  - Current direction and strength
  - Effect on all ships' movement
  - River vs ocean currents
- [ ] **Weather Conditions**:
  - Clear, Fog, Rain, Storm
  - Visibility effects
  - Combat modifiers

#### Phase 4: Ship Mishaps & Complications
- [ ] **Ship Mishap Table** (separate from vehicle mishaps):
  - Hull Breach: Taking on water, requires repairs
  - Rigging Damage: Reduced speed
  - Rudder Jammed: Cannot turn
  - Fire on Deck: Spreading damage
  - Crew Overboard: Random crew members fall
  - Mast Collapse: Major speed/maneuverability loss
- [ ] **Naval Complications** (chase-style events):
  - Rogue Wave: DEX save or crew thrown
  - Sudden Squall: Wind direction changes
  - Reef Spotted: Navigation check or hull damage
  - Sea Monster Sighting: Morale check
  - Fog Bank: Visibility reduced
  - Whirlpool: Strength check to escape

#### Phase 5: Polish
- [ ] Ship token icons (different silhouettes per ship type)
- [ ] Water-themed battlefield backgrounds
- [ ] Speed display in knots/mph for ships
- [ ] Sailing tutorial in Help Guide

---

### Flying Fortress Support (Avernus)

**Goal**: Add support for Flying Fortresses from Baldur's Gate: Descent into Avernus.

- [ ] Flying Fortress template
- [ ] 3D positioning (altitude tracking)
- [ ] Aerial combat rules
- [ ] Landing/takeoff mechanics

---

### General Improvements

- [ ] Code splitting for smaller bundle size
- [ ] Offline PWA support
- [ ] Export combat log to PDF
- [ ] Import/export encounters as JSON
- [ ] Encounter templates library
