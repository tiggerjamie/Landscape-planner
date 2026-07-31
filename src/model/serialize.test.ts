import { describe, expect, it } from 'vitest'
import { createDefaultScene } from './defaults'
import { deserializeScene, serializeScene } from './serialize'
import { SCENE_VERSION } from './types'

describe('scene serialization', () => {
  it('round-trips a scene exactly', () => {
    const scene = createDefaultScene('My Yard')
    const { scene: loaded, error } = deserializeScene(serializeScene(scene))
    expect(error).toBeNull()
    expect(loaded).toEqual(scene)
  })

  it('preserves window placement through a round trip', () => {
    const scene = createDefaultScene()
    const loaded = deserializeScene(serializeScene(scene)).scene!
    expect(loaded.buildings[0].windows).toEqual(scene.buildings[0].windows)
  })

  it('stamps the current version on save', () => {
    const saved = JSON.parse(serializeScene({ ...createDefaultScene(), version: 0 }))
    expect(saved.version).toBe(SCENE_VERSION)
  })

  it('rejects a file from a newer version rather than mangling it', () => {
    const future = JSON.stringify({ ...createDefaultScene(), version: SCENE_VERSION + 5 })
    const { scene, error } = deserializeScene(future)
    expect(scene).toBeNull()
    expect(error).toMatch(/newer version/i)
  })

  it('reports invalid JSON without throwing', () => {
    const { scene, error } = deserializeScene('{not json')
    expect(scene).toBeNull()
    expect(error).toMatch(/not valid JSON/i)
  })

  it('reports a JSON file that is not a layout', () => {
    expect(deserializeScene('[1,2,3]').scene).toBeNull()
    expect(deserializeScene('"hello"').scene).toBeNull()
  })

  it('fills in fields missing from a hand-edited file', () => {
    // A minimal file with only a lot should still open.
    const partial = JSON.stringify({ version: 1, name: 'Sparse', lot: [] })
    const { scene, error } = deserializeScene(partial)
    expect(error).toBeNull()
    expect(scene!.name).toBe('Sparse')
    expect(scene!.buildings).toEqual([])
    expect(scene!.surfaces).toEqual([])
    expect(scene!.objects).toEqual([])
    expect(scene!.sun).toBeDefined()
    expect(scene!.season).toBe('summer')
  })

  it('defaults a building with no windows array instead of crashing', () => {
    const partial = JSON.stringify({
      version: 1,
      buildings: [{ id: 'b', name: 'House', kind: 'own', wallHeight: 3 }],
    })
    const scene = deserializeScene(partial).scene!
    expect(scene.buildings[0].windows).toEqual([])
    expect(scene.buildings[0].footprint).toEqual([])
  })

  it('normalizes an unrecognized units value', () => {
    const odd = JSON.stringify({ version: 1, units: 'furlongs' })
    expect(deserializeScene(odd).scene!.units).toBe('ft')
  })
})
