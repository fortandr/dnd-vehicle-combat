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

interface HelpGuideProps {
  open: boolean;
  onClose: () => void;
}

export function HelpGuide({ open, onClose }: HelpGuideProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h5" component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
          5e Vehicle Combat Tracker
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ ml: 1 }}>
          Quick Start Guide
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" paragraph>
          This app helps you run vehicular chase combat encounters for D&D 5e,
          based on the rules from Baldur's Gate: Descent into Avernus.
        </Typography>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DirectionsCarIcon color="primary" />
              <Typography fontWeight={600}>1. Add Vehicles</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Use the <strong>"+ Add Party Vehicle"</strong> and <strong>"+ Add Enemy Vehicle"</strong> buttons
              to add vehicles to the encounter.
            </Typography>
            <Typography variant="body2" paragraph>
              • <strong>Party vehicles</strong> (blue) are controlled by the players<br />
              • <strong>Enemy vehicles</strong> (red) are controlled by the DM
            </Typography>
            <Typography variant="body2">
              You can customize vehicle weapons, armor, and gadgets from the Vehicle Stats panel on the right.
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
              In the <strong>Creatures</strong> panel (left sidebar), click <strong>"+ Add Creature"</strong> to add
              PCs and NPCs to the encounter.
            </Typography>
            <Typography variant="body2" paragraph>
              • For PCs, enter their name, HP, AC, DEX save bonus, and initiative<br />
              • You can search for monsters from the Open5e database
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Factions:</strong> Each creature belongs to either the <strong>Party</strong> (blue) or
              <strong> Enemy</strong> (red) faction. PCs default to Party, monsters default to Enemy.
              You can change a creature's faction by clicking the edit button and toggling Party/Enemy.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Assign crew to stations:</strong> Click on a creature to see available vehicles,
              then assign them to a station (Helm, Weapons, etc.).
            </Typography>
            <Typography variant="body2">
              • The <strong>Helm</strong> station is for the driver (required for each vehicle)<br />
              • Weapon stations allow crew to fire that weapon on their turn
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
              The battlefield map shows vehicle positions. Drag vehicles to position them.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Distance Tracking:</strong> The scale indicator at the top shows the current
              combat scale based on distance between party and enemy vehicles:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2 }}>
              • <strong>Point Blank</strong> (0-30 ft): Melee range<br />
              • <strong>Tactical</strong> (30-300 ft): Standard combat<br />
              • <strong>Pursuit</strong> (300-3000 ft): Chase scale<br />
              • <strong>Exploration</strong> (3000+ ft): Long distance
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              You can upload a custom background image using the map controls.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlayArrowIcon color="primary" />
              <Typography fontWeight={600}>4. Run Combat</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Once vehicles and creatures are set up, click <strong>"Start Combat"</strong> to begin.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Requirements to start:</strong><br />
              • All PCs must have initiative set<br />
              • All drivers must have DEX save bonus set<br />
              • Each crewed vehicle needs a driver at the Helm
            </Typography>
            <Typography variant="body2" paragraph>
              During combat:<br />
              • The <strong>Current Turn</strong> panel shows whose turn it is<br />
              • Use <strong>"Next Turn"</strong> to advance through the initiative order<br />
              • Use <strong>"Next Round"</strong> when all turns are complete
            </Typography>
            <Typography variant="body2">
              Track damage, healing, and vehicle mishaps using the controls in each panel.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CasinoIcon color="primary" />
              <Typography fontWeight={600}>5. Chase Complications</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Chase complications add random hazards to the encounter. Click the <strong>"Complication"</strong> button
              to roll for a complication.
            </Typography>
            <Typography variant="body2" paragraph>
              You can enable <strong>"Auto-roll at End of Round"</strong> to automatically roll
              complications when a new round begins.
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
              <Typography fontWeight={600}>6. Saving & Loading</Typography>
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
            <Typography variant="body2">
              <strong>Player View:</strong> Open <code>/player-view</code> in a separate window
              to show players a synced view of the battlefield without DM controls.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary">
          Based on the vehicle combat rules from Baldur's Gate: Descent into Avernus (D&D 5e).
          <br />
          For feedback or issues, contact the developer.
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
