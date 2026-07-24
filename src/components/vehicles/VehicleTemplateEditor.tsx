/**
 * Vehicle Template Editor
 *
 * Create/edit a personal vehicle template (Phase 1 of the vehicle library).
 * Covers core stats plus editable lists of components (per-part HP model, e.g.
 * Saltmarsh ships), crew zones, and weapons. Saved templates go to the user's
 * personal library via storageService and become available in the add-vehicle
 * picker. See VEHICLE_LIBRARY_PLAN.md.
 */
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Box,
  MenuItem,
  IconButton,
  Divider,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type {
  VehicleTemplate,
  VehicleComponent,
  VehicleComponentKind,
  VehicleZone,
  WeaponTemplate,
  CoverType,
  VehicleEnvironment,
} from '../../types';

const COVER_OPTIONS: { value: CoverType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'half', label: 'Half' },
  { value: 'three_quarters', label: 'Three-quarters' },
  { value: 'full', label: 'Full' },
];

const COMPONENT_KINDS: VehicleComponentKind[] = ['hull', 'control', 'movement', 'weapon', 'other'];

function blankTemplate(): VehicleTemplate {
  return {
    id: uuid(),
    name: '',
    description: '',
    source: 'personal',
    maxHp: 100,
    ac: 12,
    speed: 30,
    damageThreshold: 0,
    mishapThreshold: 20,
    crewCapacity: 1,
    zones: [],
    weapons: [],
    size: 'large',
    environment: 'land',
    components: [],
  };
}

interface VehicleTemplateEditorProps {
  open: boolean;
  /** Template to edit, or null to create a new one. */
  initial: VehicleTemplate | null;
  onClose: () => void;
  onSave: (template: VehicleTemplate) => void | Promise<void>;
}

