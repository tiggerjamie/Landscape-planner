import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { bounds } from '../geometry/polygon'
import { analyzePrivacy, collectTargets, collectViewpoints } from '../analysis/sightlines'
import type { Scene } from '../model/types'
import { useSceneStore, type Selection } from '../store/sceneStore'
import { useUIStore } from '../store/uiStore'
import { Ground } from './Ground'
import { BuildingMesh } from './BuildingMesh'
import { ObjectInstance } from './ObjectInstance'
import { Sightlines, ViewpointMarkers } from './Sightlines'
import { DraftOverlay, GroundPicker, takeGroundClick } from './Interaction'

/**
 * The 3D view. One canvas serves every mode — free orbit, the top-down plan,
 * and riding a window viewpoint — so world coordinates never need translating
 * between a separate 2D editor and the 3D scene.
 */

function SunLight({ scene }: { scene: Scene }) {
  const ref = useRef<THREE.DirectionalLight>(null)
  const extent = useMemo(() => sceneExtent(scene), [scene])

  const { azimuthDeg, elevationDeg } = scene.sun
  const az = (azimuthDeg * Math.PI) / 180
  const el = (elevationDeg * Math.PI) / 180
  const distance = extent * 1.6
  const position: [number, number, number] = [
    Math.sin(az) * Math.cos(el) * distance,
    Math.max(Math.sin(el) * distance, 2),
    Math.cos(az) * Math.cos(el) * distance,
  ]

  useEffect(() => {
    const light = ref.current
    if (!light) return
    // Fit the shadow frustum to the lot so shadows stay sharp on any yard size.
    const c = light.shadow.camera as THREE.OrthographicCamera
    c.left = -extent
    c.right = extent
    c.top = extent
    c.bottom = -extent
    c.near = 0.5
    c.far = distance * 3
    c.updateProjectionMatrix()
  }, [extent, distance])

  return (
    <>
      {/* Sky and bounce fill, so faces turned away from the sun still read
          rather than going black — an all-shadow elevation tells you nothing
          about whether a layout works. */}
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#dfeaf5', '#8d9179', 1.1]} />
      <directionalLight
        ref={ref}
        position={position}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
      />
    </>
  )
}

/**
 * Extent of everything worth looking at — the lot plus every building, since
 * the neighbour's house usually sits outside the lot boundary and is exactly
 * what you need in frame.
 */
function sceneExtent(scene: Scene): number {
  const points = [...scene.lot, ...scene.buildings.flatMap((b) => b.footprint)]
  if (points.length === 0) return 20
  const b = bounds(points)
  return Math.max(b.width, b.depth, 20)
}

/**
 * Drives the single camera between the three viewing modes.
 *
 * Everything runs on one PerspectiveCamera that gets repositioned, rather than
 * swapping camera components per mode: mounting and unmounting cameras
 * underneath drei's controls tears down the controls' camera reference
 * mid-commit and throws, which takes the whole canvas down with it.
 *
 * Plan view is that same camera lifted high with a narrow field of view, which
 * is near enough to orthographic to measure against and avoids the swap.
 */
function CameraRig({ scene }: { scene: Scene }) {
  const { camera, controls } = useThree()
  const planView = useUIStore((s) => s.planView)
  const activeViewpointId = useUIStore((s) => s.activeViewpointId)

  const extent = useMemo(() => sceneExtent(scene), [scene])
  const center = useMemo(() => {
    const points = [...scene.lot, ...scene.buildings.flatMap((b) => b.footprint)]
    return points.length ? bounds(points).center : { x: 0, z: 0 }
  }, [scene])

  const viewpoint = useMemo(
    () => (activeViewpointId ? collectViewpoints(scene).find((v) => v.id === activeViewpointId) : undefined),
    [scene, activeViewpointId],
  )

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const orbit = controls as unknown as
      | { target: THREE.Vector3; enabled: boolean; update: () => void }
      | undefined

    if (viewpoint) {
      cam.up.set(0, 1, 0)
      cam.fov = 70
      cam.position.set(viewpoint.eye.x, viewpoint.eye.y, viewpoint.eye.z)
      cam.lookAt(
        viewpoint.eye.x + viewpoint.facing.x * 10,
        viewpoint.eye.y,
        viewpoint.eye.z + viewpoint.facing.z * 10,
      )
      if (orbit) orbit.enabled = false
    } else if (planView) {
      // Looking straight down, so "up" on screen has to be a horizontal axis;
      // -Z puts north at the top of the plan.
      cam.up.set(0, 0, -1)
      cam.fov = 12
      // Height that fits `extent` across a 12-degree field, plus headroom.
      const height = (extent * 0.62) / Math.tan((6 * Math.PI) / 180)
      cam.position.set(center.x, height, center.z)
      cam.lookAt(center.x, 0, center.z)
      if (orbit) {
        orbit.target.set(center.x, 0, center.z)
        orbit.enabled = true
        orbit.update()
      }
    } else {
      cam.up.set(0, 1, 0)
      cam.fov = 50
      cam.position.set(center.x + extent * 0.7, extent * 0.85, center.z + extent * 1.05)
      cam.lookAt(center.x, 1.5, center.z)
      if (orbit) {
        orbit.target.set(center.x, 1.5, center.z)
        orbit.enabled = true
        orbit.update()
      }
    }
    cam.updateProjectionMatrix()
  }, [camera, controls, planView, viewpoint, extent, center.x, center.z])

  return null
}

