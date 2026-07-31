import { ft, inch } from '../../units'
import { Blob, Cylinder, FOLIAGE, FOLIAGE_AUTUMN, TRUNK, boxOccluder } from '../primitives'
import { registerObject } from '../registry'
import type { Occluder } from '../../geometry/occlusion'

/**
 * Plants are the main *adjustable* screening tool in a yard, so canopy size and
 * height are first-class parameters — and deciduous canopies are marked
 * `seasonal` so the analysis can drop them in winter.
 */

const canopyShapes = [
  { value: 'round', label: 'Round' },
  { value: 'columnar', label: 'Columnar' },
  { value: 'vase', label: 'Vase' },
  { value: 'conical', label: 'Conical' },
]

export const tree = registerObject({
  kind: 'tree',
  label: 'Tree',
  category: 'plants',
  blurb: 'Trunk and canopy — set the mature size to plan real screening',
  defaults: {
    trunkHeight: ft(7),
    trunkDiameter: inch(8),
    canopyWidth: ft(14),
    canopyHeight: ft(12),
    canopyShape: 'round',
    deciduous: true,
  },
  controls: [
    {
      key: 'trunkHeight',
      label: 'Clear trunk',
      type: 'length',
      min: 0,
      help: 'Height to the bottom of the canopy — views pass underneath this',
    },
    { key: 'trunkDiameter', label: 'Trunk diameter', type: 'length', min: inch(1) },
    { key: 'canopyWidth', label: 'Canopy width', type: 'length', min: ft(1) },
    { key: 'canopyHeight', label: 'Canopy height', type: 'length', min: ft(1) },
    { key: 'canopyShape', label: 'Canopy shape', type: 'enum', options: canopyShapes },
    {
      key: 'deciduous',
      label: 'Deciduous',
      type: 'boolean',
      help: 'Deciduous canopies stop screening in the winter view',
    },
  ],
  bounds: (p) => ({
    width: p.canopyWidth,
    depth: p.canopyWidth,
    height: p.trunkHeight + p.canopyHeight,
  }),
  occluders: (p) => {
    const out: Occluder[] = [
      boxOccluder(p.trunkDiameter, p.trunkDiameter, 0, p.trunkHeight),
    ]
    const halfW = canopyHalfWidth(p.canopyShape, p.canopyWidth)
    out.push({
      type: 'ellipsoid',
      center: { x: 0, y: p.trunkHeight + p.canopyHeight / 2, z: 0 },
      radii: { x: halfW, y: p.canopyHeight / 2, z: halfW },
      seasonal: p.deciduous,
    })
    return out
  },
  render: (p, ctx) => {
    const bare = p.deciduous && ctx.season === 'winter'
    const color = bare ? FOLIAGE_AUTUMN : FOLIAGE
    const halfW = canopyHalfWidth(p.canopyShape, p.canopyWidth)
    const centerY = p.trunkHeight + p.canopyHeight / 2
    return (
      <group>
        <Cylinder
          radius={p.trunkDiameter / 2}
          radiusTop={p.trunkDiameter / 2.6}
          height={p.trunkHeight + p.canopyHeight * 0.3}
          color={TRUNK}
          segments={10}
        />
        {p.canopyShape === 'conical' ? (
          <mesh position={[0, centerY, 0]} castShadow receiveShadow>
            <coneGeometry args={[halfW, p.canopyHeight, 12]} />
            <meshStandardMaterial
              color={color}
              roughness={0.9}
              flatShading
              transparent={bare}
              opacity={bare ? 0.35 : 1}
            />
          </mesh>
        ) : (
          <mesh
            position={[0, centerY, 0]}
            scale={[halfW, p.canopyHeight / 2, halfW]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial
              color={color}
              roughness={0.9}
              flatShading
              transparent={bare}
              opacity={bare ? 0.35 : 1}
            />
          </mesh>
        )}
      </group>
    )
  },
})

/** Columnar canopies are much narrower than their nominal width. */
function canopyHalfWidth(shape: string, width: number): number {
  if (shape === 'columnar') return (width / 2) * 0.45
  if (shape === 'vase') return (width / 2) * 0.9
  return width / 2
}

export const shrub = registerObject({
  kind: 'shrub',
  label: 'Shrub',
  category: 'plants',
  blurb: 'Massing plant for low screening and bed structure',
  defaults: { width: ft(4), height: ft(4), shape: 'round', evergreen: true },
  controls: [
    { key: 'width', label: 'Width', type: 'length', min: ft(0.5) },
    { key: 'height', label: 'Height', type: 'length', min: ft(0.5) },
    {
      key: 'shape',
      label: 'Shape',
      type: 'enum',
      options: [
        { value: 'round', label: 'Round' },
        { value: 'box', label: 'Clipped box' },
        { value: 'columnar', label: 'Columnar' },
      ],
    },
    {
      key: 'evergreen',
      label: 'Evergreen',
      type: 'boolean',
      help: 'Evergreens keep screening through the winter',
    },
  ],
  bounds: (p) => ({ width: p.width, depth: p.width, height: p.height }),
  occluders: (p) => {
    if (p.shape === 'box') {
      const o = boxOccluder(p.width, p.width, 0, p.height)
      return [{ ...o, seasonal: !p.evergreen }]
    }
    const halfW = p.shape === 'columnar' ? (p.width / 2) * 0.5 : p.width / 2
    return [
      {
        type: 'ellipsoid',
        center: { x: 0, y: p.height / 2, z: 0 },
        radii: { x: halfW, y: p.height / 2, z: halfW },
        seasonal: !p.evergreen,
      },
    ]
  },
  render: (p, ctx) => {
    const bare = !p.evergreen && ctx.season === 'winter'
    const color = bare ? '#7d6a4a' : '#4a7040'
    const halfW = p.shape === 'columnar' ? (p.width / 2) * 0.5 : p.width / 2
    if (p.shape === 'box') {
      return (
        <mesh position={[0, p.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[p.width, p.height, p.width]} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      )
    }
    return (
      <Blob
        radiusX={halfW}
        radiusY={p.height / 2}
        radiusZ={halfW}
        y={p.height / 2}
        color={color}
      />
    )
  },
})

export const grass = registerObject({
  kind: 'grass',
  label: 'Ornamental Grass',
  category: 'plants',
  blurb: 'Soft vertical accent, dies back in winter',
  defaults: { width: ft(3), height: ft(4) },
  controls: [
    { key: 'width', label: 'Width', type: 'length', min: ft(0.5) },
    { key: 'height', label: 'Height', type: 'length', min: ft(0.5) },
  ],
  bounds: (p) => ({ width: p.width, depth: p.width, height: p.height }),
  // Grasses are too open to count as screening, in any season.
  occluders: () => [],
  render: (p, ctx) => {
    const color = ctx.season === 'winter' ? '#b09a6a' : '#8fa356'
    return (
      <mesh position={[0, p.height / 2, 0]} castShadow receiveShadow>
        <coneGeometry args={[p.width / 2, p.height, 9]} />
        <meshStandardMaterial color={color} roughness={0.95} flatShading />
      </mesh>
    )
  },
})
