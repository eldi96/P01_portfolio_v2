import * as THREE from './vendor/three.module.min.js';

// Shared learning scene: four initial nodes, gradual collection, connection, autonomous drift.
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
let seed=8401;
const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const N=32;
const nodes=Array.from({length:N},(_,i)=>{
  const t=i/N*Math.PI*4.3;
  // An irregular, open ribbon rather than a closed globe or an icon.
  return {
    home:new THREE.Vector3(Math.sin(t)*(.75+rand()*.7),(i/(N-1)-.5)*3.4+(rand()-.5)*.3,Math.cos(t)*.9+(rand()-.5)*.7),
    from:new THREE.Vector3((rand()-.25)*13,(rand()-.5)*9,rand()*2-1),
    phase:rand()*Math.PI*2,
    radius:i%9===0?1.65:.65+rand()*.5,
    warm:i%9===0?.8:.12+rand()*.12
  };
});
// A spanning tree guarantees one coherent structure, followed by a few local triangles.
const edges=[],visited=new Set([0]),edgeKeys=new Set();
while(visited.size<N){
  let best=null;
  for(const a of visited)for(let b=0;b<N;b++)if(!visited.has(b)){
    const d=nodes[a].home.distanceToSquared(nodes[b].home);
    if(!best||d<best.d)best={a,b,d};
  }
  edges.push([best.a,best.b]);visited.add(best.b);edgeKeys.add([best.a,best.b].sort((a,b)=>a-b).join(':'));
}
const extra=[];
for(let a=0;a<N;a++)for(let b=a+1;b<N;b++){
  const d=nodes[a].home.distanceTo(nodes[b].home);
  if(d<1.4&&!edgeKeys.has(`${a}:${b}`))extra.push({a,b,d});
}
extra.sort((a,b)=>a.d-b.d);
edges.push(...extra.slice(0,19).map(e=>[e.a,e.b]));

