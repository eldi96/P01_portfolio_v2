import * as THREE from './vendor/three.module.min.js';

const TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
// All three scenes use identical seeded nodes and topology: collect, connect, retain.
let seed=7319;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const nodes=Array.from({length:48},(_,i)=>{
  const theta=random()*TAU,z=random()*2-1,r=Math.pow(random(),.42)*1.65;
  const c=Math.sqrt(1-z*z);
  return {base:new THREE.Vector3(Math.cos(theta)*c*r,z*r*.92,Math.sin(theta)*c*r),
    scatter:new THREE.Vector3((random()-.5)*9,(random()-.5)*8,(random()-.5)*5),
    record:new THREE.Vector3((i%13-6)*.245+(random()-.5)*.09, (Math.floor(i/26)-1.5)*.63+(random()-.5)*.10, (Math.floor(i/13)%2-.5)*1.12+(random()-.5)*.12),
    size:random()>.85?9:4.5+random()*2.5,phase:random()*TAU};
});
// A spare spatial loop, deliberately neither an icon nor a rectangular frame.
const contour=[[-1.3,.45,-.35],[-.65,1.3,.20],[.65,1.05,.55],[1.3,-.05,-.12],[.2,-1.3,-.45],[-.95,-.65,.35]];
for(let i=0;i<nodes.length;i++){
 const t=i/nodes.length*contour.length,k=Math.floor(t),a=contour[k],b=contour[(k+1)%contour.length];
 nodes[i].record.set(a[0]+(b[0]-a[0])*(t-k),a[1]+(b[1]-a[1])*(t-k),a[2]+(b[2]-a[2])*(t-k));
}
const edges=[];
nodes.forEach((node,i)=>{
  const near=nodes.map((other,j)=>({j,d:node.base.distanceTo(other.base)})).filter(v=>v.j!==i).sort((a,b)=>a.d-b.d).slice(0,2);
  near.forEach(({j,d})=>{if(i<j&&d<1.15)edges.push([i,j]);});
});
edges.sort((a,b)=>nodes[a[0]].base.distanceTo(nodes[a[1]].base)-nodes[b[0]].base.distanceTo(nodes[b[1]].base));
edges.splice(26);
window.createLearningArt=originalHost=>{
  originalHost.classList.add('has-network-motion');
  if(originalHost.dataset.learningModel!=='security')return {draw(){}};
  const host=document.createElement('div');host.className='learning-network-shared';host.setAttribute('aria-hidden','true');
  const stageHost=originalHost.closest('.learning-stage');stageHost.append(host);
  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.1,30);
    camera.position.set(0,.1,6.7);camera.lookAt(0,0,0);
    const root=new THREE.Group();scene.add(root);
    const positions=new Float32Array(nodes.length*3),alphas=new Float32Array(nodes.length),sizes=new Float32Array(nodes.length);
    nodes.forEach((node,i)=>sizes[i]=node.size*1.65);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('alpha',new THREE.BufferAttribute(alphas,1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));
    const pointMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixelRatio:{value:Math.min(devicePixelRatio,2)}},
      vertexShader:'attribute float alpha,size;varying float opacity,depth;uniform float pixelRatio;void main(){vec4 p=modelViewMatrix*vec4(position,1.);opacity=alpha;depth=clamp((11.+p.z)/5.,.55,1.);gl_Position=projectionMatrix*p;gl_PointSize=size*pixelRatio*5.4/-p.z;}',
      fragmentShader:`precision highp float;varying float opacity,depth;
 void main(){vec2 q=gl_PointCoord*2.-1.;float r2=dot(q,q);if(r2>1.)discard;
 vec3 n=vec3(q.x,-q.y,sqrt(max(0.,1.-r2))),light=normalize(vec3(-.48,.62,1.));
 float diffuse=max(0.,dot(n,light));
 float spec=pow(max(0.,dot(n,normalize(light+vec3(0.,0.,1.)))),70.);
 float rim=pow(1.-n.z,3.);
 vec3 color=vec3(.65,.64,.59)*(.19+.70*diffuse)+vec3(.98,.96,.88)*spec*.85+vec3(.50,.48,.41)*rim*.22;
 gl_FragColor=vec4(color,(1.-smoothstep(.88,1.,sqrt(r2)))*opacity*depth);}`

    });
    root.add(new THREE.Points(geometry,pointMaterial));
    const linePositions=new Float32Array(edges.length*6),lineAlpha=new Float32Array(edges.length*2);
    const lineGeometry=new THREE.BufferGeometry();
    lineGeometry.setAttribute('position',new THREE.BufferAttribute(linePositions,3).setUsage(THREE.DynamicDrawUsage));
    lineGeometry.setAttribute('alpha',new THREE.BufferAttribute(lineAlpha,1).setUsage(THREE.DynamicDrawUsage));
    const lineMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      vertexShader:'attribute float alpha;varying float opacity;void main(){vec4 p=modelViewMatrix*vec4(position,1.);opacity=alpha*clamp((10.+p.z)/6.,.25,1.);gl_Position=projectionMatrix*p;}',
      fragmentShader:'precision mediump float;varying float opacity;void main(){gl_FragColor=vec4(.76,.74,.67,opacity);}'
    });
    root.add(new THREE.LineSegments(lineGeometry,lineMaterial));
    const pulsePositions=new Float32Array(3*3),pulseGeometry=new THREE.BufferGeometry();
    pulseGeometry.setAttribute('position',new THREE.BufferAttribute(pulsePositions,3).setUsage(THREE.DynamicDrawUsage));
    const pulseMaterial=new THREE.PointsMaterial({color:'#d8b76e',size:.039,transparent:true,opacity:0,depthWrite:false});
    // Circular soft signal sprites, generated locally rather than loading a graphic.
    const sprite=document.createElement('canvas');sprite.width=sprite.height=64;
    const ctx=sprite.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
    gradient.addColorStop(0,'#fff');gradient.addColorStop(.22,'#fff');gradient.addColorStop(.45,'#ffffff88');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    pulseMaterial.map=new THREE.CanvasTexture(sprite);pulseMaterial.size=.075;
    root.add(new THREE.Points(pulseGeometry,pulseMaterial));
    const stage=originalHost.dataset.learningModel==='connections'?1:host.dataset.learningModel==='context'?2:0;
    const points=nodes.map(()=>new THREE.Vector3());
    const outlinePositions=new Float32Array(nodes.length*6),outlineGeometry=new THREE.BufferGeometry();
    outlineGeometry.setAttribute('position',new THREE.BufferAttribute(outlinePositions,3).setUsage(THREE.DynamicDrawUsage));
    const outlineMaterial=new THREE.LineBasicMaterial({color:'#d3b575',transparent:true,opacity:0,depthWrite:false});
    root.add(new THREE.LineSegments(outlineGeometry,outlineMaterial));
    const beacon=new THREE.Sprite(new THREE.SpriteMaterial({map:pulseMaterial.map,color:'#e9c875',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    beacon.scale.set(.32,.32,1);root.add(beacon);
    let size=0,connectionDisplay=0,lastDrawTime=performance.now();
    const draw=(timeline,turn=null)=>{
      const phase=timeline-2;
      const pinned=document.querySelector('#learning').classList.contains('is-pinned');
      const visible=smooth((timeline-1.85)/.25);
      host.style.opacity=String(visible);host.style.visibility=visible>0?'visible':'hidden';
      const focus=smooth((phase-.10)/.24);
      host.style.left=innerWidth<=700?'50%':(50-focus*24)+'%';
      if(!visible)return;
      const nextSize=Math.round(host.clientWidth);if(!nextSize)return;
      if(nextSize!==size){size=nextSize;renderer.setSize(size,size,false);}
      const time=turn===null?0:Math.max(0,turn-.35)*60/TAU;
      const collect=smooth((phase+.04)/.72);
      const connectionTarget=clamp((phase-1.65)/.54);
 const now=performance.now(),dt=Math.min(.05,(now-lastDrawTime)/1000);lastDrawTime=now;
 connectionDisplay=connectionTarget<connectionDisplay?connectionTarget:Math.min(connectionTarget,connectionDisplay+dt*.20);
 const connect=connectionDisplay;
      const retain=smooth((phase-2.03)/.75);
      nodes.forEach((node,i)=>{
        const point=points[i];point.copy(node.scatter).lerp(node.base,collect);
        const delay=(node.phase/TAU)*.19;
        const settle=smooth((phase-2.03-delay)/.56);
        if(settle)point.lerp(node.record,settle);
        // Each point carries across the chapter change with its own delayed response.
        let passage=0;
        for(let boundary=1;boundary<=2;boundary++){
          const t=clamp((phase-(boundary-.16)-delay)/.48);
          passage+=Math.sin(t*Math.PI);
        }
        point.x-=passage*(.20+.35*node.phase/TAU);
        point.z+=passage*.28;
        const drift=.035*(1-retain*.7);
        point.x+=Math.sin(time*.23+node.phase)*drift;
        point.y+=Math.cos(time*.19+node.phase)*drift;
        point.z+=Math.sin(time*.17+node.phase)*drift;
        point.toArray(positions,i*3);
        alphas[i]=i<3?1:smooth((collect-(i/nodes.length)*.76)/.24);
      });
      edges.forEach(([a,b],i)=>{
 const at=i*6,start=points[a],end=points[b],growth=smooth(clamp(connect*edges.length-i));
 start.toArray(linePositions,at);
 linePositions[at+3]=start.x+(end.x-start.x)*growth;
 linePositions[at+4]=start.y+(end.y-start.y)*growth;
 linePositions[at+5]=start.z+(end.z-start.z)*growth;
 const alpha=growth>0?.43*(1-retain):0;lineAlpha[i*2]=lineAlpha[i*2+1]=alpha;
 });
      for(let i=0;i<3;i++){
        const clock=time*.12+i*.71;
        const available=Math.max(1,Math.floor(connect*edges.length));
 const edge=edges[(Math.floor(clock)+i*7)%available];
        const fraction=clock%1;
        const a=points[edge[0]],b=points[edge[1]];
        pulsePositions[i*3]=a.x+(b.x-a.x)*fraction;
        pulsePositions[i*3+1]=a.y+(b.y-a.y)*fraction;
        pulsePositions[i*3+2]=a.z+(b.z-a.z)*fraction;
      }
      pulseMaterial.opacity=connect*.65*(1-retain);
      for(let i=0;i<nodes.length;i++){points[i].toArray(outlinePositions,i*6);points[(i+1)%nodes.length].toArray(outlinePositions,i*6+3);}
      outlineGeometry.attributes.position.needsUpdate=true;
      outlineMaterial.opacity=smooth((retain-.25)/.75)*.58;
      const beaconReveal=smooth((retain-.64)/.36);
      beacon.position.copy(points[15]);beacon.material.opacity=beaconReveal*(.65+.15*Math.sin(time*.9));
      beacon.scale.setScalar(.30+beaconReveal*.10);
      root.rotation.set(.12+Math.sin(time*.06)*.025,-.24+Math.sin(time*.045)*.12+retain*.12,-.07*(1-retain));
      geometry.attributes.position.needsUpdate=true;geometry.attributes.alpha.needsUpdate=true;
      lineGeometry.attributes.position.needsUpdate=true;lineGeometry.attributes.alpha.needsUpdate=true;
      pulseGeometry.attributes.position.needsUpdate=true;
      renderer.render(scene,camera);
    };
    host.append(renderer.domElement);host.classList.add('has-art-canvas','has-three-model','has-network-motion');
    draw(0);
    window.drawLearningNetwork=draw;
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();host.classList.remove('has-art-canvas','has-three-model');});
    return {draw};
  }catch(error){renderer?.dispose();console.warn('Learning network unavailable:',error);return {draw(){}};}
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

