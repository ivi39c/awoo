# Awoo Multiplayer Architecture Plan

Status: Proposed design; not yet implemented.
Goal: move Awoo from a local browser prototype to a reliable public multiplayer game while keeping initial development cost at zero where practical.

## 1. Product constraints

- A room supports 16–20 connected people total, including seated players and spectators.
- The selected game mode determines the number of playable seats; maximum seated players is 13.
- Remaining room members are spectators and cannot submit player actions.
- The current project is a plain HTML/CSS/JavaScript application. Preserve the existing game engine and UI where practical; do not rewrite the game wholesale.
- Prefer free tiers for development and early testing. Free-tier availability, quotas, and production suitability must be rechecked before public launch.
- Keep GitHub as the source of truth.

## 2. Proposed service split

### Frontend hosting
- First option to evaluate: Cloudflare Pages connected to this GitHub repository.
- Keeping GitHub Pages is also acceptable during the first proof of concept; frontend hosting is not the first blocker.
- No secrets or service-role keys may be shipped to browser code.

### Room data and realtime transport
- Evaluate Supabase for authentication, database storage, room membership, and low-volume realtime events.
- Use private channels and server-side authorization for production.
- Presence may indicate who is connected, but must not be treated as the authoritative game state.
- Broadcast events should be small and purposeful. Do not repeatedly broadcast the entire game state.

### Authoritative game logic
- Game-critical actions must be validated and resolved in trusted server-side code.
- The browser may perform optimistic UI validation for responsiveness, but it is not a security boundary.
- The server must validate room membership, seat ownership, actor identity, phase, target validity, action uniqueness, and permissions before accepting an action.
- Do not send hidden roles, secret night actions, or private role results to clients that are not entitled to receive them.
- Evaluate Supabase Edge Functions and/or Cloudflare Workers for server-side actions after a small prototype proves the needed concurrency and consistency behavior. Do not assume realtime messaging alone provides authoritative game logic.

### Voice and video
- Use WebRTC for media; signaling and room authorization are separate responsibilities.
- Test direct peer connections first. TURN relay may be required for users behind restrictive NATs/firewalls and may introduce costs.
- Keep media transport replaceable so a future SFU/TURN provider can be added without rewriting game rules.
- Do not promise unlimited free media at launch; measure bandwidth, connection reliability, and relay usage.

## 3. Room and seat model

- `room.maxMembers`: configured to 16–20, counting seated players and spectators.
- `room.seatCount`: selected game mode's seat count, never above 13.
- A member has one server-controlled membership status: `seated` or `spectator`.
- A seat can be occupied by at most one authenticated/identified member.
- The host may configure the room in the lobby; after the game starts, seat changes are rejected unless a future explicit game rule permits them.
- Spectators can receive only public room/game information and must not submit player actions.
- Host permissions are checked on the server, not trusted from a client-side `isHost` flag.
- A disconnect does not immediately delete a player. Preserve membership/state for a bounded reconnect window and define a later timeout policy.

## 4. Game state and event model

The server owns the authoritative state:
- room ID, host/member identities, seat assignments, spectator status, readiness;
- game mode/ruleset, current day and phase;
- role assignments and private role state;
- validated night actions, votes, deaths, sheriff/badge state, and win result;
- monotonically increasing state/event version for ordering and reconnect recovery.

Clients submit commands such as `join_room`, `set_ready`, `start_game`, `submit_night_action`, `cast_vote`, and `leave_room`. The server validates each command and returns the allowed public update plus actor-specific private updates.

Use idempotency/action IDs or equivalent deduplication so reconnects and retries do not apply the same vote/action twice. Reject stale commands that target an earlier phase/version.

## 5. Media privacy rules

All voice/video permissions must be enforced by the media/session layer as well as reflected in the UI.

