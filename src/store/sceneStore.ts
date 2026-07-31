import { create } from 'zustand'
import { createDefaultScene } from '../model/defaults'
import { uid, type Building, type Scene, type SceneObject, type Surface, type Viewpoint } from '../model/types'
import type { Units } from '../units'
import { loadActiveScene, readIndex, saveScene, type LayoutSummary } from './persistence'

/**
 * One scene is the whole document. Every mutation goes through `update`, which
 * snapshots the previous scene for undo — layouts represent real design work,
 * and a mis-drag must always be recoverable.
 */

const HISTORY_LIMIT = 50

export type SelectionType = 'building' | 'window' | 'surface' | 'object' | 'viewpoint' | 'lot'

export interface Selection {
  type: SelectionType
  id: string
  /** For windows, the building they belong to. */
  parentId?: string
}

interface UpdateOptions {
  /**
   * Merge into the previous history entry instead of pushing a new one. Used
   * for continuous gestures so a single drag is one undo step, not hundreds.
   */
  coalesce?: string
}

interface SceneState {
  scene: Scene
  past: Scene[]
  future: Scene[]
  /** Key of the last coalesced edit, so a drag collapses to one history entry. */
  lastCoalesceKey: string | null
  selection: Selection | null
  library: LayoutSummary[]

  update: (recipe: (draft: Scene) => void, options?: UpdateOptions) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  select: (selection: Selection | null) => void
  setUnits: (units: Units) => void
  replaceScene: (scene: Scene) => void
  newLayout: (name?: string) => void
  duplicateLayout: () => void
  openLayout: (id: string) => void
  refreshLibrary: () => void

  addBuilding: (building: Building) => void
  addSurface: (surface: Surface) => void
  addObject: (object: SceneObject) => void
  addViewpoint: (viewpoint: Viewpoint) => void
  removeSelected: () => void
}

const clone = (scene: Scene): Scene =>
  typeof structuredClone === 'function'
    ? structuredClone(scene)
    : (JSON.parse(JSON.stringify(scene)) as Scene)

/** Debounced write-through so dragging does not hammer localStorage. */
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(scene: Scene): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveScene(scene)
    useSceneStore.getState().refreshLibrary()
  }, 400)
}

export const useSceneStore = create<SceneState>((set, get) => ({
  scene: loadActiveScene() ?? createDefaultScene(),
  past: [],
  future: [],
  lastCoalesceKey: null,
  selection: null,
  library: readIndex(),

  update: (recipe, options) => {
    const { scene, past, lastCoalesceKey } = get()
    const draft = clone(scene)
    recipe(draft)

    const coalescing = options?.coalesce !== undefined && options.coalesce === lastCoalesceKey
    const nextPast = coalescing ? past : [...past, scene].slice(-HISTORY_LIMIT)

    set({
      scene: draft,
      past: nextPast,
      future: [],
      lastCoalesceKey: options?.coalesce ?? null,
    })
    scheduleSave(draft)
  },

  undo: () => {
    const { past, future, scene } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    set({
      scene: previous,
      past: past.slice(0, -1),
      future: [scene, ...future].slice(0, HISTORY_LIMIT),
      lastCoalesceKey: null,
      selection: null,
    })
    scheduleSave(previous)
  },

  redo: () => {
    const { past, future, scene } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      scene: next,
      past: [...past, scene].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      lastCoalesceKey: null,
      selection: null,
    })
    scheduleSave(next)
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  select: (selection) => set({ selection }),

  setUnits: (units) => get().update((d) => void (d.units = units)),

  replaceScene: (scene) => {
    set({ scene, past: [], future: [], selection: null, lastCoalesceKey: null })
    saveScene(scene)
    get().refreshLibrary()
  },

  newLayout: (name) => {
    get().replaceScene(createDefaultScene(name ?? 'New Layout'))
  },

  duplicateLayout: () => {
    const copy = clone(get().scene)
    copy.id = uid('scene')
    copy.name = `${copy.name} (copy)`
    get().replaceScene(copy)
  },

  openLayout: (id) => {
    // Imported lazily to avoid a cycle through persistence at module load.
    import('./persistence').then(({ loadScene }) => {
      const scene = loadScene(id)
      if (scene) get().replaceScene(scene)
    })
  },

  refreshLibrary: () => set({ library: readIndex() }),

  addBuilding: (building) => {
    get().update((d) => void d.buildings.push(building))
    get().select({ type: 'building', id: building.id })
  },

  addSurface: (surface) => {
    get().update((d) => void d.surfaces.push(surface))
    get().select({ type: 'surface', id: surface.id })
  },

  addObject: (object) => {
    get().update((d) => void d.objects.push(object))
    get().select({ type: 'object', id: object.id })
  },

  addViewpoint: (viewpoint) => {
    get().update((d) => void d.viewpoints.push(viewpoint))
    get().select({ type: 'viewpoint', id: viewpoint.id })
  },

  removeSelected: () => {
    const selection = get().selection
    if (!selection) return
    get().update((d) => {
      switch (selection.type) {
        case 'building':
          d.buildings = d.buildings.filter((b) => b.id !== selection.id)
          break
        case 'window': {
          const building = d.buildings.find((b) => b.id === selection.parentId)
          if (building) building.windows = building.windows.filter((w) => w.id !== selection.id)
          break
        }
        case 'surface':
          d.surfaces = d.surfaces.filter((s) => s.id !== selection.id)
          break
        case 'object':
          d.objects = d.objects.filter((o) => o.id !== selection.id)
          break
        case 'viewpoint':
          d.viewpoints = d.viewpoints.filter((v) => v.id !== selection.id)
          break
        case 'lot':
          break // the lot is intrinsic to the scene and cannot be deleted
      }
    })
    get().select(null)
  },
}))

/** Read the selected entity out of a scene, whatever kind it is. */
export function selectedEntity(scene: Scene, selection: Selection | null) {
  if (!selection) return null
  switch (selection.type) {
    case 'building':
      return scene.buildings.find((b) => b.id === selection.id) ?? null
    case 'window': {
      const building = scene.buildings.find((b) => b.id === selection.parentId)
      return building?.windows.find((w) => w.id === selection.id) ?? null
    }
    case 'surface':
      return scene.surfaces.find((s) => s.id === selection.id) ?? null
    case 'object':
      return scene.objects.find((o) => o.id === selection.id) ?? null
    case 'viewpoint':
      return scene.viewpoints.find((v) => v.id === selection.id) ?? null
    case 'lot':
      return scene.lot
  }
}
