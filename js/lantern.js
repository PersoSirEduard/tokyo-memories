// Start screen lantern: a flame flickers behind washi paper; the title is a still shadow
// and the couple is a shadow puppet on sticks, swaying as if held from below. Stops once the intro is hidden.
const TAU = Math.PI * 2;

export function startLantern(root) {
  const lantern = root.querySelector('.lantern');
  const blur = root.querySelector('#soft-blur');
  const couple = root.querySelector('#p-couple');
  const heart = root.querySelector('#p-heart');
  const cast = root.querySelector('.cast');
  const shiba = root.querySelector('#p-shiba');
  const shibaBody = root.querySelector('#shiba-body');
  const t0 = performance.now();

  function frame(now) {
    if (root.classList.contains('hidden')) return;
    const t = (now - t0) / 1000;
    // Flame: a few incommensurate sines plus an occasional gutter dip.
    const flick = Math.sin(t * 7.3) * 0.05 + Math.sin(t * 13.1 + 1.3) * 0.035 + Math.sin(t * 23.7 + 0.4) * 0.02;
    const gutter = Math.max(0, Math.sin(t * 0.83 + 2)) ** 12 * 0.18;
    const glow = 0.88 + flick - gutter;
    const lx = Math.sin(t * 1.7) * 7 + Math.sin(t * 5.3) * 2.5;
    const ly = Math.sin(t * 2.3 + 1) * 4 + Math.sin(t * 6.1) * 1.5;
    lantern.style.setProperty('--glow', glow.toFixed(3));
    lantern.style.setProperty('--gx', `${lx.toFixed(1)}px`);
    lantern.style.setProperty('--gy', `${ly.toFixed(1)}px`);
    lantern.style.setProperty('--gs', (0.96 + flick * 0.6).toFixed(3));

    // Shadows soften when the flame dips; the title stays put.
    blur.setAttribute('stdDeviation', (1.1 + (1 - glow) * 4).toFixed(2));
    cast.style.opacity = (0.74 + glow * 0.1).toFixed(3);

    // The couple drifts opposite the flame and pivots around the hands holding the sticks.
    const ca = Math.sin(t * 0.7 + 1) * 3 + Math.sin(t * 1.9) * 0.8;
    const cx = 28 - lx * 0.35, cy = 232 - ly * 0.25 - Math.abs(Math.sin(t * 1.6)) * 4;
    couple.setAttribute('transform', `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(1.22) rotate(${ca.toFixed(2)} 102 250)`);
    const hb = Math.sin(t * 2.6) * 3;
    heart.setAttribute('transform', `translate(0 ${(-Math.abs(Math.sin(t * 2.6)) * 3).toFixed(2)}) rotate(${hb.toFixed(2)} 101.5 93)`);

    // Shiba (one rigid cutout) glides across with a little hop, pauses and turns at each end (one lap = 2 × (walk + pause)).
    const WALK = 5.2, PAUSE = 1.1, lap = 2 * (WALK + PAUSE), k = t % lap;
    const half = k < WALK + PAUSE ? 0 : 1;
    const local = k - half * (WALK + PAUSE);
    const moving = local < WALK;
    const u = moving ? local / WALK : 1;
    const ease = u * u * (3 - 2 * u);
    const x = half === 0 ? 62 + ease * 176 : 238 - ease * 176;
    const facing = half === 0 ? (moving ? 1 : -1) : (moving ? -1 : 1);
    const bob = moving ? -Math.abs(Math.sin(t * 11)) * 2.5 : 0;
    shiba.setAttribute('transform', `translate(${(x - lx * 0.35).toFixed(2)} ${(470 + bob - ly * 0.25).toFixed(2)}) scale(1.35)`);
    shibaBody.setAttribute('transform', `scale(${facing} 1)`);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
