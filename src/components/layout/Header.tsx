/**
 * Header Component
 * Top navigation bar with encounter info and controls
 */

import { useState, useMemo } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Chip,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  CardContent,
  CardActionArea,
  IconButton,
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuIcon from '@mui/icons-material/Menu';
import SaveIcon from '@mui/icons-material/Save';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AddIcon from '@mui/icons-material/Add';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCombat } from '../../context/CombatContext';
import { SCALES } from '../../data/scaleConfig';
import { rollComplication, getComplicationRollRange } from '../../data/chaseComplications';
import {
  getSavedEncounters,
  saveEncounter,
  deleteEncounter,
  SavedEncounter,
} from '../../hooks/useLocalStorage';
import { CombatState } from '../../types';
import { scaleColors, withOpacity } from '../../theme/customColors';

export function Header() {
  const { state, startCombat, returnToSetup, resetCombat, nextRound, nextTurn, loadEncounter, newEncounter, lastSaved, forceSave, markAsSaved, setEncounterName } = useCombat();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveName, setSaveName] = useState(state.name);
  const [savedEncounters, setSavedEncounters] = useState<SavedEncounter[]>([]);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const currentScale = SCALES[state.scale];

  // Validate readiness for combat
  const combatValidation = useMemo(() => {
    const errors: string[] = [];

    // Check 1: All PCs must have initiative set (> 0)
    const pcs = state.creatures.filter(c => c.statblock.type === 'pc');
    const pcsWithoutInit = pcs.filter(c => !c.initiative || c.initiative <= 0);
    if (pcsWithoutInit.length > 0) {
      errors.push(`PCs missing initiative: ${pcsWithoutInit.map(c => c.name).join(', ')}`);
    }

    // Check 2: All drivers must have DEX ability score set
    // Find all creatures assigned to 'helm' zones (drivers)
    const drivers = state.crewAssignments
      .filter(a => a.zoneId === 'helm')
      .map(a => state.creatures.find(c => c.id === a.creatureId))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    const driversWithoutDex = drivers.filter(c => {
      const dex = c.statblock.abilities?.dex;
      return dex === undefined || dex === null || dex <= 0;
    });

    if (driversWithoutDex.length > 0) {
      errors.push(`Drivers missing DEX score: ${driversWithoutDex.map(c => c.name).join(', ')}`);
    }

    // Check 3: Each vehicle with crew should have a driver
    const vehiclesWithCrew = state.vehicles.filter(v =>
      state.crewAssignments.some(a => a.vehicleId === v.id)
    );
    const vehiclesWithoutDriver = vehiclesWithCrew.filter(v =>
      !state.crewAssignments.some(a => a.vehicleId === v.id && a.zoneId === 'helm')
    );
    if (vehiclesWithoutDriver.length > 0) {
      errors.push(`Vehicles need drivers: ${vehiclesWithoutDriver.map(v => v.name).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      errorMessage: errors.join('\n'),
    };
  }, [state.creatures, state.crewAssignments, state.vehicles]);

  const handleSave = () => {
    // Update the encounter name in state
    setEncounterName(saveName);
    // Mark as saved to enable auto-save
    markAsSaved();
    // Save to named encounters list
    saveEncounter(state.id, saveName, { ...state, name: saveName, hasBeenSaved: true });
    // Force immediate auto-save
    setTimeout(() => forceSave(), 100);
    setShowSaveModal(false);
  };

  // Quick save for already-saved encounters
  const handleQuickSave = () => {
    // Save to named encounters list with current state
    saveEncounter(state.id, state.name, state);
    // Force immediate auto-save
    forceSave();
  };

  const handleOpenLoad = () => {
    setSavedEncounters(getSavedEncounters());
    setShowLoadModal(true);
  };

  const handleLoad = (encounter: SavedEncounter) => {
    loadEncounter(encounter.data as CombatState);
    setShowLoadModal(false);
  };

  const handleDelete = (id: string) => {
    deleteEncounter(id);
    setSavedEncounters(getSavedEncounters());
  };

  const handleNew = () => {
    if (confirm('Create a new encounter? Any unsaved changes will be lost.')) {
      newEncounter('New Encounter');
    }
  };

  const handleRollComplication = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const complication = rollComplication(roll, state.scale);
    const rollRange = getComplicationRollRange(roll);

    if (complication) {
      let message = `Rolled ${roll} (Range: ${rollRange}) - COMPLICATION!\n\n` +
        `${complication.name}\n\n` +
        `${complication.description}\n\n` +
        `Effect: ${complication.effect}`;

      if (complication.mechanicalEffect) {
        const mech = complication.mechanicalEffect;
        if (mech.damage) {
          message += `\n\nDamage: ${mech.damage}`;
        }
        if (mech.skillCheck) {
          message += `\n\nCheck: ${mech.skillCheck.skill} DC ${mech.skillCheck.dc}`;
          if (mech.skillCheck.failureEffect) {
            message += `\nFailure: ${mech.skillCheck.failureEffect}`;
          }
        }
      }

      alert(message);
    } else {
      alert(`Rolled ${roll} (Range: ${rollRange}) - No complication this turn.\n\nThe hellish terrain poses no additional threats this round.`);
    }
  };

  const scaleColor = scaleColors[state.scale as keyof typeof scaleColors];

  return (
    <>
      <AppBar position="static" elevation={0} sx={{ gridArea: 'header' }}>
        <Toolbar sx={{ gap: 3, justifyContent: 'space-between' }}>
          {/* Left side - Title and encounter name */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700 }}>
              Avernus Combat
            </Typography>
            <Divider orientation="vertical" flexItem />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {state.name}
              </Typography>
              {lastSaved ? (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'success.main',
                    fontSize: '0.65rem',
                    opacity: 0.8,
                  }}
                >
                  (Auto-saved {lastSaved.toLocaleTimeString()})
                </Typography>
              ) : null}
              {!state.hasBeenSaved && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.disabled',
                    fontSize: '0.65rem',
                    opacity: 0.8,
                  }}
                >
                  • Save to add to encounters list
                </Typography>
              )}
            </Stack>
          </Stack>

          {/* Right side - Controls */}
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Round & Phase */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={`Round ${state.round || '—'}`}
                size="small"
                sx={{
                  bgcolor: withOpacity('#ff4500', 0.2),
                  color: 'primary.main',
                  fontWeight: 600,
                }}
              />
              <Chip
                label={
                  state.phase === 'setup' ? 'Setup' :
                  state.phase === 'combat' ? 'Combat' :
                  'Ended'
                }
                size="small"
                variant="outlined"
              />
            </Stack>

            {/* Scale Indicator */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={currentScale.displayName}
                size="small"
                sx={{
                  bgcolor: withOpacity(scaleColor, 0.2),
                  color: scaleColor,
                  fontWeight: 600,
                }}
              />
              <Typography variant="caption" color="text.disabled">
                {currentScale.roundDurationDisplay}/round
              </Typography>
            </Stack>

            {/* Combat Controls */}
            <Stack direction="row" spacing={1}>
              {state.phase === 'setup' && (
                <Tooltip
                  title={
                    !combatValidation.isValid ? (
                      <Box sx={{ whiteSpace: 'pre-line' }}>
                        <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                          Cannot start combat:
                        </Typography>
                        {combatValidation.errors.map((err, i) => (
                          <Typography key={i} variant="caption" sx={{ display: 'block' }}>
                            • {err}
                          </Typography>
                        ))}
                      </Box>
                    ) : ''
                  }
                  arrow
                  placement="bottom"
                >
                  <span>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={startCombat}
                      disabled={state.creatures.length === 0 || !combatValidation.isValid}
                      color={combatValidation.isValid ? 'primary' : 'warning'}
                    >
                      Start Combat
                    </Button>
                  </span>
                </Tooltip>
              )}
              {state.phase === 'combat' && (
                <>
                  <Button
                    variant="text"
                    size="small"
                    onClick={returnToSetup}
                    title="Return to setup phase to adjust positions"
                  >
                    Back to Setup
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={nextTurn}
                    disabled={state.currentTurnIndex >= state.initiativeOrder.length - 1}
                  >
                    Next Turn
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={nextRound}
                    disabled={state.currentTurnIndex < state.initiativeOrder.length - 1}
                    title={state.currentTurnIndex < state.initiativeOrder.length - 1
                      ? `Complete all turns first (${state.currentTurnIndex + 1}/${state.initiativeOrder.length})`
                      : 'Start next round'}
                  >
                    Next Round
                  </Button>
                </>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={handleRollComplication}
                title={`Roll for chase complication (${currentScale.displayName} scale)`}
              >
                Roll Complication
              </Button>
            </Stack>

            <Divider orientation="vertical" flexItem />

            {/* File Menu - Far Right */}
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ color: 'text.secondary' }}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              <MenuItem onClick={() => { handleNew(); setMenuAnchor(null); }}>
                <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                <ListItemText>New Encounter</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => {
                if (state.hasBeenSaved) {
                  handleQuickSave();
                } else {
                  setSaveName(state.name);
                  setShowSaveModal(true);
                }
                setMenuAnchor(null);
              }}>
                <ListItemIcon><SaveIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Save</ListItemText>
              </MenuItem>
              {state.hasBeenSaved && (
                <MenuItem onClick={() => {
                  setSaveName(state.name);
                  setShowSaveModal(true);
                  setMenuAnchor(null);
                }}>
                  <ListItemIcon><SaveAsIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Save As...</ListItemText>
                </MenuItem>
              )}
              <MenuItem onClick={() => { handleOpenLoad(); setMenuAnchor(null); }}>
                <ListItemIcon><FolderOpenIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Load Encounter</ListItemText>
              </MenuItem>
              <Divider />
              {state.phase === 'combat' && (
                <MenuItem onClick={() => { returnToSetup(); setMenuAnchor(null); }}>
                  <ListItemIcon><StopIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>End Combat</ListItemText>
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  if (confirm('Reset combat? All HP, mishaps, and turns will be reset. Vehicles and creatures will be kept.')) {
                    resetCombat();
                  }
                  setMenuAnchor(null);
                }}
              >
                <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Reset Combat</ListItemText>
              </MenuItem>
            </Menu>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Save Dialog */}
      <Dialog
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save Encounter</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Encounter Name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Load Dialog */}
      <Dialog
        open={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Load Encounter</DialogTitle>
        <DialogContent>
          {savedEncounters.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No saved encounters found.
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ mt: 1 }}>
              {savedEncounters.map((encounter) => (
                <Card key={encounter.id} variant="outlined">
                  <CardActionArea onClick={() => handleLoad(encounter)}>
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography fontWeight={600}>{encounter.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Saved: {new Date(encounter.savedAt).toLocaleString()}
                        </Typography>
                      </Box>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this encounter?')) {
                            handleDelete(encounter.id);
                          }
                        }}
                        title="Delete"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button fullWidth onClick={() => setShowLoadModal(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
