// Three hero options: weave, atom orbital, and a three-body atom dance.
// Choose once per page entry. Resizing, hovering, and clicking keep that choice.
const stage = document.getElementById('hero-animation');
const canvas = stage?.querySelector('canvas');
const context = canvas?.getContext('2d', { alpha: true });

if (stage && canvas && context) {
  const animations = ['weave', 'atom-orbital', 'three-body'];
  // `?hero=weave|atom-orbital|three-body` pins one option for previewing.
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
  const gravityCenter = { x: 0, y: 0 };
  const bodies = Array.from({ length: 3 }, (_, index) => ({ index, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, squash: 0, nx: 1, ny: 0, nz: 0, contact: 0 }));
  const depthOrder = [...bodies];
  // A bounded pool lets repeated clicks overlap without adding frame work forever.
  const ripples = Array.from({ length: 3 }, () => ({ start: -Infinity, distance: null }));
  let nextRipple = 0;

  function rippleWeave(event) {
    if (animation !== 'weave' || window.FREEZE_ANIMATIONS || motionPreference.matches || !weaveGeometry) return;
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    const ripple = ripples[nextRipple];
    nextRipple = (nextRipple + 1) % ripples.length;
    ripple.start = elapsed;
    const g = weaveGeometry;
    // Calculate distances only on activation, not in the animation loop.
    for (let i = 0; i < g.lines; i++) for (let j = 0; j < g.points; j++) {
      const k = i * g.points + j;
      ripple.distance[k] = Math.hypot(g.x[j] - x, g.base[k] - y);
    }
  }

  function repelBodies(event) {
    if (animation !== 'three-body' || window.FREEZE_ANIMATIONS || motionPreference.matches) return;
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    const launch = Math.min(scene.width, scene.height) * 1.25;
    for (const body of bodies) {
      const perspective = 1 / (1 + body.z / (scene.height * 1.6));
      let dx = scene.width * 0.5 + (body.x - scene.width * 0.5) * perspective - x;
      let dy = scene.height * 0.5 + (body.y - scene.height * 0.5) * perspective - y;
      let distance = Math.hypot(dx, dy);
      // A click exactly on a center still launches that sphere.
      if (distance < 1) {
        const angle = body.index * Math.PI * 2 / 3 + elapsed;
        dx = Math.cos(angle); dy = Math.sin(angle); distance = 1;
      }
      body.vx += dx / distance * launch;
      body.vy += dy / distance * launch;
      const speed = Math.hypot(body.vx, body.vy), limit = launch * 1.5;
      if (speed > limit) { body.vx *= limit / speed; body.vy *= limit / speed; }
    }
  }

  function trackPointer(event) {
    if (event.pointerType === 'touch' || window.FREEZE_ANIMATIONS || motionPreference.matches) return;
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
    const attraction = 1 - Math.exp(-dt * 1.2);
    gravityCenter.x += ((pointer.x - scene.width * 0.5) * pointer.strength - gravityCenter.x) * attraction;
    gravityCenter.y += ((pointer.y - scene.height * 0.5) * pointer.strength - gravityCenter.y) * attraction;
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
        surface: new Float32Array(points), lane: new Float32Array(lines), ripple: new Float32Array(size)
      };
      for (const ripple of ripples) {
        ripple.start = -Infinity;
        ripple.distance = new Float32Array(size);
      }
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

    const orbits = animation === 'three-body' ? 13 : 19, trailPoints = 81;
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
    g.ripple.fill(0);
    const speed = scene.width * 0.65, band = scene.height * 0.18;
    for (const ripple of ripples) {
      const age = t - ripple.start;
      if (age < 0 || age > 2.8) continue;
      const front = age * speed;
      const amplitude = Math.min(26, scene.height * 0.075) * (1 - Math.exp(-age * 16)) * Math.exp(-age * 1.15);
      for (let k = 0; k < g.ripple.length; k++) {
        const offset = ripple.distance[k] - front;
        if (Math.abs(offset) > band * 2.5) continue;
        g.ripple[k] += amplitude * Math.exp(-offset * offset / (band * band)) * Math.cos(offset * Math.PI * 2 / (band * 1.6));
      }
    }
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
        y += g.ripple[k];
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

  function atomTrails(cx, cy, radius, phaseOffset = 0, shape = null) {
    const a = atomGeometry, t = elapsed + phaseOffset, ctx = context;
    const yawSin = Math.sin(0.3 + t * 0.07), yawCos = Math.cos(0.3 + t * 0.07), tiltSin = Math.sin(0.32), tiltCos = Math.cos(0.32);
    for (let i = 0; i < a.orbits; i++) {
      const head = t * a.speed[i] * 1.5 + a.phase[i], headSin = Math.sin(head), headCos = Math.cos(head);
      for (let j = 0; j < a.points; j++) {
        const k = i * a.points + j;
        const c = headCos * a.cos[k] - headSin * a.sin[k], s = headSin * a.cos[k] + headCos * a.sin[k];
        const x = a.ax[i] * c + a.bx[i] * s, y = a.ay[i] * c + a.by[i] * s, z = a.bz[i] * s;
        const rx = x * yawCos + z * yawSin, rz = -x * yawSin + z * yawCos;
        let px = rx, py = y * tiltCos - rz * tiltSin, depth = y * tiltSin + rz * tiltCos;
        if (shape && shape.squash > 0.001) {
          const squeeze = 1 - shape.squash, swell = 1 / Math.sqrt(squeeze);
          const along = px * shape.nx + py * shape.ny + depth * shape.nz;
          px = px * swell + shape.nx * along * (squeeze - swell);
          py = py * swell + shape.ny * along * (squeeze - swell);
          depth = depth * swell + shape.nz * along * (squeeze - swell);
        }
        const perspective = 1 / (1 + depth * 0.12);
        a.x[k] = cx + px * radius * perspective; a.y[k] = cy + py * radius * perspective; a.z[k] = depth;
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

  function advanceThreeBody(dt, initialize = false) {
    const w = scene.width, h = scene.height;
    const radius = Math.min(h * 0.23, w * 0.135), contact = radius * 2.15;
    const spanX = w * 0.28, spanY = h * 0.22, spanZ = radius * 1.15;
    const margin = radius * 1.5 + 5;
    const cx = clamp(w * 0.5 + gravityCenter.x, margin, w - margin);
    const cy = clamp(h * 0.5 + gravityCenter.y, margin, h - margin);
    const time = elapsed * 0.38 + scene.seed * Math.PI * 2;
    const steps = Math.max(1, Math.ceil(dt * 120)), step = dt / steps;
    // A restrained orbital guide keeps this decorative gravity system bounded.
    // Contacts are compliant spring forces, never position snaps or hard stops.
    for (let n = 0; n < steps; n++) {
      for (const body of bodies) {
        const phase = time + body.index * Math.PI * 2 / 3;
        const s = Math.sin(phase), c = Math.cos(phase), denominator = 1 + s * s;
        const targetX = clamp(cx + spanX * c / denominator, margin, w - margin);
        const targetY = clamp(cy + spanY * 2 * s * c / denominator, margin, h - margin);
        const targetZ = spanZ * Math.sin(phase + 0.65);
        if (initialize) {
          body.x = targetX; body.y = targetY; body.z = targetZ;
          body.vx = 0; body.vy = 0; body.vz = 0; body.squash = 0;
        }
        body.contact = 0;
        body.vx += ((targetX - body.x) * 2.2 - body.vx * 1.1) * step;
        body.vy += ((targetY - body.y) * 2.2 - body.vy * 1.1) * step;
        body.vz += ((targetZ - body.z) * 2.2 - body.vz * 1.1) * step;
      }
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
        const a = bodies[i], b = bodies[j];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const distance = Math.max(0.001, Math.hypot(dx, dy, dz));
        const nx = dx / distance, ny = dy / distance, nz = dz / distance;
        const softened = distance * distance + radius * radius * 0.64;
        let force = radius * radius * radius * 1.1 / softened;
        if (distance < contact) {
          const overlap = contact - distance;
          const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
          force -= overlap * 6 + Math.max(0, -approach) * 2.6;
          const compression = Math.min(0.32, overlap / contact * 1.3);
          for (let member = 0; member < 2; member++) {
            const body = member === 0 ? a : b;
            if (compression > body.contact) {
              body.contact = compression; body.nx = nx; body.ny = ny; body.nz = nz;
            }
          }
        }
        const impulse = force * step;
        a.vx += nx * impulse; a.vy += ny * impulse; a.vz += nz * impulse;
        b.vx -= nx * impulse; b.vy -= ny * impulse; b.vz -= nz * impulse;
      }
      for (const body of bodies) {
        // Soft edge restoring forces leave room for the trails to bulge.
        const perspective = 1 / (1 + body.z / (h * 1.6));
        const shell = radius * 1.2 / Math.sqrt(1 - body.squash);
        const boundX = shell + 5 / perspective + w * 0.5 * (1 - 1 / perspective);
        const boundY = shell + 5 / perspective + h * 0.5 * (1 - 1 / perspective);
        body.vx += (Math.max(0, boundX - body.x) - Math.max(0, body.x - w + boundX)) * 22 * step;
        body.vy += (Math.max(0, boundY - body.y) - Math.max(0, body.y - h + boundY)) * 22 * step;
        // Cushion outward launches at the edges without hard position snaps.
        const cushion = radius * 0.65;
        const edgeX = Math.min(body.x - boundX, w - boundX - body.x);
        const edgeY = Math.min(body.y - boundY, h - boundY - body.y);
        if (edgeX < cushion && ((body.x < w * 0.5 && body.vx < 0) || (body.x > w * 0.5 && body.vx > 0))) {
          body.vx *= Math.exp(-step * 14 * clamp(1 - edgeX / cushion, 0, 2));
        }
        if (edgeY < cushion && ((body.y < h * 0.5 && body.vy < 0) || (body.y > h * 0.5 && body.vy > 0))) {
          body.vy *= Math.exp(-step * 14 * clamp(1 - edgeY / cushion, 0, 2));
        }
        body.x += body.vx * step; body.y += body.vy * step; body.z += body.vz * step;
        body.squash += (body.contact - body.squash) * (1 - Math.exp(-step * 6));
      }
    }
  }

  function threeBody() {
    const w = scene.width, h = scene.height;
    const radius = Math.min(h * 0.23, w * 0.135);
    depthOrder.sort((a, b) => b.z - a.z);
    for (const body of depthOrder) {
      const perspective = 1 / (1 + body.z / (h * 1.6));
      const x = w * 0.5 + (body.x - w * 0.5) * perspective;
      const y = h * 0.5 + (body.y - h * 0.5) * perspective;
      atomTrails(x, y, radius * perspective, body.index * 2.7, body);
    }
  }

  function draw() {
    if (!scene.width || !scene.height) return;
    context.clearRect(0, 0, scene.width, scene.height);
    if (animation === 'weave') weave();
    else if (animation === 'three-body') threeBody();
    else atomOrbital();
  }

  function pause() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTick = 0;
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || window.FREEZE_ANIMATIONS || motionPreference.matches) return;
    if (lastTick) {
      const dt = Math.min(now - lastTick, 100) / 1000;
      elapsed += dt;
      easePointer(dt);
      if (animation === 'three-body') advanceThreeBody(dt);
    }
    lastTick = now;
    // Paint on each display frame; the old 30 fps gate produced uneven 20 fps.
    draw();
    frame = requestAnimationFrame(tick);
  }

  function resume() {
    pause();
    if (window.FREEZE_ANIMATIONS) return;
    if (motionPreference.matches) {
      for (const ripple of ripples) ripple.start = -Infinity;
      pointer.target = 0;
      pointer.strength = 0;
      sphereOffset.x = 0;
      sphereOffset.y = 0;
      ringOffset.x = 0;
      ringOffset.y = 0;
      gravityCenter.x = 0;
      gravityCenter.y = 0;
      if (animation === 'three-body') advanceThreeBody(0, true);
    }
    if (!visible || document.hidden) return;
    if (!motionPreference.matches) {
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
    if (animation === 'three-body') advanceThreeBody(0, true);
    draw();
  }

  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? false;
    resume();
  }, { rootMargin: '60px' }).observe(stage);
  stage.addEventListener('pointermove', trackPointer, { passive: true });
  stage.addEventListener('pointerleave', releasePointer);
  stage.addEventListener('click', rippleWeave);
  stage.addEventListener('click', repelBodies);
  window.addEventListener('blur', releasePointer);
  motionPreference.addEventListener('change', resume);
  document.addEventListener('portfolio:motionchange', resume);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  resize();
}
