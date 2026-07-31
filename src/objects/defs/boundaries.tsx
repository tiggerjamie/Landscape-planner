import { v2 } from '../../geometry/polygon'
import { ft, inch } from '../../units'
import { Box, STONE, boxOccluder, materialColor, MATERIAL_PRESETS, WOOD } from '../primitives'
import { registerObject } from '../registry'

const materialOptions = MATERIAL_PRESETS.map((m) => ({ value: m.value, label: m.label }))

/**
 * Fences and walls are straight runs placed by position and rotation. A
 * perimeter is built from several segments, which keeps the editing model
 * uniform with every other object and lets each run have its own height —
 * often what you want, since screening is only needed on some sides.
 */

export const fence = registerObject({
  kind: 'fence',
  label: 'Fence',
  category: 'boundaries',
  blurb: 'A straight run — place several to build a perimeter',
  defaults: {
    length: ft(20),
    height: ft(6),
    style: 'privacy',
    postSpacing: ft(8),
    material: 'cedar',
  },
  controls: [
    { key: 'length', label: 'Run length', type: 'length', min: ft(2) },
    {
      key: 'height',
      label: 'Height',
      type: 'length',
      min: ft(1),
      help: 'Check your local limit — 6ft is a common maximum for rear fences',
    },
    {
      key: 'style',
      label: 'Style',
      type: 'enum',
      options: [
        { value: 'privacy', label: 'Solid privacy' },
        { value: 'slat', label: 'Horizontal slat' },
        { value: 'picket', label: 'Picket' },
      ],
    },
    { key: 'postSpacing', label: 'Post spacing', type: 'length', min: ft(2) },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({ width: p.length, depth: inch(6), height: p.height }),
  occluders: (p) => {
    // A picket fence has gaps you can see through at any distance, so it does
    // not count as a visual screen; slat and solid fences do.
    if (p.style === 'picket') return []
    return [boxOccluder(p.length, inch(4), 0, p.height)]
  },
  render: (p) => {
    const color = materialColor(p.material, WOOD)
    const thickness = inch(1.5)
    const postCount = Math.max(2, Math.round(p.length / p.postSpacing) + 1)
    const posts = Array.from({ length: postCount }, (_, i) => {
      const t = postCount === 1 ? 0.5 : i / (postCount - 1)
      return -p.length / 2 + t * p.length
    })

    return (
      <group>
        {posts.map((x, i) => (
          <Box
            key={i}
            width={inch(4)}
            depth={inch(4)}
            height={p.height + inch(2)}
            x={x}
            color={color}
          />
        ))}
        {p.style === 'privacy' && (
          <Box width={p.length} depth={thickness} height={p.height} color={color} />
        )}
        {p.style === 'slat' &&
          // Horizontal boards with a gap between them.
          Array.from({ length: Math.max(1, Math.floor(p.height / inch(7))) }, (_, i) => (
            <Box
              key={i}
              width={p.length}
              depth={thickness}
              height={inch(5)}
              y={i * inch(7)}
              color={color}
            />
          ))}
        {p.style === 'picket' &&
          Array.from({ length: Math.max(1, Math.floor(p.length / inch(6))) }, (_, i) => (
            <Box
              key={i}
              width={inch(3.5)}
              depth={thickness}
              height={p.height}
              x={-p.length / 2 + inch(3) + i * inch(6)}
              color={color}
            />
          ))}
      </group>
    )
  },
})

export const retainingWall = registerObject({
  kind: 'retainingWall',
  label: 'Wall',
  category: 'boundaries',
  blurb: 'Masonry retaining or screening wall',
  defaults: { length: ft(12), height: ft(3), thickness: inch(10), material: 'stone' },
  controls: [
    { key: 'length', label: 'Length', type: 'length', min: ft(1) },
    { key: 'height', label: 'Height', type: 'length', min: ft(0.5) },
    { key: 'thickness', label: 'Thickness', type: 'length', min: inch(4) },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({ width: p.length, depth: p.thickness, height: p.height }),
  occluders: (p) => [boxOccluder(p.length, p.thickness, 0, p.height, v2(0, 0))],
  render: (p) => (
    <Box
      width={p.length}
      depth={p.thickness}
      height={p.height}
      color={materialColor(p.material, STONE)}
    />
  ),
})

export const steps = registerObject({
  kind: 'steps',
  label: 'Steps',
  category: 'boundaries',
  blurb: 'A flight of steps between two levels',
  defaults: { width: ft(4), riserCount: 3, riserHeight: inch(6.5), treadDepth: inch(12), material: 'stone' },
  controls: [
    { key: 'width', label: 'Width', type: 'length', min: ft(1.5) },
    { key: 'riserCount', label: 'Risers', type: 'number', min: 1, max: 20, step: 1 },
    { key: 'riserHeight', label: 'Riser height', type: 'length', min: inch(3) },
    { key: 'treadDepth', label: 'Tread depth', type: 'length', min: inch(8) },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({
    width: p.width,
    depth: p.treadDepth * Math.round(p.riserCount),
    height: p.riserHeight * Math.round(p.riserCount),
  }),
  occluders: () => [],
  render: (p) => {
    const n = Math.round(p.riserCount)
    const totalDepth = p.treadDepth * n
    const color = materialColor(p.material, STONE)
    return (
      <group>
        {Array.from({ length: n }, (_, i) => (
          <Box
            key={i}
            width={p.width}
            // Each step is a slab running back to the top, so the flight is solid.
            depth={totalDepth - i * p.treadDepth}
            height={p.riserHeight}
            y={i * p.riserHeight}
            z={(i * p.treadDepth) / 2}
            color={color}
          />
        ))}
      </group>
    )
  },
})
