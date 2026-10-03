import { CHARACTERS, CHARACTER_TYPES } from '@shared/constants.js';
import { LEVELS } from '@shared/levels.js';
import { CREATURES } from './render/creatures.js';

const CODE_CHARS = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;
const $ = (id) => document.getElementById(id);

const EMBLEMS = {
  // Dr. Hakim: the red Book of Love, with his moustache.
  hakim: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="8" width="40" height="50" rx="6" fill="#c8323c"/><rect x="12" y="8" width="7" height="50" rx="3" fill="#8f1f2a"/><rect x="47" y="12" width="4" height="42" rx="2" fill="#fbf3e4"/><circle cx="28" cy="26" r="4" fill="#fff"/><circle cx="40" cy="26" r="4" fill="#fff"/><circle cx="29" cy="27" r="2" fill="#2a1712"/><circle cx="41" cy="27" r="2" fill="#2a1712"/><path d="M22 38c4-5 8-5 12-1 4-4 8-4 12 1-4 3-8 2-12-1-4 3-8 4-12 1z" fill="#2a1712"/><path d="M34 46c-3-4-8-1-5 3l5 4 5-4c3-4-2-7-5-3z" fill="#f6c94a"/></svg>`,
  rose: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="17" fill="#f2c39c"/><path d="M14 34c0-14 8-22 18-22s18 8 18 22c-3-8-9-12-18-12s-15 4-18 12z" fill="#5a3322"/><circle cx="13" cy="30" r="6" fill="#5a3322"/><circle cx="51" cy="30" r="6" fill="#5a3322"/><circle cx="26" cy="35" r="2.4" fill="#2a1712"/><circle cx="38" cy="35" r="2.4" fill="#2a1712"/><path d="M27 43c3 2 7 2 10 0" stroke="#a5452f" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="21" cy="40" r="3" fill="#ef8fae" opacity=".6"/><circle cx="43" cy="40" r="3" fill="#ef8fae" opacity=".6"/><path d="M44 12l3 4 5-1-3 4 2 4-5-2-3 4v-5l-4-2 5-1z" fill="#d9578f"/></svg>`,
  toolbox: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 18v-6h16v6" stroke="#3a3330" stroke-width="5" fill="none" stroke-linejoin="round"/><rect x="8" y="18" width="48" height="36" rx="5" fill="#d9452f"/><rect x="8" y="18" width="48" height="10" rx="4" fill="#b2321f"/><rect x="28" y="24" width="8" height="8" rx="2" fill="#f2c94c"/><path d="M18 38l8 3M46 38l-8 3" stroke="#2a1712" stroke-width="3" stroke-linecap="round"/><circle cx="23" cy="44" r="3" fill="#fff4d8"/><circle cx="41" cy="44" r="3" fill="#fff4d8"/></svg>`,
  narrator: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 16c8-4 16-4 24 2v32c-8-6-16-6-24-2z" fill="#fbf3e4" stroke="#7a5a3c" stroke-width="2"/><path d="M56 16c-8-4-16-4-24 2v32c8-6 16-6 24-2z" fill="#f0e2c6" stroke="#7a5a3c" stroke-width="2"/><path d="M32 30c-2-3-6-1-4 2l4 3 4-3c2-3-2-5-4-2z" fill="#c8323c"/></svg>`,
};

const ICONS = {
  lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.6 7.1.8-5.3 4.9 1.5 7.1L12 17.8l-6.3 3.6 1.5-7.1L1.9 9.4 9 8.6z"/></svg>`,
};

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// "[Shift] to brace" -> "<kbd>Shift</kbd> to brace"
function withKeys(text) {
  return escapeHtml(text).replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');
}

function shardRow(got, total) {
  return Array.from({ length: total }, (_, i) => `<span class="shard${i < got ? ' is-got' : ''}" style="animation-delay:${0.25 + i * 0.15}s"></span>`).join('');
}

