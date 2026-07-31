import { deserializeScene, serializeScene } from '../model/serialize'
import type { Scene } from '../model/types'

/**
 * Layouts live in localStorage so the tool works offline and on a phone in the
 * yard with no account or backend. Each layout is stored under its own key so
 * one corrupt entry cannot take the whole library down with it.
 */

const INDEX_KEY = 'landscape-planner/index'
const SCENE_PREFIX = 'landscape-planner/scene/'
const ACTIVE_KEY = 'landscape-planner/active'

export interface LayoutSummary {
  id: string
  name: string
  updatedAt: number
}

const storage = (): Storage | null => {
  try {
    // Absent in SSR and blocked in some private-browsing modes.
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readIndex(): LayoutSummary[] {
  const s = storage()
  if (!s) return []
  try {
    const raw = s.getItem(INDEX_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as LayoutSummary[]) : []
  } catch {
    return []
  }
}

function writeIndex(entries: LayoutSummary[]): void {
  storage()?.setItem(INDEX_KEY, JSON.stringify(entries))
}

export function saveScene(scene: Scene): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(SCENE_PREFIX + scene.id, serializeScene(scene))
    const index = readIndex().filter((e) => e.id !== scene.id)
    index.unshift({ id: scene.id, name: scene.name, updatedAt: Date.now() })
    writeIndex(index)
    s.setItem(ACTIVE_KEY, scene.id)
  } catch {
    // Quota exceeded or storage disabled — the in-memory scene is unaffected,
    // and the user can still export to a file.
  }
}

export function loadScene(id: string): Scene | null {
  const s = storage()
  if (!s) return null
  const raw = s.getItem(SCENE_PREFIX + id)
  if (!raw) return null
  return deserializeScene(raw).scene
}

export function deleteScene(id: string): void {
  const s = storage()
  if (!s) return
  s.removeItem(SCENE_PREFIX + id)
  writeIndex(readIndex().filter((e) => e.id !== id))
}

export function loadActiveScene(): Scene | null {
  const s = storage()
  if (!s) return null
  const activeId = s.getItem(ACTIVE_KEY)
  if (activeId) {
    const scene = loadScene(activeId)
    if (scene) return scene
  }
  const [first] = readIndex()
  return first ? loadScene(first.id) : null
}

export function setActiveScene(id: string): void {
  storage()?.setItem(ACTIVE_KEY, id)
}
