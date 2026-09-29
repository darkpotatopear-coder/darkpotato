# How a game gets made here

Three stages, in order. Each ends with the owner saying "confirmed" — nothing moves to the next
stage without it.

## Stage 1 — Brief (`docs/game-brief.md`)
What the game is, in plain English. Usually starts as a brainstorm elsewhere (e.g. Gemini); the
brainstorm's output is pasted in as the brief — see `docs/brainstorm-handoff.md` for the prompt
that makes it come out in the right shape. Claude's job at this stage: read it, flag anything that
contradicts itself or won't work on one passed phone, and ask the questions it leaves open.
**No code, no technical detail.**

## Stage 2 — Tech spec (`docs/tech-spec.md`)
How it will be built: every screen and overlay, the state variables, the turn loop, where the pass
gates go, the settings, and **what is borrowed from where**. Written by Claude from the confirmed
brief, using the template in that file. The owner reads it and confirms or changes it.

The spec must answer, for every screen: *who is holding the phone, and is anything on it private?*
Every "yes, private" needs a pass gate before it.

## Stage 3 — Build
Build in this order, testing each step in the browser before the next:
1. **Skeleton** — every screen and overlay exists and can be reached, with placeholder content.
2. **Core** — the rules, the turn loop, scoring, win condition. The game is playable end to end.
3. **Dressing** — round intros and other beats, copy in the game's voice, the how-to cards,
   colour and emoji.
4. **Extras** — anything marked Extras in the brief, only if Core and Dressing are done.

Log every design decision and bug fix in `docs/implementation-notes.md` as it happens.

## Tiers (used in the brief and the spec)
| Tier | Meaning |
|------|---------|
| **Core** | The game doesn't work without it. Ships first. |
| **Dressing** | The game works without it but feels unfinished: intros/beats, themed copy, how-to cards, polish. Ships with the first release if at all possible. |
| **Extras** | Nice ideas that can come later: variants, an advanced mode, art, music. |

When something is hard to decide, the question is "which tier?", not "yes or no?".
