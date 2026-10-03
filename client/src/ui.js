import { CREATURE_TYPES, COLOR_SWATCHES } from '@shared/constants.js';
import { LEVELS } from '@shared/levels.js';
import { CREATURES } from './render/creatures.js';

const CODE_CHARS = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;
const $ = (id) => document.getElementById(id);

const EMBLEMS = {
  aeris: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="ae"><stop offset="0" stop-color="#fff"/><stop offset="0.45" stop-color="#a8c4ff"/><stop offset="1" stop-color="#a8c4ff" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="30" r="24" fill="url(#ae)"/><path d="M20 46c6 10 18 10 24 0" stroke="#c8d8ff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  vorrak: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 32C16 12 48 12 60 32C48 52 16 52 4 32Z" fill="#2a0d1a" stroke="#ff5d6c" stroke-width="3"/><circle cx="32" cy="32" r="11" fill="#ff5d6c"/><rect x="30" y="21" width="4" height="22" rx="2" fill="#1a0610"/></svg>`,
  warden: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="12" width="44" height="40" rx="10" fill="#3d3530" stroke="#ffcf7a" stroke-width="3"/><rect x="16" y="28" width="32" height="7" rx="3" fill="#ff5a2e"/><path d="M32 2l5 10H27z" fill="#ffcf7a"/></svg>`,
  narrator: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 16c8-4 16-4 24 2v32c-8-6-16-6-24-2z" fill="#f1e0c8"/><path d="M56 16c-8-4-16-4-24 2v32c8-6 16-6 24-2z" fill="#dcc3a0"/></svg>`,
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

  function show(name) {
    current = name;
    for (const [key, el] of Object.entries(screens)) {
      const active = key === name;
      el.classList.toggle('is-active', active);
      el.inert = !active;
    }
  }
  show('menu');

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
    if (e.target.closest('button:not(.creature-btn):not(.swatch):not(.level-card)')) audio.click();
  });

  // ---------- menu ----------

  const joinInput = $('join-input');
  $('create-btn').addEventListener('click', () => on.create());
  joinInput.addEventListener('input', () => {
    joinInput.value = joinInput.value.toUpperCase().replace(CODE_CHARS, '').slice(0, 4);
    $('join-error').textContent = '';
    joinInput.classList.remove('is-shaking');
  });
  $('join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = joinInput.value.trim();
    if (code.length !== 4) return joinError('Room codes are 4 characters.');
    on.join(code);
  });

  function joinError(message) {
    $('join-error').textContent = message;
    joinInput.classList.remove('is-shaking');
    void joinInput.offsetWidth;
    joinInput.classList.add('is-shaking');
    audio.error();
  }

  // ---------- lobby ----------

  const creatureButtons = CREATURE_TYPES.map((type) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'creature-btn';
    btn.setAttribute('role', 'radio');
    btn.dataset.type = type;
    btn.title = CREATURES[type].blurb;
    btn.setAttribute('aria-label', `${CREATURES[type].label} — ${CREATURES[type].blurb}`);
    btn.innerHTML = `<img alt="" /><span>${CREATURES[type].label}</span>`;
    btn.addEventListener('click', () => {
      audio.select();
      on.pickCreature(type);
    });
    $('creature-grid').appendChild(btn);
    return btn;
  });
  const swatches = COLOR_SWATCHES.map((color) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', `Color ${color}`);
    btn.style.setProperty('--swatch', color);
    btn.dataset.color = color;
    btn.addEventListener('click', () => {
      audio.select();
      on.pickColor(color);
    });
    $('color-grid').appendChild(btn);
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

  function renderSlot(el, player, name, emptyText) {
    el.classList.toggle('is-empty', !player);
    if (player) {
      el.querySelector('img').src = portraits.get(player.avatar);
      el.style.setProperty('--accent', player.avatar.color);
      el.querySelector('.slot-sub').textContent = CREATURES[player.avatar.type].label;
    } else {
      el.style.removeProperty('--accent');
      el.querySelector('.slot-sub').textContent = emptyText;
    }
    el.querySelector('.slot-name').textContent = name;
  }

  function renderLobby({ code, me, mate, isHost, levelIndex, unlocked, progress }) {
    $('room-code').textContent = code;
    renderSlot($('slot-me'), me, isHost ? 'You · host' : 'You', '');
    renderSlot($('slot-mate'), mate, mate && !isHost ? 'Teammate · host' : 'Teammate', 'Waiting to join…');
    if (me) {
      for (const btn of creatureButtons) {
        btn.setAttribute('aria-checked', String(btn.dataset.type === me.avatar.type));
        btn.querySelector('img').src = portraits.get({ type: btn.dataset.type, color: me.avatar.color });
      }
      for (const btn of swatches) btn.setAttribute('aria-checked', String(btn.dataset.color === me.avatar.color));
    }

    levelButtons.forEach((btn, i) => {
      const def = LEVELS[i];
      const locked = i > unlocked;
      const got = progress.gems?.[def.id] ?? 0;
      const total = def.gems?.length ?? 0;
      btn.classList.toggle('is-locked', locked);
      btn.disabled = locked || !isHost;
      btn.setAttribute('aria-pressed', String(i === levelIndex));
      btn.innerHTML = `<span class="level-num">${locked ? '🔒' : def.boss ? '⚔' : i + 1}</span>
        <span><span class="level-name">${escapeHtml(def.name)}</span><span class="level-sub">${locked ? 'Locked' : escapeHtml(def.tagline)}</span></span>
        <span class="shards" aria-label="${got} of ${total} shards">${total ? shardRow(got, total) : ''}</span>`;
    });

    const start = $('start-btn');
    const hint = $('lobby-hint');
    const name = LEVELS[levelIndex]?.name ?? '';
    if (!mate) {
      start.disabled = true;
      start.textContent = 'Waiting for teammate…';
      hint.textContent = 'Share the code — your friend joins from the main menu.';
    } else if (isHost) {
      start.disabled = false;
      start.textContent = `Begin · ${name}`;
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

  function startLevel({ def, index }) {
    const hud = screens.hud;
    hud.classList.toggle('is-boss', !!def.boss);
    $('hud-level-kicker').textContent = def.boss ? 'Boss' : `Level ${index + 1}`;
    $('hud-level-name').textContent = def.name;
    const total = def.gems?.length ?? 0;
    $('hud-gems').innerHTML = shardRow(0, total).replace(/style="[^"]*"/g, '');
    $('hud-gems').dataset.got = '0';
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
  }

  const pauseEl = $('pause');
  function setPause(open, { isHost = false } = {}) {
    pauseEl.classList.toggle('is-open', open);
    pauseEl.inert = !open;
    $('pause-map-btn').disabled = !isHost;
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

  function setConnected(connected, everConnected) {
    const el = $('net-status');
    el.textContent = connected ? '' : everConnected ? 'Reconnecting…' : 'Connecting to server…';
    el.classList.toggle('is-visible', !connected);
    $('create-btn').disabled = !connected;
    $('join-btn').disabled = !connected;
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
