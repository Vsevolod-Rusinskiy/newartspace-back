## Purpose

Return deterministic, publicly safe painting recommendations for a source painting.

## ADDED Requirements

### Requirement: Public similar-painting contract

The backend SHALL expose `GET /paintings/:id/similar?limit=20`, accept only integer limits from 1 through 20 with a default of 20, and treat a hidden source like an absent source.

#### Scenario: Invalid limit
- **WHEN** limit is zero, above 20, fractional, or non-numeric
- **THEN** the API returns HTTP 400

#### Scenario: Hidden source
- **WHEN** the source painting has `isHidden = true`
- **THEN** the API returns the same HTTP 404 result as for an absent painting

### Requirement: Candidate safety

Recommendations SHALL contain at most the requested limit, include only `isHidden = false` candidates, exclude the source, and contain no duplicate IDs.

#### Scenario: Hidden and duplicate candidates
- **WHEN** candidate input contains the source, hidden records, or repeated IDs
- **THEN** none of those invalid entries appears in the response

### Requirement: Deterministic group ranking

The backend SHALL fill seven ordered groups in the source art style—theme+author, theme+other author, art type+author, art type+other author, any color, same author, and remaining by priority—then apply the same groups to other art styles. Strings SHALL be trimmed and compared case-insensitively.

#### Scenario: Same-style and fallback candidates
- **WHEN** matching candidates exist in both the source and another art style
- **THEN** every selected same-style group is emitted before candidates from other art styles

### Requirement: Stable ordering within a group

Within each group, candidates SHALL sort by more combined theme, art-type, and color matches, then priority descending, then stable unique ID ascending.

#### Scenario: Equal group candidates
- **WHEN** two candidates belong to the same group
- **THEN** their order follows additional match count, priority, and ID without randomness
