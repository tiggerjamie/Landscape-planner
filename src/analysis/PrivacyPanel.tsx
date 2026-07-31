import { useMemo } from 'react'
import { formatLength } from '../units'
import { useSceneStore } from '../store/sceneStore'
import { useUIStore } from '../store/uiStore'
import {
  EXPOSURE_COLORS,
  EXPOSURE_LABELS,
  analyzePrivacy,
  collectViewpoints,
  describeBlocker,
} from './sightlines'

/**
 * The answer to "can they see in?". Lists every sightline that crosses between
 * our property and a neighbour's, with what is screening it, and lets you jump
 * the camera to any viewpoint to see it for yourself.
 */
export function PrivacyPanel() {
  const scene = useSceneStore((s) => s.scene)
  const update = useSceneStore((s) => s.update)
  const activeViewpointId = useUIStore((s) => s.activeViewpointId)
  const setActiveViewpoint = useUIStore((s) => s.setActiveViewpoint)

  const report = useMemo(() => analyzePrivacy(scene), [scene])
  const viewpoints = useMemo(() => collectViewpoints(scene), [scene])

  const sorted = useMemo(
    () =>
      [...report.crossProperty].sort((a, b) => {
        const rank = { exposed: 0, partial: 1, blocked: 2 }
        return rank[a.exposure] - rank[b.exposure] || a.distance - b.distance
      }),
    [report.crossProperty],
  )

  return (
    <div className="panel">
      <header className="panel__header">
        <h2>Privacy</h2>
      </header>

      <div className="summary">
        <Stat label="Full view" count={report.exposedCount} color={EXPOSURE_COLORS.exposed} />
        <Stat label="Partly screened" count={report.partialCount} color={EXPOSURE_COLORS.partial} />
        <Stat label="Screened" count={report.blockedCount} color={EXPOSURE_COLORS.blocked} />
      </div>

      <label className="field field--inline">
        <input
          type="checkbox"
          checked={scene.season === 'winter'}
          onChange={(e) => update((d) => void (d.season = e.target.checked ? 'winter' : 'summer'))}
        />
        <span className="field__label">
          Winter view
          <em className="field__help">Deciduous trees and shrubs stop screening</em>
        </span>
      </label>

      <h3 className="panel__section">Look from</h3>
      <div className="viewpoint-list">
        <button
          className={`btn btn--wide ${activeViewpointId === null ? 'is-active' : ''}`}
          onClick={() => setActiveViewpoint(null)}
        >
          Free orbit
        </button>
        {viewpoints.map((v) => (
          <button
            key={v.id}
            className={`btn btn--wide ${activeViewpointId === v.id ? 'is-active' : ''}`}
            onClick={() => setActiveViewpoint(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <h3 className="panel__section">Sightlines across the boundary</h3>
      {sorted.length === 0 && (
        <p className="muted">
          No sightlines to check yet. Add windows to both your building and a neighbour&rsquo;s, and
          mark them as viewpoints.
        </p>
      )}
      <ul className="sightline-list">
        {sorted.map((r) => {
          const blocker = describeBlocker(scene, r.blockerId)
          return (
            <li key={`${r.fromId}:${r.toId}`} className="sightline">
              <button className="sightline__jump" onClick={() => setActiveViewpoint(r.fromId)}>
                <span className="sightline__dot" style={{ background: EXPOSURE_COLORS[r.exposure] }} />
                <span className="sightline__text">
                  <strong>{r.fromLabel}</strong>
                  <span className="muted">sees {r.toLabel}</span>
                  <span className="sightline__verdict" style={{ color: EXPOSURE_COLORS[r.exposure] }}>
                    {EXPOSURE_LABELS[r.exposure]}
                    {r.exposure === 'partial' && ` (${r.visibleSamples} of ${r.sampleCount} points)`}
                  </span>
                  <span className="muted">
                    {formatLength(r.distance, scene.units)} away
                    {blocker ? ` · screened by ${blocker}` : ''}
                    {!r.inFieldOfView ? ' · behind the viewer' : ''}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Stat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="stat">
      <span className="stat__count" style={{ color }}>
        {count}
      </span>
      <span className="stat__label">{label}</span>
    </div>
  )
}
