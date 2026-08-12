## Why

Deleting a painting is irreversible and removes its media and relationships. Administrators need a reversible way to stop a work from appearing on the public site while preserving it for administration and existing orders.

## What Changes

- Add a persisted `isHidden` boolean to paintings, defaulting to `false`.
- Exclude hidden paintings from every public painting lookup, count, direct link, batch lookup, artist collection, favourites, cart validation, and sitemap source.
- Return `404` for a hidden painting through a public direct URL.
- Add authenticated admin painting list and detail endpoints that include both visible and hidden records.
- Preserve images, attribute links, and historical orders when a painting is hidden.
- Do not add recommendation scoring, similar-painting endpoints, frontend UI changes, push, or deployment.

## Capabilities

### New Capabilities

- `public-painting-visibility`: Reversible publication state that consistently governs every public painting read.
- `admin-painting-visibility-access`: Protected admin reads that include hidden paintings.

### Modified Capabilities

<!-- No existing OpenSpec capability specs are present in this repository. -->

## Impact

- `Painting` Sequelize model and painting DTO validation.
- Public and admin routes in the paintings module, including count and batch queries.
- Public artist, favourites, cart/request-form, and sitemap data paths that include paintings.
- Backend unit/integration-style service and controller tests.
