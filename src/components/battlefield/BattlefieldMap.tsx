/**
 * Battlefield Map Component
 * Drag-and-drop positioning for vehicles with distance calculation
 *
 * COORDINATE SYSTEM:
 * - Vehicle positions are stored in WORLD coordinates (feet)
 * - Screen coordinates are calculated from world coords based on scale + zoom
 * - Map center is the origin (0,0) in world space
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  useDraggable,
  DragOverlay,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useCombat } from '../../context/CombatContext';
import { Vehicle, Position, ScaleName, Creature, CrewAssignment } from '../../types';
import { SCALES, formatDistance, getScaleForDistance, calculateMovementPerRound } from '../../data/scaleConfig';
import { useBroadcastSource } from '../../hooks/useBroadcastChannel';

interface BattlefieldMapProps {
  height?: number;
}

export function BattlefieldMap({ height = 600 }: BattlefieldMapProps) {
  const { state, updateVehiclePosition, updateVehicleFacing, setScale, setBackgroundImage, dispatch, currentTurnVehicle, currentTurnCreature } = useCombat();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showBackgroundControls, setShowBackgroundControls] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerViewRef = useRef<Window | null>(null);
  const { broadcast } = useBroadcastSource();
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Measure container width and re-measure when phase changes (panel appears/disappears)
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.offsetWidth;
        if (newWidth !== containerWidth && newWidth > 0) {
          setContainerWidth(newWidth);
        }
      }
    };

    // Initial measurement
    updateWidth();

    // Re-measure after a short delay to catch layout changes
    const timeoutId = setTimeout(updateWidth, 100);

    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      clearTimeout(timeoutId);
    };
  }, [state.phase]); // Re-run when phase changes

  const width = containerWidth;

  // Track movement used per vehicle this round: { vehicleId: feetMoved }
  const [movementUsed, setMovementUsed] = useState<Record<string, number>>({});
  const [lastRound, setLastRound] = useState(state.round);

  // Movement history for undo functionality
  interface MoveHistoryEntry {
    type: 'vehicle' | 'creature';
    id: string;
    previousPosition: Position;
    feetMoved: number;
  }
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);

  // Reset movement tracking and history when round changes
  useEffect(() => {
    if (state.round !== lastRound) {
      setMovementUsed({});
      setMoveHistory([]);
      setLastRound(state.round);
    }
  }, [state.round, lastRound]);

  // Undo last movement
  const handleUndoMove = () => {
    if (moveHistory.length === 0) return;

    const lastMove = moveHistory[moveHistory.length - 1];

    if (lastMove.type === 'vehicle') {
      // Restore vehicle position
      updateVehiclePosition(lastMove.id, lastMove.previousPosition);

      // Restore movement used
      setMovementUsed((prev) => ({
        ...prev,
        [lastMove.id]: Math.max(0, (prev[lastMove.id] || 0) - lastMove.feetMoved),
      }));

      // Log the undo
      const vehicle = state.vehicles.find((v) => v.id === lastMove.id);
      dispatch({
        type: 'LOG_ACTION',
        payload: {
          type: 'movement',
          action: `Undid ${vehicle?.name || 'vehicle'} movement`,
        },
      });
    } else {
      // Restore creature position
      dispatch({
        type: 'UPDATE_CREATURE',
        payload: { id: lastMove.id, updates: { position: lastMove.previousPosition } },
      });

      // Restore movement used
      setMovementUsed((prev) => ({
        ...prev,
        [`creature-${lastMove.id}`]: Math.max(0, (prev[`creature-${lastMove.id}`] || 0) - lastMove.feetMoved),
      }));

      // Log the undo
      const creature = state.creatures.find((c) => c.id === lastMove.id);
      dispatch({
        type: 'LOG_ACTION',
        payload: {
          type: 'movement',
          action: `Undid ${creature?.name || 'creature'} movement`,
        },
      });
    }

    // Remove from history
    setMoveHistory((prev) => prev.slice(0, -1));
  };

  const currentScale = SCALES[state.scale];

  // Track vehicle IDs to detect when encounter is loaded
  const vehicleIdsRef = useRef<string>('');

  // Track turn index to detect turn changes
  const lastTurnIndexRef = useRef<number>(state.currentTurnIndex);

  // Track phase to detect combat start
  const lastPhaseRef = useRef<string>(state.phase);

  // Track scale to detect scale changes
  const lastScaleRef = useRef<ScaleName>(state.scale);

  // Auto-fit ONLY when new encounter is loaded (vehicle IDs change)
  // This prevents view from breaking when vehicles are moved
  useEffect(() => {
    const currentIds = state.vehicles.map(v => v.id).sort().join(',');
    const previousIds = vehicleIdsRef.current;

    // Only auto-fit when vehicle IDs actually change (new encounter loaded)
    if (currentIds !== previousIds) {
      vehicleIdsRef.current = currentIds;

      // Skip auto-fit if no vehicles or same vehicles just moved
      if (state.vehicles.length < 1) return;

      // Calculate max distance between party and enemy vehicles
      let maxDistance = 0;
      const partyVehicles = state.vehicles.filter(v => v.type === 'party');
      const enemyVehicles = state.vehicles.filter(v => v.type === 'enemy');
      for (const pv of partyVehicles) {
        for (const ev of enemyVehicles) {
          const dist = Math.sqrt(
            Math.pow(ev.position.x - pv.position.x, 2) +
            Math.pow(ev.position.y - pv.position.y, 2)
          );
          maxDistance = Math.max(maxDistance, dist);
        }
      }

      // Auto-set scale based on actual distance
      if (maxDistance > 0) {
        const appropriateScale = getScaleForDistance(maxDistance);
        if (appropriateScale !== state.scale) {
          setScale(appropriateScale);
        }
      }

      // Auto-fit to show all vehicles
      handleFitAll();
    }
  }, [state.vehicles.map(v => v.id).join(',')]); // Only depend on vehicle IDs, not positions

  // Track turn changes (just update ref, no auto-fit)
  useEffect(() => {
    lastTurnIndexRef.current = state.currentTurnIndex;
  }, [state.currentTurnIndex]);

  // Auto-fit only when phase changes to combat (panel layout changes)
  useEffect(() => {
    if (state.phase === lastPhaseRef.current) return;
    const prevPhase = lastPhaseRef.current;
    lastPhaseRef.current = state.phase;

    // Only auto-fit when entering combat (layout changes due to panel)
    if (state.phase === 'combat' && prevPhase === 'setup') {
      // Delay to allow container to resize after panel appears
      const timeoutId = setTimeout(() => {
        handleFitAll();
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [state.phase]);

  // Track the target pixels per foot (this stays constant across scale changes)
  const [targetPixelsPerFoot, setTargetPixelsPerFoot] = useState(() => currentScale.mapScale * zoom);

  // When scale changes, we keep targetPixelsPerFoot constant and derive zoom
  // This happens synchronously during render, preventing any visual jump
  const effectiveZoom = useMemo(() => {
    const calculatedZoom = targetPixelsPerFoot / currentScale.mapScale;
    return Math.max(0.1, Math.min(10, calculatedZoom));
  }, [targetPixelsPerFoot, currentScale.mapScale]);

  // Update lastScaleRef for other uses
  useEffect(() => {
    lastScaleRef.current = state.scale;
  }, [state.scale]);

  // When user explicitly zooms, update targetPixelsPerFoot
  const setZoomLevel = useCallback((newZoom: number) => {
    const clampedZoom = Math.max(0.1, Math.min(10, newZoom));
    setTargetPixelsPerFoot(currentScale.mapScale * clampedZoom);
    setZoom(clampedZoom);
  }, [currentScale.mapScale]);

  // Keep zoom state in sync with effectiveZoom (for other code that reads zoom)
  useEffect(() => {
    if (zoom !== effectiveZoom) {
      setZoom(effectiveZoom);
    }
  }, [effectiveZoom, zoom]);

  // Pixels per foot at current scale and zoom
  // Use effectiveZoom for consistent view across scale changes
  const pixelsPerFoot = currentScale.mapScale * effectiveZoom;

  // Map center in screen coordinates
  const mapCenter = useMemo(() => ({
    x: width / 2 + panOffset.x,
    y: height / 2 + panOffset.y,
  }), [width, height, panOffset]);

  // Convert world position (feet) to screen position (pixels)
  const worldToScreen = (worldPos: Position): Position => ({
    x: mapCenter.x + worldPos.x * pixelsPerFoot,
    y: mapCenter.y + worldPos.y * pixelsPerFoot,
  });

  // Convert screen delta (pixels) to world delta (feet)
  const screenDeltaToWorld = (delta: { x: number; y: number }): { x: number; y: number } => ({
    x: delta.x / pixelsPerFoot,
    y: delta.y / pixelsPerFoot,
  });

  // Calculate effective speed accounting for mishap effects
  const getEffectiveSpeed = (vehicle: Vehicle): number => {
    let speed = vehicle.currentSpeed;

    // Apply speed reductions from active mishaps
    for (const mishap of vehicle.activeMishaps) {
      if (mishap.mechanicalEffect?.speedReduction) {
        speed -= mishap.mechanicalEffect.speedReduction;
      }
    }

    return Math.max(0, speed);
  };

  // Get the minimum engagement distance between any party and enemy vehicle
  // This determines movement scale for ALL vehicles (once engaged, everyone is committed)
  // Also considers creatures on the battlefield (ejected crew, etc.)
  const getMinEngagementDistance = useCallback((): number => {
    // Filter out destroyed/inoperative vehicles
    const partyVehicles = state.vehicles.filter(v => v.type === 'party' && !v.isInoperative && v.currentHp > 0);
    const enemyVehicles = state.vehicles.filter(v => v.type === 'enemy' && !v.isInoperative && v.currentHp > 0);

    // Get creatures on the battlefield (not assigned to vehicles)
    const assignedCreatureIds = new Set(state.crewAssignments.map(a => a.creatureId));
    const partyCreatures = state.creatures.filter(c =>
      c.statblock.type === 'pc' && c.position && !assignedCreatureIds.has(c.id) && c.currentHp > 0
    );
    const enemyCreatures = state.creatures.filter(c =>
      c.statblock.type !== 'pc' && c.position && !assignedCreatureIds.has(c.id) && c.currentHp > 0
    );

    let minDistance = Infinity;

    // Vehicle to vehicle distances
    for (const pv of partyVehicles) {
      for (const ev of enemyVehicles) {
        const dist = Math.sqrt(
          Math.pow(ev.position.x - pv.position.x, 2) +
          Math.pow(ev.position.y - pv.position.y, 2)
        );
        minDistance = Math.min(minDistance, dist);
      }
    }

    // Party vehicle to enemy creature distances
    for (const pv of partyVehicles) {
      for (const ec of enemyCreatures) {
        const dist = Math.sqrt(
          Math.pow(ec.position!.x - pv.position.x, 2) +
          Math.pow(ec.position!.y - pv.position.y, 2)
        );
        minDistance = Math.min(minDistance, dist);
      }
    }

    // Enemy vehicle to party creature distances
    for (const ev of enemyVehicles) {
      for (const pc of partyCreatures) {
        const dist = Math.sqrt(
          Math.pow(pc.position!.x - ev.position.x, 2) +
          Math.pow(pc.position!.y - ev.position.y, 2)
        );
        minDistance = Math.min(minDistance, dist);
      }
    }

    // Party creature to enemy creature distances
    for (const pc of partyCreatures) {
      for (const ec of enemyCreatures) {
        const dist = Math.sqrt(
          Math.pow(ec.position!.x - pc.position!.x, 2) +
          Math.pow(ec.position!.y - pc.position!.y, 2)
        );
        minDistance = Math.min(minDistance, dist);
      }
    }

    return minDistance;
  }, [state.vehicles, state.creatures, state.crewAssignments]);

  // Get the scale to use for movement calculations
  // Uses the MINIMUM engagement distance so all vehicles use the same movement rules
  const movementScale = useMemo((): ScaleName => {
    const minDist = getMinEngagementDistance();
    return getScaleForDistance(minDist);
  }, [getMinEngagementDistance]);

  // Get max movement for a vehicle this round
  // Uses movementScale (based on closest engagement) not visual state.scale
  const getMaxMovement = (vehicle: Vehicle): number => {
    return calculateMovementPerRound(getEffectiveSpeed(vehicle), movementScale);
  };

  // Get remaining movement for a vehicle
  const getRemainingMovement = (vehicle: Vehicle): number => {
    const maxMove = getMaxMovement(vehicle);
    const used = movementUsed[vehicle.id] || 0;
    return Math.max(0, maxMove - used);
  };

  // Get max movement for a creature this round (uses walk speed)
  // Uses movementScale (based on closest engagement) for consistency with vehicles
  const getCreatureMaxMovement = (creature: Creature): number => {
    const walkSpeed = creature.statblock.speed.walk || 30;
    return calculateMovementPerRound(walkSpeed, movementScale);
  };

  // Get remaining movement for a creature
  const getCreatureRemainingMovement = (creature: Creature): number => {
    const maxMove = getCreatureMaxMovement(creature);
    const used = movementUsed[`creature-${creature.id}`] || 0;
    return Math.max(0, maxMove - used);
  };

  // Get the active vehicle for drag overlay
  const activeVehicle = activeId
    ? state.vehicles.find((v) => v.id === activeId)
    : null;

  // Calculate distance between two vehicles (world coords are already in feet)
  const calculateDistance = (pos1: Position, pos2: Position): number => {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get distances between all vehicle pairs
  const getDistances = () => {
    const distances: { from: string; to: string; distance: number }[] = [];
    const partyVehicles = state.vehicles.filter((v) => v.type === 'party');
    const enemyVehicles = state.vehicles.filter((v) => v.type === 'enemy');

    partyVehicles.forEach((pv) => {
      enemyVehicles.forEach((ev) => {
        distances.push({
          from: pv.id,
          to: ev.id,
          distance: calculateDistance(pv.position, ev.position),
        });
      });
    });

    return distances;
  };

  const distances = getDistances();
  // Get minimum distance for scale determination (closest engagement drives the scale)
  const minEngagementDist = getMinEngagementDistance();

  // Auto-update scale based on MINIMUM distance between any party and enemy
  // Only auto-scale DOWN (to closer range) - never auto-scale UP during combat
  // The DM should manually change to farther scales if needed
  const scaleOrder: ScaleName[] = ['point_blank', 'tactical', 'approach', 'strategic'];

  useEffect(() => {
    if (minEngagementDist > 0 && minEngagementDist !== Infinity) {
      const suggestedScale = getScaleForDistance(minEngagementDist);
      const currentScaleIndex = scaleOrder.indexOf(state.scale);
      const suggestedScaleIndex = scaleOrder.indexOf(suggestedScale);

      // Only auto-scale if the suggested scale is CLOSER (lower index) than current
      // This prevents jarring scale-ups when combat spreads out
      if (suggestedScaleIndex < currentScaleIndex) {
        setScale(suggestedScale);
      }
    }
  }, [minEngagementDist, state.scale, setScale]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveId(null);

    if (!active) return;

    const activeIdStr = String(active.id);

    // Check if this is a creature drag
    if (activeIdStr.startsWith('creature-')) {
      const creatureId = activeIdStr.replace('creature-', '');
      const creature = state.creatures.find((c) => c.id === creatureId);
      if (!creature || !creature.position) return;

      // Convert screen delta to world delta (feet)
      const worldDelta = screenDeltaToWorld(delta);
      const feetMoved = Math.sqrt(worldDelta.x * worldDelta.x + worldDelta.y * worldDelta.y);

      // During setup phase, allow free movement (constrained to image bounds)
      if (state.phase === 'setup') {
        const newPosition = constrainToImageBounds({
          x: creature.position.x + worldDelta.x,
          y: creature.position.y + worldDelta.y,
        });
        dispatch({
          type: 'UPDATE_CREATURE',
          payload: { id: creatureId, updates: { position: newPosition } },
        });
        // Note: Don't auto-fit during setup - it interferes with dragging
        return;
      }

      // During combat, enforce movement limits
      const remainingMovement = getCreatureRemainingMovement(creature);

      let constrainedWorldDelta = worldDelta;
      let actualFeetMoved = feetMoved;

      if (feetMoved > remainingMovement && remainingMovement > 0) {
        // Scale down the delta to match remaining movement
        const ratio = remainingMovement / feetMoved;
        constrainedWorldDelta = {
          x: worldDelta.x * ratio,
          y: worldDelta.y * ratio,
        };
        actualFeetMoved = remainingMovement;
      } else if (remainingMovement <= 0) {
        // No movement remaining
        dispatch({
          type: 'LOG_ACTION',
          payload: {
            type: 'movement',
            action: `${creature.name} has no movement remaining this round`,
          },
        });
        return;
      }

      const newPosition = constrainToImageBounds({
        x: creature.position.x + constrainedWorldDelta.x,
        y: creature.position.y + constrainedWorldDelta.y,
      });

      const newRemainingMovement = remainingMovement - actualFeetMoved;

      // Record move for undo
      setMoveHistory((prev) => [
        ...prev,
        {
          type: 'creature',
          id: creature.id,
          previousPosition: { x: creature.position?.x ?? 0, y: creature.position?.y ?? 0 },
          feetMoved: actualFeetMoved,
        },
      ]);

      // Track movement used
      setMovementUsed((prev) => ({
        ...prev,
        [`creature-${creature.id}`]: (prev[`creature-${creature.id}`] || 0) + actualFeetMoved,
      }));

      // Log the movement
      dispatch({
        type: 'LOG_ACTION',
        payload: {
          type: 'movement',
          action: `${creature.name} moved ${formatDistance(actualFeetMoved)}`,
          details: `${formatDistance(newRemainingMovement)} remaining`,
        },
      });

      dispatch({
        type: 'UPDATE_CREATURE',
        payload: { id: creatureId, updates: { position: newPosition } },
      });
      // Note: Don't auto-fit during combat - it's disorienting when the view keeps re-centering
      return;
    }

    // Otherwise it's a vehicle drag
    const vehicle = state.vehicles.find((v) => v.id === active.id);
    if (!vehicle) return;

    // Convert screen delta to world delta (feet)
    let worldDelta = screenDeltaToWorld(delta);

    // Check for Locked Steering mishap - if active, constrain to straight line movement
    const hasLockedSteering = vehicle.activeMishaps.some(
      (m) => m.name === 'Locked Steering'
    );

    if (hasLockedSteering) {
      // Project movement onto the vehicle's facing direction
      // Facing is in degrees: 0 = north (up/-Y), 90 = east (+X), 180 = south (+Y), 270 = west (-X)
      const facingRad = (vehicle.facing - 90) * (Math.PI / 180); // Convert to standard math angle
      const facingX = Math.cos(facingRad);
      const facingY = Math.sin(facingRad);

      // Dot product to get projection length (can be negative for reverse movement)
      const projectionLength = worldDelta.x * facingX + worldDelta.y * facingY;

      // Constrain delta to only the facing direction
      worldDelta = {
        x: projectionLength * facingX,
        y: projectionLength * facingY,
      };
    }

    const feetMoved = Math.sqrt(worldDelta.x * worldDelta.x + worldDelta.y * worldDelta.y);

    // During setup phase, allow free movement (constrained to image bounds)
    if (state.phase === 'setup') {
      const newPosition = constrainToImageBounds({
        x: vehicle.position.x + worldDelta.x,
        y: vehicle.position.y + worldDelta.y,
      });
      updateVehiclePosition(vehicle.id, newPosition);
      // Note: Don't auto-fit during setup - it interferes with dragging
      return;
    }

    // During combat, enforce movement limits
    // Get remaining movement
    const remainingMovement = getRemainingMovement(vehicle);

    // If trying to move more than allowed, constrain the movement
    let constrainedWorldDelta = worldDelta;
    let actualFeetMoved = feetMoved;

    if (feetMoved > remainingMovement && remainingMovement > 0) {
      // Scale down the delta to match remaining movement
      const ratio = remainingMovement / feetMoved;
      constrainedWorldDelta = {
        x: worldDelta.x * ratio,
        y: worldDelta.y * ratio,
      };
      actualFeetMoved = remainingMovement;
    } else if (remainingMovement <= 0) {
      // No movement remaining - don't move at all
      dispatch({
        type: 'LOG_ACTION',
        payload: {
          type: 'movement',
          action: `${vehicle.name} has no movement remaining this round`,
        },
      });
      return;
    }

    // Apply the constrained movement (in world coordinates/feet), also constrained to image bounds
    const newPosition = constrainToImageBounds({
      x: vehicle.position.x + constrainedWorldDelta.x,
      y: vehicle.position.y + constrainedWorldDelta.y,
    });

    // Calculate the new remaining movement for the log
    const newRemainingMovement = remainingMovement - actualFeetMoved;

    // Record move for undo
    setMoveHistory((prev) => [
      ...prev,
      {
        type: 'vehicle',
        id: vehicle.id,
        previousPosition: { ...vehicle.position },
        feetMoved: actualFeetMoved,
      },
    ]);

    // Track movement used
    setMovementUsed((prev) => ({
      ...prev,
      [vehicle.id]: (prev[vehicle.id] || 0) + actualFeetMoved,
    }));

    // Log the movement
    dispatch({
      type: 'LOG_ACTION',
      payload: {
        type: 'movement',
        action: `${vehicle.name} moved ${formatDistance(actualFeetMoved)}`,
        details: `${formatDistance(newRemainingMovement)} remaining`,
      },
    });

    updateVehiclePosition(vehicle.id, newPosition);
    // Note: Don't auto-fit during combat - it's disorienting when the view keeps re-centering
  };

  const handleDragStart = (event: DragMoveEvent) => {
    setActiveId(String(event.active.id));
  };

  // Calculate vehicle center point for zoom centering
  const getVehicleCenter = (): Position => {
    if (state.vehicles.length === 0) return { x: 0, y: 0 };
    const xs = state.vehicles.map(v => v.position.x);
    const ys = state.vehicles.map(v => v.position.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  };

  // Calculate minimum zoom that keeps the background filling the viewport
  const getMinZoom = useCallback(() => {
    const bg = state.battlefield.backgroundImage;
    if (!bg || !bg.naturalWidth || !bg.naturalHeight) {
      return 0.1; // Default minimum if no background
    }

    const feetPerPixel = bg.feetPerPixel || 1;
    const bgScale = bg.scale || 1;
    const bgWidthFeet = bg.naturalWidth * feetPerPixel * bgScale;
    const bgHeightFeet = bg.naturalHeight * feetPerPixel * bgScale;

    // Calculate zoom needed to fit background in viewport
    const zoomToFitWidth = width / (bgWidthFeet * currentScale.mapScale);
    const zoomToFitHeight = height / (bgHeightFeet * currentScale.mapScale);

    // Minimum zoom is whichever dimension would fit first
    return Math.max(zoomToFitWidth, zoomToFitHeight, 0.1);
  }, [state.battlefield.backgroundImage, currentScale.mapScale, width, height]);

  // Zoom controls - center on vehicles
  const handleZoomIn = () => {
    const newZoom = Math.min(effectiveZoom * 1.5, 10);
    const center = getVehicleCenter();
    // Adjust pan to keep vehicle center in same screen position
    const newOffset = {
      x: -center.x * currentScale.mapScale * newZoom,
      y: -center.y * currentScale.mapScale * newZoom,
    };
    setPanOffset(constrainPanOffset(newOffset, newZoom));
    setZoomLevel(newZoom);
  };

  const handleZoomOut = () => {
    const minZoom = getMinZoom();
    const newZoom = Math.max(effectiveZoom / 1.5, minZoom);
    const center = getVehicleCenter();
    // Adjust pan to keep vehicle center in same screen position
    const newOffset = {
      x: -center.x * currentScale.mapScale * newZoom,
      y: -center.y * currentScale.mapScale * newZoom,
    };
    setPanOffset(constrainPanOffset(newOffset, newZoom));
    setZoomLevel(newZoom);
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Pan handlers for click-and-drag on map background
  const handleMapMouseDown = (e: React.MouseEvent) => {
    // Only start panning on direct map clicks (not on tokens)
    if (e.target === mapRef.current || (e.target as HTMLElement).closest('.battlefield-map') === mapRef.current) {
      // Check if clicking on a token or control - if so, don't pan
      const target = e.target as HTMLElement;
      if (target.closest('.vehicle-token') || target.closest('.creature-token') || target.closest('.rotate-btn') || target.closest('[data-draggable]')) {
        return;
      }
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      e.preventDefault();
    }
  };

  // Constrain pan offset to keep view within background image bounds
  const constrainPanOffset = useCallback((offset: { x: number; y: number }, currentZoom: number): { x: number; y: number } => {
    const bg = state.battlefield.backgroundImage;
    if (!bg || !bg.naturalWidth || !bg.naturalHeight) {
      return offset; // No background, no constraints
    }

    const currentPixelsPerFoot = currentScale.mapScale * currentZoom;
    const feetPerPixel = bg.feetPerPixel || 1;
    const bgScale = bg.scale || 1;

    // Calculate background bounds in world coordinates (feet)
    const bgWidthFeet = bg.naturalWidth * feetPerPixel * bgScale;
    const bgHeightFeet = bg.naturalHeight * feetPerPixel * bgScale;
    const bgMinX = bg.position.x - bgWidthFeet / 2;
    const bgMaxX = bg.position.x + bgWidthFeet / 2;
    const bgMinY = bg.position.y - bgHeightFeet / 2;
    const bgMaxY = bg.position.y + bgHeightFeet / 2;

    // Calculate the visible area in world coordinates
    const visibleWidthFeet = width / currentPixelsPerFoot;
    const visibleHeightFeet = height / currentPixelsPerFoot;

    // Calculate allowed pan offset range
    // Pan offset = -(worldCenter * pixelsPerFoot) to center on worldCenter
    // So we need to limit the world center that can be shown

    // If the visible area is larger than the BG, center on the BG
    if (visibleWidthFeet >= bgWidthFeet) {
      // Center horizontally on background
      offset = { ...offset, x: -bg.position.x * currentPixelsPerFoot };
    } else {
      // Limit horizontal panning
      const minCenterX = bgMinX + visibleWidthFeet / 2;
      const maxCenterX = bgMaxX - visibleWidthFeet / 2;
      const currentCenterX = -offset.x / currentPixelsPerFoot;
      const clampedCenterX = Math.max(minCenterX, Math.min(maxCenterX, currentCenterX));
      offset = { ...offset, x: -clampedCenterX * currentPixelsPerFoot };
    }

    if (visibleHeightFeet >= bgHeightFeet) {
      // Center vertically on background
      offset = { ...offset, y: -bg.position.y * currentPixelsPerFoot };
    } else {
      // Limit vertical panning
      const minCenterY = bgMinY + visibleHeightFeet / 2;
      const maxCenterY = bgMaxY - visibleHeightFeet / 2;
      const currentCenterY = -offset.y / currentPixelsPerFoot;
      const clampedCenterY = Math.max(minCenterY, Math.min(maxCenterY, currentCenterY));
      offset = { ...offset, y: -clampedCenterY * currentPixelsPerFoot };
    }

    return offset;
  }, [state.battlefield.backgroundImage, currentScale.mapScale, width, height]);

  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newOffset = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      };
      setPanOffset(constrainPanOffset(newOffset, zoom));
    }
  };

  const handleMapMouseUp = () => {
    setIsPanning(false);
  };

  const handleMapMouseLeave = () => {
    setIsPanning(false);
  };

  // Auto-fit zoom to show all vehicles and creatures - zooms IN to battle area
  const handleFitAll = () => {
    // Get all positions: vehicles + creatures on map
    const vehiclePositions = state.vehicles.map(v => v.position);
    const creaturePositions = state.creatures
      .filter(c => c.position && !state.crewAssignments.some(a => a.creatureId === c.id))
      .map(c => c.position!);

    const allPositions = [...vehiclePositions, ...creaturePositions];

    if (allPositions.length === 0) {
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      return;
    }

    // Find bounds of all entities in world coords (feet)
    const xs = allPositions.map(p => p.x);
    const ys = allPositions.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Calculate spread of vehicles
    const spreadX = maxX - minX;
    const spreadY = maxY - minY;

    // Add padding: at least 50ft on each side, or 20% of spread
    const paddingX = Math.max(50, spreadX * 0.2);
    const paddingY = Math.max(50, spreadY * 0.2);

    // Calculate world bounds in feet - minimum 100ft to prevent extreme zoom
    const worldWidthFeet = Math.max(spreadX + paddingX * 2, 100);
    const worldHeightFeet = Math.max(spreadY + paddingY * 2, 100);

    // Convert to screen pixels at current scale
    const worldWidthPixels = worldWidthFeet * currentScale.mapScale;
    const worldHeightPixels = worldHeightFeet * currentScale.mapScale;

    // Calculate zoom to fit vehicles in viewport
    const zoomX = width / worldWidthPixels;
    const zoomY = height / worldHeightPixels;

    // Use smaller of the two to fit both dimensions
    // Respect minimum zoom from background image bounds
    const minZoom = getMinZoom();
    const calculatedZoom = Math.min(zoomX, zoomY) * 0.85;
    const newZoom = Math.min(Math.max(calculatedZoom, minZoom, 0.5), 5);

    // Center on the midpoint of all vehicles
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const newOffset = {
      x: -centerX * currentScale.mapScale * newZoom,
      y: -centerY * currentScale.mapScale * newZoom,
    };

    setZoomLevel(newZoom);
    setPanOffset(constrainPanOffset(newOffset, newZoom));

    console.log('Fit to vehicles:', {
      spread: { x: spreadX, y: spreadY },
      worldBounds: { width: worldWidthFeet, height: worldHeightFeet },
      zoom: newZoom,
      center: { x: centerX, y: centerY },
    });
  };

  // Background image handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;

      // Load the image to get its natural dimensions and compress if needed
      const img = new Image();
      img.onload = () => {
        // Compress image to fit in localStorage (target ~2MB max for the image)
        const maxSize = 2 * 1024 * 1024; // 2MB target
        const maxDimension = 2000; // Max width/height

        let finalDataUrl = dataUrl;
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // Check if we need to compress
        if (dataUrl.length > maxSize || width > maxDimension || height > maxDimension) {
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Calculate new dimensions (maintain aspect ratio)
          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          // Try different quality levels until we're under the limit
          let quality = 0.8;
          finalDataUrl = canvas.toDataURL('image/jpeg', quality);

          while (finalDataUrl.length > maxSize && quality > 0.1) {
            quality -= 0.1;
            finalDataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          const originalSizeKB = Math.round(dataUrl.length / 1024);
          const compressedSizeKB = Math.round(finalDataUrl.length / 1024);
          console.log(`Compressed image: ${originalSizeKB}KB -> ${compressedSizeKB}KB (quality: ${quality.toFixed(1)})`);

          if (finalDataUrl.length > maxSize) {
            alert('Warning: Image is still large after compression. Save may fail. Try a smaller image.');
          }
        }

        setBackgroundImage({
          url: finalDataUrl,
          opacity: 0.5,
          scale: 1,
          position: { x: 0, y: 0 },
          naturalWidth: width,
          naturalHeight: height,
          feetPerPixel: 1, // Default: 1 pixel = 1 foot, user can adjust
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleOpacityChange = (opacity: number) => {
    if (state.battlefield.backgroundImage) {
      setBackgroundImage({
        ...state.battlefield.backgroundImage,
        opacity,
      });
    }
  };

  const handleBgScaleChange = (scale: number) => {
    if (state.battlefield.backgroundImage) {
      setBackgroundImage({
        ...state.battlefield.backgroundImage,
        scale,
      });
    }
  };

  const handleFeetPerPixelChange = (feetPerPixel: number) => {
    if (state.battlefield.backgroundImage) {
      setBackgroundImage({
        ...state.battlefield.backgroundImage,
        feetPerPixel,
      });
    }
  };

  // Calculate battlefield bounds from background image
  const getImageBoundsInFeet = () => {
    const bg = state.battlefield.backgroundImage;
    if (!bg || !bg.naturalWidth || !bg.naturalHeight || !bg.feetPerPixel) {
      return null;
    }
    // Include scale factor so bounds match visual size of image
    const bgScale = bg.scale || 1;
    const widthFeet = bg.naturalWidth * bg.feetPerPixel * bgScale;
    const heightFeet = bg.naturalHeight * bg.feetPerPixel * bgScale;
    return {
      minX: bg.position.x - widthFeet / 2,
      maxX: bg.position.x + widthFeet / 2,
      minY: bg.position.y - heightFeet / 2,
      maxY: bg.position.y + heightFeet / 2,
      widthFeet,
      heightFeet,
    };
  };

  const imageBounds = getImageBoundsInFeet();

  // Constrain a position to stay within image bounds (if image exists)
  const constrainToImageBounds = (pos: Position): Position => {
    if (!imageBounds) return pos;
    return {
      x: Math.max(imageBounds.minX, Math.min(imageBounds.maxX, pos.x)),
      y: Math.max(imageBounds.minY, Math.min(imageBounds.maxY, pos.y)),
    };
  };

  const handleClearBackground = () => {
    setBackgroundImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open player view in new window
  const handleOpenPlayerView = () => {
    const newWindow = window.open(
      '/player-view.html',
      'PlayerView',
      'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no'
    );
    if (newWindow) {
      playerViewRef.current = newWindow;
    }
  };

  // Broadcast state to player view
  useEffect(() => {
    broadcast({
      vehicles: state.vehicles,
      creatures: state.creatures,
      crewAssignments: state.crewAssignments,
      scale: state.scale,
      backgroundImage: state.battlefield.backgroundImage,
      zoom,
      panOffset,
      round: state.round,
      phase: state.phase,
      dmViewport: { width, height },
    });
  }, [
    state.vehicles,
    state.creatures,
    state.crewAssignments,
    state.scale,
    state.battlefield.backgroundImage,
    state.round,
    state.phase,
    zoom,
    panOffset,
    broadcast,
    width,
    height,
  ]);

  // Get grid size in screen pixels
  const getGridSize = (): number => {
    // Target ~50 pixels per grid square, but round to nice world values
    const targetPixels = 50;
    const worldPerGrid = targetPixels / pixelsPerFoot;

    // Round to nice values based on scale
    let gridFeet: number;
    if (worldPerGrid >= 1000) gridFeet = Math.round(worldPerGrid / 1000) * 1000;
    else if (worldPerGrid >= 100) gridFeet = Math.round(worldPerGrid / 100) * 100;
    else if (worldPerGrid >= 10) gridFeet = Math.round(worldPerGrid / 10) * 10;
    else gridFeet = Math.max(5, Math.round(worldPerGrid / 5) * 5);

    return gridFeet * pixelsPerFoot;
  };

  const gridSize = getGridSize();
  const gridFeet = gridSize / pixelsPerFoot;

  return (
    <div ref={containerRef} className="battlefield-container" style={{ width: '100%' }}>
      {/* Toolbar */}
      <div className="battlefield-toolbar">
        <div className="flex items-center gap-sm">
          <span className="text-sm font-bold">Battlefield</span>
          <span className={`badge badge-scale-${state.scale}`}>
            {currentScale.displayName}
          </span>
        </div>

        <div className="flex items-center gap-sm">
          {/* Distance Display - shows minimum engagement distance */}
          {minEngagementDist > 0 && minEngagementDist !== Infinity && (
            <div className="distance-display">
              <span className="text-xs text-muted">Closest:</span>
              <span className="font-mono font-bold">
                {formatDistance(minEngagementDist)}
              </span>
            </div>
          )}

          {/* Undo Move Button */}
          {state.phase === 'combat' && (
            <button
              className="btn btn-secondary text-xs"
              onClick={handleUndoMove}
              disabled={moveHistory.length === 0}
              title={moveHistory.length > 0 ? `Undo last move (${moveHistory.length} moves)` : 'No moves to undo'}
              style={{ opacity: moveHistory.length === 0 ? 0.5 : 1 }}
            >
              ↩ Undo
            </button>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-sm">
            <button className="btn btn-icon btn-secondary" onClick={handleZoomOut} title="Zoom out">
              −
            </button>
            <span className="text-xs font-mono" style={{ minWidth: '40px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="btn btn-icon btn-secondary" onClick={handleZoomIn} title="Zoom in">
              +
            </button>
            <button className="btn btn-secondary text-xs" onClick={handleFitAll} title="Fit all vehicles">
              Fit
            </button>
            <button className="btn btn-secondary text-xs" onClick={handleResetView}>
              Reset
            </button>
          </div>

          {/* Player View Button */}
          <button
            className="btn btn-primary text-xs"
            onClick={handleOpenPlayerView}
            title="Open player view for VTT projection"
          >
            Player View
          </button>

          {/* Background Image Controls */}
          <div className="flex items-center gap-sm" style={{ position: 'relative' }}>
            <button
              className={`btn btn-secondary text-xs ${state.battlefield.backgroundImage ? 'btn-active' : ''}`}
              onClick={() => setShowBackgroundControls(!showBackgroundControls)}
              title="Background image settings"
            >
              BG
            </button>
            {showBackgroundControls && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  zIndex: 100,
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--spacing-sm)',
                  minWidth: '200px',
                  marginTop: '4px',
                }}
              >
                <div className="text-xs font-bold mb-sm">Background Image</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  className="btn btn-secondary text-xs mb-sm"
                  style={{ width: '100%' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {state.battlefield.backgroundImage ? 'Change Image' : 'Upload Image'}
                </button>
                {state.battlefield.backgroundImage && (
                  <>
                    <div className="text-xs text-muted mb-sm">
                      Opacity: {Math.round(state.battlefield.backgroundImage.opacity * 100)}%
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={state.battlefield.backgroundImage.opacity * 100}
                      onChange={(e) => handleOpacityChange(parseInt(e.target.value) / 100)}
                      style={{ width: '100%', marginBottom: 'var(--spacing-sm)' }}
                    />
                    <div className="text-xs text-muted mb-sm">
                      Scale: {Math.round(state.battlefield.backgroundImage.scale * 100)}%
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      value={state.battlefield.backgroundImage.scale * 100}
                      onChange={(e) => handleBgScaleChange(parseInt(e.target.value) / 100)}
                      style={{ width: '100%', marginBottom: 'var(--spacing-sm)' }}
                    />
                    <div className="flex gap-sm mb-sm">
                      <button
                        className="btn btn-secondary text-xs"
                        style={{ flex: 1 }}
                        onClick={() => handleBgScaleChange(state.battlefield.backgroundImage!.scale * 0.9)}
                      >
                        −10%
                      </button>
                      <button
                        className="btn btn-secondary text-xs"
                        style={{ flex: 1 }}
                        onClick={() => handleBgScaleChange(1)}
                      >
                        100%
                      </button>
                      <button
                        className="btn btn-secondary text-xs"
                        style={{ flex: 1 }}
                        onClick={() => handleBgScaleChange(state.battlefield.backgroundImage!.scale * 1.1)}
                      >
                        +10%
                      </button>
                    </div>
                    {/* Feet per pixel - for matching grid to map scale */}
                    <div className="text-xs text-muted mb-sm" style={{ marginTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-sm)' }}>
                      Feet per pixel: {state.battlefield.backgroundImage.feetPerPixel?.toFixed(2) || 1}
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="0.5"
                      value={(state.battlefield.backgroundImage.feetPerPixel || 1) * 10}
                      onChange={(e) => handleFeetPerPixelChange(parseInt(e.target.value) / 10)}
                      style={{ width: '100%', marginBottom: 'var(--spacing-sm)' }}
                    />
                    <div className="flex gap-sm mb-sm">
                      <button
                        className="btn btn-secondary text-xs"
                        style={{ flex: 1 }}
                        onClick={() => handleFeetPerPixelChange(0.5)}
                        title="1 pixel = 0.5 feet (2 pixels per 1ft)"
                      >
                        0.5
                      </button>
                      <button
                        className="btn btn-secondary text-xs"
                        style={{ flex: 1 }}
                        onClick={() => handleFeetPerPixelChange(1)}
                        title="1 pixel = 1 foot"
                      >
                        1
                      </button>
                      <button
                        className="btn btn-secondary text-xs"
                        style={{ flex: 1 }}
                        onClick={() => handleFeetPerPixelChange(5)}
                        title="1 pixel = 5 feet (standard grid)"
                      >
                        5
                      </button>
                      <button
                        className="btn btn-secondary text-xs"
                        style={{ flex: 1 }}
                        onClick={() => handleFeetPerPixelChange(10)}
                        title="1 pixel = 10 feet"
                      >
                        10
                      </button>
                    </div>
                    {/* Show calculated map size */}
                    {imageBounds && (
                      <div className="text-xs text-muted" style={{ marginBottom: 'var(--spacing-sm)' }}>
                        Map size: {formatDistance(imageBounds.widthFeet)} × {formatDistance(imageBounds.heightFeet)}
                      </div>
                    )}
                    <button
                      className="btn btn-danger text-xs"
                      style={{ width: '100%' }}
                      onClick={handleClearBackground}
                    >
                      Remove Background
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Area */}
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          ref={mapRef}
          className="battlefield-map"
          style={{
            width,
            height,
            position: 'relative',
            overflow: 'hidden',
            cursor: isPanning ? 'grabbing' : 'grab',
          }}
          onMouseDown={handleMapMouseDown}
          onMouseMove={handleMapMouseMove}
          onMouseUp={handleMapMouseUp}
          onMouseLeave={handleMapMouseLeave}
        >
          {/* Background Image */}
          {state.battlefield.backgroundImage && (
            <img
              src={state.battlefield.backgroundImage.url}
              alt=""
              style={{
                position: 'absolute',
                left: mapCenter.x + state.battlefield.backgroundImage.position.x * pixelsPerFoot,
                top: mapCenter.y + state.battlefield.backgroundImage.position.y * pixelsPerFoot,
                // Scale image so that 1 image pixel = feetPerPixel feet, then apply zoom
                transform: `translate(-50%, -50%) scale(${(state.battlefield.backgroundImage.feetPerPixel || 1) * pixelsPerFoot * state.battlefield.backgroundImage.scale})`,
                opacity: state.battlefield.backgroundImage.opacity,
                pointerEvents: 'none',
                maxWidth: 'none',
                zIndex: 0,
              }}
            />
          )}

          {/* Grid Background */}
          <BattlefieldGrid
            width={width}
            height={height}
            gridSize={gridSize}
            scale={state.scale}
            mapCenter={mapCenter}
          />

          {/* Distance Lines */}
          <DistanceLines
            vehicles={state.vehicles}
            distances={distances}
            worldToScreen={worldToScreen}
          />

          {/* Movement Range Indicator - shows remaining movement for current turn vehicle */}
          {state.phase === 'combat' && currentTurnVehicle && (
            <MovementRangeIndicator
              vehicle={currentTurnVehicle}
              screenPosition={worldToScreen(currentTurnVehicle.position)}
              remainingMovement={getRemainingMovement(currentTurnVehicle)}
              maxMovement={getMaxMovement(currentTurnVehicle)}
              pixelsPerFoot={pixelsPerFoot}
            />
          )}

          {/* Movement Range Indicator - shows remaining movement for current turn creature */}
          {state.phase === 'combat' && currentTurnCreature && currentTurnCreature.position && (
            <CreatureMovementRangeIndicator
              creature={currentTurnCreature}
              screenPosition={worldToScreen(currentTurnCreature.position)}
              remainingMovement={getCreatureRemainingMovement(currentTurnCreature)}
              maxMovement={getCreatureMaxMovement(currentTurnCreature)}
              pixelsPerFoot={pixelsPerFoot}
            />
          )}

          {/* Vehicle Tokens */}
          {state.vehicles.map((vehicle) => {
            const screenPos = worldToScreen(vehicle.position);
            const isThisVehicleTurn = currentTurnVehicle?.id === vehicle.id;
            // In combat mode, only the current turn vehicle can be moved
            const isDisabled = state.phase === 'combat' && !isThisVehicleTurn;
            return (
              <VehicleToken
                key={vehicle.id}
                vehicle={vehicle}
                screenPosition={screenPos}
                isActive={activeId === vehicle.id}
                zoom={zoom}
                pixelsPerFoot={pixelsPerFoot}
                remainingMovement={getRemainingMovement(vehicle)}
                maxMovement={getMaxMovement(vehicle)}
                onRotate={updateVehicleFacing}
                disabled={isDisabled}
                isCurrentTurn={isThisVehicleTurn}
                crewAssignments={state.crewAssignments}
                creatures={state.creatures}
              />
            );
          })}

          {/* Creature Tokens (not on vehicles) */}
          {state.creatures
            .filter(c => {
              // Show creatures not assigned to any vehicle
              const isAssigned = state.crewAssignments.some(a => a.creatureId === c.id);
              return !isAssigned && c.position;
            })
            .map((creature) => {
              const screenPos = worldToScreen(creature.position!);
              const isThisCreatureTurn = currentTurnCreature?.id === creature.id;
              // In combat mode, only the current turn creature can be moved (or always allow in setup)
              const canDrag = state.phase !== 'combat' || isThisCreatureTurn;
              return (
                <CreatureToken
                  key={creature.id}
                  creature={creature}
                  screenPosition={screenPos}
                  pixelsPerFoot={pixelsPerFoot}
                  remainingMovement={getCreatureRemainingMovement(creature)}
                  maxMovement={getCreatureMaxMovement(creature)}
                  showMovement={state.phase === 'combat'}
                  isCurrentTurn={isThisCreatureTurn}
                  disabled={!canDrag}
                />
              );
            })}

          {/* Drag Overlay */}
          <DragOverlay>
            {activeVehicle ? (
              <VehicleTokenDisplay
                vehicle={activeVehicle}
                isDragging
                zoom={zoom}
                pixelsPerFoot={pixelsPerFoot}
              />
            ) : null}
          </DragOverlay>

          {/* Empty State */}
          {state.vehicles.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}
            >
              <p className="text-muted">No vehicles on the battlefield</p>
              <p className="text-xs text-muted mt-sm">
                Add vehicles to see them here
              </p>
            </div>
          )}
        </div>
      </DndContext>

      {/* Scale Legend */}
      <div className="battlefield-legend">
        <div className="flex items-center gap-md">
          <div className="flex items-center gap-sm">
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--color-health)',
                borderRadius: '50%',
              }}
            />
            <span className="text-xs">Party</span>
          </div>
          <div className="flex items-center gap-sm">
            <div
              style={{
                width: 12,
                height: 12,
                background: 'var(--color-fire)',
                borderRadius: '50%',
              }}
            />
            <span className="text-xs">Enemy</span>
          </div>
          <span className="text-xs text-muted">|</span>
          <span className="text-xs text-muted">
            Grid: {formatDistance(gridFeet)} per square
          </span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Weapon Range Arcs Component
// ==========================================

interface WeaponRangeArcsProps {
  weaponRanges: Record<'front' | 'rear' | 'left' | 'right', number>;
  pixelsPerFoot: number;
  tokenSize: number;
  vehicleType: 'party' | 'enemy';
  facing: number;
}

function WeaponRangeArcs({ weaponRanges, pixelsPerFoot, tokenSize, vehicleType, facing }: WeaponRangeArcsProps) {
  const baseColor = vehicleType === 'party' ? '34, 197, 94' : '255, 69, 0';
  const maxRange = Math.max(weaponRanges.front, weaponRanges.rear, weaponRanges.left, weaponRanges.right);
  const svgSize = maxRange * pixelsPerFoot * 2 + 20;
  const center = svgSize / 2;

  // Arc angles (in degrees, 0 = up/north)
  // Each arc covers 90 degrees centered on its direction
  const arcConfig = {
    front: { startAngle: -45, endAngle: 45 },
    right: { startAngle: 45, endAngle: 135 },
    rear: { startAngle: 135, endAngle: 225 },
    left: { startAngle: 225, endAngle: 315 },
  };

  // Convert polar to cartesian for SVG arc
  const polarToCartesian = (cx: number, cy: number, radius: number, angleDegrees: number) => {
    const angleRad = (angleDegrees - 90) * Math.PI / 180;
    return {
      x: cx + radius * Math.cos(angleRad),
      y: cy + radius * Math.sin(angleRad),
    };
  };

  // Generate SVG path for an arc
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
        // Rotate the entire SVG to match vehicle facing
        transform: `rotate(${facing}deg)`,
        transformOrigin: 'center center',
      }}
    >
      {/* Draw arc for each direction that has range */}
      {(['front', 'rear', 'left', 'right'] as const).map((dir) => {
        const range = weaponRanges[dir];
        if (range <= 0) return null;

        const radius = range * pixelsPerFoot;
        const { startAngle, endAngle } = arcConfig[dir];

        return (
          <g key={dir}>
            {/* Arc fill */}
            <path
              d={describeArc(center, center, radius, startAngle, endAngle)}
              fill={`rgba(${baseColor}, 0.08)`}
              stroke={`rgba(${baseColor}, 0.4)`}
              strokeWidth={2}
              strokeDasharray="6 3"
            />
            {/* Range label */}
            <text
              x={center + (radius * 0.6) * Math.cos((((startAngle + endAngle) / 2) - 90) * Math.PI / 180)}
              y={center + (radius * 0.6) * Math.sin((((startAngle + endAngle) / 2) - 90) * Math.PI / 180)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={`rgba(${baseColor}, 0.9)`}
              fontSize={9}
              fontWeight="bold"
              // Counter-rotate text so it stays readable
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
// Vehicle Token (Draggable)
// ==========================================

interface VehicleTokenProps {
  vehicle: Vehicle;
  screenPosition: Position;
  isActive: boolean;
  zoom: number;
  pixelsPerFoot: number;
  remainingMovement: number;
  maxMovement: number;
  onRotate: (vehicleId: string, newFacing: number) => void;
  disabled?: boolean; // Disable dragging (e.g., not this vehicle's turn)
  isCurrentTurn?: boolean; // Highlight as current turn
  crewAssignments: CrewAssignment[];
  creatures: Creature[];
}

function VehicleToken({
  vehicle,
  screenPosition,
  isActive,
  zoom,
  pixelsPerFoot,
  remainingMovement,
  maxMovement,
  onRotate,
  disabled = false,
  isCurrentTurn = false,
  crewAssignments,
  creatures,
}: VehicleTokenProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isInoperative = vehicle.isInoperative || vehicle.currentHp === 0;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: vehicle.id,
      disabled: disabled || isInoperative, // Can't move inoperative vehicles
    });

  // Calculate token size based on actual vehicle dimensions in feet
  // This ensures vehicles are properly scaled relative to the map at any zoom level
  const vehicleFeet = getVehicleSizeInFeet(vehicle.template.size, vehicle.template.id);
  const scaledSize = vehicleFeet * pixelsPerFoot;
  // Minimum 24px for visibility at extreme zoom out, no max so vehicles scale properly
  const tokenSize = Math.max(24, scaledSize);

  // Calculate weapon ranges per arc direction (only for manned weapons)
  const weaponRangesByArc = getWeaponRangesByArc(vehicle, crewAssignments, creatures);
  const maxWeaponRange = Math.max(weaponRangesByArc.front, weaponRangesByArc.rear, weaponRangesByArc.left, weaponRangesByArc.right);

  // z-index priority: dragging > hovered > current turn > default
  const getZIndex = () => {
    if (isDragging) return 1000;
    if (isHovered) return 100;
    if (isCurrentTurn) return 50;
    return 1;
  };

  const style = {
    position: 'absolute' as const,
    left: screenPosition.x - tokenSize / 2,
    top: screenPosition.y - tokenSize / 2,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: getZIndex(),
  };

  const handleRotateLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newFacing = (vehicle.facing - 45 + 360) % 360;
    onRotate(vehicle.id, newFacing);
  };

  const handleRotateRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newFacing = (vehicle.facing + 45) % 360;
    onRotate(vehicle.id, newFacing);
  };

  const hpPercent = (vehicle.currentHp / vehicle.template.maxHp) * 100;
  const borderColor = vehicle.type === 'party' ? 'var(--color-health)' : 'var(--color-fire)';

  return (
    <div
      style={{ ...style, position: 'absolute' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Weapon Range Arcs - drawn behind the token, showing range per direction */}
      {/* Don't show weapon ranges for inoperative vehicles */}
      {maxWeaponRange > 0 && !isInoperative && (
        <WeaponRangeArcs
          weaponRanges={weaponRangesByArc}
          pixelsPerFoot={pixelsPerFoot}
          tokenSize={tokenSize}
          vehicleType={vehicle.type}
          facing={vehicle.facing}
        />
      )}

      {/* Rotation Controls - only show on hover and when not disabled/inoperative */}
      {/* Wrapper div keeps hover state when moving to buttons */}
      {!disabled && !isInoperative && (
        <div
          style={{
            position: 'absolute',
            top: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px',
            zIndex: 10,
            opacity: isHovered && !isDragging ? 1 : 0,
            pointerEvents: isHovered && !isDragging ? 'auto' : 'none',
            transition: 'opacity 0.15s',
          }}
        >
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={handleRotateLeft}
              onMouseDown={(e) => e.stopPropagation()}
              className="rotate-btn"
              title="Rotate left 45°"
            >
              ↺
            </button>
            <button
              onClick={handleRotateRight}
              onMouseDown={(e) => e.stopPropagation()}
              className="rotate-btn"
              title="Rotate right 45°"
            >
              ↻
            </button>
          </div>
        </div>
      )}

      {/* Draggable Token */}
      <div ref={setNodeRef} {...listeners} {...attributes}>
        <div
          className={`vehicle-token ${isDragging ? 'dragging' : ''} ${isCurrentTurn ? 'current-turn' : ''} ${isInoperative ? 'inoperative' : ''}`}
          style={{
            width: tokenSize,
            height: tokenSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled || isInoperative ? 'default' : isDragging ? 'grabbing' : 'grab',
            position: 'relative',
            transform: `rotate(${vehicle.facing}deg)`,
            transformOrigin: 'center center',
            opacity: isInoperative ? 0.5 : disabled ? 0.6 : 1,
            filter: isInoperative ? 'grayscale(1) brightness(0.6)' : disabled ? 'saturate(0.5)' : 'none',
          }}
          title={`${vehicle.name}${isInoperative ? ' (DESTROYED)' : ''}\nHP: ${vehicle.currentHp}/${vehicle.template.maxHp}\nFacing: ${vehicle.facing}°${disabled && !isInoperative ? '\n(Not this vehicle\'s turn)' : ''}`}
        >
          {/* Vehicle Icon - includes all visual elements */}
          <VehicleIcon
            templateId={vehicle.template.id}
            size={tokenSize * 0.9}
            color={borderColor}
          />

          {/* Mishap indicator - counter-rotate to stay readable */}
          {vehicle.activeMishaps.length > 0 && !isInoperative && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 14,
                height: 14,
                background: '#f59e0b',
                borderRadius: '50%',
                fontSize: 9,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `rotate(${-vehicle.facing}deg)`,
                border: '1px solid #000',
              }}
            >
              !
            </div>
          )}

          {/* Destroyed indicator - large X overlay */}
          {isInoperative && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `rotate(${-vehicle.facing}deg)`,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: Math.max(tokenSize * 0.6, 20),
                  fontWeight: 'bold',
                  color: '#dc2626',
                  textShadow: '0 0 4px #000, 0 0 8px #000',
                  lineHeight: 1,
                }}
              >
                ✕
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Info panel below token - always horizontal */}
      <div
        style={{
          position: 'absolute',
          top: tokenSize + 2,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          pointerEvents: 'none',
        }}
      >
        {/* Name label */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 'bold',
            color: isInoperative ? '#dc2626' : 'var(--color-text-primary)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
            background: 'rgba(0,0,0,0.75)',
            padding: '1px 6px',
            borderRadius: 3,
          }}
        >
          {vehicle.name}
        </div>

        {/* HP bar or DESTROYED label */}
        {isInoperative ? (
          <div
            style={{
              fontSize: 8,
              fontWeight: 'bold',
              color: '#dc2626',
              textShadow: '0 1px 2px rgba(0,0,0,0.9)',
              background: 'rgba(0,0,0,0.75)',
              padding: '1px 4px',
              borderRadius: 2,
            }}
          >
            DESTROYED
          </div>
        ) : (
          <div
            style={{
              width: tokenSize * 0.8,
              height: 4,
              background: 'rgba(0,0,0,0.6)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${hpPercent}%`,
                height: '100%',
                background: hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Vehicle Token Display (for drag overlay)
// ==========================================

interface VehicleTokenDisplayProps {
  vehicle: Vehicle;
  isDragging: boolean;
  zoom: number;
  pixelsPerFoot: number;
  remainingMovement?: number;
  maxMovement?: number;
}

function VehicleTokenDisplay({
  vehicle,
  zoom,
  pixelsPerFoot,
}: VehicleTokenDisplayProps) {
  // Calculate token size based on actual vehicle dimensions in feet
  const vehicleFeet = getVehicleSizeInFeet(vehicle.template.size, vehicle.template.id);
  const scaledSize = vehicleFeet * pixelsPerFoot;
  const tokenSize = Math.max(24, scaledSize);
  const borderColor = vehicle.type === 'party' ? 'var(--color-health)' : 'var(--color-fire)';

  return (
    <div
      style={{
        width: tokenSize,
        height: tokenSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.8,
        transform: `rotate(${vehicle.facing}deg)`,
        transformOrigin: 'center center',
      }}
    >
      <VehicleIcon
        templateId={vehicle.template.id}
        size={tokenSize * 0.9}
        color={borderColor}
      />
    </div>
  );
}

// ==========================================
// Vehicle Icon - Top-down tactical view with weapon station indicators
// Icons point UP (toward 0°) - rotation is applied by parent container
// ==========================================

interface VehicleIconProps {
  templateId: string;
  size: number;
  color: string;
}

function VehicleIcon({ templateId, size, color }: VehicleIconProps) {
  const id = templateId.toLowerCase();

  // All icons are TOP-DOWN view, pointing UP (forward)
  // Circles indicate weapon stations

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
    // Stations: Helm (front), Harpoon Flinger (middle), 2x Passenger (rear)
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
        {/* Front left wheel */}
        <circle cx="4" cy="18" r="4" fill={color} opacity="0.9"/>
        <path d="M4,14 L5,16 L4,18 L3,16 Z M0,18 L2,17 L4,18 L2,19 Z M4,22 L3,20 L4,18 L5,20 Z M8,18 L6,19 L4,18 L6,17 Z" fill={color}/>
        {/* Front right wheel */}
        <circle cx="32" cy="18" r="4" fill={color} opacity="0.9"/>
        <path d="M32,14 L33,16 L32,18 L31,16 Z M28,18 L30,17 L32,18 L30,19 Z M32,22 L31,20 L32,18 L33,20 Z M36,18 L34,19 L32,18 L34,17 Z" fill={color}/>
        {/* Rear left wheel */}
        <circle cx="4" cy="42" r="4" fill={color} opacity="0.9"/>
        <path d="M4,38 L5,40 L4,42 L3,40 Z M0,42 L2,41 L4,42 L2,43 Z M4,46 L3,44 L4,42 L5,44 Z M8,42 L6,43 L4,42 L6,41 Z" fill={color}/>
        {/* Rear right wheel */}
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
        {/* Harpoon weapon visual */}
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
    // Scale 0.667 to fit in smaller viewBox for ~50% larger rendering
    return (
      <svg width={size} height={size} viewBox="0 0 27 43">
        <g transform="scale(0.667)">
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
        </g>
      </svg>
    );
  }

  // Default - generic vehicle shape
  return (
    <svg width={size} height={size} viewBox="0 0 28 36">
      {/* Body */}
      <rect x="4" y="6" width="20" height="26" fill={color} opacity="0.8" rx="3"/>
      {/* Front */}
      <polygon points="14,2 6,8 22,8" fill={color}/>
      {/* Helm */}
      <circle cx="14" cy="14" r="3" fill="#000" stroke={color} strokeWidth="1.5"/>
      {/* Weapon station */}
      <circle cx="14" cy="26" r="2.5" fill="#ff6b35" stroke={color} strokeWidth="1"/>
    </svg>
  );
}

function getVehicleIconPath(templateId: string): string {
  // Legacy function - kept for compatibility
  const id = templateId.toLowerCase();

  if (id.includes('devil') || id.includes('ride')) {
    return 'M5 14 L10 8 L30 8 L35 14 L30 18 L10 18 Z M8 12 L12 10 L12 16 L8 14 Z';
  }

  if (id.includes('grinder') || id.includes('demon')) {
    // Heavy tank/grinder shape
    return 'M2 10 L8 4 L32 4 L38 10 L38 18 L32 22 L8 22 L2 18 Z M6 8 L10 6 L10 12 L6 10 Z M34 8 L34 18 L38 16 L38 10 Z';
  }

  if (id.includes('tormentor')) {
    // Assault vehicle shape
    return 'M4 12 L10 6 L30 6 L36 12 L36 16 L30 20 L10 20 L4 16 Z M8 10 L12 8 L12 14 L8 12 Z';
  }

  if (id.includes('scavenger')) {
    // Truck/transport shape
    return 'M3 10 L8 6 L28 6 L33 10 L37 10 L37 18 L33 18 L28 20 L8 20 L3 16 Z';
  }

  // Default vehicle shape
  return 'M5 12 L10 6 L30 6 L35 12 L35 16 L30 20 L10 20 L5 16 Z M8 10 L12 8 L12 14 L8 12 Z';
}

// ==========================================
// Grid Background
// ==========================================

interface BattlefieldGridProps {
  width: number;
  height: number;
  gridSize: number;
  scale: ScaleName;
  mapCenter: Position;
}

function BattlefieldGrid({ width, height, gridSize, scale, mapCenter }: BattlefieldGridProps) {
  const scaleColors: Record<ScaleName, string> = {
    strategic: 'rgba(139, 92, 246, 0.15)',
    approach: 'rgba(59, 130, 246, 0.15)',
    tactical: 'rgba(34, 197, 94, 0.15)',
    point_blank: 'rgba(239, 68, 68, 0.15)',
  };

  const gridColor = '#444444';

  // Make the grid much larger than viewport to cover panning area
  // Extend 3x viewport size in each direction
  const extendedWidth = width * 7;
  const extendedHeight = height * 7;
  const offsetLeft = -width * 3;
  const offsetTop = -height * 3;

  // Calculate grid offset so lines pass through center
  const offsetX = (mapCenter.x - offsetLeft) % gridSize;
  const offsetY = (mapCenter.y - offsetTop) % gridSize;

  return (
    <svg
      width={extendedWidth}
      height={extendedHeight}
      style={{
        position: 'absolute',
        top: offsetTop,
        left: offsetLeft,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <pattern
          id={`grid-${scale}`}
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke={gridColor}
            strokeWidth="1"
          />
        </pattern>
      </defs>
      {/* Background color based on scale */}
      <rect width="100%" height="100%" fill={scaleColors[scale]} />
      {/* Grid lines */}
      <rect width="100%" height="100%" fill={`url(#grid-${scale})`} />

      {/* Center crosshair - adjusted for SVG offset */}
      <line
        x1={mapCenter.x - offsetLeft - 10}
        y1={mapCenter.y - offsetTop}
        x2={mapCenter.x - offsetLeft + 10}
        y2={mapCenter.y - offsetTop}
        stroke="#666"
        strokeWidth="1"
      />
      <line
        x1={mapCenter.x - offsetLeft}
        y1={mapCenter.y - offsetTop - 10}
        x2={mapCenter.x - offsetLeft}
        y2={mapCenter.y - offsetTop + 10}
        stroke="#666"
        strokeWidth="1"
      />
    </svg>
  );
}

// ==========================================
// Distance Lines
// ==========================================

interface DistanceLinesProps {
  vehicles: Vehicle[];
  distances: { from: string; to: string; distance: number }[];
  worldToScreen: (pos: Position) => Position;
}

function DistanceLines({ vehicles, distances, worldToScreen }: DistanceLinesProps) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {distances.map(({ from, to, distance }) => {
        const fromVehicle = vehicles.find((v) => v.id === from);
        const toVehicle = vehicles.find((v) => v.id === to);

        if (!fromVehicle || !toVehicle) return null;

        const fromScreen = worldToScreen(fromVehicle.position);
        const toScreen = worldToScreen(toVehicle.position);

        const midX = (fromScreen.x + toScreen.x) / 2;
        const midY = (fromScreen.y + toScreen.y) / 2;

        return (
          <g key={`${from}-${to}`}>
            {/* Distance Line */}
            <line
              x1={fromScreen.x}
              y1={fromScreen.y}
              x2={toScreen.x}
              y2={toScreen.y}
              stroke="var(--color-fire)"
              strokeWidth="2"
              strokeDasharray="8 4"
              opacity="0.6"
            />
            {/* Distance Label */}
            <rect
              x={midX - 45}
              y={midY - 12}
              width={90}
              height={24}
              rx={4}
              fill="var(--color-bg-secondary)"
              stroke="var(--color-border)"
            />
            <text
              x={midX}
              y={midY + 4}
              textAnchor="middle"
              fill="var(--color-text-primary)"
              fontSize="12"
              fontFamily="var(--font-mono)"
            >
              {formatDistance(distance)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ==========================================
// Movement Range Indicator
// ==========================================

interface MovementRangeIndicatorProps {
  vehicle: Vehicle;
  screenPosition: Position;
  remainingMovement: number;
  maxMovement: number;
  pixelsPerFoot: number;
}

function MovementRangeIndicator({
  vehicle,
  screenPosition,
  remainingMovement,
  maxMovement,
  pixelsPerFoot,
}: MovementRangeIndicatorProps) {
  // Convert remaining movement (in feet) to screen pixels
  const radiusPixels = remainingMovement * pixelsPerFoot;
  const maxRadiusPixels = maxMovement * pixelsPerFoot;

  // Don't render if no movement remaining or radius too small to see
  if (remainingMovement <= 0 || radiusPixels < 5) return null;

  // Use cyan/blue for movement range - distinct from weapon range (green/orange faction colors)
  const movementColor = '#38bdf8'; // Sky blue - clearly different from weapon arcs
  const fillColor = 'rgba(56, 189, 248, 0.06)';

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <defs>
        {/* Glow filter for movement range */}
        <filter id="movementGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer circle showing max movement (faded, dashed) */}
      {maxRadiusPixels > radiusPixels && (
        <circle
          cx={screenPosition.x}
          cy={screenPosition.y}
          r={maxRadiusPixels}
          fill="none"
          stroke={movementColor}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.25}
        />
      )}

      {/* Inner circle showing remaining movement - SOLID line, not dashed */}
      <circle
        cx={screenPosition.x}
        cy={screenPosition.y}
        r={radiusPixels}
        fill={fillColor}
        stroke={movementColor}
        strokeWidth={2.5}
        opacity={0.8}
        filter="url(#movementGlow)"
      />

      {/* Label showing remaining movement */}
      <text
        x={screenPosition.x}
        y={screenPosition.y - radiusPixels - 10}
        textAnchor="middle"
        fill={movementColor}
        fontSize="11"
        fontWeight="bold"
        fontFamily="var(--font-mono)"
        filter="url(#movementGlow)"
      >
        {Math.round(remainingMovement)} ft remaining
      </text>
    </svg>
  );
}

// ==========================================
// Creature Movement Range Indicator
// ==========================================

interface CreatureMovementRangeIndicatorProps {
  creature: Creature;
  screenPosition: Position;
  remainingMovement: number;
  maxMovement: number;
  pixelsPerFoot: number;
}

function CreatureMovementRangeIndicator({
  creature,
  screenPosition,
  remainingMovement,
  maxMovement,
  pixelsPerFoot,
}: CreatureMovementRangeIndicatorProps) {
  // Convert remaining movement (in feet) to screen pixels
  const radiusPixels = remainingMovement * pixelsPerFoot;
  const maxRadiusPixels = maxMovement * pixelsPerFoot;

  // Don't render if no movement remaining or radius too small to see
  if (remainingMovement <= 0 || radiusPixels < 5) return null;

  // Use a different color for creature movement (green for PCs, purple for NPCs)
  const isPC = creature.statblock.type === 'pc';
  const movementColor = isPC ? '#22c55e' : '#a855f7'; // Green for PC, purple for NPC
  const fillColor = isPC ? 'rgba(34, 197, 94, 0.06)' : 'rgba(168, 85, 247, 0.06)';

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <defs>
        {/* Glow filter for creature movement range */}
        <filter id="creatureMovementGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer circle showing max movement (faded, dashed) */}
      {maxRadiusPixels > radiusPixels && (
        <circle
          cx={screenPosition.x}
          cy={screenPosition.y}
          r={maxRadiusPixels}
          fill="none"
          stroke={movementColor}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.25}
        />
      )}

      {/* Inner circle showing remaining movement - SOLID line */}
      <circle
        cx={screenPosition.x}
        cy={screenPosition.y}
        r={radiusPixels}
        fill={fillColor}
        stroke={movementColor}
        strokeWidth={2.5}
        opacity={0.8}
        filter="url(#creatureMovementGlow)"
      />

      {/* Label showing remaining movement */}
      <text
        x={screenPosition.x}
        y={screenPosition.y - radiusPixels - 10}
        textAnchor="middle"
        fill={movementColor}
        fontSize="11"
        fontWeight="bold"
        fontFamily="var(--font-mono)"
        filter="url(#creatureMovementGlow)"
      >
        {Math.round(remainingMovement)} ft remaining
      </text>
    </svg>
  );
}

// ==========================================
// Creature Token (for creatures not on vehicles)
// ==========================================

interface CreatureTokenProps {
  creature: Creature;
  screenPosition: Position;
  pixelsPerFoot: number;
  remainingMovement?: number;
  maxMovement?: number;
  showMovement?: boolean;
  isCurrentTurn?: boolean;
  disabled?: boolean;
  onPositionUpdate?: (creatureId: string, newPosition: Position) => void;
}

function CreatureToken({ creature, screenPosition, pixelsPerFoot, remainingMovement = 0, maxMovement = 0, showMovement = false, isCurrentTurn = false, disabled = false, onPositionUpdate }: CreatureTokenProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `creature-${creature.id}`,
    disabled: disabled,
  });

  // Creature size in feet based on D&D size category
  const sizeInFeet: Record<string, number> = {
    tiny: 2.5,
    small: 5,
    medium: 5,
    large: 10,
    huge: 15,
    gargantuan: 20,
  };
  const creatureFeet = sizeInFeet[creature.statblock.size] || 5;
  const scaledSize = creatureFeet * pixelsPerFoot;
  const tokenSize = Math.max(20, Math.min(scaledSize, 100));

  const hpPercent = (creature.currentHp / creature.statblock.maxHp) * 100;
  const isAlive = creature.currentHp > 0;
  const isPC = creature.statblock.type === 'pc';

  // Current turn creature should be on top of all other tokens
  const getZIndex = () => {
    if (isDragging) return 1000;
    if (isCurrentTurn) return 100; // Above vehicles (typically 10-20) and other creatures
    return 5;
  };

  const style = {
    position: 'absolute' as const,
    left: screenPosition.x - tokenSize / 2,
    top: screenPosition.y - tokenSize / 2,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: getZIndex(),
  };

  // Determine border color based on turn and PC/NPC status
  const getBorderColor = () => {
    if (!isAlive) return '#666';
    if (isCurrentTurn) return '#ff4500'; // Orange highlight for current turn
    return isPC ? 'var(--color-health)' : '#a855f7';
  };

  // Stop event propagation to prevent map panning when interacting with token
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="creature-token"
      {...listeners}
      {...attributes}
      onMouseDown={handleMouseDown}
    >
      {/* Token circle */}
      <div
        style={{
          width: tokenSize,
          height: tokenSize,
          borderRadius: '50%',
          background: isAlive ? 'var(--color-bg-secondary)' : '#333',
          border: `${isCurrentTurn ? 4 : 3}px solid ${getBorderColor()}`,
          boxShadow: isCurrentTurn ? '0 0 12px rgba(255, 69, 0, 0.6)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.max(10, tokenSize * 0.4),
          fontWeight: 'bold',
          color: isAlive ? 'var(--color-text-primary)' : '#666',
          opacity: isAlive ? 1 : 0.6,
          cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
        }}
        title={`${creature.name}\nHP: ${creature.currentHp}/${creature.statblock.maxHp}\nAC: ${creature.statblock.ac}${isCurrentTurn ? '\n(Current Turn)' : ''}`}
      >
        {creature.name.charAt(0).toUpperCase()}
      </div>

      {/* Name and HP bar below */}
      <div
        style={{
          position: 'absolute',
          top: tokenSize + 2,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          pointerEvents: 'none',
        }}
      >
        {/* Name label */}
        <div
          style={{
            fontSize: 9,
            fontWeight: 'bold',
            color: 'var(--color-text-primary)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
            background: 'rgba(0,0,0,0.75)',
            padding: '1px 4px',
            borderRadius: 2,
          }}
        >
          {creature.name}
        </div>

        {/* HP bar */}
        <div
          style={{
            width: tokenSize * 0.8,
            height: 3,
            background: 'rgba(0,0,0,0.6)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${hpPercent}%`,
              height: '100%',
              background: hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>

        {/* Movement bar (only in combat) */}
        {showMovement && maxMovement > 0 && (
          <div
            style={{
              width: tokenSize * 0.8,
              height: 3,
              background: 'rgba(0,0,0,0.6)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(remainingMovement / maxMovement) * 100}%`,
                height: '100%',
                background: remainingMovement > 0 ? '#60a5fa' : '#666',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Utilities
// ==========================================

/**
 * Get vehicle size in FEET based on template ID or size category
 * Based on real-world vehicle equivalents for visual accuracy
 */
function getVehicleSizeInFeet(size: string, templateId?: string): number {
  // Specific vehicle dimensions based on real-world equivalents
  if (templateId) {
    const templateSizes: Record<string, number> = {
      'demon-grinder': 45,  // Tour bus (~40-45 ft)
      'scavenger': 35,      // Salvage truck (~35 ft)
      'tormentor': 22,      // APC (~20-25 ft)
      'buzz-killer': 15,    // Sedan (~15 ft)
      'devils-ride': 8,     // Touring motorcycle (~8 ft)
    };
    if (templateSizes[templateId]) {
      return templateSizes[templateId];
    }
  }

  // Fallback to size category
  const sizes: Record<string, number> = {
    large: 10,
    huge: 25,
    gargantuan: 45,
  };
  return sizes[size] || 10;
}

/**
 * Parse weapon range string to get effective range in feet
 * For "short/long" format (e.g., "120/480 ft"), returns SHORT range (effective, no disadvantage)
 * Examples: "120 ft" -> 120, "60/180 ft" -> 60, "melee" -> 5, "melee (15 ft)" -> 15
 */
function parseWeaponRange(range?: string): number {
  if (!range) return 0;

  // Check for "melee" without a number
  if (range.toLowerCase() === 'melee') return 5;

  // Handle "melee (15 ft)" or "120/480 ft" or "120 ft" formats
  // Always use the FIRST number (effective range, no disadvantage)
  const rangeMatch = range.match(/(\d+)/);
  if (rangeMatch) {
    return parseInt(rangeMatch[1], 10);
  }

  return 0;
}

/**
 * Get the maximum weapon range for a vehicle from its mounted weapons
 */
function getMaxWeaponRange(vehicle: Vehicle): number {
  if (!vehicle.weapons || vehicle.weapons.length === 0) return 0;

  let maxRange = 0;
  for (const weapon of vehicle.weapons) {
    const range = parseWeaponRange(weapon.range);
    if (range > maxRange) {
      maxRange = range;
    }
  }
  return maxRange;
}

/**
 * Get max weapon range per arc direction
 * Returns { front, rear, left, right } with the max range for each direction
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
