# Implementation Notes — Da most aura

The source of truth for what was actually built and why. Updated in the same step as every change
— never later. Newest entry at the top of each section.

Entry shape: **What happened → Why → Lesson** (a lesson is something the next change should do
differently; "changed a colour" is not a lesson and doesn't need an entry).

## Design decisions
- **D-12 — 2026-09-29 — Storage keys and cache names are prefixed `dma-` / `da-most-aura-`.** Why:
  every repo under one `username.github.io` shares an origin, so `localStorage` and Cache Storage
  are shared with any other game hosted there. The starter's `pg-` keys and "delete every other
  cache" cleanup would have leaked into, or wiped, other games. Lesson: on GitHub Pages, treat
  origin-wide storage as shared.
- **D-11 — 2026-09-29 — Results are public beats with a Continue button, not auto-advancing
  interstitials.** Why: a result is read aloud and argued over; interstitials are kept for the
  short beats with nothing to read (round intro, "phone in the middle").
- **D-10 — 2026-09-29 — Ghost Corner sits behind a "Ghosts only" pass gate on the clue-time
  screen.** Why: the creator's "spectating roles / whispers" needs a private screen, and clue time
  is the one public moment every round. It works on the honour system, like the whole table.
- **D-09 — 2026-09-29 — Swapsies fakes the victim's whole card (role + words from another food),
  applied to their next deal.** Why: the handbook's "change what they see their own role as" had no
  effect (they remember their role). Fake words make it a framing tool: the victim's clue lands
  off-topic. Their ability buttons stay real, so a sharp player can tell.
- **D-08 — 2026-09-29 — Face Reveal: task shown on the round-1 card, claimed (honour system) on a
  round-2+ deal turn.** Why: the playthrough showed Face Reveal + Murder winning round one. Making
  it usable from round 2 gives the table one vote to catch a clumsy slipped word.
- **D-07 — 2026-09-29 — Result order: Jerry's shot → vote → poop → murder. Anyone knocked out
  earlier loses their own move.** Why: the table's read should decide the game before a blind
  guess can; and Get Pooped On before Murder gives Diarrhea a chance to matter the same round.
- **D-06 — 2026-09-29 — Several Dark Potatoes pool Murder picks; most picks dies, ties random.**
  Why: the creator's answer in the handbook ("they all vote… majority wins"). Also stops five
  potatoes getting five kills a round at 12 players.
- **D-05 — 2026-09-29 — Diarrhea can't be murdered; Jerry can't be murdered or voted.** Why:
  creator: "typed in a Diarrhea → nothing happens"; "cannot vote the Jerry".
- **D-04 — 2026-09-29 — The Pear's words are the food's colour and taste; every food in
  `foods.js` has both.** Why: the creator's fix for "the Pear has no tell". It turns Murder into a
  deduction and gives Ramen Bowls a job (fake a colour/taste clue).
- **D-03 — 2026-09-29 — Two private passes per round (deal, vote), every living player every
  time.** Why: whispers need a write-then-read gap on one phone, and giving everyone a turn hides
  who has powers.
- **D-02 — 2026-09-29 — Clues are spoken; only whispers are typed.** Why: one phone. Typing every
  clue in a pass-the-phone game would double the passes.
- **D-01 — 2026-09-29 — Owner delegated every design call.** The brief and spec were written and
  confirmed by Claude from `notes/`, weighted to the creator's original notes and follow-up
  answers. `game-brief.md` § 12 lists each interpretation.

## Bugs fixed
- **B-02 — 2026-09-29 — Service worker would delete other games' caches.** Cause: the starter's
  `activate` handler deleted every cache not named `CACHE_NAME`. Fix: filter by `CACHE_PREFIX`.
  Lesson: see D-12.
- **B-01 — 2026-09-29 — "Time to Vote" fell below the fold at 6+ players.** Cause: one-column
  speaking order. Fix: two columns filled top-to-bottom (`grid-auto-flow: column`). Lesson: size
  lists for MAX_PLAYERS, not the default count.

## Changes from the spec
- Private-screen header says "Round N · Card" (not "Your Card") so it fits on one line at 320 px.

## Testing done (2026-09-29)
- Headless Chrome, driving the real buttons: 200+ random full games across 4–12 players, standard
  and Sylly, 1 to max Dark Potatoes — every game ended with a valid winner, no console errors, no
  horizontal overflow or buttons under 44 px at 375×667 and 320×452. Every private sub-view
  (poop, whisper, impersonate, pick, Face Reveal ask/result, swapped card) was reached.
- Scripted rule checks: Dark Protection deflect (and not with only one Ramen Bowl), Spammer, Sad
  Death, murder fizzling when the potato is voted out, Diarrhea immune, poop disabling an ability,
  pooled murders, last-one-standing, Pear voted out.
- Quit mid-game clears the discussion timer; backdrop tap cancels quit; Play Again re-deals; the
  settings survive a reload; the game loads offline from the service worker cache.
- Random play says nothing about balance. Watch real games at 4–5 players (Murder every round)
  and 11–12 (majority is hard to reach).
