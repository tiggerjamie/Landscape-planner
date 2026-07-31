import { Html } from '@react-three/drei'

/**
 * Small HTML labels anchored in the 3D scene. Used for dimension readouts, so
 * text stays crisp and legible at any zoom instead of being drawn as geometry.
 */
export function DimensionLabel({
  position,
  text,
  tone = 'default',
}: {
  position: [number, number, number]
  text: string
  tone?: 'default' | 'measure'
}) {
  return (
    <Html position={position} center distanceFactor={18} zIndexRange={[10, 0]}>
      <div className={`dim-label ${tone === 'measure' ? 'dim-label--measure' : ''}`}>{text}</div>
    </Html>
  )
}
