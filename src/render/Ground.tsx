import { useMemo } from 'react'
import * as THREE from 'three'
import { area, triangulate, type Vec2 } from '../geometry/polygon'
import { MATERIAL_COLORS } from '../analysis/takeoff'
import type { Scene, Surface } from '../model/types'

/**
 * The lot and the ground materials drawn on it. Surfaces are triangulated
 * polygons laid flat, stacked by elevation so a raised deck reads as sitting
 * above the gravel beneath it.
 */

function polygonGeometry(points: Vec2[]): THREE.BufferGeometry | null {
  if (points.length < 3) return null
  const indices = triangulate(points)
  if (indices.length === 0) return null

  const positions = new Float32Array(points.length * 3)
  points.forEach((p, i) => {
    positions[i * 3] = p.x
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = p.z
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function SurfaceMesh({
  surface,
  selected,
  onSelect,
  layer,
}: {
  surface: Surface
  selected: boolean
  onSelect: () => void
  layer: number
}) {
  const geometry = useMemo(() => polygonGeometry(surface.polygon), [surface.polygon])
  if (!geometry) return null

  return (
    <mesh
      geometry={geometry}
      // Nudge each surface up by its stacking order to avoid z-fighting with
      // the lot and with surfaces at the same elevation.
      position={[0, surface.elevation + 0.004 + layer * 0.002, 0]}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <meshStandardMaterial
        color={MATERIAL_COLORS[surface.material]}
        roughness={surface.material === 'water' ? 0.15 : 0.95}
        metalness={surface.material === 'water' ? 0.2 : 0}
        transparent={surface.material === 'water'}
        opacity={surface.material === 'water' ? 0.85 : 1}
        emissive={selected ? '#2f6fd0' : '#000000'}
        emissiveIntensity={selected ? 0.35 : 0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export function Ground({
  scene,
  selectedSurfaceId,
  onSelectSurface,
}: {
  scene: Scene
  selectedSurfaceId: string | null
  onSelectSurface: (id: string) => void
}) {
  const lotGeometry = useMemo(() => polygonGeometry(scene.lot), [scene.lot])

  // Draw thin surfaces last so a small path over a big lawn stays visible.
  const ordered = useMemo(
    () =>
      scene.surfaces
        .map((s, index) => ({ s, index }))
        .sort((a, b) => {
          const byElevation = a.s.elevation - b.s.elevation
          if (Math.abs(byElevation) > 1e-6) return byElevation
          return area(b.s.polygon) - area(a.s.polygon)
        }),
    [scene.surfaces],
  )

  return (
    <group>
      {/* Surrounding context ground, so the lot does not float in space. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#8a9179" roughness={1} />
      </mesh>

      {lotGeometry && (
        <mesh geometry={lotGeometry} receiveShadow>
          <meshStandardMaterial color="#7d9460" roughness={1} side={THREE.DoubleSide} />
        </mesh>
      )}

      {ordered.map(({ s }, layer) => (
        <SurfaceMesh
          key={s.id}
          surface={s}
          layer={layer}
          selected={s.id === selectedSurfaceId}
          onSelect={() => onSelectSurface(s.id)}
        />
      ))}
    </group>
  )
}
