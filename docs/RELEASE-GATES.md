# Release gates

## Completed source delivery

PR #10 contains the runnable studio source and acceptance suite. Main and historical session branches remain unchanged. The temporary source delivery and repair workflows remove themselves; final acceptance workflows have read-only repository permissions.

## Native browser repair

The first native browser run caught a race: the test edited an existing inspector before an asynchronous add-shot save finished. The resulting film correctly exported the saved 10-second sequence, not the intended 8-second sequence. The repair locks inspector controls during saves and makes the browser test wait for the new shot, then assert persisted shot titles and durations before export. It does not relax the duration acceptance threshold.

Read the PR's current Studio acceptance run for the terminal native browser and RuFlo result. Earlier offline browser results are separately documented and are not a substitute for native CI.

## Live provider gate

On 2026-09-17, workflow run 35260663282 checked the existing repository FAL_KEY. It was absent. The live smoke was NOT RUN and made zero provider calls. A green workflow wrapper for this check is not a passed generation test.

Configure FAL_KEY through a deployment secret manager or GitHub Actions secrets, never a chat message or public file. Run the capped live smoke explicitly. It performs a single quote and approval through the application service with a USD 0.01 reservation ceiling, then archives the real result. Unknown submission outcomes must be reconciled, never blindly retried. This reservation is not a provider billing guarantee.

## Deployment gate

No public production URL or ruOS deployment is claimed. Use the documented single-process deployment behind HTTPS with persistent storage and a strong workspace access token. The Dockerfile is provided but has not been built in the authoring container. A public launch also requires live generation, backup/restore and operator review of the current security and billing limits.

## Creative scope

The workflow is implemented, but fixture exports do not demonstrate AI image or voice quality. Validate a real scene, chosen character/reference consistency and narration before making creative quality claims. This is an independent Vibecast implementation, not complete Higgsfield parity.
