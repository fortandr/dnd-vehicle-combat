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
import SaveIcon from '@mui/icons-material/Save';
import CasinoIcon from '@mui/icons-material/Casino';
import TerrainIcon from '@mui/icons-material/Terrain';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
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

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DirectionsCarIcon color="primary" />
              <Typography fontWeight={600}>1. Add Vehicles</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Use the <strong>"+ Vehicle"</strong> dropdown to add Party or Enemy vehicles. The picker
              offers three kinds of vehicle:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2 }}>
              • <strong>Avernus war machines</strong> — the infernal vehicles (Devil's Ride, Demon Grinder, …)<br />
              • <strong>Ships</strong> — the six Ghosts of Saltmarsh vessels (rowboat, keelboat, longship, sailing ship, warship, galley)<br />
              • <strong>Your custom vehicles</strong> — build one with <strong>"+ Create Custom Vehicle"</strong>, or
                duplicate a built-in as a starting point. Custom vehicles are saved to your personal library.
            </Typography>
            <Typography variant="body2" paragraph sx={{ mt: 1 }}>
              • <strong>Party vehicles</strong> (green) are the players'; <strong>Enemy vehicles</strong> (red) are the DM's.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Managing Vehicles:</strong> Switch to the <strong>"Vehicles"</strong> tab for full vehicle cards.
              The card adapts to the vehicle type — war machines show armor upgrades, magical gadgets, and mishaps;
              ships show their components and Ship Upgrades. Both offer HP/damage controls, crew management, and weapons.
            </Typography>
            <Typography variant="body2">
              <strong>Tip:</strong> Any dice shown (weapon damage, to-hit, effects) is clickable — click it to roll,
              and the result is logged to the combat log.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GroupIcon color="primary" />
              <Typography fontWeight={600}>2. Add Creatures & Assign Crew</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              The left sidebar has two lists. Under <strong>Player Characters</strong>, click
              <strong> "+ Add PC"</strong>; under <strong>NPCs / Enemies</strong>, click <strong>"+ Add"</strong>.
            </Typography>
            <Typography variant="body2" paragraph>
              • For PCs, use <strong>Quick Add by Class</strong> for sensible defaults, or enter name, HP, AC,
                speed, DEX save bonus, and initiative yourself<br />
              • For NPCs, search the Open5e monster database or enter stats manually
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Factions:</strong> Each creature belongs to either the <strong>Party</strong> (blue) or
              <strong> Enemy</strong> (red) faction. PCs default to Party, monsters default to Enemy.
              You can change a creature's faction by clicking the edit button and toggling Party/Enemy.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Seat crew &amp; passengers:</strong> In a vehicle's <strong>Crew Positions</strong>, click the
              <strong> +</strong> on any station to seat a creature — pick an existing one, or choose
              <strong> "New … here"</strong> to create a character directly in that seat.
            </Typography>
            <Typography variant="body2">
              • The <strong>Helm</strong> is the driver (required to steer)<br />
              • <strong>Weapon stations</strong> let a crew member fire that weapon<br />
              • Ships also have a <strong>Passengers</strong> zone for the party, plus a bulk
                <strong> Deck Crew / Rowers</strong> station shown as a count
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MapIcon color="primary" />
              <Typography fontWeight={600}>3. Set Up the Battlefield</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Use the <strong>Map</strong> tab to view and position vehicles on the battlefield.
              Drag vehicles to move them and use the rotation handle to change their facing.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Background Image:</strong> Click <strong>BG</strong> above the map to upload a battlemap,
              then set its scale (feet per pixel) and opacity. If you rescale the image after placing tokens,
              a <strong>Map Resize</strong> dialog asks whether to move tokens with the image or leave their
              coordinates alone. Tick <strong>Remember my choice</strong> to stop it asking; change it later
              under Settings → "When the battlemap is rescaled".
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Zoom &amp; pan:</strong> Use <strong>−</strong> / <strong>+</strong>, <strong>Fit</strong> (frame every
              token), and <strong>Reset</strong>. Drag empty map to pan. You can always pan or zoom out to any
              token, even one that ends up outside the image edge, so nothing gets stranded.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Combat Scales:</strong> The scale bar shows the current range band and auto-adjusts
              as vehicles close in. Movement per round scales with it:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2 }}>
              • <strong>Point-Blank</strong> (under 100 ft): boarding and melee range<br />
              • <strong>Tactical</strong> (100–1,000 ft): standard weapon combat<br />
              • <strong>Approach</strong> (1,000 ft – 1 mile): closing distance<br />
              • <strong>Strategic</strong> (1 mile+): long-range pursuit
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TerrainIcon color="primary" />
              <Typography fontWeight={600}>4. Elevation Zones</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Create elevation zones to represent hills, cliffs, and other terrain features.
              Click <strong>Layers</strong> above the map to open the layer controls.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Creating Zones:</strong> Click <strong>"+ Add Zone"</strong>, then drag the zone into
              place and resize it with the corner handles. Click a zone to select it and set its elevation.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Elevation Effects:</strong> When attacking between different elevations:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2 }}>
              • <strong>High ground (+10 ft or more):</strong> +2 to attack rolls<br />
              • <strong>Low ground (-10 ft or more):</strong> -2 to attack rolls<br />
              • <strong>Range extension:</strong> Firing downward extends weapon range by 10% per 10 ft of elevation
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <em>Note: Elevation zones are locked during combat to prevent accidental changes.</em>
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlayArrowIcon color="primary" />
              <Typography fontWeight={600}>5. Run Combat</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Once vehicles and creatures are set up, click <strong>"Start Combat"</strong> to begin.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Requirements to start:</strong><br />
              • All PCs must have initiative set (or use the dice button to roll)<br />
              • All drivers must have DEX save bonus set<br />
              • Each crewed vehicle needs a driver at the Helm
            </Typography>
            <Typography variant="body2" paragraph>
              During combat:<br />
              • The <strong>Current Turn</strong> panel shows the active vehicle/creature with crew and weapons<br />
              • Use <strong>"Next Turn"</strong> to advance through the initiative order<br />
              • Use <strong>"Next Round"</strong> when all turns are complete
            </Typography>
            <Typography variant="body2" paragraph>
              Switch to the <strong>Vehicles</strong> tab to deal damage and track crew HP, or apply damage
              straight from the <strong>Target Status</strong> panel. <strong>Undo</strong> above the map
              reverts the last token move.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Combat log:</strong> every roll, move, and complication is logged below the map. The
              export icon offers <strong>Copy as Markdown</strong>, <strong>Copy as JSON</strong>, or
              <strong>Download Markdown</strong> — handy for a session recap.
            </Typography>
            <Typography variant="body2">
              <strong>Ships take component damage</strong> (not mishaps): each part — hull, helm, sails/oars, and
              weapon stations — has its own HP in the <strong>Components</strong> panel, and destroying a part has
              real effects. Knock out the sails/oars to cut its speed, the helm to stop it turning, a weapon to
              silence it, or the hull to wreck the ship. Use <strong>Repair</strong> to restore a part.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GpsFixedIcon color="primary" />
              <Typography fontWeight={600}>6. Target Status Panel</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              During combat, the <strong>Target Status</strong> panel (right sidebar) shows tactical information
              for attacking enemy targets from the current turn's vehicle.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>For each target, you'll see:</strong>
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2 }}>
              • <strong>Cover:</strong> None, Half (+2 AC), Three-quarters (+5 AC), or Full<br />
              • <strong>Attack arc:</strong> Which direction you're attacking from<br />
              • <strong>Distance:</strong> How far away the target is in feet<br />
              • <strong>Range status:</strong> Whether your weapons can reach the target<br />
              • <strong>Elevation modifier:</strong> Attack bonus/penalty based on height difference<br />
              • <strong>Ship components:</strong> for ships, each targetable part (hull, helm, sails, weapons) with its AC &amp; HP
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Range is automatically extended when firing from higher elevation (10% per 10 ft).
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CasinoIcon color="primary" />
              <Typography fontWeight={600}>7. Chase Complications</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Chase complications add random hazards to the encounter. Click the <strong>"Complication"</strong> button
              to roll for a complication.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>"Auto-roll at End of Round"</strong> in the same menu makes the roll happen automatically
              each time you click <strong>Next Round</strong>. It's off by default, saved with the encounter,
              and shows a green check in the menu while it's on.
            </Typography>
            <Typography variant="body2">
              Complications may include terrain hazards, creature attacks, or environmental effects
              that require skill checks to avoid.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SaveIcon color="primary" />
              <Typography fontWeight={600}>8. Saving & Loading</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              <strong>Auto-save:</strong> Your current encounter is automatically saved locally
              as you make changes.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Save to Cloud:</strong> Use the menu (☰) → <strong>"Save"</strong> to save
              your encounter to the cloud. This allows you to access it from any device.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Party Presets:</strong> Save your party configuration as a preset to quickly load
              into new encounters. Only <strong>Party faction</strong> creatures and party vehicles are
              saved in presets (enemy creatures are not included).
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Player View:</strong> Click <strong>Player View</strong> above the map (or open
              <code> vvtt.lukantan.com/player-view</code>) in a second window or on a TV to show players a
              synced battlefield without DM controls. Settings lets you hide vehicle HP from that view.
            </Typography>
            <Typography variant="body2">
              <strong>Settings</strong> (☰ menu) also holds distance units (feet or metres) and the
              map-resize behaviour described in step 3.
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
