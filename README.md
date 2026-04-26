# viv-interactive-learn

A long, single-page tour of the [Viv][viv] DSL for emergent narrative, with an
embedded sandbox you can step through. Author-centric: focuses on the
authoring layer rather than runtime internals.

[viv]: https://github.com/possibly/viv

## Layout

```
src/
  vendor/viv-runtime.js   pre-bundled ESM build of the upstream
                          `browser/runtime` branch (vendored verbatim)
  viv.ts                  thin typed wrapper around the runtime
  sandbox/
    Sandbox.tsx           the playground (state / chronicle / source tabs)
    world.ts              shared world state + host adapter
    stages.ts             stage metadata (titles, paths, initial conditions)
    host-code.ts          string snippets shown in the "Host code" tab
  App.tsx                 the long page itself
public/
  vivsrc/stage{1..5}.viv  the source authored for each stage
  bundles/stage{1..5}.json the compiled output of each .viv (committed; the
                          page never needs the Python compiler at runtime)
```

## Running locally

```sh
npm install
npm run dev
```

Open http://localhost:5173/.

## Re-compiling the .viv sources

If you tweak a `.viv` source you need the Python compiler. Match the runtime's
schema by pinning to v0.10.x:

```sh
pip install "viv-compiler==0.10.4"
for s in 1 2 3 4 5; do
  vivc -i public/vivsrc/stage$s.viv -o public/bundles/stage$s.json
done
```

## Deploying

`.github/workflows/deploy.yml` builds with `GITHUB_PAGES=1` (sets the
`/viv-interactive-learn/` base path) and publishes `dist/` to GitHub Pages on
every push to `main`.

## Stages

The same storyworld -- three regulars at the Crooked Tankard -- grows in
ambition across five stages:

| #  | Title         | Introduces                                          |
|----|---------------|-----------------------------------------------------|
| 1  | Hello         | actions, roles, effects, gloss/report               |
| 2  | Conditions    | multi-action choice, conditions, `anywhere` roles   |
| 3  | Importance    | importance, saliences, narrative weight             |
| 4  | Place         | location roles, item roles, spatial conditions      |
| 5  | Consequences  | reactions, reserved actions, precast roles, chains  |