window.createLearningArt=originalHost=>{
  if(originalHost.dataset.learningModel!=='security')return {draw(){}};
  const host=document.createElement('div');host.className='learning-network-shared';host.setAttribute('aria-hidden','true');
  originalHost.closest('.learning-stage').append(host);
  const canvas=document.createElement('canvas');host.append(canvas);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});}
  catch(error){host.remove();console.warn('Learning network unavailable',error);return {draw(){}};}
  const stage=originalHost.closest('.learning-stage');
  stage.querySelectorAll('[data-learning-art]').forEach(node=>node.classList.add('has-network-motion'));
  renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,50);
  camera.position.z=7;
  const group=new THREE.Group();scene.add(group);
  const position=new Float32Array(N*3),alpha=new Float32Array(N);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha',new THREE.BufferAttribute(alpha,1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('radius',new THREE.Float32BufferAttribute(nodes.map(n=>n.radius),1));
  geometry.setAttribute('warm',new THREE.Float32BufferAttribute(nodes.map(n=>n.warm),1));
  const pointMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{dpr:{value:1}},
    vertexShader:`attribute float alpha,radius,warm;uniform float dpr;varying float a,b,w;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);b=smoothstep(.4,1.65,abs(-p.z-7.));w=warm;a=alpha;
      gl_Position=projectionMatrix*p;gl_PointSize=(12.*radius+34.*b)*dpr*(7./-p.z);}`,
    fragmentShader:`precision highp float;varying float a,b,w;
      void main(){float r=length(gl_PointCoord*2.-1.);if(r>1.)discard;
      float core=exp(-r*r*38.);float halo=exp(-r*r*7.)*.23;
      float soft=exp(-r*r*3.8)*.33;
      float energy=mix(core+halo,soft,b);
      vec3 c=mix(vec3(.70,.79,.83),vec3(.87,.70,.42),w);
      c=mix(c,vec3(1.,.96,.86),core);
      gl_FragColor=vec4(c,a*energy);}`
  });
  group.add(new THREE.Points(geometry,pointMaterial));

  // Screen-space ribbons have stable, subpixel edges and genuine depth-dependent softness.
  const lp=new Float32Array(edges.length*6*3),la=new Float32Array(edges.length*6);
  const side=new Float32Array(edges.length*6),other=new Float32Array(lp.length);
  const lineGeometry=new THREE.BufferGeometry();
  lineGeometry.setAttribute('position',new THREE.BufferAttribute(lp,3).setUsage(THREE.DynamicDrawUsage));
  lineGeometry.setAttribute('other',new THREE.BufferAttribute(other,3).setUsage(THREE.DynamicDrawUsage));
  lineGeometry.setAttribute('alpha',new THREE.BufferAttribute(la,1).setUsage(THREE.DynamicDrawUsage));
  lineGeometry.setAttribute('side',new THREE.BufferAttribute(side,1));
  const across=new Float32Array(edges.length*6);
  for(let i=0;i<edges.length;i++)across.set([-1,1,-1,1,1,-1],i*6);
  lineGeometry.setAttribute('across',new THREE.BufferAttribute(across,1));
  for(let i=0;i<edges.length;i++)side.set([-1,1,-1,1,1,-1],i*6);
  const lineMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{viewport:{value:new THREE.Vector2(1,1)}},
    vertexShader:`attribute vec3 other;attribute float alpha,side,across;uniform vec2 viewport;varying float a,s,blur;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.),q=modelViewMatrix*vec4(other,1.);
      vec4 cp=projectionMatrix*p,cq=projectionMatrix*q;
      vec2 delta=(cq.xy/cq.w-cp.xy/cp.w)*viewport;
      vec2 normal=vec2(-delta.y,delta.x)/max(length(delta),.001);
      blur=smoothstep(.45,1.7,abs(-p.z-7.));
      cp.xy+=normal*side*(1.15+blur*4.)/viewport*cp.w;
      gl_Position=cp;a=alpha*(1.-blur*.65);s=across;}`,
    fragmentShader:`precision highp float;varying float a,s,blur;
      void main(){float coverage=exp(-s*s*mix(3.,2.,blur));
      gl_FragColor=vec4(.66,.70,.69,coverage*a);}`
  });
  const lines=new THREE.Mesh(lineGeometry,lineMaterial);lines.frustumCulled=false;group.add(lines);
  // Signals reuse the optical shader and travel only along already established links.
  const signalGeometry=new THREE.BufferGeometry(),signalPos=new Float32Array(9),signalAlpha=new Float32Array(3);
  signalGeometry.setAttribute('position',new THREE.BufferAttribute(signalPos,3));
  signalGeometry.setAttribute('alpha',new THREE.BufferAttribute(signalAlpha,1));
  signalGeometry.setAttribute('radius',new THREE.Float32BufferAttribute([1.4,1.1,1],1));
  signalGeometry.setAttribute('warm',new THREE.Float32BufferAttribute([1,1,1],1));
  group.add(new THREE.Points(signalGeometry,pointMaterial));

  let width=0,height=0;
  const pts=nodes.map(()=>new THREE.Vector3()),end=new THREE.Vector3();
  function draw(timeline,turn=null){
    // Static layouts (short windows / reduced motion) use the original scene images.
    if(!stage.closest('#learning').classList.contains('is-pinned')){
      host.style.opacity='0';host.style.visibility='hidden';return;
    }
    const mobile=innerWidth<=700,phase=timeline-2;
    const visible=ease((timeline-1.85)/.25);
    host.style.opacity=String(visible);host.style.visibility=visible?'visible':'hidden';
    if(!visible)return;
    const w=Math.round(host.clientWidth),h=Math.round(host.clientHeight);
    if(!w||!h)return;
    if(width!==w||height!==h){
      width=w;height=h;
      const dpr=Math.min(devicePixelRatio,2);renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);
      camera.aspect=width/height;camera.updateProjectionMatrix();
      pointMaterial.uniforms.dpr.value=dpr;lineMaterial.uniforms.viewport.value.set(width,height);
    }
    // Card two's heading starts at timeline 3 - .14; begin its first link there.
    const collect=clamp((phase+.03)/.85),connect=clamp((phase-.86)/1.14),live=ease((phase-2.03)/.5);
    const time=turn===null?0:Math.max(0,turn-.35)*60/(Math.PI*2);
    const viewH=2*7*Math.tan(20*Math.PI/180),viewW=viewH*width/height;
    group.position.set(mobile?0:-viewW*.24,mobile?viewH*.16:0,0);
    group.scale.setScalar(mobile?.64:1.12);
    // Motion increases gradually only after the structure has formed.
    group.rotation.set(Math.sin(time*.12)*.035*live,Math.sin(time*.09)*.21*live,-.07+Math.sin(time*.07)*.035*live);
    nodes.forEach((node,i)=>{
      const arrival=i<4?ease(collect/.20):ease((collect-(.23+(i-4)/(N-5)*.68))/.09);
      const travel=i<4?arrival:1;
      const point=pts[i].copy(node.from).lerp(node.home,travel);
      if(i>=4){point.x+=(1-arrival)*.18*Math.sin(node.phase);point.y+=(1-arrival)*.24;}
      const movement=.012+live*.13;
      point.x+=Math.sin(time*.23+node.phase)*movement;
      point.y+=Math.sin(time*.18+node.phase*1.3)*movement;
      point.z+=Math.cos(time*.16+node.phase)*movement;
      point.toArray(position,i*3);alpha[i]=arrival;
    });
    edges.forEach(([a,b],i)=>{
      const growth=ease(connect*edges.length-i);
      end.copy(pts[a]).lerp(pts[b],growth);
      const verts=[pts[a],pts[a],end,pts[a],end,end];
      const opposites=[end,end,pts[a],end,pts[a],pts[a]];
      // Reverse endpoint extrusion signs so both ends share the same screen normal.
      side.set([-1,1,1,1,-1,1],i*6);
      const highlight=Math.sin(growth*Math.PI);
      for(let j=0;j<6;j++){
        verts[j].toArray(lp,(i*6+j)*3);opposites[j].toArray(other,(i*6+j)*3);
        la[i*6+j]=growth?(.48+highlight*.55+live*.12)*Math.min(alpha[a],alpha[b]):0;
      }
    });
    for(let i=0;i<3;i++){
      const journey=time*.12+i*5.73,available=Math.floor(connect*edges.length);
      const e=edges[Math.floor(journey)%Math.max(available,1)];
      end.copy(pts[e[0]]).lerp(pts[e[1]],journey%1).toArray(signalPos,i*3);
      signalAlpha[i]=live*.8*Math.sin((journey%1)*Math.PI);
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.alpha.needsUpdate=true;
    for(const key of ['position','other','alpha','side'])lineGeometry.attributes[key].needsUpdate=true;
    signalGeometry.attributes.position.needsUpdate=true;signalGeometry.attributes.alpha.needsUpdate=true;
    renderer.render(scene,camera);
  }
  window.drawLearningNetwork=draw;
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();host.style.visibility='hidden';});
  return {draw(){}};
};

