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

    // Always use the zone template's visibleFromArcs as the authoritative source
    // This ensures saved encounters get correct arcs even if weapon data was saved incorrectly
    const zone = vehicle.template.zones.find((z) => z.id === weapon.zoneId);
    const arcs = zone?.visibleFromArcs || weapon.visibleFromArcs || ['front', 'rear', 'left', 'right'];

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
    // Buzz Killer - Hellish trike with massive saw blade front wheel
    // Wedge-shaped predatory profile, low front rising to elevated rear passenger
    return (
      <svg width={size} height={size} viewBox="0 0 32 52">
        {/* === MASSIVE SAW BLADE FRONT WHEEL === */}
        {/* Main saw blade disc */}
        <circle cx="16" cy="8" r="7" fill={color} opacity="0.9"/>
        {/* Inner hub */}
        <circle cx="16" cy="8" r="3" fill="#333" stroke={color} strokeWidth="1"/>
        {/* Saw teeth - jagged edges all around */}
        <path d="M16,0 L17,3 L16,1 L15,3 Z" fill={color}/>
        <path d="M22,2 L20,4 L21,2 L19,3 Z" fill={color}/>
        <path d="M24,8 L21,8 L23,7 L21,7 Z" fill={color}/>
        <path d="M22,14 L20,12 L21,14 L19,13 Z" fill={color}/>
        <path d="M16,16 L15,13 L16,15 L17,13 Z" fill={color}/>
        <path d="M10,14 L12,12 L11,14 L13,13 Z" fill={color}/>
        <path d="M8,8 L11,8 L9,7 L11,7 Z" fill={color}/>
        <path d="M10,2 L12,4 L11,2 L13,3 Z" fill={color}/>
        {/* Larger saw teeth for emphasis */}
        <path d="M16,-1 L14,4 L16,2 L18,4 Z" fill={color}/>
        <path d="M24,6 L19,7 L22,8 L19,9 Z" fill={color}/>
        <path d="M16,17 L18,12 L16,14 L14,12 Z" fill={color}/>
        <path d="M8,6 L13,7 L10,8 L13,9 Z" fill={color}/>
        {/* Grinding glow effect */}
        <circle cx="16" cy="8" r="1.5" fill="#ff4500" opacity="0.6"/>

        {/* === WEDGE-SHAPED FRAME - LOW FRONT, RISING REAR === */}
        {/* Main angular body - predatory wedge shape */}
        <path d="M10,14 L22,14 L26,24 L28,38 L26,42 L6,42 L4,38 L6,24 Z" fill={color} opacity="0.85"/>

        {/* Reinforced front nose connecting to saw */}
        <path d="M12,12 L20,12 L22,14 L10,14 Z" fill={color} opacity="0.9"/>

        {/* Angular armor plating lines */}
        <line x1="8" y1="22" x2="24" y2="22" stroke="#333" strokeWidth="0.8" opacity="0.4"/>
        <line x1="6" y1="32" x2="26" y2="32" stroke="#333" strokeWidth="0.8" opacity="0.4"/>

        {/* === DRIVER'S ARMORED COCKPIT === */}
        {/* Heavy armored shell around driver - 3/4 cover */}
        <path d="M10,18 L22,18 L24,26 L8,26 Z" fill={color} opacity="0.95"/>
        {/* Cockpit viewport slit */}
        <rect x="12" y="16" width="8" height="2" fill="#1a1a1a" opacity="0.7" rx="0.5"/>
        {/* Side armor plates */}
        <rect x="6" y="20" width="3" height="8" fill={color} opacity="0.9" rx="1"/>
        <rect x="23" y="20" width="3" height="8" fill={color} opacity="0.9" rx="1"/>
        {/* Driver helm position - hunched forward */}
        <circle cx="16" cy="22" r="3.5" fill="#000" stroke={color} strokeWidth="1.5"/>

        {/* === ELEVATED PASSENGER PLATFORM === */}
        {/* Raised platform behind driver */}
        <rect x="8" y="30" width="16" height="10" fill={color} opacity="0.8" rx="1"/>
        {/* Platform rails */}
        <line x1="8" y1="30" x2="8" y2="40" stroke={color} strokeWidth="1.5"/>
        <line x1="24" y1="30" x2="24" y2="40" stroke={color} strokeWidth="1.5"/>
        {/* Elevated passenger seat - half cover */}
        <circle cx="16" cy="35" r="3" fill="#666" stroke={color} strokeWidth="1"/>

        {/* === ENGINE HOUSING BETWEEN REAR WHEELS === */}
        <rect x="10" y="40" width="12" height="6" fill={color} opacity="0.9" rx="1"/>
        {/* Engine glow - tormented souls */}
        <ellipse cx="16" cy="43" rx="3" ry="2" fill="#1a1a1a" opacity="0.6"/>
        <ellipse cx="16" cy="43" rx="1.5" ry="1" fill="#ff4500" opacity="0.5"/>
        {/* Exhaust vents */}
        <rect x="11" y="46" width="2" height="2" fill="#333" opacity="0.7"/>
        <rect x="19" y="46" width="2" height="2" fill="#333" opacity="0.7"/>

        {/* === REAR SPIKED WHEELS === */}
        {/* Left rear wheel */}
        <circle cx="6" cy="46" r="5" fill={color} opacity="0.9"/>
        <circle cx="6" cy="46" r="2" fill="#333" stroke={color} strokeWidth="0.5"/>
        {/* Left wheel spikes */}
        <path d="M6,40 L5,43 L7,43 Z" fill={color}/>
        <path d="M0,46 L3,45 L3,47 Z" fill={color}/>
        <path d="M6,52 L5,49 L7,49 Z" fill={color}/>
        <path d="M12,46 L9,45 L9,47 Z" fill={color}/>

        {/* Right rear wheel */}
        <circle cx="26" cy="46" r="5" fill={color} opacity="0.9"/>
        <circle cx="26" cy="46" r="2" fill="#333" stroke={color} strokeWidth="0.5"/>
        {/* Right wheel spikes */}
        <path d="M26,40 L25,43 L27,43 Z" fill={color}/>
        <path d="M32,46 L29,45 L29,47 Z" fill={color}/>
        <path d="M26,52 L25,49 L27,49 Z" fill={color}/>
        <path d="M20,46 L23,45 L23,47 Z" fill={color}/>

        {/* === CHAINS AND TROPHY HOOKS === */}
        {/* Side chains */}
        <line x1="6" y1="28" x2="4" y2="34" stroke={color} strokeWidth="1" strokeDasharray="2,1" opacity="0.7"/>
        <line x1="26" y1="28" x2="28" y2="34" stroke={color} strokeWidth="1" strokeDasharray="2,1" opacity="0.7"/>
        {/* Trophy hooks */}
        <path d="M4,34 L2,36 L4,38" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M28,34 L30,36 L28,38" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        {/* Front frame spikes */}
        <path d="M8,16 L5,17 L8,18 Z" fill={color}/>
        <path d="M24,16 L27,17 L24,18 Z" fill={color}/>
      </svg>
    );
  }

  if (id.includes('devil') || id.includes('ride')) {
    // Devil's Ride - Hellish chopper motorcycle with devil-face cowling
    // Single rider, spiked wheels, horn handlebars, demonic aesthetic
    return (
      <svg width={size} height={size} viewBox="0 0 28 48">
        {/* Front spiked wheel */}
        <ellipse cx="14" cy="6" rx="5" ry="3" fill={color} opacity="0.9"/>
        {/* Wheel spikes */}
        <path d="M9,6 L7,5 L9,4 Z M19,6 L21,5 L19,4 Z M14,3 L13,1 L15,1 Z M14,9 L13,11 L15,11 Z" fill={color}/>

        {/* Devil face cowling - front */}
        <ellipse cx="14" cy="11" rx="6" ry="4" fill={color} opacity="0.85"/>
        {/* Glowing demon eyes */}
        <circle cx="11" cy="10" r="1.5" fill="#ff4500"/>
        <circle cx="17" cy="10" r="1.5" fill="#ff4500"/>
        {/* Grinning mouth detail */}
        <path d="M10,13 Q14,15 18,13" fill="none" stroke="#ff4500" strokeWidth="0.8" opacity="0.7"/>

        {/* Horn handlebars - sweeping back aggressively */}
        <path d="M8,11 Q2,8 1,14 Q2,16 6,15" fill={color} opacity="0.9"/>
        <path d="M20,11 Q26,8 27,14 Q26,16 22,15" fill={color} opacity="0.9"/>
        {/* Horn tips */}
        <circle cx="1" cy="14" r="1" fill={color}/>
        <circle cx="27" cy="14" r="1" fill={color}/>

        {/* Main frame/spine - elongated chopper body */}
        <path d="M10,14 L10,38 Q14,42 18,38 L18,14 Z" fill={color} opacity="0.7"/>

        {/* Engine housing - screaming maw */}
        <ellipse cx="14" cy="26" rx="5" ry="4" fill={color} opacity="0.8"/>
        {/* Maw/intake detail */}
        <ellipse cx="14" cy="26" rx="3" ry="2" fill="#000" opacity="0.5"/>
        {/* Engine glow */}
        <ellipse cx="14" cy="26" rx="1.5" ry="1" fill="#ff4500" opacity="0.6"/>

        {/* Exhaust pipes - trailing back on both sides */}
        <path d="M9,24 L6,26 L5,32 L4,38" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M19,24 L22,26 L23,32 L24,38" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        {/* Exhaust tips with ember glow */}
        <circle cx="4" cy="38" r="1.5" fill={color}/>
        <circle cx="4" cy="38" r="0.8" fill="#ff4500" opacity="0.7"/>
        <circle cx="24" cy="38" r="1.5" fill={color}/>
        <circle cx="24" cy="38" r="0.8" fill="#ff4500" opacity="0.7"/>

        {/* Rear spiked wheel */}
        <ellipse cx="14" cy="42" rx="5" ry="3" fill={color} opacity="0.9"/>
        {/* Wheel spikes */}
        <path d="M9,42 L7,41 L9,40 Z M19,42 L21,41 L19,40 Z M14,39 L13,37 L15,37 Z M14,45 L13,47 L15,47 Z" fill={color}/>

        {/* Chain drive detail */}
        <line x1="10" y1="30" x2="10" y2="40" stroke={color} strokeWidth="0.5" strokeDasharray="1,1" opacity="0.5"/>
        <line x1="18" y1="30" x2="18" y2="40" stroke={color} strokeWidth="0.5" strokeDasharray="1,1" opacity="0.5"/>

        {/* Frame spikes/jagged edges */}
        <path d="M10,18 L7,19 L10,20 Z" fill={color}/>
        <path d="M18,18 L21,19 L18,20 Z" fill={color}/>
        <path d="M10,32 L7,33 L10,34 Z" fill={color}/>
        <path d="M18,32 L21,33 L18,34 Z" fill={color}/>

        {/* Rider position (helm) - single seat */}
        <circle cx="14" cy="19" r="3" fill="#000" stroke={color} strokeWidth="1.5"/>
      </svg>
    );
  }

  if (id.includes('grinder') || id.includes('demon')) {
    // Demon Grinder - Massive armored war machine, 18-wheeler sized
    // Chomper jaws at front, wrecking ball at rear, 6 wheels, heavily armored
    return (
      <svg width={size} height={size} viewBox="0 0 44 72">
        {/* === FRONT SECTION - CHOMPER === */}
        {/* Chomper jaw housing - pivoting front end */}
        <path d="M10,8 L34,8 L36,14 L8,14 Z" fill={color} opacity="0.9"/>
        {/* Grinding teeth - massive iron jaws */}
        <path d="M10,2 L13,8 L16,2 L19,8 L22,2 L25,8 L28,2 L31,8 L34,2" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        {/* Inner teeth row */}
        <path d="M13,5 L15,8 M18,5 L20,8 M23,5 L25,8 M28,5 L30,8" stroke={color} strokeWidth="1.5"/>
        {/* Chomper intake/maw */}
        <rect x="14" y="4" width="16" height="6" fill="#1a1a1a" opacity="0.7" rx="1"/>
        {/* Grinding mechanism glow */}
        <ellipse cx="22" cy="7" rx="4" ry="2" fill="#ff4500" opacity="0.5"/>

        {/* Pivot point behind front wheels */}
        <ellipse cx="22" cy="16" rx="8" ry="3" fill={color} opacity="0.6"/>
        <circle cx="22" cy="16" r="2" fill="#333" stroke={color} strokeWidth="1"/>

        {/* Front wheels - two smaller steering wheels */}
        <ellipse cx="6" cy="12" rx="4" ry="6" fill={color} opacity="0.85"/>
        <ellipse cx="38" cy="12" rx="4" ry="6" fill={color} opacity="0.85"/>
        {/* Front wheel treads */}
        <path d="M4,8 L4,16 M6,7 L6,17 M8,8 L8,16" stroke="#333" strokeWidth="0.5" opacity="0.5"/>
        <path d="M36,8 L36,16 M38,7 L38,17 M40,8 L40,16" stroke="#333" strokeWidth="0.5" opacity="0.5"/>

        {/* === MAIN ARMORED BODY === */}
        {/* Heavy armored hull - tank/APC structure */}
        <rect x="6" y="18" width="32" height="38" fill={color} opacity="0.85" rx="2"/>

        {/* Armor plating lines */}
        <line x1="6" y1="26" x2="38" y2="26" stroke="#333" strokeWidth="0.8" opacity="0.4"/>
        <line x1="6" y1="36" x2="38" y2="36" stroke="#333" strokeWidth="0.8" opacity="0.4"/>
        <line x1="6" y1="46" x2="38" y2="46" stroke="#333" strokeWidth="0.8" opacity="0.4"/>

        {/* Rivets along armor */}
        <circle cx="10" cy="22" r="1" fill="#333" opacity="0.6"/>
        <circle cx="34" cy="22" r="1" fill="#333" opacity="0.6"/>
        <circle cx="10" cy="32" r="1" fill="#333" opacity="0.6"/>
        <circle cx="34" cy="32" r="1" fill="#333" opacity="0.6"/>
        <circle cx="10" cy="42" r="1" fill="#333" opacity="0.6"/>
        <circle cx="34" cy="42" r="1" fill="#333" opacity="0.6"/>
        <circle cx="10" cy="52" r="1" fill="#333" opacity="0.6"/>
        <circle cx="34" cy="52" r="1" fill="#333" opacity="0.6"/>

        {/* Defensive spikes along sides */}
        <path d="M6,24 L2,25 L6,26 Z" fill={color}/>
        <path d="M6,34 L2,35 L6,36 Z" fill={color}/>
        <path d="M6,44 L2,45 L6,46 Z" fill={color}/>
        <path d="M38,24 L42,25 L38,26 Z" fill={color}/>
        <path d="M38,34 L42,35 L38,36 Z" fill={color}/>
        <path d="M38,44 L42,45 L38,46 Z" fill={color}/>

        {/* Middle wheels - medium size */}
        <ellipse cx="4" cy="34" rx="4" ry="7" fill={color} opacity="0.9"/>
        <ellipse cx="40" cy="34" rx="4" ry="7" fill={color} opacity="0.9"/>
        {/* Middle wheel treads/spikes */}
        <path d="M2,29 L0,30 L2,31 Z M2,36 L0,37 L2,38 Z" fill={color}/>
        <path d="M42,29 L44,30 L42,31 Z M42,36 L44,37 L42,38 Z" fill={color}/>

        {/* Rear wheels - MASSIVE crushing wheels */}
        <ellipse cx="3" cy="54" rx="5" ry="9" fill={color} opacity="0.95"/>
        <ellipse cx="41" cy="54" rx="5" ry="9" fill={color} opacity="0.95"/>
        {/* Rear wheel crushing treads */}
        <path d="M1,47 L-2,48 L1,49 Z M1,53 L-2,54 L1,55 Z M1,59 L-2,60 L1,61 Z" fill={color}/>
        <path d="M43,47 L46,48 L43,49 Z M43,53 L46,54 L43,55 Z M43,59 L46,60 L43,61 Z" fill={color}/>
        {/* Wheel hub details */}
        <circle cx="3" cy="54" r="2" fill="#333" stroke={color} strokeWidth="0.5"/>
        <circle cx="41" cy="54" r="2" fill="#333" stroke={color} strokeWidth="0.5"/>

        {/* === WEAPON STATIONS === */}
        {/* Helm station - front of main body */}
        <circle cx="22" cy="22" r="4" fill="#000" stroke={color} strokeWidth="1.5"/>

        {/* Chomper operator station */}
        <circle cx="22" cy="12" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1"/>

        {/* Harpoon Flinger stations - sides */}
        <rect x="2" y="20" width="5" height="6" fill={color} opacity="0.9" rx="1"/>
        <circle cx="4" cy="23" r="2" fill="#ff6b35" stroke={color} strokeWidth="1"/>
        <rect x="37" y="20" width="5" height="6" fill={color} opacity="0.9" rx="1"/>
        <circle cx="40" cy="23" r="2" fill="#ff6b35" stroke={color} strokeWidth="1"/>

        {/* Additional crew positions */}
        <circle cx="14" cy="30" r="2" fill="#666" stroke={color} strokeWidth="0.8" opacity="0.7"/>
        <circle cx="30" cy="30" r="2" fill="#666" stroke={color} strokeWidth="0.8" opacity="0.7"/>
        <circle cx="14" cy="40" r="2" fill="#666" stroke={color} strokeWidth="0.8" opacity="0.7"/>
        <circle cx="30" cy="40" r="2" fill="#666" stroke={color} strokeWidth="0.8" opacity="0.7"/>

        {/* === REAR SECTION - WRECKING BALL === */}
        {/* Rear platform */}
        <rect x="10" y="56" width="24" height="6" fill={color} opacity="0.8" rx="1"/>

        {/* Wrecking ball station */}
        <circle cx="22" cy="59" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1"/>

        {/* Chain extending to wrecking ball */}
        <line x1="22" y1="62" x2="22" y2="68" stroke={color} strokeWidth="1.5" strokeDasharray="2,1"/>

        {/* Wrecking ball */}
        <circle cx="22" cy="70" r="4" fill={color}/>
        <circle cx="22" cy="70" r="2.5" fill="#333"/>
        {/* Ball spikes */}
        <path d="M22,66 L21,64 L23,64 Z" fill={color}/>
        <path d="M18,70 L16,69 L16,71 Z" fill={color}/>
        <path d="M26,70 L28,69 L28,71 Z" fill={color}/>

        {/* === SMOKE PIPES AND VENTS === */}
        {/* Exhaust pipes */}
        <rect x="12" y="16" width="2" height="4" fill="#333" rx="0.5"/>
        <rect x="30" y="16" width="2" height="4" fill="#333" rx="0.5"/>
        {/* Smoke effect */}
        <circle cx="13" cy="15" r="1.5" fill="#666" opacity="0.4"/>
        <circle cx="31" cy="15" r="1.5" fill="#666" opacity="0.4"/>

        {/* Side vents */}
        <rect x="6" y="28" width="1" height="3" fill="#333" opacity="0.6"/>
        <rect x="6" y="38" width="1" height="3" fill="#333" opacity="0.6"/>
        <rect x="37" y="28" width="1" height="3" fill="#333" opacity="0.6"/>
        <rect x="37" y="38" width="1" height="3" fill="#333" opacity="0.6"/>
      </svg>
    );
  }

  if (id.includes('tormentor')) {
    // Tormentor - Infernal raider/APC, Mad Max war buggy rebuilt in Hell
    // Open roll-cage frame, 4 bladed wheels, raking scythes at front
    // Scale 0.83 to fit in smaller viewBox for 20% larger rendering
    return (
      <svg width={size} height={size} viewBox="0 0 30 43">
        <g transform="scale(0.833)">
        {/* Four Raking Scythes - jutting forward from bumper */}
        <path d="M8,2 L10,10 L12,10 L10,2 Z" fill={color} opacity="0.9"/>
        <path d="M14,0 L15,10 L17,10 L16,0 Z" fill={color} opacity="0.9"/>
        <path d="M19,0 L21,10 L23,10 L22,0 Z" fill={color} opacity="0.9"/>
        <path d="M26,2 L24,10 L26,10 L28,2 Z" fill={color} opacity="0.9"/>

        {/* Engine compartment - front, exposed */}
        <rect x="10" y="8" width="16" height="8" fill={color} opacity="0.6"/>
        <line x1="12" y1="9" x2="12" y2="15" stroke="#000" strokeWidth="0.5" opacity="0.5"/>
        <line x1="18" y1="9" x2="18" y2="15" stroke="#000" strokeWidth="0.5" opacity="0.5"/>
        <line x1="24" y1="9" x2="24" y2="15" stroke="#000" strokeWidth="0.5" opacity="0.5"/>

        {/* Roll cage frame - skeletal open construction */}
        <rect x="6" y="14" width="24" height="32" fill="none" stroke={color} strokeWidth="2" rx="1"/>
        {/* Cross bars of roll cage */}
        <line x1="6" y1="24" x2="30" y2="24" stroke={color} strokeWidth="1.5"/>
        <line x1="6" y1="34" x2="30" y2="34" stroke={color} strokeWidth="1.5"/>
        {/* Center spine */}
        <line x1="18" y1="14" x2="18" y2="46" stroke={color} strokeWidth="1"/>

        {/* Floor/chassis visible through cage */}
        <rect x="8" y="16" width="20" height="28" fill={color} opacity="0.3"/>

        {/* Four bladed wheels with cutting edges */}
        <circle cx="4" cy="18" r="4" fill={color} opacity="0.9"/>
        <path d="M4,14 L5,16 L4,18 L3,16 Z M0,18 L2,17 L4,18 L2,19 Z M4,22 L3,20 L4,18 L5,20 Z M8,18 L6,19 L4,18 L6,17 Z" fill={color}/>
        <circle cx="32" cy="18" r="4" fill={color} opacity="0.9"/>
        <path d="M32,14 L33,16 L32,18 L31,16 Z M28,18 L30,17 L32,18 L30,19 Z M32,22 L31,20 L32,18 L33,20 Z M36,18 L34,19 L32,18 L34,17 Z" fill={color}/>
        <circle cx="4" cy="42" r="4" fill={color} opacity="0.9"/>
        <path d="M4,38 L5,40 L4,42 L3,40 Z M0,42 L2,41 L4,42 L2,43 Z M4,46 L3,44 L4,42 L5,44 Z M8,42 L6,43 L4,42 L6,41 Z" fill={color}/>
        <circle cx="32" cy="42" r="4" fill={color} opacity="0.9"/>
        <path d="M32,38 L33,40 L32,42 L31,40 Z M28,42 L30,41 L32,42 L30,43 Z M32,46 L31,44 L32,42 L33,44 Z M36,42 L34,43 L32,42 L34,41 Z" fill={color}/>

        {/* Spikes on roll cage */}
        <path d="M6,14 L4,11 L8,14 Z" fill={color}/>
        <path d="M30,14 L32,11 L28,14 Z" fill={color}/>
        <path d="M6,46 L4,49 L8,46 Z" fill={color}/>
        <path d="M30,46 L32,49 L28,46 Z" fill={color}/>

        {/* Chains hanging from attachment points */}
        <path d="M6,28 Q3,30 4,32 Q5,34 3,36" fill="none" stroke={color} strokeWidth="0.8" opacity="0.6"/>
        <path d="M30,28 Q33,30 32,32 Q31,34 33,36" fill="none" stroke={color} strokeWidth="0.8" opacity="0.6"/>

        {/* Helm station - Driver, front behind engine */}
        <circle cx="18" cy="19" r="3" fill="#000" stroke={color} strokeWidth="1.5"/>

        {/* Harpoon Flinger weapon station - middle */}
        <circle cx="18" cy="29" r="3" fill="#ff6b35" stroke={color} strokeWidth="1.5"/>
        <rect x="16" y="26" width="4" height="6" fill="#ff6b35" opacity="0.5"/>

        {/* Passenger seats - rear port and starboard */}
        <circle cx="11" cy="40" r="2.5" fill="#666" stroke={color} strokeWidth="1"/>
        <circle cx="25" cy="40" r="2.5" fill="#666" stroke={color} strokeWidth="1"/>
        </g>
      </svg>
    );
  }

  if (id.includes('scavenger')) {
    // Scavenger - Salvage/support vehicle with large crane, bus-like armored body
    // Two front wheels, two rear treaded tracks, crane with grappling claw
    return (
      <svg width={size} height={size} viewBox="0 0 40 64">
        {/* === FRONT SECTION - CAB === */}
        {/* Armored cab - boxy bus-like front */}
        <rect x="8" y="4" width="24" height="16" fill={color} opacity="0.9" rx="2"/>
        {/* Windshield/viewport slits */}
        <rect x="12" y="6" width="16" height="3" fill="#1a1a1a" opacity="0.6" rx="1"/>
        {/* Armored front plate */}
        <rect x="10" y="2" width="20" height="4" fill={color} rx="1"/>

        {/* Front wheels - two large wheels */}
        <ellipse cx="6" cy="14" rx="5" ry="7" fill={color} opacity="0.9"/>
        <ellipse cx="34" cy="14" rx="5" ry="7" fill={color} opacity="0.9"/>
        {/* Wheel hub details */}
        <circle cx="6" cy="14" r="2" fill="#333" stroke={color} strokeWidth="0.5"/>
        <circle cx="34" cy="14" r="2" fill="#333" stroke={color} strokeWidth="0.5"/>
        {/* Wheel treads */}
        <path d="M4,9 L2,10 L4,11 Z M4,16 L2,17 L4,18 Z" fill={color}/>
        <path d="M36,9 L38,10 L36,11 Z M36,16 L38,17 L36,18 Z" fill={color}/>

        {/* Helm station */}
        <circle cx="20" cy="12" r="3.5" fill="#000" stroke={color} strokeWidth="1.5"/>

        {/* === MAIN BODY - ARMORED BUS/CARGO === */}
        {/* Main enclosed body - utilitarian boxy design */}
        <rect x="6" y="20" width="28" height="28" fill={color} opacity="0.85" rx="2"/>

        {/* Industrial plating lines */}
        <line x1="6" y1="28" x2="34" y2="28" stroke="#333" strokeWidth="0.8" opacity="0.4"/>
        <line x1="6" y1="36" x2="34" y2="36" stroke="#333" strokeWidth="0.8" opacity="0.4"/>

        {/* Rivets - industrial look */}
        <circle cx="10" cy="24" r="0.8" fill="#333" opacity="0.5"/>
        <circle cx="30" cy="24" r="0.8" fill="#333" opacity="0.5"/>
        <circle cx="10" cy="32" r="0.8" fill="#333" opacity="0.5"/>
        <circle cx="30" cy="32" r="0.8" fill="#333" opacity="0.5"/>
        <circle cx="10" cy="40" r="0.8" fill="#333" opacity="0.5"/>
        <circle cx="30" cy="40" r="0.8" fill="#333" opacity="0.5"/>

        {/* Side access panels */}
        <rect x="6" y="30" width="3" height="6" fill="#333" opacity="0.3" rx="0.5"/>
        <rect x="31" y="30" width="3" height="6" fill="#333" opacity="0.3" rx="0.5"/>

        {/* === HARPOON FLINGERS - DEFENSE === */}
        {/* Left harpoon mount */}
        <rect x="2" y="22" width="5" height="8" fill={color} opacity="0.9" rx="1"/>
        <circle cx="4" cy="26" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1"/>
        {/* Right harpoon mount */}
        <rect x="33" y="22" width="5" height="8" fill={color} opacity="0.9" rx="1"/>
        <circle cx="36" cy="26" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1"/>

        {/* === REAR TRACKS === */}
        {/* Left track assembly */}
        <rect x="2" y="40" width="8" height="14" fill={color} opacity="0.9" rx="1"/>
        {/* Track treads */}
        <line x1="3" y1="42" x2="9" y2="42" stroke="#333" strokeWidth="1" opacity="0.5"/>
        <line x1="3" y1="45" x2="9" y2="45" stroke="#333" strokeWidth="1" opacity="0.5"/>
        <line x1="3" y1="48" x2="9" y2="48" stroke="#333" strokeWidth="1" opacity="0.5"/>
        <line x1="3" y1="51" x2="9" y2="51" stroke="#333" strokeWidth="1" opacity="0.5"/>
        {/* Track wheels */}
        <circle cx="5" cy="42" r="1.5" fill="#333"/>
        <circle cx="5" cy="52" r="1.5" fill="#333"/>

        {/* Right track assembly */}
        <rect x="30" y="40" width="8" height="14" fill={color} opacity="0.9" rx="1"/>
        {/* Track treads */}
        <line x1="31" y1="42" x2="37" y2="42" stroke="#333" strokeWidth="1" opacity="0.5"/>
        <line x1="31" y1="45" x2="37" y2="45" stroke="#333" strokeWidth="1" opacity="0.5"/>
        <line x1="31" y1="48" x2="37" y2="48" stroke="#333" strokeWidth="1" opacity="0.5"/>
        <line x1="31" y1="51" x2="37" y2="51" stroke="#333" strokeWidth="1" opacity="0.5"/>
        {/* Track wheels */}
        <circle cx="35" cy="42" r="1.5" fill="#333"/>
        <circle cx="35" cy="52" r="1.5" fill="#333"/>

        {/* === CRANE ASSEMBLY - DOMINANT FEATURE === */}
        {/* Crane base/turret */}
        <rect x="14" y="42" width="12" height="8" fill={color} rx="1"/>
        <circle cx="20" cy="46" r="4" fill="#333" stroke={color} strokeWidth="1.5"/>

        {/* Winch mechanism */}
        <circle cx="20" cy="46" r="2" fill={color}/>
        <circle cx="20" cy="46" r="1" fill="#666"/>

        {/* Crane arm - extends back */}
        <rect x="17" y="48" width="6" height="12" fill={color} opacity="0.85" rx="1"/>
        {/* Crane arm joint */}
        <circle cx="20" cy="50" r="1.5" fill="#333"/>

        {/* Chain extending from crane */}
        <line x1="20" y1="56" x2="20" y2="62" stroke={color} strokeWidth="1.5" strokeDasharray="2,1"/>

        {/* Grappling claw */}
        <path d="M16,60 L18,62 L20,60 L22,62 L24,60" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        {/* Claw prongs */}
        <path d="M16,60 L14,64 M18,62 L17,64 M22,62 L23,64 M24,60 L26,64" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>

        {/* === CREW POSITIONS === */}
        {/* Additional crew/passenger seats */}
        <circle cx="14" cy="26" r="2" fill="#666" stroke={color} strokeWidth="0.8" opacity="0.7"/>
        <circle cx="26" cy="26" r="2" fill="#666" stroke={color} strokeWidth="0.8" opacity="0.7"/>
        <circle cx="14" cy="36" r="2" fill="#666" stroke={color} strokeWidth="0.8" opacity="0.7"/>
        <circle cx="26" cy="36" r="2" fill="#666" stroke={color} strokeWidth="0.8" opacity="0.7"/>

        {/* Crane operator station */}
        <circle cx="20" cy="44" r="2" fill="#ff6b35" stroke={color} strokeWidth="1"/>

        {/* === INDUSTRIAL DETAILS === */}
        {/* Exhaust stack */}
        <rect x="8" y="18" width="2" height="4" fill="#333" rx="0.5"/>
        <circle cx="9" cy="17" r="1.2" fill="#666" opacity="0.4"/>

        {/* Tool/equipment storage boxes */}
        <rect x="8" y="42" width="4" height="3" fill="#333" opacity="0.4" rx="0.5"/>
        <rect x="28" y="42" width="4" height="3" fill="#333" opacity="0.4" rx="0.5"/>
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
