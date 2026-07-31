import { v2 } from '../../geometry/polygon'
import { ft, inch } from '../../units'
import { Box, boxOccluder, materialColor, MATERIAL_PRESETS, spread, WOOD_DARK } from '../primitives'
import { registerObject } from '../registry'
import type { Occluder } from '../../geometry/occlusion'

const materialOptions = MATERIAL_PRESETS.map((m) => ({ value: m.value, label: m.label }))

/**
 * Pergola / pagoda. Every dimension is parametric because the whole point of
 * the tool is asking "does a 12ft one screen the upstairs window, or do I need
 * 14ft with a solid canopy?"
 */
export const pergola = registerObject({
  kind: 'pergola',
  label: 'Pergola / Pagoda',
  category: 'structures',
  blurb: 'Posts, beams and rafters, with an optional solid canopy',
  defaults: {
    width: ft(12),
    depth: ft(12),
    postHeight: ft(8),
    postSize: inch(6),
    rafterCount: 9,
    rafterDepth: inch(7),
    canopy: false,
    material: 'cedar',
  },
  controls: [
    { key: 'width', label: 'Width', type: 'length', min: ft(3) },
    { key: 'depth', label: 'Depth', type: 'length', min: ft(3) },
    { key: 'postHeight', label: 'Post height', type: 'length', min: ft(6) },
    { key: 'postSize', label: 'Post thickness', type: 'length', min: inch(2) },
    { key: 'rafterCount', label: 'Rafters', type: 'number', min: 0, max: 40, step: 1 },
    { key: 'rafterDepth', label: 'Rafter depth', type: 'length', min: inch(2) },
    {
      key: 'canopy',
      label: 'Solid canopy',
      type: 'boolean',
      help: 'A solid roof blocks sightlines from above; open rafters barely do',
    },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({ width: p.width, depth: p.depth, height: p.postHeight + p.rafterDepth }),
  occluders: (p) => {
    const out: Occluder[] = []
    const half = p.postSize / 2
    // Posts are what actually interrupt a view at eye level.
    for (const x of [-p.width / 2 + half, p.width / 2 - half]) {
      for (const z of [-p.depth / 2 + half, p.depth / 2 - half]) {
        out.push(boxOccluder(p.postSize, p.postSize, 0, p.postHeight, v2(x, z)))
      }
    }
    if (p.canopy) {
      out.push(
        boxOccluder(p.width, p.depth, p.postHeight, p.postHeight + p.rafterDepth, v2(0, 0)),
      )
    }
    // Open rafters are deliberately not occluders: they break up a view but do
    // not block one, and treating them as solid would overstate privacy.
    return out
  },
  render: (p) => {
    const color = materialColor(p.material)
    const half = p.postSize / 2
    const beamTop = p.postHeight
    return (
      <group>
        {[-p.width / 2 + half, p.width / 2 - half].map((x) =>
          [-p.depth / 2 + half, p.depth / 2 - half].map((z) => (
            <Box
              key={`${x}:${z}`}
              width={p.postSize}
              depth={p.postSize}
              height={p.postHeight}
              x={x}
              z={z}
              color={color}
            />
          )),
        )}
        {/* Beams along the depth axis, carried on the posts. */}
        {[-p.width / 2 + half, p.width / 2 - half].map((x) => (
          <Box
            key={`beam${x}`}
            width={p.postSize}
            depth={p.depth}
            height={p.rafterDepth}
            x={x}
            y={beamTop}
            color={WOOD_DARK}
          />
        ))}
        {p.canopy ? (
          <Box
            width={p.width}
            depth={p.depth}
            height={inch(2)}
            y={beamTop + p.rafterDepth}
            color={color}
          />
        ) : (
          spread(Math.round(p.rafterCount), p.width - p.postSize).map((x, i) => (
            <Box
              key={`rafter${i}`}
              width={inch(2)}
              depth={p.depth}
              height={p.rafterDepth}
              x={x}
              y={beamTop + p.rafterDepth * 0.15}
              color={color}
            />
          ))
        )}
      </group>
    )
  },
})

export const shed = registerObject({
  kind: 'shed',
  label: 'Shed',
  category: 'structures',
  blurb: 'Enclosed storage building with a pitched roof',
  defaults: {
    width: ft(10),
    depth: ft(8),
    wallHeight: ft(7),
    roofRise: ft(2),
    material: 'painted',
  },
  controls: [
    { key: 'width', label: 'Width', type: 'length', min: ft(2) },
    { key: 'depth', label: 'Depth', type: 'length', min: ft(2) },
    { key: 'wallHeight', label: 'Wall height', type: 'length', min: ft(4) },
    { key: 'roofRise', label: 'Roof rise', type: 'length', min: 0 },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({ width: p.width, depth: p.depth, height: p.wallHeight + p.roofRise }),
  occluders: (p) => [
    boxOccluder(p.width, p.depth, 0, p.wallHeight),
    // The gable is narrower than the walls, so approximate it inset.
    boxOccluder(p.width * 0.7, p.depth, p.wallHeight, p.wallHeight + p.roofRise),
  ],
  render: (p) => {
    const color = materialColor(p.material, '#e8e6e1')
    return (
      <group>
        <Box width={p.width} depth={p.depth} height={p.wallHeight} color={color} />
        {p.roofRise > 0 && (
          <mesh position={[0, p.wallHeight + p.roofRise / 2, 0]} castShadow receiveShadow>
            {/* A 4-sided cone is a pyramid; rotated 45° it reads as a hip roof. */}
            <cylinderGeometry
              args={[0, Math.max(p.width, p.depth) * 0.72, p.roofRise, 4]}
              />
            <meshStandardMaterial color={WOOD_DARK} roughness={0.9} flatShading />
          </mesh>
        )}
      </group>
    )
  },
})
