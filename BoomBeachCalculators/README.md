# Boom Beach Calculators

A dependency-free, single-page collection of Boom Beach calculators. Game data was checked against the Boom Beach Wiki on 26 July 2026.

## Calculators

- Cycle of Evil per-stage and total base resources, Evil Coins, and Proto Tokens for Dr. T, Hammerman Strikes Back, and Imitation Game, including a Resource Reward bonus; guaranteed currency totals for War Factory
- Keycard acquisition and Recruitment planner with Card Piece conversion, income timing, official pity/drop probabilities, and editable Elite featured odds
- Diamond and Time Saver estimates for skipping a timer (the Diamond formula is an estimate)
- Gunboat Energy usage for permanent Gunboat abilities and Gunboat levels 1–28

The former Evil Coin-to-building-resource calculator was removed because the March 2026 update removed building resources from the Shop of Evil and restored them to Cycle of Evil rewards.

## Run locally

Open `index.html` directly in a browser. No build or dependency installation is required. For a local HTTP server, run `python3 -m http.server` in the repository and open `http://localhost:8000`.

## Data sources

The embedded values are maintained from the Boom Beach Wiki pages for Dr. T Threat Stages, Hammerman Strikes Back (Threat), Imitation Game, The War Factory, Gunboat, and each permanent Gunboat ability. Supercell's March 2026 update announcement is the source for the Shop of Evil and Cycle of Evil structural changes.

## GitHub Pages deployment

`.github/workflows/sync-to-github-pages-repo.yml` runs on pushes to `main` and on manual dispatch. It checks out this repository and synchronizes the deployable files to `BoomBeachCalculators/` in `gjaskula99/gjaskula99.github.io`, then commits and pushes only when content changed.

Setup requirements:

1. Create a fine-grained personal access token with **Contents: Read and write** access to `gjaskula99/gjaskula99.github.io`.
2. Add it to this repository's Actions secrets as `GH_PAGES_SYNC_TOKEN`.
3. Ensure GitHub Pages in `gjaskula99/gjaskula99.github.io` publishes from the branch targeted by that repository's default branch.

The deployed URL is expected to be `https://gjaskula99.github.io/BoomBeachCalculators/`.

## Keycard Planner

The separate Keycard Planner tab accepts current Keycards, Card Pieces, banner-specific pity counters, a pull goal, and expected income. It reports available and forecast pulls, estimated acquisition dates, and cumulative chances for Recruitment outcomes.

Probability calculations use Supercell's attempt-specific rates and guarantee priority. They are deterministic rather than simulated. The featured Elite Lieutenant split defaults to an editable 50% because that split is visible in-game but absent from Supercell's public drop-rate article.

Stable sources—Daily Tasks, Cycle of Evil, Card Piece conversion, and free Field pulls—have dedicated inputs. Rotating shops, passes, purchases, and special events use manual one-time or weekly Keycard inputs so changing offers do not make the calculator stale. See `SHOP_CALCULATORS.md` for the underlying research and assumptions.

Run the automated planner tests with:

`node tests/keycard-planner.test.js`
