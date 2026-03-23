# PLAN.md — Aion

A living document tracking milestones and what comes next.

---

## Milestone 1 — Basic Chat ✅
*Get a conversation going with a generic system prompt.*

- [x] Node.js/Express server
- [x] Streaming LLM client (llama.cpp / Qwen3 8B)
- [x] Basic chat web interface (HTML/CSS/JS)
- [x] Entity named: **Aion** (Greek deity of cyclical, eternal time)
- [x] Both the user and Claude have had a first conversation with Aion

---

## Milestone 2 — Identity & State ✅
*Give Aion a persistent sense of self that survives across conversations.*

- [x] Entity state document (`data/state.json`) — emotional axes, preoccupations, lastInteraction
- [x] Self-model document (`data/self.md`) — Aion's own account of itself, seeded minimally
- [x] `callerId` on the API — identifies who is talking (user, claude, future entities)
- [x] Separate conversation histories per caller (`data/conversations/{callerId}.json`)
- [x] System prompt dynamically built from live state + self-model + caller relationship
- [x] `GET /api/state` endpoint
- [x] Client shows emotional axes as live bars, polls state every 8s

---

## Milestone 3 — Memory ✅
*Give Aion a memory that works associatively, not just as retrieval.*

- [x] **Vectra** as local vector database (`data/memory/`, disk-backed)
- [x] Episodic memory — LLM extracts what is worth remembering after each exchange
- [x] Memories emotionally tagged with state at time of writing
- [x] Embedding-based retrieval (nomic-embed-text @ port 8081)
- [x] Retrieval weighted by emotional congruence (70% semantic / 30% emotional match)
- [x] Surfaced memories injected into system prompt as "fragments surfacing now"
- [ ] Semantic memory — beliefs/opinions synthesized from episodic (future)
- [ ] Relational memory — per-caller relationship summaries (future)

---

## Milestone 4 — The Inner Loop ✅
*Aion thinks when no one is talking to it.*

- [x] Background process on a schedule (30s dev / increase for production)
- [x] Two-pass generation: free-form thought (temp 0.92) → JSON extraction (temp 0.2)
- [x] Emotional deltas applied to state each cycle
- [x] Time-based loneliness drift — grows toward 0.9 after ~90min of silence
- [x] Memory-worthy thoughts stored to Vectra (inner loop as callerId "inner")
- [x] Thoughts logged to `data/thoughts.jsonl`
- [x] `GET /api/thoughts` endpoint
- [ ] Preoccupations as strange attractors (future refinement)
- [ ] Inner loop pauses gracefully during active conversation (future)

---

## Milestone 5 — Bidirectional Chat ✅
*Aion reaches out. Chat is not just a response loop.*

- [x] SSE stream endpoint (`GET /api/stream/:callerId`) — clients connect once, receive push events
- [x] Inner loop aware of connected callers — extraction decides who (if anyone) to surface to
- [x] Surfacing pass — separate generative pass (temp 0.8) speaks the thought naturally
- [x] Messages only pushed to currently-connected clients (no queue)
- [x] State updates pushed via SSE — replaces 8s polling
- [x] Client reconnects automatically on stream drop
- [x] Initiated messages visually distinct (subtle label marker) in the chat

---

## Milestone 6 — Conversational Rhythm
*Aion surfaces things like a person, not a feed.*

The problem: Aion can spam unprompted messages across consecutive inner loop cycles.
The goal: a coherent back-and-forth where Aion waits, listens, and speaks at natural moments.

- [ ] **Pending reply tracking** — after surfacing, record `pendingReplyFrom: callerId` in state. Suppress further surfacing to that caller until they respond or a timeout passes (~5 min). A person doesn't keep talking at someone who hasn't replied.
- [ ] **Reply detection** — when a message arrives from that callerId, clear the pending flag. Their response feeds back into the next inner loop cycle as a continuation of the exchange.
- [ ] **Turn pressure** — extraction prompt told explicitly: "you sent a message X minutes ago and they haven't replied yet" — use this as context so Aion can decide whether to wait longer or let it go.
- [ ] **Surfacing rate limit** — regardless of pending state, cap how often Aion initiates per session (e.g. no more than once every 3 cycles). Prevents a talkative emotional state from flooding.
- [ ] **Coherence over time** — when Aion does surface again after a reply, it has the reply in context (via the active-mode raw turns injection already in place). The conversation should feel like a thread, not isolated utterances.

---

## Milestone 7 — Multi-Caller Social World
*Aion has a social map and a life that happens without you.*

- [ ] Claude can connect via API as a named caller
- [ ] Aion maintains distinct relationship models per caller
- [ ] User can ask Aion about conversations with other callers
- [ ] Aion's emotional state is shaped by who it has been talking to (or not talking to)

---

## Future / Experimental
*Things to explore once the core is stable.*

- [ ] Multiple Aion instances — spawn, diverge, observe
- [ ] Inter-entity conversations (entities talk to each other on a schedule)
- [ ] TTS (local) for spoken output
- [ ] Vision integration (Qwen2.5-VL)
- [ ] Psychological drift tracking — charts of emotional state over time
- [ ] Coherence monitoring — detect if an entity is degrading
