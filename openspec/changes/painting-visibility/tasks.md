## 1. Visibility data and public enforcement

- [x] 1.1 Add the default-false `isHidden` painting field and DTO validation.
- [x] 1.2 Apply visibility filtering to public catalog, total, direct, and batch painting reads.
- [x] 1.3 Apply visibility filtering to public artist, favourites, cart/request-form, and sitemap source paths while preserving historical orders.
- [x] 1.4 Add an idempotent reversible migration and checked-in migration commands that reconcile schemas previously created through synchronization.

## 2. Administrative access

- [x] 2.1 Add protected administrative painting list and detail reads that include hidden records.
- [x] 2.2 Verify existing administrative mutation flows continue to access hidden records.

## 3. Verification

- [x] 3.1 Add backend tests for public exclusion, hidden direct 404, and unfiltered protected reads.
- [x] 3.2 Run strict OpenSpec validation and relevant backend checks.
- [x] 3.3 Start and smoke-test services locally in the required Back, Front, Admin order without committing or deploying.
- [x] 3.4 Run the migration workflow and confirm all local migrations are recorded as applied.
