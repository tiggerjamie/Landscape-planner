import { SCENE_VERSION, type Scene } from './types'
import { createDefaultScene } from './defaults'

/**
 * Versioned save/load. Layouts are the user's real design work, so a schema
 * change must never silently discard one — unknown-but-newer files are
 * rejected loudly, older ones are migrated forward.
 */

export interface LoadResult {
  scene: Scene | null
  error: string | null
}

export function serializeScene(scene: Scene): string {
  return JSON.stringify({ ...scene, version: SCENE_VERSION }, null, 2)
}

/** Apply migrations in order until the scene is at the current version. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const next = { ...raw }
  // No migrations yet — v1 is the first schema. Each future bump adds a step:
  //   if (next.version === 1) { ...transform...; next.version = 2 }
  return next
}

const isArray = (v: unknown): v is unknown[] => Array.isArray(v)

/**
 * Fill in fields absent from older or hand-edited files, so a partial but
 * well-formed layout still opens instead of crashing the renderer.
 */
function withDefaults(raw: Record<string, unknown>): Scene {
  const base = createDefaultScene()
  const merged: Scene = {
    ...base,
    ...(raw as Partial<Scene>),
    version: SCENE_VERSION,
    lot: isArray(raw.lot) ? (raw.lot as Scene['lot']) : base.lot,
    buildings: isArray(raw.buildings) ? (raw.buildings as Scene['buildings']) : [],
    surfaces: isArray(raw.surfaces) ? (raw.surfaces as Scene['surfaces']) : [],
    objects: isArray(raw.objects) ? (raw.objects as Scene['objects']) : [],
    viewpoints: isArray(raw.viewpoints) ? (raw.viewpoints as Scene['viewpoints']) : [],
    sun: (raw.sun as Scene['sun']) ?? base.sun,
    season: raw.season === 'winter' ? 'winter' : 'summer',
    units: raw.units === 'm' ? 'm' : 'ft',
  }
  // Buildings written by hand may omit the windows array entirely.
  merged.buildings = merged.buildings.map((b) => ({
    ...b,
    windows: isArray(b?.windows) ? b.windows : [],
    footprint: isArray(b?.footprint) ? b.footprint : [],
  }))
  return merged
}

export function deserializeScene(text: string): LoadResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { scene: null, error: 'That file is not valid JSON.' }
  }
  // Arrays are objects too, so exclude them explicitly — otherwise an
  // unrelated JSON array would be filled with defaults and open as a layout.
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { scene: null, error: 'That file does not contain a layout.' }
  }

  const record = raw as Record<string, unknown>
  const version = typeof record.version === 'number' ? record.version : 0
  if (version > SCENE_VERSION) {
    return {
      scene: null,
      error: `This layout was saved by a newer version of the planner (v${version}). Update the app to open it.`,
    }
  }

  try {
    return { scene: withDefaults(migrate(record)), error: null }
  } catch {
    return { scene: null, error: 'That layout could not be read.' }
  }
}
