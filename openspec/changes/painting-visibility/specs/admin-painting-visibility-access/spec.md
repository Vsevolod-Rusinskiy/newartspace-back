## Purpose

Provides protected administration reads that retain access to every painting, including works deliberately hidden from the public site.

## ADDED Requirements

### Requirement: Admin list includes all visibility states
An authenticated administrator SHALL be able to list paintings across both visible and hidden states, with list totals reflecting the complete administrative result set.

#### Scenario: Admin lists paintings after one is hidden
- **WHEN** an authenticated administrator requests the administrative painting list
- **THEN** the response includes both the hidden painting and visible paintings

#### Scenario: Public client requests the administrative list
- **WHEN** a request without valid administrator authentication targets the administrative painting list
- **THEN** the endpoint rejects the request

### Requirement: Admin detail includes hidden paintings
An authenticated administrator SHALL be able to retrieve a hidden painting by identifier for review and editing.

#### Scenario: Admin opens a hidden painting
- **WHEN** an authenticated administrator requests a hidden painting through the administrative detail endpoint
- **THEN** the response returns the painting and its hidden state

#### Scenario: Public client requests administrative detail
- **WHEN** a request without valid administrator authentication targets administrative painting detail
- **THEN** the endpoint rejects the request
