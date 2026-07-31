import { useEffect } from 'react'
import { Viewport } from './render/Viewport'
import { useCommitDraft } from './render/Interaction'
import { Toolbar } from './editor/Toolbar'
import { Palette } from './editor/Palette'
import { Inspector } from './editor/Inspector'
import { PrivacyPanel } from './analysis/PrivacyPanel'
import { TakeoffPanel } from './analysis/TakeoffPanel'
import { useSceneStore } from './store/sceneStore'
import { useUIStore } from './store/uiStore'
import { formatLengthShort } from './units'
import { distance } from './geometry/polygon'

/**
 * App shell: palette on the left, 3D view in the middle, inspector and
 * analysis on the right.
 */
export default function App() {
  const mode = useUIStore((s) => s.mode)
  const tool = useUIStore((s) => s.tool)
  const draftPoints = useUIStore((s) => s.draftPoints)
  const cancelTool = useUIStore((s) => s.cancelTool)
  const popDraftPoint = useUIStore((s) => s.popDraftPoint)
  const clearDraft = useUIStore((s) => s.clearDraft)
  const statusMessage = useUIStore((s) => s.statusMessage)
  const units = useSceneStore((s) => s.scene.units)
  const undo = useSceneStore((s) => s.undo)
  const redo = useSceneStore((s) => s.redo)
  const removeSelected = useSceneStore((s) => s.removeSelected)
  const commitDraft = useCommitDraft()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // Never steal keys while the user is typing a dimension.
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (e.key === 'Escape') {
        cancelTool()
      } else if (e.key === 'Enter') {
        commitDraft()
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && draftPoints.length > 0) {
        e.preventDefault()
        popDraftPoint()
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        removeSelected()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelTool, commitDraft, draftPoints.length, popDraftPoint, redo, removeSelected, undo])

  const drafting = tool.kind === 'draw-lot' || tool.kind === 'draw-surface'
  const measuring = tool.kind === 'measure'
  const measuredTotal = draftPoints.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + distance(draftPoints[i - 1], p)),
    0,
  )

  return (
    <div className="app">
      <Toolbar />

      <div className="app__body">
        <aside className="app__left">
          <Palette />
        </aside>

        <main className="app__view">
          <Viewport />

          {(drafting || measuring) && (
            <div className="hint">
              {measuring ? (
                <>
                  <strong>
                    {draftPoints.length < 2
                      ? 'Click two points to measure.'
                      : formatLengthShort(measuredTotal, units)}
                  </strong>
                  <span>Click to add points · Esc to finish</span>
                  {draftPoints.length > 0 && (
                    <button className="btn btn--small" onClick={clearDraft}>
                      Clear
                    </button>
                  )}
                </>
              ) : (
                <>
                  <strong>
                    {draftPoints.length < 3
                      ? `Click the corners (${draftPoints.length} so far)`
                      : `${draftPoints.length} corners`}
                  </strong>
                  <span>Enter to finish · Backspace to undo a point · Esc to cancel</span>
                  <button className="btn btn--small" onClick={commitDraft}>
                    Finish shape
                  </button>
                </>
              )}
            </div>
          )}

          {tool.kind === 'place-object' && (
            <div className="hint">
              <strong>Click in the yard to place it</strong>
              <span>Esc to cancel</span>
            </div>
          )}

          {tool.kind === 'place-building' && (
            <div className="hint">
              <strong>Click where the middle of the building goes</strong>
              <span>You can set its size and windows afterwards · Esc to cancel</span>
            </div>
          )}

          {tool.kind === 'place-viewpoint' && (
            <div className="hint">
              <strong>Click where you will be standing</strong>
              <span>Esc to cancel</span>
            </div>
          )}

          {statusMessage && <div className="hint hint--warn">{statusMessage}</div>}
        </main>

        <aside className="app__right">
          {mode === 'analyze' ? (
            <>
              <PrivacyPanel />
              <TakeoffPanel />
              <Inspector />
            </>
          ) : (
            <Inspector />
          )}
        </aside>
      </div>
    </div>
  )
}
