# Codebase Guide

## Architecture

This is a static, dependency-free web application. `index.html` contains the markup, CSS, embedded game tables, and UI rendering. `keycard-planner.js` contains the standalone acquisition and probability engine. Assets are WebP files under `images/`. There is no compilation step, package manager, server component, or persistent storage.

## Calculator implementation

- Tab buttons use `data-target` attributes to activate matching `.tab-content` sections.
- `computeCycle()` selects one of four threat-indexed reward arrays and sums seven consecutive stages. It applies the entered Resource Reward percentage to each base-resource drop, displays the boosted values in the table, and totals every column. Evil Coins and Proto Tokens remain unboosted. Rewards cap at threat 26, matching the Wiki.
- `computeKeycards()` gathers the planner form and defers deterministic calculation by one animation frame so the calculating state can render. The result combines inventory, timing, source, pity, and cumulative probability summaries.
- `keycard-planner.js` exports immutable official rate tables and pure functions through both `window.KeycardPlanner` and CommonJS. Its sparse probability-state propagation models one reward per pull, counter resets, guarantee priority, banner-specific Epic availability, and the editable featured-Elite split.
- `computeDiamonds()` estimates the Diamond cost from remaining hours and also reports the exact Time Saver equivalence of four Time Savers per hour.
- `computeGunboat()` uses arithmetic-series sums for repeated ability costs and compares the result with level-based Gunboat capacity plus the user's statue bonus.
- `toNonNeg()` normalizes numeric input and prevents negative or non-finite values from entering calculations.

## Game data maintenance

When game data changes, edit the constants inside `index.html`:

- Cycle of Evil reward arrays: `drt`, `hammer`, `ig`, `warFactory`, and `resources`
- Gunboat ability initial and incremental costs: `abilities`
- Gunboat energy capacities: `gbeByLevel`
- Recruitment rates and acquisition constants: `RATES`, `MAX_ATTEMPT`, and the constants at the top of `keycard-planner.js`

Validate values against the current Boom Beach Wiki pages and official Supercell update notes. Update the visible verification date in the footer and this documentation when functionality changes.

`SHOP_CALCULATORS.md` records the researched shop conversions, volatile values, and the implemented planner boundaries.

## Deployment

`.github/workflows/sync-to-github-pages-repo.yml` deploys from `main`. It uses two checkout directories:

- `source/`: this repository
- `target/`: `gjaskula99/gjaskula99.github.io`, authenticated with `GH_PAGES_SYNC_TOKEN`

`rsync --delete` mirrors source files into `target/BoomBeachCalculators/`, excluding repository metadata and source workflows. The workflow stages that directory, skips an empty commit, and pushes to the target repository's checked-out default branch. Concurrency cancellation prevents an older run from overwriting a newer push.

## Testing

Run `node tests/keycard-planner.test.js` to validate official probability tables, pity transitions, Elite logic, inventory conversion, and acquisition timing. Also parse the inline JavaScript for syntax errors, validate workflow YAML, confirm every image reference exists, run regression smoke tests for the existing calculators, and exercise all tabs in a browser at desktop and mobile widths.
