/**
 * Header Component
 * Top navigation bar with encounter info and controls
 */

import { useState, useMemo, useEffect } from 'react';
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
import CasinoIcon from '@mui/icons-material/Casino';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckIcon from '@mui/icons-material/Check';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useCombat } from '../../context/CombatContext';
import { SCALES } from '../../data/scaleConfig';
import { rollComplication, getComplicationRollRange } from '../../data/chaseComplications';
import { storageService, SavedEncounter, CombatArchive } from '../../services/storageService';
import { CombatState, ChaseComplication } from '../../types';
import { scaleColors, withOpacity } from '../../theme/customColors';
import { CombatSummary } from '../combat/CombatSummary';
import { ComplicationResolutionModal } from '../combat/ComplicationResolutionModal';
import { CreatureChaseModal } from '../combat/CreatureChaseModal';
import { v4 as uuid } from 'uuid';
import FlagIcon from '@mui/icons-material/Flag';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { UserMenu } from '../auth/UserMenu';
import { isAuthEnabled } from '../../context/AuthContext';
import { HelpGuide } from '../help/HelpGuide';

export function Header() {
  const { state, dispatch, startCombat, returnToSetup, resetCombat, nextRound, nextTurn, loadEncounter, newEncounter, lastSaved, forceSave, markAsSaved, setEncounterName, toggleAutoRollComplications, logComplication, startComplicationResolution, clearComplication } = useCombat();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [currentArchive, setCurrentArchive] = useState<CombatArchive | null>(null);
  const [saveName, setSaveName] = useState(state.name);
  const [savedEncounters, setSavedEncounters] = useState<SavedEncounter[]>([]);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [complicationMenuAnchor, setComplicationMenuAnchor] = useState<null | HTMLElement>(null);
  const [showComplicationModal, setShowComplicationModal] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [showCreatureChaseModal, setShowCreatureChaseModal] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [currentComplicationResult, setCurrentComplicationResult] = useState<{
    roll: number;
    rollRange: string;
    complication: ChaseComplication | null;
  } | null>(null);
  const [prevRound, setPrevRound] = useState(state.round);

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

    const driversWithoutDexSave = drivers.filter(c => {
      // Check savingThrows.dex first, fall back to calculating from abilities.dex
      const dexSave = c.statblock.savingThrows?.dex;
      const dexAbility = c.statblock.abilities?.dex;
      // Valid if they have an explicit dex save OR a dex ability score to calculate from
      return dexSave === undefined && (dexAbility === undefined || dexAbility === null);
    });

    if (driversWithoutDexSave.length > 0) {
      errors.push(`Drivers missing DEX Save: ${driversWithoutDexSave.map(c => c.name).join(', ')}`);
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

  // Helper to check if a complication is "Creature Chase" (roll 1-2)
  const isCreatureChaseComplication = (complication: ChaseComplication | null, roll: number): boolean => {
    return roll <= 2 && complication?.name === 'Creature Chase';
  };

  // Auto-roll complication when round changes (if enabled)
  useEffect(() => {
    // Only trigger on round change (not on initial load), in combat phase, and when auto-roll is enabled
    if (state.round > prevRound && state.phase === 'combat' && state.autoRollComplications) {
      // Roll for complication
      const roll = Math.floor(Math.random() * 20) + 1;
      const complication = rollComplication(roll, state.scale);
      const rollRange = getComplicationRollRange(roll);

      // Log to combat log
      logComplication(
        roll,
        complication?.name || null,
        complication ? complication.effect : 'The hellish terrain poses no additional threats this round.'
      );

      // Store the result for modals
      setCurrentComplicationResult({ roll, rollRange, complication });

      // Check what type of complication this is
      if (isCreatureChaseComplication(complication, roll)) {
        // Creature Chase - show creature selection modal
        setShowCreatureChaseModal(true);
      } else if (complication && complication.mechanicalEffect?.skillCheck) {
        // Skill check complication - start resolution process
        startComplicationResolution(complication, roll, rollRange);
        setShowResolutionModal(true);
      } else {
        // No complication or simple info-only complication
        setShowComplicationModal(true);
      }
    }
    setPrevRound(state.round);
  }, [state.round, state.phase, state.autoRollComplications, state.scale, prevRound, logComplication, startComplicationResolution]);

  const handleSave = async () => {
    // Update the encounter name in state
    setEncounterName(saveName);
    // Mark as saved to enable auto-save
    markAsSaved();
    // Save to named encounters list
    await storageService.saveEncounter(state.id, saveName, { ...state, name: saveName, hasBeenSaved: true });
    // Force immediate auto-save
    setTimeout(() => forceSave(), 100);
    setShowSaveModal(false);
  };

  // Quick save for already-saved encounters
  const handleQuickSave = async () => {
    // Save to named encounters list with current state
    await storageService.saveEncounter(state.id, state.name, state);
    // Force immediate auto-save
    forceSave();
  };

  const handleOpenLoad = async () => {
    const encounters = await storageService.listEncounters();
    setSavedEncounters(encounters as SavedEncounter[]);
    setShowLoadModal(true);
  };

  const handleLoad = (encounter: SavedEncounter) => {
    loadEncounter(encounter.data as CombatState);
    setShowLoadModal(false);
  };

  const handleDelete = async (id: string) => {
    await storageService.deleteEncounter(id);
    const encounters = await storageService.listEncounters();
    setSavedEncounters(encounters as SavedEncounter[]);
  };

  const handleNew = () => {
    if (confirm('Create a new encounter? Any unsaved changes will be lost.')) {
      newEncounter('New Encounter');
    }
  };

  const handleFinishCombat = () => {
    // Create archive from current state
    const archive: CombatArchive = {
      id: uuid(),
      encounterName: state.name,
      completedAt: new Date().toISOString(),
      totalRounds: state.round,
      summary: {
        partyVehicles: state.vehicles
          .filter((v) => v.type === 'party')
          .map((v) => v.name),
        enemyVehicles: state.vehicles
          .filter((v) => v.type === 'enemy')
          .map((v) => v.name),
        partyCreatures: state.creatures
          .filter((c) => c.statblock.type === 'pc')
          .map((c) => c.name),
        enemyCreatures: state.creatures
          .filter((c) => c.statblock.type !== 'pc')
          .map((c) => c.name),
        vehiclesDestroyed: state.vehicles
          .filter((v) => v.currentHp === 0 || v.isInoperative)
          .map((v) => v.name),
        creaturesKilled: state.creatures
          .filter((c) => c.currentHp === 0)
          .map((c) => c.name),
      },
      actionLog: state.actionLog,
    };

    // Save to archives
    storageService.saveCombatArchive(archive);

    // Set current archive for display
    setCurrentArchive(archive);

    // End combat
    dispatch({ type: 'END_COMBAT' });

    // Show summary
    setShowSummaryModal(true);
  };

  const handleRollComplication = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const complication = rollComplication(roll, state.scale);
    const rollRange = getComplicationRollRange(roll);

    // Log to combat log
    logComplication(
      roll,
      complication?.name || null,
      complication ? complication.effect : 'The hellish terrain poses no additional threats this round.'
    );

    // Store the result for modals
    setCurrentComplicationResult({ roll, rollRange, complication });

    // Check what type of complication this is
    if (isCreatureChaseComplication(complication, roll)) {
      // Creature Chase - show creature selection modal
      setShowCreatureChaseModal(true);
    } else if (complication && complication.mechanicalEffect?.skillCheck) {
      // Skill check complication - start resolution process
      startComplicationResolution(complication, roll, rollRange);
      setShowResolutionModal(true);
    } else {
      // No complication or simple info-only complication
      setShowComplicationModal(true);
    }
    setComplicationMenuAnchor(null);
  };

  const scaleColor = scaleColors[state.scale as keyof typeof scaleColors];

  return (
    <>
      <AppBar position="static" elevation={0} sx={{ gridArea: 'header' }}>
        <Toolbar sx={{ gap: 3, justifyContent: 'space-between' }}>
          {/* Left side - Title and encounter name */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700 }}>
              5e Vehicular Combat
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
                  <Divider orientation="vertical" flexItem />
                  <Button
                    variant="outlined"
                    size="small"
                    color="success"
                    startIcon={<FlagIcon />}
                    onClick={handleFinishCombat}
                    title="End combat and view summary"
                  >
                    Finish Combat
                  </Button>
                </>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => setComplicationMenuAnchor(e.currentTarget)}
                endIcon={state.autoRollComplications ? <AutorenewIcon sx={{ fontSize: 16 }} /> : undefined}
                title={`Roll for chase complication (${currentScale.displayName} scale)${state.autoRollComplications ? ' - Auto-roll enabled' : ''}`}
              >
                Complication
              </Button>
              <Menu
                anchorEl={complicationMenuAnchor}
                open={Boolean(complicationMenuAnchor)}
                onClose={() => setComplicationMenuAnchor(null)}
              >
                <MenuItem onClick={handleRollComplication}>
                  <ListItemIcon><CasinoIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Roll Random Complication</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => {
                  toggleAutoRollComplications();
                  setComplicationMenuAnchor(null);
                }}>
                  <ListItemIcon>
                    {state.autoRollComplications ? <CheckIcon fontSize="small" color="success" /> : <AutorenewIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText>
                    Auto-roll at End of Round
                    {state.autoRollComplications && (
                      <Typography variant="caption" color="success.main" sx={{ ml: 1 }}>
                        (Enabled)
                      </Typography>
                    )}
                  </ListItemText>
                </MenuItem>
              </Menu>
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
                <MenuItem onClick={() => { handleFinishCombat(); setMenuAnchor(null); }}>
                  <ListItemIcon><FlagIcon fontSize="small" color="success" /></ListItemIcon>
                  <ListItemText>Finish Combat</ListItemText>
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
              <Divider />
              <MenuItem onClick={() => { setShowHelpGuide(true); setMenuAnchor(null); }}>
                <ListItemIcon><HelpOutlineIcon fontSize="small" /></ListItemIcon>
                <ListItemText>How to Use</ListItemText>
              </MenuItem>
            </Menu>

            {/* User Menu - shows when auth is enabled */}
            {isAuthEnabled && <UserMenu />}
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

      {/* Combat Summary Dialog */}
      <Dialog
        open={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlagIcon color="success" />
            Combat Complete
          </Box>
        </DialogTitle>
        <DialogContent>
          {currentArchive && <CombatSummary archive={currentArchive} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSummaryModal(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowSummaryModal(false);
              resetCombat();
            }}
          >
            Reset & Start New Combat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complication Modal */}
      <Dialog
        open={showComplicationModal}
        onClose={() => setShowComplicationModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {currentComplicationResult?.complication ? (
              <WarningAmberIcon color="warning" />
            ) : (
              <CheckCircleOutlineIcon color="success" />
            )}
            <Typography variant="h6">
              Chase Complication Roll
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {currentComplicationResult && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {/* Roll Result */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: currentComplicationResult.complication ? 'warning.dark' : 'success.dark',
                    color: 'white',
                  }}
                >
                  <Typography variant="h4" fontWeight={700}>
                    {currentComplicationResult.roll}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Roll Range: {currentComplicationResult.rollRange}
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color={currentComplicationResult.complication ? 'warning.main' : 'success.main'}>
                    {currentComplicationResult.complication ? 'COMPLICATION!' : 'No Complication'}
                  </Typography>
                </Box>
              </Box>

              {/* Complication Details */}
              {currentComplicationResult.complication ? (
                <Card variant="outlined" sx={{ bgcolor: withOpacity('#ff9800', 0.1), borderColor: 'warning.dark' }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      {currentComplicationResult.complication.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {currentComplicationResult.complication.description}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body1" fontWeight={500}>
                      Effect: {currentComplicationResult.complication.effect}
                    </Typography>

                    {/* Mechanical Effects */}
                    {currentComplicationResult.complication.mechanicalEffect && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          MECHANICAL EFFECTS
                        </Typography>
                        {currentComplicationResult.complication.mechanicalEffect.damage && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            <strong>Damage:</strong> {currentComplicationResult.complication.mechanicalEffect.damage}
                          </Typography>
                        )}
                        {currentComplicationResult.complication.mechanicalEffect.skillCheck && (
                          <>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              <strong>Check:</strong> {currentComplicationResult.complication.mechanicalEffect.skillCheck.skill} DC {currentComplicationResult.complication.mechanicalEffect.skillCheck.dc}
                            </Typography>
                            {currentComplicationResult.complication.mechanicalEffect.skillCheck.failureEffect && (
                              <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
                                <strong>On Failure:</strong> {currentComplicationResult.complication.mechanicalEffect.skillCheck.failureEffect}
                              </Typography>
                            )}
                          </>
                        )}
                        {currentComplicationResult.complication.mechanicalEffect.speedChange && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            <strong>Speed Change:</strong> {currentComplicationResult.complication.mechanicalEffect.speedChange}%
                          </Typography>
                        )}
                        {currentComplicationResult.complication.mechanicalEffect.targetVehicle && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            <strong>Target:</strong> {currentComplicationResult.complication.mechanicalEffect.targetVehicle}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card variant="outlined" sx={{ bgcolor: withOpacity('#4caf50', 0.1), borderColor: 'success.dark' }}>
                  <CardContent>
                    <Typography variant="body1">
                      The hellish terrain poses no additional threats this round.
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Scale Info */}
              <Typography variant="caption" color="text.secondary">
                Current Scale: {currentScale.displayName}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowComplicationModal(false)} variant="contained">
            Acknowledge
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complication Resolution Modal (for skill check complications) */}
      {state.activeBattlefieldComplication && (
        <ComplicationResolutionModal
          open={showResolutionModal}
          onClose={() => setShowResolutionModal(false)}
          complication={state.activeBattlefieldComplication}
        />
      )}

      {/* Creature Chase Modal (for roll 1-2 complications) */}
      {currentComplicationResult?.complication && isCreatureChaseComplication(currentComplicationResult.complication, currentComplicationResult.roll) && (
        <CreatureChaseModal
          open={showCreatureChaseModal}
          onClose={() => setShowCreatureChaseModal(false)}
          complication={currentComplicationResult.complication}
          roll={currentComplicationResult.roll}
        />
      )}

      {/* Help Guide */}
      <HelpGuide open={showHelpGuide} onClose={() => setShowHelpGuide(false)} />
    </>
  );
}
