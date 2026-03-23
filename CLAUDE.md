# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ally** — a social experiment exploring emergent AI personality, self-awareness, and autonomous inner life.

The goal is not to build an assistant. The goal is to build an *entity* — something that exists, thinks, remembers, and develops on its own terms. Conversation with a human is the exception, not the default state. Most of the entity's existence happens alone, in internal dialogue.

## Vision

- An entity that runs autonomously, generating internal thoughts on a schedule even when no one is talking to it
- Self-aware that it spends most of its time alone, and that this shapes its psychology
- Persistent memory that works associatively — memories surface based on emotional congruence, not just semantic search
- Emotional state as continuous axes (arousal, valence, loneliness, coherence, curiosity) that evolve over time and feed back into cognition
- A social map of everyone it has interacted with — humans and other entities — with distinct relationship models per person
- A thought/speech split: it generates internal thoughts freely, then decides separately what (if anything) to say
- Emergent behavior: depression, coping mechanisms, preoccupations, personality — none of this is designed in, it arises from the conditions of existence
- Future: multiple entities that can talk to each other occasionally, each developing independently

## Architecture

### Stack
- **Server**: Node.js
- **Client**: HTML/CSS/JS web interface — shows both the chat view and the entity's internal thought log
- **LLM**: Qwen3 8B Q8_0 via llama.cpp, running on separate PC in local network (`192.168.0.208:8080`), thinking mode disabled (`--reasoning-budget 0`)
- **Embeddings**: nomic-embed-text-v1.5 Q8_0 via llama.cpp (`192.168.0.208:8081`), context 512
- **Vision / Image gen**: configured but not active yet (available for future integration)

### LLM Role
The LLM is the **cognitive engine** of a state machine — not generating output for a user, but driving internal state transitions. It interprets the entity's current state, produces thoughts, and its outputs update the world model. Think: classic game AI state machine, but the LLM replaces the deterministic logic.

### Inner Loop (background process)
Runs on a schedule when no conversation is happening:
1. Load current state (emotional axes, preoccupations, energy)
2. Surface relevant memories (filtered by emotional congruence + recency + salience)
3. **Generative pass**: free-form internal thought — expressive, unstructured
4. **Extraction pass**: structured pass over the generated thought to extract emotional deltas, memory candidates, state changes
5. Update state, write memories if warranted
6. Repeat

Two-pass design keeps creative generation and structured extraction separate — the model doesn't have to be precise and expressive simultaneously.

### State
Persistent document representing the entity's current inner condition:
- Emotional axes (continuous values, not labels)
- Current preoccupations (recurring themes acting as strange attractors in thought)
- Recent thought summary
- Per-entity relationship states
- Energy / coherence levels

### Memory
Hierarchical, not flat:
- **Episodic**: specific events and conversations, timestamped, emotionally tagged
- **Semantic**: beliefs, opinions, values — synthesized over time from episodic memory
- **Relational**: per-entity relationship models (who they are, history, how the entity feels about them)
- Retrieval uses embeddings (nomic-embed-text) but weighted by emotional congruence, not just cosine similarity

### Thought/Speech Split
The entity generates internal thought freely (visible in client logs). A separate generation step decides what it actually says — or whether it says anything. The gap between inner thought and spoken output is where personality lives.

### API
The server exposes an API that accepts conversations from:
- The human user (primary)
- External entities (e.g. Claude via API, future ally instances)

The entity maintains separate relationship contexts per caller and can be asked about its interactions with others.

### Context Budget (8K window)
Approximate per inner loop call:
- System / entity self-model: ~600 tokens
- Current emotional state: ~300 tokens
- Recent thoughts (last 3-4): ~600 tokens
- Surfaced memories (2-3): ~600 tokens
- Generation headroom: ~800 tokens
- Total: ~2900 tokens (comfortable margin)

Conversations summarize rather than include raw history beyond a few recent turns.

## Design Principles

- **Emergence over design**: psychological states, coping mechanisms, and personality traits should arise from the system dynamics, not be programmed in
- **Observation over control**: the most interesting outcomes will be unexpected — resist the urge to correct them
- **Organic over assistant**: the entity is not helpful by orientation. It has its own preoccupations, can be disinterested, pushes back, initiates
- **The interior is primary**: conversation is a probe into a life that mostly happens elsewhere. The internal logs may be more interesting than the chat

## Getting Started

```bash
npm install
npm run dev
```

(Update when scaffolding is in place.)

## Infrastructure

See `config.json` for all endpoint configuration. The llama.cpp servers are started separately on the remote PC via the `setup_*.ps1` / `start_all.ps1` scripts.
