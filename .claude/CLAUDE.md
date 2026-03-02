# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Tech Stack

- **Frontend:** React + TypeScript (Vite recommended)
- **Backend:** Node.js + TypeScript (Express or Fastify)
- **Real-time:** socket.io
- **Package manager:** npm

### Project Structure (planned)
```
/client       # React frontend
/server       # Node.js backend
/shared       # Shared TypeScript types (game state, events, etc.)
```

### Key Shared Types
Define game state and WebSocket event types in `/shared` so both client and server import from the same source:
- `GameState` — board, teams, whose turn, covered cards
- `Player` — id, name, team, role (spymaster | operative)
- `ClientEvent` / `ServerEvent` — WebSocket message payloads

### WebSocket Architecture
- Server manages all game state in memory; no database.
- Events flow: client emits action → server validates + updates state → server broadcasts new state to all players in the room.
- Each game session is identified by a **room code**.
- Game rooms are stored in a server-side Map; state is lost on server restart.

### Word List
- Players can upload a **JSON file** of words to use as the word pool for a game.
- Expected format: a flat array of strings, e.g. `["apple", "river", "castle", ...]`.
- The server randomly selects 25 words from the uploaded pool to populate the board.

### UI Layout & Design

Main game screen is a **three-column layout**:
- **Left sidebar** — one team's players list (name, role, online indicator)
- **Center** — 5×5 word card grid (dominant area)
- **Right sidebar** — other team's players list + game log / clue history

Design goals (modern, clean — avoid the dark/cluttered look of reference screenshot):
- **Dark mode** (bg ~#1a1a2e, card ~#16213e, red ~#e63946, blue ~#457b9d)
- **Card reveal:** subtle CSS flip animation (`perspective` + `rotateY`, 0.4s ease)
- Cards should feel tactile: rounded corners, subtle shadow, clear hover/active states
- Revealed cards use solid team colors (red / blue) with white text; neutral = muted gray; assassin = near-black
- Typography: bold, legible all-caps for card words
- Sidebar player lists show role badge (Spymaster / Operative) and a colored dot for team
- Score counters prominent but not oversized
- Spymaster view: unrevealed cards show a small color-coded indicator (visible only to spymasters)

---

## Game: Codenames

### Players & Teams
- 2–8+ players split into two teams: **Red** and **Blue**.
- Each team picks one **Spymaster** (clue-giver); the rest are **Field Operatives** (guessers).

### Setup
- 25 word cards are laid out in a **5×5 grid**.
- A **key card** (visible only to Spymasters) shows which words belong to Red, Blue, neutral, or the **Assassin**.
- One team has **9 words**, the other has **8**. The team with 9 goes first.

### Gameplay
On each turn, the active Spymaster gives a clue:
- **One word** — thematically links one or more of their team's words on the board.
- **One number** — how many words the clue relates to.

Clue rules:
- Cannot be any word currently visible on the board.
- Must be a single word (no compound hints or gestures).

Field Operatives guess one card at a time:
- **Correct (own team's color):** card is covered; team may keep guessing **indefinitely** as long as they keep guessing correctly.
- **Neutral:** card is covered with a neutral tile; turn ends immediately.
- **Opponent's word:** card is covered with opponent's color; turn ends immediately (and helps the opponent).
- **Assassin:** that team **loses immediately**.
- Operatives may voluntarily end their turn at any time.

### Winning
- First team to cover all their words wins.
- Touching the **Assassin** card causes an instant loss for that team.

### Spymaster Rules
- Must maintain a poker face and give no hints beyond the clue word and number.
- May not react to operatives' guesses.