// Scroll-driven disintegration inspired by https://codepen.io/dev_loop/pen/mdVWRMv.
// Rasterize only the title, then distribute its pixels into deterministic dust layers.
window.createLearningSmoke=host=>{
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)return null;
  const source=document.createElement('canvas'),ink=source.getContext('2d',{willReadFrequently:true});
  if(!ink)return null;
  const count=48;
  let width=0,height=0,dpr=1,layers=[],last='',fontVersion=0,builtFont=-1;
  const title=host.parentElement.querySelector('h2');
  const random=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
  document.fonts?.ready.then(()=>{fontVersion++;window.dispatchEvent(new Event('resize'));});
  function rebuild(w,h){
    width=w;height=h;builtFont=fontVersion;dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    source.width=canvas.width;source.height=canvas.height;
    const sw=source.width,sh=source.height,style=getComputedStyle(title);
    ink.setTransform(dpr,0,0,dpr,0,0);
    ink.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
    if('letterSpacing' in ink)ink.letterSpacing=style.letterSpacing;
    ink.fillStyle=style.color;ink.textAlign='center';ink.textBaseline='middle';
    ink.fillText(title.textContent,w/2,h/2,w*.94);
    const pixels=ink.getImageData(0,0,sw,sh);
    const buffers=Array.from({length:count},()=>ink.createImageData(sw,sh));
    // Each pixel belongs to one layer: the resting title has no opacity buildup.
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
      const offset=(y*sw+x)*4;
      if(!pixels.data[offset+3])continue;
      const bucket=Math.min(count-1,Math.floor(count*(x/sw*.65+random(x,y)*.35)));
      buffers[bucket].data.set(pixels.data.subarray(offset,offset+4),offset);
    }
    layers=buffers.map((data,i)=>{
      const layer=document.createElement('canvas');layer.width=sw;layer.height=sh;
      layer.getContext('2d').putImageData(data,0,0);
      return {canvas:layer,dx:w*(.12+random(i,2)*.24),dy:h*(-.65+random(i,3)*1.05),rotation:(random(i,4)-.5)*.3};
    });
  }
  host.append(canvas);host.classList.add('has-smoke-canvas');
  return {draw(reveal,dissolve){
    const w=Math.round(host.clientWidth),h=Math.round(host.clientHeight);
    if(!w||!h)return;
    const state=reveal.toFixed(4)+':'+dissolve.toFixed(4);
    if(width!==w||height!==h||builtFont!==fontVersion){rebuild(w,h);last='';}
    if(state===last)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    if(dissolve<=0&&reveal>=1){
      ctx.drawImage(source,0,0,w,h);
    }else if(dissolve<1){
      layers.forEach((layer,i)=>{
        const arrival=clamp((reveal-i/count*.32)/.68);
        const gathering=1-arrival;
        const local=clamp((dissolve-i/count*.48)/.52);
        const travel=local*local,gatherTravel=gathering*gathering;
        ctx.save();ctx.globalAlpha=ease(arrival)*(1-ease(local));
        ctx.translate(w/2+layer.dx*(travel-gatherTravel),h/2+layer.dy*(travel+gatherTravel));
        ctx.rotate(layer.rotation*(travel-gatherTravel));
        ctx.drawImage(layer.canvas,-w/2,-h/2,w,h);ctx.restore();
      });
    }
    ctx.globalAlpha=1;last=state;
    host.dataset.smokeReveal=reveal.toFixed(3);host.dataset.smokeDissolve=dissolve.toFixed(3);
  }};
};
window.dispatchEvent(new Event('learning-art-ready'));
