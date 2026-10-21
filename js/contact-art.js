import * as THREE from './vendor/three.module.min.js';

const section=document.querySelector('#contact');
const host=section?.querySelector('.contact-landscape');
const glass=section?.querySelector('.contact-glass');
let confirmationTimer;
addEventListener('contact-copy-success',()=>{
  if(!glass)return;
  clearTimeout(confirmationTimer);glass.classList.add('is-copied');
  confirmationTimer=setTimeout(()=>glass.classList.remove('is-copied'),1500);
});

// Render the landscape and glass together so the refraction samples the exact
// background position. Text and controls remain accessible HTML above the canvas.
if(host&&glass){
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'low-power'});}catch{}
  if(renderer){
    host.append(canvas);
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    const uniforms={image:{value:null},size:{value:new THREE.Vector2(1,1)},imageSize:{value:new THREE.Vector2(1672,940)},panel:{value:new THREE.Vector4()},radius:{value:24},pointer:{value:new THREE.Vector2(.35,.25)}};
    const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`precision highp float;
      varying vec2 vUv;uniform sampler2D image;uniform vec2 size,imageSize,pointer;uniform vec4 panel;uniform float radius;
      float rounded(vec2 p,vec2 halfSize,float r){vec2 q=abs(p)-halfSize+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
      vec3 landscape(vec2 px){
        float scale=max(size.x/imageSize.x,size.y/imageSize.y);
        vec2 extent=imageSize*scale;
        vec2 uv=(px+(extent-size)*vec2(.5,.48))/extent;
        vec3 c=texture2D(image,vec2(uv.x,1.-uv.y)).rgb;
        float y=px.y/size.y;
        float fade=smoothstep(.02,.23,y)*(1.-smoothstep(.76,1.,y));
        return mix(vec3(.0549,.051,.0627),c,.88*fade);
      }
      void main(){
        vec2 px=vec2(vUv.x,1.-vUv.y)*size;
        vec2 center=panel.xy+panel.zw*.5,p=px-center;
        float d=rounded(p,panel.zw*.5,radius);
        vec2 grad=normalize(vec2(rounded(p+vec2(.5,0.),panel.zw*.5,radius)-rounded(p-vec2(.5,0.),panel.zw*.5,radius),rounded(p+vec2(0.,.5),panel.zw*.5,radius)-rounded(p-vec2(0.,.5),panel.zw*.5,radius))+vec2(.00001));
        vec3 bg=landscape(px);
        float shadow=exp(-max(d,0.)/17.)*smoothstep(-1.,3.,d)*.24;
        bg*=1.-shadow;
        float inside=1.-smoothstep(-.7,.7,d);
        // Rounded bevel bends the image only near the perimeter; the center is flat.
        float bevel=exp(-abs(d)/9.);
        vec2 refracted=px-grad*bevel*9.;
        float blur=mix(7.,1.4,bevel);
        vec3 transmitted=landscape(refracted)*.20;
        for(int i=0;i<12;i++){
          float a=float(i)*2.399963;
          float r=sqrt((float(i)+.5)/12.)*blur;
          transmitted+=landscape(refracted+vec2(cos(a),sin(a))*r)*(.8/12.);
        }
        vec3 surface=transmitted*.72+vec3(.013,.013,.014);
        vec2 local=(px-panel.xy)/panel.zw;
        float reflection=exp(-dot((local-pointer)*vec2(1.25,1.8),(local-pointer)*vec2(1.25,1.8))*6.);
        surface+=vec3(.025,.024,.021)*reflection;
        // A narrow outer reflection and a separate inner dark lip give glass thickness.
        float light=.23+.77*pow(max(dot(grad,normalize(vec2(-.65,-.8))),0.),2.);
        float outer=exp(-pow((d+1.)/.7,2.));
        float inner=exp(-pow((d+3.)/1.0,2.));
        surface*=1.-inner*.23;
        surface+=outer*light*vec3(.43,.42,.38);
        surface+=exp(-pow((d+4.7)/.65,2.))*.024;
        gl_FragColor=vec4(mix(bg,surface,inside),1.);
      }`
    });
    const scene=new THREE.Scene(),camera=new THREE.Camera();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
    let ready=false,active=false,frame=0,last=0;
    const target=new THREE.Vector2(.35,.25),system=matchMedia('(prefers-reduced-motion: reduce)');
    const reduced=()=>window.portfolioMotion?.matches??system.matches;
    function draw(now){
      frame=0;if(!ready||!active||document.hidden)return;
      const r=host.getBoundingClientRect(),g=glass.getBoundingClientRect();
      if(!r.width||!r.height)return;
      if(uniforms.size.value.x!==r.width||uniforms.size.value.y!==r.height){renderer.setSize(r.width,r.height,false);uniforms.size.value.set(r.width,r.height);}
      uniforms.panel.value.set(g.left-r.left,g.top-r.top,g.width,g.height);
      uniforms.radius.value=parseFloat(getComputedStyle(glass).borderRadius)||24;
      const dt=Math.min((now-last)/1000,.05);last=now;
      if(reduced())uniforms.pointer.value.set(.35,.25);
      else uniforms.pointer.value.lerp(target,1-Math.exp(-dt*3));
      renderer.render(scene,camera);section.classList.add('glass-render-ready');
      if(!reduced()&&uniforms.pointer.value.distanceTo(target)>.001)frame=requestAnimationFrame(draw);
    }
    function schedule(){if(!frame&&active&&ready){last=performance.now();frame=requestAnimationFrame(draw);}}
    new THREE.TextureLoader().load(new URL('../assets/contact-charcoal-gold-v5.png',import.meta.url).href,texture=>{
      uniforms.image.value=texture;uniforms.imageSize.value.set(texture.image.width,texture.image.height);ready=true;schedule();
    },undefined,()=>{renderer.dispose();canvas.remove();});
    new ResizeObserver(schedule).observe(section);new ResizeObserver(schedule).observe(glass);
    new IntersectionObserver(([entry])=>{active=entry.isIntersecting;if(active)schedule();else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:'120px'}).observe(section);
    section.addEventListener('pointermove',event=>{if(reduced()||event.pointerType==='touch')return;const r=glass.getBoundingClientRect();target.set(.3+((event.clientX-r.left)/r.width-.5)*.16,.2+((event.clientY-r.top)/r.height-.5)*.12);schedule();});
    section.addEventListener('pointerleave',()=>{target.set(.35,.25);schedule();});
    // Update during the existing section reveal, without a continuous idle render loop.
    addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
    document.addEventListener('visibilitychange',schedule);document.fonts.ready.then(schedule);
    system.addEventListener('change',schedule);window.portfolioMotion?.addEventListener('change',schedule);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;cancelAnimationFrame(frame);section.classList.remove('glass-render-ready');});
    canvas.addEventListener('webglcontextrestored',()=>{ready=true;schedule();});
  }
}