export function VehicleTemplateEditor({ open, initial, onClose, onSave }: VehicleTemplateEditorProps) {
  const [t, setT] = useState<VehicleTemplate>(blankTemplate);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setT(initial ? { ...initial } : blankTemplate());
    }
  }, [open, initial]);

  const set = (patch: Partial<VehicleTemplate>) => setT((prev) => ({ ...prev, ...patch }));
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const optNum = (v: string) => (v === '' ? undefined : Number(v));

  // Components (faithful per-part model)
  const components = t.components ?? [];
  const addComponent = () =>
    set({ components: [...components, { id: uuid(), name: '', kind: 'hull', ac: 12, maxHp: 50 }] });
  const updateComponent = (i: number, patch: Partial<VehicleComponent>) =>
    set({ components: components.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const removeComponent = (i: number) =>
    set({ components: components.filter((_, idx) => idx !== i) });

  // Crew zones
  const addZone = () =>
    set({
      zones: [
        ...t.zones,
        { id: uuid(), name: '', cover: 'none', capacity: 1, canAttackOut: true, visibleFromArcs: ['front', 'rear', 'left', 'right'] },
      ],
    });
  const updateZone = (i: number, patch: Partial<VehicleZone>) =>
    set({ zones: t.zones.map((z, idx) => (idx === i ? { ...z, ...patch } : z)) });
  const removeZone = (i: number) => set({ zones: t.zones.filter((_, idx) => idx !== i) });

  // Weapons
  const addWeapon = () => set({ weapons: [...t.weapons, { id: uuid(), name: '', damage: '' }] });
  const updateWeapon = (i: number, patch: Partial<WeaponTemplate>) =>
    set({ weapons: t.weapons.map((w, idx) => (idx === i ? { ...w, ...patch } : w)) });
  const removeWeapon = (i: number) => set({ weapons: t.weapons.filter((_, idx) => idx !== i) });

  const canSave = t.name.trim().length > 0 && !saving;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...t, name: t.name.trim(), source: 'personal' });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{initial ? 'Edit Vehicle Template' : 'Create Vehicle Template'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Identity */}
          <Stack spacing={2}>
            <TextField label="Name" value={t.name} onChange={(e) => set({ name: e.target.value })} required fullWidth autoFocus />
            <TextField label="Description" value={t.description} onChange={(e) => set({ description: e.target.value })} fullWidth multiline minRows={2} />
          </Stack>

          {/* Classification */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select label="Size" value={t.size} onChange={(e) => set({ size: e.target.value as VehicleTemplate['size'] })} fullWidth>
              <MenuItem value="large">Large</MenuItem>
              <MenuItem value="huge">Huge</MenuItem>
              <MenuItem value="gargantuan">Gargantuan</MenuItem>
            </TextField>
            <TextField select label="Environment" value={t.environment ?? 'land'} onChange={(e) => set({ environment: e.target.value as VehicleEnvironment })} fullWidth>
              <MenuItem value="land">Land</MenuItem>
              <MenuItem value="water">Water</MenuItem>
              <MenuItem value="air">Air</MenuItem>
            </TextField>
          </Stack>

          {/* Core stats */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Core Stats</Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <TextField type="number" label="Max HP" value={t.maxHp} onChange={(e) => set({ maxHp: num(e.target.value) })} sx={{ width: 120 }} />
              <TextField type="number" label="AC" value={t.ac} onChange={(e) => set({ ac: num(e.target.value) })} sx={{ width: 90 }} />
              <TextField type="number" label="Speed (ft)" value={t.speed} onChange={(e) => set({ speed: num(e.target.value) })} sx={{ width: 120 }} />
              <TextField type="number" label="Damage Threshold" value={t.damageThreshold} onChange={(e) => set({ damageThreshold: num(e.target.value) })} sx={{ width: 160 }} />
              <TextField type="number" label="Mishap Threshold" value={t.mishapThreshold} onChange={(e) => set({ mishapThreshold: num(e.target.value) })} sx={{ width: 160 }} />
              <TextField type="number" label="Crew Capacity" value={t.crewCapacity} onChange={(e) => set({ crewCapacity: num(e.target.value) })} sx={{ width: 140 }} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              For component-based vehicles (e.g. ships), Max HP / AC / Damage Threshold represent the hull.
            </Typography>
          </Box>

          {/* Components */}
          <Section
            title="Components (per-part HP)"
            addLabel="Add component"
            onAdd={addComponent}
            hint="For ships and other multi-part vehicles: hull, helm, sails/oars, weapon stations — each with its own AC & HP. Leave empty for single-HP vehicles. (Per-component targeting in combat is coming in the naval update; components are saved with the template now.)"
          >
            {components.map((c, i) => (
              <Stack key={c.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField label="Name" value={c.name} onChange={(e) => updateComponent(i, { name: e.target.value })} sx={{ width: 160 }} size="small" />
                <TextField select label="Kind" value={c.kind} onChange={(e) => updateComponent(i, { kind: e.target.value as VehicleComponentKind })} sx={{ width: 120 }} size="small">
                  {COMPONENT_KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
                </TextField>
                <TextField type="number" label="AC" value={c.ac} onChange={(e) => updateComponent(i, { ac: num(e.target.value) })} sx={{ width: 80 }} size="small" />
                <TextField type="number" label="HP" value={c.maxHp} onChange={(e) => updateComponent(i, { maxHp: num(e.target.value) })} sx={{ width: 90 }} size="small" />
                <TextField type="number" label="DT" value={c.damageThreshold ?? ''} onChange={(e) => updateComponent(i, { damageThreshold: optNum(e.target.value) })} sx={{ width: 70 }} size="small" />
                {c.kind === 'movement' && (
                  <TextField type="number" label="Speed" value={c.speed ?? ''} onChange={(e) => updateComponent(i, { speed: optNum(e.target.value) })} sx={{ width: 90 }} size="small" />
                )}
                <IconButton onClick={() => removeComponent(i)} size="small" aria-label="remove component"><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Section>

          {/* Crew zones */}
          <Section
            title="Crew Zones"
            addLabel="Add zone"
            onAdd={addZone}
            hint="Stations where crew can be assigned (helm, weapons, deck…)."
          >
            {t.zones.map((z, i) => (
              <Stack key={z.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField label="Name" value={z.name} onChange={(e) => updateZone(i, { name: e.target.value })} sx={{ width: 160 }} size="small" />
                <TextField type="number" label="Capacity" value={z.capacity} onChange={(e) => updateZone(i, { capacity: num(e.target.value) })} sx={{ width: 100 }} size="small" />
                <TextField select label="Cover" value={z.cover} onChange={(e) => updateZone(i, { cover: e.target.value as CoverType })} sx={{ width: 150 }} size="small">
                  {COVER_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </TextField>
                <FormControlLabel control={<Checkbox checked={z.canAttackOut} onChange={(e) => updateZone(i, { canAttackOut: e.target.checked })} />} label="Can attack out" />
                <IconButton onClick={() => removeZone(i)} size="small" aria-label="remove zone"><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Section>

          {/* Weapons */}
          <Section
            title="Weapons"
            addLabel="Add weapon"
            onAdd={addWeapon}
            hint="Damage as dice text, e.g. “3d10 piercing”."
          >
            {t.weapons.map((w, i) => (
              <Stack key={w.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField label="Name" value={w.name} onChange={(e) => updateWeapon(i, { name: e.target.value })} sx={{ width: 160 }} size="small" />
                <TextField label="Damage" value={w.damage} onChange={(e) => updateWeapon(i, { damage: e.target.value })} sx={{ width: 170 }} size="small" />
                <TextField type="number" label="Atk Bonus" value={w.attackBonus ?? ''} onChange={(e) => updateWeapon(i, { attackBonus: optNum(e.target.value) })} sx={{ width: 110 }} size="small" />
                <TextField label="Range" value={w.range ?? ''} onChange={(e) => updateWeapon(i, { range: e.target.value || undefined })} sx={{ width: 130 }} size="small" />
                <TextField type="number" label="Crew" value={w.crewRequired ?? ''} onChange={(e) => updateWeapon(i, { crewRequired: optNum(e.target.value) })} sx={{ width: 80 }} size="small" />
                <IconButton onClick={() => removeWeapon(i)} size="small" aria-label="remove weapon"><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Section>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface SectionProps {
  title: string;
  hint?: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}

function Section({ title, hint, addLabel, onAdd, children }: SectionProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={onAdd}>{addLabel}</Button>
      </Box>
      {hint && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{hint}</Typography>}
      <Stack spacing={1.5} sx={{ mt: 1 }}>{children}</Stack>
      <Divider sx={{ mt: 2 }} />
    </Box>
  );
}
