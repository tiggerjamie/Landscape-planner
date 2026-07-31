import { edges, setEdgeLength, type Vec2 } from '../geometry/polygon'
import { roofMetrics } from '../model/building'
import { uid, type Building, type Scene, type SurfaceMaterial } from '../model/types'
import { formatArea, formatLength, ft } from '../units'
import { area } from '../geometry/polygon'
import { MATERIAL_LABELS } from '../analysis/takeoff'
import { getObjectDef, resolveParams, type ControlSpec } from '../objects/registry'
import { useSceneStore } from '../store/sceneStore'
import { ColorInput, LengthInput, NumberInput, SelectInput, TextInput, ToggleInput } from './controls'

/**
 * Edits whatever is selected. Object parameters are rendered straight from the
 * registry's control specs, so a new object kind gets a full editing UI
 * without any code here changing.
 */
export function Inspector() {
  const scene = useSceneStore((s) => s.scene)
  const selection = useSceneStore((s) => s.selection)
  const update = useSceneStore((s) => s.update)
  const removeSelected = useSceneStore((s) => s.removeSelected)

  if (!selection) {
    return (
      <div className="panel panel--empty">
        <p>Nothing selected.</p>
        <p className="muted">
          Click a house, window, surface or object in the view to edit it.
        </p>
      </div>
    )
  }

  const units = scene.units

  if (selection.type === 'building') {
    const building = scene.buildings.find((b) => b.id === selection.id)
    if (!building) return null
    const edit = (fn: (b: Building) => void) =>
      update((d) => {
        const target = d.buildings.find((b) => b.id === selection.id)
        if (target) fn(target)
      })
    const { ridgeY } = roofMetrics(building)

    return (
      <div className="panel">
        <header className="panel__header">
          <h2>{building.name}</h2>
          <button className="btn btn--danger" onClick={removeSelected}>
            Delete
          </button>
        </header>

        <TextInput label="Name" value={building.name} onChange={(v) => edit((b) => void (b.name = v))} />
        <SelectInput
          label="Whose building"
          value={building.kind}
          options={[
            { value: 'own', label: 'Ours' },
            { value: 'neighbor', label: "Neighbor's" },
          ]}
          onChange={(v) => edit((b) => void (b.kind = v as Building['kind']))}
        />
        <LengthInput
          label="Wall height (ground to eave)"
          value={building.wallHeight}
          units={units}
          min={ft(1)}
          onChange={(v) => edit((b) => void (b.wallHeight = v))}
        />
        <LengthInput
          label="Base elevation"
          value={building.baseElevation}
          units={units}
          help="Positive if this building sits on higher ground than ours"
          onChange={(v) => edit((b) => void (b.baseElevation = v))}
        />
        <SelectInput
          label="Roof"
          value={building.roof.type}
          options={[
            { value: 'gable', label: 'Gable' },
            { value: 'hip', label: 'Hip' },
            { value: 'flat', label: 'Flat' },
          ]}
          onChange={(v) => edit((b) => void (b.roof.type = v as Building['roof']['type']))}
        />
        {building.roof.type !== 'flat' && (
          <>
            <NumberInput
              label="Roof pitch (rise over run)"
              value={building.roof.pitch}
              min={0.05}
              max={2}
              step={0.05}
              onChange={(v) => edit((b) => void (b.roof.pitch = v))}
            />
            <SelectInput
              label="Ridge runs along"
              value={String(building.roof.ridgeAxis)}
              options={[
                { value: '0', label: 'East–west (X)' },
                { value: '1', label: 'North–south (Z)' },
              ]}
              onChange={(v) => edit((b) => void (b.roof.ridgeAxis = Number(v) as 0 | 1))}
            />
          </>
        )}
        <ColorInput label="Colour" value={building.color} onChange={(v) => edit((b) => void (b.color = v))} />

        <p className="readout">
          Ridge height: <strong>{formatLength(ridgeY, units)}</strong> above grade
        </p>

        <PolygonEditor
          label="Footprint"
          points={building.footprint}
          units={units}
          onChange={(points) => edit((b) => void (b.footprint = points))}
        />

        <h3 className="panel__section">Windows</h3>
        <button
          className="btn btn--wide"
          onClick={() => {
            const id = uid('win')
            edit((b) => {
              // Default onto the wall facing the yard where possible, then let
              // the user adjust — quicker than hit-testing a click on a wall.
              b.windows.push({
                id,
                name: `Window ${b.windows.length + 1}`,
                wallIndex: 0,
                offsetAlongWall: ft(3),
                sillHeight: ft(3),
                width: ft(4),
                height: ft(4),
                isViewpoint: true,
              })
            })
            useSceneStore.getState().select({ type: 'window', id, parentId: building.id })
          }}
        >
          Add a window to this building
        </button>
        <ul className="list">
          {building.windows.map((w) => (
            <li key={w.id}>
              <button
                className="list__item"
                onClick={() =>
                  useSceneStore.getState().select({ type: 'window', id: w.id, parentId: building.id })
                }
              >
                {w.name}
                <span className="muted">
                  sill {formatLength(w.sillHeight, units)}
                  {w.isViewpoint ? ' · viewpoint' : ''}
                </span>
              </button>
            </li>
          ))}
          {building.windows.length === 0 && <li className="muted">No windows yet.</li>}
        </ul>
      </div>
    )
  }

  if (selection.type === 'window') {
    const building = scene.buildings.find((b) => b.id === selection.parentId)
    const win = building?.windows.find((w) => w.id === selection.id)
    if (!building || !win) return null
    const wallCount = edges(building.footprint).length
    const edit = (fn: (w: NonNullable<typeof win>) => void) =>
      update((d) => {
        const b = d.buildings.find((x) => x.id === building.id)
        const target = b?.windows.find((x) => x.id === win.id)
        if (target) fn(target)
      })

    return (
      <div className="panel">
        <header className="panel__header">
          <h2>{win.name}</h2>
          <button className="btn btn--danger" onClick={removeSelected}>
            Delete
          </button>
        </header>
        <p className="muted">On {building.name}</p>

        <TextInput label="Name" value={win.name} onChange={(v) => edit((w) => void (w.name = v))} />
        <SelectInput
          label="Wall"
          value={String(win.wallIndex)}
          options={Array.from({ length: wallCount }, (_, i) => ({
            value: String(i),
            label: `Wall ${i + 1}`,
          }))}
          onChange={(v) => edit((w) => void (w.wallIndex = Number(v)))}
        />
        <LengthInput
          label="Along the wall"
          value={win.offsetAlongWall}
          units={units}
          min={0}
          help="Measured from the start corner of that wall"
          onChange={(v) => edit((w) => void (w.offsetAlongWall = v))}
        />
        <LengthInput
          label="Sill height"
          value={win.sillHeight}
          units={units}
          min={0}
          onChange={(v) => edit((w) => void (w.sillHeight = v))}
        />
        <LengthInput
          label="Width"
          value={win.width}
          units={units}
          min={0.1}
          onChange={(v) => edit((w) => void (w.width = v))}
        />
        <LengthInput
          label="Height"
          value={win.height}
          units={units}
          min={0.1}
          onChange={(v) => edit((w) => void (w.height = v))}
        />
        <ToggleInput
          label="Use as a viewpoint"
          value={win.isViewpoint}
          help="Adds this window to the camera list and the privacy report"
          onChange={(v) => edit((w) => void (w.isViewpoint = v))}
        />
      </div>
    )
  }

  if (selection.type === 'surface') {
    const surface = scene.surfaces.find((s) => s.id === selection.id)
    if (!surface) return null
    const edit = (fn: (s: NonNullable<typeof surface>) => void) =>
      update((d) => {
        const target = d.surfaces.find((s) => s.id === selection.id)
        if (target) fn(target)
      })

    return (
      <div className="panel">
        <header className="panel__header">
          <h2>{surface.name}</h2>
          <button className="btn btn--danger" onClick={removeSelected}>
            Delete
          </button>
        </header>

        <TextInput label="Name" value={surface.name} onChange={(v) => edit((s) => void (s.name = v))} />
        <SelectInput
          label="Material"
          value={surface.material}
          options={Object.entries(MATERIAL_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(v) => edit((s) => void (s.material = v as SurfaceMaterial))}
        />
        <LengthInput
          label="Elevation"
          value={surface.elevation}
          units={units}
          help="Raise this for a deck or a raised patio"
          onChange={(v) => edit((s) => void (s.elevation = v))}
        />
        <LengthInput
          label="Depth of material"
          value={surface.thickness}
          units={units}
          min={0}
          help="Used to work out how much to order"
          onChange={(v) => edit((s) => void (s.thickness = v))}
        />
        <p className="readout">
          Area: <strong>{formatArea(area(surface.polygon), units)}</strong>
        </p>
        <PolygonEditor
          label="Outline"
          points={surface.polygon}
          units={units}
          onChange={(points) => edit((s) => void (s.polygon = points))}
        />
      </div>
    )
  }

  if (selection.type === 'viewpoint') {
    const vp = scene.viewpoints.find((v) => v.id === selection.id)
    if (!vp) return null
    const edit = (fn: (v: NonNullable<typeof vp>) => void) =>
      update((d) => {
        const target = d.viewpoints.find((v) => v.id === selection.id)
        if (target) fn(target)
      })

    return (
      <div className="panel">
        <header className="panel__header">
          <h2>{vp.name}</h2>
          <button className="btn btn--danger" onClick={removeSelected}>
            Delete
          </button>
        </header>
        <TextInput label="Name" value={vp.name} onChange={(v) => edit((x) => void (x.name = v))} />
        <LengthInput
          label="Eye height"
          value={vp.eyeHeight}
          units={units}
          min={0.3}
          help="About 5ft 6in seated, 5ft 9in standing"
          onChange={(v) => edit((x) => void (x.eyeHeight = v))}
        />
        <NumberInput
          label="Facing (degrees)"
          value={Math.round(vp.headingDeg)}
          min={0}
          max={359}
          step={5}
          help="0 looks north (−Z), 180 looks south"
          onChange={(v) => edit((x) => void (x.headingDeg = v))}
        />
        <LengthInput
          label="Position east–west"
          value={vp.position.x}
          units={units}
          onChange={(v) => edit((x) => void (x.position.x = v))}
        />
        <LengthInput
          label="Position north–south"
          value={vp.position.z}
          units={units}
          onChange={(v) => edit((x) => void (x.position.z = v))}
        />
      </div>
    )
  }

  if (selection.type === 'object') {
    const object = scene.objects.find((o) => o.id === selection.id)
    if (!object) return null
    const def = getObjectDef(object.kind)
    if (!def) return null
    const params = resolveParams(def, object.params)

    const editParam = (key: string, value: unknown) =>
      update(
        (d) => {
          const target = d.objects.find((o) => o.id === selection.id)
          if (target) target.params = { ...target.params, [key]: value }
        },
        { coalesce: `param:${selection.id}:${key}` },
      )
    const editObject = (fn: (o: NonNullable<typeof object>) => void) =>
      update((d) => {
        const target = d.objects.find((o) => o.id === selection.id)
        if (target) fn(target)
      })

    return (
      <div className="panel">
        <header className="panel__header">
          <h2>{object.name}</h2>
          <button className="btn btn--danger" onClick={removeSelected}>
            Delete
          </button>
        </header>
        <p className="muted">{def.blurb}</p>

        <TextInput label="Name" value={object.name} onChange={(v) => editObject((o) => void (o.name = v))} />

        <h3 className="panel__section">Placement</h3>
        <LengthInput
          label="Position east–west"
          value={object.position.x}
          units={units}
          onChange={(v) => editObject((o) => void (o.position.x = v))}
        />
        <LengthInput
          label="Position north–south"
          value={object.position.z}
          units={units}
          onChange={(v) => editObject((o) => void (o.position.z = v))}
        />
        <NumberInput
          label="Rotation (degrees)"
          value={Math.round(object.rotationDeg)}
          min={0}
          max={359}
          step={5}
          onChange={(v) => editObject((o) => void (o.rotationDeg = v))}
        />
        <LengthInput
          label="Raise above grade"
          value={object.elevation}
          units={units}
          onChange={(v) => editObject((o) => void (o.elevation = v))}
        />

        <h3 className="panel__section">{def.label}</h3>
        {def.controls.map((control) => (
          <ParamControl
            key={control.key}
            control={control}
            value={params[control.key]}
            units={units}
            onChange={(v) => editParam(control.key, v)}
          />
        ))}
      </div>
    )
  }

  if (selection.type === 'lot') {
    return (
      <div className="panel">
        <header className="panel__header">
          <h2>Yard boundary</h2>
        </header>
        <p className="readout">
          Area: <strong>{formatArea(area(scene.lot), units)}</strong>
        </p>
        <PolygonEditor
          label="Outline"
          points={scene.lot}
          units={units}
          onChange={(points) => update((d) => void (d.lot = points))}
        />
      </div>
    )
  }

  return null
}

function ParamControl({
  control,
  value,
  units,
  onChange,
}: {
  control: ControlSpec
  value: unknown
  units: Scene['units']
  onChange: (value: unknown) => void
}) {
  switch (control.type) {
    case 'length':
      return (
        <LengthInput
          label={control.label}
          value={typeof value === 'number' ? value : 0}
          units={units}
          min={control.min}
          help={control.help}
          onChange={onChange}
        />
      )
    case 'number':
      return (
        <NumberInput
          label={control.label}
          value={typeof value === 'number' ? value : 0}
          min={control.min}
          max={control.max}
          step={control.step}
          help={control.help}
          onChange={onChange}
        />
      )
    case 'enum':
      return (
        <SelectInput
          label={control.label}
          value={String(value ?? control.options[0]?.value ?? '')}
          options={control.options}
          help={control.help}
          onChange={onChange}
        />
      )
    case 'boolean':
      return (
        <ToggleInput
          label={control.label}
          value={Boolean(value)}
          help={control.help}
          onChange={onChange}
        />
      )
    case 'color':
      return <ColorInput label={control.label} value={String(value ?? '#ffffff')} onChange={onChange} />
  }
}

/**
 * Per-edge dimension entry. Typing a length on a side moves that side's far
 * corner along the edge, which is how you square up a yard measured with a
 * tape rather than drawn to scale.
 */
function PolygonEditor({
  label,
  points,
  units,
  onChange,
}: {
  label: string
  points: Vec2[]
  units: Scene['units']
  onChange: (points: Vec2[]) => void
}) {
  const list = edges(points)
  if (list.length === 0) return null
  return (
    <>
      <h3 className="panel__section">{label}</h3>
      <p className="muted">Type a length to move that side&rsquo;s far corner.</p>
      {list.map((edge) => (
        <LengthInput
          key={edge.index}
          label={`Side ${edge.index + 1}`}
          value={edge.length}
          units={units}
          min={0.1}
          onChange={(v) => onChange(setEdgeLength(points, edge.index, v))}
        />
      ))}
    </>
  )
}
