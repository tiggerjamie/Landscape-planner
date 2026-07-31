import { useMemo } from 'react'
import * as THREE from 'three'
import { bounds } from '../geometry/polygon'
import { roofMetrics, windowFrame } from '../model/building'
import type { Building, Window } from '../model/types'

/**
 * A building drawn from its stored footprint, wall height, roof and windows.
 * Reads the same geometry helpers the privacy analysis uses, so what you see
 * is exactly what gets raycast.
 */

const GLASS = '#7ea6c4'
const GLASS_SELECTED = '#3f8fe0'
const FRAME = '#f2efe9'

function wallGeometry(building: Building): THREE.BufferGeometry | null {
  if (building.footprint.length < 3) return null
  // A Shape lives in XY and extrudes along +Z. Feeding it (x, -z) and then
  // rotating -90 degrees about X lands each vertex at (x, height, z) using a
  // pure rotation — no mirroring, which would invert the face winding.
  const shape = new THREE.Shape()
  building.footprint.forEach((p, i) => {
    if (i === 0) shape.moveTo(p.x, -p.z)
    else shape.lineTo(p.x, -p.z)
  })
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: building.wallHeight,
    bevelEnabled: false,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Roof geometry over the footprint's bounding box. Real footprints are rarely
 * simple enough for a true swept roof, and the bounding-box form reads
 * correctly for the rectangular houses this tool is aimed at.
 *
 * Built as explicit triangles rather than rotated primitives so the ridge
 * axis and overhang land exactly where the numbers say they should.
 */
function roofGeometry(building: Building): THREE.BufferGeometry | null {
  if (building.footprint.length < 3) return null
  const { rise } = roofMetrics(building)
  const b = bounds(building.footprint)
  const o = building.roof.overhang
  const minX = b.minX - o
  const maxX = b.maxX + o
  const minZ = b.minZ - o
  const maxZ = b.maxZ + o

  const geometry = new THREE.BufferGeometry()
  const tri = (...verts: number[]) => verts

  if (building.roof.type === 'hip' && rise > 0) {
    // Pyramid: four eave corners rising to a single apex.
    const apex = [(minX + maxX) / 2, rise, (minZ + maxZ) / 2]
    const c = [
      [minX, 0, minZ],
      [maxX, 0, minZ],
      [maxX, 0, maxZ],
      [minX, 0, maxZ],
    ]
    const positions = [
      ...tri(...c[0], ...c[1], ...apex),
      ...tri(...c[1], ...c[2], ...apex),
      ...tri(...c[2], ...c[3], ...apex),
      ...tri(...c[3], ...c[0], ...apex),
      // Underside, so the roof is not see-through from below.
      ...tri(...c[0], ...c[2], ...c[1]),
      ...tri(...c[0], ...c[3], ...c[2]),
    ]
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.computeVertexNormals()
    return geometry
  }

  // Gable: a triangular prism with the ridge along the chosen axis.
  const alongX = building.roof.ridgeAxis === 0
  const midX = (minX + maxX) / 2
  const midZ = (minZ + maxZ) / 2

  // Eave corners and the two ends of the ridge.
  const e = alongX
    ? [
        [minX, 0, minZ],
        [maxX, 0, minZ],
        [maxX, 0, maxZ],
        [minX, 0, maxZ],
      ]
    : [
        [minX, 0, minZ],
        [minX, 0, maxZ],
        [maxX, 0, maxZ],
        [maxX, 0, minZ],
      ]
  const r0 = alongX ? [minX, rise, midZ] : [midX, rise, minZ]
  const r1 = alongX ? [maxX, rise, midZ] : [midX, rise, maxZ]

  const positions = [
    // Two slopes.
    ...tri(...e[0], ...e[1], ...r1),
    ...tri(...e[0], ...r1, ...r0),
    ...tri(...e[2], ...e[3], ...r0),
    ...tri(...e[2], ...r0, ...r1),
    // Gable ends.
    ...tri(...e[1], ...e[2], ...r1),
    ...tri(...e[3], ...e[0], ...r0),
    // Underside.
    ...tri(...e[0], ...e[2], ...e[1]),
    ...tri(...e[0], ...e[3], ...e[2]),
  ]
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

function Roof({ building }: { building: Building }) {
  const { eaveY, rise } = roofMetrics(building)
  const b = useMemo(() => bounds(building.footprint), [building.footprint])
  const geometry = useMemo(
    () => (building.roof.type === 'flat' || rise <= 0 ? null : roofGeometry(building)),
    [building, rise],
  )
  if (building.footprint.length < 3) return null

  if (!geometry) {
    const o = building.roof.overhang
    return (
      <mesh position={[b.center.x, eaveY + 0.05, b.center.z]} castShadow receiveShadow>
        <boxGeometry args={[b.width + o * 2, 0.1, b.depth + o * 2]} />
        <meshStandardMaterial color="#5d5a55" roughness={0.9} />
      </mesh>
    )
  }

  return (
    <mesh
      geometry={geometry}
      position={[0, eaveY - building.baseElevation, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#5d5a55" roughness={0.9} flatShading side={THREE.DoubleSide} />
    </mesh>
  )
}

function WindowMesh({
  building,
  win,
  selected,
  onSelect,
}: {
  building: Building
  win: Window
  selected: boolean
  onSelect: () => void
}) {
  const frame = useMemo(() => windowFrame(building, win), [building, win])
  if (!frame.valid) return null

  // Face the pane along the wall's outward normal.
  const yaw = Math.atan2(frame.normal.x, frame.normal.z)
  const width = Math.hypot(
    frame.corners[1].x - frame.corners[0].x,
    frame.corners[1].z - frame.corners[0].z,
  )
  const height = frame.corners[2].y - frame.corners[1].y
  // Sit just proud of the wall so the pane is not buried in it.
  const nudge = 0.03

  return (
    <group
      position={[
        frame.center.x + frame.normal.x * nudge,
        frame.center.y,
        frame.center.z + frame.normal.z * nudge,
      ]}
      rotation={[0, yaw, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <mesh>
        <boxGeometry args={[width + 0.09, height + 0.09, 0.04]} />
        <meshStandardMaterial color={FRAME} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[width, height, 0.02]} />
        <meshStandardMaterial
          color={selected ? GLASS_SELECTED : GLASS}
          roughness={0.15}
          metalness={0.35}
          emissive={selected ? GLASS_SELECTED : '#000000'}
          emissiveIntensity={selected ? 0.5 : 0}
        />
      </mesh>
    </group>
  )
}

export function BuildingMesh({
  building,
  selected,
  selectedWindowId,
  onSelect,
  onSelectWindow,
}: {
  building: Building
  selected: boolean
  selectedWindowId: string | null
  onSelect: () => void
  onSelectWindow: (windowId: string) => void
}) {
  const geometry = useMemo(() => wallGeometry(building), [building])
  if (!geometry) return null

  return (
    <group position={[0, building.baseElevation, 0]}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <meshStandardMaterial
          color={building.color}
          roughness={0.9}
          emissive={selected ? '#2f6fd0' : '#000000'}
          emissiveIntensity={selected ? 0.25 : 0}
          // Visible from inside too, for when the camera rides a window.
          side={THREE.DoubleSide}
        />
      </mesh>

      <Roof building={building} />

      {building.windows.map((win) => (
        <WindowMesh
          key={win.id}
          building={building}
          win={win}
          selected={win.id === selectedWindowId}
          onSelect={() => onSelectWindow(win.id)}
        />
      ))}
    </group>
  )
}

/** Outline of a footprint, drawn on the ground for the site editor. */
export function FootprintOutline({ points, color }: { points: { x: number; z: number }[]; color: string }) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null
    const verts = [...points, points[0]].flatMap((p) => [p.x, 0.02, p.z])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    return g
  }, [points])
  if (!geometry) return null
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={color} />
    </line>
  )
}
