// Two hero options: original weave and the combined atom orbital.
// Choose once per page entry. Resizing, hovering, and clicking keep that choice.
const stage = document.getElementById('hero-animation');
const canvas = stage?.querySelector('canvas');
const context = canvas?.getContext('2d', { alpha: true });

if (stage && canvas && context) {
  const animations = ['weave', 'atom-orbital'];
  // `?hero=weave|atom-orbital` pins one option for previewing.
  const requested = new URLSearchParams(location.search).get('hero');
  const preview = ['orbital', 'atom'].includes(requested) ? 'atom-orbital' : requested;
  const animation = animations.includes(preview) ? preview : animations[Math.floor(Math.random() * animations.length)];
  const scene = { ctx: context, seed: Math.random(), width: 0, height: 0 };
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  stage.dataset.animation = animation;
  let ink = '#787b78';
  let red = '#b23b3d';
  let elapsed = 1.7;
  let visible = false;
  let frame = 0;
  let lastTick = 0;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, target: 0 };
  const sphereOffset = { x: 0, y: 0 };
  const ringOffset = { x: 0, y: 0 };

  function trackPointer(event) {
    if (event.pointerType === 'touch' || motionPreference.matches) return;
    const bounds = stage.getBoundingClientRect();
    if (pointer.strength < 0.01) {
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
    }
    pointer.targetX = event.clientX - bounds.left;
    pointer.targetY = event.clientY - bounds.top;
    pointer.target = 1;
  }

  function releasePointer() { pointer.target = 0; }

  function easePointer(dt) {
    const follow = 1 - Math.exp(-dt * 7);
    pointer.x += (pointer.targetX - pointer.x) * follow;
    pointer.y += (pointer.targetY - pointer.y) * follow;
    const strengthRate = animation === 'weave' ? (pointer.target ? 4 : 2.5) : (pointer.target ? 8 : 3);
    pointer.strength += (pointer.target - pointer.strength) * (1 - Math.exp(-dt * strengthRate));
    // A gentle pull toward the cursor, with a slower gravitational response.
    // The renderer keeps the sphere inside its ribbon and both within the canvas.
    const dx = (pointer.x - scene.width * 0.5) * 0.15;
    const dy = (pointer.y - scene.height * 0.5) * 0.15;
    const gravity = 1 - Math.exp(-dt * 2.3);
    sphereOffset.x += (dx * pointer.strength - sphereOffset.x) * gravity;
    sphereOffset.y += (dy * pointer.strength - sphereOffset.y) * gravity;
    // The ribbon is the sphere's orbit, so it follows a beat behind.
    const drag = 1 - Math.exp(-dt * 1.6);
    ringOffset.x += (sphereOffset.x - ringOffset.x) * drag;
    ringOffset.y += (sphereOffset.y - ringOffset.y) * drag;
  }

  // Allocate geometry once per resize, never inside the animation loop.
  let weaveGeometry;
  let ringGeometry;
  let atomGeometry;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function prepareGeometry() {
    const w = scene.width, h = scene.height;
    if (animation === 'weave') {
      const lines = w < 420 ? 35 : 43;
      const step = Math.max(3, w / 140);
      const points = Math.floor((w + step) / step) + 1;
      const size = lines * points;
      const firstRed = Math.round((0.14 + scene.seed * 0.72) * (lines - 1));
      const secondRed = (firstRed + Math.floor(lines * 0.43)) % lines;
      const order = [];
      for (let i = 0; i < lines; i++) if (i !== firstRed && i !== secondRed) order.push(i);
      order.push(firstRed, secondRed);
      const g = weaveGeometry = {
        lines, points, firstRed, secondRed, order,
        x: new Float32Array(points), base: new Float32Array(size),
        currentSin: new Float32Array(size), currentCos: new Float32Array(size),
        crossSin: new Float32Array(size), crossCos: new Float32Array(size),
        slowSin: new Float32Array(points), slowCos: new Float32Array(points),
        currentAmp: new Float32Array(points), crossAmp: new Float32Array(points),
        surface: new Float32Array(points), lane: new Float32Array(lines)
      };
      for (let j = 0; j < points; j++) {
        const x = j * step, u = x / w;
        const gathering = Math.exp(-Math.pow((u - 0.52) / 0.29, 2));
        g.x[j] = x;
        g.currentAmp[j] = gathering * h * 0.055;
        g.crossAmp[j] = gathering * h * 0.012;
        g.slowSin[j] = gathering * Math.sin(u * 5.5) * h * 0.06;
        g.slowCos[j] = gathering * Math.cos(u * 5.5) * h * 0.06;
        for (let i = 0; i < lines; i++) {
          const lane = i / (lines - 1) * 2 - 1, k = i * points + j;
          g.lane[i] = lane;
          g.base[k] = h * 0.5 + lane * h * 0.43 * (1 - 0.63 * gathering);
          g.currentSin[k] = Math.sin(u * 10.5 + lane * 2.4);
          g.currentCos[k] = Math.cos(u * 10.5 + lane * 2.4);
          g.crossSin[k] = Math.sin(u * 24 + lane * 7.2);
          g.crossCos[k] = Math.cos(u * 24 + lane * 7.2);
        }
      }
      return;
    }

    const lines = 29;
    // Smooth curves at screen resolution without oversampling small canvases.
    const steps = w < 420 ? 112 : 160, points = steps + 1, size = lines * points;
    const g = ringGeometry = {
      lines, points, redIndex: Math.round((0.12 + 0.76 * scene.seed) * (lines - 1)),
      cos: new Float32Array(points), sin: new Float32Array(points),
      base: new Float32Array(lines),
      r4Sin: new Float32Array(size), r4Cos: new Float32Array(size),
      r7Sin: new Float32Array(size), r7Cos: new Float32Array(size),
      z2Sin: new Float32Array(size), z2Cos: new Float32Array(size),
      z3Sin: new Float32Array(size), z3Cos: new Float32Array(size),
      x: new Float32Array(size), y: new Float32Array(size), z: new Float32Array(size), order: []
    };
    for (let j = 0; j < points; j++) {
      const theta = j / steps * Math.PI * 2;
      g.cos[j] = Math.cos(theta); g.sin[j] = Math.sin(theta);
      for (let i = 0; i < lines; i++) {
        const lane = i / (lines - 1) * 2 - 1, k = i * points + j;
        g.base[i] = 1 + lane * 0.115;
        g.r4Sin[k] = Math.sin(theta * 4 + lane * 1.4) * 0.075;
        g.r4Cos[k] = Math.cos(theta * 4 + lane * 1.4) * 0.075;
        g.r7Sin[k] = Math.sin(theta * 7 + lane * 2.3) * 0.027;
        g.r7Cos[k] = Math.cos(theta * 7 + lane * 2.3) * 0.027;
        g.z2Sin[k] = lane * 0.2 * Math.sin(theta * 2);
        g.z2Cos[k] = lane * 0.2 * Math.cos(theta * 2);
        g.z3Sin[k] = Math.sin(theta * 3 + lane * 1.8) * 0.075;
        g.z3Cos[k] = Math.cos(theta * 3 + lane * 1.8) * 0.075;
      }
    }
    for (let i = 0; i < lines; i++) if (i !== g.redIndex) g.order.push(i);
    g.order.push(g.redIndex);

    const orbits = 19, trailPoints = 81;
    const a = atomGeometry = {
      orbits, points: trailPoints, redIndex: Math.floor(scene.seed * orbits),
      ax: new Float32Array(orbits), ay: new Float32Array(orbits),
      bx: new Float32Array(orbits), by: new Float32Array(orbits), bz: new Float32Array(orbits),
      speed: new Float32Array(orbits), phase: new Float32Array(orbits),
      cos: new Float32Array(orbits * trailPoints), sin: new Float32Array(orbits * trailPoints),
      x: new Float32Array(orbits * trailPoints), y: new Float32Array(orbits * trailPoints), z: new Float32Array(orbits * trailPoints)
    };
    for (let i = 0; i < orbits; i++) {
      const azimuth = i * 2.399963 + scene.seed * 6.28;
      const inclination = 0.38 + ((i * 0.618034 + scene.seed) % 1) * 1.16;
      a.ax[i] = Math.cos(azimuth); a.ay[i] = Math.sin(azimuth);
      a.bx[i] = -Math.sin(azimuth) * Math.cos(inclination);
      a.by[i] = Math.cos(azimuth) * Math.cos(inclination);
      a.bz[i] = Math.sin(inclination);
      a.speed[i] = (i % 2 ? -1 : 1) * (0.95 + (i % 5) * 0.16);
      a.phase[i] = i * 1.83 + scene.seed * 6.28;
      const length = 2.15 + (i % 3) * 0.24;
      for (let j = 0; j < trailPoints; j++) {
        const theta = -length * (1 - j / 80), k = i * trailPoints + j;
        a.cos[k] = Math.cos(theta); a.sin[k] = Math.sin(theta);
      }
    }
  }

  function weave() {
    const g = weaveGeometry, t = elapsed, ctx = context;
    const currentSin = Math.sin(t * 0.48), currentCos = Math.cos(t * 0.48);
    const crossSin = Math.sin(t * 0.32), crossCos = Math.cos(t * 0.32);
    const slowSin = Math.sin(t * 0.22), slowCos = Math.cos(t * 0.22);
    const drift = scene.height * 0.018 * Math.sin(t * 0.26);
    const s = pointer.strength, warp = s * s * (3 - 2 * s);
    const radius = Math.max(80, Math.min(scene.width, scene.height) * 0.32);
    const radiusSquared = radius * radius;
    for (let j = 0; j < g.points; j++) g.surface[j] = g.slowSin[j] * slowCos - g.slowCos[j] * slowSin;
    for (let order = 0; order < g.lines; order++) {
      const i = g.order[order], lane = g.lane[i], base = i * g.points;
      const highlight = i === g.firstRed || i === g.secondRed;
      ctx.strokeStyle = highlight ? red : ink;
      ctx.globalAlpha = highlight ? 0.95 : 0.38 + 0.12 * (1 - Math.abs(lane));
      ctx.lineWidth = highlight ? 2 : (scene.width < 420 ? 1.25 : 1.5);
      const shimmer = Math.sin(t * 1.6 + lane * 3) * 1.5;
      ctx.beginPath();
      for (let j = 0; j < g.points; j++) {
        const k = base + j, x = g.x[j];
        let y = g.base[k] + drift
          + (g.currentSin[k] * currentCos + g.currentCos[k] * currentSin) * g.currentAmp[j]
          + (g.crossSin[k] * crossCos - g.crossCos[k] * crossSin) * g.crossAmp[j]
          + g.surface[j] * (1 - lane * lane);
        if (warp > 0.001) {
          const dx = x - pointer.x, dy = y - pointer.y, distance = dx * dx + dy * dy;
          if (distance < radiusSquared * 8) y += warp * Math.exp(-distance / radiusSquared) * (dy * 0.42 + shimmer);
        }
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function ringHalf(front, scaleX, scaleY, centerX, centerY, ringX, ringY) {
    const g = ringGeometry, ctx = context;
    for (let order = 0; order < g.lines; order++) {
      const i = g.order[order], base = i * g.points, highlight = i === g.redIndex;
      ctx.strokeStyle = highlight ? red : ink;
      ctx.globalAlpha = highlight ? 0.95 : 0.43;
      ctx.lineWidth = highlight ? 2.3 : 1.55;
      ctx.beginPath();
      let lifted = true;
      for (let j = 0; j < g.points; j++) {
        const k = base + j;
        if ((g.z[k] < 0) !== front) { lifted = true; continue; }
        const x = ringX + (g.x[k] - centerX) * scaleX, y = ringY + (g.y[k] - centerY) * scaleY;
        if (lifted) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        lifted = false;
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function atomOrbital() {
    const g = ringGeometry, t = elapsed, w = scene.width, h = scene.height;
    const yawSin = Math.sin(0.38 + t * 0.105), yawCos = Math.cos(0.38 + t * 0.105);
    const tiltSin = Math.sin(0.83), tiltCos = Math.cos(0.83);
    const c4 = Math.cos(t * 0.52), s4 = Math.sin(t * 0.52), c7 = Math.cos(t * 0.34), s7 = Math.sin(t * 0.34);
    const c2 = Math.cos(t * 0.17), s2 = Math.sin(t * 0.17), c3 = Math.cos(t * 0.48), s3 = Math.sin(t * 0.48);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < g.lines; i++) for (let j = 0; j < g.points; j++) {
      const k = i * g.points + j;
      const r = g.base[i] + g.r4Sin[k] * c4 - g.r4Cos[k] * s4 + g.r7Sin[k] * c7 + g.r7Cos[k] * s7;
      const x = r * g.cos[j], y = r * g.sin[j];
      const z = g.z2Sin[k] * c2 + g.z2Cos[k] * s2 + g.z3Sin[k] * c3 + g.z3Cos[k] * s3;
      const ry = y * tiltCos - z * tiltSin, rz = y * tiltSin + z * tiltCos;
      const rx = x * yawCos + rz * yawSin, depth = -x * yawSin + rz * yawCos, perspective = 1 / (1 + depth * 0.14);
      const px = rx * perspective, py = ry * perspective;
      g.x[k] = px; g.y[k] = py; g.z[k] = depth;
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    }
    const scaleX = w * 0.94 / (maxX - minX), scaleY = h * 0.92 / (maxY - minY), scale = Math.min(scaleX, scaleY);
    const centerX = (minX + maxX) * 0.5, centerY = (minY + maxY) * 0.5;
    const halfW = w * 0.47, halfH = h * 0.46;
    const ringX = clamp(w * 0.5 + ringOffset.x, halfW + 6, w - halfW - 6);
    const ringY = clamp(h * 0.5 + ringOffset.y, halfH + 6, h - halfH - 6);
    ringHalf(false, scaleX, scaleY, centerX, centerY, ringX, ringY);
    const radius = Math.min(h * 0.29, w * 0.2), leash = scale * 0.22;
    const orbitX = ringX - centerX * scaleX, orbitY = ringY - centerY * scaleY;
    let leadX = w * 0.5 - centerX * scaleX + sphereOffset.x - orbitX;
    let leadY = h * 0.5 - centerY * scaleY + sphereOffset.y - orbitY;
    const lead = Math.hypot(leadX, leadY);
    if (lead > leash) { leadX *= leash / lead; leadY *= leash / lead; }
    const cx = clamp(orbitX + leadX, radius + 6, w - radius - 6), cy = clamp(orbitY + leadY, radius + 6, h - radius - 6);
    atomTrails(cx, cy, radius);
    ringHalf(true, scaleX, scaleY, centerX, centerY, ringX, ringY);
  }

  function atomTrails(cx, cy, radius) {
    const a = atomGeometry, t = elapsed, ctx = context;
    const yawSin = Math.sin(0.3 + t * 0.07), yawCos = Math.cos(0.3 + t * 0.07), tiltSin = Math.sin(0.32), tiltCos = Math.cos(0.32);
    for (let i = 0; i < a.orbits; i++) {
      const head = t * a.speed[i] + a.phase[i], headSin = Math.sin(head), headCos = Math.cos(head);
      for (let j = 0; j < a.points; j++) {
        const k = i * a.points + j;
        const c = headCos * a.cos[k] - headSin * a.sin[k], s = headSin * a.cos[k] + headCos * a.sin[k];
        const x = a.ax[i] * c + a.bx[i] * s, y = a.ay[i] * c + a.by[i] * s, z = a.bz[i] * s;
        const rx = x * yawCos + z * yawSin, rz = -x * yawSin + z * yawCos;
        const ry = y * tiltCos - rz * tiltSin, depth = y * tiltSin + rz * tiltCos, perspective = 1 / (1 + depth * 0.12);
        a.x[k] = cx + rx * radius * perspective; a.y[k] = cy + ry * radius * perspective; a.z[k] = depth;
      }
    }
    // Batch grey segments by opacity and depth instead of 190 separate strokes.
    for (let pass = 0; pass < 3; pass++) for (let band = 0; band < 10; band++) {
      const highlight = pass === 2, start = band * 8, end = start + 8, progress = end / 80;
      ctx.strokeStyle = highlight ? red : ink;
      ctx.lineWidth = highlight ? 1.9 : 1.1 + 0.25 * progress;
      ctx.globalAlpha = (highlight ? 0.96 : 0.7) * (0.12 + 0.88 * Math.pow(progress, 0.7)) * (pass === 0 ? 0.55 : 1);
      ctx.beginPath();
      for (let i = 0; i < a.orbits; i++) {
        if ((i === a.redIndex) !== highlight) continue;
        const base = i * a.points;
        const behind = a.z[base + start] + a.z[base + end] > 0;
        if (!highlight && behind !== (pass === 0)) continue;
        if (highlight && behind) ctx.globalAlpha = 0.96 * (0.12 + 0.88 * Math.pow(progress, 0.7)) * 0.55;
        ctx.moveTo(a.x[base + start], a.y[base + start]);
        for (let j = start + 1; j <= end; j++) ctx.lineTo(a.x[base + j], a.y[base + j]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!scene.width || !scene.height) return;
    context.clearRect(0, 0, scene.width, scene.height);
    if (animation === 'weave') weave(); else atomOrbital();
  }

  function pause() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTick = 0;
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || motionPreference.matches) return;
    if (lastTick) {
      const dt = Math.min(now - lastTick, 100) / 1000;
      elapsed += dt;
      easePointer(dt);
    }
    lastTick = now;
    // Paint on each display frame; the old 30 fps gate produced uneven 20 fps.
    draw();
    frame = requestAnimationFrame(tick);
  }

  function resume() {
    pause();
    if (motionPreference.matches) {
      pointer.target = 0;
      pointer.strength = 0;
      sphereOffset.x = 0;
      sphereOffset.y = 0;
      ringOffset.x = 0;
      ringOffset.y = 0;
    }
    if (visible && !document.hidden && !motionPreference.matches) {
      frame = requestAnimationFrame(tick);
    } else {
      draw();
    }
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    scene.width = bounds.width;
    scene.height = bounds.height;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(scene.width * density);
    canvas.height = Math.round(scene.height * density);
    context.setTransform(density, 0, 0, density, 0, 0);
    const styles = getComputedStyle(stage);
    ink = styles.getPropertyValue('--flow-ink').trim() || '#787b78';
    red = styles.getPropertyValue('--flow-red').trim() || '#b23b3d';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    prepareGeometry();
    draw();
  }

  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? false;
    resume();
  }, { rootMargin: '60px' }).observe(stage);
  stage.addEventListener('pointermove', trackPointer, { passive: true });
  stage.addEventListener('pointerleave', releasePointer);
  window.addEventListener('blur', releasePointer);
  motionPreference.addEventListener('change', resume);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  resize();
}
