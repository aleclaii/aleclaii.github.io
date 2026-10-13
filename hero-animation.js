// Approved hero studies: orbital ribbon and atom trails.
// Choose once per page entry. Resizing, hovering, and clicking keep that choice.
const stage = document.getElementById('hero-animation');
const canvas = stage?.querySelector('canvas');
const context = canvas?.getContext('2d', { alpha: true });

if (stage && canvas && context) {
  const animation = Math.random() < 0.5 ? 'orbital' : 'atom';
  const scene = { ctx: context, seed: Math.random(), width: 0, height: 0 };
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  stage.dataset.animation = animation;
  let ink = '#787b78';
  let red = '#b23b3d';
  let paper = '#f3f0e9';
  let elapsed = 1.7;
  let visible = false;
  let frame = 0;
  let lastTick = 0;
  let lastPaint = 0;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, target: 0 };
  const sphereOffset = { x: 0, y: 0 };

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
    const follow = 1 - Math.exp(-dt * 5);
    pointer.x += (pointer.targetX - pointer.x) * follow;
    pointer.y += (pointer.targetY - pointer.y) * follow;
    pointer.strength += (pointer.target - pointer.strength) * (1 - Math.exp(-dt * 4));
    // The sphere has a slower response and bounded travel inside its ribbon.
    const dx = (pointer.x - scene.width * 0.5) * 0.3;
    const dy = (pointer.y - scene.height * 0.5) * 0.3;
    const distance = Math.hypot(dx, dy);
    const limit = Math.min(scene.width, scene.height) * 0.16;
    const scale = distance > limit ? limit / distance : 1;
    const gravity = 1 - Math.exp(-dt * 1.8);
    sphereOffset.x += (dx * scale * pointer.strength - sphereOffset.x) * gravity;
    sphereOffset.y += (dy * scale * pointer.strength - sphereOffset.y) * gravity;
  }

  function path(ctx,points,colour,alpha=.5,weight=1.6) {
    ctx.strokeStyle=colour;ctx.globalAlpha=alpha;ctx.lineWidth=weight;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    let lifted=true;
    for(const point of points) {if(!point){lifted=true;continue;}if(lifted)ctx.moveTo(point[0],point[1]);else ctx.lineTo(point[0],point[1]);lifted=false;}
    ctx.stroke();ctx.globalAlpha=1;
  }
  function sample(fn,count=200) {return Array.from({length:count+1},(_,i)=>fn(i/count));}
  function strands(count,seed,fn) {const red=Math.round((.12+.76*seed)*(count-1));for(let i=0;i<count;i++)if(i!==red)fn(i,false);fn(red,true);}
  function orbital(view,t,w,h,grey,red,paper) {
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
    const scale=Math.min(w*.86/(maxX-minX),h*.82/(maxY-minY)),centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
    function ringHalf(front) {strands(29,view.seed,(i,highlight)=>{
      const points=loops[i].map(([x,y,z])=>(z<0)===front?[w*.5+(x-centerX)*scale,h*.5+(y-centerY)*scale]:null);
      path(view.ctx,points,highlight?red:grey,highlight?.95:.43,highlight?2.3:1.55);
    });}
    ringHalf(false);
    const ctx=view.ctx,cx=w*.5-centerX*scale+sphereOffset.x,cy=h*.5-centerY*scale+sphereOffset.y,radius=scale*.46;
    ctx.fillStyle=paper;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fill();
    function globe(lat,lon){const x=Math.cos(lat)*Math.sin(lon),y=Math.sin(lat),z=Math.cos(lat)*Math.cos(lon),py=y*Math.cos(.3)-z*Math.sin(.3),pz=y*Math.sin(.3)+z*Math.cos(.3);return pz>=0?[cx+radius*x,cy+radius*py]:null;}
    for(let i=-5;i<=5;i++)path(ctx,sample(u=>globe(i*.24,u*Math.PI*2),160),grey,.30,1.1);
    for(let i=-5;i<=5;i++)path(ctx,sample(u=>globe((u-.5)*Math.PI,i*.26),120),grey,.26,1.1);
    path(ctx,sample(u=>[cx+radius*Math.cos(u*Math.PI*2),cy+radius*Math.sin(u*Math.PI*2)]),grey,.55,1.3);
    ringHalf(true);
  }
  function atom(view,t,w,h,grey,red) {
    const radius=Math.min(w*.37,h*.40),count=19,redIndex=Math.floor(view.seed*count),segments=[];
    const yaw=.3+t*.07,tilt=.32;
    function project(x,y,z) {
      const rx=x*Math.cos(yaw)+z*Math.sin(yaw),rz=-x*Math.sin(yaw)+z*Math.cos(yaw);
      const ry=y*Math.cos(tilt)-rz*Math.sin(tilt),depth=y*Math.sin(tilt)+rz*Math.cos(tilt),perspective=1/(1+depth*.12);
      return [w*.5+rx*radius*perspective,h*.5+ry*radius*perspective,depth];
    }
    for(let i=0;i<count;i++) {
      const highlight=i===redIndex;
      const azimuth=i*2.399963+view.seed*6.28,inclination=.38+((i*.618034+view.seed)%1)*1.16;
      const a=[Math.cos(azimuth),Math.sin(azimuth),0];
      const b=[-Math.sin(azimuth)*Math.cos(inclination),Math.cos(azimuth)*Math.cos(inclination),Math.sin(inclination)];
      const speed=(i%2?-1:1)*(.95+(i%5)*.16),head=t*speed+i*1.83+view.seed*6.28;
      const length=highlight?3.15:2.15+(i%3)*.24;
      const intercept = 0.75;
      const anchorTheta = head - length * (1 - intercept);
      const anchor = project(a[0]*Math.cos(anchorTheta)+b[0]*Math.sin(anchorTheta),a[1]*Math.cos(anchorTheta)+b[1]*Math.sin(anchorTheta),b[2]*Math.sin(anchorTheta));
      const points=sample(u=>{
        const theta=head-length*(1-u),c=Math.cos(theta),s=Math.sin(theta);
        const point = project(a[0]*c+b[0]*s,a[1]*c+b[1]*s,b[2]*s);
        // Each distinct orbit passes through the cursor at the same sampled
        // point. A compact smooth bend preserves the rest of its moving path.
        const bend = Math.pow(Math.max(0, 1 - Math.pow((u - intercept) / 0.32, 2)), 2) * pointer.strength;
        point[0] += (pointer.x - anchor[0]) * bend;
        point[1] += (pointer.y - anchor[1]) * bend;
        point[2] *= 1 - bend;
        return point;
      },80);
      for(let j=0;j<points.length-1;j+=8) {
        const end=Math.min(j+8,points.length-1),progress=end/(points.length-1),depth=(points[j][2]+points[end][2])/2;
        segments.push({points:points.slice(j,end+1),depth,highlight,alpha:(highlight?.94:.64)*(.12+.88*Math.pow(progress,.7))*(depth>0?.55:1),weight:highlight?2.45:1.55+.35*progress});
      }
    }
    segments.sort((a,b)=>b.depth-a.depth);
    for(const segment of segments)path(view.ctx,segment.points,segment.highlight?red:grey,segment.alpha,segment.weight);
  }

  function draw() {
    if (!scene.width || !scene.height) return;
    context.clearRect(0, 0, scene.width, scene.height);
    const renderer = animation === 'orbital' ? orbital : atom;
    renderer(scene, elapsed, scene.width, scene.height, ink, red, paper);
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
    paper = styles.getPropertyValue('--paper').trim() || '#f3f0e9';
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
