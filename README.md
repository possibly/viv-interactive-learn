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

If you tweak a `.viv` source you need the Python compiler. The bundles in
`public/bundles/` were produced with `viv-compiler==0.12.1`, which emits the
`schemaVersion: 0.10.1` that the vendored runtime expects.

```sh
pip install "viv-compiler==0.12.1"
for s in 1 2 3 4 5 6 7 8 9 10 11 12 13; do
  vivc -i public/vivsrc/stage$s.viv -o public/bundles/stage$s.json
done
```

## Deploying

`.github/workflows/deploy.yml` builds with `GITHUB_PAGES=1` (sets the
`/viv-interactive-learn/` base path) and publishes `dist/` to GitHub Pages on
every push to `main`.

## Stages

The same storyworld -- three friends in a tavern -- grows in ambition
across thirteen stages:

| #  | Title             | Introduces                                          |
|----|-------------------|-----------------------------------------------------|
| 1  | Hello             | actions, roles, report                              |
| 2  | Conditions        | role conditions, multi-action choice                |
| 3  | Effects           | effects, world mutation, the host adapter callback  |
| 4  | Importance        | weighted action selection                           |
| 5  | Embargoes         | one-shot and time-bounded action lockouts           |
| 6  | Queries           | named patterns over the chronicle as gates          |
| 7  | Sifting           | multi-action patterns; finding stories after the fact |
| 8  | Reactions         | actions that queue other actions; reserved actions  |
| 9  | Memory            | per-character salience, saveCharacterMemory, POV sifting |
| 10 | Selectors         | action selectors with `target in order` cascade     |
| 11 | Tropes            | named, parameterised bundles of conditions          |
| 12 | Plans             | multi-phase reaction tapes; tickPlanner             |
| 13 | Plan adaptation   | reaction windows (`all:/close`); `if`/`fail;`       |