function SceneContents() {
  const scene = useSceneStore((s) => s.scene)
  const selection = useSceneStore((s) => s.selection)
  const select = useSceneStore((s) => s.select)
  const showSightlines = useUIStore((s) => s.showSightlines)
  const showGrid = useUIStore((s) => s.showGrid)
  const activeViewpointId = useUIStore((s) => s.activeViewpointId)
  const mode = useUIStore((s) => s.mode)

  const analysis = useMemo(
    () => (showSightlines && mode === 'analyze' ? analyzePrivacy(scene) : null),
    [scene, showSightlines, mode],
  )
  const viewpoints = useMemo(() => collectViewpoints(scene), [scene])
  const targets = useMemo(() => collectTargets(scene), [scene])

  const tool = useUIStore((s) => s.tool)
  // While a placement or drawing tool is armed, clicks belong to the ground
  // plane. Selecting here (and stopping propagation) would eat them, so a
  // click on the house would silently swallow a pergola you meant to place.
  const pick = (s: Selection) => {
    if (tool.kind !== 'select') return
    select(s)
  }

  return (
    <>
      <SunLight scene={scene} />

      {showGrid && (
        <Grid
          args={[200, 200]}
          cellSize={1}
          cellColor="#7f8a76"
          sectionSize={5}
          sectionColor="#65705d"
          fadeDistance={90}
          fadeStrength={1.2}
          followCamera={false}
          infiniteGrid
          position={[0, 0.005, 0]}
        />
      )}

      <Ground
        scene={scene}
        selectedSurfaceId={selection?.type === 'surface' ? selection.id : null}
        onSelectSurface={(id) => pick({ type: 'surface', id })}
      />

      {scene.buildings.map((b) => (
        <BuildingMesh
          key={b.id}
          building={b}
          selected={selection?.type === 'building' && selection.id === b.id}
          selectedWindowId={selection?.type === 'window' ? selection.id : null}
          onSelect={() => pick({ type: 'building', id: b.id })}
          onSelectWindow={(windowId) => pick({ type: 'window', id: windowId, parentId: b.id })}
        />
      ))}

      {scene.objects.map((o) => (
        <ObjectInstance
          key={o.id}
          object={o}
          season={scene.season}
          selected={selection?.type === 'object' && selection.id === o.id}
          onSelect={() => pick({ type: 'object', id: o.id })}
        />
      ))}

      <ViewpointMarkers
        viewpoints={viewpoints}
        activeId={activeViewpointId}
        onSelect={(id) => pick({ type: 'viewpoint', id })}
      />

      {analysis && (
        <Sightlines
          results={analysis.crossProperty}
          viewpoints={viewpoints}
          targets={targets}
          activeViewpointId={activeViewpointId}
        />
      )}

      <GroundPicker />
      <DraftOverlay />
    </>
  )
}

function Cameras() {
  const scene = useSceneStore((s) => s.scene)
  const planView = useUIStore((s) => s.planView)
  const activeViewpointId = useUIStore((s) => s.activeViewpointId)

  const extent = useMemo(() => sceneExtent(scene), [scene])

  // Both the camera and the controls stay mounted for the life of the canvas;
  // only their parameters change. See CameraRig for why.
  return (
    <>
      <PerspectiveCamera makeDefault fov={50} near={0.05} far={2000} />
      <OrbitControls
        makeDefault
        enableRotate={!planView && !activeViewpointId}
        enablePan={!activeViewpointId}
        enableZoom={!activeViewpointId}
        maxPolarAngle={planView ? Math.PI : Math.PI / 2 - 0.02}
        minDistance={1}
        maxDistance={extent * 8}
      />
      <CameraRig scene={scene} />
    </>
  )
}

export function Viewport() {
  const select = useSceneStore((s) => s.select)
  const cancelTool = useUIStore((s) => s.cancelTool)

  return (
    <Canvas
      shadows
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onPointerMissed={(e) => {
        // A click on empty space clears the selection; right-click cancels the
        // armed tool, matching how drawing tools behave elsewhere.
        if (e.type === 'contextmenu') {
          cancelTool()
          return
        }
        // Open ground counts as "missed" because the lot mesh has no handlers.
        // If a tool just consumed that click, keep the resulting selection.
        if (takeGroundClick()) return
        select(null)
      }}
    >
      <color attach="background" args={['#aebfd0']} />
      <fog attach="fog" args={['#aebfd0', 120, 400]} />
      <Cameras />
      <SceneContents />
    </Canvas>
  )
}
