// ═══════════════════════════════════════════════════════════════════════════════
// Da most aura — The Dark Potato and The Pear.
// Everything game-specific lives here: settings, state, rules, and what each
// screen shows. The engine (js/engine.js) provides showScreen, openOverlay,
// showPassGate, showInterstitial, gameTimeout/gameInterval, the play*() sounds
// and resetToMenu(). The food bank (FOODS, DECOYS, FOOD_BANK) is js/foods.js.
//
// A round: deal pass (private) → clue time (public) → vote pass (private) →
// results (public). See docs/tech-spec.md § 6.
// Depends on: engine.js, foods.js
// ═══════════════════════════════════════════════════════════════════════════════

// ── Player count and role limits (the creator's table) ─────────────────────────
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 12;
const SYLLY_MIN   = 5;
// Most Dark Potatoes allowed at each player count. Sylly Mode uses the row above.
const DP_CAP = { 4: 1, 5: 1, 6: 2, 7: 2, 8: 3, 9: 3, 10: 4, 11: 4, 12: 5 };

const ROLES = {
  jerry:    { emoji: '🐭', name: 'Jerry',           tag: 'the detective' },
  pear:     { emoji: '🍐', name: 'The Pear',        tag: 'the sacred one' },
  ramen:    { emoji: '🍜', name: 'Ramen Bowl',      tag: 'the fakes' },
  dp:       { emoji: '🥔', name: 'The Dark Potato', tag: 'the imposter' },
  diarrhea: { emoji: '💩', name: 'Diarrhea',        tag: 'Sylly Mode chaos' },
};

// Dark Potato abilities. `murder` is used on the vote turn; the rest on the deal turn.
const ABILITIES = {
  murder:         { emoji: '🔪', name: 'Murder',
    tip: ['Every vote, pick someone to take out. Not Jerry.', 'Several Dark Potatoes pool their picks — most picks wins, ties are random.', 'If you get voted out first, your murder fizzles.'] },
  eatRamen:       { emoji: '🍜', name: 'Eat Ramen',
    tip: ['Silence one player for this round: no clue, no whisper.', 'The whole table sees who got eaten.', 'Once a game.'] },
  faceReveal:     { emoji: '👀', name: 'Face Reveal',
    tip: ['Slip your secret word into your round-1 clue to unlock it.', 'From round 2, see one player\'s real role.', 'Once a game. Honour system — the phone can\'t hear you.'] },
  stalking:       { emoji: '🕵️', name: 'Stalking',
    tip: ['Pick a player. On your vote turn you\'ll read every whisper to and from them this round.', 'Every round.'] },
  swapsies:       { emoji: '🔀', name: 'Swapsies',
    tip: ['Next round, one player\'s card shows a fake role and fake words.', 'Nothing really changes — they just might embarrass themselves.', 'Every round.'] },
  impersonate:    { emoji: '🎭', name: 'Impersonating',
    tip: ['Send a whisper that looks like it came from someone else — even Jerry.', 'Every round, on top of your normal whisper.'] },
  darkProtection: { emoji: '🛡️', name: 'Dark Protection',
    tip: ['Arm it for this round. If Jerry shoots you while 2+ Ramen Bowls are alive, a random Ramen Bowl dies instead — and Jerry does too.', 'Not used up unless it goes off. Once a game.'] },
};
const DEAL_ABILITIES = ['eatRamen', 'faceReveal', 'stalking', 'swapsies', 'impersonate', 'darkProtection'];

// ── Settings (kept between games; saved on this device) ────────────────────────
const settings = {
  timer:    parseInt(safeGet('dma-timer') ?? '180', 10),
  whispers: safeGet('dma-whispers') !== 'false',
};
const TIMER_LABELS = { 0: 'No timer — tap Time to Vote when you\'re ready.', 120: '2 minutes', 180: '3 minutes', 300: '5 minutes' };

// ── Setup (the host's choices; kept in memory for Play Again) ──────────────────
let playerCount = 6;
let sylly       = false;
let dpCount     = 1;

// ── Match state (memory only — never saved mid-game) ───────────────────────────
let players      = [];          // [{ name, role, alive, words, card, shots, dp, pendingPoop }]
let round        = 0;
let food         = null;        // this round's FOODS entry
let roundDecoy   = '';          // what the Dark Potato's card says it got
let usedFoods    = new Set();
let phase        = 'deal';      // 'deal' | 'vote'
let queue        = [];          // player indices taking a private turn this pass
let queuePos     = 0;
let current      = -1;          // whose private turn it is
let view         = 'main';      // sub-view of the private screen
let draft        = {};          // choices made on this private turn, before locking in
let flash        = '';          // one-off confirmation line on the deal card
let whispers     = [];          // [{ from, as, to, text }] — `as` is who it appears to be from
let silenced     = new Set();   // Eat Ramen targets this round
let stalks       = new Map();   // Dark Potato → who they're stalking
let roundUsed    = new Map();   // Dark Potato → Set of per-round abilities used
let armed        = new Set();   // Dark Potatoes with Dark Protection armed this round
let pendingSwaps = new Set();   // Swapsies targets — their NEXT card is fake
let votes        = new Map();   // voter → target index | 'skip'
let murders      = new Map();   // Dark Potato → target index | null
let poop         = null;        // { from, target }
let shot         = null;        // { target }
let beats        = [];          // result screens to step through
let beatPos      = 0;
let afterBeats   = null;
let discussTimer = null;
let discussLeft  = 0;
let winner       = null;        // 'dp' | 'good'
let winCause     = '';

const ROUND_FLAVOUR = [
  'New food on the stove.',
  'Something smells sus.',
  'Keep your words close.',
  'The Dark Potato is hungry.',
  'Aura check.',
];

// Called by resetToMenu() — clear the match, keep the settings and setup.
function gameReset() {
  players = []; round = 0; food = null; usedFoods = new Set(); current = -1;
  queue = []; queuePos = 0; draft = {}; flash = ''; beats = []; afterBeats = null;
  discussTimer = null; winner = null; winCause = ''; pendingSwaps = new Set();
  clearRoundState();
}

function clearRoundState() {
  whispers = []; silenced = new Set(); stalks = new Map(); roundUsed = new Map();
  armed = new Set(); votes = new Map(); murders = new Map(); poop = null; shot = null;
}

