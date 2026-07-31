import { useState } from 'react'
import { inch } from '../units'
import { useSceneStore } from '../store/sceneStore'
import { useUIStore, type EditorMode } from '../store/uiStore'
import { exportSceneFile, exportViewImage, importSceneFile } from '../io/layoutFiles'

const MODES: { id: EditorMode; label: string; hint: string }[] = [
  { id: 'site', label: 'Site', hint: 'Yard boundary, buildings and windows' },
  { id: 'design', label: 'Design', hint: 'Ground materials, planting and structures' },
  { id: 'analyze', label: 'Analyse', hint: 'Privacy, sightlines and materials' },
]

const SNAP_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1 in', value: inch(1) },
  { label: '6 in', value: inch(6) },
  { label: '1 ft', value: inch(12) },
]

export function Toolbar() {
  const scene = useSceneStore((s) => s.scene)
  const update = useSceneStore((s) => s.update)
  const undo = useSceneStore((s) => s.undo)
  const redo = useSceneStore((s) => s.redo)
  const canUndo = useSceneStore((s) => s.past.length > 0)
  const canRedo = useSceneStore((s) => s.future.length > 0)
  const setUnits = useSceneStore((s) => s.setUnits)
  const replaceScene = useSceneStore((s) => s.replaceScene)
  const newLayout = useSceneStore((s) => s.newLayout)
  const duplicateLayout = useSceneStore((s) => s.duplicateLayout)
  const openLayout = useSceneStore((s) => s.openLayout)
  const library = useSceneStore((s) => s.library)

  const mode = useUIStore((s) => s.mode)
  const setMode = useUIStore((s) => s.setMode)
  const planView = useUIStore((s) => s.planView)
  const togglePlanView = useUIStore((s) => s.togglePlanView)
  const showGrid = useUIStore((s) => s.showGrid)
  const toggleGrid = useUIStore((s) => s.toggleGrid)
  const showSightlines = useUIStore((s) => s.showSightlines)
  const toggleSightlines = useUIStore((s) => s.toggleSightlines)

  const [message, setMessage] = useState<string | null>(null)

  const handleImport = async () => {
    const { scene: loaded, error } = await importSceneFile()
    if (error) setMessage(error)
    else if (loaded) {
      replaceScene(loaded)
      setMessage(null)
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar__row">
        <input
          className="toolbar__name"
          value={scene.name}
          onChange={(e) => update((d) => void (d.name = e.target.value))}
          aria-label="Layout name"
        />

        <nav className="modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode ${mode === m.id ? 'is-active' : ''}`}
              title={m.hint}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>

        <div className="toolbar__spacer" />

        <button className="btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button className="btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
      </div>

      <div className="toolbar__row toolbar__row--secondary">
        <label className="inline-field">
          Units
          <select value={scene.units} onChange={(e) => setUnits(e.target.value as 'ft' | 'm')}>
            <option value="ft">Feet &amp; inches</option>
            <option value="m">Metres</option>
          </select>
        </label>

        <label className="inline-field">
          Snap
          <select
            value={scene.snapIncrement}
            onChange={(e) => update((d) => void (d.snapIncrement = Number(e.target.value)))}
          >
            {SNAP_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <button className={`btn ${planView ? 'is-active' : ''}`} onClick={togglePlanView}>
          Plan view
        </button>
        <button className={`btn ${showGrid ? 'is-active' : ''}`} onClick={toggleGrid}>
          Grid
        </button>
        <button className={`btn ${showSightlines ? 'is-active' : ''}`} onClick={toggleSightlines}>
          Sightlines
        </button>

        <div className="toolbar__spacer" />

        <label className="inline-field">
          Layout
          <select
            value={scene.id}
            onChange={(e) => {
              if (e.target.value !== scene.id) openLayout(e.target.value)
            }}
          >
            {library.some((l) => l.id === scene.id) ? null : (
              <option value={scene.id}>{scene.name} (unsaved)</option>
            )}
            {library.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <button className="btn" onClick={() => newLayout()}>
          New
        </button>
        <button className="btn" onClick={duplicateLayout} title="Compare a variation side by side">
          Duplicate
        </button>
        <button className="btn" onClick={() => exportSceneFile(scene)}>
          Save file
        </button>
        <button className="btn" onClick={handleImport}>
          Open file
        </button>
        <button
          className="btn"
          onClick={() => {
            if (!exportViewImage(scene.name)) setMessage('Could not capture the view.')
          }}
        >
          Export image
        </button>
      </div>

      {message && (
        <div className="toolbar__message" role="status">
          {message}
          <button className="btn btn--small" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      )}
    </header>
  )
}
