import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { distance, rectangle, snapPoint, type Vec2 } from '../geometry/polygon'
import { formatLengthShort, ft } from '../units'
import { uid, type Building, type Surface } from '../model/types'
import { useSceneStore } from '../store/sceneStore'
import { useUIStore } from '../store/uiStore'
import { createObject } from '../objects/factory'
import { MATERIAL_COLORS } from '../analysis/takeoff'
import { DimensionLabel } from './Labels'

/**
 * Turns clicks on the ground into scene edits. Every tool works against the
 * same invisible ground plane, so a polygon drawn in the top-down plan and one
 * drawn in the 3D view produce identical coordinates.
 */

const SURFACE_THICKNESS: Record<string, number> = {
  gravel: 0.1,
  mulch: 0.075,
  concrete: 0.1,
  paver: 0.06,
  flagstone: 0.05,
  deck: 0.04,
  lawn: 0.05,
  water: 0.3,
}

/**
 * A plain rectangular building to start from. Sizes and windows are set
 * afterwards in the inspector, which is faster than making the user draw a
 * footprint before they can see anything.
 */
function createBuilding(kind: Building['kind'], center: Vec2): Building {
  return {
    id: uid('bld'),
    name: kind === 'own' ? 'Our building' : "Neighbour's building",
    kind,
    footprint: rectangle(ft(30), ft(24), center),
    baseElevation: 0,
    wallHeight: ft(18),
    roof: { type: 'gable', pitch: 0.5, ridgeAxis: 0, overhang: ft(1.5) },
    windows: [],
    color: kind === 'own' ? '#d9cfc0' : '#c8c9c4',
  }
}

/**
 * Set when the ground picker has just consumed a click.
 *
 * The lot mesh carries no pointer handlers, so R3F reports a click on open
 * ground as "missed" and the canvas clears the selection. Without this flag
 * that would wipe the selection of the object you just placed, immediately
 * after placing it.
 */
let groundClickConsumed = false

/** True once, if the ground picker handled the click currently being dispatched. */
export function takeGroundClick(): boolean {
  const consumed = groundClickConsumed
  groundClickConsumed = false
  return consumed
}

/**
 * Turns clicks into ground coordinates for whichever tool is armed.
 *
 * This listens on the canvas element and intersects the ray with the y = 0
 * plane analytically, rather than putting a pickable plane in the scene. A
 * scene mesh would compete with the buildings and objects for the click — the
 * nearest one wins and can stop propagation — so placing a pergola over the
 * house would select the house instead of placing anything.
 */
export function GroundPicker() {
  const { camera, gl } = useThree()
  const tool = useUIStore((s) => s.tool)
  const pushDraftPoint = useUIStore((s) => s.pushDraftPoint)
  const setStatus = useUIStore((s) => s.setStatus)
  const snapIncrement = useSceneStore((s) => s.scene.snapIncrement)
  const addObject = useSceneStore((s) => s.addObject)
  const addViewpoint = useSceneStore((s) => s.addViewpoint)
  const addBuilding = useSceneStore((s) => s.addBuilding)
  const cancelTool = useUIStore((s) => s.cancelTool)

  useEffect(() => {
    if (tool.kind === 'select') return
    const element = gl.domElement
    const raycaster = new THREE.Raycaster()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()

    const onClick = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect()
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return

      groundClickConsumed = true
      const p = snapPoint({ x: hit.x, z: hit.z }, snapIncrement)
      switch (tool.kind) {
        case 'draw-lot':
        case 'draw-surface':
        case 'measure':
          pushDraftPoint(p)
          break
        case 'place-object': {
          const object = createObject(tool.objectKind, p)
          if (object) addObject(object)
          cancelTool()
          break
        }
        case 'place-building':
          addBuilding(createBuilding(tool.buildingKind, p))
          cancelTool()
          break
        case 'place-viewpoint':
          addViewpoint({
            id: uid('vp'),
            name: 'Standing point',
            position: p,
            eyeHeight: 1.6,
            headingDeg: 0,
          })
          cancelTool()
          break
      }
      setStatus(null)
    }

    // Capture phase, so the flag is set before R3F dispatches onPointerMissed.
    element.addEventListener('click', onClick, true)
    return () => element.removeEventListener('click', onClick, true)
  }, [
    tool,
    camera,
    gl,
    snapIncrement,
    pushDraftPoint,
    addObject,
    addBuilding,
    addViewpoint,
    cancelTool,
    setStatus,
  ])

  return null
}

/** The in-progress polygon or measurement, drawn as you click. */
export function DraftOverlay() {
  const draftPoints = useUIStore((s) => s.draftPoints)
  const tool = useUIStore((s) => s.tool)
  const units = useSceneStore((s) => s.scene.units)

  const segments = useMemo(() => {
    const out: { key: string; from: Vec2; to: Vec2; label: string }[] = []
    for (let i = 0; i < draftPoints.length - 1; i++) {
      const from = draftPoints[i]
      const to = draftPoints[i + 1]
      out.push({
        key: `${i}`,
        from,
        to,
        label: formatLengthShort(distance(from, to), units),
      })
    }
    return out
  }, [draftPoints, units])

  if (draftPoints.length === 0) return null

  const color = tool.kind === 'measure' ? '#e0a03c' : '#2f6fd0'

  return (
    <group>
      {draftPoints.map((p, i) => (
        <mesh key={i} position={[p.x, 0.06, p.z]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      {segments.map((s) => (
        <group key={s.key}>
          <Line
            points={[
              [s.from.x, 0.06, s.from.z],
              [s.to.x, 0.06, s.to.z],
            ]}
            color={color}
            lineWidth={2}
          />
          <DimensionLabel
            position={[(s.from.x + s.to.x) / 2, 0.4, (s.from.z + s.to.z) / 2]}
            text={s.label}
          />
        </group>
      ))}
    </group>
  )
}

/**
 * Commit the current draft. Kept out of the canvas so the toolbar and the
 * keyboard can both finish a shape.
 */
export function useCommitDraft() {
  const { tool, draftPoints, clearDraft, cancelTool, setStatus } = useUIStore()
  const update = useSceneStore((s) => s.update)
  const addSurface = useSceneStore((s) => s.addSurface)

  return () => {
    if (draftPoints.length < 3) {
      setStatus('Click at least three points before finishing the shape.')
      return
    }
    if (tool.kind === 'draw-lot') {
      update((d) => void (d.lot = draftPoints))
      clearDraft()
      cancelTool()
      return
    }
    if (tool.kind === 'draw-surface') {
      const material = tool.material as Surface['material']
      addSurface({
        id: uid('sur'),
        name: `${material.charAt(0).toUpperCase()}${material.slice(1)} area`,
        polygon: draftPoints,
        material,
        elevation: 0,
        thickness: SURFACE_THICKNESS[material] ?? 0.05,
      })
      clearDraft()
      cancelTool()
    }
  }
}

export const surfaceSwatch = (material: string): string =>
  MATERIAL_COLORS[material as keyof typeof MATERIAL_COLORS] ?? '#999'
