# Backyard Landscape Planner

A 3D tool for planning a backyard against the thing that actually constrains it:
what can be seen, from where.

Model the yard, your house and the neighbour's — with real wall heights and real
window positions — then try layouts and get a straight answer to "will this
actually screen that upstairs window?"

## What it does

**Privacy and sightlines.** Every window can be used as a camera position. The
planner casts rays from each viewpoint to five points across every window on the
other property and reports each sightline as *screened*, *partly screened*, or
*full view*, naming what is doing the screening. Put the camera at the
neighbour's upstairs window and look back at your patio.

A winter toggle drops deciduous canopies out of the calculation, so a tree that
only screens for six months of the year looks like one.

**An object library.** Pergolas, sheds, fire pits with seat walls, raised beds,
grills, hot tubs, trees, shrubs, fences, walls, steps and furniture — all built
procedurally, so every dimension is adjustable and the 3D updates as you type.
Ground materials (paving, gravel, mulch, decking, lawn, water) are drawn as
polygons of any shape.

**Measurements and a shopping list.** Areas per material, bulk volumes in cubic
yards for the things you order by the yard, object counts and total fence run.
Plan view for measuring, PNG export for sharing, JSON export for keeping.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # the geometry, privacy and takeoff maths
npm run build    # production bundle in dist/
```

Layouts autosave to the browser. Keep several side by side with **Duplicate** to
compare schemes, and use **Save file** for anything you want to keep or send on.

### Deploying

Pushing to the working branch builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. This needs one manual step first: in the
repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Using it on your own yard

1. **Site** — redraw the yard boundary by clicking its corners, then type exact
   lengths per side in the inspector. Add your house and the neighbour's, set
   wall heights, and add windows with their real sill heights. Set a base
   elevation if a building sits on higher ground.
2. **Design** — draw the ground materials, then place structures and planting.
3. **Analyse** — add standing points where you will actually sit, then work down
   the sightline list. Jump the camera to any viewpoint to see it yourself.

Units are feet and inches by default (metres available). Inputs accept whatever
you'd write on a tape: `12'6"`, `12.5'`, `150in`, `3.8m`.

## How it fits together

Geometry is stored in metres with the ground on the XZ plane; `src/units.ts` is
the only place that converts to display units.

- `src/geometry/` — polygon maths and ray/occluder tests, no three.js
- `src/model/` — the scene schema, versioned save/load, shared building geometry
- `src/objects/` — the object registry
- `src/analysis/` — privacy and materials, as pure functions over a scene
- `src/render/`, `src/editor/` — three.js drawing and the editing UI

### Adding an object type

One file in `src/objects/defs/`, registered with `registerObject`. A definition
declares its parameters, the controls to edit them, its procedural geometry, and
the simplified solids that block a sightline. The palette, the inspector form
and the privacy analysis all derive from that — no UI or analysis code to touch.

### What the analysis assumes

- Occluders are simplified to vertical extrusions and ellipsoids, not the exact
  drawn mesh. A tree canopy is an ellipsoid; a pitched roof is approximated by a
  second, inset prism.
- Open pergola rafters, picket fences and ornamental grasses are deliberately
  *not* treated as screening — they interrupt a view without blocking it, and
  counting them would overstate your privacy.
- Overlapping ground surfaces are counted separately in the takeoff, because a
  deck built over a gravel base is two real purchases. Add your own waste
  allowance before ordering.
- Sun position is a manual angle for legible shading, not a real solar model —
  don't plan planting from its shadows.
