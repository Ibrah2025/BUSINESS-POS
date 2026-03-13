let ctx = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, duration, type = 'square', gain = 0.15) {
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    g.gain.linearRampToValueAtTime(0, c.currentTime + duration / 1000);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime);
    o.stop(c.currentTime + duration / 1000);
  } catch {
    // silent fail on unsupported devices
  }
}

/** Scanner beep — sharp confirmation */
export function playBeep() {
  tone(800, 100);
}

/** Cart item added — soft pop */
export function playCartPop() {
  tone(600, 50, 'sine', 0.1);
}

/** Sale complete — satisfying ka-ching cash register sound */
export function playKaChing() {
  try {
    const c = getCtx();
    const now = c.currentTime;

    // First hit — bright metallic ring
    const o1 = c.createOscillator();
    const g1 = c.createGain();
    o1.type = 'sine';
    o1.frequency.value = 1200;
    g1.gain.setValueAtTime(0.2, now);
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    o1.connect(g1);
    g1.connect(c.destination);
    o1.start(now);
    o1.stop(now + 0.15);

    // Second hit — lower ring, slight delay
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.type = 'sine';
    o2.frequency.value = 800;
    g2.gain.setValueAtTime(0.15, now + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    o2.connect(g2);
    g2.connect(c.destination);
    o2.start(now + 0.08);
    o2.stop(now + 0.3);

    // High shimmer overtone
    const o3 = c.createOscillator();
    const g3 = c.createGain();
    o3.type = 'sine';
    o3.frequency.value = 2400;
    g3.gain.setValueAtTime(0.06, now);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o3.connect(g3);
    g3.connect(c.destination);
    o3.start(now);
    o3.stop(now + 0.2);
  } catch {
    // silent fail
  }
}

/** Original success melody — kept as fallback */
export function playSuccess() {
  try {
    const c = getCtx();
    const now = c.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = 0.12;
      g.gain.linearRampToValueAtTime(0, now + 0.12 + i * 0.1);
      o.connect(g);
      g.connect(c.destination);
      o.start(now + i * 0.1);
      o.stop(now + 0.12 + i * 0.1);
    });
  } catch {
    // silent fail
  }
}

export function playError() {
  tone(200, 250, 'sawtooth');
}