- Audio remains enabled according to the agreed game rules; the client UI must not imply that a video-visibility change also mutes audio.
- During the werewolf action, werewolves can see the other eligible werewolf video feeds. Non-werewolves see only their own video, while hearing room audio as allowed by the game rules.
- During a divine-role action, the active role may see all seated players' video feeds; other players see only their own video.
- Spectators do not publish player video or microphone by default and cannot use a spectator client to perform player actions.
- When a player disables their camera, stop sending the video track; hiding a video element is not sufficient.
- Do not rely only on frontend filtering to protect secret video or role information.

These rules need explicit decisions for exceptional cases (dead players, eliminated active roles, disconnected players, and post-game rooms) before media implementation.

## 6. Delivery stages

### Stage 0 — Baseline audit
- Keep the current local prototype working.
- Inventory current room/lobby functions and separate local-only behavior from network behavior.
- Record current automated test baseline.
- Do not add a production provider dependency yet.

### Stage 1 — Cloud room skeleton
- Create a development Supabase project and minimal schema/policies.
- Support room creation, join by code, member list, host identity, seats/spectators, and ready state.
- Validate a 2-browser test before testing 20 members.
- Add server-side authorization and basic reconnect handling.
- No WebRTC in this stage.

### Stage 2 — Server-authoritative game
- Move or wrap game-critical transitions and actions in trusted server-side functions.
- Keep `game-engine.js` as the reusable domain logic where practical; add an adapter rather than duplicating rules in the client.
- Add tests for unauthorized actions, stale phase commands, duplicate actions, hidden role privacy, host disconnect, and reconnect.

### Stage 3 — Multiplayer acceptance
- Test 2, then 6, then 13 seated players with spectators, and finally 16–20 total room members.
- Verify role privacy, vote/action consistency, host transfer or host-loss policy, reconnect, and room cleanup.
- Measure database size, realtime messages, egress, and function usage.

### Stage 4 — Voice/video
- Implement signaling and peer connection lifecycle.
- Enforce phase/role-specific video visibility and spectator publish restrictions.
- Test permission denial, device removal, mobile backgrounding, reconnect, and TURN fallback.
- Only then estimate the cost of public use.

### Stage 5 — Public beta readiness
- Add rate limits, abuse reporting/moderation controls, safe room codes, operational logs without secret role leakage, backup/recovery, privacy notice, and usage monitoring.
- Define what happens when a free quota is exhausted; never silently corrupt or partially advance a match.

## 7. Acceptance criteria for the first milestone

1. Two separate browsers can create/join the same room and see the same member/seat/readiness state.
2. Total membership is limited to the configured room cap (within 16–20), and seated players cannot exceed the selected mode or 13.
3. Spectators cannot occupy a seat or submit game actions.
4. Refresh/reconnect restores the member's valid room identity and current public state.
5. A user cannot impersonate the host or another seat by changing browser-side state.
6. No hidden role or private action is included in public room broadcasts.
7. Existing local test mode remains available and automated checks pass.

## 8. Risks and non-goals

- Free-tier limits can change and do not guarantee a permanently free public service.
- Peer-to-peer mesh video scales poorly as the number of visible feeds grows; TURN relays can cost money. An SFU may be required later.
- Supabase Realtime is a transport/presence capability, not by itself a secure authoritative game server.
- This document is a proposed plan, not evidence that multiplayer, authentication, WebRTC, or deployment has already been implemented.
- Large UI redesign and adding more role skills are out of scope for the first multiplayer room milestone.


## 9. Baseline audit of current `main` (2026-10-26)

This audit is based on the current default branch files, not on assumptions about a deployed backend.

### Confirmed reusable foundations

- `js/game-engine.js` is intentionally written as pure/domain logic and can be imported by Node.js tests. This is the strongest candidate to preserve as shared game-rule logic.
- `js/game-flow.js` centralizes legal phase transitions and speaking order.
- `js/ruleset.js` and `js/role-database.js` already separate rule configuration and role metadata from the browser controller.
- `package.json` has dependency-free Node test and syntax-check scripts. These should remain available throughout multiplayer work.

