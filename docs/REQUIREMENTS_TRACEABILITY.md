# Awoo Requirements Traceability — Initial Audit

> Repository: [ivi39c/awoo](https://github.com/ivi39c/awoo)  
> Branch reviewed: `main`  
> Audit date: 2026-10-25  
> Related handoff: [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)

## Purpose and status definitions

This document maps previously stated product requirements to the current repository evidence. It is an initial source-level audit, not a claim that every browser behavior has been tested.

- **Implemented (source/test evidence):** relevant implementation and/or targeted automated tests were found. This does not imply full end-to-end acceptance.
- **Partial:** some of the behavior exists, but important conditions, integration, or acceptance remain.
- **Missing / conflict:** source evidence shows the requirement is absent or the current behavior conflicts with it.
- **Not verified:** the source inspected so far does not establish the behavior; further inspection or runtime testing is needed.

## 1. Current baseline evidence

Files inspected for this pass: `README.md`, `CHANGELOG.md`, `package.json`, `docs/ARCHITECTURE.md`, `docs/COMPLETION_AUDIT.md`, `docs/TEST_MODE.md`, `docs/MODERATOR_ACTION_GATING.md`, `js/app.js`, `js/game-engine.js`, `js/game-flow.js`, `js/moderator-script.js`, `js/ruleset.js`, and relevant test files under `tests/`.

Repository-documented baseline: package version `0.9.3`; README says Step 9.3 and records 75 Node.js tests plus syntax checks passing. Those results are documented by the repository; they were **not rerun as part of this audit**.

## 2. Requirements-to-code matrix

| ID | Requirement | Source evidence found | Initial status | Follow-up / acceptance criterion |
|---|---|---|---|---|
| MOD-01 | Official moderator advances narration automatically after speech; action steps wait for valid action or explicit decline | `js/app.js`; `js/moderator-script.js`; `tests/autonomous-moderator.test.cjs`; `tests/moderator-action-gating.test.cjs` | Partial / existing tests | Run `npm run check`; manually verify all supported role actions in a real browser. Confirm no placeholder can be mistaken for a completed skill. |
| MOD-02 | Still narrate a configured role's night line even if that role has died | `js/app.js` builds narration from all dealt roles; dead-role action prompts become an explicit skip line with no `actionKey`; `tests/moderator-action-gating.test.cjs` covers dead Seer narration and action blocking | Implemented in source/test evidence | CI passed on PR #1. Browser acceptance is still required to verify narration timing and that no dead role can act through another UI path. |
| MOD-03 | Guard acts first in the user's requested role set/order | `js/ruleset.js` default is now `classic`, which orders Guard → wolves → Witch → Seer; `awoo-custom` remains available as an explicit alternative | Updated default; automated test suite passed | CI passed on PR #1. Add a dedicated order assertion and verify the displayed narration order in browser. |
| MOD-04 | Seer result is private and shown only after the result line is spoken | `js/moderator-script.js` marks result line as private (`speechText: null)); moderator tests cover script metadata | Partial | Verify UI action/result timing in browser: no result before the result step; no public voice or other seat can see the result. |
| MOD-05 | Witch's wolf target must not be publicly announced; private info stays private | `js/moderator-script.js` Witch template includes a private-information note; `tests/moderator-script.test.cjs` covers script structure | Partial | Browser acceptance with speech synthesis and perspective switching; inspect whether the UI renders target only to Witch. |
| WIT-01 | On night one only, Witch cannot use antidote and poison together; from night two onward, both may be used if rules allow | `js/game-engine.js`, `js/app.js`, and `tests/game-engine.test.cjs` cover both action orders on night one and combined use on later nights | Implemented in source; CI-verified | `npm run check` passed in GitHub Actions on PR #1 and PR #2. Browser acceptance remains outstanding. |
| WIT-02 | Poison selector shows every seat; dead seats are greyed out/disabled; cancel does not consume poison | `js/app.js`; `tests/witch-poison-integration.test.cjs` | Implemented (targeted tests) | Re-run tests and inspect on mobile/desktop; ensure UI remains consistent after seat status changes. |
| WIT-03 | Confirmed poison reaches night resolution and death list | `js/app.js`; `tests/witch-poison-integration.test.cjs` covers select → confirm → resolve and terminal announcement | Implemented (targeted tests) | Re-run suite; manually verify in normal browser mode. |
| WIT-04 | Witch self-save is controlled by rules and first-night conditions | Existing engine validates potion availability and a valid night victim; no self-save-specific ruleset key was found in `js/ruleset.js` during this pass | Partial / missing rule control | Specify exact house-rule behavior and add explicit ruleset validation and tests. |
| TEST-01 | Test-mode perspective switch is restricted to test mode; selector displays seat and role after dealing | `js/app.js` restricts switching to test mode and now formats the label as `視角：座位號碼（身份）`; `tests/test-mode.test.cjs` asserts the label excludes player names | Implemented in source/test evidence | CI passed on PR #1. Verify post-deal refresh and role switching in browser. |
| TEST-02 | Test-mode main view is clean; hide lower dashed control panels; top actions are limited to icons, “立即結算本夜”, “退出” | `js/app.js`, `index.html`, and `css/styles.css` now hide normal header actions in test mode, add a night-only quick-settle action, simplify the exit label, and remove the dashed-box styling from test tools; `tests/test-mode.test.cjs` asserts header visibility | Partial; automated tests passed | CI passed on PR #2. The tools remain available as a clean, non-dashed section so role replacement still works. Browser visual acceptance remains outstanding. |
| UI-01 | Mobile avoids duplicate top-bar links; Settings contains Media | README / changelog describe mobile top-bar deduplication; `tests/mobile-ui.test.cjs` covers static structure | Partial | Verify the actual Settings → Media nesting and mobile interaction in the rendered UI; static assertions are not visual acceptance. |
| WIN-01 | Win checks handle edge/parity modes and no fictitious wolf victory | `js/game-engine.js` implements `checkWinCondition()`; `tests/game-engine.test.cjs` | Partial / needs requirement comparison | Audit exact definitions for naked bind, sheriff weighted voting, third-party camps, and equal vote power. Add explicit examples matching the agreed house rules. |
| VOTE-01 | Sheriff has 1.5 vote weight; ties/abstentions/invalid votes are handled correctly | `js/game-engine.js` `resolveVotes()`; `tests/game-engine.test.cjs` | Partial | Confirm end-to-end UI submits only legal votes and that weighted tie outcomes match the requested semantics. |
| ROLE-01 | Role encyclopedia entries do not imply implemented skills | `docs/COMPLETION_AUDIT.md`; `docs/ADDING_ROLES.md`; test-mode UI status | Implemented as documentation principle; role skills incomplete | Keep every role's status explicit: encyclopedia-only / action UI / engine resolution / tests / browser acceptance. |
| ROLE-02 | Wolf King executed: allow skill activation and target selection | Completion audit states Wolf King death-trigger skill remains incomplete; no complete skill implementation was established in inspected files | Missing / not verified | Implement a death-trigger mechanism and tests for execution, target validity, chain deaths, and victory recalculation. |
| ROLE-03 | Hunter shooting depends on death cause/rules; execution should offer skill panel | Completion audit says Hunter shooting remains incomplete; moderator script correctly does not wake Hunter every night | Missing / partial | Implement death-trigger handling, death-cause policy, UI target selection, and regression tests. |
| SHERIFF-01 | Sheriff death permits badge transfer or destruction | Completion audit indicates sheriff flow is incomplete; complete behavior not established in inspected source | Missing / not verified | Implement both choices, eligible-recipient validation, and tests for no eligible recipient and badge destruction. |
| SHERIFF-02 | Sheriff election is a real election, including ties and withdrawal/exit cases | `docs/COMPLETION_AUDIT.md` explicitly says current flow is not a complete election and selects the first valid candidate after candidacy ends | Missing / conflict with full requirement | Design and implement election/voting/tie/withdrawal flow; add integration tests. |
| AV-01 | During wolf phase only wolves see wolf video feeds; everyone still hears all audio | Completion audit states there is no WebRTC remote stream system; current app handles local `MediaStream` / media controls | Missing for multiplayer | Do not implement as CSS-only hiding. Requires room identity/permissions, stream routing, and WebRTC. |
| AV-02 | During active divine-role phase, active role sees all videos; others see only own; audio stays on | Same evidence as AV-01; remote video streams are not implemented | Missing for multiplayer | Define phase-based stream authorization and test against actual remote streams after multiplayer foundation exists. |
| NET-01 | Joining a room connects browsers to shared authoritative game state | `js/app.js` `confirmJoinRoom()` accepts a code and initializes local players; completion audit states room is local simulation | **Missing** | Requires backend/room protocol, authenticated membership, server-authoritative actions/state, persistence, reconnect and multi-client tests. |
| NET-02 | Room state survives refresh/disconnect and prevents forged actions | Completion audit states persistence, reconnect and server-side permission checks are absent | Missing | Design after selecting backend architecture; client-side validation is not a security boundary. |

## 3. High-confidence discrepancies found in this pass

### A. Dead-role narration currently contradicts the requirement

Current `refreshModeratorScriptForCurrentNight()` in `js/app.js` filters roles by `player.isAlive` before building the moderator script. A test in `tests/moderator-action-gating.test.cjs` explicitly expects the dead Seer's wake-up line to be absent. This conflicts with the user's stated requirement that a configured role's narration line should still be read even if that role has been eliminated.

**Recommended resolution:** decide the desired rule once, then change both implementation and test. If the requirement is to retain the line, do not simply call a dead role's action panel; separate “roles configured for narration” from “living actors allowed to submit an action.” Dead actors must never be allowed to act.

### B. Night-order preference needs reconciliation

The current default ruleset says wolves → Witch → Seer → Guard, while the user's later requirement requests Guard first for the relevant role set. This is a product decision that should be resolved before changing code, because the project also intentionally supports a `classic` preset.

### C. First-night Witch potion restriction is not evidenced in the inspected validation path

The current engine has per-potion used flags, but the inspected night-action validator does not receive a night number or explicitly reject the combination of antidote and poison on night one. Add a regression test before considering this requirement implemented.

### D. Multiplayer media requirements cannot be satisfied by the current local prototype

The repository's own completion audit says there is no remote WebRTC stream/signaling implementation. Treat phase-based camera visibility as a future multiplayer architecture requirement, not as a CSS-only UI task.

## 4. Recommended immediate implementation order

1. Run `npm run check` in a real checkout and record the actual output. This audit did not run it.
2. Resolve the two rule decisions that affect the moderator: dead-role narration and Guard-first night order.
3. Implement and test the night-one-only Witch potion restriction.
4. Compare current test-mode and mobile layouts against the user's requested UI using a real browser.
5. Audit win-condition and vote semantics against explicit examples, including sheriff weighting and ties.
6. Plan death-trigger skills (Hunter, Wolf King) and sheriff badge transfer/destruction.
7. Keep multiplayer synchronization and WebRTC as a separate milestone with its own architecture decision record.

## 5. Update protocol

For each requirement, update the status only when evidence changes. Include:
- implementation file/function;
- automated test name(s);
- exact test command and observed result;
- manual browser/device acceptance where applicable;
- unresolved rule choices or edge cases.

Do not mark a requirement “implemented” based only on role metadata, narration text, UI placeholders, documentation, or a test that checks static markup without exercising the behavior.


## 6. Follow-up entry — 2026-10-25: Witch first-night potion rule

- Updated `js/game-engine.js` to reject using the second potion on night one when the other potion has already been used.
- Updated `js/app.js` to pass `gameState.currentDay` and the opposite potion's used flag into the validator for Witch save/poison actions.
- Added a regression test in `tests/game-engine.test.cjs` for both first-night action orders and both second-night action orders.
- **Validation status:** changes are committed to GitHub. The automated test suite has not been executed in this environment, so this is not yet marked test-verified.
- Remaining verification: run `npm run check`, then manually confirm the Witch panel behavior in a browser.


## 7. Follow-up entry — 2026-10-25: test-mode and moderator fixes

- PR #1 merged as `8c213d6f7ede6a5e1caf5c2bf4fddab892411e01`: exact test perspective label, narration skip for eliminated roles without actionable keys, and Guard-first default order.
- PR #2 merged as `f5e6bc36016aacc515ae08ca29d61f5dc9080ac8`: hide ordinary header actions during test mode, add a night-only quick settlement button, simplify the exit control, and remove dashed-box styling from test tools.
- GitHub Actions `npm run check` passed on both pull requests.
- Still not complete: special-role skills (including Hunter/Wolf King), sheriff election and badge transfer/destruction, full voting/win-condition acceptance, and real multiplayer/WebRTC.
- Browser/device acceptance has not been performed by CI and must remain marked pending.
