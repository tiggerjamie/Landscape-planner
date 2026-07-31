import { create } from 'zustand'

/**
 * Transient editor state — which tab is open, which tool is armed, which
 * viewpoint the camera is riding. Deliberately kept out of the scene store so
 * that undo never rewinds the UI, only the design.
 */

export type EditorMode = 'site' | 'design' | 'analyze'

export type Tool =
  | { kind: 'select' }
  | { kind: 'draw-lot' }
  | { kind: 'draw-surface'; material: string }
  | { kind: 'place-building'; buildingKind: 'own' | 'neighbor' }
  | { kind: 'place-window'; buildingId: string }
  | { kind: 'place-object'; objectKind: string }
  | { kind: 'place-viewpoint' }
  | { kind: 'measure' }

interface UIState {
  mode: EditorMode
  tool: Tool
  /** Window or standing-point id the camera is looking from; null = free orbit. */
  activeViewpointId: string | null
  planView: boolean
  showSightlines: boolean
  showGrid: boolean
  showDimensions: boolean
  /** Points collected by the in-progress polygon or measurement. */
  draftPoints: { x: number; z: number }[]
  statusMessage: string | null

  setMode: (mode: EditorMode) => void
  setTool: (tool: Tool) => void
  cancelTool: () => void
  setActiveViewpoint: (id: string | null) => void
  togglePlanView: () => void
  setPlanView: (on: boolean) => void
  toggleSightlines: () => void
  toggleGrid: () => void
  toggleDimensions: () => void
  pushDraftPoint: (p: { x: number; z: number }) => void
  popDraftPoint: () => void
  clearDraft: () => void
  setStatus: (message: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  mode: 'site',
  tool: { kind: 'select' },
  activeViewpointId: null,
  planView: false,
  showSightlines: true,
  showGrid: true,
  showDimensions: true,
  draftPoints: [],
  statusMessage: null,

  setMode: (mode) => set({ mode, tool: { kind: 'select' }, draftPoints: [] }),
  setTool: (tool) => set({ tool, draftPoints: [], statusMessage: null }),
  cancelTool: () => set({ tool: { kind: 'select' }, draftPoints: [], statusMessage: null }),
  // Riding a viewpoint and the top-down plan are mutually exclusive cameras.
  setActiveViewpoint: (activeViewpointId) =>
    set(activeViewpointId ? { activeViewpointId, planView: false } : { activeViewpointId }),
  togglePlanView: () => set((s) => ({ planView: !s.planView, activeViewpointId: null })),
  setPlanView: (planView) => set({ planView, activeViewpointId: null }),
  toggleSightlines: () => set((s) => ({ showSightlines: !s.showSightlines })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
  pushDraftPoint: (p) => set((s) => ({ draftPoints: [...s.draftPoints, p] })),
  popDraftPoint: () => set((s) => ({ draftPoints: s.draftPoints.slice(0, -1) })),
  clearDraft: () => set({ draftPoints: [] }),
  setStatus: (statusMessage) => set({ statusMessage }),
}))
