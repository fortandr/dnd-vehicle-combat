/**
 * useBroadcastChannel Hook
 * Enables cross-window state synchronization for player view VTT display
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Vehicle, Creature, ScaleName, BackgroundImageConfig, CrewAssignment, CombatPhase } from '../types';

export interface BattlefieldSyncState {
  vehicles: Vehicle[];
  creatures: Creature[];
  crewAssignments: CrewAssignment[];
  scale: ScaleName;
  backgroundImage?: BackgroundImageConfig;
  zoom: number;
  panOffset: { x: number; y: number };
  round: number;
  phase: CombatPhase;
}

const CHANNEL_NAME = 'avernus-battlefield-sync';

/**
 * Hook for the main window (source) to broadcast state
 */
export function useBroadcastSource() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME);
    }
    return () => {
      channelRef.current?.close();
    };
  }, []);

  const broadcast = useCallback((state: BattlefieldSyncState) => {
    channelRef.current?.postMessage({ type: 'sync', payload: state });
  }, []);

  return { broadcast };
}

/**
 * Hook for the player view window (receiver) to receive state
 */
export function useBroadcastReceiver() {
  const [state, setState] = useState<BattlefieldSyncState | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('BroadcastChannel not supported in this browser');
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (event) => {
      if (event.data?.type === 'sync') {
        setState(event.data.payload);
        setIsConnected(true);
      }
    };

    // Request initial state
    channel.postMessage({ type: 'request-sync' });

    return () => {
      channel.close();
    };
  }, []);

  return { state, isConnected };
}
