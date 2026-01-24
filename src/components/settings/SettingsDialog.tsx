/**
 * Settings Dialog Component
 * Allows users to configure app preferences
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box,
} from '@mui/material';
import { useSettings, UnitSystem } from '../../context/SettingsContext';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { unitSystem, setUnitSystem } = useSettings();

  const handleUnitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUnitSystem(event.target.value as UnitSystem);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Distance Units</FormLabel>
            <RadioGroup value={unitSystem} onChange={handleUnitChange}>
              <FormControlLabel
                value="imperial"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Imperial (feet, miles)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Standard D&D 5e units
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="metric"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Metric (meters, kilometers)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      1 ft = 0.3 m (approximate)
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
