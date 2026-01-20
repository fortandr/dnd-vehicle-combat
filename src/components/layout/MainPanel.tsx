/**
 * Main Panel Component
 * Central area for battlefield map and vehicle cards
 */

import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Box,
  Button,
  Stack,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  IconButton,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MapIcon from '@mui/icons-material/Map';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCombat } from '../../context/CombatContext';
import { VehicleCard } from '../vehicles/VehicleCard';
import { ScaleIndicator } from '../combat/ScaleIndicator';
import { BattlefieldMap } from '../battlefield/BattlefieldMap';
import { CombatLog } from '../combat/CombatLog';
import { VEHICLE_TEMPLATES } from '../../data/vehicleTemplates';
import { Vehicle, VehicleWeapon, Creature, CrewAssignment } from '../../types';
import { factionColors, scaleColors, withOpacity } from '../../theme/customColors';
import { getPartyPresets, savePartyPreset, deletePartyPreset, PartyPreset } from '../../hooks/useLocalStorage';

type ViewMode = 'battlefield' | 'cards';

export function MainPanel() {
  const { state, addVehicle, loadPartyPreset } = useCombat();
  const [viewMode, setViewMode] = useState<ViewMode>('battlefield');
  const [showAddModal, setShowAddModal] = useState<'party' | 'enemy' | null>(null);
  const [showSavePartyModal, setShowSavePartyModal] = useState(false);
  const [showLoadPartyModal, setShowLoadPartyModal] = useState(false);
  const [partyPresetName, setPartyPresetName] = useState('');
  const [partyPresets, setPartyPresets] = useState<PartyPreset[]>([]);

  const handleAddVehicle = (templateId: string, type: 'party' | 'enemy') => {
    const template = VEHICLE_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      const weapons: VehicleWeapon[] = template.weapons.map((w) => {
        // Find the matching zone for this weapon to get proper arcs
        let zoneId = '';
        let arcs: ('front' | 'rear' | 'left' | 'right')[] = ['front', 'rear', 'left', 'right'];

        // Match weapon to zone by ID pattern
        if (w.id.includes('port')) {
          const zone = template.zones.find((z) => z.id.includes('port'));
          if (zone) {
            zoneId = zone.id;
            arcs = zone.visibleFromArcs;
          }
        } else if (w.id.includes('starboard')) {
          const zone = template.zones.find((z) => z.id.includes('starboard'));
          if (zone) {
            zoneId = zone.id;
            arcs = zone.visibleFromArcs;
          }
        } else if (w.id.includes('chomper')) {
          const zone = template.zones.find((z) => z.id.includes('chomper'));
          if (zone) {
            zoneId = zone.id;
            arcs = zone.visibleFromArcs;
          }
        } else if (w.id.includes('wrecking')) {
          const zone = template.zones.find((z) => z.id.includes('wrecking'));
          if (zone) {
            zoneId = zone.id;
            arcs = zone.visibleFromArcs;
          }
        } else if (w.id.includes('grappling')) {
          const zone = template.zones.find((z) => z.id.includes('grappling'));
          if (zone) {
            zoneId = zone.id;
            arcs = zone.visibleFromArcs;
          }
        } else if (w.id.includes('harpoon') || w.name.toLowerCase().includes('harpoon')) {
          // Match harpoon weapons to harpoon zones
          const zone = template.zones.find((z) => z.id.includes('harpoon') || z.name.toLowerCase().includes('harpoon'));
          if (zone) {
            zoneId = zone.id;
            arcs = zone.visibleFromArcs;
          }
        } else {
          // Default: find any weapon zone or first zone
          const zone = template.zones.find((z) => z.name.toLowerCase().includes('weapon')) || template.zones[0];
          if (zone) {
            zoneId = zone.id;
            arcs = zone.visibleFromArcs;
          }
        }

        return {
          ...w,
          zoneId,
          visibleFromArcs: arcs,
          currentAmmunition: w.properties?.includes('ammunition') ? 10 : undefined,
          // Mark port/starboard weapons as swappable weapon stations
          isSwappableStation: w.id.includes('harpoon') || w.id.includes('port') || w.id.includes('starboard'),
        };
      });

      const baseX = type === 'party' ? 200 : 500;
      const existingCount = state.vehicles.filter((v) => v.type === type).length;

      const vehicle: Vehicle = {
        id: uuid(),
        name: template.name,
        type,
        template,
        currentHp: template.maxHp,
        currentSpeed: template.speed,
        activeMishaps: [],
        conditions: [],
        weapons,
        position: { x: baseX, y: 200 + existingCount * 100 },
        facing: type === 'party' ? 90 : 270,
      };

      addVehicle(vehicle);
      setShowAddModal(null);
    }
  };

  const handleOpenSavePartyModal = () => {
    setPartyPresetName('');
    setShowSavePartyModal(true);
  };

  const handleSavePartyPreset = () => {
    if (!partyPresetName.trim()) return;

    const partyVehicles = state.vehicles.filter((v) => v.type === 'party');
    const presetId = uuid();

    savePartyPreset(presetId, partyPresetName.trim(), {
      vehicles: partyVehicles,
      creatures: state.creatures,
      crewAssignments: state.crewAssignments,
    });

    setShowSavePartyModal(false);
    setPartyPresetName('');
  };

  const handleOpenLoadPartyModal = () => {
    setPartyPresets(getPartyPresets());
    setShowLoadPartyModal(true);
  };

  const handleLoadPartyPreset = (preset: PartyPreset) => {
    loadPartyPreset(
      preset.data.vehicles as Vehicle[],
      preset.data.creatures as Creature[],
      preset.data.crewAssignments as CrewAssignment[]
    );
    setShowLoadPartyModal(false);
  };

  const handleDeletePartyPreset = (presetId: string) => {
    deletePartyPreset(presetId);
    setPartyPresets(getPartyPresets());
  };

  const partyVehicles = state.vehicles.filter((v) => v.type === 'party');
  const enemyVehicles = state.vehicles.filter((v) => v.type === 'enemy');

  return (
    <Box component="main" sx={{ gridArea: 'main', p: 3, overflow: 'auto' }}>
      {/* View Toggle & Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value) => value && setViewMode(value)}
          size="small"
        >
          <ToggleButton value="battlefield">
            <MapIcon sx={{ mr: 1, fontSize: 18 }} />
            Battlefield
          </ToggleButton>
          <ToggleButton value="cards">
            <ViewModuleIcon sx={{ mr: 1, fontSize: 18 }} />
            Cards
          </ToggleButton>
        </ToggleButtonGroup>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setShowAddModal('party')}
          >
            Party Vehicle
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleOpenSavePartyModal}
            disabled={partyVehicles.length === 0 && state.creatures.length === 0}
          >
            Save Party
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FolderOpenIcon />}
            onClick={handleOpenLoadPartyModal}
          >
            Load Party
          </Button>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Button
            variant="contained"
            size="small"
            color="error"
            startIcon={<AddIcon />}
            onClick={() => setShowAddModal('enemy')}
          >
            Enemy Vehicle
          </Button>
        </Stack>
      </Box>

      {/* Scale Indicator */}
      <ScaleIndicator />

      {/* Battlefield View */}
      {viewMode === 'battlefield' && (
        <Box sx={{ mt: 3 }}>
          <BattlefieldMap height={500} />
        </Box>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 3,
            mt: 3,
          }}
        >
          {/* Party Vehicles */}
          <Box>
            <Typography variant="h6" sx={{ color: 'success.main', mb: 2 }}>
              Party Vehicles
            </Typography>
            {partyVehicles.length === 0 ? (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary" gutterBottom>
                    No party vehicles
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowAddModal('party')}
                    sx={{ mt: 1 }}
                  >
                    + Add Vehicle
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Stack spacing={2}>
                {partyVehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </Stack>
            )}
          </Box>

          {/* Enemy Vehicles */}
          <Box>
            <Typography variant="h6" sx={{ color: 'primary.main', mb: 2 }}>
              Enemy Vehicles
            </Typography>
            {enemyVehicles.length === 0 ? (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary" gutterBottom>
                    No enemy vehicles
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowAddModal('enemy')}
                    sx={{ mt: 1 }}
                  >
                    + Add Vehicle
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Stack spacing={2}>
                {enemyVehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </Stack>
            )}
          </Box>
        </Box>
      )}

      {/* Combat Log - Below Battlefield */}
      <Box sx={{ mt: 3 }}>
        <CombatLog />
      </Box>

      {/* Empty State */}
      {state.vehicles.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" gutterBottom>
            Welcome to Avernus Vehicle Combat
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Set up your encounter by adding vehicles and assigning crew.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddModal('party')}
            >
              Add Party Vehicle
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<AddIcon />}
              onClick={() => setShowAddModal('enemy')}
            >
              Add Enemy Vehicle
            </Button>
          </Stack>
        </Box>
      )}

      {/* Add Vehicle Dialog */}
      <Dialog
        open={Boolean(showAddModal)}
        onClose={() => setShowAddModal(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add {showAddModal === 'party' ? 'Party' : 'Enemy'} Vehicle
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {VEHICLE_TEMPLATES.map((template) => {
              const hoverColor = showAddModal === 'party' ? factionColors.party : factionColors.enemy;
              return (
                <Card
                  key={template.id}
                  variant="outlined"
                  sx={{
                    '&:hover': {
                      borderColor: hoverColor,
                      bgcolor: withOpacity(hoverColor, 0.05),
                    },
                  }}
                >
                  <CardActionArea onClick={() => handleAddVehicle(template.id, showAddModal!)}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {template.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {template.description}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', whiteSpace: 'nowrap', ml: 2 }}>
                          <Typography variant="body2">HP: {template.maxHp}</Typography>
                          <Typography variant="body2">AC: {template.ac}</Typography>
                          <Typography variant="body2">Speed: {template.speed} ft</Typography>
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                        <Chip label={`${template.crewCapacity} crew`} size="small" variant="outlined" />
                        <Chip label={`${template.weapons.length} weapons`} size="small" variant="outlined" />
                        <Chip
                          label={template.size}
                          size="small"
                          sx={{
                            bgcolor: withOpacity(scaleColors.tactical, 0.2),
                            color: scaleColors.tactical,
                          }}
                        />
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button fullWidth onClick={() => setShowAddModal(null)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save Party Preset Dialog */}
      <Dialog
        open={showSavePartyModal}
        onClose={() => setShowSavePartyModal(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Save Party Preset</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Save your current party vehicles, creatures, and crew assignments as a reusable preset.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Preset Name"
            value={partyPresetName}
            onChange={(e) => setPartyPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSavePartyPreset()}
            placeholder="e.g., Main Party, Session 5 Setup"
          />
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Will save:
            </Typography>
            <Typography variant="body2">
              {partyVehicles.length} party vehicle{partyVehicles.length !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2">
              {state.creatures.length} creature{state.creatures.length !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2">
              {state.crewAssignments.length} crew assignment{state.crewAssignments.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSavePartyModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSavePartyPreset}
            disabled={!partyPresetName.trim()}
          >
            Save Preset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Load Party Preset Dialog */}
      <Dialog
        open={showLoadPartyModal}
        onClose={() => setShowLoadPartyModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Load Party Preset</DialogTitle>
        <DialogContent>
          {partyPresets.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No saved party presets yet.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Create a party and click "Save Party" to save it for reuse.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {partyPresets.map((preset) => {
                const vehicleCount = (preset.data.vehicles as Vehicle[]).length;
                const creatureCount = (preset.data.creatures as Creature[]).length;
                return (
                  <Card key={preset.id} variant="outlined">
                    <CardActionArea onClick={() => handleLoadPartyPreset(preset)}>
                      <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {preset.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}, {creatureCount} creature{creatureCount !== 1 ? 's' : ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Saved {new Date(preset.savedAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePartyPreset(preset.id);
                          }}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button fullWidth onClick={() => setShowLoadPartyModal(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
