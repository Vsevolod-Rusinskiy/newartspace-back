# Backend Security Alerts Status

Last updated: 2026-03-30

This file tracks the current status of Dependabot alerts for `newspace-back` and records which risks are accepted temporarily, which can be merged now, and which need a separate fix.

## Current Snapshot

- Baseline branch: `master`
- Baseline after merge: PR `#199`
- GitHub rescan status: completed
- Open alerts after rescan: `17`

## Already Closed

Closed by merged PRs `#197` and `#199`:

- `body-parser`
- `axios`
- `sequelize`
- `multer`
- `dottie`
- `lodash`
- `qs`
- `braces`
- `glob`
- `minimatch`

## Ready To Merge Now

### PR `#200` - `nodemailer`

- Status: can be merged
- PR: `#200`
- Change: `nodemailer` `7.0.11 -> 8.0.4`
- Verification result:
- local install succeeded
- `yarn build` passed
- `yarn test --runInBand --passWithNoTests` passed
- Code review result:
- current mail code uses regular `createTransport()` and `sendMail()`
- current code does not use the renamed `NoAuth` error code

Conclusion: `#200` is the next safe merge candidate.

## Accepted Temporarily

These alerts are not ignored forever. They are accepted temporarily with a reason and should stay on the backlog until a dedicated fix is prepared.

### `aws-sdk` v2

- Scope: direct runtime dependency
- Severity shown by GitHub: `Low`
- Current usage: [src/common/services/storage.service.ts](./src/common/services/storage.service.ts)
- Why it is accepted temporarily:
- the service uses a hardcoded region value (`ru-central1`)
- the advisory for `aws-sdk` v2 does not provide a normal patched v2 version
- closing this alert properly likely requires migration to `aws-sdk` v3
- Current mitigation:
- do not accept region from user input
- keep region hardcoded / validated in code

Conclusion: keep temporarily, but plan a separate migration task.

## Needs Separate Fix Work

These alerts should be handled in dedicated follow-up PRs because they are either transitive, grouped in tooling chains, or need extra verification.

### Runtime / potentially user-facing

- `path-to-regexp`
- `file-type` (2 alerts)

These should be reviewed before the dev-only alerts because they are closer to application runtime.

### Development / build / test chain

- `flatted`
- `serialize-javascript` (2 alerts)
- `picomatch` (3 alerts)
- `js-yaml` (2 alerts)
- `webpack` (2 alerts)
- `formidable`
- `tmp`

These are mainly build-time, CLI, lint, or test-tooling dependencies. They are still worth fixing, but they are lower priority than direct runtime issues.

## Operating Rules

- Merge safe direct dependency PRs after local verification.
- Do not merge broad framework upgrades only because Dependabot suggests them.
- Treat `development` alerts separately from runtime alerts.
- Keep accepted risks documented in this file until they are fixed or dismissed with a clear reason.
- If an alert cannot be patched safely, record why and what the long-term fix is.

## Next Recommended Order

1. Merge PR `#200`.
2. Investigate `path-to-regexp`.
3. Investigate `file-type`.
4. Group the remaining dev-only alerts into one or more safe maintenance PRs.
5. Plan `aws-sdk` v2 -> v3 migration as a separate task.
