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
  originalHost.classList.add('has-network-motion');
  if(originalHost.dataset.learningModel!=='security')return {draw(){}};
  const host=document.createElement('div');host.className='learning-network-shared';host.setAttribute('aria-hidden','true');
  originalHost.closest('.learning-stage').append(host);
  const canvas=document.createElement('canvas');host.append(canvas);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});}
  catch(error){host.remove();console.warn('Learning network unavailable',error);return {draw(){}};}
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
    const collect=clamp((phase+.03)/.85),connect=clamp((phase-1.64)/.36),live=ease((phase-2.03)/.5);
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

// A text texture is advected through procedural noise, then resolves to crisp type.
window.createLearningSmoke=host=>{
  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
    renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    const textCanvas=document.createElement('canvas');textCanvas.width=2048;textCanvas.height=768;
    const ctx=textCanvas.getContext('2d');
    const texture=new THREE.CanvasTexture(textCanvas);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
    const drawType=()=>{
      ctx.clearRect(0,0,2048,768);ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='500 266px "DM Sans", sans-serif';
      const size=Math.min(266,266*1840/ctx.measureText('Stay curious.').width);
      ctx.font='500 '+size+'px "DM Sans", sans-serif';ctx.fillText('Stay curious.',1024,397);texture.needsUpdate=true;
    };
    drawType();document.fonts?.ready.then(drawType);
    const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{map:{value:texture},reveal:{value:0},dissolve:{value:0},time:{value:0}},vertexShader:
      'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:
      `precision mediump float;
      varying vec2 uv0;uniform sampler2D map;uniform float reveal,dissolve,time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.1+3.7;a*=.5;}return v;}
      float ink(vec2 p){return texture2D(map,clamp(p,vec2(.001),vec2(.999))).a;}
      void main(){
        float forming=1.-reveal,breaking=dissolve;
        vec2 p=uv0;
        float n=fbm(p*vec2(8.,4.)+vec2(time*.12,-time*.09));
        float n2=fbm(p*vec2(13.,6.)+vec2(4.7,-time*.16));
        vec2 drift=vec2(n-.5,n2-.5);
        p+=drift*(forming*.035+breaking*.04);
        p.y-=breaking*(.025+n*.06)+forming*(n-.5)*.035;
        float energy=max(forming,breaking);
        float radius=forming*.014+breaking*.024;
        float core=ink(p);
        float vapor=(ink(p+vec2(radius,0.))+ink(p-vec2(radius,0.))+ink(p+vec2(0.,radius*1.7))+ink(p-vec2(0.,radius*1.7)))*.25;
        float gather=smoothstep(n2-.14,n2+.14,reveal*1.3-.12);
        float scatter=1.-smoothstep(n-.18,n+.18,dissolve*1.35-.12);
        float wisps=smoothstep(.22,.76,fbm(p*vec2(50.,18.)+drift*3.));
        float plume=ink(p+vec2(drift.x*.02,-energy*.028))*.4+ink(p+vec2(drift.x*.04,-energy*.058))*.35+ink(p+vec2(drift.x*.06,-energy*.09))*.25;
        float resolved=core*reveal*reveal*pow(1.-breaking,2.5);
        float mist=(vapor*.5+plume*.5)*(forming*.55+breaking*.65)*(.25+wisps*.75);
        float alpha=(resolved+mist)*gather*scatter;
        alpha*=smoothstep(0.,.08,reveal)*(1.-smoothstep(.91,1.,dissolve));
        gl_FragColor=vec4(vec3(.953,.937,.901),clamp(alpha,0.,1.));
      }`});
    const scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
    let width=0,height=0,last='';
    host.append(renderer.domElement);host.classList.add('has-smoke-canvas');
    return {draw(reveal,dissolve,elapsed){
      const w=Math.round(host.clientWidth),h=Math.round(host.clientHeight);
      if(!w||!h)return;
      const state=reveal.toFixed(4)+':'+dissolve.toFixed(4)+':'+((reveal>0&&reveal<1)||(dissolve>0&&dissolve<1)?elapsed.toFixed(2):'still');
      if(state===last&&width===w&&height===h)return;
      if(width!==w||height!==h){renderer.setSize(w,h,false);width=w;height=h;}
      material.uniforms.reveal.value=reveal;material.uniforms.dissolve.value=dissolve;material.uniforms.time.value=elapsed;
      renderer.render(scene,camera);last=state;
      host.dataset.smokeReveal=reveal.toFixed(3);host.dataset.smokeDissolve=dissolve.toFixed(3);
    }};
  }catch(error){renderer?.dispose();return null;}
};
window.dispatchEvent(new Event('learning-art-ready'));

