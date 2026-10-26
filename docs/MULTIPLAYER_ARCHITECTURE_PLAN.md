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
