## Context

Paintings already expose primary theme, art type, color, artist, art style, and priority. Additional themes and colors are available through `Attributes` and the `PaintingAttributes.type` association. Public visibility is enforced with `isHidden: false`.

## Decisions

1. Fetch the public source and all visible candidates with artist and attribute associations, then rank them with a pure TypeScript function. The current catalog size does not justify SQL scoring.
2. Normalize strings with `trim().toLowerCase()` and merge primary plus associated theme/color values into sets.
3. Assign each candidate to its first matching group: theme+author, theme, art type+author, art type, color, author, or fallback.
4. Rank all groups from the source art style before applying the same groups to candidates from other art styles.
5. Within a group, sort by the total theme overlap plus art-type match plus color overlap, then priority descending, then numeric ID ascending.
6. Serialize recommendations with the existing painting fields and a top-level `author` required by `PaintingListItem`.
7. Parse and validate `limit` in the controller so invalid, fractional, or out-of-range values return 400.

## Risks / Trade-offs

- [Attribute association shapes differ between model instances and test fixtures] → isolate extraction in tolerant pure helpers and cover both primary and associated values.
- [Recommendation query grows with catalog size] → retain pure in-memory scoring until measured performance requires SQL optimization.
- [A hidden source leaks existence] → reuse the public source lookup and return the same 404 as an absent painting.

## Migration Plan

No database migration is required. Rollback removes the endpoint and ranking module.
