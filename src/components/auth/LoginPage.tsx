/**
 * Login Page Component
 * Full-page login screen for unauthenticated users
 */

import { Box, Button, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const { signInWithGoogle, loading, error } = useAuth();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#0a0a0a',
        backgroundImage: 'radial-gradient(circle at 50% 50%, #1a0a0a 0%, #0a0a0a 100%)',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          mx: 2,
          bgcolor: '#1a1a1a',
          border: '1px solid #333',
          textAlign: 'center',
        }}
      >
        {/* Logo/Title */}
        <Typography
          variant="h4"
          sx={{
            color: '#ff6b35',
            fontWeight: 700,
            mb: 1,
            textShadow: '0 0 20px rgba(255, 107, 53, 0.3)',
          }}
        >
          5e Vehicle Combat
        </Typography>
        <Typography
          variant="subtitle1"
          sx={{ color: '#888', mb: 4 }}
        >
          Avernus Chase Tracker
        </Typography>

        {/* Decorative divider */}
        <Box
          sx={{
            width: 60,
            height: 2,
            bgcolor: '#ff6b35',
            mx: 'auto',
            mb: 4,
            opacity: 0.5,
          }}
        />

        {/* Description */}
        <Typography variant="body2" sx={{ color: '#aaa', mb: 4 }}>
          Sign in to save your encounters to the cloud and access them from any device.
        </Typography>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            {error}
          </Alert>
        )}

        {/* Sign In Buttons */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
          onClick={signInWithGoogle}
          disabled={loading}
          sx={{
            py: 1.5,
            bgcolor: '#4285f4',
            '&:hover': { bgcolor: '#3574e2' },
            mb: 2,
          }}
        >
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </Button>

        {/* Future: Apple Sign In */}
        {/* <Button
          variant="outlined"
          size="large"
          fullWidth
          startIcon={<AppleIcon />}
          sx={{
            py: 1.5,
            borderColor: '#333',
            color: '#fff',
            '&:hover': { borderColor: '#555', bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          Sign in with Apple
        </Button> */}

        {/* Footer */}
        <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 4 }}>
          Your data is stored securely in the cloud.
          <br />
          We never share your information.
        </Typography>
      </Paper>
    </Box>
  );
}
