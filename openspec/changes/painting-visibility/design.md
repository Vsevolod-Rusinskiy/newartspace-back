## Context

See `proposal.md` for motivation. Public painting data is assembled through the paintings module and through associated painting includes in adjacent services. The admin UI currently reads the same public list/detail routes, so it would lose access to hidden records if filtering were applied without dedicated admin reads.

## Goals / Non-Goals

**Goals:**

- Establish one persisted visibility flag with a database default that preserves existing records as public.
- Apply visibility at every public backend data boundary rather than relying on the frontend to hide records.
- Keep administrative mutation and historical-order paths capable of accessing hidden records.

**Non-Goals:**

- A recommendation or similar-painting algorithm.
- Deleting or migrating painting images, relations, or orders.
- A public query flag that bypasses visibility filtering.

## Decisions

### Enforce visibility in public query paths

Public painting list, direct, and batch reads will explicitly require `isHidden: false`. Associated public reads will apply the same condition on their painting association or lookup. This protects API consumers, sitemap generation, and future frontend callers uniformly. A global ORM default scope was rejected because it can unintentionally hide paintings from protected administration and order-history workflows.

### Separate public and administrative reads

Public direct lookup will use a visibility-aware path and translate an absent/hidden record into the same 404 response. Protected `/paintings/admin` list and `/paintings/admin/:id` detail routes will use unfiltered administration reads. Route definitions place static admin paths before the dynamic public identifier route. An `includeHidden` public query parameter was rejected because it would make a security-sensitive choice client-controlled.

### Preserve historical orders while preventing new public use

Existing order relations remain unfiltered because they represent historical records. Favourites, cart/batch, artist, request-form, and sitemap inputs are public discovery or purchase-entry paths and will omit hidden paintings. This separates past transactions from new public availability.

### Use an explicit additive migration for the persisted field

The boolean column will be non-null with a false default so existing rows are made visible. Although the application enables model synchronization, it does not alter an already-created table in this environment; an explicit reversible migration is therefore required for reliable schema evolution. The repository uses `sequelize-cli`, `src/config/config.js`, and package scripts for migration execution. Migrations that overlap tables previously created by synchronization are idempotent so they can safely reconcile the physical schema with `SequelizeMeta`.

## Risks / Trade-offs

- [A new public query path could omit the visibility predicate] → Search all painting model reads now, cover representative paths with tests, and keep the rule documented in this change.
- [A synchronized or manually altered local schema can be ahead of `SequelizeMeta`] → Keep overlapping migrations idempotent, run `db:migrate`, and confirm `db:migrate:status` reports every migration as applied.
- [Historical order payload can still show hidden artwork] → This is intentional to preserve existing orders; it does not make the painting publicly discoverable or purchasable.

## Migration Plan

1. Apply the reversible migration that adds the non-null boolean field with default `false`.
2. Confirm `db:migrate:status` reports the schema migration as applied, including environments where synchronization already created equivalent schema objects.
3. Deploy the backend visibility filters and protected administration reads together with the admin UI routing update.
4. If rollback is required, revert the application paths; the additive field and existing records remain intact.
