// A quiet woven flow for the hero. The canvas is decorative; all page content
// remains available without it. It draws a single frame when motion is reduced.
// Hovering the hero gently parts the threads around the cursor, like a lens.
const stage = document.getElementById('hero-animation');
const canvas = stage?.querySelector('canvas');
const context = canvas?.getContext('2d', { alpha: true });

if (stage && canvas && context) {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let ink = '#787b78';
  let red = '#b23b3d';
  const redThread = 0.14 + Math.random() * 0.72;
  let visible = true;
  let frame = 0;
  let lastPaint = 0;

  // Hover warp. The smoothed position trails the real cursor slightly, and the
  // strength eases in and out so the effect never switches on abruptly.
  const WARP_AMOUNT = 0.42; // how strongly threads part (0.3 subtle, 0.6 bold)
  const WARP_RADIUS = 0.32; // radius as a share of the hero's shorter side
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, target: 0 };

  function trackPointer(event) {
    if (event.pointerType === 'touch') return;
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const inside = x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height;
    if (inside) {
      // Start the warp where the cursor enters rather than sliding in from afar.
      if (pointer.strength < 0.01) {
        pointer.x = x;
        pointer.y = y;
      }
      pointer.targetX = x;
      pointer.targetY = y;
    }
    pointer.target = inside ? 1 : 0;
  }

  function releasePointer() {
    pointer.target = 0;
  }

  function easePointer(dt) {
    const follow = 1 - Math.exp(-dt * 7);
    pointer.x += (pointer.targetX - pointer.x) * follow;
    pointer.y += (pointer.targetY - pointer.y) * follow;
    const rate = pointer.target > pointer.strength ? 4 : 2.5;
    pointer.strength += (pointer.target - pointer.strength) * (1 - Math.exp(-dt * rate));
  }

  function draw(seconds) {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    context.lineCap = 'round';

    const lineCount = width < 420 ? 35 : 43;
    const redIndex = Math.round(redThread * (lineCount - 1));
    const centerY = height * (0.5 + 0.018 * Math.sin(seconds * 0.26));
    const step = Math.max(3, width / 140);

    const s = motionPreference.matches ? 0 : pointer.strength;
    const warp = s * s * (3 - 2 * s); // smoothstep for a softer onset
    const radius = Math.max(80, Math.min(width, height) * WARP_RADIUS);
    const inverseRadius = 1 / (radius * radius);

    // Draw the single red strand last so crossings never obscure it.
    for (let order = 0; order < lineCount; order += 1) {
      const index = order === lineCount - 1 ? redIndex : order < redIndex ? order : order + 1;
      const lane = (index / (lineCount - 1)) * 2 - 1;
      const highlight = index === redIndex;
      context.strokeStyle = highlight ? red : ink;
      context.lineWidth = highlight ? 2 : (width < 420 ? 1.25 : 1.5);
      context.globalAlpha = highlight ? 0.95 : 0.38 + 0.12 * (1 - Math.abs(lane));
      context.beginPath();

      for (let x = 0; x <= width + step; x += step) {
        const u = x / width;
        const gathering = Math.exp(-Math.pow((u - 0.52) / 0.29, 2));
        const spread = height * 0.43 * (1 - 0.63 * gathering);
        const current = Math.sin(u * 10.5 + seconds * 0.48 + lane * 2.4);
        const crosscurrent = Math.sin(u * 24 - seconds * 0.32 + lane * 7.2);
        let y = centerY + lane * spread
          + gathering * (current * height * 0.055 + crosscurrent * height * 0.012)
          + gathering * Math.sin(u * 5.5 - seconds * 0.22) * height * 0.06 * (1 - lane * lane);

        if (warp > 0.001) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const falloff = Math.exp(-(dx * dx + dy * dy) * inverseRadius);
          // Push threads away from the cursor, with a faint breathing shimmer.
          y += warp * falloff * (dy * WARP_AMOUNT + Math.sin(seconds * 1.6 + lane * 3) * 1.5);
        }

        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function pause() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function tick(time) {
    frame = 0;
    if (!visible || document.hidden || motionPreference.matches) return;
    if (time - lastPaint >= 33) {
      easePointer(Math.min(time - lastPaint, 100) / 1000);
      draw(time / 1000);
      lastPaint = time;
    }
    frame = requestAnimationFrame(tick);
  }

  function resume() {
    pause();
    if (visible && !document.hidden && !motionPreference.matches) frame = requestAnimationFrame(tick);
    else draw(0);
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    context.setTransform(density, 0, 0, density, 0, 0);
    const styles = getComputedStyle(stage);
    ink = styles.getPropertyValue('--flow-ink').trim() || '#787b78';
    red = styles.getPropertyValue('--flow-red').trim() || '#b23b3d';
    draw(motionPreference.matches ? 0 : performance.now() / 1000);
  }

  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(stage);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? false;
    resume();
  }, { rootMargin: '60px' });
  visibilityObserver.observe(stage);
  motionPreference.addEventListener('change', resume);
  document.addEventListener('visibilitychange', resume);

  // Listen on the window so headline text or buttons layered over the canvas
  // don't block the hover; the hit test against the hero bounds is done above.
  window.addEventListener('pointermove', trackPointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', releasePointer);
  window.addEventListener('blur', releasePointer);

  resize();
  resume();
}