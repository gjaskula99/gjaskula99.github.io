# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Boom Beach Calculators is a single-page web application providing various calculators for the mobile game Boom Beach. The entire application is contained in `index.html` with embedded CSS and JavaScript—no build process or external dependencies required.

## Architecture

**Single-File Application**: All code lives in `index.html`:
- HTML structure with tabbed interface
- Embedded CSS in `<style>` tag (lines 7-28)
- Embedded JavaScript in `<script>` tag (lines 183-394)
- Images stored in `/images` directory (webp format for icons and resources)

**Tab-Based UI**: The application uses a custom tab system where each calculator is a separate section:
- Tab navigation managed via `data-target` attributes
- Active tab has `.active` class
- JavaScript switches between tabs by toggling `.active` on both tab buttons and content sections

**Calculator Modules**: Each calculator is independent with its own:
- HTML section (`.tab-content`)
- Compute function (e.g., `computeEC()`, `computeCycle()`, `computeDiamonds()`, `computeGunboat()`)
- Output div (e.g., `#outputEC`, `#outputCycle`)

## Current Calculators

1. **Evil Coins Resources** (`#ec`): Calculates Evil Coins needed to purchase resources (Gold, Wood, Stone, Iron)
2. **Cycle of Evil Loot** (`#cycle`): Shows loot tables for Hammerman, Dr. T, War Factory, and Imitation Game events
3. **Time Skip** (`#timers`): Calculates diamond cost to skip time using legacy formula
4. **Gunboat Energy** (`#gunboat`): Calculates GBE requirements based on ability usage and gunboat level

## Data Structures

**Exchange Rates** (line 201): Evil Coin to resource conversion rates stored in `rates` object with small/big pack costs and sizes.

**Event Loot Tables** (lines 250-277): Arrays indexed by threat level (1-26) containing EC/Proto Token rewards for each event type. Imitation Game includes Building Health/Building Damage minimum percentages.

**Gunboat Data** (lines 350-370):
- Ability costs stored as objects with `init` (initial cost) and `inc` (increment per use)
- Base GBE by gunboat level in `gbeByLevel` array

## Development Workflow

**No Build Required**: Open `index.html` directly in a browser to test changes.

**Testing**: Manual testing only—refresh browser after editing `index.html`.

**Repository Sync**: `.github/workflows/sync-to-github-pages-repo.yml` syncs this repo to `gjaskula99.github.io/BoomBeachCalculators` on every push. It requires the `GH_PAGES_SYNC_TOKEN` repository secret.

**Game Data Updates**: When Boom Beach updates:
- Evil Coin exchange rates: Update `rates` object (line 201)
- Event loot tables: Update `drt`, `hammer`, or `ig` arrays (lines 250-277)
- Gunboat levels/costs: Update `abilities` or `gbeByLevel` (lines 350-370)
- Footer date: Update timestamp in footer (line 396)

## Code Patterns

**User Input Retrieval**:
```javascript
const value = Number(document.getElementById('inputId').value) || 0;
```

**Output Display**: Construct HTML strings and set via `innerHTML`:
```javascript
document.getElementById('outputId').innerHTML = html;
```

**Ceiling Division Utility**: `ceilDiv(a,b)` function (line 185) for rounding up resource amounts to pack sizes.

**Series Sum Helper**: `seriesSum(first, inc, n)` calculates arithmetic series for ability costs (line 361).

## Important Constraints

- Keep everything in single file—no external JS/CSS files
- Use inline images via `<img>` tags with paths to `/images` directory
- Maintain mobile-responsive layout (grid wraps on screens < 600px)
- All calculations must be client-side (no backend)
