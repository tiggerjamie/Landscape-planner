import { MATERIAL_COLORS, MATERIAL_LABELS } from '../analysis/takeoff'
import type { SurfaceMaterial } from '../model/types'
import { objectDefsByCategory } from '../objects/registry'
import { useSceneStore } from '../store/sceneStore'
import { useUIStore } from '../store/uiStore'

/**
 * What you can add to the scene. Object entries come straight from the
 * registry, so registering a new kind puts it in the palette automatically.
 */
export function Palette() {
  const mode = useUIStore((s) => s.mode)
  const tool = useUIStore((s) => s.tool)
  const setTool = useUIStore((s) => s.setTool)
  const scene = useSceneStore((s) => s.scene)

  if (mode === 'site') {
    return (
      <div className="palette">
        <h2 className="palette__title">Site</h2>
        <p className="muted">Set out the yard and the buildings around it.</p>

        <button
          className={`palette__item ${tool.kind === 'draw-lot' ? 'is-active' : ''}`}
          onClick={() => setTool({ kind: 'draw-lot' })}
        >
          <strong>Redraw the yard boundary</strong>
          <span>Click each corner, then press Enter</span>
        </button>

        <button
          className={`palette__item ${
            tool.kind === 'place-building' && tool.buildingKind === 'own' ? 'is-active' : ''
          }`}
          onClick={() => setTool({ kind: 'place-building', buildingKind: 'own' })}
        >
          <strong>Add our building</strong>
          <span>House, garage or extension</span>
        </button>

        <button
          className={`palette__item ${
            tool.kind === 'place-building' && tool.buildingKind === 'neighbor' ? 'is-active' : ''
          }`}
          onClick={() => setTool({ kind: 'place-building', buildingKind: 'neighbor' })}
        >
          <strong>Add a neighbour&rsquo;s building</strong>
          <span>Whatever overlooks the yard</span>
        </button>

        <h3 className="palette__heading">Buildings in this plan</h3>
        <ul className="list">
          {scene.buildings.map((b) => (
            <li key={b.id}>
              <button
                className="list__item"
                onClick={() => useSceneStore.getState().select({ type: 'building', id: b.id })}
              >
                {b.name}
                <span className="muted">
                  {b.kind === 'own' ? 'Ours' : 'Neighbour'} · {b.windows.length} window
                  {b.windows.length === 1 ? '' : 's'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button
          className="list__item"
          onClick={() => useSceneStore.getState().select({ type: 'lot', id: 'lot' })}
        >
          Yard boundary
          <span className="muted">Edit side lengths</span>
        </button>
      </div>
    )
  }

  if (mode === 'analyze') {
    return (
      <div className="palette">
        <h2 className="palette__title">Analyse</h2>
        <p className="muted">
          Add a standing point anywhere you will actually sit or stand, then check what it can see.
        </p>
        <button
          className={`palette__item ${tool.kind === 'place-viewpoint' ? 'is-active' : ''}`}
          onClick={() => setTool({ kind: 'place-viewpoint' })}
        >
          <strong>Add a standing point</strong>
          <span>Click where you will be standing</span>
        </button>
        <button
          className={`palette__item ${tool.kind === 'measure' ? 'is-active' : ''}`}
          onClick={() => setTool({ kind: 'measure' })}
        >
          <strong>Measure</strong>
          <span>Click two or more points</span>
        </button>
      </div>
    )
  }

  // Design mode: ground materials and the object library.
  return (
    <div className="palette">
      <h2 className="palette__title">Ground</h2>
      <div className="palette__swatches">
        {(Object.keys(MATERIAL_LABELS) as SurfaceMaterial[]).map((material) => (
          <button
            key={material}
            className={`swatch ${
              tool.kind === 'draw-surface' && tool.material === material ? 'is-active' : ''
            }`}
            onClick={() => setTool({ kind: 'draw-surface', material })}
            title={`Draw a ${MATERIAL_LABELS[material].toLowerCase()} area`}
          >
            <span className="swatch__chip" style={{ background: MATERIAL_COLORS[material] }} />
            {MATERIAL_LABELS[material]}
          </button>
        ))}
      </div>

      {objectDefsByCategory().map((group) => (
        <div key={group.category}>
          <h3 className="palette__heading">{group.label}</h3>
          {group.defs.map((def) => (
            <button
              key={def.kind}
              className={`palette__item ${
                tool.kind === 'place-object' && tool.objectKind === def.kind ? 'is-active' : ''
              }`}
              onClick={() => setTool({ kind: 'place-object', objectKind: def.kind })}
            >
              <strong>{def.label}</strong>
              <span>{def.blurb}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
