# Tech Spec — Da most aura

> Stage 2. Written by Claude from the confirmed brief. Status: **CONFIRMED** (2026-09-29, the
> owner delegated sign-off). The plan, not the record — once the build starts,
> `implementation-notes.md` wins where they differ.

## 1. Screen flow
```
menu → setup → reveal("X is Jerry") → [ROUND]
ROUND:  interstitial(round intro)
        → for each living player: pass-gate → private(deal)
        → interstitial("phone in the middle") → table (clue time)  ⇄ pass-gate → ghost
        → for each living player: pass-gate → private(vote)
        → interstitial("the votes are in") → reveal × n
        → next ROUND, or gameover
gameover → (again-overlay) → reveal("X is Jerry") … | menu
```

## 2. Screens
| Screen id | Purpose | Who holds the phone | Private? | Pass gate before it? |
|---|---|---|---|---|
| `screen-menu` | Home | anyone | no | — |
| `screen-setup` | Count, names, Sylly, Dark Potato count | host | no | — |
| `screen-interstitial` | Round intro / hiding beats | table | no | — |
| `screen-pass-gate` | Name who takes the phone next | table | no | — |
| `screen-private` | Deal turn (card, whisper, Dark Potato powers) and vote turn (whispers, vote, shot/murder/poop) | one player | **yes** | **yes** |
| `screen-table` | Clue order, silenced players, timer, go to vote | table | no | — |
| `screen-ghost` | Spectating: every role and whisper | ghosts | **yes** | **yes** ("Ghosts only") |
| `screen-reveal` | Jerry announcement and result beats, one at a time | table | no | — |
| `screen-gameover` | Winner, cause, every role | table | no | — |

The private screen is The Stack: header, `#private-stage`, `#private-controls`. Its sub-views
(whisper compose, target pick, Face Reveal) are re-renders of the stage and controls, not new
screens, so they stay behind the same pass gate.

## 3. Overlays
| Overlay id | Pattern | Opened from | Dismiss button id |
|---|---|---|---|
| `settings-overlay` | data sheet | menu | `btn-settings-done` |
| `how-to-overlay` | data sheet | menu, every `[?]` | `btn-how-to-close` |
| `tip-overlay` | decision modal | ability `[?]` on the private screen | `btn-tip-close` |
| `quit-overlay` | decision modal | every ✕ during play | `btn-quit-cancel` |
| `again-overlay` | decision modal | game over | `btn-again-cancel` |
| `sound-overlay` | decision modal (engine) | every 🔊 | `btn-sound-done` |

## 4. State (all in `js/game.js`, memory only)
| Variable | Type | Reset when | Meaning |
|---|---|---|---|
| `playerCount`, `sylly`, `dpCount` | int, bool, int | kept between games | Host setup |
| `players[]` | `{name, role, alive, words, shownCard, shots, dp, pendingPoop}` | new match | `dp` = `{taskWord, taskDone, used:{}, disabled:Set}` |
| `round` | int | new match | 1-based |
| `food` / `usedFoods` | object / Set | new match | This round's food |
| `queue`, `queuePos`, `phase` | int[], int, `'deal'｜'vote'` | each pass | Private-turn order |
| `whispers[]` | `{from, as, to, text}` | each round | `as` = shown sender (Impersonating) |
| `silenced` | Set | each round | Eat Ramen targets |
| `stalks` | Map dp→target | each round | Stalking |
| `roundUsed` | Map dp→Set | each round | Per-round abilities already used |
| `armed` | Set | each round | Dark Protection armed |
| `pendingSwaps` | Set | consumed at next deal | Swapsies targets |
| `votes`, `murders`, `poop`, `shot` | Map, Map, obj, obj | each round | Locked-in vote-turn choices |
| `draft` | object | each private turn | Choices before Lock It In |
| `beats[]`, `beatPos` | array, int | each results phase | Reveal queue |
| `discussTimer`, `discussLeft` | handle, int | leaving the table | Discussion countdown |
| `winner`, `winCause` | string | new match | Set by `checkWin()` |

## 5. Settings
| Setting | Options (label → value) | Default | Stored as |
|---|---|---|---|
| Discussion Timer | Off → 0, 2 min → 120, 3 min → 180, 5 min → 300 | 180 | `dma-timer` |
| Whispers | ON / OFF | ON | `dma-whispers` |
Setup choices (count, names, Sylly, Dark Potatoes) are kept in memory for Play Again, not saved.

## 6. The turn loop
`startMatch()` → deal roles → `showJerryReveal()` → `startRound()`:
1. `startRound()` — pick food, deal words, build fake cards from `pendingSwaps`, clear round state,
   interstitial → `beginPass('deal')`.
2. `beginPass(phase)` → `nextTurn()` → pass gate → `renderPrivate()` … `finishTurn()` → `nextTurn()`.
3. After the deal pass: interstitial → `showTable()` starts `discussTimer` (gameInterval).
   **Cleared** in `goToVote()` and by `resetToMenu()`.
4. After the vote pass: interstitial → `resolveRound()` builds `beats[]` in order: shot → vote →
   poop (silent) → murder, calling `checkWin()` after each death; stops at the first win.
5. `showBeat()` steps through; at the end → `showGameOver()` if `winner`, else `startRound()`.

## 7. Data
`js/foods.js` — globals `FOODS` (`{name, emoji, colour, taste, words[14]}`), `DECOYS` (gross
foods for the Dark Potato's card), `FOOD_BANK` (Face Reveal task words). Loaded after `engine.js`,
before `game.js`. Added to `sw.js` `PRECACHE_URLS`.

## 8. Borrowed patterns
| From | What | How it's adapted here |
|---|---|---|
| This starter's DEMO | pass gate → private turn loop | Two passes per round (deal, vote) |
| Werewolf-style apps | Every player gets a private turn every phase | Hides who has powers |

## 9. Sounds
| Moment | Sound |
|---|---|
| Pass gate confirm, Start, Deal Us In | `playLaunch` |
| Choosing a player / option | `playPillClick` |
| Whisper sent, Swapsies, Eat Ramen, no majority | `playWhoosh` |
| Lock It In, Hide & Pass, Continue | `playDone` |
| Dark Potato caught, good team wins | `playSuccess` |
| Honourable / Sad Death, pooped on, Dark Potato wins | `playBoing` |
| Discussion timer last 5 s / time up | `playTick` / `playAlarm` |
| Quit confirm, back to menu | `playExit` |

## 10. Build order
- [x] Skeleton: every screen and overlay reachable
- [x] Core: roles, deal, clue table, vote, abilities, results, win checks, game over
- [x] Dressing: copy, How to Play, ability tips, ghost corner, timer, brand
- [ ] Extras: round history, custom food lists

## 11. Risks and open questions
- Pass count: two private passes per round (≈ 2 × players). Mitigated by short vote screens.
- Face Reveal's task is honour-system — the phone can't hear the clue.
- A stall is possible if every Murder is pooped away and the table keeps skipping; the ✕ quit
  covers it.
