import { deserializeScene, serializeScene } from '../model/serialize'
import type { Scene } from '../model/types'

/**
 * Save and load layouts as files. localStorage is the working copy; a file is
 * how a layout gets backed up, emailed to a contractor, or moved to another
 * device.
 */

const safeFilename = (name: string): string =>
  name.trim().replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').toLowerCase() || 'layout'

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportSceneFile(scene: Scene): void {
  download(
    new Blob([serializeScene(scene)], { type: 'application/json' }),
    `${safeFilename(scene.name)}.landscape.json`,
  )
}

/** Prompt for a file and parse it. Resolves null if the user cancels. */
export function importSceneFile(): Promise<{ scene: Scene | null; error: string | null }> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve({ scene: null, error: null })
        return
      }
      try {
        resolve(deserializeScene(await file.text()))
      } catch {
        resolve({ scene: null, error: 'That file could not be read.' })
      }
    }
    input.oncancel = () => resolve({ scene: null, error: null })
    input.click()
  })
}

/**
 * Save the current view as a PNG. Relies on the canvas being created with
 * preserveDrawingBuffer, which Viewport sets.
 */
export function exportViewImage(name: string): boolean {
  const canvas = document.querySelector('canvas')
  if (!(canvas instanceof HTMLCanvasElement)) return false
  const url = canvas.toDataURL('image/png')
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeFilename(name)}.png`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  return true
}
