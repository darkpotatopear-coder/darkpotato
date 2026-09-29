# Da most aura

**The Dark Potato and The Pear** — a pass-the-phone bluffing game for 4–12 players. Jerry knows the
secret food. Everyone else gets two clue words about it — except The Dark Potato, who got mouldy
cheese and has to bluff. The Dark Potato is hunting The Pear; everyone else is hunting The Dark
Potato.

Works in any phone browser, installs to the home screen, and plays offline once opened. The full
rules are in the game (How to Play) and in `docs/game-brief.md`.

---

## Try it on your computer
You need [Node.js](https://nodejs.org) (any recent version). In this folder:

```
node tools/serve.js
```

Open http://localhost:8080. To try it on a phone, connect the phone to the same Wi-Fi and open
`http://<your computer's IP>:8080` (on Windows, `ipconfig` shows the IP as "IPv4 Address").
Press Ctrl+C in the terminal to stop.

Opening `index.html` by double-clicking mostly works too, but offline support only runs through a
server.

---

## Put it online (one-time setup, free)

1. **Make a GitHub account** at https://github.com if you don't have one.
2. **Create a new repository** (the ➕ at top right → *New repository*). Give it a name, make it
   **Public** (free GitHub Pages needs a public repository), and don't tick any of the
   "initialise" boxes.
3. **Push this folder to it.** In this folder, in a terminal (Git must be installed —
   https://git-scm.com):
   ```
   git init
   git add .
   git commit -m "First version"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
4. **Turn on GitHub Pages.** On the repository page: *Settings → Pages → Build and deployment →
   Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save*.
5. After a minute or two the game is live at
   `https://<your-username>.github.io/<repo-name>/`. Open that on a phone and use the browser's
   *Add to Home Screen* to install it.

There is no server, database or account system to set up — the game runs entirely on the phone.

---

## Publishing a change

1. Make the change and test it locally (`node tools/serve.js`).
2. **Open `sw.js` and bump the version in `CACHE_NAME`** — `CACHE_PREFIX + 'v1'` → `'v2'`, and so
   on. Every time. Without this, phones that already have the game keep the old version.
3. If you added a new file (an image, a word list), add it to `PRECACHE_URLS` in `sw.js`.
4. Publish:
   ```
   git add .
   git commit -m "What you changed"
   git push
   ```
   The live site updates within a couple of minutes. A phone that already has it picks up the new
   version the next time it's opened with a connection (sometimes it takes a second open).

---

## Where things are

| To change… | Edit |
|------------|------|
| The rules, turns, abilities, settings | `js/game.js` |
| The foods, clue words, Dark Potato decoys, Face Reveal words | `js/foods.js` |
| What's on a screen, button labels, How to Play text | `index.html` |
| The colour scheme | the five `--brand…` lines at the top of `css/styles.css` |
| The creator's original notes | `notes/` |
| The name / icon on the home screen | `manifest.json`, `icons/icon.svg`, and `<title>` in `index.html` |

Sounds are generated in code (`js/engine.js`) — there are no audio files.

## Working on it with Claude Code
Open this folder in VS Code with Claude Code. `CLAUDE.md` tells Claude how the project is built
and the rules it follows; `docs/process.md` is the three-stage way new features get designed and
built. For a bug: describe what you did, what you expected, and what happened instead.

## Credits
Game idea, roles and rules: the creator (see `notes/`). Built with Claude Code.
Font: [Fredoka](https://fonts.google.com/specimen/Fredoka), SIL Open Font Licence 1.1.
