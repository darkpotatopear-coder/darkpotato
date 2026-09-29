# Brainstorm → Brief handoff

Brainstorm the game wherever you like (e.g. with Gemini). When the ideas have settled, paste the
prompt below into that same conversation. Its answer becomes `docs/game-brief.md` — paste it in
and start a Claude session with "Stage 1: review the brief".

Don't send Claude the whole brainstorm transcript or a PDF of it: ideas that were accepted and
ideas that were dropped are mixed together in it, and it costs far more to read than the brief.
Section 10 below ("Decided against") carries the one useful thing from the transcript that the
brief otherwise wouldn't.

---

```
We're done brainstorming. Write up where we landed as a game brief, using EXACTLY these
eleven headings, in this order, in Markdown. Rules for the write-up:
- Only what we actually settled on. Where we went back and forth, use the LAST version.
- Anything not settled goes in section 11, not in the rules.
- Plain English. No code, no technical implementation.
- Australian spelling.
- The game is played on ONE phone passed around the table, for the player count below.

# Game Brief — [name]
## 1. The pitch            — one or two sentences a new player would hear
## 2. Players and table    — min / max / best player count; minutes per game; any moment the
                              phone is shown to everyone at once
## 3. Theme and voice      — setting, mood, 2–3 example lines of in-game text, a colour and an emoji
## 4. How a game goes      — numbered steps from opening the app to someone winning; for EACH step:
                              who holds the phone, and whether the screen is PRIVATE or PUBLIC
## 5. Rules                — turns, actions, round end, game end, scoring, tie-breaks — precise
## 6. Terminology          — the game's own words and what each means
## 7. Settings             — each option the host can change: name, choices, default
## 8. What we're borrowing — mechanics or ideas taken from existing games (name them)
## 9. Tiers                — a table of every feature marked Core (can't play without it),
                              Dressing (works without it, feels unfinished), or Extras (later)
## 10. Decided against     — every idea we dropped, one line each with the reason
## 11. Open questions      — everything still undecided
```
