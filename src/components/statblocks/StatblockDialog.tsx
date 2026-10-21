import { Box, Chip, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Creature } from '../../types';
import { StatblockDisplay } from './StatblockDisplay';

/** Full statblock for a creature (sidebar "View statblock" and the Squads tab member menu). */
export function StatblockDialog({ creature, onClose }: { creature: Creature | null; onClose: () => void }) {
  return (
    <Dialog open={!!creature} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
      {creature && (
        <>
          <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight={700} sx={{ color: 'primary.main' }}>{creature.statblock.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {creature.statblock.size} {creature.statblock.type}
                  {creature.statblock.subtype && ` (${creature.statblock.subtype})`}
                  , {creature.statblock.alignment}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <Chip label={`CR ${creature.statblock.cr}`} color="primary" />
                <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <StatblockDisplay statblock={creature.statblock} />
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
