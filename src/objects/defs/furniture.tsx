import { ft, inch } from '../../units'
import { Box, Cylinder, FABRIC, METAL_DARK, WOOD, boxOccluder, materialColor, MATERIAL_PRESETS } from '../primitives'
import { registerObject } from '../registry'

const materialOptions = MATERIAL_PRESETS.map((m) => ({ value: m.value, label: m.label }))

/**
 * Furniture is below eye level, so most of it contributes no occluders — it is
 * here for layout and circulation, to check that a path actually fits between
 * the dining set and the beds.
 */

export const diningSet = registerObject({
  kind: 'diningSet',
  label: 'Dining Set',
  category: 'furniture',
  blurb: 'Table with chairs — check that the patio is big enough',
  defaults: {
    shape: 'rect',
    tableWidth: ft(6),
    tableDepth: ft(3),
    tableHeight: inch(30),
    seats: 6,
    material: 'wood',
  },
  controls: [
    {
      key: 'shape',
      label: 'Table shape',
      type: 'enum',
      options: [
        { value: 'rect', label: 'Rectangular' },
        { value: 'round', label: 'Round' },
      ],
    },
    { key: 'tableWidth', label: 'Table width', type: 'length', min: ft(2) },
    { key: 'tableDepth', label: 'Table depth', type: 'length', min: ft(2) },
    { key: 'tableHeight', label: 'Table height', type: 'length', min: inch(24) },
    { key: 'seats', label: 'Chairs', type: 'number', min: 0, max: 12, step: 1 },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({
    // Chairs need roughly 2ft of pull-out room all round.
    width: (p.shape === 'round' ? p.tableWidth : p.tableWidth) + ft(4),
    depth: (p.shape === 'round' ? p.tableWidth : p.tableDepth) + ft(4),
    height: p.tableHeight,
  }),
  occluders: () => [],
  render: (p) => {
    const color = materialColor(p.material, WOOD)
    const seats = Math.round(p.seats)
    const chairs = []
    const halfW = (p.shape === 'round' ? p.tableWidth : p.tableWidth) / 2
    const halfD = (p.shape === 'round' ? p.tableWidth : p.tableDepth) / 2
    for (let i = 0; i < seats; i++) {
      // Distribute chairs around the perimeter by angle.
      const angle = (i / seats) * Math.PI * 2
      const x = Math.cos(angle) * (halfW + ft(1.1))
      const z = Math.sin(angle) * (halfD + ft(1.1))
      chairs.push(
        <group key={i}>
          <Box width={ft(1.4)} depth={ft(1.4)} height={inch(17)} x={x} z={z} color={color} />
        </group>,
      )
    }
    return (
      <group>
        {p.shape === 'round' ? (
          <Cylinder
            radius={p.tableWidth / 2}
            height={inch(2)}
            y={p.tableHeight - inch(2)}
            color={color}
            segments={20}
          />
        ) : (
          <Box
            width={p.tableWidth}
            depth={p.tableDepth}
            height={inch(2)}
            y={p.tableHeight - inch(2)}
            color={color}
          />
        )}
        <Box
          width={p.tableWidth * 0.15}
          depth={p.tableDepth * 0.3}
          height={p.tableHeight - inch(2)}
          color={METAL_DARK}
        />
        {chairs}
      </group>
    )
  },
})

export const bench = registerObject({
  kind: 'bench',
  label: 'Bench',
  category: 'furniture',
  blurb: 'Simple garden bench',
  defaults: { width: ft(5), depth: ft(1.8), seatHeight: inch(18), hasBack: true, material: 'wood' },
  controls: [
    { key: 'width', label: 'Width', type: 'length', min: ft(1.5) },
    { key: 'depth', label: 'Depth', type: 'length', min: ft(1) },
    { key: 'seatHeight', label: 'Seat height', type: 'length', min: inch(10) },
    { key: 'hasBack', label: 'Has back', type: 'boolean' },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({
    width: p.width,
    depth: p.depth,
    height: p.hasBack ? p.seatHeight + inch(16) : p.seatHeight,
  }),
  occluders: () => [],
  render: (p) => {
    const color = materialColor(p.material, WOOD)
    return (
      <group>
        <Box
          width={p.width}
          depth={p.depth}
          height={inch(2)}
          y={p.seatHeight - inch(2)}
          color={color}
        />
        {[-1, 1].map((s) => (
          <Box
            key={s}
            width={inch(3)}
            depth={inch(3)}
            height={p.seatHeight - inch(2)}
            x={(s * p.width) / 2.6}
            color={METAL_DARK}
          />
        ))}
        {p.hasBack && (
          <Box
            width={p.width}
            depth={inch(2)}
            height={inch(14)}
            y={p.seatHeight}
            z={-p.depth / 2 + inch(1)}
            color={color}
          />
        )}
      </group>
    )
  },
})

export const lounge = registerObject({
  kind: 'lounge',
  label: 'Lounge Seating',
  category: 'furniture',
  blurb: 'Low sofa or armchair grouping',
  defaults: { width: ft(6), depth: ft(3), seatHeight: inch(16), material: 'painted' },
  controls: [
    { key: 'width', label: 'Width', type: 'length', min: ft(2) },
    { key: 'depth', label: 'Depth', type: 'length', min: ft(2) },
    { key: 'seatHeight', label: 'Seat height', type: 'length', min: inch(10) },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({ width: p.width, depth: p.depth, height: p.seatHeight + inch(14) }),
  occluders: () => [],
  render: (p) => {
    const color = materialColor(p.material, '#8d8f89')
    return (
      <group>
        <Box width={p.width} depth={p.depth} height={p.seatHeight} color={color} />
        <Box
          width={p.width}
          depth={inch(6)}
          height={inch(14)}
          y={p.seatHeight}
          z={-p.depth / 2 + inch(3)}
          color={FABRIC}
        />
      </group>
    )
  },
})

export const umbrella = registerObject({
  kind: 'umbrella',
  label: 'Umbrella',
  category: 'furniture',
  blurb: 'Patio umbrella — a genuine overhead screen when open',
  defaults: { canopyWidth: ft(9), height: ft(8), open: true },
  controls: [
    { key: 'canopyWidth', label: 'Canopy width', type: 'length', min: ft(3) },
    { key: 'height', label: 'Height', type: 'length', min: ft(5) },
    { key: 'open', label: 'Open', type: 'boolean' },
  ],
  bounds: (p) => ({
    width: p.open ? p.canopyWidth : ft(1),
    depth: p.open ? p.canopyWidth : ft(1),
    height: p.height,
  }),
  occluders: (p) =>
    // Only an open umbrella blocks the view down from an upstairs window.
    p.open ? [boxOccluder(p.canopyWidth, p.canopyWidth, p.height - inch(10), p.height)] : [],
  render: (p) => (
    <group>
      <Cylinder radius={inch(1.5)} height={p.height} color={METAL_DARK} segments={10} />
      {p.open && (
        <mesh position={[0, p.height - inch(8), 0]} castShadow receiveShadow>
          <coneGeometry args={[p.canopyWidth / 2, inch(16), 8]} />
          <meshStandardMaterial color={FABRIC} roughness={0.9} flatShading side={2} />
        </mesh>
      )}
    </group>
  ),
})
