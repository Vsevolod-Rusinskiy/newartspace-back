## Purpose

Ensures a painting can be withdrawn from public discovery without deleting its content, media, relationships, or historical purchase data.

## ADDED Requirements

### Requirement: Reversible public visibility state
The system SHALL store a boolean public-visibility state for every painting. New and existing paintings SHALL be visible by default unless an administrator explicitly hides them.

#### Scenario: New painting is visible by default
- **WHEN** a painting is created without a visibility value
- **THEN** it is included in public painting reads

#### Scenario: Administrator hides a painting
- **WHEN** an administrator marks a painting as hidden
- **THEN** the painting record, its images, and its relationships remain stored while the painting is withdrawn from public reads

### Requirement: Public painting reads exclude hidden paintings
Every public painting collection and reference lookup SHALL exclude hidden paintings, including catalog listings and their totals, batch lookups, artist collections, favourites, cart validation, request-form/cart processing, and sitemap sources.

#### Scenario: Hidden painting is absent from catalog total
- **WHEN** a public catalog query is made after a painting is hidden
- **THEN** neither its result items nor the reported total include the hidden painting

#### Scenario: Hidden painting is absent from batch and contextual reads
- **WHEN** a public batch, artist, favourites, cart, or sitemap source query includes a hidden painting
- **THEN** the response omits that painting

### Requirement: Hidden paintings are not publicly addressable
The public direct painting endpoint SHALL respond with HTTP 404 for a hidden painting, without exposing whether the record exists.

#### Scenario: Public direct link targets a hidden painting
- **WHEN** an unauthenticated public client requests a hidden painting by identifier
- **THEN** the endpoint responds with HTTP 404

### Requirement: Existing orders remain historically intact
Hiding a painting SHALL NOT delete or alter its image records, metadata relationships, or existing orders and order-history references.

#### Scenario: An order references a newly hidden painting
- **WHEN** a painting associated with an existing order is hidden
- **THEN** the order and its historical painting reference remain available to the authorised order-history workflow
