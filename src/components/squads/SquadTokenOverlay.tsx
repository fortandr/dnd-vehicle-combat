/** Body-count badge plus a ring that drains as bodies fall. Shared by the DM map and the player view. */
export function SquadTokenOverlay({ squad, tokenSize }: { squad: { size: number; bodies: number }; tokenSize: number }) {
  const fraction = squad.size > 0 ? squad.bodies / squad.size : 0;
  const stroke = Math.max(2, tokenSize * 0.08);
  const box = tokenSize + stroke * 4;
  const r = (box - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <>
      <svg
        width={box}
        height={box}
        style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)', pointerEvents: 'none' }}
      >
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={stroke} />
        <circle
          cx={box / 2} cy={box / 2} r={r} fill="none" stroke="#f59e0b" strokeWidth={stroke}
          strokeDasharray={`${circumference * fraction} ${circumference}`}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          right: -tokenSize * 0.25,
          bottom: -tokenSize * 0.15,
          fontSize: Math.max(9, tokenSize * 0.3),
          fontWeight: 700,
          lineHeight: 1,
          padding: '2px 4px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.85)',
          color: squad.bodies === 0 ? '#dc2626' : '#f59e0b',
          border: '1px solid #f59e0b',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {squad.bodies}/{squad.size}
      </span>
    </>
  );
}
