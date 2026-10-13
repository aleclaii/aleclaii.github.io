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
  let lastPaint = 0;
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
    const dx = (pointer.x - scene.width * 0.5) * 0.35;
    const dy = (pointer.y - scene.height * 0.5) * 0.35;
    const gravity = 1 - Math.exp(-dt * 2.7);
    sphereOffset.x += (dx * pointer.strength - sphereOffset.x) * gravity;
    sphereOffset.y += (dy * pointer.strength - sphereOffset.y) * gravity;
    // The ribbon is the sphere's orbit, so it follows a beat behind.
    const drag = 1 - Math.exp(-dt * 1.6);
    ringOffset.x += (sphereOffset.x - ringOffset.x) * drag;
    ringOffset.y += (sphereOffset.y - ringOffset.y) * drag;
  }

  function path(ctx,points,colour,alpha=.5,weight=1.6) {
    ctx.strokeStyle=colour;ctx.globalAlpha=alpha;ctx.lineWidth=weight;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    let lifted=true;
    for(const point of points) {if(!point){lifted=true;continue;}if(lifted)ctx.moveTo(point[0],point[1]);else ctx.lineTo(point[0],point[1]);lifted=false;}
    ctx.stroke();ctx.globalAlpha=1;
  }
  function sample(fn,count=200) {return Array.from({length:count+1},(_,i)=>fn(i/count));}
  function strands(count,seed,fn) {const red=Math.round((.12+.76*seed)*(count-1));for(let i=0;i<count;i++)if(i!==red)fn(i,false);fn(red,true);}
  function weave(view, seconds, width, height, ink, red) {
    const context = view.ctx;
    const redThread = 0.14 + view.seed * 0.72;
    const WARP_AMOUNT = 0.42;
    const WARP_RADIUS = 0.32;
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

  function atomOrbital(view,t,w,h,grey,red) {
    const yaw=.38+t*.105,tilt=.83;
    const loops=Array.from({length:29},(_,i)=>{
      const lane=i/28*2-1;
      return sample(u=>{
        const theta=u*Math.PI*2;
        const r=1+lane*.115+.075*Math.sin(theta*4-t*.52+lane*1.4)+.027*Math.sin(theta*7+t*.34+lane*2.3);
        const x=r*Math.cos(theta),y=r*Math.sin(theta),z=lane*.20*Math.sin(theta*2+t*.17)+.075*Math.sin(theta*3+t*.48+lane*1.8);
        const ry=y*Math.cos(tilt)-z*Math.sin(tilt),rz=y*Math.sin(tilt)+z*Math.cos(tilt);
        const rx=x*Math.cos(yaw)+rz*Math.sin(yaw),depth=-x*Math.sin(yaw)+rz*Math.cos(yaw),perspective=1/(1+depth*.14);
        return [rx*perspective,ry*perspective,depth];
      },240);
    });
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const loop of loops)for(const [x,y]of loop){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    // While hovered the system contracts slightly, giving it room to travel.
    const s=pointer.strength,contract=1-.08*s*s*(3-2*s);
    const scale=Math.min(w*.86/(maxX-minX),h*.82/(maxY-minY))*contract,centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
    const clamp=(value,low,high)=>low>high?(low+high)/2:Math.max(low,Math.min(high,value));
    const halfW=(maxX-minX)/2*scale,halfH=(maxY-minY)/2*scale;
    const ringX=clamp(w*.5+ringOffset.x,halfW+6,w-halfW-6),ringY=clamp(h*.5+ringOffset.y,halfH+6,h-halfH-6);
    function ringHalf(front) {strands(29,view.seed,(i,highlight)=>{
      const points=loops[i].map(([x,y,z])=>(z<0)===front?[ringX+(x-centerX)*scale,ringY+(y-centerY)*scale]:null);
      path(view.ctx,points,highlight?red:grey,highlight?.95:.43,highlight?2.3:1.55);
    });}
    ringHalf(false);
    // The sphere leads toward the cursor but never leaves its ribbon.
    const radius=scale*.46,leash=scale*.22;
    const orbitX=ringX-centerX*scale,orbitY=ringY-centerY*scale;
    let leadX=w*.5-centerX*scale+sphereOffset.x-orbitX,leadY=h*.5-centerY*scale+sphereOffset.y-orbitY;
    const lead=Math.hypot(leadX,leadY);
    if(lead>leash){leadX*=leash/lead;leadY*=leash/lead;}
    const cx=clamp(orbitX+leadX,radius+6,w-radius-6),cy=clamp(orbitY+leadY,radius+6,h-radius-6);
    // Racing atom trails replace the wireframe globe. The outer ribbon owns
    // the single red strand; the central atom uses grey trails only.
    atomTrails(view,t,cx,cy,radius,grey);
    ringHalf(true);
  }
  function atomTrails(view,t,cx,cy,radius,grey) {
    const segments=[];
    const yaw=.3+t*.07,tilt=.32;
    const cosYaw=Math.cos(yaw),sinYaw=Math.sin(yaw),cosTilt=Math.cos(tilt),sinTilt=Math.sin(tilt);
    function project(x,y,z) {
      const rx=x*cosYaw+z*sinYaw,rz=-x*sinYaw+z*cosYaw;
      const ry=y*cosTilt-rz*sinTilt,depth=y*sinTilt+rz*cosTilt,perspective=1/(1+depth*.12);
      return [cx+rx*radius*perspective,cy+ry*radius*perspective,depth];
    }
    for(let i=0;i<19;i++) {
      const azimuth=i*2.399963+view.seed*6.28,inclination=.38+((i*.618034+view.seed)%1)*1.16;
      const a=[Math.cos(azimuth),Math.sin(azimuth),0];
      const b=[-Math.sin(azimuth)*Math.cos(inclination),Math.cos(azimuth)*Math.cos(inclination),Math.sin(inclination)];
      const speed=(i%2?-1:1)*(.95+(i%5)*.16),head=t*speed+i*1.83+view.seed*6.28,length=2.15+(i%3)*.24;
      const points=sample(u=>{const theta=head-length*(1-u),c=Math.cos(theta),sn=Math.sin(theta);return project(a[0]*c+b[0]*sn,a[1]*c+b[1]*sn,b[2]*sn);},80);
      for(let j=0;j<points.length-1;j+=8) {
        const end=Math.min(j+8,points.length-1),progress=end/(points.length-1),depth=(points[j][2]+points[end][2])/2;
        segments.push({points:points.slice(j,end+1),depth,alpha:.7*(.12+.88*Math.pow(progress,.7))*(depth>0?.55:1),weight:1.1+.25*progress});
      }
    }
    segments.sort((a,b)=>b.depth-a.depth);
    for(const segment of segments)path(view.ctx,segment.points,grey,segment.alpha,segment.weight);
  }

  function draw() {
    if (!scene.width || !scene.height) return;
    context.clearRect(0, 0, scene.width, scene.height);
    const renderer = animation === 'weave' ? weave : atomOrbital;
    renderer(scene, elapsed, scene.width, scene.height, ink, red);
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
    if (now - lastPaint >= 1000 / 30) {
      draw();
      lastPaint = now;
    }
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
