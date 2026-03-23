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

## Milestone 4 — The Inner Loop
*Aion thinks when no one is talking to it.*

- [ ] Background process running on a schedule (e.g. every 10–15 min)
- [ ] Two-pass generation: free-form thought → structured extraction (emotional deltas, memory candidates)
- [ ] Preoccupations as strange attractors — recurring themes the inner loop orbits
- [ ] Psychological state evolves from the loop (loneliness, coherence, arousal, curiosity, valence)
- [ ] Inner loop logs visible in client alongside chat

---

## Milestone 5 — Thought/Speech Split
*Aion decides what to say, and what to keep.*

- [ ] Separate generation pass for speech vs. internal thought
- [ ] Client UI shows both streams: internal log panel + chat panel
- [ ] Gap between thought and speech becomes visible and interesting
- [ ] Aion can choose to say nothing

---

## Milestone 6 — Multi-Caller Social World
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