### Confirmed local-only boundaries

- `js/app.js` owns `roomState` in browser memory, including room ID, host flag, players, spectators, phase, votes, history, and timers. This is not shared between browsers and is lost on refresh unless separately reconstructed.
- The room ID is generated in the browser. Existing create/join interactions are prototype flows, not server-validated membership.
- The `Player` model has local media flags and a `stream` reference, but no authoritative server identity or readiness field.
- The current media controls call `navigator.mediaDevices.getUserMedia` for local capture. A browser-local `MediaStream` does not establish remote media transport; WebRTC signaling/peer lifecycle still needs implementation.
- `isHost` and perspective state are browser-controlled in the prototype and must never be trusted for multiplayer authorization.

### Product mismatch to resolve before Stage 1

- The product decision is a maximum of 13 seated players, with 16–20 total room members including spectators.
- The current `index.html` lobby offers standard configurations through 16 players, and `js/app.js` has a 16-player standard configuration. This is a real mismatch. Do not silently expose 14–16 seat modes in the multiplayer room skeleton. In Stage 1, enforce the server-side cap of 13 seats and align the multiplayer setup options with the product decision; preserve any legacy local test options only if clearly isolated from real rooms.

### Implementation consequence

Do not retrofit network calls throughout `app.js` in one pass. Introduce a narrow room-service adapter for create/join/leave, member list, seat/spectator status, readiness, and reconnect. Keep local test mode on its current local path. Stage 1 must not deal roles or start authoritative matches yet.

## 10. Stage 1: concrete room-skeleton contract

### Minimum data model

Use the following as a proposed logical schema; exact SQL and provider-specific policy syntax must be reviewed before applying it.

- `rooms`: internal ID, join code, host member ID, lifecycle status (`lobby` / `in_game` / `closed`), configured seat count (6–13), member cap (16–20), created/updated timestamps.
- `room_members`: room ID, authenticated or securely issued member ID, display name, membership status (`seated` / `spectator`), optional seat number, ready flag, connection/reconnect metadata, joined/last-seen timestamps.
- Enforce unique room join code, unique membership per room/member, and unique seat number per room where seat number is not null. A transaction or server-side function must reserve seats atomically to prevent two people taking the same seat.
- The room creator becomes host only through a server-validated create-room operation. A client-supplied `isHost` flag is not authorization.
- Keep role assignments, votes, night actions, and private results out of Stage 1 tables and public room broadcasts.

### Minimum server operations

- `create_room(seat_count, member_cap, display_name)`
- `join_room(join_code, display_name)`
- `set_ready(ready)`
- `claim_seat(seat_number)` and `become_spectator()`, lobby only
- `leave_room()`
- `get_public_room_snapshot()`

These are logical operations, not implemented API names. Each operation must derive the caller identity from the authenticated session or a server-validated guest identity, check membership and lifecycle, and return only public room data. Do not accept a client-provided member ID as proof of identity.

### Guest identity decision

For a free-first prototype, compare Supabase anonymous authentication against a short-lived server-issued guest token before implementation. Do not rely on a display name or room code alone to prevent identity spoofing. Document the chosen reconnect behavior before building it.

### Stage 1 acceptance tests

1. Two separate browser profiles can create and join the same room and observe the same public member list.
2. The server rejects member 21 when the room cap is 20.
3. The server rejects a seat above the configured seat count or above 13.
4. Two concurrent seat claims for the same seat cannot both succeed.
5. Spectators cannot claim a seat or submit readiness as a seated player.
6. Non-host members cannot change host-only room settings.
7. Refresh/reconnect restores the same member identity within the documented reconnect window.
8. Public snapshots contain no roles, private actions, or private role results.
9. Existing local test mode and `npm run check` remain functional.

### Stage 1 non-goals

- No role dealing, night actions, voting, win resolution, or server-authoritative game loop.
- No microphone/camera transport or WebRTC.
- No full UI redesign.
- No production promise of permanent zero-cost hosting.