export function createUI({ portraits, audio, on }) {
  const screens = Object.fromEntries([...document.querySelectorAll('[data-screen]')].map((el) => [el.dataset.screen, el]));
  let current = 'menu';
  let toastTimer = 0;
  let hintTimer = 0;
  let controlsTimer = 0;

  const root = $('ui');

  function show(name) {
    const changed = current !== name;
    current = name;
    root.dataset.screen = name;
    for (const [key, el] of Object.entries(screens)) {
      const active = key === name;
      el.classList.toggle('is-active', active);
      el.inert = !active;
    }
    if (name !== 'menu') closePane();
    if (changed && NAV_SCREENS.has(name)) focusFirst(screens[name]);
  }

  // ---------- menu navigation ----------

  // Menus are driven like a console game: arrows move a single selection,
  // Enter picks it, and the mouse just moves the same selection around.
  const NAV_SCREENS = new Set(['menu', 'complete', 'chapter', 'disconnected']);
  const navItems = (scope) => [...scope.querySelectorAll('[data-nav]')].filter((el) => !el.disabled && el.offsetParent !== null);

  function select(el) {
    for (const other of document.querySelectorAll('[data-nav].is-selected')) if (other !== el) other.classList.remove('is-selected');
    el?.classList.add('is-selected');
  }

  function focusFirst(scope) {
    requestAnimationFrame(() => {
      const first = navItems(scope)[0];
      first?.focus({ preventScroll: true });
      select(first);
    });
  }

  function navScope() {
    if (pauseEl.classList.contains('is-open')) return pauseEl;
    if (current === 'menu' && openPane) return openPane;
    return NAV_SCREENS.has(current) ? screens[current] : null;
  }

  document.addEventListener('focusin', (e) => {
    if (e.target.matches?.('[data-nav]')) select(e.target);
  });
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('[data-nav]');
    if (el && !el.disabled && el !== document.activeElement && navScope()?.contains(el)) {
      el.focus({ preventScroll: true });
      select(el);
      audio.blip();
    }
  });

  window.addEventListener('keydown', (e) => {
    const scope = navScope();
    if (!scope || e.target?.tagName === 'INPUT') return;
    const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1, KeyW: -1, KeyS: 1 }[e.code];
    if (!step) return;
    e.preventDefault();
    const items = navItems(scope);
    if (!items.length) return;
    const at = items.indexOf(document.activeElement);
    const next = at < 0 ? items[0] : items[(at + step + items.length) % items.length];
    next.focus({ preventScroll: true });
    select(next);
    audio.blip();
  });

  // ---------- title ----------

  function leaveTitle() {
    if (current !== 'title') return;
    audio.select();
    show('menu');
  }
  screens.title.addEventListener('pointerdown', leaveTitle);
  window.addEventListener('keydown', (e) => {
    if (current !== 'title' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    e.preventDefault();
    leaveTitle();
  });

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      toastTimer = setTimeout(() => (el.textContent = ''), 300);
    }, 1800);
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('button:not(.doll-card):not(.level-card)')) audio.click();
  });

  // ---------- menu ----------

  // A click made before the socket connects is held and replayed on connect,
  // rather than being swallowed by a disabled button.
  let connected = false;
  let pending = null;
  const labelOf = (btn) => btn.querySelector('[data-label]') ?? btn;
  function whenConnected(btn, action) {
    if (connected) return action();
    if (pending) labelOf(pending.btn).textContent = pending.label;
    pending = { btn, label: labelOf(btn).textContent, action };
    labelOf(btn).textContent = 'Connecting…';
    btn.setAttribute('aria-busy', 'true');
  }
  function flushPending() {
    if (!pending) return;
    const { btn, label, action } = pending;
    pending = null;
    labelOf(btn).textContent = label;
    btn.removeAttribute('aria-busy');
    action();
  }

  let openPane = null;
  function setPane(id) {
    const next = id ? $(`${id}-pane`) : null;
    if (next === openPane) return;
    openPane?.setAttribute('hidden', '');
    for (const btn of document.querySelectorAll('[data-pane]')) btn.setAttribute('aria-expanded', String(btn.dataset.pane === id));
    openPane = next;
    screens.menu.classList.toggle('has-pane', !!next);
    if (next) {
      next.removeAttribute('hidden');
      if (next.id === 'join-pane') requestAnimationFrame(() => joinInput.focus());
      else focusFirst(next);
    }
  }
  function closePane() {
    if (!openPane) return;
    const opener = document.querySelector(`[data-pane="${openPane.id.replace('-pane', '')}"]`);
    setPane(null);
    if (current === 'menu') opener?.focus({ preventScroll: true });
  }
  for (const btn of document.querySelectorAll('[data-pane]')) btn.addEventListener('click', () => setPane(openPane?.id === `${btn.dataset.pane}-pane` ? null : btn.dataset.pane));
  for (const btn of document.querySelectorAll('[data-close-pane]')) btn.addEventListener('click', closePane);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && current === 'menu' && openPane) {
      e.preventDefault();
      closePane();
    }
  });

  const joinInput = $('join-input');
  const codeCells = [...$('code-cells').children];
  function renderCode() {
    const value = joinInput.value;
    codeCells.forEach((cell, i) => {
      cell.textContent = value[i] ?? '';
      cell.classList.toggle('is-filled', i < value.length);
      cell.classList.toggle('is-current', i === Math.min(value.length, 3));
    });
  }
  renderCode();
  $('create-btn').addEventListener('click', () => {
    setPane(null);
    whenConnected($('create-btn'), () => on.create());
  });
  joinInput.addEventListener('input', () => {
    joinInput.value = joinInput.value.toUpperCase().replace(CODE_CHARS, '').slice(0, 4);
    $('join-error').textContent = '';
    joinInput.parentElement.classList.remove('is-shaking');
    renderCode();
  });
  joinInput.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      $('join-btn').focus();
    }
  });
  $('join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = joinInput.value.trim();
    if (code.length !== 4) return joinError('Room codes are 4 characters.');
    whenConnected($('join-btn'), () => on.join(code));
  });

  function joinError(message) {
    if (current === 'menu') setPane('join');
    $('join-error').textContent = message;
    const field = joinInput.parentElement;
    field.classList.remove('is-shaking');
    void field.offsetWidth;
    field.classList.add('is-shaking');
    audio.error();
  }

  // ---------- lobby ----------

  const dollCards = CHARACTER_TYPES.map((type) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'doll-card';
    btn.setAttribute('role', 'radio');
    btn.dataset.type = type;
    btn.setAttribute('aria-label', `${CREATURES[type].label} — ${CREATURES[type].blurb}`);
    btn.innerHTML = `<img class="doll-portrait" alt="" /><span><span class="doll-name">${CREATURES[type].label}</span><span class="doll-blurb">${CREATURES[type].blurb}</span><span class="doll-owner"></span></span>`;
    btn.addEventListener('click', () => {
      audio.select();
      on.pickCreature(type);
    });
    $('doll-cards').appendChild(btn);
    return btn;
  });

  const levelButtons = LEVELS.map((def, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `level-card${def.boss ? ' is-boss' : ''}`;
    btn.addEventListener('click', () => {
      audio.select();
      on.selectLevel(i);
    });
    li.appendChild(btn);
    $('level-list').appendChild(li);
    return btn;
  });

  $('copy-btn').addEventListener('click', async () => {
    const code = $('room-code').textContent;
    try {
      await navigator.clipboard.writeText(code);
      toast(`Room code ${code} copied`);
    } catch {
      toast(`Room code: ${code}`);
    }
  });
  $('leave-btn').addEventListener('click', () => on.leave());
  $('start-btn').addEventListener('click', () => on.start());

  function renderLobby({ code, me, mate, isHost, levelIndex, unlocked, progress }) {
    $('room-code').textContent = code;
    for (const card of dollCards) {
      const type = card.dataset.type;
      const owner = me?.avatar.type === type ? 'me' : mate?.avatar.type === type ? 'mate' : 'open';
      card.dataset.owner = owner;
      card.setAttribute('aria-checked', String(owner === 'me'));
      const img = card.querySelector('img');
      if (!img.src) img.src = portraits.get({ type, color: CHARACTERS[type].color });
      card.querySelector('.doll-owner').textContent =
        owner === 'me' ? (isHost ? 'You · Host' : 'You') : owner === 'mate' ? (isHost ? 'Partner' : 'Partner · Host') : 'Waiting for partner';
    }

    levelButtons.forEach((btn, i) => {
      const def = LEVELS[i];
      const locked = i > unlocked;
      const got = progress.gems?.[def.id] ?? 0;
      const total = def.gems?.length ?? 0;
      btn.classList.toggle('is-locked', locked);
      btn.disabled = locked || !isHost;
      btn.setAttribute('aria-pressed', String(i === levelIndex));
      btn.innerHTML = `<span class="level-num">${locked ? ICONS.lock : def.boss ? ICONS.star : i + 1}</span>
        <span><span class="level-name">${escapeHtml(def.name)}</span><span class="level-sub">${locked ? 'Locked' : escapeHtml(def.tagline)}</span></span>
        <span class="shards" aria-label="${got} of ${total} hearts">${total ? shardRow(got, total) : ''}</span>`;
    });

    const start = $('start-btn');
    const hint = $('lobby-hint');
    const name = LEVELS[levelIndex]?.name ?? '';
    if (!mate) {
      start.disabled = true;
      start.textContent = 'Waiting for partner…';
      hint.textContent = 'Share the code — your friend joins from the main menu.';
    } else if (isHost) {
      start.disabled = false;
      start.textContent = `Play · ${name}`;
      hint.textContent = 'Pick any unlocked level. Your partner follows your lead.';
    } else {
      start.disabled = true;
      start.textContent = 'Waiting for host…';
      hint.textContent = `The host has chosen “${name}”.`;
    }
  }

  // ---------- story ----------

  let story = null;

  function renderLine() {
    const { lines, index, speaker } = story;
    const [who, text] = lines[index];
    const info = speaker(who);
    const portrait = $('dialogue-portrait');
    portrait.style.setProperty('--speaker', info.color);
    portrait.innerHTML = info.image ? `<img alt="" src="${info.image}" />` : EMBLEMS[who] ?? EMBLEMS.narrator;
    $('dialogue-name').textContent = info.name;
    $('dialogue-name').style.setProperty('--speaker', info.color);
    $('dialogue-next').classList.remove('is-ready');
    story.text = text;
    story.shown = 0;
    story.typing = true;
    $('dialogue-text').textContent = '';
  }

  function advance() {
    if (!story) return;
    if (story.typing) {
      story.shown = story.text.length;
      return;
    }
    story.index++;
    if (story.index >= story.lines.length) finishStory();
    else renderLine();
  }

  function finishStory() {
    if (!story) return;
    const done = story.resolve;
    $('dialogue').classList.remove('is-showing');
    $('title-card').classList.remove('is-showing');
    story = null;
    done();
  }

  $('dialogue').addEventListener('click', advance);
  $('story-skip').addEventListener('click', finishStory);
  window.addEventListener('keydown', (e) => {
    if (!story || current !== 'story' || e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      advance();
    } else if (e.code === 'Escape') {
      finishStory();
    }
  });

  function playStory({ kicker, title, tagline, lines, speaker }) {
    show('story');
    $('story-waiting').classList.remove('is-showing');
    const card = $('title-card');
    card.classList.remove('is-showing');
    const hasTitle = !!title;
    if (hasTitle) {
      $('title-card-kicker').textContent = kicker ?? '';
      $('title-card-name').textContent = title;
      $('title-card-tagline').textContent = tagline ?? '';
      void card.offsetWidth;
      card.classList.add('is-showing');
    }
    return new Promise((resolve) => {
      if (!lines?.length) {
        setTimeout(resolve, hasTitle ? 2600 : 0);
        return;
      }
      story = { lines, index: 0, speaker, resolve, text: '', shown: 0, typing: false, acc: 0, delay: hasTitle ? 1.6 : 0.2 };
      $('dialogue').classList.remove('is-showing');
    });
  }

  // Typewriter, driven by the main frame loop.
  function tickStory(dt) {
    if (!story) return;
    if (story.delay > 0) {
      story.delay -= dt;
      if (story.delay <= 0) {
        $('dialogue').classList.add('is-showing');
        renderLine();
      }
      return;
    }
    if (!story.typing) return;
    story.acc += Math.min(dt, 0.1) * 48;
    const before = Math.floor(story.shown);
    story.shown = Math.min(story.text.length, story.shown + story.acc);
    story.acc = 0;
    const now = Math.floor(story.shown);
    if (now > before && now % 3 === 0) audio.blip();
    $('dialogue-text').textContent = story.text.slice(0, now);
    if (now >= story.text.length) {
      story.typing = false;
      $('dialogue-next').classList.add('is-ready');
    }
  }

  function storyWaiting(on) {
    $('story-waiting').classList.toggle('is-showing', on);
  }

  // ---------- level HUD ----------

  const playerCards = [];

  function renderPlayers(players) {
    const el = $('hud-players');
    el.innerHTML = '';
    playerCards.length = 0;
    // May on the left, Cody on the right, whatever slot they joined in.
    const ordered = [...players].sort((a, b) => CHARACTER_TYPES.indexOf(a.type) - CHARACTER_TYPES.indexOf(b.type));
    ordered.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = `hp-card${i === 1 ? ' hp-card--right' : ''}${p.me ? ' is-me' : ''}`;
      card.style.setProperty('--accent', p.color);
      card.innerHTML = `<img class="hp-portrait" alt="" src="${p.image}" /><div><p class="hp-name">${escapeHtml(CREATURES[p.type].label)}</p><p class="hp-state">${p.me ? '' : 'Partner'}</p></div>`;
      el.appendChild(card);
      playerCards[p.index] = { card, state: card.querySelector('.hp-state'), me: p.me, key: '' };
    });
  }

  function setPlayerState(index, { braced, alive }) {
    const entry = playerCards[index];
    if (!entry) return;
    const key = `${braced}|${alive}`;
    if (key === entry.key) return;
    entry.key = key;
    entry.card.classList.toggle('is-braced', braced && alive);
    entry.card.classList.toggle('is-down', !alive);
    entry.state.textContent = !alive ? 'Falling…' : braced ? 'Braced' : entry.me ? '' : 'Partner';
  }

  function startLevel({ def, index, players = [] }) {
    const hud = screens.hud;
    hud.classList.toggle('is-boss', !!def.boss);
    $('hud-level-kicker').textContent = def.boss ? 'Chapter one · Final battle' : `Chapter one · Level ${index + 1}`;
    $('hud-level-name').textContent = def.name;
    const total = def.gems?.length ?? 0;
    $('hud-gems').innerHTML = shardRow(0, total).replace(/style="[^"]*"/g, '');
    $('hud-gems').dataset.got = '0';
    $('hud-gem-count').textContent = `0/${total}`;
    $('hud-gems').parentElement.hidden = !total;
    renderPlayers(players);
    $('hud-hint').classList.remove('is-showing');
    setTime(0);
    setBrace(false);
    if (def.boss) setBoss(3, 3);
    const controls = document.querySelector('.hud-controls');
    controls.classList.remove('is-faded');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => controls.classList.add('is-faded'), 12000);
    show('hud');
  }

  function setTime(t) {
    $('hud-time').textContent = t.toFixed(1);
  }

  function setGems(taken) {
    const el = $('hud-gems');
    const got = taken.filter(Boolean).length;
    if (String(got) === el.dataset.got) return;
    el.dataset.got = String(got);
    [...el.children].forEach((s, i) => s.classList.toggle('is-got', i < got));
    $('hud-gem-count').textContent = `${got}/${el.children.length}`;
  }

  function showHint(text, ms = 7000) {
    const el = $('hud-hint');
    el.innerHTML = withKeys(text);
    el.classList.add('is-showing');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => el.classList.remove('is-showing'), ms);
  }

  function setBrace(on) {
    $('brace-indicator').classList.toggle('is-on', on);
  }

  function setBoss(hp, max) {
    const bar = $('boss-hp');
    if (bar.children.length !== max) bar.innerHTML = '<span></span>'.repeat(max);
    [...bar.children].forEach((s, i) => s.classList.toggle('is-lost', i >= hp));
  }

  function banner(text) {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('is-showing');
    void el.offsetWidth;
    el.classList.add('is-showing');
  }

  // ---------- results ----------

  $('next-btn').addEventListener('click', () => on.next());
  $('replay-btn').addEventListener('click', () => on.replay());
  $('map-btn').addEventListener('click', () => on.toMap());
  $('chapter-map-btn').addEventListener('click', () => on.toMap());
  $('back-to-lobby-btn').addEventListener('click', () => on.backToLobby());
  $('disconnect-menu-btn').addEventListener('click', () => on.leave());

  function showComplete({ def, index, stats, isHost, hasNext }) {
    $('complete-kicker').textContent = def.boss ? 'Boss defeated' : `Level ${index + 1} complete`;
    $('complete-name').textContent = def.name;
    $('complete-gems').innerHTML = stats.totalGems ? shardRow(stats.gems, stats.totalGems) : '';
    $('complete-time').textContent = `${stats.time.toFixed(1)}s`;
    $('complete-shards').textContent = `${stats.gems}/${stats.totalGems}`;
    $('complete-falls').textContent = String(stats.falls);
    const next = $('next-btn');
    next.hidden = !hasNext;
    next.disabled = !isHost;
    next.textContent = isHost ? `Continue · ${LEVELS[index + 1]?.name ?? ''}` : 'Waiting for host…';
    $('replay-btn').disabled = false;
    $('map-btn').disabled = !isHost;
    show('complete');
    focusFirst(screens.complete);
  }

  function showChapter({ gems, total, isHost }) {
    $('chapter-gems').textContent = `${gems}/${total}`;
    $('chapter-map-btn').disabled = !isHost;
    $('chapter-map-btn').textContent = isHost ? 'Back to the chapter map' : 'Waiting for host…';
    show('chapter');
  }

  function showNotice({ title, text, canReturn }) {
    $('disconnect-title').textContent = title;
    $('disconnect-text').textContent = text;
    $('back-to-lobby-btn').hidden = !canReturn;
    show('disconnected');
    focusFirst(screens.disconnected);
  }

  const pauseEl = $('pause');
  function setPause(open, { isHost = false } = {}) {
    pauseEl.classList.toggle('is-open', open);
    pauseEl.inert = !open;
    $('pause-map-btn').disabled = !isHost;
    $('pause-map-btn').hidden = !isHost;
    if (open) $('resume-btn').focus();
  }
  pauseEl.inert = true;
  $('pause-btn').addEventListener('click', () => on.togglePause());
  $('resume-btn').addEventListener('click', () => on.togglePause());
  $('pause-restart-btn').addEventListener('click', () => on.replay());
  $('pause-map-btn').addEventListener('click', () => on.toMap());
  $('pause-leave-btn').addEventListener('click', () => on.leave());

  function setPauseAvailable(on) {
    $('pause-btn').hidden = !on;
  }

  function fade(on) {
    $('fade').classList.toggle('is-on', on);
  }

  function setConnected(isConnected, everConnected) {
    connected = isConnected;
    const el = $('net-status');
    el.textContent = connected ? '' : everConnected ? 'Reconnecting…' : 'Connecting to server…';
    el.classList.toggle('is-visible', !connected);
    if (connected) flushPending();
  }

  const muteBtn = $('mute-btn');
  function renderMute() {
    muteBtn.setAttribute('aria-pressed', String(audio.muted));
    muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  }
  muteBtn.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    renderMute();
  });
  renderMute();

  $('boss-emblem').innerHTML = EMBLEMS.toolbox;
  show('title');

  return {
    get current() {
      return current;
    },
    show,
    toast,
    joinError,
    clearJoin() {
      joinInput.value = '';
      $('join-error').textContent = '';
      renderCode();
    },
    renderLobby,
    playStory,
    tickStory,
    storyWaiting,
    startLevel,
    setTime,
    setGems,
    showHint,
    setBrace,
    setPlayerState,
    setBoss,
    banner,
    showComplete,
    showChapter,
    showNotice,
    fade,
    setPause,
    setPauseAvailable,
    setConnected,
  };
}
