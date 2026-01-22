/**
 * User Menu Component
 * Shows user avatar and dropdown menu with account options
 */

import { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Typography,
  Divider,
  ListItemIcon,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import CloudIcon from '@mui/icons-material/Cloud';
import { useAuth } from '../../context/AuthContext';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    handleClose();
    await signOut();
  };

  if (!user) return null;

  return (
    <Box>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{ ml: 1 }}
        aria-controls={open ? 'user-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Avatar
          src={user.photoURL || undefined}
          alt={user.displayName || 'User'}
          sx={{
            width: 32,
            height: 32,
            bgcolor: '#ff6b35',
            fontSize: '0.875rem',
          }}
        >
          {user.displayName?.[0] || user.email?.[0] || 'U'}
        </Avatar>
      </IconButton>

      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            border: '1px solid #333',
            minWidth: 200,
            mt: 1,
          },
        }}
      >
        {/* User Info */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {user.displayName || 'User'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.email}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: '#333' }} />

        {/* Cloud Status */}
        <MenuItem disabled sx={{ opacity: 0.7 }}>
          <ListItemIcon>
            <CloudIcon fontSize="small" sx={{ color: '#22c55e' }} />
          </ListItemIcon>
          <Typography variant="body2">Cloud sync enabled</Typography>
        </MenuItem>

        <Divider sx={{ borderColor: '#333' }} />

        {/* Sign Out */}
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="body2">Sign out</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
}
