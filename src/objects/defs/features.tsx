import { ft, inch } from '../../units'
import {
  Box,
  boxOccluder,
  Cylinder,
  materialColor,
  MATERIAL_PRESETS,
  METAL,
  METAL_DARK,
  STONE,
  STONE_DARK,
} from '../primitives'
import { registerObject } from '../registry'
import type { Occluder } from '../../geometry/occlusion'

const materialOptions = MATERIAL_PRESETS.map((m) => ({ value: m.value, label: m.label }))

export const firePit = registerObject({
  kind: 'firePit',
  label: 'Fire Pit',
  category: 'features',
  blurb: 'Round or square pit, with an optional seat wall around it',
  defaults: {
    shape: 'round',
    size: ft(3),
    height: inch(16),
    seatWall: false,
    seatWallOffset: ft(3),
    seatHeight: inch(18),
    material: 'stone',
  },
  controls: [
    {
      key: 'shape',
      label: 'Shape',
      type: 'enum',
      options: [
        { value: 'round', label: 'Round' },
        { value: 'square', label: 'Square' },
      ],
    },
    { key: 'size', label: 'Outside width', type: 'length', min: ft(1) },
    { key: 'height', label: 'Height', type: 'length', min: inch(4) },
    { key: 'seatWall', label: 'Seat wall', type: 'boolean' },
    { key: 'seatWallOffset', label: 'Seat wall gap', type: 'length', min: ft(1) },
    { key: 'seatHeight', label: 'Seat height', type: 'length', min: inch(10) },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => {
    const outer = p.seatWall ? p.size + p.seatWallOffset * 2 : p.size
    return { width: outer, depth: outer, height: Math.max(p.height, p.seatWall ? p.seatHeight : 0) }
  },
  // A fire pit is below eye level, so it never screens anything. It still
  // reports occluders so that a raised seat wall behaves consistently.
  occluders: (p) => {
    const out: Occluder[] = [boxOccluder(p.size, p.size, 0, p.height)]
    if (p.seatWall) {
      const outer = p.size + p.seatWallOffset * 2
      out.push(boxOccluder(outer, outer, 0, p.seatHeight))
    }
    return out
  },
  render: (p) => {
    const color = materialColor(p.material, STONE)
    const radius = p.size / 2
    return (
      <group>
        {p.shape === 'round' ? (
          <>
            <Cylinder radius={radius} height={p.height} color={color} segments={24} />
            {/* The fire bowl itself, recessed. */}
            <Cylinder
              radius={radius * 0.72}
              height={inch(1)}
              y={p.height - inch(2)}
              color="#3a3330"
              segments={24}
            />
          </>
        ) : (
          <>
            <Box width={p.size} depth={p.size} height={p.height} color={color} />
            <Box
              width={p.size * 0.72}
              depth={p.size * 0.72}
              height={inch(1)}
              y={p.height - inch(2)}
              color="#3a3330"
            />
          </>
        )}
        {p.seatWall && (
          <SeatRing
            innerRadius={radius + p.seatWallOffset}
            height={p.seatHeight}
            round={p.shape === 'round'}
            color={STONE_DARK}
          />
        )}
      </group>
    )
  },
})

function SeatRing({
  innerRadius,
  height,
  round,
  color,
}: {
  innerRadius: number
  height: number
  round: boolean
  color: string
}) {
  const thickness = inch(14)
  if (round) {
    return (
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry
          args={[innerRadius + thickness, innerRadius + thickness, height, 28, 1, true]}
        />
        <meshStandardMaterial color={color} roughness={0.9} side={2} />
      </mesh>
    )
  }
  const outer = innerRadius + thickness
  // Four straight benches leave the corners open to walk through.
  return (
    <group>
      {[
        { x: 0, z: outer, w: outer * 1.4, d: thickness },
        { x: 0, z: -outer, w: outer * 1.4, d: thickness },
        { x: outer, z: 0, w: thickness, d: outer * 1.4 },
        { x: -outer, z: 0, w: thickness, d: outer * 1.4 },
      ].map((b, i) => (
        <Box key={i} width={b.w} depth={b.d} height={height} x={b.x} z={b.z} color={color} />
      ))}
    </group>
  )
}

export const raisedBed = registerObject({
  kind: 'raisedBed',
  label: 'Raised Garden Bed',
  category: 'features',
  blurb: 'Any width, depth and height, in wood, steel or stone',
  defaults: {
    width: ft(8),
    depth: ft(4),
    height: ft(2),
    wallThickness: inch(2),
    material: 'cedar',
    planted: true,
  },
  controls: [
    { key: 'width', label: 'Width', type: 'length', min: ft(1) },
    { key: 'depth', label: 'Depth', type: 'length', min: ft(1) },
    { key: 'height', label: 'Height', type: 'length', min: inch(6) },
    { key: 'wallThickness', label: 'Wall thickness', type: 'length', min: inch(0.5) },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
    { key: 'planted', label: 'Show planting', type: 'boolean' },
  ],
  bounds: (p) => ({ width: p.width, depth: p.depth, height: p.height }),
  occluders: (p) => [boxOccluder(p.width, p.depth, 0, p.height)],
  render: (p) => {
    const color = materialColor(p.material)
    const t = p.wallThickness
    return (
      <group>
        {/* Four walls, so the soil surface is visible from above. */}
        <Box width={p.width} depth={t} height={p.height} z={-p.depth / 2 + t / 2} color={color} />
        <Box width={p.width} depth={t} height={p.height} z={p.depth / 2 - t / 2} color={color} />
        <Box width={t} depth={p.depth} height={p.height} x={-p.width / 2 + t / 2} color={color} />
        <Box width={t} depth={p.depth} height={p.height} x={p.width / 2 - t / 2} color={color} />
        <Box
          width={p.width - t * 2}
          depth={p.depth - t * 2}
          height={p.height * 0.85}
          color="#4a3a2c"
        />
        {p.planted && (
          <Box
            width={p.width - t * 2}
            depth={p.depth - t * 2}
            height={inch(8)}
            y={p.height * 0.85}
            color="#5c8a4a"
          />
        )}
      </group>
    )
  },
})

export const grill = registerObject({
  kind: 'grill',
  label: 'Grill / Outdoor Kitchen',
  category: 'features',
  blurb: 'Freestanding grill or a built-in counter run',
  defaults: {
    width: ft(4),
    depth: ft(2.2),
    counterHeight: inch(36),
    builtIn: false,
    material: 'steel',
  },
  controls: [
    { key: 'width', label: 'Width', type: 'length', min: ft(1.5) },
    { key: 'depth', label: 'Depth', type: 'length', min: ft(1) },
    { key: 'counterHeight', label: 'Counter height', type: 'length', min: inch(24) },
    {
      key: 'builtIn',
      label: 'Built-in counter',
      type: 'boolean',
      help: 'Draws a masonry surround instead of a cart on wheels',
    },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({ width: p.width, depth: p.depth, height: p.counterHeight + inch(10) }),
  occluders: (p) => [boxOccluder(p.width, p.depth, 0, p.counterHeight)],
  render: (p) => {
    const color = materialColor(p.material, METAL)
    const lidHeight = inch(10)
    return (
      <group>
        {p.builtIn ? (
          <Box width={p.width} depth={p.depth} height={p.counterHeight} color={color} />
        ) : (
          <>
            {/* Cart: a body on legs, so it reads as movable. */}
            <Box
              width={p.width * 0.9}
              depth={p.depth * 0.85}
              height={p.counterHeight * 0.55}
              y={p.counterHeight * 0.45}
              color={color}
            />
            {[-1, 1].map((sx) =>
              [-1, 1].map((sz) => (
                <Cylinder
                  key={`${sx}${sz}`}
                  radius={inch(1.5)}
                  height={p.counterHeight * 0.45}
                  x={(sx * p.width * 0.9) / 2.4}
                  z={(sz * p.depth * 0.85) / 2.6}
                  color={METAL_DARK}
                  segments={10}
                />
              )),
            )}
          </>
        )}
        {/* Grill lid. */}
        <mesh position={[0, p.counterHeight + lidHeight / 2, 0]} castShadow receiveShadow>
          <sphereGeometry args={[Math.min(p.width, p.depth) / 2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={METAL_DARK} roughness={0.5} metalness={0.4} />
        </mesh>
      </group>
    )
  },
})

export const hotTub = registerObject({
  kind: 'hotTub',
  label: 'Hot Tub',
  category: 'features',
  blurb: 'Round or square spa',
  defaults: { shape: 'round', size: ft(7), height: ft(3), material: 'painted' },
  controls: [
    {
      key: 'shape',
      label: 'Shape',
      type: 'enum',
      options: [
        { value: 'round', label: 'Round' },
        { value: 'square', label: 'Square' },
      ],
    },
    { key: 'size', label: 'Width', type: 'length', min: ft(4) },
    { key: 'height', label: 'Height', type: 'length', min: ft(2) },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({ width: p.size, depth: p.size, height: p.height }),
  occluders: (p) => [boxOccluder(p.size, p.size, 0, p.height)],
  render: (p) => {
    const color = materialColor(p.material, '#4a4f55')
    const radius = p.size / 2
    return (
      <group>
        {p.shape === 'round' ? (
          <Cylinder radius={radius} height={p.height} color={color} segments={24} />
        ) : (
          <Box width={p.size} depth={p.size} height={p.height} color={color} />
        )}
        {/* Water surface, inset just below the rim. */}
        {p.shape === 'round' ? (
          <Cylinder
            radius={radius * 0.88}
            height={inch(1)}
            y={p.height - inch(4)}
            color="#4d7f96"
            segments={24}
          />
        ) : (
          <Box
            width={p.size * 0.88}
            depth={p.size * 0.88}
            height={inch(1)}
            y={p.height - inch(4)}
            color="#4d7f96"
          />
        )}
      </group>
    )
  },
})

export const planter = registerObject({
  kind: 'planter',
  label: 'Potted Planter',
  category: 'features',
  blurb: 'A pot with a shrub in it — useful for movable screening',
  defaults: { potWidth: ft(2), potHeight: ft(2), plantHeight: ft(3), material: 'stone' },
  controls: [
    { key: 'potWidth', label: 'Pot width', type: 'length', min: inch(8) },
    { key: 'potHeight', label: 'Pot height', type: 'length', min: inch(8) },
    { key: 'plantHeight', label: 'Plant height', type: 'length', min: 0 },
    { key: 'material', label: 'Material', type: 'enum', options: materialOptions },
  ],
  bounds: (p) => ({
    width: Math.max(p.potWidth, p.plantHeight * 0.6),
    depth: Math.max(p.potWidth, p.plantHeight * 0.6),
    height: p.potHeight + p.plantHeight,
  }),
  occluders: (p) => {
    const out: Occluder[] = [boxOccluder(p.potWidth, p.potWidth, 0, p.potHeight)]
    if (p.plantHeight > 0) {
      const spread = p.plantHeight * 0.6
      out.push({
        type: 'ellipsoid',
        center: { x: 0, y: p.potHeight + p.plantHeight / 2, z: 0 },
        radii: { x: spread / 2, y: p.plantHeight / 2, z: spread / 2 },
        seasonal: false,
      })
    }
    return out
  },
  render: (p) => {
    const color = materialColor(p.material, STONE)
    const spread = p.plantHeight * 0.6
    return (
      <group>
        <Cylinder
          radius={p.potWidth / 2}
          radiusTop={p.potWidth / 2}
          height={p.potHeight}
          color={color}
          segments={16}
        />
        {p.plantHeight > 0 && (
          <mesh
            position={[0, p.potHeight + p.plantHeight / 2, 0]}
            scale={[spread / 2, p.plantHeight / 2, spread / 2]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color="#4f7a43" roughness={0.9} flatShading />
          </mesh>
        )}
      </group>
    )
  },
})
