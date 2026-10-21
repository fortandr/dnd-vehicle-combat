import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment,
  List, ListItem, ListItemButton, ListItemText, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import { searchOpen5e, type Open5eMonster } from '../../services/open5e';

interface MonsterSearchDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxQuantity: number;
  /** Caption beside the quantity picker when the quantity is above 1. */
  quantityHint: (qty: number) => string;
  onPick: (monster: Open5eMonster, qty: number) => void;
}

/** Open5e monster search with a quantity picker. Used by the sidebar (Add) and the Squads tab (Staff). */
export function MonsterSearchDialog({ open, onClose, title, maxQuantity, quantityHint, onPick }: MonsterSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Open5eMonster[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Debounced search: waits 300ms after typing stops
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchOpen5e(query);
        setSearchResults(results);
        if (results.length === 0) setSearchError('No monsters found');
      } catch {
        setSearchError('Failed to search. Check your internet connection.');
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setQuantity(1);
    onClose();
  };

  const handlePick = (monster: Open5eMonster) => {
    onPick(monster, quantity);
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          placeholder="Search for monsters (e.g., 'goblin', 'dragon', 'devil')"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          sx={{ mb: 2, mt: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: isSearching ? (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            ) : null,
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">Quantity:</Typography>
          <IconButton size="small" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
            <RemoveIcon fontSize="small" />
          </IconButton>
          <TextField
            size="small" type="number" value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1)))}
            inputProps={{ min: 1, max: maxQuantity, style: { width: 40, textAlign: 'center', padding: '4px' } }}
          />
          <IconButton size="small" onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity}>
            <AddIcon fontSize="small" />
          </IconButton>
          {quantity > 1 && <Typography variant="caption" color="text.secondary">{quantityHint(quantity)}</Typography>}
        </Box>

        {searchError && searchResults.length === 0 && (
          <Typography color="text.secondary" align="center" sx={{ py: 2 }}>{searchError}</Typography>
        )}

        {searchResults.length > 0 && (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {searchResults.map((monster) => (
              <ListItem key={monster.slug} disablePadding>
                <ListItemButton onClick={() => handlePick(monster)}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight={600}>{monster.name}</Typography>
                        <Chip label={`CR ${monster.challenge_rating}`} size="small" sx={{ height: 18, fontSize: '0.625rem' }} />
                        {quantity > 1 && <Chip label={`+${quantity}`} size="small" color="primary" sx={{ height: 18, fontSize: '0.625rem' }} />}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {monster.size} {monster.type} • HP {monster.hit_points} • AC {monster.armor_class}
                        {monster.document__title && ` • ${monster.document__title}`}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <Typography color="text.secondary" align="center" sx={{ py: 2 }}>Type at least 2 characters to search</Typography>
        )}

        {searchQuery.length === 0 && (
          <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
            Search the Open5e database for SRD monsters.
            <br />
            <Typography variant="caption" component="span">Includes monsters from the 5e SRD, Tome of Beasts, and more.</Typography>
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