// ── Small helpers ──────────────────────────────────────────────────────────────
function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dpCap() { return DP_CAP[sylly ? playerCount - 1 : playerCount]; }
function livingIdx() { return players.map((_, i) => i).filter(i => players[i].alive); }
function jerryIdx() { return players.findIndex(p => p.role === 'jerry'); }
// Living players other than `self`; `noJerry` for Murder and the community vote.
function targets(self, noJerry = false) {
  return livingIdx().filter(i => i !== self && !(noJerry && players[i].role === 'jerry'));
}
function roleLabel(role) { return `${ROLES[role].emoji} ${ROLES[role].name}`; }
function listNames(idxs) {
  const n = idxs.map(i => players[i].name);
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

function card(extra = '') { return h('div', `bg-white rounded-3xl shadow-sm p-5 flex flex-col gap-3 ${extra}`); }
function kicker(text) { return h('p', 'text-xs font-semibold uppercase tracking-widest brand-text', text); }
function button(label, kind, onClick) {
  const cls = {
    brand: 'min-h-14 w-full rounded-2xl brand-cta active:scale-95 text-xl font-semibold transition-transform duration-150',
    stone: 'min-h-14 w-full rounded-2xl bg-stone-200 hover:bg-stone-300 text-stone-700 active:scale-95 text-lg font-semibold transition-transform duration-150',
    tint:  'min-h-11 w-full rounded-xl brand-tint active:scale-95 font-semibold transition-transform duration-100',
  }[kind];
  const b = h('button', cls, label);
  b.addEventListener('click', onClick);
  return b;
}
function wordChips(words) {
  const row = h('div', 'flex flex-wrap justify-center gap-2');
  words.forEach(w => row.appendChild(h('span', 'word-chip', w)));
  return row;
}
// items: [{ value, label, wide }] — one can be selected.
function choiceGrid(items, selected, onSelect) {
  const g = h('div', 'grid grid-cols-2 gap-2');
  items.forEach(it => {
    const b = h('button', 'choice' + (it.value === selected ? ' choice-active' : '') + (it.wide ? ' col-span-2' : ''), it.label);
    b.addEventListener('click', () => { playPillClick(); onSelect(it.value); });
    g.appendChild(b);
  });
  return g;
}
function playerItems(idxs) { return idxs.map(i => ({ value: i, label: players[i].name })); }

// Inline help for one mechanic: showTip('🦊', 'Secrets', ['One short line.', 'Another.'])
function showTip(emoji, heading, lines) {
  document.getElementById('tip-emoji').textContent = emoji;
  document.getElementById('tip-heading').textContent = heading;
  const body = document.getElementById('tip-body');
  body.innerHTML = '';
  lines.slice(0, 3).forEach(l => { body.appendChild(h('p', '', '• ' + l)); });
  openOverlay('tip-overlay');
}

// ── Menu ───────────────────────────────────────────────────────────────────────
document.getElementById('btn-menu-play').addEventListener('click', () => {
  playLaunch();
  renderSetup();
  showScreen('screen-setup');
});
document.getElementById('btn-menu-how-to').addEventListener('click', () => { playPillClick(); openOverlay('how-to-overlay'); });
document.getElementById('btn-menu-settings').addEventListener('click', () => { playPillClick(); syncSettingsUI(); openOverlay('settings-overlay'); });

// ── Settings overlay ───────────────────────────────────────────────────────────
function syncSettingsUI() {
  document.querySelectorAll('[data-setting="timer"]').forEach(p => {
    p.classList.toggle('pill-active', parseInt(p.dataset.value, 10) === settings.timer);
  });
  document.getElementById('setting-timer-value').textContent = TIMER_LABELS[settings.timer] || '';
  const t = document.getElementById('btn-setting-whispers');
  t.textContent = settings.whispers ? 'ON' : 'OFF';
  t.className   = settings.whispers ? 'toggle-on' : 'toggle-off';
}
document.querySelectorAll('[data-setting="timer"]').forEach(p => p.addEventListener('click', () => {
  playPillClick();
  settings.timer = parseInt(p.dataset.value, 10);
  safeSet('dma-timer', settings.timer);
  syncSettingsUI();
}));
document.getElementById('btn-setting-whispers').addEventListener('click', () => {
  playPillClick();
  settings.whispers = !settings.whispers;
  safeSet('dma-whispers', settings.whispers);
  syncSettingsUI();
});
document.getElementById('btn-settings-done').addEventListener('click', () => { playDone(); closeOverlay('settings-overlay'); });
document.getElementById('btn-how-to-close').addEventListener('click', () => { playDone(); closeOverlay('how-to-overlay'); });
document.getElementById('btn-tip-close').addEventListener('click', () => { playDone(); closeOverlay('tip-overlay'); });

// Every in-game [?] and ✕
document.querySelectorAll('.btn-how-to').forEach(b => b.addEventListener('click', () => { playPillClick(); openOverlay('how-to-overlay'); }));
document.querySelectorAll('.btn-quit').forEach(b => b.addEventListener('click', () => { playPillClick(); openOverlay('quit-overlay'); }));
document.getElementById('btn-quit-cancel').addEventListener('click', () => { playDone(); closeOverlay('quit-overlay'); });
document.getElementById('btn-quit-confirm').addEventListener('click', () => { playExit(); resetToMenu(); });

// ── Setup ──────────────────────────────────────────────────────────────────────
function renderSetup() {
  if (playerCount < SYLLY_MIN) sylly = false;
  dpCount = Math.max(1, Math.min(dpCount, dpCap()));

  const pills = document.getElementById('setup-count-pills');
  pills.innerHTML = '';
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const b = h('button', 'pill' + (n === playerCount ? ' pill-active' : ''), String(n));
    b.addEventListener('click', () => { playPillClick(); playerCount = n; renderSetup(); });
    pills.appendChild(b);
  }

  const st = document.getElementById('btn-setup-sylly');
  st.textContent = sylly ? 'ON' : 'OFF';
  st.className = (sylly ? 'toggle-on' : 'toggle-off') + (playerCount < SYLLY_MIN ? ' opacity-50' : '');
  document.getElementById('setup-sylly-note').textContent = playerCount < SYLLY_MIN
    ? 'Needs 5 or more players.'
    : 'Adds 💩 Diarrhea to the table and gives the Dark Potato Dark Protection.';

  const cap = dpCap();
  document.getElementById('setup-dp-count').textContent = dpCount;
  document.getElementById('btn-setup-dp-more').classList.toggle('opacity-50', dpCount >= cap);
  document.getElementById('btn-setup-dp-less').classList.toggle('opacity-50', dpCount <= 1);
  document.getElementById('setup-dp-note').textContent =
    `Up to ${cap} at ${playerCount} players${sylly ? ' in Sylly Mode' : ''}. Each extra imposter replaces a Ramen Bowl.`;

  const ramen = playerCount - 2 - dpCount - (sylly ? 1 : 0);
  document.getElementById('setup-lineup').textContent =
    `🐭 1 · 🍐 1 · 🥔 ${dpCount} · 🍜 ${ramen}` + (sylly ? ' · 💩 1' : '');

  const box = document.getElementById('setup-names');
  const kept = [...box.querySelectorAll('input')].map(i => i.value);
  box.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const inp = h('input', 'w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-base text-stone-800 placeholder-stone-300 brand-focus transition-colors');
    inp.type = 'text';
    inp.maxLength = 16;
    inp.placeholder = `Player ${i + 1}`;
    inp.value = kept[i] || '';
    box.appendChild(inp);
  }
}
document.getElementById('btn-setup-sylly').addEventListener('click', () => {
  if (playerCount < SYLLY_MIN) { playBoing(); return; }
  playPillClick();
  sylly = !sylly;
  renderSetup();
});
document.getElementById('btn-setup-dp-more').addEventListener('click', () => {
  if (dpCount >= dpCap()) { playBoing(); return; }
  playPillClick(); dpCount += 1; renderSetup();
});
document.getElementById('btn-setup-dp-less').addEventListener('click', () => {
  if (dpCount <= 1) { playBoing(); return; }
  playPillClick(); dpCount -= 1; renderSetup();
});
document.getElementById('btn-setup-back').addEventListener('click', () => { playExit(); showScreen('screen-menu'); });
document.getElementById('btn-setup-start').addEventListener('click', () => {
  playLaunch();
  // Blank → "Player N"; a repeated name gets a number so every button is unambiguous.
  const seen = {};
  const names = [...document.querySelectorAll('#setup-names input')].map((inp, i) => {
    const base = inp.value.trim() || `Player ${i + 1}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? `${base} ${seen[base]}` : base;
  });
  startMatch(names);
});

// ── Match start ────────────────────────────────────────────────────────────────
function startMatch(names) {
  gameReset();
  const ramenCount = names.length - 2 - dpCount - (sylly ? 1 : 0);
  const roles = shuffle([
    'jerry', 'pear',
    ...Array(dpCount).fill('dp'),
    ...(sylly ? ['diarrhea'] : []),
    ...Array(ramenCount).fill('ramen'),
  ]);
  const taskWords = shuffle(FOOD_BANK);
  players = names.map((name, i) => ({
    name, role: roles[i], alive: true, words: [], card: null, pendingPoop: false,
    shots: roles[i] === 'jerry' ? dpCount : 0,
    dp: roles[i] === 'dp' ? { taskWord: taskWords[i], taskDone: null, used: new Set(), disabled: new Set() } : null,
  }));
  const j = players[jerryIdx()];
  beats = [{
    label: 'Meet the Detective', emoji: '🐭', heading: `${j.name} is Jerry!`,
    sub: 'Everyone knows. Even the Dark Potato. Jerry sees the secret food and hunts the imposter.',
    sound: playSuccess,
  }];
  afterBeats = startRound;
  beatPos = 0;
  showBeat();
}

// ── Round ──────────────────────────────────────────────────────────────────────
function startRound() {
  round += 1;
  clearRoundState();
  if (usedFoods.size >= FOODS.length) usedFoods.clear();
  food = pick(FOODS.filter(f => !usedFoods.has(f)));
  usedFoods.add(food);
  roundDecoy = round === 1 ? 'mouldy cheese' : pick(DECOYS);
  dealWords();
  // Swapsies from last round: the target's card this round is fake.
  players.forEach((p, i) => { p.card = pendingSwaps.has(i) && p.alive ? fakeCard(p) : null; });
  pendingSwaps = new Set();
  showInterstitial({
    emoji: '🍳',
    heading: `Round ${round}`,
    sub: ROUND_FLAVOUR[(round - 1) % ROUND_FLAVOUR.length],
    ms: 2500,
    onDone: () => beginPass('deal'),
  });
}

// The Pear gets colour + taste. Ramen Bowls and Diarrhea get two of the food's
// other words each, all different until the list runs out.
function dealWords() {
  let pool = shuffle(food.words), k = 0;
  players.forEach(p => {
    if (p.role === 'pear') p.words = [food.colour, food.taste];
    else if (p.role === 'ramen' || p.role === 'diarrhea') {
      if (k + 2 > pool.length) { pool = shuffle(food.words); k = 0; }
      p.words = [pool[k], pool[k + 1]];
      k += 2;
    } else p.words = [];
  });
}

// Swapsies: a different role, with words from a different food.
function fakeCard(p) {
  const role = pick(['pear', 'ramen', 'dp', ...(sylly ? ['diarrhea'] : [])].filter(r => r !== p.role));
  const other = pick(FOODS.filter(f => f !== food));
  const words = role === 'pear' ? [other.colour, other.taste] : role === 'dp' ? [] : shuffle(other.words).slice(0, 2);
  return { role, words, decoy: pick(DECOYS) };
}

// ── Private passes ─────────────────────────────────────────────────────────────
// Everyone alive gets a private turn in both passes, so nobody can tell who has
// powers by how long they hold the phone. The starting seat rotates each round.
function beginPass(ph) {
  phase = ph;
  const n = players.length, start = (round - 1) % n;
  queue = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (players[i].alive) queue.push(i);
  }
  queuePos = 0;
  nextTurn();
}

function nextTurn() {
  if (queuePos >= queue.length) { endPass(); return; }
  current = queue[queuePos];
  const p = players[current];
  draft = {};
  flash = '';
  showPassGate({
    heading: `Pass to ${p.name}`,
    ctaLabel: phase === 'deal' ? 'Show My Card' : "I'm Ready",
    onConfirm: () => {
      view = p.pendingPoop ? 'poop' : 'main';
      renderPrivate();
      showScreen('screen-private');
    },
  });
}

function finishTurn() {
  queuePos += 1;
  nextTurn();
}

function endPass() {
  if (phase === 'deal') {
    showInterstitial({ emoji: '📱', heading: 'Phone in the middle!', sub: 'Clue time. Jerry, zip it.', ms: 2200, onDone: showTable });
  } else {
    showInterstitial({ emoji: '🗳️', heading: 'The votes are in…', sub: 'Phone in the middle.', ms: 2200, onDone: resolveRound });
  }
}

// ── Private screen ─────────────────────────────────────────────────────────────
function renderPrivate() {
  const stage = document.getElementById('private-stage');
  const controls = document.getElementById('private-controls');
  stage.innerHTML = '';
  controls.innerHTML = '';
  document.getElementById('private-label').textContent =
    `Round ${round} · ${phase === 'deal' ? 'Card' : 'Vote'}`;
  const render = {
    poop: renderPoop, main: phase === 'deal' ? renderDealCard : renderVote,
    whisper: renderWhisper, impersonate: renderWhisper, pick: renderPick,
    faceAsk: renderFaceAsk, faceResult: renderFaceResult,
  }[view];
  render(stage, controls);
}
function goView(v) { view = v; renderPrivate(); }

// "You got pooped on" — fills the victim's screen on their next private turn.
function renderPoop(stage, controls) {
  playBoing();
  const c = h('div', 'poop-card pop-in rounded-3xl px-6 py-10 flex flex-col gap-3 text-center');
  c.append(h('div', 'text-8xl', '💩'), h('h2', 'text-3xl font-bold', 'You got pooped on!'),
    h('p', 'poop-sub', 'Someone thinks you\'re sus. That\'s all you get to know.'));
  stage.appendChild(c);
  controls.appendChild(button('Wipe It Off', 'brand', () => {
    playDone();
    players[current].pendingPoop = false;
    goView('main');
  }));
}

// ── Deal turn: your card, your whisper, Dark Potato powers ─────────────────────
function renderDealCard(stage, controls) {
  const i = current, p = players[i];
  const shown = p.card || { role: p.role, words: p.words, decoy: roundDecoy };

  if (flash) { stage.appendChild(h('p', 'flash-line pop-in', flash)); flash = ''; }

  const c = card('text-center');
  c.append(h('p', 'text-stone-400 text-sm', `${p.name}, you are`),
    h('div', 'text-5xl', ROLES[shown.role].emoji),
    h('h2', 'text-3xl font-bold text-stone-800 -mt-1', ROLES[shown.role].name),
    h('p', 'text-stone-400 text-sm -mt-2', ROLES[shown.role].tag));
  const ing = h('div', 'ingredients flex flex-col gap-2 pt-3');
  if (shown.role === 'jerry') {
    ing.append(h('p', 'text-stone-500 text-sm', 'The secret food is'),
      h('p', 'text-2xl font-bold brand-text', `${food.emoji} ${food.name}`),
      h('p', 'text-stone-400 text-sm', 'No clue from you. Listen for whoever doesn\'t fit — and never say the food.'));
  } else if (shown.role === 'dp') {
    ing.append(h('p', 'text-stone-500 text-sm', 'You got'),
      h('p', 'text-2xl font-bold brand-text', `🧀 ${shown.decoy}`),
      h('p', 'text-stone-400 text-sm', 'No food for you. Listen to the others, blend in, and sniff out The Pear.'));
  } else {
    const hint = {
      pear: 'Always the colour and the taste. Hint at them without screaming "Pear".',
      ramen: 'Be a shield: make the Dark Potato think you might be The Pear.',
      diarrhea: 'Play it like a Ramen Bowl. You can\'t be murdered.',
    }[shown.role];
    ing.append(h('p', 'text-stone-500 text-sm', 'Your words'), wordChips(shown.words), h('p', 'text-stone-400 text-sm', hint));
  }
  c.appendChild(ing);
  stage.appendChild(c);

  // Dark Potato's Face Reveal task — round 1 only
  if (p.role === 'dp' && round === 1 && !p.dp.disabled.has('faceReveal')) {
    const t = card();
    t.append(kicker('🤫 Secret Task'),
      h('p', 'text-stone-600', `Slip the word “${p.dp.taskWord}” into your clue this round. Pull it off and Face Reveal unlocks next round.`));
    stage.appendChild(t);
  }

  if (silenced.has(i)) {
    const s = card();
    s.append(kicker('🍜 Ramen Eaten'), h('p', 'text-stone-600', 'Your ramen got eaten! You\'re silenced this round — no clue, no whisper. You can still vote.'));
    stage.appendChild(s);
  } else if (settings.whispers) {
    const w = card();
    w.appendChild(kicker('📨 Whisper'));
    const sent = whispers.find(x => x.from === i && x.as === i);
    if (sent) w.appendChild(h('p', 'text-stone-600', `Sent to ${players[sent.to].name}. They'll read it when they vote.`));
    else {
      w.appendChild(h('p', 'text-stone-500 text-sm', 'One private note to one player. They read it on their vote turn.'));
      w.appendChild(button('Send a Whisper', 'tint', () => { playPillClick(); draft = {}; goView('whisper'); }));
    }
    stage.appendChild(w);
  }

  if (p.role === 'dp') stage.appendChild(dpPowersCard(i));

  controls.appendChild(button('Hide & Pass', 'brand', () => { playDone(); finishTurn(); }));
}

function dealAbilities() {
  return DEAL_ABILITIES.filter(k =>
    (settings.whispers || (k !== 'stalking' && k !== 'impersonate')) && (sylly || k !== 'darkProtection'));
}

// Can Dark Potato `i` use `key` right now? { ok, status }
function abilityState(i, key) {
  const d = players[i].dp, ru = roundUsed.get(i) || new Set();
  if (d.disabled.has(key)) return { ok: false, status: '💩 Pooped' };
  if (d.used.has(key))     return { ok: false, status: 'Used' };
  if (silenced.has(i) && key === 'impersonate') return { ok: false, status: 'Silenced' };
  switch (key) {
    case 'faceReveal':
      if (round === 1)           return { ok: false, status: 'Do the task' };
      if (d.taskDone === false)  return { ok: false, status: 'Task missed' };
      return { ok: true, status: d.taskDone ? 'Unlocked' : 'Did you do it?' };
    case 'stalking':
      return ru.has(key) ? { ok: false, status: `On ${players[stalks.get(i)].name}` } : { ok: true, status: 'Every round' };
    case 'swapsies': case 'impersonate':
      return ru.has(key) ? { ok: false, status: 'Done this round' } : { ok: true, status: 'Every round' };
    case 'darkProtection':
      return armed.has(i) ? { ok: false, status: 'Armed' } : { ok: true, status: 'Once a game' };
    default:
      return { ok: true, status: 'Once a game' };
  }
}

function dpPowersCard(i) {
  const c = card();
  c.appendChild(kicker('🥔 Dark Potato Powers'));
  dealAbilities().forEach(key => {
    const a = ABILITIES[key], st = abilityState(i, key);
    const row = h('div', 'flex items-center gap-2');
    const b = h('button', 'ability-row flex-1' + (st.ok ? '' : ' ability-off'));
    b.append(h('span', 'font-semibold', `${a.emoji} ${a.name}`), h('span', 'text-xs text-stone-400', st.status));
    b.addEventListener('click', () => {
      if (!st.ok) { playBoing(); return; }
      playPillClick();
      useAbility(i, key);
    });
    const q = h('button', 'text-stone-400 font-bold text-sm min-h-11 min-w-11 active:scale-90 transition-transform duration-100', '[?]');
    q.setAttribute('aria-label', `What is ${a.name}?`);
    q.addEventListener('click', () => { playPillClick(); showTip(a.emoji, a.name, a.tip); });
    row.append(b, q);
    c.appendChild(row);
  });
  return c;
}

function markRound(i, key) {
  if (!roundUsed.has(i)) roundUsed.set(i, new Set());
  roundUsed.get(i).add(key);
}

// Target picker, shared by the deal-turn abilities.
function openPick(cfg) { draft = { pick: null }; draft.cfg = cfg; goView('pick'); }

function useAbility(i, key) {
  const d = players[i].dp;
  if (key === 'eatRamen') openPick({
    title: '🍜 Eat Ramen', sub: 'Silence someone for this round. The whole table will see it.',
    items: targets(i), cta: 'Eat Their Ramen',
    onPick: t => { silenced.add(t); d.used.add('eatRamen'); playWhoosh(); flash = `🍜 ${players[t].name} is silenced this round.`; },
  });
  if (key === 'faceReveal') {
    if (d.taskDone === null) { goView('faceAsk'); return; }
    openFaceReveal(i);
  }
  if (key === 'stalking') openPick({
    title: '🕵️ Stalking', sub: 'Pick someone. On your vote turn you\'ll read every whisper to and from them.',
    items: targets(i), cta: 'Stalk Them',
    onPick: t => { stalks.set(i, t); markRound(i, 'stalking'); playWhoosh(); flash = `🕵️ Stalking ${players[t].name}. Check back when you vote.`; },
  });
  if (key === 'swapsies') openPick({
    title: '🔀 Swapsies', sub: 'Next round, their card shows a fake role and fake words.',
    items: targets(i), cta: 'Swap Them',
    onPick: t => { pendingSwaps.add(t); markRound(i, 'swapsies'); playWhoosh(); flash = `🔀 ${players[t].name} gets a fake card next round.`; },
  });
  if (key === 'impersonate') { draft = {}; goView('impersonate'); }
  if (key === 'darkProtection') {
    armed.add(i);
    playSuccess();
    flash = '🛡️ Dark Protection is armed for this round.';
    renderPrivate();
  }
}

function openFaceReveal(i) {
  openPick({
    title: '👀 Face Reveal', sub: 'See one player\'s real role. Once a game — choose well.',
    items: targets(i), cta: 'Reveal',
    onPick: t => { players[i].dp.used.add('faceReveal'); draft.faceTarget = t; },
    next: 'faceResult',
  });
}

function renderPick(stage, controls) {
  const cfg = draft.cfg;
  const c = card();
  c.append(h('h2', 'text-2xl font-bold text-stone-800', cfg.title), h('p', 'text-stone-500 text-sm', cfg.sub),
    choiceGrid(playerItems(cfg.items), draft.pick, v => { draft.pick = v; renderPrivate(); }));
  stage.appendChild(c);
  const go = button(cfg.cta, 'brand', () => {
    if (draft.pick == null) { playBoing(); return; }
    cfg.onPick(draft.pick);
    goView(cfg.next || 'main');
  });
  go.classList.toggle('opacity-50', draft.pick == null);
  controls.append(go, button('Cancel', 'stone', () => { playDone(); goView('main'); }));
}

function renderFaceAsk(stage, controls) {
  const d = players[current].dp;
  const c = card('text-center');
  c.append(h('div', 'text-5xl', '👀'), h('h2', 'text-2xl font-bold text-stone-800', 'Face Reveal'),
    h('p', 'text-stone-600', `Did you slip “${d.taskWord}” into your clue in round 1?`),
    h('p', 'text-stone-400 text-sm', 'Honour system. The phone can\'t hear you — but the table could.'));
  stage.appendChild(c);
  controls.append(
    button('I Did', 'brand', () => { playSuccess(); d.taskDone = true; openFaceReveal(current); }),
    button('I Didn\'t', 'stone', () => { playBoing(); d.taskDone = false; flash = '👀 No Face Reveal this game. Tough.'; goView('main'); }));
}

function renderFaceResult(stage, controls) {
  const t = players[draft.faceTarget];
  const c = card('text-center pop-in');
  c.append(h('p', 'text-stone-400 text-sm', 'Face Reveal'), h('h2', 'text-2xl font-bold text-stone-800', t.name),
    h('div', 'text-6xl', ROLES[t.role].emoji), h('p', 'text-2xl font-bold brand-text', ROLES[t.role].name));
  stage.appendChild(c);
  controls.appendChild(button('Got It', 'brand', () => { playDone(); goView('main'); }));
}

// Whisper and Impersonating share one composer; `view` says which.
function renderWhisper(stage, controls) {
  const i = current, imp = view === 'impersonate';
  const c = card();
  c.append(h('h2', 'text-2xl font-bold text-stone-800', imp ? '🎭 Impersonating' : '📨 Whisper'),
    h('p', 'text-stone-500 text-sm', imp ? 'Your whisper will look like it came from someone else.' : 'They\'ll read it on their vote turn. Whispers are wiped each round.'));
  c.append(h('p', 'text-stone-600 text-sm font-semibold', 'To'),
    choiceGrid(playerItems(targets(i)), draft.to, v => { draft.to = v; if (draft.as === v) draft.as = undefined; renderPrivate(); }));
  if (imp) {
    c.append(h('p', 'text-stone-600 text-sm font-semibold', 'Pretend to be'),
      choiceGrid(playerItems(targets(i).filter(j => j !== draft.to)), draft.as, v => { draft.as = v; renderPrivate(); }));
  }
  const ta = h('textarea', 'w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-base text-stone-800 placeholder-stone-300 brand-focus transition-colors');
  ta.rows = 2;
  ta.maxLength = 80;
  ta.placeholder = 'Keep it short and sneaky…';
  ta.value = draft.text || '';
  const count = h('p', 'text-stone-400 text-xs text-right -mt-2', `${ta.value.length}/80`);
  c.append(ta, count);
  stage.appendChild(c);

  const ready = () => draft.to != null && (draft.text || '').trim() && (!imp || draft.as != null);
  const send = button('Send', 'brand', () => {
    if (!ready()) { playBoing(); return; }
    playWhoosh();
    whispers.push({ from: i, as: imp ? draft.as : i, to: draft.to, text: draft.text.trim() });
    if (imp) markRound(i, 'impersonate');
    flash = imp ? `🎭 Sent to ${players[draft.to].name} as ${players[draft.as].name}.` : `📨 Whisper sent to ${players[draft.to].name}.`;
    goView('main');
  });
  const sync = () => send.classList.toggle('opacity-50', !ready());
  ta.addEventListener('input', () => { draft.text = ta.value; count.textContent = `${ta.value.length}/80`; sync(); });
  sync();
  controls.append(send, button('Cancel', 'stone', () => { playDone(); goView('main'); }));
}

// ── Vote turn: whispers, community vote, and each role's secret move ───────────
// A whisper from someone whose ramen got eaten is never delivered.
function delivered(w) { return !silenced.has(w.from); }

function renderVote(stage, controls) {
  const i = current, p = players[i];
  const shownRole = (p.card || p).role;

  const top = card('text-center');
  top.append(h('h2', 'text-2xl font-bold text-stone-800', p.name), h('p', 'text-stone-400 text-sm -mt-2', `You're ${roleLabel(shownRole)}`));
  stage.appendChild(top);

  if (settings.whispers) {
    const w = card();
    w.appendChild(kicker('📨 Your Whispers'));
    const mine = whispers.filter(x => x.to === i && delivered(x));
    if (!mine.length) w.appendChild(h('p', 'text-stone-400 text-sm', 'Nobody whispered to you. Tragic.'));
    mine.forEach(x => w.appendChild(whisperLine(`From ${players[x.as].name}`, x.text)));
    stage.appendChild(w);
  }

  if (p.role === 'dp' && stalks.has(i)) {
    const t = stalks.get(i), s = card();
    s.appendChild(kicker(`🕵️ Stalking ${players[t].name}`));
    const seen = whispers.filter(x => (x.from === t || x.to === t) && delivered(x));
    if (!seen.length) s.appendChild(h('p', 'text-stone-400 text-sm', 'Quiet. Too quiet.'));
    seen.forEach(x => s.appendChild(whisperLine(`${players[x.as].name} → ${players[x.to].name}`, x.text)));
    stage.appendChild(s);
  }

  // Jerry: Ahh Shoot replaces the community vote for everyone.
  if (p.role === 'jerry' && p.shots > 0) {
    const j = card();
    j.append(kicker(`🔫 Ahh Shoot — ${p.shots} shot${p.shots > 1 ? 's' : ''} left`),
      h('p', 'text-stone-500 text-sm', 'Shoot instead of voting. Hit a Dark Potato and they\'re gone. Hit anyone else and you both die. Hit The Pear and the Dark Potato wins.'),
      choiceGrid([{ value: false, label: 'Just Vote' }, { value: true, label: 'Fire' }], !!draft.fire,
        v => { draft.fire = v; renderPrivate(); }));
    if (draft.fire) j.appendChild(choiceGrid(playerItems(targets(i)), draft.shoot, v => { draft.shoot = v; renderPrivate(); }));
    stage.appendChild(j);
  }

  const v = card();
  v.appendChild(kicker('🗳️ Community Vote'));
  if (draft.fire) v.appendChild(h('p', 'text-stone-500 text-sm', 'Skipped — you\'re firing Ahh Shoot. Nobody else\'s vote counts this round.'));
  else {
    const need = Math.floor(livingIdx().length / 2) + 1;
    v.appendChild(h('p', 'text-stone-500 text-sm', `Anyone except Jerry. ${need} votes needed to put someone out.`));
    v.appendChild(choiceGrid([...playerItems(targets(i, true)), { value: 'skip', label: 'Skip', wide: true }], draft.vote,
      val => { draft.vote = val; renderPrivate(); }));
  }
  stage.appendChild(v);

  if (p.role === 'dp') {
    const m = card();
    m.appendChild(kicker('🔪 Murder'));
    if (p.dp.disabled.has('murder')) m.appendChild(h('p', 'text-stone-500 text-sm', '💩 Your Murder got pooped away. No more murdering for you.'));
    else {
      const row = h('div', 'flex items-center justify-between -mt-2');
      row.appendChild(h('p', 'text-stone-500 text-sm', 'Who do you think is The Pear?'));
      const q = h('button', 'text-stone-400 font-bold text-sm min-h-11 min-w-11', '[?]');
      q.addEventListener('click', () => { playPillClick(); showTip('🔪', 'Murder', ABILITIES.murder.tip); });
      row.appendChild(q);
      m.append(row, choiceGrid([...playerItems(targets(i, true)), { value: 'hold', label: 'Hold Off', wide: true }], draft.murder,
        val => { draft.murder = val; renderPrivate(); }));
    }
    stage.appendChild(m);
  }

  if (p.role === 'diarrhea') {
    const d = card();
    d.append(kicker('💩 Get Pooped On'),
      h('p', 'text-stone-500 text-sm', 'Pick a suspect. If they\'re a Dark Potato, one of their abilities is gone for good. You\'ll never know if it worked.'),
      choiceGrid([...playerItems(targets(i)), { value: 'none', label: 'Nobody', wide: true }], draft.poop,
        val => { draft.poop = val; renderPrivate(); }));
    stage.appendChild(d);
  }

  const complete = (draft.fire ? draft.shoot != null : draft.vote != null)
    && (p.role !== 'dp' || p.dp.disabled.has('murder') || draft.murder != null)
    && (p.role !== 'diarrhea' || draft.poop != null);
  const lock = button('Lock It In', 'brand', () => {
    if (!complete) { playBoing(); return; }
    playDone();
    if (draft.fire) shot = { target: draft.shoot };
    else votes.set(i, draft.vote);
    if (p.role === 'dp') murders.set(i, draft.murder === 'hold' || draft.murder == null ? null : draft.murder);
    if (p.role === 'diarrhea' && draft.poop !== 'none') poop = { from: i, target: draft.poop };
    finishTurn();
  });
  lock.classList.toggle('opacity-50', !complete);
  controls.appendChild(lock);
}

function whisperLine(head, text) {
  const d = h('div', 'whisper-line');
  d.append(h('p', 'text-xs font-semibold text-stone-400', head), h('p', 'text-stone-700', text));
  return d;
}

// ── Clue time (public) ─────────────────────────────────────────────────────────
function showTable() {
  document.getElementById('table-label').textContent = `Round ${round}`;

  // Speaking order: living players except Jerry, from a random starting seat.
  const givers = livingIdx().filter(i => players[i].role !== 'jerry');
  const s = Math.floor(Math.random() * givers.length);
  const order = [...givers.slice(s), ...givers.slice(0, s)];
  const ol = document.getElementById('table-order');
  ol.innerHTML = '';
  // Two columns, read down the left then the right.
  ol.style.gridAutoFlow = 'column';
  ol.style.gridTemplateRows = `repeat(${Math.ceil(order.length / 2)}, auto)`;
  order.forEach((i, n) => {
    const li = h('li', 'order-row' + (silenced.has(i) ? ' order-silenced' : ''));
    li.append(h('span', 'order-num', String(n + 1)), h('span', 'flex-1 font-semibold', players[i].name));
    if (silenced.has(i)) li.appendChild(h('span', 'text-xs', '🍜 eaten'));
    ol.appendChild(li);
  });

  const j = players[jerryIdx()];
  document.getElementById('table-jerry').textContent = j.alive
    ? `🐭 ${j.name} listens. No clue from Jerry.`
    : '🐭 Jerry is a ghost now. You\'re on your own.';
  const sil = [...silenced];
  document.getElementById('table-silenced').textContent = sil.length
    ? `🍜 ${listNames(sil)} got their ramen eaten — silent until the vote.` : '';

  const ghosts = players.filter(p => !p.alive);
  const dpLeft = players.filter(p => p.alive && p.role === 'dp').length;
  document.getElementById('table-roster').textContent =
    `🥔 ${dpLeft} Dark Potato${dpLeft > 1 ? 'es' : ''} still out there` + (ghosts.length ? ` · 👻 ${ghosts.map(p => p.name).join(', ')}` : '');
  document.getElementById('btn-table-ghost').style.display = ghosts.length ? '' : 'none';

  startDiscussTimer();
  showScreen('screen-table');
}

function startDiscussTimer() {
  stopDiscussTimer();
  const label = document.getElementById('table-timer-label');
  const clock = document.getElementById('table-timer');
  if (!settings.timer) { label.textContent = 'Then talk it out. Vote when you\'re ready.'; clock.textContent = ''; return; }
  discussLeft = settings.timer;
  label.textContent = 'Then talk it out.';
  clock.textContent = formatTime(discussLeft);
  discussTimer = gameInterval(() => {
    discussLeft -= 1;
    clock.textContent = formatTime(Math.max(0, discussLeft));
    if (discussLeft <= 5 && discussLeft > 0) playTick();
    if (discussLeft <= 0) {
      playAlarm();
      label.textContent = 'Time\'s up — vote!';
      stopDiscussTimer();
    }
  }, 1000);
}
function stopDiscussTimer() {
  if (discussTimer) { clearGameTimer(discussTimer); discussTimer = null; }
}

document.getElementById('btn-table-vote').addEventListener('click', () => {
  playLaunch();
  stopDiscussTimer();
  beginPass('vote');
});

// ── Ghost Corner (spectating) ──────────────────────────────────────────────────
document.getElementById('btn-table-ghost').addEventListener('click', () => {
  playPillClick();
  showPassGate({
    heading: 'Ghosts only 👻',
    subtext: 'Living players, look away! Ghosts: no hints, no faces.',
    ctaLabel: "I'm a Ghost",
    onConfirm: showGhost,
  });
});

function showGhost() {
  const roles = document.getElementById('ghost-roles');
  roles.innerHTML = '';
  players.forEach((p, i) => {
    const row = h('div', 'flex items-center gap-2 py-0.5' + (p.alive ? '' : ' opacity-50'));
    row.append(h('span', 'medal-slot', ROLES[p.role].emoji), h('span', 'flex-1 font-semibold text-stone-800', p.name),
      h('span', 'text-sm text-stone-500', (p.alive ? '' : '👻 ') + ROLES[p.role].name + (silenced.has(i) ? ' · 🍜' : '')));
    roles.appendChild(row);
  });
  const box = document.getElementById('ghost-whispers');
  box.innerHTML = '';
  if (!settings.whispers) box.appendChild(h('p', 'text-stone-400 text-sm', 'Whispers are off this game.'));
  else if (!whispers.length) box.appendChild(h('p', 'text-stone-400 text-sm', 'No whispers yet this round.'));
  whispers.forEach(w => {
    let head = `${players[w.from].name} → ${players[w.to].name}`;
    if (w.as !== w.from) head += ` (posing as ${players[w.as].name})`;
    if (!delivered(w)) head += ' — blocked, ramen eaten';
    box.appendChild(whisperLine(head, w.text));
  });
  showScreen('screen-ghost');
}
// The discussion timer keeps running while a ghost looks.
document.getElementById('btn-ghost-done').addEventListener('click', () => { playDone(); showScreen('screen-table'); });

// ── Results ────────────────────────────────────────────────────────────────────
// Order: Jerry's shot (skips the vote) → community vote → Get Pooped On → Murder.
// Anyone knocked out earlier in the order loses their own move. Stops at a win.
function resolveRound() {
  beats = [];
  const J = jerryIdx();
  const kill = i => { players[i].alive = false; };
  const say = (emoji, heading, sub, sound) => beats.push({ label: `Round ${round} · Results`, emoji, heading, sub, sound });

  if (shot && players[J].alive) {
    const t = shot.target, T = players[t];
    players[J].shots -= 1;
    say('🔫', 'Ahh Shoot!', 'Jerry skipped the vote and pulled the trigger…', playWhoosh);
    if (T.role === 'dp') {
      const ramen = livingIdx().filter(k => players[k].role === 'ramen');
      if (armed.has(t) && !T.dp.used.has('darkProtection') && !T.dp.disabled.has('darkProtection') && ramen.length >= 2) {
        const r = pick(ramen);
        kill(r); kill(J);
        T.dp.used.add('darkProtection');
        say('🛡️', 'Dark Protection!', `The shot bounced. ${players[r].name} took the hit — Honourable Death. Jerry went down too.`, playBoing);
      } else {
        kill(t);
        say('🎯', 'Bullseye!', `${T.name} was a Dark Potato 🥔` + dpLeftLine(), playSuccess);
        checkWin('Jerry shot the last Dark Potato. Ahh shoot indeed.');
      }
    } else if (T.role === 'pear') {
      kill(t); kill(J);
      win('dp', 'The Pear Fell Into The Hands Of The Spammer');
      say('🍐', 'The Pear Fell Into The Hands Of The Spammer', `${T.name} was The Pear. Jerry shot them. Oops.`, playBoing);
    } else {
      kill(t); kill(J);
      say('😢', 'Sad Death', `${T.name} was innocent. They're gone — and so is Jerry.`, playBoing);
    }
    checkWin();
  } else {
    const living = livingIdx().length;
    const tally = new Map();
    votes.forEach(v => tally.set(v, (tally.get(v) || 0) + 1));
    const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    say('🗳️', 'The votes are in', rows.map(([v, n]) => `${v === 'skip' ? 'Skip' : players[v].name} ${n}`).join(' · ') || 'Nobody voted.', playPillClick);
    const [topV, topN] = rows[0] || [null, 0];
    if (topV !== null && topN > living / 2 && topV !== 'skip') {
      const T = players[topV];
      kill(topV);
      if (T.role === 'dp') {
        say('🥔', 'Mashed!', `${T.name} was a Dark Potato!` + dpLeftLine(), playSuccess);
        checkWin('The table mashed every Dark Potato.');
      } else if (T.role === 'pear') {
        win('dp', 'The Pear Has Been Moldified');
        say('🍐', 'The Pear Has Been Moldified', `${T.name} was The Pear. The table voted them out.`, playBoing);
      } else {
        say('🫡', 'Honourable Death', `${T.name} is out. Their role stays a mystery.`, playBoing);
        checkWin();
      }
    } else if (topV === 'skip' && topN > living / 2) {
      say('⏭️', 'Skipped', 'The table voted to skip. Nobody goes out.', playWhoosh);
    } else {
      say('🤷', 'No majority', 'Nobody goes out this round.', playWhoosh);
    }
  }

  // Get Pooped On — silent. The target finds out on their next turn.
  if (!winner && poop && players[poop.from].alive && players[poop.target].alive) {
    const T = players[poop.target];
    T.pendingPoop = true;
    if (T.role === 'dp') {
      const pool = ['murder', ...dealAbilities()].filter(k => !T.dp.disabled.has(k) && !T.dp.used.has(k));
      if (pool.length) T.dp.disabled.add(pick(pool));
    }
  }

  // Murder — living Dark Potatoes pool their picks; most picks, ties at random.
  if (!winner) {
    const tally = new Map();
    murders.forEach((t, dp) => {
      if (t == null || !players[dp].alive || players[dp].dp.disabled.has('murder') || !players[t].alive) return;
      tally.set(t, (tally.get(t) || 0) + 1);
    });
    const best = Math.max(0, ...tally.values());
    const t = best ? pick([...tally.keys()].filter(k => tally.get(k) === best)) : null;
    const T = t == null ? null : players[t];
    if (!T || T.role === 'diarrhea') {
      say('🌙', 'Nobody got murdered', 'Lucky. Or was it?', playWhoosh);
    } else {
      kill(t);
      if (T.role === 'pear') {
        win('dp', 'The Pear Has Been Moldified');
        say('🔪', 'The Pear Has Been Moldified', `${T.name} got murdered — and they were The Pear.`, playBoing);
      } else if (T.role === 'dp') {
        say('🔪', 'Potato on potato', `${T.name} got murdered… and they were a Dark Potato! 🥔` + dpLeftLine(), playSuccess);
        checkWin('The Dark Potatoes took each other out.');
      } else {
        say('🔪', 'Honourable Death', `${T.name} got murdered. The shield worked — The Pear lives on.`, playBoing);
        checkWin();
      }
    }
  }

  beatPos = 0;
  afterBeats = winner ? showGameOver : startRound;
  showBeat();
}

function dpLeftLine() {
  const n = players.filter(p => p.alive && p.role === 'dp').length;
  return n ? ` ${n} still out there.` : '';
}
function win(side, cause) { if (!winner) { winner = side; winCause = cause; } }

// Every Dark Potato gone → the good side wins; one non-potato left → potatoes win.
function checkWin(goodCause = 'Every Dark Potato has been mashed.') {
  if (winner) return;
  const alive = players.filter(p => p.alive);
  if (!alive.some(p => p.role === 'dp')) win('good', goodCause);
  else if (alive.filter(p => p.role !== 'dp').length <= 1) win('dp', 'Only one player left who isn\'t a Dark Potato.');
}

function showBeat() {
  const b = beats[beatPos];
  document.getElementById('reveal-label').textContent = b.label;
  document.getElementById('reveal-emoji').textContent = b.emoji;
  document.getElementById('reveal-heading').textContent = b.heading;
  document.getElementById('reveal-sub').textContent = b.sub;
  const last = beatPos === beats.length - 1;
  document.getElementById('btn-reveal-next').textContent =
    !last ? 'Continue' : afterBeats === showGameOver ? 'See Who Won' : afterBeats === startRound && round === 0 ? 'Deal the Cards' : 'Next Round';
  showScreen('screen-reveal');
  replayAnimation(document.getElementById('reveal-card'), 'pop-in');
  if (b.sound) b.sound();
}
document.getElementById('btn-reveal-next').addEventListener('click', () => {
  playDone();
  beatPos += 1;
  if (beatPos < beats.length) showBeat();
  else afterBeats();
});

// ── Game over ──────────────────────────────────────────────────────────────────
function showGameOver() {
  const dpWon = winner === 'dp';
  const dpTotal = players.filter(p => p.role === 'dp').length;
  document.getElementById('gameover-emoji').textContent = dpWon ? '🥔' : '🐭';
  document.getElementById('gameover-winner').textContent = dpWon
    ? (dpTotal > 1 ? 'The Dark Potatoes win!' : 'The Dark Potato wins!')
    : 'Team Jerry wins!';
  document.getElementById('gameover-cause').textContent = winCause;
  const list = document.getElementById('gameover-roles');
  list.innerHTML = '';
  players.forEach(p => {
    const won = (p.role === 'dp') === dpWon;
    const row = h('div', 'flex items-center gap-3 py-1');
    row.append(h('span', 'medal-slot', ROLES[p.role].emoji),
      h('span', 'flex-1 font-semibold ' + (won ? 'text-stone-800' : 'text-stone-400'), p.name + (p.alive ? '' : ' 👻')),
      h('span', 'text-sm ' + (won ? 'font-semibold brand-text' : 'text-stone-400'), ROLES[p.role].name + (won ? ' 🏆' : '')));
    list.appendChild(row);
  });
  playSuccess();
  showScreen('screen-gameover');
}
document.getElementById('btn-gameover-again').addEventListener('click', () => { playPillClick(); openOverlay('again-overlay'); });
document.getElementById('btn-again-cancel').addEventListener('click', () => { playDone(); closeOverlay('again-overlay'); });
document.getElementById('btn-again-confirm').addEventListener('click', () => {
  playLaunch();
  closeOverlay('again-overlay');
  startMatch(players.map(p => p.name));
});
document.getElementById('btn-gameover-menu').addEventListener('click', () => { playExit(); resetToMenu(); });
document.getElementById('btn-gameover-close').addEventListener('click', () => { playExit(); resetToMenu(); });

// ── Boot ───────────────────────────────────────────────────────────────────────
showScreen('screen-menu');
