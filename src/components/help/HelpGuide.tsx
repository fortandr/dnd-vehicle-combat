/**
 * Help Guide Component
 * How-to guide for new users
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import GroupIcon from '@mui/icons-material/Group';
import MapIcon from '@mui/icons-material/Map';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SailingIcon from '@mui/icons-material/Sailing';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import GroupsIcon from '@mui/icons-material/Groups';
import SaveIcon from '@mui/icons-material/Save';
import CasinoIcon from '@mui/icons-material/Casino';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

interface HelpGuideProps {
  open: boolean;
  onClose: () => void;
}

export function HelpGuide({ open, onClose }: HelpGuideProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h5" component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
          VVTT
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ ml: 1 }}>
          Quick Start Guide
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" paragraph>
          VVTT (Vehicular Virtual Table Top) helps you run tactical vehicle combat and chases
          for D&D 5e — from the infernal war machines of Baldur's Gate: Descent into Avernus to
          the ships of Ghosts of Saltmarsh, plus any custom vehicles you build yourself.
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          The app lives at <strong>vvtt.lukantan.com/app</strong> (bookmark that; the root address is the
          public landing page). Sign in with Google so your encounters, custom vehicles, and party presets
          sync to the cloud. If you opened this link inside another app's browser (Reddit, Discord, Instagram),
          sign-in won't work there — open it in Safari or Chrome instead.
        </Typography>

        <Box sx={{ p: 1.5, mb: 2, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewModuleIcon fontSize="small" color="primary" />
            <strong>Tip:</strong> Use the <strong>Map</strong> and <strong>Vehicles</strong> tabs in the main panel
            to switch between the battlefield view and vehicle management.
          </Typography>
        </Box>

        {/* 1. Add Vehicles */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DirectionsCarIcon color="primary" />
              <Typography fontWeight={600}>1. Add Vehicles</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Click <strong>+ Vehicle</strong> above the map and choose <strong>Add Party Vehicle</strong> or
              <strong> Add Enemy Vehicle</strong>. Party vehicles are green; enemy vehicles are red. The picker lists:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2 }}>
              • <strong>Avernus war machines</strong> — the infernal vehicles (Devil's Ride, Demon Grinder, …)<br />
              • <strong>Ships</strong> — the six Ghosts of Saltmarsh vessels (rowboat, keelboat, longship, sailing
                ship, warship, galley), each drawn as its own top-down boat token<br />
              • <strong>Your custom vehicles</strong> — templates from your personal library, tagged <strong>Custom</strong>
            </Typography>
            <Typography variant="body2" paragraph sx={{ mt: 1.5 }}>
              <strong>Your vehicle library:</strong> in the same picker, click <strong>Create Custom Vehicle</strong> to
              build a template from scratch, or <strong>Duplicate &amp; edit</strong> on any built-in vehicle to start
              from a copy. Your own templates have <strong>edit</strong>, <strong>duplicate</strong> and
              <strong> delete</strong> icons. The editor covers name, size, environment, core stats, and lists of
              <strong> Components (per-part HP)</strong>, <strong>Crew Zones</strong> and <strong>Weapons</strong>. Leave
              Components empty for a single-HP vehicle. A custom vehicle copied from a ship, or set to the water
              environment, gets the ship features in section 5.
            </Typography>
            <Typography variant="body2">
              <strong>Managing vehicles:</strong> the <strong>Vehicles</strong> tab shows a full card for each vehicle:
              stats, crew positions, crew HP, damage and repair. The card adapts to the vehicle — war machines show
              Customization and mishaps; ships show Components and Ship Upgrades.
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* 2. Creatures & Crew */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GroupIcon color="primary" />
              <Typography fontWeight={600}>2. Creatures &amp; Crew</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              The left sidebar has two lists:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1.5 }}>
              • <strong>Player Characters → Add PC:</strong> pick a class under <strong>Quick Add by Class</strong>, or
                fill in <strong>Or Custom PC</strong> (name, HP, AC, Init, Speed, DEX Save)<br />
              • <strong>NPCs / Enemies → Add:</strong> choose <strong>Search Open5e</strong> to find a monster (set a
                <strong> Quantity</strong> to add up to 20 at once), or <strong>Custom NPC</strong> for a quick preset or
                your own stats
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Factions:</strong> each creature is <strong>Party</strong> or <strong>Enemy</strong>. PCs default to
              Party and monsters to Enemy; change it with the edit (pencil) button on the creature's row.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Seat crew:</strong> on a vehicle card's <strong>Crew Positions</strong>, click the
              <strong> +</strong> on a station and pick a creature, or choose <strong>+ New crew here</strong> (or
              <strong> + New pilot here</strong> / <strong>+ New passenger here</strong>) to create a character directly
              in that seat.
              Click a seated creature to move it to another station, swap it with another crew member, or
              <strong> Exit Vehicle</strong> to put it on the battlefield.
            </Typography>
            <Typography variant="body2" component="div">
              • The <strong>Helm</strong> is the driver; a vehicle with crew needs someone at the Helm before combat<br />
              • <strong>Weapon stations</strong> let a crew member fire that weapon<br />
              • Every ship has a <strong>Passengers</strong> zone for the party, separate from the working crew<br />
              • Big stations such as a ship's <strong>Deck Crew / Rowers</strong> show a count (e.g. 5 / 73) instead of
                one slot per sailor
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* 3. Battlefield */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MapIcon color="primary" />
              <Typography fontWeight={600}>3. Battlefield</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              On the <strong>Map</strong> tab, drag tokens to place them and use a vehicle's rotate buttons
              (45° each) to change its facing. <strong>Layers</strong> toggles distance lines, weapon arcs, and HP bars
              &amp; names.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Map image:</strong> click <strong>BG</strong> above the map, then <strong>Upload Image</strong>.
              Set its opacity, size, and <strong>Feet per pixel</strong> (quick buttons 0.5 / 1 / 5 / 10) so the map
              matches your vehicles.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Map resize:</strong> if you rescale the image after placing tokens, the <strong>Map Resize
              Warning</strong> asks whether to <strong>Scale Positions</strong> (tokens move with the image) or
              <strong> Keep Positions</strong>. Tick <strong>Remember my choice</strong> to stop it asking; change it
              later under ☰ → Settings → "When the battlemap is rescaled" (Ask me each time / Scale token positions /
              Keep token coordinates).
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Zoom &amp; pan:</strong> use <strong>−</strong> / <strong>+</strong>, <strong>Fit</strong> (frame every
              token), and <strong>Reset</strong>. Drag empty map to pan. You can always pan or zoom out to any token,
              even one outside the image edge, so nothing gets stranded.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Elevation zones</strong> represent hills, cliffs, and other high ground. Open <strong>BG</strong> →
              <strong> Elevation</strong>, click <strong>+ Add Zone</strong>, then set its name, elevation, position, and
              size (or drag it into place and resize it with the corner handles). When attacking between elevations:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1 }}>
              • <strong>High ground (10 ft or more above):</strong> +2 to attack rolls<br />
              • <strong>Low ground (10 ft or more below):</strong> −2 to attack rolls<br />
              • <strong>Firing downward</strong> extends weapon range by 10% per 10 ft of elevation
            </Typography>
            <Typography variant="body2" paragraph>
              <em>Elevation zones are locked during combat to prevent accidental changes.</em>
            </Typography>
            <Typography variant="body2">
              <strong>Wind:</strong> when a sailing ship is on the map, the toolbar shows a <strong>Wind</strong> selector:
              <strong> Calm</strong> or the compass direction it blows from. A wind arrow appears on the map and the
              Player View. See section 5 for how wind changes ship speed.
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* 4. Run Combat */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlayArrowIcon color="primary" />
              <Typography fontWeight={600}>4. Run Combat</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              <strong>Initiative:</strong> the dice icon next to <strong>Player Characters</strong> rolls for every PC
              (and party ship); the one next to <strong>NPCs / Enemies</strong> rolls for every NPC (and enemy ship). You
              can also type a creature's Init in its edit form. A war machine acts on its driver's initiative; with no
              driver it acts last. Ships roll their own (section 5).
            </Typography>
            <Typography variant="body2" paragraph>
              Click <strong>Start Combat</strong>. If it's disabled, hover it to see what's missing: every PC needs
              initiative, every driver needs a DEX save, and every crewed vehicle needs someone at the Helm.
            </Typography>
            <Typography variant="body2" component="div" sx={{ mb: 1.5 }}>
              • <strong>Next Turn</strong> moves down the initiative order; <strong>Next Round</strong> starts a new round
                once every turn is done<br />
              • Only the active vehicle or creature can move. Tick <strong>Reposition Mode</strong> under
                <strong> Layers</strong> to move any token freely, and <strong>↩ Undo</strong> reverts the last move<br />
              • <strong>Back to Setup</strong> pauses combat to adjust positions; <strong>Finish Combat</strong> ends it and
                shows a summary; ☰ → <strong>Reset Combat</strong> restores HP and turns but keeps vehicles and creatures
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Combat scales:</strong> the scale bar shows the current range band and adjusts as vehicles close in.
              Movement per round scales with it:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1.5 }}>
              • <strong>Point-Blank</strong> (under 100 ft): boarding and melee range<br />
              • <strong>Tactical</strong> (100–1,000 ft): standard weapon combat<br />
              • <strong>Approach</strong> (1,000 ft – 1 mile): closing distance<br />
              • <strong>Strategic</strong> (1 mile+): long-range pursuit
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Current Turn panel</strong> (right side): shows the active vehicle or creature, its speed, driver, and
              every crew member with HP and AC. Click a manned weapon station to expand it and see the weapon's to-hit,
              damage, and range.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Click-to-roll dice:</strong> any underlined dice notation (e.g. 5d10, 2d10+8, 1d20+6) in weapons,
              traits, mishaps, gadgets, armor, and ship upgrades can be clicked. The result pops up and goes to the
              combat log.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Target Status panel</strong> (right side, during combat) lists each opposing vehicle and its crew as
              seen from the active vehicle or creature:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1 }}>
              • <strong>Cover:</strong> None, Half (+2 AC), Three-quarters (+5 AC), or Full<br />
              • <strong>Attack arc:</strong> which side you're attacking from<br />
              • <strong>Distance</strong> and <strong>In Range / Out of Range</strong> for your manned weapons<br />
              • <strong>Elevation modifier:</strong> the high- or low-ground bonus or penalty<br />
              • <strong>Ship components:</strong> for ships, each part (hull, helm, sails/oars, weapons) with its AC, HP,
                and damage threshold
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Applying damage:</strong> type an amount in a target's <strong>Dmg</strong> box and click
              <strong> Damage</strong> — on a war machine, a crew member, or an individual ship component. You can also
              deal damage and heal from the <strong>Vehicles</strong> tab.
            </Typography>
            <Typography variant="body2">
              <strong>Combat log:</strong> every roll, move, and complication is logged below the map. The export icon
              offers <strong>Copy as Markdown</strong>, <strong>Copy as JSON</strong>, or <strong>Download .md</strong> —
              handy for a session recap.
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* 5. Ships */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SailingIcon color="primary" />
              <Typography fontWeight={600}>5. Ships (Ghosts of Saltmarsh)</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              <strong>Components:</strong> ships take damage part by part instead of rolling mishaps. The hull, helm,
              sails/oars, and each weapon station has its own AC and HP in the card's <strong>Components</strong> panel
              (and in Target Status); damage below a part's damage threshold is ignored. A destroyed part has
              consequences:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1 }}>
              • <strong>Hull</strong> — the ship is wrecked<br />
              • <strong>Helm</strong> — the ship can't turn (its rotate buttons disappear)<br />
              • <strong>Sails / oars</strong> — that propulsion is lost; speed drops to 0 if all of it is gone<br />
              • <strong>Weapon</strong> — that weapon can no longer fire
            </Typography>
            <Typography variant="body2" paragraph>
              Click <strong>Repair</strong> on a component to restore it to full HP.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Speed:</strong> a ship's speed is worked out from its sails and oars, and its card shows the current
              speed and why (e.g. "with wind", "−10 ft (damage)"):
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1 }}>
              • <strong>Wind:</strong> sails use their with-wind speed when the ship heads within 45° of downwind, their
                into-wind speed within 45° of upwind, and normal speed otherwise. Turning mid-move changes the remaining
                movement right away<br />
              • <strong>Damage:</strong> sails and oars lose speed as they take damage<br />
              • <strong>Rowers:</strong> oars need their minimum crew (longships and warships 20, galleys 40). The
                Passengers zone and fallen crew don't count; an <strong>Oars undermanned</strong> badge explains a stop
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Ship initiative:</strong> ships roll their own initiative (d20 + the ship's DEX + crew quality) with
              the same dice icons you use for creatures: the NPC icon rolls enemy ships, the PC icon rolls party ships.
              Before combat you can click a ship's <strong>Init</strong> chip in the sidebar's Vehicles list to edit it.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Crew quality:</strong> the <strong>Crew</strong> tile next to AC and Speed on the ship's card
              (default +4, range −10 to +10) adds to ship initiative.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Ship actions:</strong> on a ship's turn, the Current Turn panel shows how many ship actions its crew
              allows (e.g. a galley gets 3 with 40+ crew aboard). Moving the ship ticks <strong>Move</strong>, and rolling
              a weapon from its station ticks that Fire action. Click a chip to tick or untick it by hand (Move stays
              ticked once the ship has moved). Going over
              budget is allowed; it just shows in red. Fallen crew and passengers don't count.
            </Typography>
            <Typography variant="body2">
              <strong>Ship Upgrades:</strong> open <strong>Ship Upgrades</strong> on the card to install Superior Ship
              Upgrades (hull, movement, weapon, figurehead, and miscellaneous), such as Reinforced Hull or Ever-Full
              Sails. They're grouped by category so you can honour the book's limits; VVTT lets you toggle them freely.
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* 6. Avernus War Machines */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalFireDepartmentIcon color="primary" />
              <Typography fontWeight={600}>6. Avernus War Machines</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              The built-in war machines have a <strong>Customization</strong> section on their card:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1.5 }}>
              • <strong>Armor Upgrade</strong> — pick one (e.g. Canian Armor, Gilded Death Armor, Soul Spike Armor); its
                defenses show on the card<br />
              • <strong>Magical Gadgets</strong> — tick to install (e.g. Necrotic Smoke Screen, Teleporter)<br />
              • <strong>Weapon Stations</strong> — on vehicles with a swappable station, choose which weapon it carries<br />
              • <strong>Weapon Station Upgrade</strong> — add a custom weapon station (not available on the Devil's Ride)
            </Typography>
            <Typography variant="body2">
              <strong>Mishaps:</strong> vehicles without per-part components (war machines and single-HP custom vehicles)
              use the mishap system. When one hit deals damage at or above the vehicle's mishap threshold, a mishap is
              rolled and applied automatically; <strong>Roll Mishap (d20)</strong> rolls one by hand. Active mishaps are
              listed on the card with their repair check, and <strong>Repair</strong> clears a repairable mishap. Ships
              and other component-based vehicles never roll mishaps.
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* 7. Battle Mode */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GroupsIcon color="primary" />
              <Typography fontWeight={600}>7. Battle Mode: Squads &amp; Morale</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              <strong>The Squads tab</strong> sits next to Map and Vehicles. Click <strong>+ New squad</strong>, name it,
              pick <strong>Enemy</strong> or <strong>Party</strong>, then use <strong>Staff</strong> the way you crew a
              vehicle: <strong>Existing creature…</strong> (one not already in a squad or on a vehicle),
              <strong> Monster search…</strong> or <strong>Custom NPC…</strong> (quantity 1 adds one creature; 2 or more
              adds one <em>stack</em> such as &quot;Hobgoblin ×8&quot;, up to 50), or <strong>Add bodies…</strong> to a
              stack. Squads can mix creature types, for example a captain, Hobgoblin ×8, archers ×4 and Karkajuk. Adding
              several monsters from the sidebar&apos;s Open5e search always adds separate numbered creatures.
            </Typography>
            <Typography variant="body2" paragraph>
              Each member&apos;s menu has <strong>Make leader ★</strong> (or <strong>Clear leader</strong>),
              <strong> Remove from squad</strong> (it becomes a standalone creature where the squad stands; in combat it
              acts right after the current turn), <strong>Split off 1</strong> (stacks only) and
              <strong> View statblock</strong>. The squad menu has <strong>Disband</strong> (members stay as standalone
              creatures), <strong>Delete squad and members</strong> and <strong>Reset morale</strong>. Members at 0 HP or
              0 bodies stay on the card, greyed out. In the sidebar, members are listed under their squad.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>In combat</strong> a squad takes one initiative slot and one map token (<strong>Place on map</strong>
              on its card). The token shows the squad&apos;s name, how many still stand against how many started (e.g.
              13/14), the leader&apos;s ★ and its morale. The player view shows the same token, never the members. On the
              squad&apos;s turn the right panel lists every standing member with an attack and a target:
              <strong> Roll all</strong> rolls every attack of every body (natural 20 crits, natural 1 misses; not the
              DMG 2014 p. 250 mob shortcut), then <strong>Apply hits</strong> sends each hit to its target.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>PC commanders:</strong> pick a PC in the card&apos;s <strong>Commander</strong> menu. The PC keeps
              their own turn; the squad acts right after them and follows them if their initiative changes. A PC can
              command one squad and is never a member.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Hurting squads:</strong> <strong>Hit…</strong> and <strong>Area…</strong> are on the squad card and
              on the token&apos;s right-click menu. A hit on a stack damages its front body only and overkill is lost.
              Area… suggests how many are caught from the DMG area-of-effect table (DMG 2014 p. 249 or DMG 2024 p. 82, pick
              the edition with the <strong>DMG rules</strong> toggle at the top of the dialog), caps it at the number standing, and splits it across members; every count
              can be edited. Each caught body saves with its own member&apos;s bonus. Healing works per member and never
              revives a fallen body. Switch on <strong>Magical damage</strong> when the damage comes from a magic weapon or spell, so
              resistances to nonmagical attacks don&apos;t apply.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Morale (DMG 2014 p. 273, optional rule; the 2024 DMG has none):</strong> a morale card appears when
              a squad&apos;s leader goes down (0 HP, dead or incapacitated) or the squad drops to half strength, and when
              a lone monster drops to half its HP. The leader makes the DC 10 Wisdom save. A failed save marks the squad
              <strong> Fleeing</strong> on its card, its turn and its token on both maps; click the chip on the card to
              change it to <strong>Surrendered</strong> or clear it. PCs never make morale saves.
            </Typography>
            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
              <strong>VVTT rules</strong> (not in the books, to keep big fights fast):
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1 }}>
              • <strong>VVTT rule 1 — default hit target:</strong> in 5e the attacker picks; Hit… defaults to the largest
              stack (the front rank), never the leader.<br />
              • <strong>VVTT rule 2 — area split:</strong> the area&apos;s total is split by standing bodies (an individual
              counts 1), largest remainder first, never more than a member has standing.<br />
              • <strong>VVTT rule 3 — morale without a leader:</strong> the largest standing stack saves; with no stacks,
              the first standing member.<br />
              • <strong>VVTT rule 4 — half strength:</strong> standing members (each stack body and each individual counts
              1) at or below half of the count when combat started.<br />
              • <strong>VVTT rule 5 — squad initiative:</strong> a commanded squad acts right after its commander; otherwise
              d20 + the leader&apos;s DEX modifier (else the first member&apos;s), rolled with the PC button for party
              squads and the NPC button for enemy squads.<br />
              • Each morale trigger is asked once per battle; fleeing and surrendered squads keep their initiative slot;
              squad tokens move freely (no movement budget); Multiattack rolls its count of the first attack.
            </Typography>
            <Typography variant="body2">
              <strong>Older saves:</strong> squads from v2.11–v2.12 open as a squad holding a stack, with their old leader
              as a member. A leader shared by several squads joins only the first.
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* 8. Chase Complications */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CasinoIcon color="primary" />
              <Typography fontWeight={600}>8. Chase Complications</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Chase complications add random hazards to the encounter. Click <strong>Complication</strong> →
              <strong> Roll Random Complication</strong>. The table depends on the current combat scale.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Auto-roll at End of Round</strong> in the same menu makes the roll happen automatically each time
              you click <strong>Next Round</strong>. It's off by default, saved with the encounter, and shows a green
              check in the menu while it's on.
            </Typography>
            <Typography variant="body2">
              Complications may include terrain hazards, creature attacks, or environmental effects. When one calls for
              a check, a dialog lets you roll or enter each affected vehicle's save; a Creature Chase lets you add the
              creature that joins the chase.
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* 9. Saving & Loading */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SaveIcon color="primary" />
              <Typography fontWeight={600}>9. Saving &amp; Loading</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              <strong>Encounters:</strong> use ☰ → <strong>Save</strong> (and <strong>Save As...</strong>) to add the
              encounter to your list, and <strong>Load Encounter</strong> to reopen one. When you're signed in, they're
              saved to the cloud, so you can open them on any device. <strong>New Encounter</strong> starts fresh.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Auto-save:</strong> your current encounter is also saved in this browser as you play (on every turn,
              round and phase change, and every 60 seconds); the header shows the last auto-save time.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Party presets:</strong> <strong>Party Preset</strong> → <strong>Save Party</strong> stores your party
              vehicles, party-faction creatures, and their crew assignments (enemies are not included).
              <strong> Load Party</strong> brings them into the current encounter, replacing its party vehicles and
              keeping enemy vehicles.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Player View:</strong> click <strong>Player View</strong> above the map to open a second window (put it
              on a TV or second screen) that shows players a synced battlefield without DM controls. Settings →
              <strong> Show Vehicle Health</strong> controls whether vehicle HP is shown there.
            </Typography>
            <Typography variant="body2">
              <strong>Settings</strong> (☰ menu) also holds distance units (feet or metres) and the map-resize behaviour
              described in section 3. <strong>What&apos;s New</strong> lists recent changes.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary">
          Based on the vehicle combat rules from Baldur's Gate: Descent into Avernus and the ship
          rules from Ghosts of Saltmarsh (D&D 5e).
          <br />
          Found a bug or want a feature? Use ☰ → <strong>Report Issue / Feedback</strong>, or open an issue
          on GitHub.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );
}
