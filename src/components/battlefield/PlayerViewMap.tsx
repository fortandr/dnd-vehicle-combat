/**
 * Player View Map Component
 * Read-only battlefield view for VTT projection on external monitors
 */

import { useRef, useEffect, useState } from 'react';
import { useBroadcastReceiver, BattlefieldSyncState } from '../../hooks/useBroadcastChannel';
import { SCALES } from '../../data/scaleConfig';
import { Vehicle, Creature, Position, VehicleWeapon, CrewAssignment } from '../../types';

export function PlayerViewMap() {
  const { state, isConnected } = useBroadcastReceiver();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  // Use document dimensions to get accurate viewport size without scrollbars
  const [dimensions, setDimensions] = useState({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight - 40
  });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      // Use clientWidth/clientHeight which excludes scrollbars
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight - 40; // Account for 40px status bar
      setDimensions({ width, height });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    // Also listen for orientation changes on mobile
    window.addEventListener('orientationchange', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, []);

  if (!isConnected || !state) {
    return (
      <div className="player-view-waiting">
        <div className="waiting-content">
          <h1>5e Vehicular Combat</h1>
          <p>Waiting for connection from DM screen...</p>
          <p className="text-muted">Open the main combat tracker to sync</p>
        </div>
      </div>
    );
  }

  const { width, height } = dimensions;
  const currentScale = SCALES[state.scale];

  // Use DM's zoom and pan values to match their view exactly
  // The DM's zoom is already factored with mapScale, so pixelsPerFoot = mapScale * zoom
  const pixelsPerFoot = currentScale.mapScale * state.zoom;

  // Map center uses DM's pan offset, adjusted for player view dimensions
  // DM's panOffset is calculated relative to their viewport center
  const mapCenter = {
    x: width / 2 + state.panOffset.x,
    y: height / 2 + state.panOffset.y,
  };

  // Calculate minimum scale multiplier to ensure background fills viewport
  // This preserves the coordinate system while ensuring no black edges
  const getBackgroundScaleMultiplier = () => {
    const bg = state.backgroundImage;
    if (!bg || !bg.naturalWidth || !bg.naturalHeight) return 1;

    const feetPerPixel = bg.feetPerPixel || 1;
    const bgScale = bg.scale || 1;

    // Calculate current rendered size of the image
    const baseScale = feetPerPixel * pixelsPerFoot * bgScale;
    const currentImageWidth = bg.naturalWidth * baseScale;
    const currentImageHeight = bg.naturalHeight * baseScale;

    // Calculate multiplier needed to fill viewport (like CSS cover)
    const scaleToFillWidth = width / currentImageWidth;
    const scaleToFillHeight = height / currentImageHeight;

    // Use the larger multiplier to ensure full coverage, minimum 1 (don't shrink)
    return Math.max(scaleToFillWidth, scaleToFillHeight, 1);
  };

  const bgScaleMultiplier = getBackgroundScaleMultiplier();

  // Convert world position (feet) to screen position (pixels)
  const worldToScreen = (pos: Position) => ({
    x: mapCenter.x + pos.x * pixelsPerFoot,
    y: mapCenter.y + pos.y * pixelsPerFoot,
  });

  // Get vehicle size in feet based on template ID or size category
  // Based on real-world vehicle equivalents for visual accuracy
  const getVehicleSizeInFeet = (size: string, templateId?: string): number => {
    // Specific vehicle dimensions based on real-world equivalents
    if (templateId) {
      const templateSizes: Record<string, number> = {
        'demon-grinder': 45,  // Tour bus (~40-45 ft)
        'scavenger': 28,      // Garbage truck (~25-30 ft)
        'tormentor': 22,      // APC (~20-25 ft)
        'buzz-killer': 15,    // Sedan (~15 ft)
        'devils-ride': 8,     // Touring motorcycle (~8 ft)
      };
      if (templateSizes[templateId]) {
        return templateSizes[templateId];
      }
    }
    // Fallback to size category
    switch (size) {
      case 'large': return 10;
      case 'huge': return 25;
      case 'gargantuan': return 45;
      default: return 10;
    }
  };

  // Get creature size in feet
  const getCreatureSizeInFeet = (size: string): number => {
    switch (size) {
      case 'tiny': return 2.5;
      case 'small': return 5;
      case 'medium': return 5;
      case 'large': return 10;
      case 'huge': return 15;
      case 'gargantuan': return 20;
      default: return 5;
    }
  };

  return (
    <div ref={containerRef} className="player-view-container">
      {/* Status Bar */}
      <div className="player-view-status">
        <span className={`badge badge-scale-${state.scale}`}>
          {currentScale.displayName}
        </span>
        {state.phase === 'combat' && (
          <span className="badge badge-fire">Round {state.round}</span>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="player-view-map"
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Background Image */}
        {state.backgroundImage && (
          <img
            src={state.backgroundImage.url}
            alt=""
            style={{
              position: 'absolute',
              left: mapCenter.x + state.backgroundImage.position.x * pixelsPerFoot,
              top: mapCenter.y + state.backgroundImage.position.y * pixelsPerFoot,
              // Scale image: feetPerPixel converts image pixels to feet, pixelsPerFoot converts feet to screen pixels
              // Apply bgScaleMultiplier to ensure image always fills viewport (like CSS cover)
              transform: `translate(-50%, -50%) scale(${(state.backgroundImage.feetPerPixel || 1) * pixelsPerFoot * state.backgroundImage.scale * bgScaleMultiplier})`,
              opacity: state.backgroundImage.opacity,
              pointerEvents: 'none',
              maxWidth: 'none',
              zIndex: 0,
            }}
          />
        )}

        {/* Grid */}
        <PlayerViewGrid
          width={width}
          height={height}
          pixelsPerFoot={pixelsPerFoot}
          mapCenter={mapCenter}
          scale={state.scale}
        />

        {/* Distance Lines */}
        <PlayerViewDistanceLines
          vehicles={state.vehicles}
          worldToScreen={worldToScreen}
        />

        {/* Vehicle Tokens */}
        {state.vehicles.map((vehicle) => {
          const screenPos = worldToScreen(vehicle.position);
          const vehicleFeet = getVehicleSizeInFeet(vehicle.template.size, vehicle.template.id);
          const scaledSize = vehicleFeet * pixelsPerFoot;
          const tokenSize = Math.max(24, scaledSize); // Min 24px for visibility, no max
          const borderColor = vehicle.type === 'party' ? 'var(--color-health)' : 'var(--color-fire)';
          const isInoperative = vehicle.isInoperative || vehicle.currentHp === 0;
          const weaponRangesByArc = getWeaponRangesByArc(vehicle, state.crewAssignments, state.creatures);
          const maxWeaponRange = Math.max(
            weaponRangesByArc.front,
            weaponRangesByArc.rear,
            weaponRangesByArc.left,
            weaponRangesByArc.right
          );

          return (
            <div
              key={vehicle.id}
              className="player-view-token vehicle-token"
              style={{
                position: 'absolute',
                left: screenPos.x,
                top: screenPos.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Weapon Range Arcs - only show for operational vehicles with manned weapons */}
              {maxWeaponRange > 0 && !isInoperative && (
                <PlayerViewWeaponRangeArcs
                  weaponRanges={weaponRangesByArc}
                  pixelsPerFoot={pixelsPerFoot}
                  tokenSize={tokenSize}
                  vehicleType={vehicle.type}
                  facing={vehicle.facing}
                />
              )}
              {/* Vehicle Icon */}
              <div
                style={{
                  width: tokenSize,
                  height: tokenSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `rotate(${vehicle.facing || 0}deg)`,
                  transformOrigin: 'center center',
                }}
              >
                <PlayerViewVehicleIcon
                  templateId={vehicle.template.id}
                  size={tokenSize * 0.9}
                  color={borderColor}
                />
              </div>
              <div className="token-label">{vehicle.name}</div>
              <div className="token-hp">
                {vehicle.currentHp}/{vehicle.template.maxHp}
              </div>
            </div>
          );
        })}

        {/* Creature Tokens (not on vehicles) */}
        {state.creatures
          .filter((c) => {
            const isAssigned = state.crewAssignments.some((a) => a.creatureId === c.id);
            return !isAssigned && c.position;
          })
          .map((creature) => {
            const screenPos = worldToScreen(creature.position!);
            const creatureFeet = getCreatureSizeInFeet(creature.statblock.size);
            const scaledSize = creatureFeet * pixelsPerFoot;
            const tokenSize = Math.max(30, Math.min(scaledSize, 100));
            const isPC = creature.statblock.type === 'pc';

            return (
              <div
                key={creature.id}
                className="player-view-token creature-token"
                style={{
                  position: 'absolute',
                  left: screenPos.x,
                  top: screenPos.y,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className={`token-circle ${isPC ? 'pc' : 'npc'}`}
                  style={{ width: tokenSize, height: tokenSize }}
                >
                  <span className="token-letter">{creature.name.charAt(0)}</span>
                </div>
                <div className="token-label">{creature.name}</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// Simple grid component for player view
function PlayerViewGrid({
  width,
  height,
  pixelsPerFoot,
  mapCenter,
  scale,
}: {
  width: number;
  height: number;
  pixelsPerFoot: number;
  mapCenter: { x: number; y: number };
  scale: string;
}) {
  // Calculate grid size targeting ~50 pixels per square
  const targetPixels = 50;
  const worldPerGrid = targetPixels / pixelsPerFoot;
  let gridFeet: number;

  if (worldPerGrid >= 1000) gridFeet = Math.round(worldPerGrid / 1000) * 1000;
  else if (worldPerGrid >= 100) gridFeet = Math.round(worldPerGrid / 100) * 100;
  else if (worldPerGrid >= 10) gridFeet = Math.round(worldPerGrid / 10) * 10;
  else gridFeet = Math.max(5, Math.round(worldPerGrid / 5) * 5);

  const gridSize = gridFeet * pixelsPerFoot;

  const scaleColors: Record<string, string> = {
    strategic: '#8b5cf6',
    approach: '#3b82f6',
    tactical: '#22c55e',
    point_blank: '#ef4444',
  };

  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
    >
      <defs>
        <pattern
          id="player-grid"
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
          x={mapCenter.x % gridSize}
          y={mapCenter.y % gridSize}
        >
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke={scaleColors[scale] || '#22c55e'}
            strokeWidth="1"
            strokeOpacity="0.3"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#player-grid)" />
    </svg>
  );
}

// Distance lines between vehicles
function PlayerViewDistanceLines({
  vehicles,
  worldToScreen,
}: {
  vehicles: Vehicle[];
  worldToScreen: (pos: Position) => { x: number; y: number };
}) {
  const partyVehicles = vehicles.filter((v) => v.type === 'party');
  const enemyVehicles = vehicles.filter((v) => v.type === 'enemy');

  const lines: Array<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    distance: number;
  }> = [];

  partyVehicles.forEach((pv) => {
    enemyVehicles.forEach((ev) => {
      const from = worldToScreen(pv.position);
      const to = worldToScreen(ev.position);
      const distance = Math.sqrt(
        Math.pow(ev.position.x - pv.position.x, 2) +
        Math.pow(ev.position.y - pv.position.y, 2)
      );
      lines.push({ from, to, distance });
    });
  });

  if (lines.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {lines.map((line, i) => {
        const midX = (line.from.x + line.to.x) / 2;
        const midY = (line.from.y + line.to.y) / 2;
        const distanceText =
          line.distance >= 5280
            ? `${(line.distance / 5280).toFixed(1)} mi`
            : `${Math.round(line.distance)} ft`;

        return (
          <g key={i}>
            <line
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
              stroke="#ff6b35"
              strokeWidth="2"
              strokeDasharray="8,4"
              strokeOpacity="0.6"
            />
            <rect
              x={midX - 30}
              y={midY - 10}
              width="60"
              height="20"
              fill="rgba(0,0,0,0.7)"
              rx="4"
            />
            <text
              x={midX}
              y={midY + 5}
              textAnchor="middle"
              fill="#ff6b35"
              fontSize="12"
              fontFamily="monospace"
            >
              {distanceText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ==========================================
// Helper Functions
// ==========================================

function parseWeaponRange(range?: string): number {
  if (!range) return 0;
  if (range.toLowerCase() === 'melee') return 5;
  const rangeMatch = range.match(/(\d+)/);
  if (rangeMatch) {
    return parseInt(rangeMatch[1], 10);
  }
  return 0;
}

/**
 * Get max weapon range per arc direction
 * Only includes ranges for weapons that have a living crew member manning them
 */
function getWeaponRangesByArc(
  vehicle: Vehicle,
  crewAssignments: CrewAssignment[],
  creatures: Creature[]
): Record<'front' | 'rear' | 'left' | 'right', number> {
  const ranges = { front: 0, rear: 0, left: 0, right: 0 };

  if (!vehicle.weapons || vehicle.weapons.length === 0) return ranges;

  // Get all crew assigned to this vehicle
  const vehicleCrew = crewAssignments.filter((a) => a.vehicleId === vehicle.id);

  for (const weapon of vehicle.weapons) {
    // Check if this weapon's zone is manned by a living creature
    const crewAtStation = vehicleCrew.find((a) => a.zoneId === weapon.zoneId);
    if (!crewAtStation) continue; // No one at this station

    const crewMember = creatures.find((c) => c.id === crewAtStation.creatureId);
    if (!crewMember || crewMember.currentHp === 0) continue; // Crew member is dead or not found

    // Station is manned by living crew - include this weapon's range
    const range = parseWeaponRange(weapon.range);
    const arcs = weapon.visibleFromArcs || ['front', 'rear', 'left', 'right'];

    for (const arc of arcs) {
      if (range > ranges[arc]) {
        ranges[arc] = range;
      }
    }
  }

  return ranges;
}

// ==========================================
// Weapon Range Arcs Component
// ==========================================

interface PlayerViewWeaponRangeArcsProps {
  weaponRanges: Record<'front' | 'rear' | 'left' | 'right', number>;
  pixelsPerFoot: number;
  tokenSize: number;
  vehicleType: 'party' | 'enemy';
  facing: number;
}

function PlayerViewWeaponRangeArcs({
  weaponRanges,
  pixelsPerFoot,
  tokenSize,
  vehicleType,
  facing,
}: PlayerViewWeaponRangeArcsProps) {
  const baseColor = vehicleType === 'party' ? '34, 197, 94' : '255, 69, 0';
  const maxRange = Math.max(weaponRanges.front, weaponRanges.rear, weaponRanges.left, weaponRanges.right);
  const svgSize = maxRange * pixelsPerFoot * 2 + 20;
  const center = svgSize / 2;

  const arcConfig = {
    front: { startAngle: -45, endAngle: 45 },
    right: { startAngle: 45, endAngle: 135 },
    rear: { startAngle: 135, endAngle: 225 },
    left: { startAngle: 225, endAngle: 315 },
  };

  const polarToCartesian = (cx: number, cy: number, radius: number, angleDegrees: number) => {
    const angleRad = ((angleDegrees - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(angleRad),
      y: cy + radius * Math.sin(angleRad),
    };
  };

  const describeArc = (cx: number, cy: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };

  if (maxRange * pixelsPerFoot < 10) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        left: tokenSize / 2 - center,
        top: tokenSize / 2 - center,
        width: svgSize,
        height: svgSize,
        pointerEvents: 'none',
        zIndex: -1,
        transform: `rotate(${facing}deg)`,
        transformOrigin: 'center center',
      }}
    >
      {(['front', 'rear', 'left', 'right'] as const).map((dir) => {
        const range = weaponRanges[dir];
        if (range <= 0) return null;

        const radius = range * pixelsPerFoot;
        const { startAngle, endAngle } = arcConfig[dir];

        return (
          <g key={dir}>
            <path
              d={describeArc(center, center, radius, startAngle, endAngle)}
              fill={`rgba(${baseColor}, 0.1)`}
              stroke={`rgba(${baseColor}, 0.5)`}
              strokeWidth={2}
              strokeDasharray="8 4"
            />
            <text
              x={center + (radius * 0.6) * Math.cos((((startAngle + endAngle) / 2) - 90) * Math.PI / 180)}
              y={center + (radius * 0.6) * Math.sin((((startAngle + endAngle) / 2) - 90) * Math.PI / 180)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={`rgba(${baseColor}, 0.9)`}
              fontSize={11}
              fontWeight="bold"
              transform={`rotate(${-facing}, ${center + (radius * 0.6) * Math.cos((((startAngle + endAngle) / 2) - 90) * Math.PI / 180)}, ${center + (radius * 0.6) * Math.sin((((startAngle + endAngle) / 2) - 90) * Math.PI / 180)})`}
            >
              {range}ft
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ==========================================
// Vehicle Icon Component
// ==========================================

interface PlayerViewVehicleIconProps {
  templateId: string;
  size: number;
  color: string;
}

function PlayerViewVehicleIcon({ templateId, size, color }: PlayerViewVehicleIconProps) {
  const id = templateId.toLowerCase();

  if (id.includes('buzz') || id.includes('killer')) {
    return (
      <svg width={size} height={size} viewBox="0 0 28 44">
        <circle cx="14" cy="6" r="5" fill={color} opacity="0.9" />
        <path
          d="M14,1 L15,4 L18,2 L16,5 L19,6 L16,7 L18,10 L15,8 L14,11 L13,8 L10,10 L12,7 L9,6 L12,5 L10,2 L13,4 Z"
          fill={color}
        />
        <path d="M8,12 L20,12 L22,20 L22,32 L20,36 L8,36 L6,32 L6,20 Z" fill={color} opacity="0.8" />
        <circle cx="8" cy="38" r="4" fill={color} />
        <circle cx="20" cy="38" r="4" fill={color} />
        <path
          d="M8,34 L9,36 L8,38 L7,36 Z M4,38 L6,37 L8,38 L6,39 Z M8,42 L7,40 L8,38 L9,40 Z M12,38 L10,39 L8,38 L10,37 Z"
          fill={color}
        />
        <path
          d="M20,34 L21,36 L20,38 L19,36 Z M16,38 L18,37 L20,38 L18,39 Z M20,42 L19,40 L20,38 L21,40 Z M24,38 L22,39 L20,38 L22,37 Z"
          fill={color}
        />
        <circle cx="14" cy="18" r="3.5" fill="#000" stroke={color} strokeWidth="1.5" />
        <circle cx="14" cy="28" r="3" fill="#666" stroke={color} strokeWidth="1" />
      </svg>
    );
  }

  if (id.includes('devil') || id.includes('ride')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 40">
        <ellipse cx="12" cy="20" rx="6" ry="16" fill={color} opacity="0.8" />
        <ellipse cx="12" cy="6" rx="4" ry="3" fill={color} />
        <ellipse cx="12" cy="34" rx="4" ry="3" fill={color} />
        <circle cx="12" cy="18" r="3" fill="#000" stroke={color} strokeWidth="1" />
      </svg>
    );
  }

  if (id.includes('grinder') || id.includes('demon')) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 48">
        <rect x="4" y="8" width="32" height="36" fill={color} opacity="0.8" rx="2" />
        <path d="M8,8 L12,2 L16,8 L20,2 L24,8 L28,2 L32,8" fill={color} />
        <rect x="0" y="12" width="4" height="28" fill={color} rx="1" />
        <rect x="36" y="12" width="4" height="28" fill={color} rx="1" />
        <circle cx="20" cy="14" r="3.5" fill="#000" stroke={color} strokeWidth="1.5" />
        <circle cx="20" cy="6" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
        <circle cx="20" cy="38" r="3" fill="#ff6b35" stroke={color} strokeWidth="1" />
        <circle cx="8" cy="18" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
        <circle cx="32" cy="18" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
        <circle cx="8" cy="32" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
        <circle cx="32" cy="32" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
      </svg>
    );
  }

  if (id.includes('tormentor')) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 40">
        <polygon points="16,4 4,16 4,36 28,36 28,16" fill={color} opacity="0.8" />
        <circle cx="8" cy="32" r="3" fill={color} />
        <circle cx="24" cy="32" r="3" fill={color} />
        <circle cx="16" cy="20" r="3" fill="#000" stroke={color} strokeWidth="1.5" />
        <circle cx="16" cy="8" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
        <circle cx="7" cy="26" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
        <circle cx="25" cy="26" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
      </svg>
    );
  }

  if (id.includes('scavenger')) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 44">
        <polygon points="18,2 6,14 6,38 30,38 30,14" fill={color} opacity="0.8" />
        <circle cx="10" cy="36" r="3" fill={color} />
        <circle cx="26" cy="36" r="3" fill={color} />
        <rect x="2" y="18" width="4" height="16" fill={color} rx="1" />
        <rect x="30" y="18" width="4" height="16" fill={color} rx="1" />
        <circle cx="18" cy="16" r="3" fill="#000" stroke={color} strokeWidth="1.5" />
        <circle cx="6" cy="22" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
        <circle cx="30" cy="22" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
        <circle cx="18" cy="32" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1" />
      </svg>
    );
  }

  // Default generic vehicle icon
  return (
    <svg width={size} height={size} viewBox="0 0 32 40">
      <rect x="4" y="4" width="24" height="32" fill={color} opacity="0.8" rx="3" />
      <circle cx="10" cy="34" r="3" fill={color} />
      <circle cx="22" cy="34" r="3" fill={color} />
      <polygon points="16,2 4,10 4,12 28,12 28,10" fill={color} />
      <circle cx="16" cy="14" r="3" fill="#000" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
