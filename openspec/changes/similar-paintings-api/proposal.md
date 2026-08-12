## Why

Visitors need deterministic recommendations that help them continue browsing from a painting while respecting the same public-visibility rules as the catalog.

## What Changes

- Add `GET /paintings/:id/similar?limit=20` for a publicly available source painting.
- Rank visible candidates through the fixed theme, art type, color, artist, and fallback groups.
- Prefer the source `artStyle`, then fill from other public art styles.
- Exclude the source and duplicates, validate a limit from 1 through 20, and return card-ready painting data.
- Add pure ranking tests and endpoint/service contract tests.

## Capabilities

### New Capabilities

- `similar-paintings-api`: Public deterministic painting recommendations.

## Impact

- Painting controller and service query paths.
- A pure ranking module under the paintings feature.
- No migration, model field, admin UI, commit, push, or deployment.
