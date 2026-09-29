# Project: Da most aura

"Da most aura" (tagline: The Dark Potato and The Pear) — a pass-the-phone hidden-role bluffing
game for 4–12 players (5+ in Sylly Mode), built as an offline-capable web app (PWA) and hosted free
on GitHub Pages. One phone, passed around the table. No accounts, no server, no multiplayer
networking. A standalone project for its creator — nothing here is shared with any other game.

The creator's own notes are in `notes/` (read-only history). Keep the creator's names exactly:
"Da most aura", Jerry, The Pear, Ramen Bowl, The Dark Potato (always with "The"), Diarrhea,
Sylly Mode, and every ability and death name.

## Files
| File | What it owns |
|------|-------------|
| `index.html` | Every screen (`<section id="screen-…">`) and overlay (`id="…-overlay"`) |
| `css/styles.css` | Font, **the brand colour (`:root` variables — change them there only)**, overlays, pills, toggles, menu buttons, motion |
| `js/engine.js` | Game-agnostic: sounds (`play*()`), `showScreen`, `openOverlay`/`closeOverlay`, `showPassGate`, `showInterstitial`, `gameTimeout`/`gameInterval`, `resetToMenu`, `shuffle`, `formatTime` |
| `js/foods.js` | The food bank: `FOODS` (name, emoji, colour, taste, 14 words), `DECOYS`, `FOOD_BANK` |
| `js/game.js` | Everything about THIS game: settings, state, rules, what each screen shows |
| `sw.js` | Offline cache. **Bump `CACHE_NAME` on every publish; add every new file to `PRECACHE_URLS`** |
| `docs/` | The brief, the tech spec, the implementation notes, the process |

Load order: `tailwind-play.js` (in `<head>`) → `engine.js` → `foods.js` → `game.js`. No modules, no build step,
no npm. All symbols are global.

## Workflow — three stages, one at a time
Read `docs/process.md`. Stage 1 brief (`docs/game-brief.md`) → Stage 2 tech spec
(`docs/tech-spec.md`) → Stage 3 build. All three are done for v1; a new feature goes through the
same stages. Do not write game code for a new feature before the owner confirms its spec.
Record decisions and bugs in `docs/implementation-notes.md` in the same response as the change —
it is the source of truth once the build starts; the brief and spec are the plan, and plans drift.

## Rules that are easy to break

**The Stack (every gameplay screen).** `<section class="flex items-center justify-center w-full
min-h-screen px-5 py-8 overflow-y-auto">` holding ONE column `<div class="flex flex-col w-full
max-w-sm gap-4">` with Header, Stage and Controls as siblings inside it. Never put the buttons in a
separate wrapper, never use `my-auto`, never `h-screen` + `flex-1`. `screen-turn` is the reference.

**Every screen has** 🔊 (`.btn-open-sound`) and, during play, `[?]` (how to play) and ✕ (quit →
confirm → menu). Exception: an auto-advancing screen with no buttons (`screen-interstitial`).

**Pass-the-phone gate.** Before ANY screen showing one player's private information, call
`showPassGate({ heading: 'Pass to <name>', onConfirm })`. No back button on it. Here that is
`screen-private` (deal and vote turns) and `screen-ghost`. A private screen's sub-views (whisper,
target pick, Face Reveal) re-render `#private-stage`/`#private-controls` behind the same gate.

**Two overlay patterns only.** Data sheet (settings, how to play: `overlay-data-backdrop` +
`overlay-data-inner settings-slide-up`) or decision modal (quit, play again, tip:
`overlay-modal-backdrop` + `overlay-modal-inner … border brand-border`). The dismiss button's id
must end in `-cancel`, `-close` or `-done` so tapping the backdrop works.

**Timers.** Only `gameTimeout` / `gameInterval` (engine.js). `resetToMenu()` clears them all, so
quitting can never leave one running. Clear a turn timer yourself when a turn ends early.

**State.** Match state lives in memory only. `localStorage` holds settings and sound preferences —
never a game in progress. Wrap access in `safeGet`/`safeSet`. Every key starts with `dma-`, and
`sw.js` only deletes caches starting with `CACHE_PREFIX`: on `username.github.io` all repos share
one origin, so unprefixed keys or caches would collide with other games.

**Buttons.** Action button labels carry no emoji. Colour: brand (`brand-cta`) for proceed/confirm;
stone for cancel/back; red only for a destructive confirm (quit). Touch targets ≥ 44 px
(`min-h-11`). Settings pills keep `.pill` always and toggle only `.pill-active`. A setting's
concrete value goes on a line under the pills, not in the pill label.

**Motion.** Animate `transform` and `opacity` only; ≤ 300 ms except overlays; never `ease-in`.
Name the property (`transition-transform`), not `transition-all`. The reduced-motion block in
`styles.css` covers CSS animation; a `requestAnimationFrame` animation must check
`prefers-reduced-motion` itself.

**Sound.** All effects are synthesised in `engine.js`. Reuse the existing `play*()` calls — map a
game moment to an existing sound rather than adding a new one.

**Offline.** Every new file (image, data) goes in `sw.js` `PRECACHE_URLS`, and the version in
`CACHE_NAME` is bumped on every publish. Keep images small (≲ 40 KB each at the size they're shown).

**Copy.** Australian English (colour, organise), metric units. One touch of playful voice per
screen where it fits naturally; never forced.

## Testing
`node tools/serve.js` → http://localhost:8080. Check at phone sizes 375×667 and 320×452 (browser
dev tools → device toolbar). Play a full match with the minimum (4) AND a high player count (10–12,
Sylly Mode on, several Dark Potatoes) before every publish.

**Food bank rules** (`js/foods.js`): every food needs a clear `colour` and `taste` (they are The
Pear's words), and 14 `words` that are neither a colour, a taste, nor the food's own name.

<!-- REFERENCE LIBRARY — remove this section before handing the project over.
While building, patterns may be borrowed from the owner's reference project at
D:\Coding Projects\Little-Sylly-Games. Treat it as READ-ONLY: read, never write,
never commit to it, never mention this project in it. Grep first; its big files
(index.html, docs/code-map.md) must never be read whole. Useful entry points:
  - docs/game-identities/<abbr>.md — what each game is and every beat of its flow
  - src/screens/<abbr>.html        — a game's markup (small enough to read whole)
  - js/games/<abbr>.js             — a game's logic (Grep for the function first)
Port the idea into this project's simpler engine — do not copy multiplayer code,
the lobby, or anything that assumes more than one game. -->
