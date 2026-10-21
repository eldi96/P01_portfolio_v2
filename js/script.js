(() => {
  'use strict';
  document.documentElement.classList.add('js-ready');
  const reduced=window.portfolioMotion||matchMedia('(prefers-reduced-motion: reduce)');
  const small=matchMedia('(max-width:700px)');
  const short=matchMedia('(max-height:650px)');
  const header=document.querySelector('.site-header');
  const about=document.querySelector('#about');
  const art=document.querySelector('.hero-art');
  const artImage=art.querySelector('img');
  const intro=document.querySelector('.hero-intro');
  const copy=document.querySelector('.perspective-copy');
  const chapters=[...document.querySelectorAll('main>section')];
  const navLinks=[...document.querySelectorAll('.site-header nav a,.chapter-dots a')];
  const projectCards=[...document.querySelectorAll('.project-card')];
  const filmObserver=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('is-film-visible',entry.isIntersecting)),{threshold:.12});
  document.querySelectorAll('.project-single-window').forEach(film=>filmObserver.observe(film));
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
  let frame=0,heroProgress=0,noteOpen=false;
  function render(){
    frame=0;
    const learningPending=renderLearning();
    renderPrinciples();
    const box=about.getBoundingClientRect();
    const totalTravel=Math.max(1,box.height-innerHeight);
    const scrollTravel=Math.max(0,-box.top);
    const progress=clamp(scrollTravel/totalTravel);
    heroProgress=reduced.matches||short.matches?progress:heroProgress+(progress-heroProgress)*.075;
    if(Math.abs(progress-heroProgress)<.0003)heroProgress=progress;
    const p=heroProgress;
    const heroDeparture=smooth((p-.055)/.295);
    if(!reduced.matches&&!short.matches){
      const shape=smooth((p-.12)/.42);
      const from=[[0,0],[100,0],[100,100],[0,100]];
      const to=small.matches?[[12,13],[96,9],[88,48],[4,52]]:[[55,14],[95,23],[88,82],[48,73]];
      art.style.clipPath='polygon('+from.map(([x,y],i)=>(x+(to[i][0]-x)*shape)+'% '+(y+(to[i][1]-y)*shape)+'%').join(',')+')';
      artImage.style.transform='translateY('+(-12*shape)+'px) scale(1.04)';
      const textProgress=heroDeparture;
      intro.style.opacity=noteOpen?'1':textProgress===0?'1':String(1-textProgress);
      intro.style.transform=textProgress===0?'none':'translateY('+(-Math.round(50*textProgress))+'px)';
      intro.style.willChange=textProgress>0&&textProgress<1?'opacity, transform':'auto';
      intro.inert=p>.4||noteOpen;
      intro.setAttribute('aria-hidden',String(p>.4||noteOpen));
      const show=smooth((p-.37)/.35);
      copy.style.opacity=noteOpen?'0':String(show);
      copy.style.transform=small.matches?'translateY('+((1-show)*22)+'px)':'translateY('+(-40+(1-show)*12)+'%)';
      copy.style.pointerEvents=show>.9?'auto':'none';
      copy.inert=show<.9||noteOpen;
      copy.setAttribute('aria-hidden',String(show<.1||noteOpen));
    }else{
      art.style.transform='none';
      artImage.style.filter='none';
      artImage.style.opacity='1';
      intro.inert=false;copy.inert=false;intro.removeAttribute('aria-hidden');copy.removeAttribute('aria-hidden');
    }
    // Hotspots leave before the artwork's frame can clip them or Work enters.
    const hotspotAlpha=1-heroDeparture;
    const shape=smooth((p-.12)/.42);
    const startPositions=small.matches?[[76,22],[82,73]]:[[55,23],[88,71]];
    const endPositions=small.matches?[[78,20],[76,43]]:[[64,30],[84,65]];
    noteTriggers.forEach((button,index)=>{
      button.style.left=(startPositions[index][0]+(endPositions[index][0]-startPositions[index][0])*shape)+'%';
      button.style.top=(startPositions[index][1]+(endPositions[index][1]-startPositions[index][1])*shape)+'%';
      button.style.right='auto';button.style.bottom='auto';
      button.style.opacity=String(hotspotAlpha);
      button.style.visibility=hotspotAlpha===0?'hidden':'visible';
      button.style.pointerEvents=hotspotAlpha>.15?'auto':'none';
      button.inert=hotspotAlpha<=.15;button.setAttribute('aria-hidden',String(hotspotAlpha<=.15));
    });
    if(hotspotAlpha<=.15&&noteOpen)closeNote({restoreFocus:false});
    document.querySelector('.hero-phase').textContent=p>.5?'A SHIFT IN PERSPECTIVE':'A LITTLE ABOUT ME';
    header.classList.toggle('is-scrolled',scrollY>30);
    const max=document.documentElement.scrollHeight-innerHeight;
    document.querySelector('.reading-progress').style.transform='scaleX('+clamp(scrollY/Math.max(1,max))+')';
    let active=chapters[0];
    chapters.forEach(section=>{if(section.getBoundingClientRect().top<innerHeight*.42)active=section;});
    if(scrollY>=max-5)active=chapters.at(-1);
    navLinks.forEach(link=>{if(link.hash==='#'+active.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
    projectCards.forEach((card,index)=>{
      const film=card.querySelector('.project-single-window');
      if(film){
        const entry=reduced.matches?1:smooth((innerHeight*.96-card.getBoundingClientRect().top)/(innerHeight*.8));
        film.style.setProperty('--film-progress',entry.toFixed(4));
      }
      if(small.matches||reduced.matches){card.style.transform='';card.style.filter='';return;}
      // Tall cards must finish scrolling into view before the next card covers them.
      card.style.setProperty('--stack-top',Math.min(108+index*10,innerHeight-card.offsetHeight-24)+'px');
      const next=projectCards[index+1];
      const cover=next?clamp((innerHeight*.75-next.getBoundingClientRect().top)/(innerHeight*.6)):0;
      card.style.transform='scale('+(1-cover*.035)+')';
      card.style.filter='brightness('+(1-cover*.12)+')';
    });
    if(learningPending||(Math.abs(progress-heroProgress)>.0003&&!reduced.matches&&!short.matches))frame=requestAnimationFrame(render);
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(render);};
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);addEventListener('pageshow',schedule);
  [reduced,small,short].forEach(query=>query.addEventListener('change',schedule));
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08});
  document.querySelectorAll('[data-reveal]').forEach(node=>observer.observe(node));
  schedule();

  // The image's two hotspots open one non-modal notebook, with four concise pages.
  const notebook=document.querySelector('#about-note');
  const noteTriggers=[...document.querySelectorAll('[data-about-note]')];
  let noteOrigin=null,noteAnimation,noteTimeline,introMotion,stopPerspectiveMini;
  let noteMotion='closed',noteMotionId=0,restoreNoteFocus=true;
  const motion=window.anime;
  const notePages=[
    {label:'01 / IDENTITY',title:'이해할 때까지, 직접 확인합니다.',html:'<p>궁금한 것을 그냥 넘기기보다, 직접 확인하고 원리를 이해하려 합니다.</p><p>먼저 문제를 작은 단위로 나누고, 직접 만들어 보며 막힌 이유를 찾습니다. 이해한 내용과 판단의 과정은 다음 시도를 위한 기록으로 남깁니다.</p>'},
    {label:'02 / CURRENTLY EXPLORING',title:'지금 배우고, 만들어보는 것들.',html:'<p>정보보안과 AI에 관심을 두고, 웹 개발과 자동화로 직접 구현하며 연결점을 찾고 있습니다.</p><div class="exploring-topics"><span>Security</span><span>AI</span><span>Web Development</span><span>Automation</span></div><p class="note-subtle">현재 학습하고 실습하는 분야입니다. 작은 구현과 검증을 통해 이해를 넓혀갑니다.</p><a class="text-link" href="#learning">학습과 탐구 기록 <span>↗</span></a>'},
    {label:'03 / PRINCIPLES',title:'새로운 문제 앞에서 돌아오는 기준.',html:'<div class="note-principles"><span><i>01</i>계획</span><span><i>02</i>해결</span><span><i>03</i>전달</span></div><p>목표를 실행할 수 있는 단위로 나누고, 직접 시도하며 해결하고, 이해한 것을 다른 사람에게 전달합니다.</p><a class="text-link" href="#principles">이 기준이 만들어진 경험 <span>↗</span></a>'},
    {label:'04 / PERSPECTIVE',title:'보이는 것이 전부는 아닙니다.',html:'<p>같은 문제도 어디에서 바라보느냐에 따라 다르게 보입니다.</p><p>익숙한 답에 멈추지 않고, 다른 위치에서 다시 살펴보려 합니다.</p><div class="perspective-signature"><span class="perspective-record">ELDI / ARCHIVE 01</span><span class="perspective-orbit" aria-hidden="true"><canvas width="280" height="220"></canvas></span></div>'}
  ];
  let noteGroup=0;
  const noteNav=notebook.querySelector('.note-dialog-nav');
  const indicator=Object.assign(document.createElement('i'),{className:'note-choice-indicator'});
  indicator.setAttribute('aria-hidden','true');noteNav.append(indicator);
  function moveNoteIndicator(animate=true){
    const button=noteNav.querySelector('[aria-pressed="true"]');
    const left=button.offsetLeft,width=button.offsetWidth;
    if(animate&&!reduced.matches&&motion)motion.animate(indicator,{left,width,duration:520,ease:'inOut(3)'});
    else{indicator.style.left=left+'px';indicator.style.width=width+'px';}
  }
  function revealNoteContent(delay=0){
    const title=notebook.querySelector('#about-note-title');
    const titleText=title.textContent;
    title.replaceChildren();
    // Each phrase has its own clipping window. The glyphs keep their natural size.
    const breaks={
      '이해할 때까지, 직접 확인합니다.':['이해할 때까지,','직접 확인합니다.'],
      '지금 배우고, 만들어보는 것들.':['지금 배우고,','만들어보는 것들.'],
      '새로운 문제 앞에서 돌아오는 기준.':['새로운 문제 앞에서','돌아오는 기준.'],
      '보이는 것이 전부는 아닙니다.':['보이는 것이','전부는 아닙니다.']
    };
    for(const line of breaks[titleText]||[titleText]){
      const mask=document.createElement('span');mask.className='note-title-mask';
      mask.append(Object.assign(document.createElement('span'),{textContent:line}));title.append(mask);
    }
    const lines=[...title.querySelectorAll('.note-title-mask>span')];
    const body=[...notebook.querySelector('.note-dialog-body').children];
    if(reduced.matches||!motion)return;
    const metadata=[notebook.querySelector('.note-back'),noteNav,notebook.querySelector('.note-dialog-label')];
    const footer=notebook.querySelector('.note-dialog-footer');
    lines.forEach(n=>{n.style.transform='translateY(105%)';});
    [...metadata,...body,footer].forEach(n=>{n.style.opacity='0';});
    noteTimeline=motion.createTimeline({onComplete:()=>{
      lines.forEach(n=>n.style.transform='');[...metadata,...body,footer].forEach(n=>{n.style.opacity='';n.style.transform='';});noteMotion='open';
    }})
      .add(metadata,{opacity:[0,1],translateY:[3,0],delay:motion.stagger(65),duration:420,ease:'out(2)'},Math.max(0,delay-100))
      .add(lines,{translateY:['105%','0%'],translateX:(_,i)=>i?[30,0]:[-18,0],duration:960,delay:motion.stagger(140),ease:motion.cubicBezier(.4,0,.25,1)},delay)
      .add(body,{opacity:[0,1],translateY:[5,0],duration:460,delay:motion.stagger(95),ease:'out(2)'},delay+670)
      .add(footer,{opacity:[0,1],duration:360,ease:'out(2)'},delay+1050);
  }
  function showNotePage(index,animate=true){
    const page=notePages[index];
    notebook.querySelector('.note-dialog-label').textContent=page.label;
    notebook.querySelector('#about-note-title').textContent=page.title;
    stopPerspectiveMini?.();stopPerspectiveMini=null;
    notebook.querySelector('.note-dialog-body').innerHTML=page.html;
    notebook.querySelector('.note-dialog-count').textContent='0'+(index-noteGroup+1)+' / 02';
    notebook.querySelectorAll('[data-note-page]').forEach(button=>{const n=Number(button.dataset.notePage);button.hidden=n<noteGroup||n>noteGroup+1;button.setAttribute('aria-pressed',String(n===index));});
    noteTimeline?.cancel();noteAnimation?.cancel();
    if(index===3)setupPerspectiveMini();
    if(!notebook.hidden){moveNoteIndicator(animate);revealNoteContent(animate?110:0);}
  }
  function setupPerspectiveMini(){
    const figure=notebook.querySelector('.perspective-orbit');
    if(!figure)return;
    const canvas=figure.querySelector('canvas'),ctx=canvas.getContext('2d');
    const rotate=([x,y,z],angle)=>{const side=Math.abs(Math.sin(angle)),t=Math.min(1,side/.35),depth=t*t*(3-2*t);return [x*Math.cos(angle)+z*Math.sin(angle)*depth,y,-x*Math.sin(angle)+z*Math.cos(angle)];};
    let lastAngle=-1;
    function draw(angle){
      if(Math.abs(angle-lastAngle)<.00001)return;lastAngle=angle;
      ctx.clearRect(0,0,280,220);
      const ring=z=>Array.from({length:97},(_,i)=>rotate([Math.cos(i*Math.PI/48),Math.sin(i*Math.PI/48),z],angle));
      const rims=[{points:ring(-1.15),near:-Math.cos(angle)},{points:ring(1.15),near:Math.cos(angle)}].sort((a,b)=>b.near-a.near);
      ctx.lineJoin='round';ctx.lineCap='round';
      ctx.beginPath();
      const isCircle=Math.abs(Math.sin(angle))<.001;
      if(isCircle)ctx.arc(140,110,77,0,Math.PI*2);
      for(const rim of (isCircle?[]:rims)){
        rim.points.forEach(([x,y],i)=>i?ctx.lineTo(140+x*77,110-y*77):ctx.moveTo(140+x*77,110-y*77));
      }
      for(const y of (isCircle?[]:[-1,1])){
        const a=rotate([0,y,-1.15],angle),b=rotate([0,y,1.15],angle);
        ctx.moveTo(140+a[0]*77,110-a[1]*77);ctx.lineTo(140+b[0]*77,110-b[1]*77);
      }
      const circleWeight=Math.pow(Math.abs(Math.cos(angle)),12);
      ctx.strokeStyle='rgba(214,189,137,'+(.42+.43*circleWeight)+')';
      ctx.lineWidth=1.3+2.1*circleWeight;ctx.stroke();
    }
    let frameId=0,lastTime=null,elapsed=-1400;
    const hold=300,travel=2900,segment=hold+travel;
    // Quintic easing reaches both endpoints with zero velocity AND acceleration.
    const easeInOut=t=>t*t*t*(t*(t*6-15)+10);
    draw(reduced.matches?Math.PI/5:0);
    function tick(time){
      if(!canvas.isConnected||notebook.hidden)return;
      if(reduced.matches){draw(Math.PI/5);return;}
      if(lastTime!==null&&!document.hidden)elapsed+=Math.min(50,time-lastTime);
      lastTime=time;
      const current=Math.max(0,elapsed),phase=Math.floor(current/segment)%4,within=current%segment;
      const t=Math.max(0,Math.min(1,(within-hold)/travel));
      const angle=(phase+easeInOut(t))*Math.PI/2;
      figure.dataset.view=t===0?(phase%2?'rectangle':'circle'):'turning';
      draw(angle);frameId=requestAnimationFrame(tick);
    }
    if(!reduced.matches)frameId=requestAnimationFrame(tick);
    stopPerspectiveMini=()=>cancelAnimationFrame(frameId);
  }

  function clearNoteMotion(){
    noteTimeline?.cancel();noteAnimation?.cancel();introMotion?.cancel();
    notebook.style.opacity='';notebook.style.transform='';
    notebook.querySelectorAll('.note-title-mask>span,.note-dialog-body>*,.note-back,.note-dialog-nav,.note-dialog-label,.note-dialog-footer').forEach(n=>{n.style.opacity='';n.style.transform='';});
  }
  function openNote(button){
    if(noteOpen&&noteOrigin===button){closeNote();return;}
    ++noteMotionId;clearNoteMotion();
    noteOrigin=button;noteGroup=Number(button.dataset.aboutNote);restoreNoteFocus=true;
    notebook.hidden=true;showNotePage(noteGroup,false);
    noteOpen=true;noteMotion='opening';notebook.hidden=false;notebook.inert=false;
    noteTriggers.forEach(item=>item.setAttribute('aria-expanded',String(item===button)));
    document.body.classList.add('has-hero-note');
    if(!reduced.matches&&motion){
      introMotion=motion.animate(intro,{clipPath:['inset(0% 0% 0% 0%)','inset(0% 100% 0% 0%)'],duration:420,ease:'inOut(3)'});

    }else intro.style.clipPath='inset(0 100% 0 0)';
    moveNoteIndicator(false);revealNoteContent(540);schedule();
  }
  function closeNote({restoreFocus=true}={}){
    if(!noteOpen||noteMotion==='closing')return;
    const id=++noteMotionId;clearNoteMotion();noteMotion='closing';
    noteTriggers.forEach(item=>item.setAttribute('aria-expanded','false'));
    const finish=()=>{
      if(id!==noteMotionId)return;
      stopPerspectiveMini?.();stopPerspectiveMini=null;
      noteOpen=false;notebook.hidden=true;notebook.inert=false;notebook.style.opacity='';noteMotion='closed';
      document.body.classList.remove('has-hero-note');
      if(reduced.matches||!motion)intro.style.clipPath='';
      else introMotion=motion.animate(intro,{clipPath:['inset(0% 100% 0% 0%)','inset(0% 0% 0% 0%)'],duration:680,ease:motion.cubicBezier(.4,0,.25,1),onComplete:()=>intro.style.clipPath=''});
      if(restoreFocus)noteOrigin?.focus({preventScroll:true});schedule();
    };
    notebook.inert=true;
    if(reduced.matches||!motion){finish();return;}
    noteTimeline=motion.createTimeline({onComplete:finish}).add(notebook,{opacity:[1,0],duration:260,ease:'inOut(2)'},0);
  }
  noteTriggers.forEach(button=>button.addEventListener('click',()=>openNote(button)));
  notebook.querySelector('.note-back').addEventListener('click',()=>closeNote());
  notebook.querySelectorAll('[data-note-page]').forEach(button=>button.addEventListener('click',()=>showNotePage(Number(button.dataset.notePage))));
  notebook.addEventListener('click',event=>{if(event.target.closest('a[href^="#"]'))closeNote({restoreFocus:false});});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&noteOpen){event.preventDefault();closeNote();}});
  addEventListener('resize',()=>{if(noteOpen)moveNoteIndicator(false);});

  // A native, touch-friendly learning shelf. Buttons and arrow keys share its scroll positions.
  const track=document.querySelector('.learning-track');
  const learning=document.querySelector('#learning');
  const learningStage=document.createElement('div');
  learningStage.className='learning-stage';
  learningStage.append(...learning.children);learning.append(learningStage);
  const prev=document.querySelector('.track-prev'),next=document.querySelector('.track-next');
  const learningScenes=[...track.children];
  learningScenes.slice(1).forEach(scene=>{
    const label=scene.querySelector('.learning-backtype');
    const parts=label.textContent.trim().match(/^(\d{2})\s*\/\s*(.+)$/);
    if(!parts)return;
    const number=document.createElement('span'),name=document.createElement('span');
    number.className='learning-backtype-index';number.textContent=parts[1]+' /';
    name.className='learning-backtype-name';name.textContent=parts[2];
    label.replaceChildren(number,name);
  });
  const learningArts=learningScenes.map(()=>null);
  let learningIndex=0,learningMotionPhase=0,learningDisplay=0,lastLearningTime=performance.now();
  let lastLearningTarget=0,fastLearningUntil=0;
  const quickLearningScenes=new Set();
  const sceneNav=document.createElement('nav');
  sceneNav.className='learning-scene-nav';sceneNav.setAttribute('aria-label','학습 장면 바로 보기');
  const sceneButtons=['Intro','01 보안 기록','02 기초와 연결','03 탐구 방향'].map((label,index)=>{
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',()=>goToLearningScene(index));sceneNav.append(button);return button;
  });
  learningStage.append(sceneNav);
  const learningSceneLengths={intro:1.45,model:2,total:7.45};
  const modelRotationTimes=learningScenes.map(()=>0);
  const smokeHost=document.querySelector('.learning-smoke');
  const welcome=document.querySelector('.learning-welcome');
  let smokeArt=null,smokeStart=null;
  // Paused Anime.js timelines are scrubbed by the same scene clock as the meshes.
  const learningText=learningScenes.map(scene=>{
    const heading=scene.querySelector('h3'),lines=[];
    let line=document.createElement('span'),inner=document.createElement('span');
    const appendLine=()=>{line.className='learning-title-mask';inner.className='learning-title-text';line.append(inner);lines.push(line);};
    for(const node of [...heading.childNodes]){
      if(node.nodeName==='BR'){appendLine();line=document.createElement('span');inner=document.createElement('span');}
      else inner.append(node);
    }
    appendLine();heading.replaceChildren(...lines);
    const body=scene.querySelector('.learning-scene-copy,.learning-opening-copy');
    const label=body.querySelector('.eyebrow'),description=body.querySelector('p'),ending=body.querySelector('.text-link,small');
    const detail=body.querySelector('.learning-thread');
    const descriptionLines=[];
    if(!scene.classList.contains('learning-opening')){
      heading.classList.add('learning-scene-heading');scene.append(heading);
      const fragments=description.innerHTML.split(/<br\s*\/?\s*>/i);
      description.replaceChildren(...fragments.map(fragment=>{
        const mask=document.createElement('span'),content=document.createElement('span');
        mask.className='learning-description-mask';content.className='learning-description-line';
        content.textContent=fragment.trim()+' ';mask.append(content);descriptionLines.push(content);return mask;
      }));
    }
    if(!motion)return null;
    [label,descriptionLines.length?null:description,ending,detail].filter(Boolean).forEach(node=>node.style.opacity='0');
    lines.forEach(mask=>{mask.firstElementChild.style.opacity='0';mask.firstElementChild.style.transform='translateY(110%)';});
    const timeline=motion.createTimeline({autoplay:false});
    if(label)timeline.add(label,{opacity:[0,1],translateY:[6,0],duration:450,ease:'out(3)'},0);
    if(!descriptionLines.length)lines.forEach((mask,index)=>timeline.add(mask.firstElementChild,{translateY:['110%','0%'],opacity:[0,1],duration:1000,ease:motion.cubicBezier(.22,1,.36,1)},100+index*110));
    if(descriptionLines.length){
      descriptionLines.forEach((node,index)=>{
        node.style.opacity='0';node.style.transform='translateY(105%)';
        timeline.add(node,{opacity:[0,1],translateY:['105%','0%'],duration:1000,ease:motion.cubicBezier(.22,1,.36,1)},650+index*360);
      });
    }else if(description)timeline.add(description,{opacity:[0,1],translateY:[12,0],duration:620,ease:'out(3)'},600);
    const detailAt=descriptionLines.length?650+(descriptionLines.length-1)*360+850:750;
    if(detail)timeline.add(detail,{opacity:[0,1],translateY:[8,0],duration:650,ease:'out(3)'},detailAt);
    if(ending)timeline.add(ending,{opacity:[0,1],translateY:[7,0],duration:500,ease:'out(3)'},descriptionLines.length?detailAt+350:950);
    timeline.pause();
    return {timeline,heading,body,label,description,descriptionLines,ending,detail,detailAt,lines,duration:timeline.duration};
  });
  const stops=()=>{const max=track.scrollWidth-track.clientWidth;return [...track.children].map(card=>Math.min(max,card.offsetLeft-track.firstElementChild.offsetLeft));};
  function updateTrack(){
    const positions=stops();
    learningIndex=positions.reduce((best,p,i)=>Math.abs(p-track.scrollLeft)<=Math.abs(positions[best]-track.scrollLeft)?i:best,0);
    if(performance.now()<fastLearningUntil&&learningIndex>0)quickLearningScenes.add(learningIndex);
    sceneButtons.forEach((button,index)=>{
      if(index===learningIndex)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
    });
    if(prev)prev.disabled=track.scrollLeft<3;
    if(next)next.disabled=track.scrollLeft>=track.scrollWidth-track.clientWidth-3;
    const count=document.querySelector('.track-count');
    if(count)count.textContent=learningIndex===0?'INTRO / 03':'0'+learningIndex+' / 03';
    const scenePosition=track.scrollLeft/Math.max(1,track.clientWidth);
    learningScenes.forEach((scene,index)=>{
      const offset=index-scenePosition;
      const local=learningMotionPhase-(index+1);
      const pinned=learning.classList.contains('is-pinned');
      const entry=1-smooth((Math.abs(offset)-.06)/.94);
      const quick=quickLearningScenes.has(index);
      const focus=index>0?(pinned&&!reduced.matches&&!quick?smooth((local-.1)/.24):1):0;
      if(index>0)scene.style.setProperty('--reading-focus',focus.toFixed(4));
      const text=learningText[index];
      if(text&&index===0){
        const t=learningMotionPhase;
        const active=pinned&&!reduced.matches;
        const counter=active?Math.min(1,scenePosition)*track.clientWidth:0;
        text.body.style.setProperty('--intro-counter-x',counter+'px');
        text.body.style.opacity='1';text.body.style.setProperty('--copy-exit-y','0px');
        text.lines.forEach((mask,lineIndex)=>{
          const arrive=active?smooth((t-(.62+lineIndex*.4))/.48):1;
          const depart=active?smooth((t-(1.8+lineIndex*.035))/.16):0;
          const node=mask.firstElementChild;
          node.style.opacity=String(arrive*(1-depart));
          node.style.transform='translateY('+((1-arrive)*22-depart*18)+'px)';
          node.style.filter='blur('+((1-arrive)*3+depart*3)+'px)';
          mask.style.clipPath='none';
        });
        scene.style.setProperty('--record-focus',String(active?1-smooth((t-.95)/.3):1));
        scene.style.setProperty('--link-from-focus',String(active?smooth((t-.8)/.3)*(1-smooth((t-1.3)/.3)):1));
        scene.style.setProperty('--link-to-focus',String(active?smooth((t-1.05)/.35):1));
        scene.style.setProperty('--question-focus',String(active?smooth((t-1.3)/.3):1));
        scene.style.setProperty('--opening-backdrop',String(active?smooth((t-.78)/.45):1));
      }else if(text){
        const progress=!pinned||reduced.matches||quick?1:clamp((local-.32)/.32);
        const time=progress*text.duration;
        text.timeline.seek(time);
        if(!text.descriptionLines.length&&time<600){text.description.style.opacity='0';text.description.style.transform='translateY(12px)';}
        text.descriptionLines.forEach((node,i)=>{if(time<650+i*360){node.style.opacity='0';node.style.transform='translateY(105%)';}});
        if(text.ending&&time<text.detailAt+350){text.ending.style.opacity='0';text.ending.style.transform='translateY(7px)';}
        if(text.detail&&time<text.detailAt){text.detail.style.opacity='0';text.detail.style.transform='translateY(8px)';}
        const headingIn=!pinned||reduced.matches||quick?1:smooth((local+.14)/.26);
        text.lines.forEach(line=>{line.firstElementChild.style.opacity=String(headingIn);line.firstElementChild.style.transform='translateY('+((1-headingIn)*105)+'%)';});
        const exit=pinned&&index<learningScenes.length-1?smooth((local-.91)/.09):0;
        text.heading.style.opacity=String(1-exit);
        scene.style.setProperty('--reading-exit',exit.toFixed(4));
        text.body.style.opacity=String(1-exit);
        text.body.style.setProperty('--copy-exit-y',(exit*20)+'px');
      }
      scene.style.setProperty('--scene-presence',String(entry));
      if(index>0)scene.style.setProperty('--backdrop-drift',(clamp(offset,-1,1)*14)+'px');
      const object=scene.querySelector('.learning-object');
      if(object){
        const arrival=index===1&&pinned&&!reduced.matches?smooth((scenePosition-.15)/.85):1;
        object.style.setProperty('--object-arrival',arrival.toFixed(4));
        const phase=reduced.matches?.2:learning.classList.contains('is-pinned')?clamp(learningMotionPhase-(index+1)):.2;
        if(Math.abs(offset)<1.2){
          const autoTurn=!reduced.matches?modelRotationTimes[index]*Math.PI*2/60+.35:null;
          // The shared network is rendered once after all text scenes update.
        }
        object.style.setProperty('--object-opacity',String((.85+.15*entry)*(1-focus*.10)*arrival));
        object.style.setProperty('--object-blur',((1-entry)*.35+(1-arrival)*1.5)+'px');
      }
      if(learning.classList.contains('is-pinned')){scene.inert=Math.abs(offset)>.52;scene.setAttribute('aria-hidden',String(Math.abs(offset)>.52));}
      else{scene.inert=false;scene.removeAttribute('aria-hidden');}
    });
    window.drawLearningNetwork?.(reduced.matches?4.9:learningMotionPhase,reduced.matches?null:modelRotationTimes.reduce((sum,value)=>sum+value,0)*Math.PI*2/60+.35);
    const ratio=track.scrollLeft/Math.max(1,track.scrollWidth-track.clientWidth);
    const progressLine=document.querySelector('.track-progress>span');
    if(progressLine)progressLine.style.transform='translateX('+(ratio*300)+'%)';
  }
  function moveTrack(direction){
    const index=clamp(learningIndex+direction,0,learningScenes.length-1);
    goToLearningScene(index);
  }
  function goToLearningScene(index){
    if(index>0)quickLearningScenes.add(index);
    if(learning.classList.contains('is-pinned')){
      const distance=learning.offsetHeight-learningStage.offsetHeight;
      const top=scrollY+learning.getBoundingClientRect().top-parseFloat(getComputedStyle(learningStage).top);
      scrollTo({top:top+distance*(index===0?0:(learningSceneLengths.intro+(index-1+.5)*learningSceneLengths.model)/learningSceneLengths.total),behavior:'instant'});
    }else track.scrollTo({left:index*track.clientWidth,behavior:reduced.matches?'instant':'smooth'});
  }
  prev?.addEventListener('click',()=>moveTrack(-1));next?.addEventListener('click',()=>moveTrack(1));
  track.addEventListener('scroll',updateTrack,{passive:true});
  track.addEventListener('keydown',event=>{if(event.target!==track)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();moveTrack(event.key==='ArrowRight'?1:-1);}});
  function layoutLearning(){
    const enabled=!reduced.matches&&innerHeight>=620;
    learning.classList.toggle('is-pinned',enabled);
    // Reserve a complete paragraph hold between the reading reveal and departure.
    learning.style.setProperty('--learning-distance',Math.max(innerHeight*8,(track.scrollWidth-track.clientWidth)*1.7)*(learningSceneLengths.total/4.75)+'px');
    const trackOffset=track.getBoundingClientRect().top-learningStage.getBoundingClientRect().top;
    const openingCenter=enabled?innerHeight/2-parseFloat(getComputedStyle(learningStage).top)-trackOffset:track.clientHeight/2;
    track.style.setProperty('--opening-center',openingCenter+'px');
    learningDisplay=clamp((parseFloat(getComputedStyle(learningStage).top)-learning.getBoundingClientRect().top)/Math.max(1,learning.offsetHeight-learningStage.offsetHeight));
    renderLearning();updateTrack();
  }
  function renderLearning(){
    if(!learning.classList.contains('is-pinned'))return false;
    const box=learning.getBoundingClientRect(),distance=learning.offsetHeight-learningStage.offsetHeight;
    const top=parseFloat(getComputedStyle(learningStage).top);
    const target=clamp((top-box.top)/Math.max(1,distance));
    const now=performance.now(),delta=Math.min(48,Math.max(1,now-lastLearningTime));lastLearningTime=now;
    // Match fast document movement instead of playing an old scene after it has left the viewport.
    if(Math.abs(target-lastLearningTarget)*distance/delta>1.4||Math.abs(target-learningDisplay)>.055)fastLearningUntil=now+350;
    lastLearningTarget=target;
    const fast=now<fastLearningUntil;
    const inWelcome=box.top<innerHeight*.35&&box.bottom>0;
    if(inWelcome&&smokeStart===null){
      smokeStart=now;
      if(target<learningSceneLengths.intro/learningSceneLengths.total)learningDisplay=Math.min(learningDisplay,.2/learningSceneLengths.total);
    }
    if(box.top>innerHeight*.9){smokeStart=null;quickLearningScenes.clear();}
    const elapsed=smokeStart===null?0:Math.max(0,now-smokeStart);
    // Let the grains gather fully, then hold the readable title before its exit.
    const introHolding=!fast&&target<learningSceneLengths.intro/learningSceneLengths.total&&inWelcome&&elapsed<2700&&learningDisplay<learningSceneLengths.intro/learningSceneLengths.total;
    const effectiveTarget=introHolding?Math.min(target,.2/learningSceneLengths.total):target;
    if(introHolding)learningDisplay=Math.min(learningDisplay,.2/learningSceneLengths.total);
    if(fast||box.top>innerHeight||box.bottom<0)learningDisplay=target;
    else{
      learningDisplay+=(effectiveTarget-learningDisplay)*(1-Math.exp(-delta/145));
    }
    if(Math.abs(effectiveTarget-learningDisplay)<.00006)learningDisplay=effectiveTarget;
    // All three models receive the same reading and transition distance.
    const scrollUnits=learningDisplay*learningSceneLengths.total;
    const timeline=scrollUnits<learningSceneLengths.intro?scrollUnits/learningSceneLengths.intro*2:2+(scrollUnits-learningSceneLengths.intro)/learningSceneLengths.model;
    learningMotionPhase=timeline;
    let position;
    if(timeline<2)position=smooth((timeline-1.56)/.44);
    else{const step=Math.min(3,Math.floor(timeline)-1);position=step===3?3:step+smooth((timeline-(step+1)-.84)/.16);}
    track.scrollLeft=position*track.clientWidth;
    let modelsAnimating=false;
    if(box.top<innerHeight&&box.bottom>0&&!document.hidden){
      for(let index=1;index<learningScenes.length;index++)if(Math.abs(position-index)<.95){
        const local=timeline-(index+1);
        const speed=1-smooth((local-.1)/.24)*.5;
        modelRotationTimes[index]+=delta/1000*speed;
        if(speed>.001)modelsAnimating=true;
      }
    }
    updateTrack();
    const reveal=smooth((elapsed-100)/1900);
    const dissolve=smooth((timeline-.4)/.65);
    if(smokeArt){welcome.style.opacity='1';welcome.style.filter='none';smokeArt.draw(reveal,dissolve,elapsed/1000);}
    else if(welcome){welcome.style.opacity=String(reveal*(1-dissolve));welcome.style.filter='blur('+((1-reveal)*14+dissolve*18)+'px)';}
    return Math.abs(target-learningDisplay)>.00006||(inWelcome&&elapsed<2700)||modelsAnimating;
  }
  addEventListener('resize',layoutLearning);reduced.addEventListener('change',layoutLearning);layoutLearning();
  document.fonts?.ready.then(()=>{layoutLearning();schedule();});
  function mountLearningModels(){
    if(smokeHost&&window.createLearningSmoke&&!smokeArt)smokeArt=window.createLearningSmoke(smokeHost);
    learningScenes.forEach((scene,index)=>{
      const host=scene.querySelector('[data-learning-art]');
      if(host&&!learningArts[index])learningArts[index]=window.createLearningArt(host);
    });
    updateTrack();schedule();
  }
  if(window.createLearningArt)mountLearningModels();
  else addEventListener('learning-art-ready',mountLearningModels,{once:true});
  // The document scroll advances the three working principles in one stable stage.
  const principles=JSON.parse(document.querySelector('#principle-data').textContent);
  const principleSection=document.querySelector('#principles');
  const principleStage=document.createElement('div');
  principleStage.className='principle-stage';
  principleStage.append(...principleSection.children);principleSection.append(principleStage);
  const detail=document.querySelector('.principle-detail');
  const principleButtons=[...document.querySelectorAll('[data-principle]')];
  let detailAnimation,figureAnimation;
  function selectPrinciple(index){
    if(detail.dataset.step===String(index))return;
    const data=principles[index];
    principleButtons.forEach(item=>item.setAttribute('aria-pressed',String(Number(item.dataset.principle)===index)));
    detail.dataset.step=String(index);
    detail.querySelector('.figure-word').textContent=data.word;
    detail.querySelector('.figure-index').textContent='0'+(index+1)+' / 03';
    const content=detail.querySelector('.principle-detail-copy');
    content.replaceChildren(Object.assign(document.createElement('h3'),{textContent:data.caption}),...data.paragraphs.map(p=>Object.assign(document.createElement('p'),{textContent:p})));
    detailAnimation?.cancel();figureAnimation?.cancel();
    if(!reduced.matches){
      detailAnimation=content.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,easing:'cubic-bezier(.22,1,.36,1)'});
      figureAnimation=detail.querySelector('.principle-figure').animate([{opacity:.35,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)'});
    }
  }
  function renderPrinciples(){
    if(!principleSection.classList.contains('is-pinned'))return;
    const top=parseFloat(getComputedStyle(principleStage).top);
    const progress=clamp((top-principleSection.getBoundingClientRect().top)/Math.max(1,principleSection.offsetHeight-principleStage.offsetHeight));
    selectPrinciple(Math.min(2,Math.floor(progress*3)));
  }
  function layoutPrinciples(){
    principleSection.classList.toggle('is-pinned',!reduced.matches&&innerHeight>=740&&innerWidth>700);
    renderPrinciples();
  }
  principleButtons.forEach(button=>button.addEventListener('click',()=>{
    const index=Number(button.dataset.principle);
    if(principleSection.classList.contains('is-pinned')){
      const top=scrollY+principleSection.getBoundingClientRect().top-parseFloat(getComputedStyle(principleStage).top);
      const distance=principleSection.offsetHeight-principleStage.offsetHeight;
      scrollTo({top:top+distance*(index===0?0:(index+.12)/3),behavior:'smooth'});
    }else selectPrinciple(index);
  }));
  addEventListener('resize',layoutPrinciples);reduced.addEventListener('change',layoutPrinciples);layoutPrinciples();
  // One restrained tactile response at the end, with no custom cursor or scroll capture.
  const orb=document.querySelector('.contact-orb');
  orb.addEventListener('pointermove',event=>{if(reduced.matches||event.pointerType!=='mouse')return;const box=orb.getBoundingClientRect();orb.style.transform='translate('+((event.clientX-box.left-box.width/2)*.15)+'px,'+((event.clientY-box.top-box.height/2)*.15)+'px)';});
  orb.addEventListener('pointerleave',()=>{orb.style.transform='';});
  document.querySelector('.copy-button').addEventListener('click',async()=>{
    const status=document.querySelector('#copy-status');
    try{await navigator.clipboard.writeText('eldi96@naver.com');status.textContent='이메일 주소를 복사했습니다.';}catch{status.textContent='eldi96@naver.com을 선택해 복사해 주세요.';}
  });
})();


























