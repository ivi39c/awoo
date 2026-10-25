# Awoo Project Handoff Record

> Purpose: preserve project continuity across ChatGPT sessions and other development tools.  
> Repository: [ivi39c/awoo](https://github.com/ivi39c/awoo)  
> Branch reviewed: `main`  
> Record created: 2026-10-25  
> Baseline described: Step 9.3 / package version 0.9.3

## 1. How to use this document

At the start of a new development session:

1. Read this file first.
2. Read [README.md](../README.md), [CHANGELOG.md](../CHANGELOG.md), and [docs/COMPLETION_AUDIT.md](COMPLETION_AUDIT.md).
3. Inspect the current code and recent commits before proposing or making changes.
4. Update this handoff record after any meaningful implementation, decision, test run, or scope change.
5. Never treat a request, a plan, a placeholder, or a metadata entry as proof that a feature has been implemented.
6. Report what was changed, which files were changed, and which tests were actually run. Do not claim tests passed unless they were executed and their results were observed.

This document is a continuity record, not a substitute for source code, test results, or the changelog.

## 2. Project identity and current baseline

Awoo is a browser-based Werewolf / 狼人殺 game prototype. The current repository README identifies the project as **Step 9.3 — 系統自動上帝主持**.

The codebase is a local front-end prototype. It is **not yet a real multiplayer game**. The current room/join flow does not synchronize game state between browsers. Remote multiplayer, server-authoritative permissions/state, persistence, reconnect handling, and WebRTC are not implemented according to the existing project audit.

### Main entry points

- `index.html`: browser page entry.
- `js/app.js`: main browser controller; connects UI interactions, game flow, timers, engine calls, and rendering.
- `js/game-engine.js`: core rules and game-state calculations.
- `js/game-flow.js`: phase transitions and speaking order.
- `js/moderator-script.js`: role/night-dependent moderator narration.
- `js/role-database.js`: role metadata and relationships.
- `js/ruleset.js`: standard rules and overrides.
- `js/ui.js`: shared DOM/UI helpers.
- `js/compendium.js`: role encyclopedia.
- `css/styles.css`: responsive styles.
- `package.json`: test and syntax-check commands.

### Existing validation commands

Node.js 18 or newer is specified in README.

```bash
npm run check
```

The current README records 75 Node.js automated tests and syntax checks for eight JavaScript modules as passing in Step 9.3. This is a **repository-documented historical result**; it must not be described as a newly verified result unless the command is run again in the current checkout.

## 3. Architecture and working principles

Follow [docs/ARCHITECTURE.md](ARCHITECTURE.md):

- `role-database.js` describes roles; it must not mutate game state or imply that every role is playable.
- `ruleset.js` owns configurable rule defaults and validation.
- `game-engine.js` owns rule validation, action resolution, voting, and victory checks; it should not depend on the DOM, timers, or media APIs.
- `game-flow.js` owns valid phase transitions and speaking-order logic.
- `compendium.js` presents role information; it must not decide game outcomes.
- `ui.js` provides reusable DOM helpers, not game rules.
- `app.js` coordinates browser interactions and currently still contains substantial responsibilities that may need later decomposition.

For new roles, define timing, legal targets, usage limits, resolution priority, death triggers, and rule variants; implement the engine behavior and tests. Role encyclopedia metadata alone is not a completed skill.

## 4. Confirmed baseline limitations

The existing `docs/COMPLETION_AUDIT.md` marks major areas as incomplete or partial:

- Core round flow has unit-test coverage but lacks complete real-browser end-to-end verification.
- The role database contains many role descriptions, while only a subset of role skills are implemented.
- `app.js` still contains a large amount of orchestration and UI behavior.
- The room/join experience is a local prototype, not cross-browser multiplayer.
- Server-side identity/permissions, authoritative game state, persistence, reconnection, and anti-cheat boundaries are missing.
- Remote audio/video is not implemented as a WebRTC room. Local media permission access is not the same as remote media delivery.
- Sheriff election, hunter shooting, wolf-king and other death-trigger skills, and various special-role interactions need further implementation and verification.
- Automated Node tests do not replace mobile/desktop browser acceptance testing.

Use the current audit and source code to refresh this list before each major milestone.

## 5. User-defined product requirements and behavior decisions

The following items were explicitly requested or clarified in prior project discussions. They are **requirements / backlog context**, not proof that the current branch implements them. Verify each item against source code and tests before marking it complete.

### 5.1 Moderator flow and night actions

- The system is the built-in moderator; official mode should not require a human moderator to manually advance each narration line.
- After a narrated line, wait for the relevant role to complete a legal action (or explicitly decline when the rules allow it), then continue automatically.
- If a role is part of the configured night sequence but has already died, its narration line should still be spoken when required by the chosen rules.
- Guard should act first in the configured role set that includes Guard, Seer, Witch, and Hunter, per the user's requested order. Reconcile this with existing Awoo/classic order options before changing defaults.
- The Seer should receive the result privately only after the result narration has been spoken.
- Do not publicly reveal the wolf kill target to the Witch; Witch prompts and narration must respect private information.
- Keep Witch narration lines when relevant even if the antidote is unavailable or already used.
- At dawn, announce either a peaceful night or the actual players eliminated that night.
- When sheriff-election mode is active, do not announce “天亮了請睜眼” before the sheriff campaign stage if players are expected to open their eyes for that stage.
- Night reminder timers must not bypass unfinished actions or force night resolution.
- The official flow must not treat placeholder confirmation for an unimplemented special-role skill as a real skill implementation.

### 5.2 Witch rules

- **First night only:** the Witch cannot use both antidote and poison on the same night.
- From the second night onward, using both on the same night is permitted if the configured rules allow it.
- Witch poison target selection should show all seat numbers; eliminated players are greyed out and cannot be selected.
- Confirming poison should consume the potion and persist the target into the night-resolution state; cancellation or draft selection alone must not consume it.
- A Witch self-save option, if present, should be controlled by the applicable rule and first-night conditions.

### 5.3 Test mode and UI

- Test mode is for local inspection: allow perspective switching and role/control-panel inspection. It must not be treated as a secure production permission model.
- After cards are dealt, the perspective selector should identify the seat number and role, in the form `視角：号码（身份）`, rather than showing an undealt placeholder.
- Keep the test-mode main area clean: top-bar icons, **「立即結算本夜」**, and **「退出」**; hide lower dashed control-panel blocks when that is the agreed test-mode layout.
- On mobile, avoid duplicate top-bar links for items already in the bottom navigation. Settings and media controls should be organized under the bottom navigation's Settings entry, with Media nested under Settings, as previously requested.
- Keep all seat numbers visible during wolf actions; eliminated seats should be greyed out and not selectable rather than hidden.

### 5.4 Audio/video visibility requirements for future multiplayer

These are intended visibility rules for a future real multiplayer implementation. They cannot be delivered securely by CSS-only hiding of video elements.

- During the wolf phase, wolves can see other wolves' video feeds. Non-wolves see only their own video, but continue hearing all players' audio.
- During an active divine-role phase, the acting role can see all players' video feeds; all other players see only their own video. Audio remains on for everyone.
- Other players' camera/microphone tracks must not be globally disabled merely to enforce the view restrictions.
- Implement these rules with appropriate stream routing and server/room authorization in the real WebRTC architecture, not just front-end display toggles.
- The user requested a wolf-only visual cue (for example, a crown marker) for the Wolf King; it must never leak to non-wolf players.

### 5.5 Special roles, death triggers, and victory checks

- Wolf King: when executed, offer a skill activation flow to choose a player to eliminate, if the role/rules support it.
- Hunter: handle death-triggered shooting according to the actual death cause and rules; night-killed Hunter may shoot when allowed, and execution-triggered shooting should expose an activation and target-selection flow.
- Sheriff death: allow passing the badge to an eligible player or destroying it.
- After execution and all death-triggered skills have been resolved, recalculate living players and voting power before deciding victory.
- Naked bind: wolves outnumbering the good faction should be treated as the specified absolute advantage.
- Sheriff-badge bind: Sheriff vote weight is 1.5; compare actual wolf voting power against good-player voting power using strict greater-than semantics. Equal voting power or ties must not be treated as a wolf advantage.
- Keep role identity, private information, legal targets, and death causes consistent across the engine, UI, narration, and tests.

## 6. Suggested next work order

This is a proposed sequence based on the documented gaps and the user-defined requirements. Reassess it against the current code before implementation.

1. **Re-establish the baseline:** inspect current branch/commit, run `npm run check`, record actual output, and run the existing manual test flow from `docs/TEST_MODE.md`.
2. **Create a requirement-to-code audit:** map each requirement in Section 5 to source functions, tests, and status: implemented / partial / missing / not verified.
3. **Fix and test local game correctness:** prioritize night ordering, moderator action gating, Witch potion constraints, Seer private results, dawn announcements, sheriff-election transitions, death-trigger skills, and victory calculations.
4. **Complete test-mode and responsive UI acceptance:** verify desktop and mobile layouts with real browsers; do not rely solely on static CSS tests.
5. **Implement missing role skills through a structured mechanism:** define a consistent action/trigger/resolution contract before adding many one-off conditionals.
6. **Plan the multiplayer architecture separately:** choose the backend and authoritative state model, then implement room membership, identity/role permissions, state synchronization, persistence, reconnect handling, and tests.
7. **Add WebRTC only with the room/permission model in place:** implement signaling, remote tracks, per-phase video visibility, always-on audio policy where required, device errors, and reconnect behavior.

Do not start a large refactor or multiplayer implementation without first recording scope, acceptance criteria, and a test plan.

## 7. Session handoff template

Append a new dated entry below after each meaningful work session. Keep older entries; do not silently rewrite history.

### YYYY-MM-DD — Short session title

- **Starting commit:**
- **Goal / agreed scope:**
- **Files inspected:**
- **Files changed:**
- **Implementation completed:**
- **Requirements still open:**
- **Tests run (exact commands):**
- **Observed results:**
- **Manual browser/device checks:**
- **Known regressions or risks:**
- **Next action:**

## 8. Session history

### 2026-10-25 — Initial handoff record

- **Repository:** `ivi39c/awoo`, default branch `main`.
- **Baseline reviewed:** README, CHANGELOG, package.json, architecture guide, test-mode guide, moderator action-gating guide, and completion audit.
- **Code changes in this session:** this handoff document only.
- **Tests run in this session:** none. The 75-test result is copied from the repository's existing documentation and was not rerun.
- **Current next action:** run the baseline test command and map Section 5 requirements to actual code/tests before selecting the next implementation task.
