import { useMemo } from 'react'
import { formatArea, formatLength, formatVolume } from '../units'
import { useSceneStore } from '../store/sceneStore'
import { computeTakeoff, lotPerimeter } from './takeoff'

/**
 * The shopping list. Quantities are per material so they can be read straight
 * down the phone to a supplier.
 */
export function TakeoffPanel() {
  const scene = useSceneStore((s) => s.scene)
  const takeoff = useMemo(() => computeTakeoff(scene), [scene])
  const units = scene.units

  return (
    <div className="panel">
      <header className="panel__header">
        <h2>Materials</h2>
      </header>

      <p className="readout">
        Yard area: <strong>{formatArea(takeoff.lotArea, units)}</strong>
        <br />
        Boundary length: <strong>{formatLength(lotPerimeter(scene), units)}</strong>
      </p>

      <h3 className="panel__section">Ground materials</h3>
      {takeoff.materials.length === 0 ? (
        <p className="muted">
          Nothing drawn yet. Use the ground swatches in Design to lay out patios, paths and beds.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Area</th>
              <th>Order</th>
            </tr>
          </thead>
          <tbody>
            {takeoff.materials.map((m) => (
              <tr key={m.material}>
                <td>
                  {m.label}
                  {m.surfaceCount > 1 && <span className="muted"> ×{m.surfaceCount}</span>}
                </td>
                <td>{formatArea(m.area, units)}</td>
                <td>{m.isBulk ? formatVolume(m.volume, units) : '—'}</td>
              </tr>
            ))}
            <tr className="table__total">
              <td>Uncovered</td>
              <td>{formatArea(takeoff.uncoveredArea, units)}</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      )}

      <h3 className="panel__section">Items</h3>
      {takeoff.objects.length === 0 ? (
        <p className="muted">Nothing placed yet.</p>
      ) : (
        <table className="table">
          <tbody>
            {takeoff.objects.map((o) => (
              <tr key={o.kind}>
                <td>{o.label}</td>
                <td>{o.count}</td>
              </tr>
            ))}
            {takeoff.linearBoundary > 0 && (
              <tr className="table__total">
                <td>Fence &amp; wall run</td>
                <td>{formatLength(takeoff.linearBoundary, units)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <p className="muted">
        Overlapping surfaces are counted separately &mdash; a deck built over gravel is two real
        purchases. Add your own waste allowance before ordering.
      </p>
    </div>
  )
}
