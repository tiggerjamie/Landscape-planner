import { useMemo } from 'react'
import * as THREE from 'three'
import { EXPOSURE_COLORS, type SightlineResult, type Viewpoint, type TargetWindow } from '../analysis/sightlines'

/**
 * Draws the sightlines being analysed, coloured by verdict. Seeing the red
 * line pass over the top of a pergola is what makes the numbers in the privacy
 * panel legible as a design problem.
 */
export function Sightlines({
  results,
  viewpoints,
  targets,
  activeViewpointId,
}: {
  results: SightlineResult[]
  viewpoints: Viewpoint[]
  targets: TargetWindow[]
  activeViewpointId: string | null
}) {
  const lines = useMemo(() => {
    const byViewpoint = new Map(viewpoints.map((v) => [v.id, v]))
    const byTarget = new Map(targets.map((t) => [t.id, t]))

    return results
      // When riding a viewpoint, show only what that viewpoint can see;
      // otherwise every pair at once is unreadable.
      .filter((r) => !activeViewpointId || r.fromId === activeViewpointId)
      .flatMap((r) => {
        const from = byViewpoint.get(r.fromId)
        const to = byTarget.get(r.toId)
        if (!from || !to) return []
        const geometry = new THREE.BufferGeometry().setAttribute(
          'position',
          new THREE.Float32BufferAttribute(
            [from.eye.x, from.eye.y, from.eye.z, to.center.x, to.center.y, to.center.z],
            3,
          ),
        )
        return [{ key: `${r.fromId}:${r.toId}`, geometry, color: EXPOSURE_COLORS[r.exposure] }]
      })
  }, [results, viewpoints, targets, activeViewpointId])

  return (
    <group>
      {lines.map((l) => (
        <line key={l.key}>
          <primitive object={l.geometry} attach="geometry" />
          <lineBasicMaterial color={l.color} transparent opacity={0.9} depthTest={false} />
        </line>
      ))}
    </group>
  )
}

/** Small markers showing where the standing viewpoints are. */
export function ViewpointMarkers({
  viewpoints,
  activeId,
  onSelect,
}: {
  viewpoints: Viewpoint[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <group>
      {viewpoints
        .filter((v) => v.kind === 'standing')
        .map((v) => (
          <group
            key={v.id}
            position={[v.eye.x, 0, v.eye.z]}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(v.id)
            }}
          >
            {/* A post at eye height, so the viewing height is visible in 3D. */}
            <mesh position={[0, v.eye.y / 2, 0]}>
              <cylinderGeometry args={[0.04, 0.04, v.eye.y, 8]} />
              <meshStandardMaterial color={v.id === activeId ? '#2f6fd0' : '#4a4f55'} />
            </mesh>
            <mesh position={[0, v.eye.y, 0]}>
              <sphereGeometry args={[0.16, 12, 10]} />
              <meshStandardMaterial
                color={v.id === activeId ? '#2f6fd0' : '#d8d4cc'}
                emissive={v.id === activeId ? '#2f6fd0' : '#000000'}
                emissiveIntensity={v.id === activeId ? 0.5 : 0}
              />
            </mesh>
          </group>
        ))}
    </group>
  )
}
