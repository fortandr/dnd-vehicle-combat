import type { Creature, Squad } from '../../types';
import { squadStandingCount } from '../../utils/squads';
import { isLeaderDown } from '../../utils/morale';
import { factionColors } from '../../theme/customColors';
import { SquadTokenOverlay } from './SquadTokenOverlay';
import { MoraleTokenMarker } from '../morale/MoraleTokenMarker';

/**
 * A squad's map token: name initial, ★ while its leader stands, standing/starting badge and ring, morale marker.
 * Drawn 10 ft across so it reads as a group. Shared by the DM map and the player view; never shows members.
 */
export function SquadTokenFace({ squad, creatures, pixelsPerFoot, isCurrentTurn = false, showLabel = true }: {
  squad: Squad; creatures: Creature[]; pixelsPerFoot: number; isCurrentTurn?: boolean; showLabel?: boolean;
}) {
  const tokenSize = Math.max(24, 10 * pixelsPerFoot);
  const standing = squadStandingCount(squad, creatures);
  const leader = squad.leaderId ? creatures.find((c) => c.id === squad.leaderId) : undefined;
  const leaderUp = squad.leaderId !== undefined && !isLeaderDown(leader);
  const out = standing === 0;
  const color = squad.faction === 'party' ? factionColors.party : factionColors.enemy;
  return (
    <div style={{ position: 'relative', width: tokenSize, height: tokenSize }}>
      <div
        style={{
          width: tokenSize, height: tokenSize, borderRadius: '50%', boxSizing: 'border-box', position: 'relative',
          background: out ? '#333' : 'var(--color-bg-secondary, #1f1f1f)',
          border: `${isCurrentTurn ? 4 : 3}px solid ${out ? '#666' : isCurrentTurn ? '#ff4500' : color}`,
          boxShadow: isCurrentTurn ? '0 0 12px rgba(255, 69, 0, 0.6)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.max(10, tokenSize * 0.4), fontWeight: 'bold', color: out ? '#666' : '#f3f4f6',
          filter: out ? 'grayscale(1) brightness(0.6)' : 'none',
        }}
      >
        {squad.name.charAt(0).toUpperCase()}
        {leaderUp && (
          <span style={{ position: 'absolute', top: -tokenSize * 0.22, right: -tokenSize * 0.12, fontSize: Math.max(10, tokenSize * 0.3), color: '#f59e0b', textShadow: '0 0 3px #000', pointerEvents: 'none' }}>
            ★
          </span>
        )}
        <SquadTokenOverlay squad={{ size: squad.startingCount, bodies: standing }} tokenSize={tokenSize} />
        {squad.morale?.status && <MoraleTokenMarker status={squad.morale.status} tokenSize={tokenSize} />}
      </div>
      {showLabel && (
        <div
          style={{
            position: 'absolute', top: tokenSize + 4, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            fontSize: 9, fontWeight: 'bold', color: '#f3f4f6', background: 'rgba(0,0,0,0.75)', padding: '1px 4px', borderRadius: 2,
            pointerEvents: 'none',
          }}
        >
          {squad.name}
        </div>
      )}
    </div>
  );
}
