import { getObjectDef, resolveParams } from '../objects/registry'
import type { SceneObject } from '../model/types'

/**
 * Draws one placed object by handing its parameters to the registered
 * definition. Position, rotation and elevation are applied here, so each
 * definition only has to describe itself in its own local frame.
 */
export function ObjectInstance({
  object,
  season,
  selected,
  onSelect,
}: {
  object: SceneObject
  season: 'summer' | 'winter'
  selected: boolean
  onSelect: () => void
}) {
  const def = getObjectDef(object.kind)
  if (!def) return null

  const params = resolveParams(def, object.params)
  const ctx = {
    position: object.position,
    rotationDeg: object.rotationDeg,
    elevation: object.elevation,
    season,
  }
  const size = def.bounds(params)

  return (
    <group
      position={[object.position.x, object.elevation, object.position.z]}
      // Positive rotationDeg turns clockwise seen from above, matching the
      // rotate() helper the occluder transform uses.
      rotation={[0, -(object.rotationDeg * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {def.render(params, ctx)}
      {selected && (
        <mesh position={[0, size.height / 2, 0]}>
          <boxGeometry args={[size.width, size.height, size.depth]} />
          <meshBasicMaterial color="#2f6fd0" wireframe transparent opacity={0.75} />
        </mesh>
      )}
    </group>
  )
}
