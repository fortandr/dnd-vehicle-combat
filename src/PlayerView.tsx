/**
 * Player View Entry Point
 * Standalone page for VTT projection on external monitors
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PlayerViewMap } from './components/battlefield/PlayerViewMap';
import './styles/index.css';
import './styles/player-view.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlayerViewMap />
  </StrictMode>
);
