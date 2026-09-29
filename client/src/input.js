const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

function isTyping(e) {
  const tag = e.target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

const BRACE_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'KeyE']);

// Keyboard + gamepad. Movement is camera-relative: up on screen is -z.
export function createInput({ onJump } = {}) {
  const held = new Set();
  let jumpQueued = false;
  let padJumpWasDown = false;
  let enabled = false;

  window.addEventListener('keydown', (e) => {
    if (!enabled || isTyping(e)) return;
    if (e.code in MOVE_KEYS || e.code === 'Space') e.preventDefault();
    if (e.code === 'Space' && !e.repeat) {
      jumpQueued = true;
      onJump?.();
    }
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());

  function pad() {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) if (p?.connected) return p;
    return null;
  }

  return {
    setEnabled(on) {
      enabled = on;
      if (!on) {
        held.clear();
        jumpQueued = false;
      }
    },
    read() {
      let x = 0;
      let z = 0;
      for (const code of held) {
        const d = MOVE_KEYS[code];
        if (d) {
          x += d[0];
          z += d[1];
        }
      }
      let brace = [...held].some((c) => BRACE_KEYS.has(c));
      const gp = enabled ? pad() : null;
      if (gp) {
        const [ax = 0, ay = 0] = gp.axes;
        if (Math.hypot(ax, ay) > 0.2) {
          x += ax;
          z += ay;
        }
        const down = gp.buttons[0]?.pressed;
        if (down && !padJumpWasDown) {
          jumpQueued = true;
          onJump?.();
        }
        padJumpWasDown = !!down;
        brace ||= !!(gp.buttons[1]?.pressed || gp.buttons[5]?.pressed || gp.buttons[7]?.pressed);
      }
      const len = Math.hypot(x, z);
      if (len > 1) {
        x /= len;
        z /= len;
      }
      const jump = jumpQueued;
      jumpQueued = false;
      return { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, jump, brace };
    },
  };
}
