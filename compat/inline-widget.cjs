// Self-contained main-world UI. Shadow DOM isolates styling from the host app.
module.exports = function installAgPulseInlineWidget() {
  if (window.__agPulseInlineInstalled) return;
  const report=(stage,details={})=>window.agPulseHost?.report?.({stage,...details});
  if (!document.documentElement) {
    document.addEventListener('DOMContentLoaded',installAgPulseInlineWidget,{once:true});
    return;
  }
  if (!window.agPulseHost) return;
  const localGet=key=>{try{return localStorage.getItem(key);}catch{return null;}};
  const localSet=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const language=window.__agPulseI18nFactory(localGet('ag-pulse-language'));
  const theme=window.__agPulseThemeFactory();
  const t=language.t;
  window.__agPulseInlineInstalled=true;
  report('boot',{hostFound:true});
  const ID='ag-pulse-status-bar',PANE_BOUNDARY='aside,[role="tabpanel"],[data-aux-pane-open],[data-pane-id]';
  // Host-specific discovery stays outside the shared widget. The IDE has no
  // /c/<id> URL, and must never inherit the desktop's conversation fallback.
  const surface=window.__agPulseSurface;
  const setMarkup=(element,markup)=>{if(surface?.setMarkup)surface.setMarkup(element,markup);else element.innerHTML=markup;};
  const instances=[];
  let layoutFrame=null,disposed=false;
  const HOVER_DELAY=250,WARM_WINDOW=350,LEAVE_DELAY=120,QUOTA_HOVER_COOLDOWN=4000;
  const densityMedia=matchMedia('(prefers-reduced-motion: reduce)');
  const densityEase='cubic-bezier(0.32,0.72,0,1)';
  const densitySpringEase='cubic-bezier(0.26,1.52,0.5,1)';
  const isPulseBar=e=>Boolean(e?.hasAttribute?.('data-ag-pulse-bar')||String(e?.id||'').startsWith(ID)||e?.closest?.('[data-ag-pulse-bar],[id^="'+ID+'"]'));
  const isOwnNode=target=>Boolean(target instanceof Node&&instances.some(inst=>(inst.node&&(target===inst.node||inst.node.contains(target)))||inst.ownsNode?.(target)));
  let guideReady=false,guideDismissed=false,guideOpened=false,guideSaving=false,guideError=false,usageGuideDismissed=false;
  const speedStyle=language.connectSpeedStyle({
    initial:localGet('ag-pulse-speed-style'),cache:value=>localSet('ag-pulse-speed-style',value),
    write:input=>window.agPulseHost.setPreferences(input),changed:()=>{for(const inst of instances)inst.onSpeedStyleChanged();},
  });
  const usageScope=language.connectUsageScope({
    initial:localGet('ag-pulse-usage-scope'),cache:value=>localSet('ag-pulse-usage-scope',value),
    write:input=>window.agPulseHost.setPreferences(input),changed:()=>{for(const inst of instances)inst.onUsageScopeChanged();},
  });
  const neonMascotPref=language.connectNeonMascot({
    initial:localGet('ag-pulse-neon-mascot'),cache:value=>localSet('ag-pulse-neon-mascot',value),
    write:input=>window.agPulseHost.setPreferences(input),changed:()=>{for(const inst of instances)inst.onNeonMascotChanged();},
  });
  const contextLimitPref=language.connectContextLimit({
    initial:localGet('ag-pulse-context-limit'),cache:value=>localSet('ag-pulse-context-limit',value),
    write:input=>window.agPulseHost.setPreferences(input),changed:()=>{for(const inst of instances)inst.onContextLimitChanged();},
  });
  function syncGuide(value){speedStyle.sync(value);usageScope.sync(value);neonMascotPref.sync(value);contextLimitPref.sync(value);if(value?.languageGuideDismissed===true)guideDismissed=true;if(value?.usageGuideDismissed===true){usageGuideDismissed=true;for(const inst of instances)inst.syncUsageGuide();}}
  const preferences=language.connectPreferences({
    read:async()=>{const value=await window.agPulseHost.getPreferences();syncGuide(value);return value;},
    write:async input=>{const value=await window.agPulseHost.setPreferences(input);syncGuide(value);return value;},
    cache:value=>localSet('ag-pulse-language',value),changed:()=>{for(const inst of instances)inst.onLocaleChanged();},
  });
  void preferences.ready.then(()=>{if(disposed)return;guideReady=!preferences.error;scheduleLayout();});
  const icon=(name)=>({cache:'<ellipse cx="8" cy="4" rx="5" ry="2"/><path d="M3 4v8c0 2 10 2 10 0V4M3 8c0 2 10 2 10 0"/>',five:'<circle cx="8" cy="8" r="5.6"/><path d="M8 4.7v3.6l2.3 1.4"/>',week:'<rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M5 2v3m6-3v3M3 7h10"/>'}[name]);
  const svg=name=>`<svg viewBox="0 0 16 16" aria-hidden="true">${name==='context'?'<circle cx="8" cy="8" r="5.6"/><path d="M8 2.4V8l4.8 2.8"/>':icon(name)}</svg>`;
  const SVG_NS='http://www.w3.org/2000/svg';
  const svgEl=(tag,attrs={},children=[])=>{
    const el=document.createElementNS(SVG_NS,tag);
    for(const [k,v]of Object.entries(attrs))if(v!==null&&v!==undefined)el.setAttribute(k,String(v));
    for(const child of children)if(child)el.append(child);
    return el;
  };
  const CAT_SCALE=30/34,CAT_GROUND=18;
  const CAT_EYE=['hk','kk','kk'],CAT_BLINK=['kk'],CAT_SLEEP_EYE=['kkk'],CAT_NOSE=['ii'],CAT_BLUSH=['ii'];
  const CAT_STAMP_INK={k:'eye',h:'hl',i:'pink'};
  const CAT_IDLE_POSES=['upright','blink','tilting','tilted','tiltedBlink'];
  const CAT_SPARKLE=[[0,-1],[-1,0],[1,0],[0,1]];
  const CAT_BADGE=['.o........o.','o#o......o#o','oi#oooooo#io','o##########o','o##########o','o#####ii###o','o###wwww###o','.o########o.','..oooooooo..'];
  const CAT_BADGE_INK={o:'outline','#':'body',i:'pink',w:'light'};
  let cachedCatFrames=null;
  function getCatFrames(){
    if(cachedCatFrames)return cachedCatFrames;
    const E=(cx,cy,rx,ry,c,opts={})=>({t:'e',cx,cy,rx,ry,c,rot:0,...opts});
    const P=(pts,c)=>({t:'p',pts,c});
    const L=(a,b,w,c,opts={})=>({t:'l',a,b,w,c,...opts});
    const B=(a,b,over=false)=>({t:'b',a,b,c:'whisker',over});
    const S=(x,y,rows)=>({t:'s',x,y,rows});
    const bezier=(p0,p1,p2,p3,u1)=>{const u=1-u1,at=k=>u*u*u*p0[k]+3*u*u*u1*p1[k]+3*u*u1*u1*p2[k]+u1*u1*u1*p3[k];return [at(0),at(1)];};
    const tail=(p0,p1,p2,p3,w,c,n=18)=>Array.from({length:n},(_,i)=>L(bezier(p0,p1,p2,p3,i/n),bezier(p0,p1,p2,p3,(i+1)/n),w*(1-(0.3*i)/n),i/n>0.74?'tip':c));
    const shrink=(pts,f,dy)=>{const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;return pts.map(([x,y])=>[cx+(x-cx)*f,cy+(y-cy)*f+dy]);};
    const xform=(items,move,angle=0)=>items.map(it=>{
      if(it.t==='e'){const [cx,cy]=move([it.cx,it.cy]);return {...it,cx,cy,rot:it.rot+angle};}
      if(it.t==='p')return {...it,pts:it.pts.map(move)};
      if(it.t==='s'){const [x,y]=move([it.x,it.y]);return {...it,x,y};}
      return {...it,a:move(it.a),b:move(it.b)};
    });
    const translate=(items,dx)=>xform(items,([x,y])=>[x+dx,y]);
    const rotate=(items,angle,[px,py])=>{if(!angle)return items;const c=Math.cos(angle),s=Math.sin(angle);return xform(items,([x,y])=>[px+(x-px)*c-(y-py)*s,py+(x-px)*s+(y-py)*c],angle);};
    const face=(hy,eyes)=>{
      const earL=[[-8.8,hy-1.3],[-3.2,hy-5.4],[-8.4,hy-10.8]],earR=earL.map(([x,y])=>[-x,y]);
      const eye=eyes==='open'?CAT_EYE:eyes==='sleep'?CAT_SLEEP_EYE:CAT_BLINK;
      return {
        shapes:[P(earL,'body'),P(earR,'body'),P(shrink(earL,0.5,0.5),'pink'),P(shrink(earR,0.5,0.5),'pink'),E(0,hy,9.2,7.2,'body'),E(0,hy+3.8,4.3,2.8,'light',{over:true})],
        overlays:[S(-3.7,hy+0.6,eye),S(3.7,hy+0.6,eye),S(0,hy+2.9,CAT_NOSE),S(-6.2,hy+3.3,CAT_BLUSH),S(6.2,hy+3.3,CAT_BLUSH),B([-9.4,hy+3.2],[-13.4,hy+2.2]),B([-9.4,hy+4.4],[-13.4,hy+5.2]),B([9.4,hy+3.2],[13.4,hy+2.2]),B([9.4,hy+4.4],[13.4,hy+5.2])],
      };
    };
    const sitting=(tilt,eyes)=>{
      const head=face(-3.4,eyes);
      return {box:[-15,-16,16,18],shapes:[...tail([5,16.4],[12.5,17],[13.8,8],[10.6,3.4],2.7,'body'),E(-5.9,14.6,4.4,3.5,'body'),E(5.9,14.6,4.4,3.5,'body'),E(0,10.4,7.3,7.6,'body'),E(5.6,12.4,1.7,4.4,'shade',{over:true}),E(0,9.6,4,5.6,'light',{over:true}),E(-2.6,16.8,2.1,1.3,'light'),E(2.6,16.8,2.1,1.3,'light'),...rotate(head.shapes,tilt,[0,4])],overlays:rotate(head.overlays,tilt,[0,4])};
    };
    const sleeping=(breath,k)=>{
      const head=face(5.8-breath/k,'sleep');
      return {box:[-18,-16,17,18],shapes:[E(9.6,13.4,4.8,4.6+breath*0.3,'body'),E(2.5,13.2,10.5,5+breath*0.4,'body'),E(11.4,14,2,3.2,'shade',{over:true}),...tail([13,16.4],[14,18.6],[3,18.8],[-7,17.4],2.4,'shade'),...translate(head.shapes,-3.5)],overlays:translate(head.overlays,-3.5)};
    };
    const footPos=(phase,beta,stride,lift)=>{const p=((phase%1)+1)%1;if(p<beta)return [stride/2-(p/beta)*stride,0];const u=(p-beta)/(1-beta);return [-stride/2+u*stride,-lift*Math.sin(Math.PI*u)];};
    const side=(phase,run,k)=>{
      const tau=Math.PI*2,q=v=>Math.round(v*k)/k,flex=run?Math.cos(tau*phase):0;
      const hipX=q(-6-0.6*flex),shX=q(5+0.6*flex),air=run?Math.max(0,Math.sin(tau*(phase-0.05))):0;
      const bob=run?0:Math.cos(2*tau*phase)<-0.3?1/k:0,by=q((run?8.4:7)-air)+bob;
      const pitch=run?Math.sin(tau*phase):0,arch=run?Math.max(0,-flex):0,hipY=q(by+1.3*pitch),shY=q(by-1.3*pitch);
      const legs=run?[[false,false,0],[true,false,0.5],[false,true,0.1],[true,true,0.6]]:[[false,false,0],[true,false,0.25],[false,true,0.5],[true,true,0.75]];
      const beta=run?0.38:0.62,stride=run?10:6;
      const legShapes=([front,near,off])=>{
        const [fx,fy]=footPos(phase+off,beta,stride,run?3.4:front?3.6:1.8),x=front?shX:hipX;
        const joint=[x,(front?shY:hipY)+2],foot=[x+fx,17.3+fy];
        const bend=Math.max(0,17.3-joint[1]-Math.hypot(foot[0]-joint[0],foot[1]-joint[1]))*0.9+0.3;
        const knee=[(joint[0]+foot[0])/2+(front?bend:-bend),(joint[1]+foot[1])/2],c=near?'body':'shade';
        return [L(joint,knee,2.7,c),L(knee,foot,2.3,c,{edge:near}),E(foot[0]+0.4,foot[1],1.5,0.9,near?'light':'shade',{edge:near})];
      };
      const mid=(hipX+shX)/2,half=(shX-hipX)/2,backY=q((hipY+shY)/2-1.6*arch),sw=Math.sin(tau*phase),base=[hipX-3.2,hipY-1.2];
      const tailShapes=run?tail(base,[hipX-8,hipY-1.5],[hipX-12,hipY-3+sw],[hipX-15.5,hipY-5.5+sw],2.5,'body'):tail(base,[hipX-7.5,by-3],[hipX-8.5+sw*1.2,by-12],[hipX-4.8+sw*1.2,by-14],2.5,'body');
      const hx=q(shX+4.8+(run?1:0)),hy=q(shY-6.6+(run?1.8:0)),back=run?[-1.6,1.4]:[0,0];
      const earB=[[hx-5.6,hy-1.8],[hx-1.6,hy-4.6],[hx-4.8+back[0],hy-9.8+back[1]]],earF=[[hx+0.6,hy-4.8],[hx+5.2,hy-2.2],[hx+3.4+back[0],hy-9.6+back[1]]];
      return {
        box:[-26,-12,22,18],
        shapes:[...legs.filter(l=>!l[1]).flatMap(legShapes),...tailShapes,E(hipX-0.5,hipY+0.4,4,4,'body'),E(mid,backY,half+3.4-arch,3.9+0.6*arch,'body'),E(shX+0.8,shY+0.2,4,4.3,'body'),E(mid+1,backY+3+0.6*arch,half,1.3,'light',{over:true}),E(shX+2.6,shY+1.4,2.2,3,'light',{over:true}),...legs.filter(l=>l[1]).flatMap(legShapes),P(earB,'body'),P(earF,'body'),P(shrink(earB,0.5,0.5),'pink'),P(shrink(earF,0.5,0.5),'pink'),E(hx,hy,6.2,5.3,'body'),E(hx+1.7,hy+2.2,3.1,2,'light',{over:true})],
        overlays:[S(hx-1.2,hy-0.4,CAT_EYE),S(hx+3.3,hy-0.4,CAT_EYE),S(hx+2,hy+1.8,CAT_NOSE),S(hx-3.7,hy+1.8,CAT_BLUSH),B([hx+5.8,hy+1.6],[hx+10,hy+0.8]),B([hx+5.8,hy+2.6],[hx+10,hy+3.4]),...(run?[B([hx-6.8,hy-0.4],[hx-9.8,hy-1.8],true),B([hx-6.8,hy+0.6],[hx-10,hy-0.2],true)]:[B([hx-5.8,hy+1.6],[hx-9.6,hy+0.8]),B([hx-5.8,hy+2.6],[hx-9.6,hy+3.4])])],
      };
    };
    const hit=(s,x,y)=>{
      if(s.t==='e'){let dx=x-s.cx,dy=y-s.cy;if(s.rot){const c=Math.cos(-s.rot),n=Math.sin(-s.rot);[dx,dy]=[dx*c-dy*n,dx*n+dy*c];}return (dx/s.rx)**2+(dy/s.ry)**2<=1;}
      if(s.t==='p'){let inside=false;for(let i=0,j=s.pts.length-1;i<s.pts.length;j=i++){const [xi,yi]=s.pts[i],[xj,yj]=s.pts[j];if((yi>y)!==(yj>y)&&x<((xj-xi)*(y-yi))/(yj-yi)+xi)inside=!inside;}return inside;}
      const [ax,ay]=s.a,[bx,by]=s.b,vx=bx-ax,vy=by-ay,u=Math.max(0,Math.min(1,((x-ax)*vx+(y-ay)*vy)/(vx*vx+vy*vy||1)));
      return Math.hypot(x-ax-u*vx,y-ay-u*vy)<=s.w/2;
    };
    const raster=(scene,k)=>{
      const [x0,y0,x1,y1]=scene.box,i0=Math.floor(x0*k),j0=Math.floor(y0*k),w=Math.ceil(x1*k)-i0,h=Math.ceil(y1*k)-j0;
      const cells=new Array(w*h).fill(null),edges=new Array(w*h).fill(false);
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        const x=(i0+i+0.5)/k,y=(j0+j+0.5)/k;let c=null,edge=false;
        for(const s of scene.shapes)if((!s.over||c)&&hit(s,x,y)){c=s.c;edge=!!s.edge;}
        cells[j*w+i]=c;edges[j*w+i]=edge;
      }
      const out=cells.slice();
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(!edges[j*w+i])continue;for(const n of [i-1,i+1])if(n>=0&&n<w&&cells[j*w+n]&&!edges[j*w+n])out[j*w+n]='outline';}
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(cells[j*w+i])continue;if([[1,0],[-1,0],[0,1],[0,-1]].some(([di,dj])=>{const ni=i+di,nj=j+dj;return ni>=0&&nj>=0&&ni<w&&nj<h&&cells[nj*w+ni];}))out[j*w+i]='outline';}
      const put=(ci,cj,c,onlyEmpty)=>{const i=ci-i0,j=cj-j0;if(i<0||j<0||i>=w||j>=h||(onlyEmpty&&cells[j*w+i]))return;out[j*w+i]=c;};
      for(const o of scene.overlays){
        if(o.t==='s'){const left=Math.round(o.x*k-o.rows[0].length/2),top=Math.round(o.y*k-o.rows.length/2);o.rows.forEach((row,r)=>[...row].forEach((ch,c)=>{if(ch!=='.')put(left+c,top+r,CAT_STAMP_INK[ch],false);}));continue;}
        let ax=Math.floor(o.a[0]*k),ay=Math.floor(o.a[1]*k);const bx=Math.floor(o.b[0]*k),by=Math.floor(o.b[1]*k);
        const dx=Math.abs(bx-ax),dy=-Math.abs(by-ay),sx=ax<bx?1:-1,sy=ay<by?1:-1;let err=dx+dy;
        for(;;){put(ax,ay,o.c,!o.over);if(ax===bx&&ay===by)break;const e2=2*err;if(e2>=dy){err+=dy;ax+=sx;}if(e2<=dx){err+=dx;ay+=sy;}}
      }
      return {i0,j0,w,h,cells:out};
    };
    const k=CAT_SCALE;
    cachedCatFrames={
      walk:Array.from({length:8},(_,i)=>raster(side(i/8,false,k),k)),
      gallop:Array.from({length:6},(_,i)=>raster(side(i/6,true,k),k)),
      idle:{upright:raster(sitting(0,'open'),k),blink:raster(sitting(0,'blink'),k),tilting:raster(sitting(-0.16,'open'),k),tilted:raster(sitting(-0.3,'open'),k),tiltedBlink:raster(sitting(-0.3,'blink'),k)},
      sleep:[raster(sleeping(0,k),k),raster(sleeping(1,k),k)],
    };
    return cachedCatFrames;
  }
  function catPathNodes(frame,x,y){
    const ground=Math.round(CAT_GROUND*CAT_SCALE),paths=new Map();
    for(let j=0;j<frame.h;j++)for(let i=0;i<frame.w;){
      const ink=frame.cells[j*frame.w+i];if(!ink){i++;continue;}
      let n=1;while(i+n<frame.w&&frame.cells[j*frame.w+i+n]===ink)n++;
      paths.set(ink,`${paths.get(ink)||''}M${x+frame.i0+i} ${y+frame.j0+j-ground}h${n}v1h${-n}z`);i+=n;
    }
    return [...paths].map(([ink,d])=>svgEl('path',{class:`dashboard-cat-${ink}`,d}));
  }
  function updateCatBadge(svgNode,mood){
    if(!svgNode||svgNode._renderKey===mood)return;
    svgNode._renderKey=mood;
    if(!svgNode._catRoot){
      const cells=CAT_BADGE.flatMap((row,y)=>[...row].flatMap((ink,x)=>ink==='.'?[]:[{x:x+2,y:y+1,ink}]));
      const groups=Object.entries(CAT_BADGE_INK).map(([ink,name])=>svgEl('g',{class:`dashboard-cat-${name}`},cells.filter(c=>c.ink===ink).map(c=>svgEl('rect',{x:c.x,y:c.y,width:1,height:1}))));
      const eyes=svgEl('g',{class:'dashboard-cat-eye dashboard-cat-badge-eyes'},[svgEl('rect',{x:5,y:5,width:1,height:2}),svgEl('rect',{x:10,y:5,width:1,height:2})]);
      const g=svgEl('g',{class:`dashboard-cat cat-mood-${mood}`},[...groups,eyes]);
      svgNode._catRoot=g;svgNode.replaceChildren(g);return;
    }
    svgNode._catRoot.setAttribute('class',`dashboard-cat cat-mood-${mood}`);
  }
  function updateSpeedTrail(svgNode,samples,mood,stride){
    if(!svgNode)return;
    const strideCss=`${stride.toFixed(2)}s`,key=`${mood}|${strideCss}|${samples.join(',')}`;
    if(svgNode._renderKey===key)return;
    svgNode._renderKey=key;
    svgNode.style.setProperty('--clawd-stride',strideCss);
    const W=140,H=54,TOP=22,END=W-18,snap=v=>Math.round(v/2)*2;
    let line='',start=0,peakY=null,endX=END-4,endY=H-2;
    if(samples.length){
      const max=Math.max(...samples)*1.04,min=Math.min(...samples)*0.82,slots=Math.max(samples.length,12),last=samples.length-1;
      const x=idx=>snap(END-((last-idx)*END)/(slots-1)),y=val=>snap(TOP+(H-TOP-3)*(1-(val-min)/(max-min||1)));
      start=Math.max(0,snap(x(0)-END/(slots-1)));
      line=`M${start} ${y(samples[0])}`;
      samples.forEach((v,idx)=>{if(idx)line+=`H${x(idx)}V${y(v)}`;});
      endY=y(samples[last]);line+=`H${W-4}`;
      if(samples.length>1)peakY=y(Math.max(...samples));
    }
    const defs=svgEl('defs',{},[svgEl('linearGradient',{id:'ag-pulse-prism',x1:0,x2:1,y1:0,y2:0},[
      svgEl('stop',{offset:'0',class:'speed-stop-start'}),svgEl('stop',{offset:'0.55',class:'speed-stop-mid'}),
      svgEl('stop',{offset:'1',class:'speed-stop-end'}),
    ])]);
    const catY=endY-1,frames=getCatFrames(),catChildren=[];
    if(mood==='dash'){
      catChildren.push(svgEl('g',{class:'dashboard-clawd-streaks'},[catY-15,catY-11,catY-7].map((sy,idx)=>{
        const ln=svgEl('line',{x1:endX-22,x2:endX-(22+[10,14,8][idx]),y1:sy,y2:sy});
        ln.style.animationDelay=`${-idx*0.15}s`;return ln;
      })));
    }
    if(mood==='sleep'){
      for(const idx of [0,1]){
        const sp=svgEl('g',{class:`dashboard-cat-sparkle cat-tone-${idx?'pink':'cyan'}`},[
          ...CAT_SPARKLE.map(([dx,dy])=>svgEl('rect',{x:endX+7+dx,y:catY-20+dy,width:1,height:1})),
          svgEl('rect',{class:'dashboard-cat-sparkle-core',x:endX+7,y:catY-20,width:1,height:1}),
        ]);
        sp.style.animationDelay=`${-idx*1.3}s`;catChildren.push(sp);
      }
    }
    if(mood==='idle'){
      for(const pose of CAT_IDLE_POSES)catChildren.push(svgEl('g',{class:`dashboard-cat-frame cat-pose-${pose}`},catPathNodes(frames.idle[pose],endX,catY)));
    }else{
      const gait=mood==='sleep'?frames.sleep:mood==='dash'?frames.gallop:frames.walk;
      gait.forEach((f,idx)=>{
        const g=svgEl('g',{class:`dashboard-cat-frame${idx===0?' cat-first':''}`},catPathNodes(f,endX,catY));
        g.style.animationDelay=`calc(var(--cat-cycle) * ${(idx/gait.length-1).toFixed(4)})`;catChildren.push(g);
      });
    }
    svgNode.replaceChildren(
      defs,
      svgEl('line',{class:'dashboard-speed-base',x1:0,x2:W,y1:H-0.5,y2:H-0.5}),
      peakY!==null?svgEl('line',{class:'dashboard-speed-peak',x1:0,x2:W,y1:peakY,y2:peakY}):null,
      line?svgEl('path',{class:'dashboard-speed-area',d:`${line}V${H}H${start}Z`}):null,
      line?svgEl('path',{class:'dashboard-speed-line',d:line}):null,
      svgEl('g',{class:`dashboard-cat cat-mood-${mood}`},catChildren),
    );
  }
  // Minimal style: a neutral pulse glyph and a single-accent sparkline. Clearing
  // _catRoot makes the cat badge rebuild itself if the user switches back.
  function updateMinimalBadge(svgNode){
    if(!svgNode||svgNode._renderKey==='minimal')return;
    svgNode._renderKey='minimal';svgNode._catRoot=null;
    svgNode.replaceChildren(svgEl('path',{class:'speed-pulse-icon',d:'M1 5h3l2-4 3 8 2-4h4'}));
  }
  function updateMinimalTrail(svgNode,samples,live){
    if(!svgNode)return;
    const key=`minimal|${live?1:0}|${samples.join(',')}`;
    if(svgNode._renderKey===key)return;
    svgNode._renderKey=key;
    const W=140,H=54,shape=language.minimalTrail(samples,{width:W,height:H,top:6,bottom:2,right:4});
    svgNode.replaceChildren(
      svgEl('line',{class:'speed-min-base',x1:0,x2:W,y1:H-0.5,y2:H-0.5}),
      shape?svgEl('path',{class:'speed-min-area',d:shape.area}):null,
      shape?svgEl('path',{class:'speed-min-line',d:shape.line}):null,
      shape?svgEl('circle',{class:`speed-min-dot${live?' is-live':''}`,cx:shape.end[0],cy:shape.end[1],r:2.6}):null,
    );
  }
  const pct=n=>typeof n==='number'&&Number.isFinite(n)?`${(n*100).toFixed(1)}%`:'—';
  const rate=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:1,minimumFractionDigits:1}):'—';
  const count=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('en-US'):'—';
  const compact=n=>{if(typeof n!=='number'||!Number.isFinite(n))return '—';for(const [base,suffix,nextBase,nextSuffix]of [[1e12,'T',0,''],[1e9,'B',1e12,'T'],[1e6,'M',1e9,'B'],[1e3,'K',1e6,'M']])if(n>=base){const scaled=n/base,rounded=Number(scaled.toFixed(1));return nextBase&&rounded*base>=nextBase?`1${nextSuffix}`:`${rounded}${suffix}`;}return String(n);};
  const tokUnit=n=>n===1?'tok':'toks';
  const compactDetail=n=>{if(typeof n!=='number'||!Number.isFinite(n))return '—';for(const [base,suffix,nextBase,nextSuffix]of [[1e12,'T',0,''],[1e9,'B',1e12,'T'],[1e6,'M',1e9,'B'],[1e3,'K',1e6,'M']])if(n>=base){const scaled=n/base,rounded=Number(scaled.toFixed(scaled<10?2:1));return nextBase&&rounded*base>=nextBase?`1${nextSuffix}`:`${rounded}${suffix}`;}return String(n);};
  const seconds=language.elapsed;
  const timer=(at,compact=false)=>language.countdown(at,Date.now(),compact);
  const date=language.resetDate;
  const label=language.quotaGroupLabel;
  const attribute=(element,name,value)=>{if(value===null){if(element.hasAttribute(name))element.removeAttribute(name);}else if(element.getAttribute(name)!==String(value))element.setAttribute(name,String(value));};
  const style=(element,name,value)=>{if(element.style.getPropertyValue(name)!==value)element.style.setProperty(name,value);};
  const hidden=(element,value)=>{if(element.hidden!==value)element.hidden=value;};
  const GUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const visibleHostElement=element=>element.isConnected&&!element.closest('[hidden],[inert]')&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';
  const sidebarOwners=new WeakMap();
  const cleanModelText=v=>String(v||'').replace(/[\x00-\x1f\x7f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
  function badgeTextRects(badge){
    if(!badge?.isConnected)return [];
    const walker=document.createTreeWalker(badge,NodeFilter.SHOW_TEXT),range=document.createRange(),rects=[];
    for(let textNode=walker.nextNode();textNode;textNode=walker.nextNode()){
      if(!textNode.textContent.trim()||textNode.parentElement?.closest('svg,[hidden],[inert]')||getComputedStyle(textNode.parentElement).visibility==='hidden')continue;
      range.selectNodeContents(textNode);rects.push(...range.getClientRects());
    }
    return rects.filter(r=>r.width>0&&r.height>0);
  }
  function captureNative(found){
    const branch=found.branch,r=branch.getBoundingClientRect();
    const baseline={height:r.height,icons:Array.from(branch.querySelectorAll('svg')).map(ic=>({icon:ic,width:ic.getBoundingClientRect().width})),reserve:0};
    if(found.kind==='ide')baseline.reserve=surface.nativeReserve(found);
    if(found.kind==='subagent'){
      const badge=found.anchor,css=getComputedStyle(badge);
      // Summed glyph fragments recover intrinsic text width even if the host
      // is already wrapping the badge when we first attach.
      const textWidth=badgeTextRects(badge).reduce((sum,rect)=>sum+rect.width,0);
      const iconWidth=badge.querySelector('svg')?.getBoundingClientRect().width||0;
      const natural=textWidth+Math.max(iconWidth,12)+(parseFloat(css.columnGap)||0)+(parseFloat(css.paddingLeft)||0)+(parseFloat(css.paddingRight)||0);
      baseline.reserve=Math.ceil(Math.max(badge.getBoundingClientRect().width,natural)+badge.getBoundingClientRect().left-r.left+(parseFloat(getComputedStyle(branch).paddingRight)||0));
    }
    return baseline;
  }
  function composerLayout({row,editor,branch}){
    // Containment alone can join an app header and a distant message editor.
    // Accept only a horizontal, normal-flow action row local to that editor.
    const css=getComputedStyle(row);
    if(!['flex','inline-flex'].includes(css.display)||css.flexDirection!=='row'||['absolute','fixed'].includes(css.position)||row.closest('header,[role="banner"]'))return false;
    if(['absolute','fixed'].includes(getComputedStyle(branch).position))return false;
    const r=row.getBoundingClientRect(),e=editor.getBoundingClientRect(),p=row.parentElement.getBoundingClientRect();
    const gap=Math.max(0,r.top-e.bottom,e.top-r.bottom);
    const overlap=Math.min(r.bottom,e.bottom)-Math.max(r.top,e.top);
    return r.width>0&&r.height>0&&e.width>0&&e.height>0&&gap<=48&&overlap<=2&&Math.min(r.right,e.right)>Math.max(r.left,e.left)&&p.height<=e.height+r.height+96;
  }
  const fiberCascadeId=(anchor,boundary)=>{
    if(!anchor)return null;
    const key=Object.keys(anchor).find(k=>k.startsWith('__reactFiber$'));
    if(!key)return null;
    const stopAt=boundary?.[key]||null;
    for(let fiber=anchor[key],hops=0;fiber&&fiber!==stopAt&&hops<40;fiber=fiber.return,hops++){
      if(fiber.stateNode instanceof Node&&boundary&&!boundary.contains(fiber.stateNode))break;
      const props=fiber.memoizedProps;
      if(props&&typeof props==='object'&&Object.hasOwn(props,'cascadeId')){
        const cid=props.cascadeId;
        return typeof cid==='string'&&GUID.test(cid)?cid.toLowerCase():null;
      }
    }
    return null;
  };
  function findComposers(){
    if(surface&&!surface.useSharedComposer)return surface.findComposers?surface.findComposers():[surface.findComposer(instances[0]?.composer)].filter(Boolean);
    const visible=visibleHostElement;
    const semanticEditors=Array.from(document.querySelectorAll('[role="combobox"][contenteditable="true"],[role="textbox"][contenteditable="true"]')).filter(visible);
    const editors=Array.from(new Set([...semanticEditors,...Array.from(document.querySelectorAll('[aria-label="Message input"]')).filter(visible)]));
    const stableModels=Array.from(document.querySelectorAll('[data-testid="model-selector-trigger"]')).filter(visible);
    const models=stableModels.length?stableModels:Array.from(document.querySelectorAll('button[role="combobox"][aria-haspopup],button[aria-label^="Select model"]')).filter(visible);
    const pairs=[];
    const ownsEditor=(element,editor)=>element.closest('[data-testid="agent-input-box"]')===editor.closest('[data-testid="agent-input-box"]');
    for(const model of models)for(const editor of editors){
      if(!ownsEditor(model,editor))continue;
      const box=editor.closest('[data-testid="agent-input-box"]');
      if(box){
        const owned=e=>e.closest('[data-testid="agent-input-box"]')===box;
        const activeEditors=Array.from(box.querySelectorAll('[contenteditable="true"]')).filter(e=>owned(e)&&visible(e));
        if(!activeEditors.includes(editor)||activeEditors.length!==1)continue;
      }
      let row=model.parentElement,distance=1;
      // The toolbar branch and editable branch meet at their nearest common
      // composer ancestor. Action-button labels and generation state are irrelevant.
      while(row?.parentElement&&!row.parentElement.contains(editor)&&row.parentElement!==document.body&&row.parentElement!==document.documentElement){row=row.parentElement;distance++;}
      if(!row||row===document.body||row.contains(editor)||!row.parentElement?.contains(editor)||[document.body,document.documentElement].includes(row.parentElement))continue;
      for(let element=editor;element&&element!==row.parentElement;element=element.parentElement)distance++;
      let branch=model;while(branch.parentElement!==row)branch=branch.parentElement;
      const pair={editor,model,row,branch,box,distance,kind:'main'};
      if(composerLayout(pair))pairs.push(pair);
    }
    // Subagents have a static identity badge instead of a model selector.
    // Use only a bounded, stable host input box with a semantic send control;
    // never use the auxiliary pane's arbitrary comboboxes as an anchor.
    for(const editor of editors){
      const box=editor.closest('[data-testid="agent-input-box"]');
      if(!box||!visible(box))continue;
      const owned=e=>e.closest('[data-testid="agent-input-box"]')===box;
      const activeEditors=Array.from(box.querySelectorAll('[contenteditable="true"]')).filter(e=>owned(e)&&visible(e));
      if(!activeEditors.includes(editor)||activeEditors.length!==1)continue;
      if(Array.from(box.querySelectorAll('[data-testid="model-selector-trigger"]')).some(e=>owned(e)&&visible(e)))continue;
      const controls=Array.from(box.querySelectorAll('[data-testid="send-button"],[data-tooltip-id*="send-button"],[data-testid="stop-button"],[data-testid="cancel-button"],button[aria-label]'))
        .filter(e=>owned(e)&&visible(e)&&(e.hasAttribute('data-testid')&&/^(send|stop|cancel)-button$/.test(e.dataset.testid)||e.getAttribute('data-tooltip-id')?.includes('send-button')||/^(?:cancel|stop|取消|停止)(?:\b|\s|生成|任务|响应|$)/i.test(e.getAttribute('aria-label')||'')));
      for(const send of controls){
        let row=send.parentElement,distance=1;
        while(row?.parentElement&&row.parentElement!==box&&!row.parentElement.contains(editor)){row=row.parentElement;distance++;}
        if(!row||row.contains(editor)||!row.parentElement?.contains(editor)||!box.contains(row))continue;
        const interactive='button,a,input,select,[contenteditable="true"],[role="button"],[role="combobox"],[aria-haspopup]';
        const candidates=Array.from(row.querySelectorAll('*')).filter(e=>owned(e)&&visible(e)&&!isPulseBar(e)&&e.querySelector('svg')&&badgeTextRects(e).length&&!e.contains(send)&&!send.contains(e)&&!e.matches(interactive)&&!e.closest(interactive)&&!e.querySelector(interactive));
        const anchors=candidates.filter(e=>!candidates.some(other=>other!==e&&e.contains(other)));
        if(anchors.length!==1)continue;
        const anchor=anchors[0];let branch=anchor;while(branch.parentElement!==row)branch=branch.parentElement;
        if(branch.contains(send))continue;
        for(let element=editor;element&&element!==row.parentElement;element=element.parentElement)distance++;
        const pair={editor,model:null,row,branch,anchor,box,distance,kind:'subagent'};
        if(composerLayout(pair)&&!pairs.some(p=>p.editor===editor&&p.row===row&&p.branch===branch))pairs.push(pair);
      }
    }
    const byOwner=new Map();
    for(const pair of pairs){
      const key=pair.box||pair.editor;
      let list=byOwner.get(key);if(!list){list=[];byOwner.set(key,list);}
      list.push(pair);
    }
    const uniquePairs=[];
    for(const list of byOwner.values()){
      list.sort((a,b)=>a.distance-b.distance);
      const minDist=list[0].distance,best=list.filter(p=>p.distance===minDist);
      if(best.length===1)uniquePairs.push(best[0]);
    }
    const boxed=uniquePairs.filter(p=>p.box);
    if(boxed.length)return boxed;
    if(!uniquePairs.length)return [];
    uniquePairs.sort((a,b)=>a.distance-b.distance);
    const focused=uniquePairs.filter(pair=>pair.editor===document.activeElement||(document.activeElement instanceof Node&&pair.editor.contains(document.activeElement)));
    if(focused.length===1)return [focused[0]];
    const retained=uniquePairs.filter(pair=>instances.some(inst=>!inst.parked&&inst.composer?.branch===pair.branch&&inst.composer?.editor===pair.editor));
    if(retained.length===1)return [retained[0]];
    // Equally plausible visible composers must not place the strip arbitrarily.
    const closest=uniquePairs.filter(pair=>pair.distance===uniquePairs[0].distance);
    if(closest.length===1)return [closest[0]];
    const fallback=closest.find(pair=>pair.editor===document.activeElement)||closest.find(pair=>instances.some(inst=>!inst.parked&&inst.composer?.branch===pair.branch&&inst.composer?.editor===pair.editor));
    return fallback?[fallback]:[];
  }
  const NEON_OPEN_WEBP="data:image/webp;base64,UklGRsgVAABXRUJQVlA4WAoAAAAQAAAAkQAAewAAQUxQSHIFAAABoIVtkyHJ+iOyZ0fHtm3btm3btm3btm3btm2f2e2I+C8GO9OVWdcRMQHIoIhISkmTakqqIoLCiwpGXlUKJgrIWJNNucIhx558wsknHXvsGWtPPLkASFIoEWDM+Y659acfOUD78ZvLz1i1ASQpkQLj7/ze3+zdtH7Ze8SNK3UBWpzR2jHRkR+TNI8I9h8R1iT50OZjQ6Us2omVXyfdg4MZFuRDswJSEkHjpB66c/A9+POhk4uUQxpTXEE6h9bJZ6Zrk1IkzPARLTjUYXxuCmghMNojNLZik4+PDinCWJNeTGNrGo9NKKAI9qazRcN7dm2HZE8x3bcerULnLwvnT7T9Vjpb1/jIaJDMKdYf7tFC4c11oXkT6X6BxlY23ieSt4S16WzpiH9nhGZN5DFaa9F4IFLOEpY3Z4s7P2yH5Euk41K2XIRvBs0Yxvyi9Wi8KGcJ649wtrzzkdEhGTuG1nrBntmg2ULjNXoV/p01X4LOj6pA4wFIuVIs8iejEldBc5VwKI2VuK0NkimVs6sR/G1qaKag79OrMXz2XAk6P6uKL5erhFWHe1SBxksheWpgFzZZkSugeVIcV52bVLIkGO1TejWCf88EzdO4PzCqwtUhOWpgKzNW1HgFRDKkOJUVeqELGRJM8AmjKsER00Pzo1g3ojKM2BqSo3NprKzxjjaR7GDYG/TqBL+ePz8Jy3iwwsEtkHKjuI1WJYv7VCQvikWGR1SJ/Hsx0ayItN1DZ6Wd50KyojJrD6NaEb/OA82IJFxHY8WN10AkH4ptzKNqEX+vmRHFRF/TWXnnO6NCMyHSuJbODBr3SykTDd2YzhxG/L4QNAeiOHC4RxbofHsyaAYSdnQGM+m8d2xo1aSBdXrCmU3jGaNDpFIiWMXozKjxjiUhUiGVtq3+C2dWnZ8sCZGqiGL6h8hgZo2frwZINQSY9wV6MLvOnqMTpAoJ3ef00JhjJ2+YGanlRDHm7aQzzxF8fwmItJYAS77GZjDbxi+2HRfaSoLxTvyPxpw7eW47tHUamOgF0pl3d948JbRFRDD/h7Rg9p2fLACVVlDIeh/QWMImv18TIkOnaD+ddJbR+N3CUBkqxSyP0J2lNP6yL4ZaMdsH9GA5nc0t21WGBPN9wiaL6hyxOdIQiKzwOY2Fdf62LHTQFOv/QGNxnT9sJSqDo5jvOxoL7PxtZqRBSZjtKxqLbPxgIuggCLpfo7HQzls6ICMlOvbldBbbuK/qyIjgbBrLHf7fIkgjoViqx6NgND7coQMTzP4lg0V37gYdiEi6hsayR3y5IGQACSuFsfTGyxuQfkS6XqQXL/z3WVX7w5F0lt94HFJfKnP+E1EDIj6fGtKH4HQa66DxtKS9BFN8F1ELPN4bDwIg4UAaa2HE3wtBAUHHK+H1gMaj+5r+R0ZNcL48DIKE3WisDd9ODUDlkvoQ/GNpiGDc7xh1gc4dkRLm/qtGNHk0UgO7sskasR+S4gJanTgYKeH4erEbGg3syGad2AGNhEPqxZ5oNLBPjQj+syRUsdhfEXXB+cO4EMFEP7E2WFzdLoDoA+G1gXsgAYr9aTUh4o+5oIBg7r8i6oHzMQgASLqIVg/MthXtpZjmN4864Hx5FJFekI6r2awBEX/OCUWfinl+ZpTPeCoE/Yqs/G9E6ZxPNHQASDiVVriIn+aCYoCik7xNL5vz7dFFBqIyzTeMsjF8EUkDwuF0Ft54CAYimOjDKJ7H99OLDqBtxxHO4juPRH+C7pdYB+LFdkhfill+jChf8Md5of3IcTTWQONx0g/wSj1wvoK+FYv85VEHgr/MCO1D9qGxFhp3lARAMM6L4fXA48VOCKCY+3dGTeA3E/VK2C+M9TCiuQ4SAFZQOCAwEAAAkEcAnQEqkgB8AD4xFolDIiEhFAjWACADBKANLmQFp+hf7X8h/aus/91+/PM7Hv7Mf1Xop/vX5R/MbzAP1I6ev7SeoD+Xf3L/R/5z3pPRb6A/8p/yHWb/2b/a+wB+t3pof8j/mfBn+2X7f/Ap+rv/h6wDgRvwA/UD4weM/2n8Tv3M9Y/Nb8w9s+VQ1S/VcVu1j/kfy88pXwbs5f7f+zcoX2S8z//TeVH5VtAD+U/1n/M/mF/ovl4/3PuV99P03/yv8z+6390+wL+Kfzf/Jf1z/Gf97/Bf///4d7N7FH6gtcVm94fEEZwXIHMWagVZpaFOGlzAM82xPahAL1oD2FZB5fT9hwoUd0hQT7vXQJE7zvQSE8mn6BN54GV0z/XZfbsrJ8gVHA28YDAHJS0JMNespxsXTty9uqM4sq9dftjHQqMvjkuH+ssJaBTaafAkf9mR3tqFRRvJZOM9b4raJiXlQ5WsOMSr3cgXsl4Phx9BvA/mVd4lU2JaCviStEgbDu5YH8jvHfreAVmnc+5d3KqdKPB7o2IBqSN/XHEzDVm33G2YdoY9CQpa46vsEQlUL/xU7S0iCnCxXcquRQoX4j/Xd7XjuiTMS7LTy2bAN7gextiEYrlfgmxwiNauFl7Rv1PeyGqecPq8NApxouCHL1ef+yG79J+5SaSCeaka/I8G3CT5HMgz6tal+3Eo+bum0bNpQ460zVW3/lyDCrgbvz0EdswnuziINH0Oqxt8zrX8ojTO87exLuys4fjtdKpV0a0J+z13tYAA/v9gGO37DftU3bv+OkPvobjNcvYlfONbIfXiTT0Yn81UV+dHEGE6W1c2t+h/sQFtgdLsrpeTaQ8oAbcGN8Vb4tgWZQsYK3FuMqAyAprc0Fh8qzrk/IjY6P/EFf3rrt6grt+Wi8K0vLP+RkYpV0d3s6oClcaiLe6Vv+m3pUChhRcuL/f6lwfjsDq05axGW0uQ5dbn3Ak/6+iSCZBdIxW8ODLDnxhBBncOGcwvv1sV6k85a1cb54qYjQWdBcgVYicB6pzIGTwph9+eFQ32k/A7Lxadb7njbWYl6slE/CA/ToWf246i7PGQSNQGCvV2vONWxNfu6dnGyaIqBXXV9sLr2lPvmMpYvQPYUnzAwiYFaqTP/KLWNnJa6iBDcsmn4/twtae+HMnXTuysBPLx0KRz18105bwEQcDDIxTyN60EH/TtWuWjTuYTuYjGKODxF+ojVS7ROFtdLda1Sl1CyZ1PRD/nXs8kjIpA69zANC0QoCN/Umhz2prOg3RifXWcaeDJ/nxWv4iTxrPAAQsFhjFOgzShgIERm+sOHBzkwcSMls2isZdlKN3uYnNojSf+GfrymbbTkOcvJgZbziTj58/XGc6yUk43QKhvpCYwAQMMeUUZZBwS5JnWwfQWx/m2RdeNsv5PsJR1kH3AceeAFcWAgXQMLD1VnSvK/jd0WUSQskPqkdGJ1YGliXrawyK8UzJJG2f+E3yYrg0KOEBCgmz0CTieLwobbYQBPix2PUQFDP5W9Pfn8YZNKmTMLf9iiLX8qUohR/1cqiQnsVobjFPM2Btn72gSrpErioKiyAVPFzZVrpoNdd3f5iX5L9aadU15NJk2HXQEvhtyrMnV1uTrEgPOziXvQegn8KaT+GMIqW7yQzYgejjTXbAo/rujaZMspNxPDagCi/DT8UzZMk8w5m7vYh0Z5pJ17F4QC3H+CDE9ibuXGTTcmDqhvHpRg2G75qrRld93Va0Gp1JqD7h1p3pxob/BEQxP5OPQU7IB6i1cPeXsQpJ1x7qX5/a+FNdIncjUM0jB5OmsBipnpA2UEqPRRKLISdgAklyfOGCb9c+WmCSfk7M/NaUIVSzff4Sx+3XknGnt3FRZDKEh0MZGnHgmnTM+n+vrk/VhOEOT6ZExr5OUig/vC/rYsKyiI7u2qw1K/euI5xUj/RTSLQQWSRsBFgfZnhGFq1Ieu1bRACrDegGCvNK2lnTzdtpUGcGuZey8BdO+HiL2cFeTUDBQ51UdaJ/Oa9Cq/r7ju6cpG6VFCNtyTo+FnhjUBqGNcGJu8omo+vwbeFO2vdQ/vdAJiS6sPPskrekKeZc9bbm8sqK+xU/nVuLb/DKcCTA/VdDEjrr4QrYSpEXpyW9gaPR84NqzNh7WKbyxB5s0JajaaDOCqN2fWts7+v9p77eD26utIKUcPQyiG+epQCIW4tGncMLaD+WrdNCAIP+3bNv+azgc0K8+bh79xZboWMDtluZHMTfLaLi23xawczyo9vq8w0qbs3DMR5euPL5W8k5e2TFKY7/UPr3CWVrDlvK5ztlY+flEc17NRy91zwlOLRrCE9/d4UGFkG38EO7H9b5OzH8UO0t/qirtardrtAtbgRu5rrJe2xtipUym7dP0qOSTHtzt7jXDS0KAe6h9e+ZniJ5N/wlwLn2otx8YqzpL9CcULmxBq61K7JBloy9Lj9qMMUS4rSQrYLh1GEUOjxIBuQniL2xt6cW5IA1iF/QpgkjIXptEft2LdQVoNM5kNrP1kNwRsAcOq94h/AN2X7VDt2Jt1OILv8UHfmL+Fb0p2wlODqmYwzt1gdrfKcCRdqa4kddnNzRpgl2BtWeHJgr9X4CyImA2JXLafrkLArKs1Ea5Z6+hn6F5aZgIo2ITN/s5YaGAxcO0+QTm4av24wcEfjYOTeWSEBSU9jhBb5BnR+2acmAsPh9YvURgP0aSuTwaBtCybhaUaIeRVQ8uB/jhC/qDFBgW7Cqw2EbKr9pp+uU0eo2wLEVjXN0SH6TXHIAwAwZj2V859KuiodeYWcigpa3WfZ+/X2XfAJWhm4CxK/OOSDvEtK3cBrpjcBkK/xIi2iONyNh3Hmtuy8i7nJiJfo0HnlHbAHzTPTgxe0BvfT1OhWw2FPoVBJplxZDx49eyes5sNE/BFGV3xqPIEZsJHL+46FAfYIh6a+o5HzNp6lQVM8+5EMd06GFIaSRjwXoSPATmH8Cp/n6h3WiYu1EGFDqE3myoOPQVUUEsBm3rDYGLzN7YaEvq1Na2MtAuOwVipBfJdl0gbNJizF+i4dYV2oI4FLRpINtCcrLJ538aHN3PPYEBSQrtD2D8lZdENxS/vw/H6RaZYQ7HDVRemPP7lOwjsklQ++jv01b6Z1vSvFCswG1CwOMzNbr4LGB0vnIRDw/9V1IPBiYbRLxtiddzBMnqg2uFc5Pcppn6HihOK18P1OZUScqlCm/52X8IGVNm8ghL7gjgdcGmnuKXXXLhNCu7uDWR+fLPpe1ytHNJZyAGOJ1KZ3/Atelvn27bJEIK+pN6HLzsS1+j1Ij1FMZfarbVEtDUUlOiHLyyRhyGbS09z0CUZ97LOYxHb4J14j9n6MWek9ox9rf2KeamTc9dbo5f0LzY5pd9QSOmqY4gJi2D5tUd6db1D+R83M3z6EJ8vSUeh9V0t1oaYlttSAEdxG84TilAyJ75xYv7A4bfSr3ZOHWxUhxxAuISLPjiHDhkAoSnvnCKO7kvt+lQzn+KwvpR7ZbHrXpBn80j/tXoaNUo79IqMk0V/APQFbYccPIZBz6nyA+d9pBG4YTzskeQPLkA5PMBgRIcr9/rCRhJP2EeZAyrmz7qDHKxeHTOHzLRIIeKN/78Ivoyzpmza6EzSTAk1KqcTqgrcmY9YOYWb/0pJWTdVOdC97+MgnmWWciEK9RUgJp4kTbaRGKFfBZKVE1dP6PH3/i/T+5Fve1nwG/qP2XZWr2NuqvNu58BGKCDvYB6Z0rr7T8BbhvlaBgV4N6UUtteAxiA8CBGc4Gv8YAWO8vajuYJEbeWfpzqkxEnCnIi268jtcBwUpkaGqVr3VNYc4cLrtIiAfypNmzLulPYd9y7WOo7qjZk8poJs8QYgSlBk3kARFO9eViBtUXC3884NIXxaYCIcan1uYebBzmZN8JZ/bS4qPL+Ez6rJv4jfs8+cvH1wf8xUFOW0Wk13WXbQ/4kegdJc+/tapvJMBRJ37DjROutjevLn8ZxZekrrr1/Uzx4d4VBmqjvKwkO38jCzhuTpuNA5bs0I1mU5F0MHzgH6zPbC6313q6k4p4iGtttgs8b2eFQmbSLd8UUJXyC+WDlS//qmBtCUcjupd4sAwIw/x4k3ItrOgt3EMukUy+5dTG0kxrPc3HI9ac0Ftf8F08wMyoX8ir52cAuq+IGX/DDjgRezQtF9g5pFftN0G4t2ruNQxP4lCYWcTLwXKUM3L+fu9DzHXK73QxDLacXQSbVWRz4379e4mT4Rm8vRR3Dswze+ak+lm1h9IsZionVv/2UzkAaxbsi+AGqocxCSkTdE9BXn2m3c2P4QO08LafLMcFspqB/vEqY10J5txYQGpOYl7CdcexpHD0ApVY8B2NN7SUFIWuvrmY4KUloCjhstKxbPXO4tqP6mxwNYIovkeC/yVYB7VXDGXsKIFq1xe0GqYQu0xZDwBGBsrm/4ipf0rXyUhhKknvFLKTtSxEMT31frG6DWxMwKxRTVW3sDuN3sFrYt83U3G4bP+9Wm+jA0JS2Ly1DPCgM2+O7uV4TiHm1aczgGe0THKbZPUWnThro2idL5X/krTV9L3zUBbCJPr7XnNJEGCgLo3dPOrQX+JYvKNrqmqmz9rctxwWnbGU1MVKeQY9QCt+6ljxebWg0PdgM+n3XEkJA0WDrYUKR8xIpplxCQ5FMZsg6FDqC0GkiliO9q+FqKpR0sYlxFGVYvB7ObnXZ3ppTkSs/6FhUDk0kKp+We0k+NjmJKKbKZjpajl176jE6cpGekPcMkHvR+bx/2BgpbUD5Vsj5M8saHaMSoYoOqG3y7zl59VOsBe0urfH9PQSri64el85V/6j5wi2h5z+DfdV/l9lXrEwA4tsouQWRWEYqHmCzWv+6+oiUSgRXlqn90HT90O/sNFcavcmyDdKVb0zcsvYw3+Lx3FezHDYmCTXgrsFmdjdmej1R+0BsD/z2dyrVD3edZ2GkbJ/ODhBFKWYloE8jSgbe+WmA6kdJPhgOq0rot7LbetFssjV1jhu4Q8l5DlkcXrN07H2NAUmtTCz/O4C3avmzG3BNc9SCWHEAKYBXLBiH1BysZrzmwyHugXOSEmxY7A+kjMuNPTXYqcel6HDwkZX74zHP03irlVDFUbY287ESp2MTmunu85s0SqBcdknzxmAgTHHv6S54FDJXTsWRIOKe+WM4M/9+6UG+SNKs7VBOuN2WGglVQR+eDWMHVVDDiRDpOLQAql5OVSUXiVUQx3GEGOf2p40E5QDRR7I23u6llt3PA0AJ+IzOC2r00onvK5e6IXxiX6qo4IQhPz2a5Z2/M//2aPoanQLrzWQc+jWjw+xiEsxEOhrfyZq0fo2UhGQRqTpIOYme7iiCJE7+R1DlPulto/fwPM5iHw+oQjrRXVY2CPKpxclNnju0GkCPjIQIE3SuY1B7HI5kC4PqCkJyF/in5rD6TbmojwPVO+z5dIGdJdWRytk02pEJxZd26GofTjs2YIA0TBEM+zXsVwDshPSe1alhAZB+9mvKIbPIc8s3sw+qOAAAAA==";
  const NEON_BLINK_WEBP="data:image/webp;base64,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";
  const NEON_W=73.0,NEON_H=62.0,NEON_SW=NEON_W+14,NEON_SH=NEON_H+14;
  const NEON_MODEL_RE=/\bneon\b|氖龙/i;
  function createNeonMascot({isSuppressed=()=>false}={}){
    let host=null,shadow=null,stage=null,actor=null,look=null,typeBob=null,squish=null,sway=null,sparks=null,bubble=null;
    let enabled=true,shown=false,tucked=localGet('ag-pulse-neon-tucked')==='1',curComp=null,curBar=null,curData=null;
    let blinkTimer=null,blinkEnd=null,hideTimer=null,holdTimer=null,typeIdleTimer=null,proxFrame=null;
    let pointerDown=false,petting=false,downX=0,downY=0,lastX=0,lastY=0,petTravel=0,nextSparkAt=65,curSx=1,curSy=1,curSrot=0;
    let hovered=false,lastTypeAt=0,typeDir=1,boundEditor=null,squishAnim=null,typeAnim=null,proxX=-9999,proxY=-9999;
    const isNeon=comp=>{
      if(!comp||comp.kind==='subagent')return false;
      const m=comp.model?.isConnected?comp.model:(comp.branch||comp.row)?.querySelector('[data-testid="model-selector-trigger"]');
      if(!m)return false;
      const label=`${m.getAttribute('aria-label')||''} ${m.getAttribute('title')||''} ${m.textContent||''}`;
      return NEON_MODEL_RE.test(label);
    };
    const findCard=comp=>{
      const base=comp?.box||comp?.row?.parentElement;
      if(!base?.isConnected)return null;
      const br=base.getBoundingClientRect();
      if(br.width<=0||br.height<=0)return null;
      let card=base,cur=base;
      for(let i=0;i<4&&cur&&cur!==document.body&&cur!==document.documentElement;i++){
        const s=getComputedStyle(cur),r=cur.getBoundingClientRect();
        if(r.width>br.width+64||r.height>br.height+140||r.height>innerHeight*.65)break;
        const rad=Math.max(parseFloat(s.borderTopLeftRadius)||0,parseFloat(s.borderTopRightRadius)||0);
        const frame=(parseFloat(s.borderTopWidth)||0)>0||(s.boxShadow&&s.boxShadow!=='none')||(s.backgroundColor&&s.backgroundColor!=='rgba(0, 0, 0, 0)'&&s.backgroundColor!=='transparent');
        if(rad>=8&&frame)card=cur;
        cur=cur.parentElement;
      }
      return card;
    };
    const updateBubblePos=()=>{
      if(!bubble||!stage||!shown)return;
      const sr=stage.getBoundingClientRect();
      if(!sr.width)return;
      const headOffset=tucked?NEON_H*.52:0;
      const top=Math.max(34,sr.bottom-NEON_H+headOffset-8);
      bubble.style.left=`${Math.round(sr.left+sr.width/2)}px`;
      bubble.style.top=`${Math.round(top)}px`;
      bubble.dataset.theme=stage.dataset.theme||'light';
    };
    const setBubbleVisible=next=>{
      if(!bubble)return;
      const show=Boolean(next&&shown&&!petting);
      if(show)updateBubblePos();
      bubble.dataset.open=String(show);
    };
    const ensureHost=()=>{
      if(host?.isConnected)return;
      host=document.createElement('div');
      host.dataset.agPulseNeonMascot='true';
      host.style.cssText='position:fixed;inset:0 auto auto 0;width:0;height:0;pointer-events:none;z-index:10;';
      shadow=host.attachShadow({mode:'open'});
      const css=document.createElement('style');
      css.textContent=`
        :host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
        .stage{position:fixed;overflow:hidden;pointer-events:none;z-index:10;transform-origin:bottom center}
        .stage[hidden]{display:none}
        .shadow{position:absolute;left:10px;right:10px;bottom:-2px;height:6px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(28,18,56,.22) 0%,rgba(28,18,56,0) 72%);opacity:0;transition:opacity 220ms ease;pointer-events:none}
        .stage[data-shown=true] .shadow{opacity:1}
        .clip{position:relative;width:100%;height:100%;display:flex;align-items:flex-end;justify-content:center}
        .actor{position:relative;width:${NEON_W}px;height:${NEON_H}px;pointer-events:auto;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;transform-origin:bottom center;transform:translateY(108%) scale(.92);opacity:0;transition:transform 380ms cubic-bezier(.34,1.56,.64,1),opacity 180ms ease;will-change:transform,opacity;-webkit-tap-highlight-color:transparent}
        .stage[data-shown=true] .actor{transform:translateY(0%) scale(1);opacity:1}
        .stage[data-shown=true][data-tucked=false] .actor:hover{transform:translateY(-3px) scale(1.02)}
        .stage[data-shown=true][data-tucked=true] .actor{transform:translateY(52%) scale(.96);transition:transform 280ms cubic-bezier(.22,1,.36,1),opacity 180ms ease}
        .stage[data-shown=true][data-tucked=true] .actor:hover{transform:translateY(44%) scale(.98)}
        .actor[data-petting=true]{cursor:grabbing}
        .look,.type-bob,.squish,.sway{position:relative;width:100%;height:100%;transform-origin:bottom center}
        .look{transform:translate(var(--lx,0px),var(--ly,0px)) rotate(var(--lr,0deg));transition:transform 180ms cubic-bezier(.22,1,.36,1);will-change:transform}
        .squish{transform:scale(var(--sx,1),var(--sy,1)) rotate(var(--srot,0deg));will-change:transform}
        .stage[data-running=true][data-shown=true][data-tucked=false] .sway{animation:neon-breathe 2.4s ease-in-out infinite}
        @keyframes neon-breathe{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-2px) scale(1.015,.985)}}
        .frame{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;-webkit-user-drag:none}
        .frame.blink{opacity:0}
        .actor[data-blinking=true] .frame.open{opacity:0}
        .actor[data-blinking=true] .frame.blink{opacity:1}
        .stage[data-theme=dark] .sway{filter:drop-shadow(0 0 7px rgba(167,139,250,.38)) drop-shadow(0 -1px 2px rgba(196,181,253,.22))}
        .spark{position:absolute;right:4px;top:26px;width:14px;height:14px;pointer-events:none;opacity:0}
        .stage[data-running=true][data-shown=true][data-tucked=false] .spark{animation:neon-spark 1.6s ease-in-out infinite}
        @keyframes neon-spark{0%,100%{opacity:.2;transform:scale(.75) rotate(0deg)}50%{opacity:.95;transform:scale(1.12) rotate(12deg)}}
        .sparks{position:fixed;pointer-events:none;z-index:13}
        .burst{position:absolute;width:14px;height:14px;animation:neon-burst 680ms cubic-bezier(.22,1,.36,1) forwards}
        @keyframes neon-burst{0%{opacity:0;transform:translate(0,6px) scale(.4) rotate(-15deg)}25%{opacity:1;transform:translate(var(--tx,4px),-8px) scale(1.1) rotate(8deg)}100%{opacity:0;transform:translate(var(--tx2,10px),-26px) scale(.6) rotate(28deg)}}
        .bubble{position:fixed;z-index:14;pointer-events:none;display:inline-flex;align-items:center;gap:5px;padding:4px 10px 4px 8px;border-radius:999px;font-size:11.5px;font-weight:550;letter-spacing:.03em;line-height:15px;white-space:nowrap;color:#312554;background:rgba(255,255,255,.94);border:1px solid rgba(118,92,214,.24);box-shadow:0 6px 16px rgba(72,53,148,.14),0 1px 2px rgba(24,18,52,.07);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transform:translate(-50%,calc(-100% + 5px)) scale(.86);transform-origin:bottom center;transition:opacity 170ms ease,transform 230ms cubic-bezier(.34,1.56,.64,1);will-change:transform,opacity}
        .bubble::after{content:'';position:absolute;left:50%;bottom:-4px;width:7px;height:7px;background:rgba(255,255,255,.94);border-right:1px solid rgba(118,92,214,.24);border-bottom:1px solid rgba(118,92,214,.24);border-radius:0 0 2px 0;transform:translateX(-50%) rotate(45deg)}
        .bubble[data-theme=dark]{color:#efeaff;background:rgba(36,31,56,.93);border-color:rgba(167,139,250,.38);box-shadow:0 6px 20px rgba(0,0,0,.44),0 0 12px rgba(167,139,250,.22)}
        .bubble[data-theme=dark]::after{background:rgba(36,31,56,.93);border-right-color:rgba(167,139,250,.38);border-bottom-color:rgba(167,139,250,.38)}
        .bubble[data-open=true]{opacity:1;transform:translate(-50%,-100%) scale(1)}
        .bubble-star{width:11px;height:11px;flex:none;filter:drop-shadow(0 0 3px rgba(229,110,178,.45))}
        @media(prefers-reduced-motion:reduce){.actor,.look,.bubble{transition:opacity 140ms ease,transform 120ms ease}.stage[data-running=true][data-shown=true] .sway,.stage[data-running=true][data-shown=true] .spark{animation:none}}
      `;
      stage=document.createElement('div');stage.className='stage';stage.hidden=true;stage.dataset.shown='false';stage.dataset.tucked=String(tucked);stage.dataset.running='false';stage.dataset.theme='light';
      const sh=document.createElement('div');sh.className='shadow';
      const clip=document.createElement('div');clip.className='clip';
      actor=document.createElement('div');actor.className='actor';actor.setAttribute('role','button');actor.tabIndex=-1;actor.setAttribute('aria-label','氖龙');actor.setAttribute('aria-pressed',String(tucked));
      look=document.createElement('div');look.className='look';
      typeBob=document.createElement('div');typeBob.className='type-bob';
      squish=document.createElement('div');squish.className='squish';
      sway=document.createElement('div');sway.className='sway';
      const imgOpen=document.createElement('img');imgOpen.className='frame open';imgOpen.src=NEON_OPEN_WEBP;imgOpen.alt='';imgOpen.draggable=false;
      const imgBlink=document.createElement('img');imgBlink.className='frame blink';imgBlink.src=NEON_BLINK_WEBP;imgBlink.alt='';imgBlink.setAttribute('aria-hidden','true');imgBlink.draggable=false;
      sway.append(imgOpen,imgBlink);
      const spark=svgEl('svg',{class:'spark',viewBox:'0 0 16 16','aria-hidden':'true'},[
        svgEl('path',{d:'M8 1 L9.7 6.3 L15 8 L9.7 9.7 L8 15 L6.3 9.7 L1 8 L6.3 6.3 Z',fill:'#f3cf7a',stroke:'#b98cff','stroke-width':'0.9'}),
      ]);
      squish.append(sway,spark);typeBob.append(squish);look.append(typeBob);actor.append(look);clip.append(actor);stage.append(sh,clip);
      sparks=document.createElement('div');sparks.className='sparks';sparks.setAttribute('aria-hidden','true');
      bubble=document.createElement('div');bubble.className='bubble';bubble.dataset.open='false';bubble.dataset.theme='light';bubble.setAttribute('aria-hidden','true');
      const bStar=svgEl('svg',{class:'bubble-star',viewBox:'0 0 16 16','aria-hidden':'true'},[
        svgEl('defs',{},[svgEl('linearGradient',{id:'neon-bubble-grad',x1:'0',y1:'0',x2:'1',y2:'1'},[
          svgEl('stop',{offset:'0%','stop-color':'#e56eb2'}),svgEl('stop',{offset:'100%','stop-color':'#f2c55c'}),
        ])]),
        svgEl('path',{d:'M8 1 L9.8 6.2 L15 8 L9.8 9.8 L8 15 L6.2 9.8 L1 8 L6.2 6.2 Z',fill:'url(#neon-bubble-grad)'}),
      ]);
      const bText=document.createElement('span');bText.textContent='氖龙';
      bubble.append(bStar,bText);
      shadow.append(css,stage,sparks,bubble);
      for(const type of ['mousedown','click'])actor.addEventListener(type,e=>e.stopPropagation());
      actor.addEventListener('pointerenter',()=>{hovered=true;setBubbleVisible(true);});
      actor.addEventListener('pointerleave',()=>{hovered=false;setBubbleVisible(false);});
      actor.addEventListener('pointerdown',onPointerDown);
      actor.addEventListener('pointermove',onActorMove);
      actor.addEventListener('pointerup',onPointerEnd);
      actor.addEventListener('pointercancel',onPointerEnd);
      (document.body||document.documentElement).append(host);
    };
    const spawnSparks=(count=2)=>{
      if(!actor||!sparks)return;
      const r=actor.getBoundingClientRect();
      sparks.style.left=`${r.left}px`;sparks.style.top=`${r.top}px`;
      const all=[{x:r.width*.72,y:r.height*.32,tx:'10px',tx2:'18px',fill:'#f3cf7a'},{x:r.width*.24,y:r.height*.22,tx:'-8px',tx2:'-16px',fill:'#e56eb2'}];
      for(const s of all.slice(0,count)){
        const el=svgEl('svg',{viewBox:'0 0 16 16',class:'burst'},[
          svgEl('path',{d:'M8 1 L9.7 6.3 L15 8 L9.7 9.7 L8 15 L6.3 9.7 L1 8 L6.3 6.3 Z',fill:s.fill,stroke:'#8b6fe6','stroke-width':'0.9'}),
        ]);
        el.style.left=`${s.x+(Math.random()*8-4)}px`;el.style.top=`${s.y+(Math.random()*6-3)}px`;el.style.setProperty('--tx',s.tx);el.style.setProperty('--tx2',s.tx2);
        sparks.append(el);setTimeout(()=>el.remove(),700);
      }
    };
    const blink=(dbl=false)=>{
      if(!shown||!actor||document.hidden||petting)return;
      actor.dataset.blinking='true';clearTimeout(blinkEnd);
      blinkEnd=setTimeout(()=>{
        if(actor&&!petting)actor.dataset.blinking='false';
        if(dbl&&shown&&!document.hidden&&!petting)blinkEnd=setTimeout(()=>{
          if(!actor||!shown||petting)return;
          actor.dataset.blinking='true';
          blinkEnd=setTimeout(()=>{if(actor&&!petting)actor.dataset.blinking='false';},130);
        },110);
      },145);
    };
    const scheduleBlink=delay=>{
      clearTimeout(blinkTimer);
      if(!shown||document.hidden)return;
      blinkTimer=setTimeout(()=>{blink(Math.random()<.25);scheduleBlink();},delay??(3400+Math.random()*3400));
    };
    const setSquishVars=(sx,sy,rot)=>{
      curSx=sx;curSy=sy;curSrot=rot;
      if(!squish)return;
      squish.style.setProperty('--sx',sx.toFixed(3));
      squish.style.setProperty('--sy',sy.toFixed(3));
      squish.style.setProperty('--srot',`${rot.toFixed(2)}deg`);
    };
    const enterPetting=(sx=1.09,sy=.89,rot=0)=>{
      petting=true;
      if(actor){actor.dataset.petting='true';actor.dataset.blinking='true';}
      setBubbleVisible(false);
      squishAnim?.cancel();squishAnim=null;
      setSquishVars(sx,sy,rot);
    };
    const onPointerDown=e=>{
      e.stopPropagation();
      if(e.button!==0||!shown||!actor||!stage)return;
      pointerDown=true;petting=false;downX=lastX=e.clientX;downY=lastY=e.clientY;petTravel=0;nextSparkAt=58;
      try{actor.setPointerCapture(e.pointerId);}catch{}
      clearTimeout(holdTimer);
      holdTimer=setTimeout(()=>{if(pointerDown&&!petting)enterPetting(1.09,.89,0);},180);
    };
    const onActorMove=e=>{
      if(!pointerDown)return;
      e.stopPropagation();
      petTravel+=Math.hypot(e.clientX-lastX,e.clientY-lastY);
      lastX=e.clientX;lastY=e.clientY;
      if(!petting&&petTravel>5){clearTimeout(holdTimer);enterPetting();}
      if(!petting)return;
      const pushY=Math.max(-8,Math.min(34,e.clientY-downY));
      const rub=Math.min(.08,petTravel*.00065);
      const sy=Math.max(.74,Math.min(1.06,1-pushY*.0075-rub));
      const sx=Math.max(.95,Math.min(1.24,1/Math.sqrt(sy)));
      const rot=Math.max(-10,Math.min(10,(e.clientX-downX)*.24));
      setSquishVars(sx,sy,rot);
      if(petTravel>=nextSparkAt){nextSparkAt+=68;spawnSparks(1);}
    };
    const onPointerEnd=e=>{
      if(!pointerDown)return;
      e.stopPropagation();
      pointerDown=false;clearTimeout(holdTimer);
      try{actor?.releasePointerCapture(e.pointerId);}catch{}
      if(petting){
        const sx=curSx,sy=curSy,rot=curSrot;
        petting=false;
        if(actor)actor.dataset.petting='false';
        setSquishVars(1,1,0);
        if(!densityMedia.matches&&squish?.animate){
          squishAnim?.cancel();
          squishAnim=squish.animate([
            {transform:`scale(${sx.toFixed(3)},${sy.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`,offset:0},
            {transform:`scale(.92,1.09) rotate(${(-rot*.35).toFixed(2)}deg)`,offset:.28},
            {transform:`scale(1.05,.95) rotate(${(rot*.18).toFixed(2)}deg)`,offset:.56},
            {transform:'scale(.985,1.015) rotate(0deg)',offset:.8},
            {transform:'scale(1,1) rotate(0deg)',offset:1},
          ],{duration:560,easing:'cubic-bezier(.22,1,.36,1)'});
        }
        spawnSparks(2);
        clearTimeout(blinkEnd);
        blinkEnd=setTimeout(()=>{if(actor&&!petting)actor.dataset.blinking='false';scheduleBlink(2800);},150);
        if(hovered)setTimeout(()=>{if(hovered&&!petting)setBubbleVisible(true);},260);
        return;
      }
      if(e.type==='pointercancel')return;
      // Clean quick click -> toggle tucked ("缩回去") vs sitting out ("坐出来")
      tucked=!tucked;
      localSet('ag-pulse-neon-tucked',tucked?'1':'0');
      stage.dataset.tucked=String(tucked);
      actor.setAttribute('aria-pressed',String(tucked));
      if(!densityMedia.matches&&squish?.animate){
        squishAnim?.cancel();
        squishAnim=squish.animate(
          tucked?[{transform:'scale(1,1)'},{transform:'scale(1.08,.9)'},{transform:'scale(1,1)'}]
            :[{transform:'scale(1,1)'},{transform:'scale(1.13,.85)'},{transform:'scale(.94,1.07)'},{transform:'scale(1,1)'}],
          {duration:tucked?230:360,easing:'cubic-bezier(.34,1.56,.64,1)'}
        );
      }
      if(!tucked)spawnSparks(2);
      blink(false);
      scheduleBlink(tucked?1800:420);
      if(hovered)setTimeout(()=>updateBubblePos(),120);
    };
    const updateProximity=()=>{
      proxFrame=null;
      if(!look||!stage||!shown||document.hidden||densityMedia.matches||pointerDown){
        if(look){look.style.setProperty('--lx','0px');look.style.setProperty('--ly','0px');look.style.setProperty('--lr','0deg');}
        return;
      }
      const sr=stage.getBoundingClientRect();
      if(!sr.width)return;
      const cx=sr.left+sr.width/2,cy=sr.bottom-(tucked?NEON_H*.22:NEON_H*.68);
      const dx=proxX-cx,dy=proxY-cy,dist=Math.hypot(dx,dy),radius=165;
      if(dist>=radius){
        look.style.setProperty('--lx','0px');look.style.setProperty('--ly','0px');look.style.setProperty('--lr','0deg');
        return;
      }
      const p=Math.pow(1-dist/radius,1.35);
      const nx=Math.max(-1,Math.min(1,dx/115)),ny=Math.max(-1,Math.min(1,dy/115));
      const scale=tucked?.55:1;
      look.style.setProperty('--lx',`${(nx*2.6*p*scale).toFixed(2)}px`);
      look.style.setProperty('--ly',`${((Math.min(0,ny)*2.2-1.4)*p*scale).toFixed(2)}px`);
      look.style.setProperty('--lr',`${(nx*5.4*p*scale).toFixed(2)}deg`);
    };
    const onGlobalMove=e=>{
      proxX=e.clientX;proxY=e.clientY;
      if(!shown||!look||proxFrame!==null)return;
      proxFrame=requestAnimationFrame(updateProximity);
    };
    const onEditorInput=()=>{
      if(!shown||tucked||petting||densityMedia.matches||!typeBob?.animate)return;
      const now=performance.now();
      if(now-lastTypeAt<150)return;
      lastTypeAt=now;typeDir=-typeDir;
      typeAnim?.cancel();
      typeAnim=typeBob.animate([
        {transform:'translateY(0px) rotate(0deg) scale(1,1)'},
        {transform:`translateY(-2.2px) rotate(${(typeDir*2.1).toFixed(1)}deg) scale(1.016,.984)`,offset:.45},
        {transform:'translateY(0px) rotate(0deg) scale(1,1)'},
      ],{duration:195,easing:'cubic-bezier(.22,1,.36,1)'});
      clearTimeout(typeIdleTimer);
      typeIdleTimer=setTimeout(()=>{if(shown&&!tucked&&!petting)blink(false);},1600);
    };
    const bindEditor=ed=>{
      if(boundEditor===ed)return;
      boundEditor?.removeEventListener('input',onEditorInput);
      boundEditor=ed||null;
      boundEditor?.addEventListener('input',onEditorInput);
    };
    const setShown=next=>{
      if(next===shown)return;
      shown=next;clearTimeout(hideTimer);
      if(!stage)return;
      if(next){
        stage.dataset.tucked=String(tucked);
        if(actor)actor.setAttribute('aria-pressed',String(tucked));
        stage.hidden=false;void stage.offsetHeight;stage.dataset.shown='true';scheduleBlink(420);
      }else{
        hovered=false;setBubbleVisible(false);
        stage.dataset.shown='false';clearTimeout(blinkTimer);clearTimeout(blinkEnd);clearTimeout(holdTimer);clearTimeout(typeIdleTimer);
        if(actor){actor.dataset.blinking='false';actor.dataset.petting='false';}
        pointerDown=false;petting=false;setSquishVars(1,1,0);
        hideTimer=setTimeout(()=>{if(!shown&&stage)stage.hidden=true;},240);
      }
    };
    const isFloatingOverlay=el=>{
      for(let cur=el,hops=0;cur&&cur!==document.body&&cur!==document.documentElement&&hops<10;cur=cur.parentElement,hops++){
        const s=getComputedStyle(cur);
        if(s.position==='fixed'||s.position==='sticky')return true;
        if((s.overflowY==='auto'||s.overflowY==='scroll')&&cur.scrollHeight>cur.clientHeight+4)return false;
      }
      return true;
    };
    const hasCollision=(card,rect)=>{
      for(const c of document.querySelectorAll('button,[role="button"],[role="menu"],[role="listbox"],[role="dialog"]')){
        if(card.contains(c)||c.closest('[hidden],[inert]')||getComputedStyle(c).visibility==='hidden')continue;
        const r=c.getBoundingClientRect();
        if(r.width<=0||r.height<=0)continue;
        const left=Math.max(rect.left,r.left),right=Math.min(rect.right,r.right),top=Math.max(rect.top,r.top),bottom=Math.min(rect.bottom,r.bottom);
        if(right-left<=2||bottom-top<=2)continue;
        if(!isFloatingOverlay(c))continue;
        for(const [x,y] of [[(left+right)/2,(top+bottom)/2],[left+1,top+1],[right-1,bottom-1]]){
          const stack=document.elementsFromPoint?document.elementsFromPoint(x,y):[document.elementFromPoint(x,y)].filter(Boolean);
          const topEl=stack.find(el=>el!==host&&!host?.contains(el));
          if(topEl&&(topEl===c||c.contains(topEl)))return true;
        }
      }
      return false;
    };
    const position=()=>{
      if(disposed||!enabled||!neonMascotPref.enabled||isSuppressed()||!curComp||!curBar?.isConnected||curBar.style.visibility==='hidden'||!isNeon(curComp)){setShown(false);return;}
      const card=findCard(curComp);
      if(!card){setShown(false);return;}
      const cr=card.getBoundingClientRect();
      if(cr.width<320||cr.top<NEON_SH+6||cr.bottom>innerHeight+40||cr.right<NEON_SW+10){setShown(false);return;}
      const left=Math.round(cr.right-6-NEON_SW),top=Math.round(cr.top-NEON_SH+2);
      const rect={left,top,right:left+NEON_SW,bottom:top+NEON_SH};
      if(hasCollision(card,rect)){setShown(false);return;}
      ensureHost();
      stage.style.width=`${NEON_SW}px`;stage.style.height=`${NEON_SH}px`;stage.style.left=`${left}px`;stage.style.top=`${top}px`;
      stage.dataset.theme=curBar.getAttribute('data-pulse-theme')==='dark'?'dark':'light';
      stage.dataset.running=String(/RUNNING/i.test(String(curData?.speed?.status||'')));
      setShown(true);
      if(hovered)updateBubblePos();
    };
    const onVisibility=()=>{if(!document.hidden&&shown)scheduleBlink(600);};
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('pointermove',onGlobalMove,{passive:true});
    return {
      get host(){return host;},
      ownsNode:t=>Boolean(host&&(t===host||host.contains(t))),
      sync(comp,bar,metrics){curComp=comp||null;curBar=bar||null;if(metrics!==undefined)curData=metrics;bindEditor(comp?.editor||null);position();},
      position,
      setEnabled(v){enabled=Boolean(v);position();},
      detach(){curComp=null;bindEditor(null);setShown(false);},
      dispose(){
        document.removeEventListener('visibilitychange',onVisibility);
        window.removeEventListener('pointermove',onGlobalMove);
        bindEditor(null);
        if(proxFrame!==null)cancelAnimationFrame(proxFrame);proxFrame=null;
        squishAnim?.cancel();typeAnim?.cancel();
        clearTimeout(blinkTimer);clearTimeout(blinkEnd);clearTimeout(hideTimer);clearTimeout(holdTimer);clearTimeout(typeIdleTimer);
        shown=false;hovered=false;pointerDown=false;petting=false;curComp=null;curBar=null;curData=null;
        host?.remove();host=null;shadow=null;stage=null;actor=null;look=null;typeBob=null;squish=null;sway=null;sparks=null;bubble=null;
      },
    };
  }
  function createStripInstance(){
  let node=null,root=null,data=null,pending=false,cardName=null,hoverTimer=null,openTimer=null,warmUntil=0,lastConversation=undefined,lastFetch=0,lastExpiredRefresh=0,resizeObserver=null,modelObserver=null,themeController=null,changingCards=false;
  const isWarm=()=>Boolean(cardName||Date.now()<warmUntil);
  let chosen=null,group=null,autoGroupId=null,lastModelSig=null,quotaSigCache=null,quotaObservedAt=0;
  let refreshRequest=null,manualRequest=null,hoverQuotaRequest=null,lastQuotaHoverAt=0,requestEpoch=0,scopeRequestEpoch=0;
  let composer=null,usageDashboard=null,updateMenu=null;
  const neonMascot=createNeonMascot({isSuppressed:()=>Boolean(instDisposed||parked||usageDashboard?.isOpen)});
  let densityFrame=null,densityMotion=null,densityProbe=null;
  let isPrimary=false,parked=false,parkedKind=null,instDisposed=false;
  let emptyCompact=true,hydrated=false,seenEmptySession=false,suppressNextMotion=false,springNextExpand=false;
  const $=id=>root?.getElementById(id);
  const text=(id,value)=>{const e=$(id);if(e&&e.textContent!==String(value))e.textContent=String(value);};
  const conversationId=()=>{
    if(surface&&!surface.useSharedComposer)return surface.conversationId(composer);
    const anchor=composer?.box||composer?.row;
    if(!anchor?.isConnected)return null;
    const readId=element=>{const id=element.getAttribute('data-cascade-id');return GUID.test(id||'')?id.toLowerCase():null;};
    // Full View encloses its input in the conversation owner. Auxiliary panes
    // (subagent tabs or Side Questions) put the owner on a sibling message
    // area. Search only siblings of this input's ancestor path, never other
    // panes or the transcript.
    let budget=96,otherComposer=false;
    const markersIn=(scope,branch)=>{
      const markers=[],stack=[];let evidence=false;
      if(scope.childElementCount-1>budget)return {markers,evidence,limited:true};
      for(const element of scope.children)if(element!==branch)stack.push({element,depth:0});
      while(stack.length){
        if(--budget<0)return {markers,evidence,limited:true};
        const {element,depth}=stack.pop();
        if(element.matches('[data-testid="subagent-tab-conversation"],[data-testid="side-question-conversation"]')){evidence=true;if(visibleHostElement(element))markers.push(element);continue;}
        if(isPulseBar(element)||element.closest('[hidden],[inert]'))continue;
        const css=getComputedStyle(element);if(css.display==='none'||css.visibility==='hidden')continue;
        if(element.matches('[data-testid="conversation-view"]')){
          const hasInner=Array.from(element.querySelectorAll('[data-testid="agent-input-box"]')).some(e=>!isPulseBar(e)&&visibleHostElement(e));
          if(hasInner)otherComposer=true;
          else{evidence=true;if(visibleHostElement(element)&&element.hasAttribute('data-cascade-id'))markers.push(element);}
          continue;
        }
        if(element.matches(PANE_BOUNDARY))continue;
        if(element.matches('[data-testid="agent-input-box"]')){if(visibleHostElement(element))otherComposer=true;continue;}
        if(element.matches('script,style,template,svg'))continue;
        if((element.childElementCount&&depth>=8)||element.childElementCount+stack.length>budget)return {markers,evidence,limited:true};
        for(const child of element.children)stack.push({element:child,depth:depth+1});
      }
      return {markers,evidence,limited:false};
    };
    const previous=sidebarOwners.get(anchor);
    if(previous&&!previous.contains(anchor))sidebarOwners.delete(anchor);
    let branch=null,hops=0;
    for(let scope=anchor;scope&&scope!==document.body&&scope!==document.documentElement;branch=scope,scope=scope.parentElement){
      if(++hops>32)return null;
      // The host may reuse the old sidebar content root for Full View.
      if(scope.matches('[data-testid="conversation-view"]'))return readId(scope);
      if(scope===anchor&&scope.hasAttribute('data-cascade-id'))return readId(scope);
      if(branch){
        const {markers,evidence,limited}=markersIn(scope,branch);
        if(limited&&(composer.kind==='subagent'||scope.closest(PANE_BOUNDARY)))return null;
        if(!limited){
          if(evidence){
            if(!otherComposer)sidebarOwners.set(anchor,scope);
            return !otherComposer&&markers.length===1?readId(markers[0]):null;
          }
          if(otherComposer)return null;
        }
      }
      if(sidebarOwners.get(anchor)===scope)return null;
      if(scope.hasAttribute('data-cascade-id'))return readId(scope);
      if(scope.matches(PANE_BOUNDARY))return fiberCascadeId(anchor,scope);
    }
    const id=location.pathname.match(/\/c\/([0-9a-f-]{36})/i)?.[1];
    return GUID.test(id||'')?id.toLowerCase():null;
  };
  function syncConversation(){
    const id=conversationId();
    if(id===lastConversation)return false;
    const prevId=lastConversation;
    lastConversation=id;requestEpoch++;pending=false;refreshRequest=null;lastFetch=0;
    stopDensityMotion();densityFrame=null;densityProbe=null;
    manualRequest=null;hoverQuotaRequest=null;lastQuotaHoverAt=0;quotaSigCache=null;setQuotaBusy(false);
    emptyCompact=true;springNextExpand=false;suppressNextMotion=false;
    if(!id){hydrated=true;seenEmptySession=true;}
    else if(prevId===null&&seenEmptySession){hydrated=false;}
    else{hydrated=false;seenEmptySession=false;}
    data={connection:'offline',groups:[],speed:null};group=null;hide();
    // Navigation has its own refresh budget. A request from the old composer
    // must neither block the new route nor reset its polling clock on arrival.
    queueMicrotask(()=>{if(!disposed&&!instDisposed)refresh();});return true;
  }
  function paintSpeed(samples,mood,stride,live){
    if(speedStyle.style==='cat'){updateCatBadge($('strip-cat-badge'),mood);updateCatBadge($('card-cat-badge'),'idle');updateSpeedTrail($('speed-trail'),samples,mood,stride);}
    else{updateMinimalBadge($('strip-cat-badge'));updateMinimalBadge($('card-cat-badge'));updateMinimalTrail($('speed-trail'),samples,live);}
  }
  function localize(){
    attribute(node,'lang',language.language);
    for(const e of root.querySelectorAll('[data-i18n]')){const value=t(e.dataset.i18n);if(e.textContent!==value)e.textContent=value;}
    for(const e of root.querySelectorAll('[data-i18n-aria]'))attribute(e,'aria-label',t(e.dataset.i18nAria));
    for(const e of root.querySelectorAll('[data-i18n-aria][title]'))attribute(e,'title',t(e.dataset.i18nAria));
    for(const button of root.querySelectorAll('[data-language-choice]')){attribute(button,'aria-pressed',button.dataset.languageChoice===language.language);attribute(button,'data-save-failed',preferences.error);attribute(button,'title',preferences.error?t('languageSaveFailed'):(button.getAttribute('aria-label')||button.textContent));}
    text('language-save-note',preferences.error?t('languageSaveFailed'):'');
    for(const button of root.querySelectorAll('[data-speed-style-choice]')){const value=button.dataset.speedStyleChoice,name=t(value==='cat'?'styleCat':'styleMinimal'),failed=speedStyle.error&&speedStyle.style===value;attribute(button,'aria-label',name);attribute(button,'title',failed?`${name} · ${t('styleSaveFailed')}`:name);attribute(button,'aria-pressed',speedStyle.style===value);attribute(button,'data-save-failed',failed);}
    const neonBtn=$('neon-mascot-toggle');
    if(neonBtn){const on=neonMascotPref.enabled,tip=t(on?'neonMascotOn':'neonMascotOff');text('neon-mascot-label',t('neonMascot'));attribute(neonBtn,'aria-pressed',String(on));attribute(neonBtn,'aria-label',tip);attribute(neonBtn,'title',neonMascotPref.error?`${tip} · ${t('neonSaveFailed')}`:tip);attribute(neonBtn,'data-save-failed',neonMascotPref.error);}
    const customBtn=$('context-limit-custom-btn'),limitInput=$('context-limit-input');
    if(customBtn){attribute(customBtn,'title',t('contextCustomLimit'));attribute(customBtn,'aria-label',t('contextCustomLimit'));}
    if(limitInput)attribute(limitInput,'placeholder',t('contextCustomPlaceholder'));
    const zh=language.language==='zh-CN',tw=language.language==='zh-TW';
    text('usage-today-label',tw?'今日用量':(zh?'今日用量':'Today'));text('usage-month-label',tw?'本月用量':(zh?'本月用量':'This month'));
    text('usage-open-label',tw?'檢視用量統計':(zh?'查看用量统计':'View token usage'));updateMenu?.localize();
    updateGuide();
  }
  function stopDensityMotion(){
    const motion=densityMotion;densityMotion=null;
    if(!motion)return;
    for(const animation of motion.animations)animation.cancel();
    motion.stage.remove();delete node?.dataset.motion;delete node?.dataset.motionKind;
  }
  function densitySnapshot(previous){
    const pieces=new Map();
    for(const chip of root.querySelectorAll('.bar .chip'))for(const element of chip.children){
      if(!element.getClientRects().length)continue;
      const style=getComputedStyle(element);
      pieces.set(element,{rect:element.getBoundingClientRect(),opacity:1,font:style.font,color:style.color,icon:element.matches('svg,.context-ring')});
    }
    // Read interrupted copies before changing density. Reading them after the
    // final flex layout moves their parent would bake that shift into the new
    // start position and produce a visible jump on reversal.
    if(previous&&densityMotion)for(const [element,visual]of densityMotion.pieces){
      const piece=pieces.get(element)||densityMotion.sources.get(element);
      if(piece)pieces.set(element,{...piece,rect:visual.getBoundingClientRect(),opacity:Number(getComputedStyle(visual).opacity)});
    }
    return {pieces,rect:node.getBoundingClientRect(),model:composer.model,modelRect:previous?.model===composer.model?previous.modelRect:composer.model?.getBoundingClientRect(),row:composer.row};
  }
  function densityBounds(next){
    const row=next.row.getBoundingClientRect(),target=next.rect;
    let left=Math.max(row.left,composer.anchor?.getBoundingClientRect().right||0),right=Math.min(row.right,innerWidth);
    for(const control of document.querySelectorAll('button,[role="button"],a[href],input,select')){
      if(control===next.model||(next.model&&(next.model.contains(control)||control.contains(next.model))))continue;
      const r=control.getBoundingClientRect();
      if(r.width<=0||r.height<=0||Math.min(target.bottom,r.bottom)-Math.max(target.top,r.top)<=1)continue;
      if(control.closest('[hidden],[inert]')||getComputedStyle(control).visibility==='hidden')continue;
      if(!next.row.parentElement?.contains(control)){
        if(Math.min(right,r.right)-Math.max(left,r.left)<=0)continue;
        const x=(Math.max(left,r.left)+Math.min(right,r.right))/2,y=(Math.max(target.top,r.top)+Math.min(target.bottom,r.bottom))/2;
        const hit=document.elementFromPoint(x,y);
        if(!hit||(hit!==control&&!control.contains(hit)))continue;
      }
      if(r.right<=target.left+1)left=Math.max(left,r.right);
      else if(r.left>=target.right-1)right=Math.min(right,r.left);
      else return null;
    }
    return right-left>=target.width-2?{left,right}:null;
  }
  function clipDensityMotion(next){
    if(!densityMotion)return;
    const bounds=densityBounds(next);
    if(!bounds){stopDensityMotion();return;}
    // The ribbon follows its parent 1:1 while dragging. Keep its existing
    // compositor animation and clock; only crop to current safe host bounds.
    const stage=densityMotion.stage,r=stage.getBoundingClientRect(),pad=densityMotion.padTop||0;
    stage.style.clipPath=`inset(${pad?-pad:0}px ${Math.max(0,r.right-bounds.right)}px ${pad?-pad:0}px ${Math.max(0,bounds.left-r.left)}px)`;
  }
  function animateDensity(previous,next,{spring=false}={}){
    // A narrow composer gives its space straight back to native controls. Only
    // inert visual copies move; the real icons immediately have safe hit boxes.
    // Copies share a clipped ribbon with the model selector's reveal, never the
    // send/mic/add controls. Neither flex widths nor host styles are animated.
    const interrupted=densityMotion;
    const modelOpacity=next.model?getComputedStyle(next.model).opacity:'1';
    stopDensityMotion();
    if(!Element.prototype.animate)return;
    const bounds=densityBounds(next);if(!bounds)return;
    const {left,right}=bounds,target=next.rect;
    const reduce=densityMedia.matches,useSpring=spring&&!reduce;
    const duration=spring?(reduce?140:420):(reduce?120:240);
    const padTop=useSpring?2:0;
    const stage=document.createElement('div');stage.className='density-stage';stage.inert=true;stage.setAttribute('aria-hidden','true');
    stage.style.cssText=`left:${left-target.left}px;top:${-padTop}px;width:${right-left}px;height:${target.height+padTop*2}px`;
    root.append(stage);
    const motion={stage,padTop,animations:[],pieces:new Map(),sources:new Map([...previous.pieces,...next.pieces])};
    densityMotion=motion;node.dataset.motion='density';
    if(spring)node.dataset.motionKind='spring';
    const play=(element,frames,options={})=>{const animation=element.animate(frames,{duration,easing:useSpring?densitySpringEase:densityEase,...options});motion.animations.push(animation);return animation;};
    const chipOrder=['speed','cache','context'];
    const chipStartX=new Map();
    if(useSpring){
      for(const [el,piece]of previous.pieces){
        if(!piece.icon)continue;
        const key=el.closest('[data-card]')?.dataset.card;
        if(key)chipStartX.set(key,Math.max(left,Math.min(right-piece.rect.width,piece.rect.left)));
      }
      if(previous.pieces.size&&next.pieces.size){
        const spanOf=map=>{let lo=Infinity,hi=-Infinity;for(const p of map.values()){lo=Math.min(lo,p.rect.left);hi=Math.max(hi,p.rect.right);}return Number.isFinite(lo)?[Math.max(left,lo-5),Math.min(right,hi+5)]:null;};
        const fromSpan=spanOf(previous.pieces),toSpan=spanOf(next.pieces);
        if(fromSpan&&toSpan){
          const fromW=Math.max(12,fromSpan[1]-fromSpan[0]),toW=Math.max(12,toSpan[1]-toSpan[0]);
          const pill=document.createElement('div');pill.className='density-pill';
          pill.style.cssText=`position:absolute;left:${toSpan[0]-left}px;top:${padTop}px;width:${toW}px;height:${target.height}px;border-radius:7px;background:color-mix(in srgb,var(--pulse-accent) 11%,var(--pulse-hover));pointer-events:none;transform-origin:left center`;
          stage.prepend(pill);
          play(pill,[{transform:`translateX(${fromSpan[0]-toSpan[0]}px) scaleX(${fromW/toW})`},{transform:'translateX(0px) scaleX(1)'}],{duration:430,fill:'both'});
          play(pill,[{opacity:0.9,offset:0},{opacity:0.75,offset:0.65},{opacity:0,offset:1}],{duration:460,easing:'ease-out',fill:'both'});
        }
      }
    }
    const maxHold=useSpring?495:duration;
    for(const element of new Set([...previous.pieces.keys(),...next.pieces.keys()])){
      const from=previous.pieces.get(element),to=next.pieces.get(element),piece=to||from;
      const visual=element.cloneNode(true),end=to?.rect||from.rect;
      for(const part of [visual,...visual.querySelectorAll('*')])for(const attribute of [...part.attributes])if(attribute.name==='id'||attribute.name.startsWith('data-')||attribute.name.startsWith('aria-'))part.removeAttribute(attribute.name);
      const endX=Math.max(left,Math.min(right-end.width,end.left)),endY=end.top-target.top+padTop;
      visual.classList.add('density-piece');visual.style.cssText+=`;position:absolute;left:${endX-left}px;top:${endY}px;width:${end.width}px;height:${end.height}px;font:${piece.font};color:${piece.color};margin:0;pointer-events:none;display:block`;
      stage.append(visual);motion.pieces.set(element,visual);
      if(useSpring){
        const cardKey=element.closest('[data-card]')?.dataset.card;
        const chipIdx=Math.max(0,chipOrder.indexOf(cardKey));
        if(from&&to){
          const startX=Math.max(left,Math.min(right-from.rect.width,from.rect.left));
          const dx=startX-endX,dy=from.rect.top-end.top;
          play(visual,[{transform:`translate(${dx}px,${dy}px) scale(0.9)`},{transform:'translate(0,0) scale(1)'}],{delay:chipIdx*22,duration:420,fill:'both'});
        }else if(to){
          const anchor=chipStartX.get(cardKey);
          const idealStart=anchor!==undefined?anchor+Math.max(0,end.left-anchor)*0.35:end.left-14;
          const clampedStart=Math.max(left,Math.min(right-end.width,idealStart));
          const labelDx=clampedStart-endX,delay=24+chipIdx*24;
          play(visual,[{transform:`translate(${labelDx}px,0) scale(0.86)`},{transform:'translate(0,0) scale(1)'}],{delay,duration:420,fill:'both'});
          play(visual,[{opacity:0},{opacity:1}],{delay,duration:220,easing:'ease-out',fill:'both'});
        }else{
          play(visual,[{opacity:from?.opacity??1},{opacity:0}],{duration:100,easing:'ease-out',fill:'both'});
        }
        if(to)play(element,[{opacity:0},{opacity:0}],{duration:maxHold,easing:'linear',fill:'both'});
        continue;
      }
      const start=from?.rect||end;
      const startX=Math.max(left,Math.min(right-start.width,start.left));
      const dx=reduce?0:startX-endX,dy=reduce?0:start.top-end.top;
      const startOpacity=from?.opacity??0,endOpacity=to?1:0;
      play(visual,[{transform:`translate(${dx}px,${dy}px)`,opacity:startOpacity},{transform:'translate(0,0)',opacity:endOpacity}],{fill:'both',...(piece.icon?{}:{duration:to?duration:80})});
      if(to)play(element,[{opacity:0},{opacity:0}],{fill:'both'});
    }
    // The host model name often goes from a caret to a full label as space is
    // returned. Let the outgoing labels leave before revealing that name.
    if(next.model&&previous.model===next.model&&(Math.abs(next.modelRect.width-previous.modelRect.width)>8||interrupted&&Number(modelOpacity)<.999)){
      play(next.model,[{opacity:interrupted?modelOpacity:0},{opacity:1}],{delay:reduce||interrupted?0:100,duration:reduce?120:interrupted?240:140,easing:densityEase,fill:'backwards'});
    }
    const finish=play(stage,[{opacity:1},{opacity:1}],{duration:maxHold,easing:'linear'});
    finish.onfinish=()=>{if(densityMotion===motion){stopDensityMotion();position();}};
  }
  function fit(){
    if(!node?.isConnected||parked||!composer)return;
    // A modal owns input while open. Composer collision scans behind its
    // backdrop cannot improve its layout and can hide its hosting strip.
    if(usageDashboard?.isOpen){stopDensityMotion();return;}
    reserveNativeSpace();
    const bar=root.querySelector('.bar'),oldDensity=node.dataset.density,oldReady=node.dataset.layout==='ready';
    let previous=densityFrame;
    if(['compact','narrow','context-only'].some(c=>node.classList.contains(c)))node.classList.remove('compact','narrow','context-only');
    // Flex shrink alone does not constrain nowrap children or protect controls
    // positioned outside the flex flow (e.g. Agent Manager window buttons).
    const fits=()=>{
      const rect=node.getBoundingClientRect(),row=composer.row.getBoundingClientRect();
      const intersects=other=>Math.min(rect.right,other.right)-Math.max(rect.left,other.left)>1&&Math.min(rect.bottom,other.bottom)-Math.max(rect.top,other.top)>1;
      if(bar.scrollWidth>bar.clientWidth+2||rect.width<=0||rect.left< -1||rect.right>innerWidth+1||rect.top< -1||rect.bottom>innerHeight+1||rect.left<row.left-1||rect.right>row.right+1)return false;
      if(!nativeComfortable())return false;
      if(composer.kind==='subagent'&&intersects(composer.anchor.getBoundingClientRect()))return false;
      for(const control of document.querySelectorAll('button,[role="button"],a[href],input,select,[contenteditable="true"]')){
        const other=control.getBoundingClientRect();
        if(other.width<=0||other.height<=0||!intersects(other))continue;
        if(control.closest('[hidden],[inert]')||getComputedStyle(control).visibility==='hidden')continue;
        // Scrolling messages can put clipped/covered links underneath the
        // fixed composer. Their rectangles alone are not a visible collision.
        // Always reserve local actions; other controls must actually paint at
        // the intersection (e.g. a floating jump-to-bottom button).
        if(composer.row.parentElement?.contains(control))return false;
        const left=Math.max(rect.left,other.left),right=Math.min(rect.right,other.right),top=Math.max(rect.top,other.top),bottom=Math.min(rect.bottom,other.bottom);
        for(const [x,y]of [[(left+right)/2,(top+bottom)/2],[left+.5,top+.5],[right-.5,top+.5],[left+.5,bottom-.5],[right-.5,bottom-.5]]){
          const hit=document.elementFromPoint(x,y);
          if(hit&&(hit===control||control.contains(hit)))return false;
        }
      }
      return true;
    };
    let safe=false;
    const rowWidth=composer.row.getBoundingClientRect().width;
    const probeKey=()=>{const s=getComputedStyle(node);return node.style.cssText.replace(/--pulse-native-room:[^;]+;?/g,'')+'|'+s.fontFamily+'|'+s.fontSize+'|'+language.language+'|'+lastConversation+'|'+bar.textContent+'|'+$('dot').className+'|'+getComputedStyle(composer.row).gap+'|'+Array.from(composer.row.querySelectorAll('button,[role="button"],a[href],input,select')).filter(c=>c!==composer.model&&!(composer.model&&c.contains(composer.model))).map(c=>c.getBoundingClientRect().width).join(',');};
    if(emptyCompact){
      if(!node.classList.contains('icons-only')){if(oldReady)previous=densitySnapshot(previous);node.classList.add('icons-only');}
      densityProbe=null;safe=fits();
    }else{
      safe=fits();
      if(oldDensity==='icons'){
        const key=probeKey();
        // Twelve pixels of recovery headroom prevents threshold chatter. Shrinking
        // or scrolling in icon mode never toggles back to full just to measure it.
        if(!densityProbe||key!==densityProbe.key||rowWidth>=densityProbe.width+12){
          previous=densitySnapshot(previous);node.classList.remove('icons-only');safe=fits();
          if(!safe){node.classList.add('icons-only');safe=fits();densityProbe={key,width:rowWidth};}
          else densityProbe=null;
        }
      }else if(!safe){
        previous=densitySnapshot(previous);node.classList.add('icons-only');safe=fits();densityProbe={key:probeKey(),width:rowWidth};
      }
    }
    node.dataset.density=node.classList.contains('icons-only')?'icons':'full';
    const state=safe?'ready':'blocked';
    if(node.dataset.layout!==state){node.dataset.layout=state;node.inert=!safe;if(!safe)hide();}
    const skipMotion=suppressNextMotion;suppressNextMotion=false;
    const useSpring=springNextExpand&&node.dataset.density==='full';
    if(node.dataset.density==='full'||!safe)springNextExpand=false;
    const changed=safe&&oldReady&&previous?.row===composer.row&&oldDensity!==node.dataset.density;
    const next=changed?densitySnapshot():{rect:node.getBoundingClientRect(),model:composer.model,modelRect:composer.model?.getBoundingClientRect(),row:composer.row};
    if(changed&&!skipMotion)animateDensity(previous,next,{spring:useSpring});
    else if(!safe||previous?.row!==composer.row||previous?.model!==composer.model||(changed&&skipMotion))stopDensityMotion();
    else if(densityMotion)clipDensityMotion(next);
    densityFrame=next;
    updateGuide();
  }
  function nativeComfortable(){
    const baseline=composer.native;
    if(!baseline)return true;
    if(composer.branch.getBoundingClientRect().height>baseline.height+1)return false;
    if(baseline.icons.some(({icon,width})=>icon.isConnected&&icon.getBoundingClientRect().width<width-.5))return false;
    if(composer.kind==='ide'&&composer.branch.getBoundingClientRect().width<baseline.reserve-1)return false;
    if(composer.kind==='subagent'){
      if(composer.branch.getBoundingClientRect().width<baseline.reserve-1)return false;
      const lines=new Set(badgeTextRects(composer.anchor).map(r=>Math.round(r.top)));
      if(lines.size>1)return false;
    }
    return true;
  }
  function reserveNativeSpace(){
    if(!['subagent','ide'].includes(composer.kind)){if(node.style.getPropertyValue('--pulse-native-room'))node.style.removeProperty('--pulse-native-room');if(node.classList.contains('native-no-room'))node.classList.remove('native-no-room');return;}
    const row=composer.row,style=getComputedStyle(row),siblings=Array.from(row.children).filter(e=>e!==node&&e!==composer.branch&&e.getClientRects().length);
    const room=row.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)-composer.native.reserve-siblings.reduce((sum,e)=>{const s=getComputedStyle(e);return sum+e.getBoundingClientRect().width+(parseFloat(s.marginLeft)||0)+(parseFloat(s.marginRight)||0);},0)-(parseFloat(style.columnGap)||0)*(siblings.length+1)-10;
    const width=`${Math.max(0,Math.floor(room))}px`;if(node.style.getPropertyValue('--pulse-native-room')!==width)node.style.setProperty('--pulse-native-room',width);
    // A hidden ribbon must release its flex space as well as its hit targets.
    // The budget is independent of our own rectangle, so it recovers directly
    // when the sidebar is closed, without probing the native badge each frame.
    node.classList.toggle('native-no-room',room<76);
  }
  function currentModelTrigger(){
    const trigger=composer?.model?.isConnected?composer.model:(composer?.branch||composer?.row)?.querySelector('[data-testid="model-selector-trigger"]');
    if(trigger&&composer&&trigger!==composer.model)composer.model=trigger;
    return trigger||null;
  }
  function composerModelSignature(){
    const trigger=currentModelTrigger();
    if(!trigger)return null;
    return `${trigger.getAttribute('aria-label')||''}\n${trigger.getAttribute('title')||''}\n${trigger.textContent||''}`;
  }
  function currentComposerModel(){
    const trigger=currentModelTrigger();
    if(!trigger)return '';
    const tagged=[trigger.getAttribute('aria-label'),trigger.getAttribute('title'),trigger.textContent].map(cleanModelText).filter(Boolean);
    const matched=tagged.find(c=>language.quotaGroupKind({name:c}));
    if(matched)return matched;
    return [trigger.textContent,trigger.getAttribute('title'),trigger.getAttribute('aria-label')].map(cleanModelText).find(Boolean)||'';
  }
  function syncModelChoice({renderNow=true}={}){
    const sig=composerModelSignature();
    if(sig===null){lastModelSig=null;return false;}
    if(lastModelSig===null){lastModelSig=sig;return false;}
    if(sig===lastModelSig)return false;
    const hadValue=Boolean(lastModelSig.replace(/\s+/g,''));
    lastModelSig=sig;chosen=null;
    neonMascot.position();
    if(renderNow&&data)render();
    return hadValue;
  }
  function observeComposer(){
    resizeObserver?.disconnect();
    resizeObserver??=new ResizeObserver(scheduleLayout);
    for(const element of new Set([node,composer.row,composer.row.parentElement,composer.branch,composer.editor]))resizeObserver.observe(element);
    modelObserver?.disconnect();
    const targets=new Set([composer.row,composer.model].filter(Boolean));
    if(targets.size){
      modelObserver??=new MutationObserver(records=>{
        if(!records.some(r=>!isOwnNode(r.target)))return;
        if(syncModelChoice({renderNow:true})&&!pending&&node?.isConnected)void refresh();
      });
      for(const target of targets)modelObserver.observe(target,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','data-testid']});
    }
  }
  // Pointer clicks and dialog focus restoration leave buttons focused after
  // the pointer departs. Only keyboard-visible focus keeps a card engaged.
  // The explicit first-use action moves focus into language choices. Keep
  // that guided destination available until the user chooses or leaves it.
  const cardEngaged=()=>Boolean(root?.activeElement?.matches(':focus-visible')||(!$('context-limit-editor')?.hidden&&root?.activeElement===$('context-limit-input'))||(guideOpened&&!guideDismissed&&cardName==='context'&&root?.activeElement?.matches('[data-language-choice]'))||node?.matches(':hover')||root?.querySelector('.card:not([hidden]):hover'));
  function cardVisibility(element,visible){
    if(visible){hidden(element,false);if(element.hasAttribute('popover')&&!element.matches(':popover-open'))element.showPopover();}
    else {if(element.hasAttribute('popover')&&element.matches(':popover-open'))element.hidePopover();hidden(element,true);}
  }
  let cardSide=null;
  function hide({keepWarm=false}={}){
    clearTimeout(openTimer);openTimer=null;
    clearTimeout(hoverTimer);hoverTimer=null;
    if(!keepWarm)warmUntil=0;
    changingCards=true;
    try{cardName=null;cardSide=null;for(const e of root?.querySelectorAll('[data-card]')||[])e.setAttribute('aria-expanded','false');for(const e of root?.querySelectorAll('.card')||[])cardVisibility(e,false);}
    finally{changingCards=false;}
    updateGuide();
  }
  function show(name){
    if(disposed||instDisposed||parked||!node?.isConnected||changingCards||usageDashboard?.isOpen||node.dataset.layout==='blocked')return;
    for(const other of instances)if(other.node!==node)other.hide();
    clearTimeout(hoverTimer);hoverTimer=null;
    clearTimeout(openTimer);openTimer=null;
    if(cardName!==name)cardSide=null;
    cardName=name;warmUntil=0;
    for(const e of root.querySelectorAll('[data-card]'))e.setAttribute('aria-expanded',String(e.dataset.card===name));
    changingCards=true;
    try{for(const e of root.querySelectorAll('.card'))cardVisibility(e,e.id===`${name}-card`);}
    finally{changingCards=false;}
    updateGuide();
    position();
    if(name==='context')void hoverQuotaRefresh();
  }
  function hoverChip(name){
    clearTimeout(hoverTimer);
    if(name==='context')void hoverQuotaRefresh();
    if(isWarm()){
      clearTimeout(openTimer);openTimer=null;
      show(name);
    }else{
      clearTimeout(openTimer);
      const anchor=node,chip=root?.querySelector(`[data-card="${name}"]`),editor=composer?.editor,conversation=conversationId();
      openTimer=setTimeout(()=>{
        openTimer=null;
        // A host route/composer replacement can detach the chip without a
        // pointerleave. Never show a stale or disconnected top-layer popover.
        if(disposed||instDisposed||parked||node!==anchor||!anchor?.isConnected||!chip?.isConnected||!chip.matches(':hover')||composer?.editor!==editor||conversationId()!==conversation)return;
        show(name);
      },HOVER_DELAY);
    }
  }
  function leaveChip(){
    clearTimeout(openTimer);openTimer=null;
  }
  function scheduleHide(){
    clearTimeout(openTimer);openTimer=null;
    clearTimeout(hoverTimer);
    // Measure the warm window from pointer departure, not the later hide.
    if(cardName)warmUntil=Date.now()+WARM_WINDOW;
    hoverTimer=setTimeout(()=>{hoverTimer=null;if(!cardEngaged())hide({keepWarm:true});},LEAVE_DELAY);
  }
  function position(){
    positionGuide();neonMascot.position();
    if(!cardName)return;
    const button=root.querySelector(`[data-card="${cardName}"]`),card=$(`${cardName}-card`),rect=button.getBoundingClientRect();
    const width=Math.min(312,window.innerWidth-24);style(card,'width',`${width}px`);
    const roomAbove=rect.top-21,roomBelow=window.innerHeight-rect.bottom-21;
    style(card,'overflow-y','auto');
    style(card,'left',`${Math.min(window.innerWidth-width-12,Math.max(12,rect.left+rect.width/2-width/2))}px`);
    // scrollHeight includes clipped content. Expanding maxHeight to measure it
    // on every poll used to reset scrollTop and then shrink the card again.
    const height=card.scrollHeight+card.offsetHeight-card.clientHeight;
    const useAbove=cardSide?cardSide==='above':(height<=roomAbove || roomAbove>=roomBelow);
    cardSide=useAbove?'above':'below';
    style(card,'max-height',`${Math.max(80,useAbove?roomAbove:roomBelow)}px`);
    style(card,'top',`${Math.max(12,useAbove?rect.top-card.offsetHeight-9:rect.bottom+9)}px`);
  }
  function positionGuide(){
    const tip=$('language-guide'),button=root?.querySelector('[data-card="context"]');
    if(!tip||tip.hidden||!button)return;
    const rect=button.getBoundingClientRect(),width=Math.min(244,innerWidth-24);
    style(tip,'width',`${width}px`);
    const left=Math.max(12,Math.min(innerWidth-width-12,rect.left+rect.width/2-width/2));
    style(tip,'left',`${left}px`);
    style(tip,'--guide-anchor',`${Math.max(16,Math.min(width-16,rect.left+rect.width/2-left))}px`);
    const above=rect.top-22,below=innerHeight-rect.bottom-22,height=tip.scrollHeight+tip.offsetHeight-tip.clientHeight,useAbove=height<=above||above>=below;
    style(tip,'max-height',`${Math.max(80,useAbove?above:below)}px`);
    style(tip,'top',`${Math.max(12,useAbove?rect.top-tip.offsetHeight-10:rect.bottom+10)}px`);
    attribute(tip,'data-side',useAbove?'above':'below');
  }
  function updateGuide(){
    const tip=$('language-guide');if(!tip)return;
    const tw=language.language==='zh-TW',hint=tip.querySelector('#guide-open span[lang]');
    const heading=tip.querySelector('.guide-heading strong span'),headingText=tw?'/ 語言':'/ 语言',hintText=tw?'在上下文詳細資料中切換語言':'在上下文详情中切换语言';
    if(heading.textContent!==headingText)heading.textContent=headingText;
    attribute(hint,'lang',tw?'zh-TW':'zh-CN');if(hint.textContent!==hintText)hint.textContent=hintText;
    attribute($('guide-close'),'aria-label',tw?'Dismiss language tip / 關閉語言提示':'Dismiss language tip / 关闭语言提示');
    const visible=!disposed&&!instDisposed&&!parked&&isPrimary&&guideReady&&!guideDismissed&&!guideOpened&&!cardName&&node?.isConnected&&['main','ide'].includes(composer?.kind)&&node.dataset.layout==='ready'&&node.style.visibility!=='hidden';
    const entering=visible&&tip.hidden;
    cardVisibility(tip,visible);
    const button=root.querySelector('[data-card="context"]');
    if(visible){if(button.getAttribute('aria-describedby')!=='language-guide')button.setAttribute('aria-describedby','language-guide');}else if(button.hasAttribute('aria-describedby'))button.removeAttribute('aria-describedby');
    text('guide-save-note',guideError?(tw?'Could not save. Please retry. / 未能儲存，請重試。':'Could not save. Please retry. / 未能保存，请重试。'):'');
    $('guide-close').disabled=guideSaving;
    positionGuide();
    if(entering)tip.animate([{opacity:0,transform:`translateY(${tip.dataset.side==='above'?'4':'-4'}px)`},{opacity:1,transform:'translateY(0)'}],{duration:160,easing:'cubic-bezier(0.23,1,0.32,1)'});
  }
  async function dismissGuide(){
    if(guideSaving)return;guideSaving=true;guideError=false;updateGuide();
    try{const value=await window.agPulseHost.setPreferences({languageGuideDismissed:true});if(value?.languageGuideDismissed!==true||value.error)throw new Error('Guide not saved');syncGuide(value);preferences.sync(value);}
    catch{guideError=true;}
    finally{guideSaving=false;updateGuide();}
  }
  function park(){
    if(composer?.kind)parkedKind=composer.kind;
    stopDensityMotion();densityFrame=null;densityProbe=null;composer=null;resizeObserver?.disconnect();modelObserver?.disconnect();neonMascot.detach();
    if(!node)return;
    parked=true;hide();node.dataset.layout='blocked';
    if(node.parentElement!==document.body){document.body.append(node);themeController?.update();}
    usageDashboard?.restoreModal();
  }
  function dispose(){
    instDisposed=true;requestEpoch++;pending=false;refreshRequest=null;manualRequest=null;hoverQuotaRequest=null;
    clearTimeout(hoverTimer);clearTimeout(openTimer);stopDensityMotion();densityFrame=null;densityProbe=null;composer=null;
    resizeObserver?.disconnect();modelObserver?.disconnect();neonMascot.dispose();themeController?.dispose();hide();
    usageDashboard?.dispose();usageDashboard=null;updateMenu?.dispose();updateMenu=null;themeController=null;
    node?.remove();node=null;root=null;
  }
  function mountTo(found){
    if(disposed||instDisposed)return;
    parked=false;parkedKind=found.kind;
    found.native=composer?.branch===found.branch&&composer?.anchor===found.anchor?composer.native:captureNative(found);
    if(found.kind==='ide')found.native.reserve=surface.nativeReserve(found);
    const prevModel=composer?.model;
    composer=found;
    const modelChanged=syncModelChoice({renderNow:false});
    const convChanged=syncConversation();
    if(node&&(convChanged||(modelChanged&&data)))render();
    const {row,branch}=found;
    if(node)node.dataset.scope=found.kind;
    if(node?.isConnected&&node.parentElement===row&&node.previousElementSibling===branch){if(found.model&&found.model!==prevModel)observeComposer();neonMascot.sync(composer,node,data);return;}
    if(node){
      stopDensityMotion();densityFrame=null;densityProbe=null;hide();
      row.insertBefore(node,branch.nextSibling);observeComposer();
      themeController?.dispose();themeController=theme.attach(node,{embedded:true,onChange:()=>{if(!disposed&&!instDisposed)scheduleLayout();}});
      if(data?.theme)themeController.setHostTheme(data.theme);
      usageDashboard?.restoreModal?.();
      neonMascot.sync(composer,node,data);fit();position();
      return;
    }
    resizeObserver?.disconnect();modelObserver?.disconnect();node=document.createElement('div');
    node.classList.add('icons-only');
    node.dataset.agPulseBar='true';
    node.dataset.scope=found.kind;
    node.style.cssText='display:flex;align-items:center;flex:0 1 auto;min-width:0;max-width:min(100%,var(--pulse-native-room,100%));height:28px;margin:0 5px;position:relative;';
    root=node.attachShadow({mode:'open'});
    setMarkup(root,`<style>${theme.shadowCss()}
      :host{color-scheme:var(--pulse-scheme);font-family:var(--pulse-font,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif);color:var(--pulse-foreground);font-size:11px}*{box-sizing:border-box}button,select{font:inherit}button{cursor:pointer}svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round;flex:none}button:focus-visible,select:focus-visible{outline:2px solid var(--pulse-accent);outline-offset:2px}
      .bar{display:flex;justify-content:flex-start;width:100%;align-items:center;gap:6px;min-height:28px;padding:2px 0;overflow:clip;min-width:0;max-width:100%}.chip{display:flex;align-items:center;gap:4px;min-width:0;color:var(--pulse-chip);background:none;border:0;border-radius:5px;padding:3px 5px;font-size:11px;white-space:nowrap;line-height:18px}.chip:hover,.chip[aria-expanded=true]{background:var(--pulse-hover);color:var(--pulse-hover-text)}.chip strong{font-weight:550;font-variant-numeric:tabular-nums}.dim{color:var(--pulse-muted)}.countdown{font-size:11px;font-variant-numeric:tabular-nums}.dot{width:4px;height:4px;background:var(--pulse-dot);border-radius:50%;flex:none}.dot.live{background:var(--pulse-success)}.dot.stale{background:var(--pulse-warning)}.group{color:var(--pulse-muted);font-size:11px;margin-right:1px}
      .card{position:fixed;inset:auto;margin:0;z-index:2147483000;padding:11px 14px;border-radius:12px;background:var(--pulse-card);box-shadow:0 6px 20px var(--pulse-shadow);border:1px solid var(--pulse-border);color:var(--pulse-foreground);font-size:12px}.card::backdrop{background:transparent;pointer-events:none}.card[hidden]{display:none}dl{margin:0}dl>[hidden]{display:none}
      .heading{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:8px;margin-bottom:7px;border-bottom:1px solid var(--pulse-separator);font-weight:600;font-size:11px}.heading>span{display:flex;align-items:center;gap:6px}.hero-label{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;color:var(--pulse-muted)}.tag{font-size:11px;font-weight:400;color:var(--pulse-muted);white-space:nowrap}.heading .tag{max-width:52%;overflow:hidden;text-overflow:ellipsis}.tag:empty{display:none}
      .footnote{font-size:12px;color:var(--pulse-subtle);line-height:1.5;margin:8px 0 0}.footnote[hidden]{display:none}
      .track{height:4px;border-radius:999px;background:var(--pulse-track);margin:8px 0 0;overflow:hidden}.track i{height:100%;display:block;border-radius:999px;background:var(--pulse-accent);width:0}
      .quota-spotlight-head{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 auto}.quota-spotlight-head[hidden]{display:none}.spot-dot{width:6px;height:6px;border-radius:50%;background:var(--pulse-accent);flex:none}.spot-name{font-size:12px;font-weight:600;color:var(--pulse-foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pace-badge{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:500;line-height:15px;white-space:nowrap;color:var(--pulse-label);background:var(--pulse-control);font-variant-numeric:tabular-nums}.pace-badge[hidden]{display:none}.pace-dot{width:5px;height:5px;border-radius:50%;background:var(--pulse-muted);flex:none}
      .pace-badge[data-pace=exhaust]{color:var(--pulse-warning);background:color-mix(in srgb,var(--pulse-warning) 14%,transparent)}.pace-badge[data-pace=exhaust] .pace-dot,.pace-badge[data-pace=tight] .pace-dot{background:var(--pulse-warning)}
      .pace-badge[data-critical=true]{color:var(--pulse-danger);background:color-mix(in srgb,var(--pulse-danger) 14%,transparent)}.pace-badge[data-critical=true] .pace-dot{background:var(--pulse-danger)}
      .pace-badge[data-pace=ok] .pace-dot{background:var(--pulse-success)}
      .quota-section .quota-track{position:relative;height:6px;overflow:hidden}.quota-track .track-actual,.quota-track .track-forecast{position:absolute;left:0;top:0;height:100%}.quota-track .track-actual{border-radius:999px}.quota-track .track-forecast{width:0;border-radius:0 999px 999px 0;background:repeating-linear-gradient(-45deg,var(--pulse-card) 0 1.5px,transparent 1.5px 4px);opacity:.8;pointer-events:none}
      .quota-forecast{display:flex;align-items:center;gap:8px;margin-top:4px;font-size:11px;line-height:14px;color:var(--pulse-muted);font-variant-numeric:tabular-nums}.quota-forecast[hidden]{display:none}.forecast-main{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.forecast-main[data-alert=true]{color:var(--pulse-warning);font-weight:500}
      .quota-usage{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:3px;font-size:11px;line-height:14px;color:var(--pulse-muted);font-variant-numeric:tabular-nums}.quota-usage[hidden]{display:none}.quota-usage-val{color:var(--pulse-label);font-weight:500;text-align:right}
      .quota-siblings{display:flex;flex-direction:column;gap:4px;margin-top:7px;padding-top:7px;border-top:1px solid var(--pulse-separator)}.quota-siblings[hidden]{display:none}
      .quota-sibling{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:5px 7px;border:1px solid transparent;border-radius:6px;background:var(--pulse-control);color:var(--pulse-label);font-size:11px;line-height:15px;text-align:left;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease}.quota-sibling:hover{background:var(--pulse-hover);border-color:var(--pulse-border);color:var(--pulse-foreground)}
      .sibling-label{display:inline-flex;align-items:center;gap:5px;min-width:0;flex:1 1 auto;font-weight:500}.sibling-dot{width:5px;height:5px;border-radius:50%;background:var(--pulse-muted);opacity:.65;flex:none}.sibling-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .sibling-metrics{display:inline-flex;align-items:center;gap:8px;flex:none;font-variant-numeric:tabular-nums}.sibling-win{display:inline-flex;align-items:center;gap:4px}.sibling-tag{color:var(--pulse-muted)}.sibling-val{color:var(--pulse-foreground);font-weight:550}.sibling-bar{display:block;width:24px;height:3px;border-radius:999px;background:var(--pulse-track);overflow:hidden}.sibling-bar i{display:block;height:100%;width:0;border-radius:999px;background:color-mix(in srgb,var(--pulse-muted) 65%,var(--pulse-foreground))}
      .refresh{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:5px;color:var(--pulse-muted);border:0;background:transparent;padding:0}.refresh:hover{color:var(--pulse-foreground);background:var(--pulse-hover)}.refresh[aria-busy=true]{color:var(--pulse-emphasis);cursor:wait}.refresh[aria-busy=true] svg{animation:pulse-refresh-spin 1s linear infinite;transform-origin:center}
      .quota-spinner{width:14px;height:14px;border-radius:4px;pointer-events:none;flex:none}.quota-spinner[hidden]{display:none}
      @keyframes pulse-refresh-spin{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:reduce){.refresh[aria-busy=true] svg{animation:none;opacity:.65}}
      .reset{color:var(--pulse-emphasis)}.rounds,.group,.dot.live{display:none}.chip[hidden]{display:none}
      :host(.compact) .countdown{display:none}:host(.narrow) .cache-total,:host(.narrow) [data-card="cache"] .dim,:host(.narrow) .chip svg,:host(.narrow) .context-label{display:none}:host(.narrow) .chip{padding:2px 3px;font-size:11px}:host(.narrow) .bar{gap:1px}
      :host(.icons-only) .bar{gap:2px}:host(.icons-only) .chip{flex:0 0 24px;width:24px;min-width:24px;height:24px;padding:0;gap:0;justify-content:center}:host(.icons-only) .chip:focus-visible{outline-offset:-2px}:host(.icons-only) .chip>:not(svg):not(.context-ring){display:none}:host(.icons-only) .bar>.dot{display:none}
      :host([data-layout=blocked]){visibility:hidden!important;pointer-events:none!important}:host(.native-no-room){flex:0 0 0px!important;width:0!important;max-width:0!important;margin:0!important}
      .density-stage{position:absolute;overflow:clip;pointer-events:none;user-select:none}.density-piece{pointer-events:none!important}
      .scope-note{margin:6px 0 0;color:var(--pulse-muted);font-size:11px}:host([data-scope=main]) .scope-note,:host([data-scope=ide]) .scope-note{display:none}
      .context-ring{display:inline-block;flex:none;width:12px;height:12px;border-radius:50%;background:conic-gradient(var(--ring-color,var(--pulse-ring)) var(--used-angle,0deg),var(--pulse-ring-track) 0);mask:radial-gradient(circle,transparent 43%,#000 47%)}
      .collection-notice{margin:8px 0 0;padding:7px 0;border-top:1px solid var(--pulse-separator);border-bottom:1px solid var(--pulse-separator);font-size:11px;line-height:1.5}.collection-notice[hidden]{display:none}.collection-notice div{margin:2px 0}.collection-notice summary{cursor:pointer;color:var(--pulse-label)}.collection-notice a{color:var(--pulse-emphasis);text-decoration:underline}.collection-notice strong{color:var(--pulse-warning)}.collection-state::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--pulse-warning);margin-right:6px;vertical-align:1px}
      :host(:not([data-collection=limited])) .collection-warning{display:none!important}.collection-warning,.collection-processing{display:none}.collection-label{display:none}:host([data-collection=limited]) [data-card=cache]{color:var(--pulse-warning)}:host([data-collection=limited]) [data-card=cache]>svg:first-child{display:none}:host([data-collection=limited]) [data-card=cache]>.collection-warning{display:block}:host([data-collection=limited]) [data-card=cache]>:not(svg){display:none}:host([data-collection=limited]) [data-card=cache]>.collection-label{display:inline}:host([data-collection=limited].icons-only) [data-card=cache]>.collection-label{display:none}
      :host([data-collection=processing]) .collection-state::before{background:var(--pulse-emphasis)}:host([data-collection=processing]) .collection-notice strong,:host([data-collection=processing]) [data-card=cache]{color:var(--pulse-emphasis)}:host([data-collection=processing]) [data-card=cache]>svg:first-child,:host([data-collection=processing]) [data-card=cache]>:not(svg){display:none}:host([data-collection=processing]) [data-card=cache]>.collection-processing{display:block}:host([data-collection=processing]) [data-card=cache]>.collection-label{display:inline}:host([data-collection=processing].icons-only) [data-card=cache]>.collection-label{display:none}:host(:not([data-collection=processing])) .collection-processing{display:none!important}
      [data-card=cache]{position:relative}[data-card=cache][data-task-current-only=true]::after{content:'!';position:absolute;top:0;left:13px;z-index:1;width:9px;height:9px;border-radius:50%;background:var(--pulse-warning);color:var(--pulse-background);font-size:7px;font-weight:700;line-height:9px;text-align:center;pointer-events:none}
      #transcript-details{margin-top:10px;border-top:1px solid var(--pulse-separator);padding-top:9px}#transcript-details summary{cursor:pointer;font-size:11px;color:var(--pulse-label)}#transcript-total{float:right;margin-left:8px;font-variant-numeric:tabular-nums;color:var(--pulse-foreground);font-size:11px}
      :host{--cat:var(--pulse-accent);--cat-shade:color-mix(in srgb,var(--pulse-accent) 70%,var(--pulse-background));--cat-light:color-mix(in srgb,var(--pulse-accent) 18%,var(--pulse-foreground));--cat-outline:color-mix(in srgb,var(--pulse-accent) 28%,var(--pulse-background));--cat-pink:color-mix(in srgb,var(--pulse-emphasis) 55%,var(--pulse-foreground));--cat-eye:var(--pulse-background);--cat-whisker:color-mix(in srgb,var(--pulse-accent) 32%,var(--pulse-foreground));--cat-tip:var(--pulse-emphasis);--cat-tint:color-mix(in srgb,var(--pulse-accent) 15%,transparent)}
      :host([data-pulse-theme="light"]){--cat-shade:color-mix(in srgb,var(--pulse-accent) 72%,var(--pulse-foreground));--cat-light:color-mix(in srgb,var(--pulse-accent) 16%,#fff);--cat-outline:color-mix(in srgb,var(--pulse-accent) 28%,var(--pulse-foreground));--cat-eye:var(--pulse-foreground);--cat-whisker:color-mix(in srgb,var(--pulse-accent) 38%,var(--pulse-foreground));--cat-tint:color-mix(in srgb,var(--pulse-accent) 12%,transparent)}
      svg.cat-badge{width:16px;height:10px;fill:none;stroke:none;stroke-width:0;overflow:visible}svg.dashboard-speed-trail{display:block;width:140px;height:54px;flex:0 1 140px;max-width:48%;fill:none;stroke:none;stroke-width:0;overflow:visible}
      .dashboard-cat rect,.dashboard-cat path,.dashboard-speed-line,.dashboard-speed-area{shape-rendering:crispEdges}
      .speed-stop-start{stop-color:color-mix(in srgb,var(--pulse-accent) 42%,var(--pulse-muted))}.speed-stop-mid{stop-color:var(--pulse-accent)}.speed-stop-end{stop-color:var(--pulse-emphasis)}
      .dashboard-speed-base{stroke:var(--pulse-border);stroke-width:1}.dashboard-speed-peak{stroke:var(--pulse-muted);stroke-width:1;stroke-dasharray:2 2;opacity:.55}.dashboard-speed-line{fill:none;stroke:url(#ag-pulse-prism);stroke-width:2;stroke-linecap:butt;stroke-linejoin:miter}.dashboard-speed-area{fill:var(--cat-tint);stroke:none}
      .dashboard-cat-body{fill:var(--cat)}.dashboard-cat-shade{fill:var(--cat-shade)}.dashboard-cat-light{fill:var(--cat-light)}.dashboard-cat-outline{fill:var(--cat-outline)}.dashboard-cat-pink{fill:var(--cat-pink)}.dashboard-cat-eye{fill:var(--cat-eye)}.dashboard-cat-hl{fill:#fff}.dashboard-cat-whisker{fill:var(--cat-whisker)}.dashboard-cat-tip{fill:var(--cat-tip)}
      .dashboard-cat-badge-eyes rect{transform-box:fill-box;transform-origin:center}.cat-mood-sleep .dashboard-cat-badge-eyes rect{transform:scaleY(.5)}
      .dashboard-cat-frame{opacity:0}.dashboard-clawd-streaks line{stroke-width:1.2;stroke-linecap:round}.dashboard-cat .dashboard-clawd-streaks line:nth-child(1){stroke:var(--pulse-emphasis)}.dashboard-cat .dashboard-clawd-streaks line:nth-child(2){stroke:var(--pulse-accent)}.dashboard-cat .dashboard-clawd-streaks line:nth-child(3){stroke:var(--pulse-warning)}.cat-tone-cyan{fill:var(--pulse-emphasis)}.cat-tone-pink{fill:var(--pulse-accent)}.dashboard-cat-sparkle-core{fill:var(--pulse-warning)}
      #speed-card:not([hidden]) .cat-mood-run{--cat-cycle:calc(var(--clawd-stride,.36s) * 3)}#speed-card:not([hidden]) .cat-mood-dash{--cat-cycle:calc(var(--clawd-stride,.24s) * 1.5)}#speed-card:not([hidden]) .cat-mood-sleep{--cat-cycle:3.2s}
      @media(prefers-reduced-motion:reduce){.cat-mood-idle .cat-pose-upright,.dashboard-cat:not(.cat-mood-idle) .cat-first{opacity:1}}
      @media(prefers-reduced-motion:no-preference){
        .bar [data-card=speed]:is(:hover,[aria-expanded=true],[data-running=true]) .dashboard-cat:not(.cat-mood-sleep) .dashboard-cat-badge-eyes rect,#speed-card:not([hidden]) .dashboard-cat:not(.cat-mood-sleep) .dashboard-cat-badge-eyes rect{animation:cat-badge-blink 4.2s steps(1) infinite}
        #speed-card:not([hidden]) .cat-mood-run .dashboard-cat-frame{animation:cat-frame-8 var(--cat-cycle) step-end infinite}
        #speed-card:not([hidden]) .cat-mood-dash .dashboard-cat-frame{animation:cat-frame-6 var(--cat-cycle) step-end infinite}
        #speed-card:not([hidden]) .cat-mood-sleep .dashboard-cat-frame{animation:cat-frame-2 var(--cat-cycle) step-end infinite}
        #speed-card:not([hidden]) .cat-mood-idle .dashboard-cat-frame{animation:7s step-end infinite}
        #speed-card:not([hidden]) .cat-pose-upright{animation-name:cat-upright!important}#speed-card:not([hidden]) .cat-pose-blink{animation-name:cat-blink!important}#speed-card:not([hidden]) .cat-pose-tilting{animation-name:cat-tilting!important}#speed-card:not([hidden]) .cat-pose-tilted{animation-name:cat-tilted!important}#speed-card:not([hidden]) .cat-pose-tiltedBlink{animation-name:cat-tilted-blink!important}
        #speed-card:not([hidden]) .dashboard-clawd-streaks line{animation:cat-streak calc(var(--clawd-stride,.24s) * 1.4) linear infinite}
        #speed-card:not([hidden]) .dashboard-cat-sparkle{animation:cat-sparkle 2.6s ease-in-out infinite}
      }
      @keyframes cat-frame-8{0%{opacity:1}12.5%,100%{opacity:0}}@keyframes cat-frame-6{0%{opacity:1}16.667%,100%{opacity:0}}@keyframes cat-frame-2{0%{opacity:1}50%,100%{opacity:0}}
      @keyframes cat-upright{0%,19%,67.857%,81.857%{opacity:1}17.143%,31.429%,80%{opacity:0}}@keyframes cat-blink{17.143%,80%{opacity:1}0%,19%,81.857%{opacity:0}}@keyframes cat-tilting{31.429%,65.714%{opacity:1}0%,33.571%,67.857%{opacity:0}}@keyframes cat-tilted{33.571%,50.286%{opacity:1}0%,48.571%,65.714%{opacity:0}}@keyframes cat-tilted-blink{48.571%{opacity:1}0%,50.286%{opacity:0}}
      @keyframes cat-badge-blink{0%,93%{transform:none}94%,97%{transform:scaleY(.2)}}@keyframes cat-streak{from{transform:translateX(3px);opacity:1}to{transform:translateX(-5px);opacity:0}}@keyframes cat-sparkle{0%{transform:translate(0,0);opacity:0}30%{opacity:1}100%{transform:translate(4px,-8px);opacity:0}}
      .heading.speed-hero{align-items:flex-end;gap:10px;padding-bottom:9px;margin-bottom:0;font-weight:400}.heading.speed-hero span{display:inline}.speed-hero-main{min-width:0;flex:1 1 auto}.speed-hero-label{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--pulse-muted)}.speed-hero-rate{display:flex;align-items:baseline;gap:4px;margin-top:3px;white-space:nowrap;line-height:1.1}#latest-rate{font-size:24px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--pulse-foreground)}#latest-rate[data-status=true]{font-size:15px;letter-spacing:0}
      dl.stats-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding-top:9px}dl.stats-grid>div{display:block;margin:0;min-width:0}dl.stats-grid dt{font-size:11px;color:var(--pulse-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}dl.stats-grid dd{margin:0;font-size:12px;text-align:left;white-space:nowrap;color:var(--pulse-foreground);overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}dl.stats-grid strong{font-weight:600}
      dl.stats-grid>.span-row{grid-column:1 / -1;display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding-top:6px;border-top:1px solid var(--pulse-separator)}dl.stats-grid>.span-row[hidden]{display:none}dl.stats-grid>.span-row dt{margin:0}dl.stats-grid>.span-row dd{text-align:right}
      .speed-unit{font-size:11px;font-weight:400;color:var(--pulse-muted)}.speed-unit[hidden]{display:none!important}
      .speed-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--pulse-separator);font-size:11px;color:var(--pulse-muted);font-variant-numeric:tabular-nums}.speed-meta span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .speed-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;font-size:11px;color:var(--pulse-muted);font-variant-numeric:tabular-nums}#speed-basis-tag{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#speed-basis-tag:empty{display:none}#samples{flex:none;white-space:nowrap;margin-left:auto}
      .heading.cache-hero{display:block;padding-bottom:9px;margin-bottom:0}.cache-hero-main{display:flex;flex-direction:column;gap:3px}.cache-hero-value{display:flex;align-items:baseline;justify-content:space-between;gap:8px;line-height:1.1}.cache-hero-total{display:inline-flex;align-items:baseline;gap:5px;min-width:0}#cache-coverage{font-size:21px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--pulse-foreground)}#cache-coverage-unit{font-size:12px;font-weight:500}.rate-pill{display:inline-flex;align-items:center;padding:2px 6px;border-radius:5px;font-size:11px;font-weight:600;color:var(--pulse-accent);background:color-mix(in srgb,var(--pulse-accent) 14%,transparent);font-variant-numeric:tabular-nums}
      .cache-meter{display:flex;gap:2px;height:4px;border-radius:999px;background:var(--pulse-track);overflow:hidden;margin-top:8px}.cache-meter i{display:block;height:100%;width:0;min-width:0}#cache-seg-read{background:var(--pulse-accent)}#cache-seg-miss{background:color-mix(in srgb,var(--pulse-emphasis) 42%,var(--pulse-track))}#cache-seg-out{background:var(--pulse-muted);opacity:.55}
      #usage-entry{display:flex;align-items:center;justify-content:space-between;gap:6px;padding-top:9px;margin-top:10px;border-top:1px solid var(--pulse-separator)}#usage-entry[hidden]{display:none}
      .usage-summary{display:flex;align-items:baseline;gap:10px;min-width:0;flex:1 1 auto}.usage-summary>div{min-width:0}.usage-label{font-size:11px;line-height:1.25;color:var(--pulse-muted);white-space:nowrap}.usage-val{display:flex;align-items:baseline;gap:2px;white-space:nowrap;line-height:1.3}.usage-summary strong{font-size:13px;font-weight:600;color:var(--pulse-foreground);font-variant-numeric:tabular-nums}.usage-unit{font-size:11px;color:var(--pulse-muted)}
      #open-usage{display:inline-flex;align-items:center;gap:4px;flex:none;padding:4px 6px;border:0;border-radius:5px;background:transparent;color:var(--pulse-accent);font:inherit;font-size:11px;font-weight:550;white-space:nowrap;transition:background-color 120ms ease,transform 120ms ease}#open-usage:hover{background:var(--pulse-hover)}#open-usage:active{transform:scale(.98)}#open-usage svg{width:12px;height:12px;flex:none}
      .heading.context-hero{padding-bottom:6px;margin-bottom:6px;border-bottom:0}.context-head-meta{display:inline-flex;align-items:center;gap:4px;min-width:0}.context-head-meta .tag{max-width:110px;overflow:hidden;text-overflow:ellipsis}.context-limit-badge{display:inline-flex;align-items:center;flex:none;gap:2px;padding:1px 6px;border-radius:4px;border:1px solid var(--pulse-separator);background:var(--pulse-control);color:var(--pulse-label);font-size:10px;font-weight:600;line-height:15px;font-variant-numeric:tabular-nums;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease}.context-limit-badge:hover{background:var(--pulse-hover);color:var(--pulse-foreground);border-color:var(--pulse-border)}.context-limit-badge.preview{color:var(--pulse-warning);background:color-mix(in srgb,var(--pulse-warning) 12%,transparent);border-color:color-mix(in srgb,var(--pulse-warning) 28%,transparent)}.context-limit-badge[data-save-failed=true]{border-color:var(--pulse-warning);text-decoration:underline dotted}.context-custom-trigger{padding:1px 5px;font-weight:500}.context-hero-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.context-hero-meta{display:inline-flex;align-items:baseline;gap:6px;min-width:0}.context-compaction-pill{padding:1px 5px;border-radius:4px;background:var(--pulse-control);font-size:10px;color:var(--pulse-label);font-variant-numeric:tabular-nums}.context-compaction-pill[hidden]{display:none}#context-summary{font-size:20px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}#context-tokens{font-size:11px;color:var(--pulse-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
      .context-preview-alert{margin-top:6px;padding:5px 8px;border-radius:6px;font-size:10px;line-height:1.4;color:var(--pulse-warning);background:color-mix(in srgb,var(--pulse-warning) 10%,transparent);border:1px solid color-mix(in srgb,var(--pulse-warning) 25%,transparent)}.context-preview-alert[hidden]{display:none}
      .context-limit-editor{margin-top:6px;display:flex;align-items:center;gap:4px;flex-wrap:wrap}.context-limit-editor[hidden]{display:none}.context-limit-input{flex:1 1 110px;min-width:90px;padding:3px 7px;border-radius:5px;border:1px solid var(--pulse-border);background:var(--pulse-background);color:var(--pulse-foreground);font:inherit;font-size:11px;outline:none}.context-limit-input:focus{border-color:var(--pulse-accent)}.context-limit-save,.context-limit-reset{padding:3px 7px;border-radius:5px;border:1px solid var(--pulse-separator);background:var(--pulse-control);color:var(--pulse-foreground);font-size:10px;font-weight:600}.context-limit-save:hover,.context-limit-reset:hover{background:var(--pulse-hover)}.context-limit-err{flex:1 0 100%;font-size:10px;color:var(--pulse-danger)}.context-limit-err[hidden]{display:none}
      .quota-bar-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:9px;border-top:1px solid var(--pulse-separator)}.quota-actions{display:flex;align-items:center;gap:6px}
      .quota-details{margin-top:7px}.quota-section+.quota-section{margin-top:8px;padding-top:8px;border-top:1px solid var(--pulse-separator)}.quota-section[hidden]+.quota-section{margin-top:0;padding-top:0;border-top:0}
      .quota-row-top{display:flex;align-items:baseline;gap:6px;font-size:11px}.quota-name{display:inline-flex;align-items:center;gap:5px;color:var(--pulse-label);margin-right:auto;min-width:0}.quota-meta{display:inline-flex;align-items:baseline;gap:4px;font-size:11px;color:var(--pulse-muted);font-variant-numeric:tabular-nums;white-space:nowrap}.quota-row-top strong{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;flex:none}.quota-track{margin:6px 0 0}.quota-section .footnote{margin-top:5px}
      .card-language{position:relative;display:flex;align-items:center;justify-content:flex-start;gap:6px;margin:10px 0 0;padding:8px 0 0;border-top:1px solid var(--pulse-separator);font-size:11px;color:var(--pulse-muted)}
      .card-language .update-trigger{margin-left:auto}
      .neon-toggle{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border:0;border-radius:5px;background:transparent;color:var(--pulse-muted);font:inherit;font-size:11px;line-height:16px;white-space:nowrap;cursor:pointer;flex:none;transition:background-color 120ms ease,color 120ms ease,transform 120ms ease}
      .neon-toggle:hover{background:var(--pulse-hover);color:var(--pulse-foreground)}.neon-toggle:active{transform:scale(.97)}
      .neon-toggle[aria-pressed=true]{color:var(--pulse-foreground);background:color-mix(in srgb,#8b6fe6 18%,var(--pulse-hover));box-shadow:0 1px 2px var(--pulse-shadow)}
      .neon-toggle[aria-pressed=true] svg{color:#9d7ef2;fill:currentColor;stroke:none}
      .neon-toggle[data-save-failed=true]{color:var(--pulse-warning);text-decoration:underline dotted}
      .neon-toggle svg{width:11px;height:11px;flex:none}
      .language-options{display:flex;gap:2px;padding:2px;border-radius:6px;background:var(--pulse-control);flex:none}
      .language-options .language-button{border:0;background:none;font-size:11px;padding:2px 6px;margin:0;border-radius:4px;color:var(--pulse-muted);line-height:16px;cursor:pointer;transition:background-color 140ms ease,color 140ms ease,transform 120ms ease}
      .language-options .language-button:hover{color:var(--pulse-hover-text);background:var(--pulse-hover)}
      .language-options .language-button[aria-pressed=true]{color:var(--pulse-foreground);background:var(--pulse-hover);box-shadow:0 1px 2px var(--pulse-shadow)}
      .language-options .language-button:active{transform:scale(.97)}.language-button[data-save-failed=true]{color:var(--pulse-warning);text-decoration:underline dotted}
      .language-guide{position:fixed;inset:auto;margin:0;padding:10px 12px;border:1px solid var(--pulse-border);border-radius:10px;background:var(--pulse-card);color:var(--pulse-foreground);box-shadow:0 4px 16px var(--pulse-shadow);font-size:11px;z-index:2147483000;overflow:visible}
      .language-guide[hidden]{display:none}.language-guide::backdrop{background:transparent;pointer-events:none}
      .language-guide::after{content:'';position:absolute;left:calc(var(--guide-anchor) - 4px);width:7px;height:7px;transform:rotate(45deg);background:var(--pulse-card);pointer-events:none}
      .language-guide[data-side=above]::after{bottom:-4px;border-right:1px solid var(--pulse-border);border-bottom:1px solid var(--pulse-border)}
      .language-guide[data-side=below]::after{top:-4px;border-left:1px solid var(--pulse-border);border-top:1px solid var(--pulse-border)}
      .guide-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:18px}
      .guide-heading strong{font-size:11px;font-weight:600}.guide-heading strong span{font-weight:400;color:var(--pulse-muted)}
      .language-guide button{border:0;background:transparent;color:var(--pulse-muted);border-radius:4px;cursor:pointer;font:inherit;transition:color 140ms ease,background-color 140ms ease,transform 120ms ease}
      .language-guide button:hover{background:var(--pulse-hover);color:var(--pulse-foreground)}.language-guide button:active{transform:scale(.98)}
      #guide-close{font-size:15px;line-height:18px;width:20px;height:20px;margin:-3px -4px -3px 0;padding:0}
      #guide-open{display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;width:calc(100% + 8px);margin:5px -4px -3px;padding:4px;line-height:16px}
      #guide-open>span{display:grid;gap:1px}#guide-open span[lang]{font-size:11px;color:var(--pulse-muted)}#guide-open svg{width:14px;height:14px;flex:none}
      #guide-save-note:empty,#language-save-note:empty{display:none}#guide-save-note,#language-save-note{color:var(--pulse-warning)}
      .heading.speed-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"label toggle" "rate trail";align-items:end;column-gap:10px;row-gap:2px}.speed-hero-main{display:contents}.speed-hero-label{grid-area:label;align-self:center}.speed-hero-rate{grid-area:rate}
      .heading.speed-hero svg.dashboard-speed-trail{grid-area:trail;justify-self:end;width:120px;height:46px;max-width:none;flex:none}
      .style-toggle{grid-area:toggle;justify-self:end;align-self:center;display:inline-flex;gap:1px;padding:2px;border-radius:6px;background:var(--pulse-control)}
      .style-toggle-button{display:grid;place-items:center;width:22px;height:18px;padding:0;margin:0;border:0;border-radius:4px;background:none;color:var(--pulse-muted);opacity:.7;cursor:pointer;transition:background-color 140ms ease,color 140ms ease,opacity 140ms ease,transform 120ms ease}
      .style-toggle-button:hover{opacity:1;color:var(--pulse-hover-text);background:var(--pulse-hover)}.style-toggle-button:active{transform:scale(.94)}
      .style-toggle-button[aria-pressed=true]{opacity:1;color:var(--pulse-foreground);background:var(--pulse-hover);box-shadow:0 1px 2px var(--pulse-shadow)}.style-toggle-button[data-save-failed=true]{color:var(--pulse-warning)}
      .style-toggle-button svg,.style-toggle-button svg.cat-badge{width:14px;height:9px;overflow:visible;fill:none}.style-toggle-button .speed-pulse-icon{fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
      svg.cat-badge .speed-pulse-icon{fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
      .speed-min-base{stroke:var(--pulse-separator);stroke-width:1}.speed-min-area{fill:color-mix(in srgb,var(--pulse-accent) 14%,transparent);stroke:none}.speed-min-line{fill:none;stroke:var(--pulse-accent);stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}.speed-min-dot{fill:var(--pulse-accent);stroke:var(--pulse-card);stroke-width:1}
      :host([data-speed-style=minimal]) .speed-hero-label{gap:6px;font-size:12px;color:var(--pulse-label)}:host([data-speed-style=minimal]) .speed-hero-rate{gap:6px;margin-top:4px}
      :host([data-speed-style=minimal]) #latest-rate{font-size:28px;font-weight:500;letter-spacing:-.03em}:host([data-speed-style=minimal]) #latest-rate[data-status=true]{font-size:15px;letter-spacing:0}:host([data-speed-style=minimal]) #latest-unit{font-size:12px}
      :host([data-speed-style=minimal]) #speed-card dl.stats-grid dd{font-size:13px}:host([data-speed-style=minimal]) #speed-card dl.stats-grid strong{font-weight:500}
      @media(prefers-reduced-motion:no-preference){#speed-card:not([hidden]) .speed-min-dot.is-live{animation:speed-dot-breathe 1.8s ease-in-out infinite}}
      @keyframes speed-dot-breathe{0%,100%{opacity:1}50%{opacity:.4}}
    </style><div class="bar" data-i18n-aria="strip" aria-label="Dashboard statistics">
      <span class="dot" id="dot" title="Connecting"></span>
      <button class="chip" data-card="speed" data-i18n-aria="session" aria-controls="speed-card" aria-expanded="false"><svg class="cat-badge" id="strip-cat-badge" viewBox="0 0 16 10" aria-hidden="true"></svg><span class="rounds dim" id="rounds"></span><strong id="tps">—</strong><span>tok/s</span></button>
      <button class="chip" data-card="cache" data-i18n-aria="cacheTitle" aria-controls="cache-card" aria-expanded="false">${svg('cache')}<svg class="collection-warning" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 15 14H1ZM8 6v4m0 2v.1"/></svg><svg class="collection-processing" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5M8 1v3m3-2v3"/></svg><span class="collection-label"></span><span class="cache-total" id="cache-total">— tok</span><span class="dim">/</span><strong id="cache-rate">—</strong></button>
      <button class="chip" data-card="context" data-i18n-aria="context" aria-controls="context-card" aria-expanded="false"><span class="context-ring" id="context-ring" aria-hidden="true"></span><span class="context-label" data-i18n="contextShort">Ctx</span><strong id="context-percent">—</strong></button>
    </div><section class="card" id="speed-card" role="region" data-i18n-aria="session" aria-label="Session statistics" hidden>
      <div class="heading speed-hero"><div class="speed-hero-main"><div class="speed-hero-label"><svg class="cat-badge" id="card-cat-badge" viewBox="0 0 16 10" aria-hidden="true"></svg><span data-i18n="latestSpeed">${t('latestSpeed')}</span></div><div class="speed-hero-rate"><strong id="latest-rate">—</strong><span class="speed-unit" id="latest-unit">tok/s</span></div></div><svg class="dashboard-speed-trail" id="speed-trail" viewBox="0 0 140 54" aria-hidden="true"></svg><div class="style-toggle" role="group" data-i18n-aria="speedStyle"><button type="button" class="style-toggle-button" id="speed-style-minimal" data-speed-style-choice="minimal"><svg viewBox="0 0 16 10" aria-hidden="true"><path class="speed-pulse-icon" d="M1 5h3l2-4 3 8 2-4h4"/></svg></button><button type="button" class="style-toggle-button" id="speed-style-cat" data-speed-style-choice="cat"><svg class="cat-badge" id="style-cat-icon" viewBox="0 0 16 10" aria-hidden="true"></svg></button></div></div>
      <dl class="stats-grid speed-stats"><div><dt data-i18n="sessionAvg">${t('sessionAvg')}</dt><dd><strong id="session-rate">—</strong><span class="speed-unit" id="session-unit"> tok/s</span></dd></div><div id="ttft-cell"><dt data-i18n="ttftShort">${t('ttftShort')}</dt><dd><strong id="ttft">—</strong><span class="speed-unit" id="ttft-unit"></span></dd></div><div><dt data-i18n="peakSpeed">${t('peakSpeed')}</dt><dd><strong id="peak-rate">—</strong><span class="speed-unit" id="peak-unit"> tok/s</span></dd></div></dl>
      <div class="speed-meta" id="speed-meta"><span id="speed-times">—</span><span id="tokens">—</span></div>
      <div class="speed-foot" id="speed-foot"><span id="speed-basis-tag"></span><span id="samples">—</span></div>
    </section><section class="card" id="cache-card" role="region" data-i18n-aria="cacheTitle" aria-label="Token cache" hidden>
      <div class="heading cache-hero"><div class="cache-hero-main"><div class="hero-label">${svg('cache')}<span data-i18n="cacheTitle">Token cache</span></div><div class="cache-hero-value"><span class="cache-hero-total" id="cache-hero-total"><strong id="cache-coverage">—</strong><span class="speed-unit" id="cache-coverage-unit">toks</span></span><span class="rate-pill" id="cache-detail-rate">—</span></div></div><div class="cache-meter" aria-hidden="true"><i id="cache-seg-read"></i><i id="cache-seg-miss"></i><i id="cache-seg-out"></i></div></div>
      <dl class="stats-grid cache-stats">${[['cacheRead','cache-read'],['cacheMiss','cache-miss'],['cacheOutput','cache-output']].map(([key,id])=>`<div id="${id}-cell"><dt data-i18n="${key}">${t(key)}</dt><dd><strong id="${id}">—</strong><span class="speed-unit" id="${id}-unit" hidden> toks</span></dd></div>`).join('')}<div id="cache-write-row" class="span-row" hidden><dt data-i18n="cacheWrite">${t('cacheWrite')}</dt><dd id="cache-write">—</dd></div><div class="span-row" id="task-own-row" hidden><dt data-i18n="taskOwn">${t('taskOwn')}</dt><dd id="task-own">—</dd></div><div class="span-row" id="task-subagents-row" hidden><dt id="task-subagents-label"></dt><dd id="task-subagents">—</dd></div></dl><p class="footnote" id="cache-note" hidden></p>
    </section><section class="card context-card" id="context-card" role="region" data-i18n-aria="context" hidden>
      <div class="heading context-hero"><span class="hero-label">${svg('context')}<span data-i18n="context">Context window</span></span><span class="context-head-meta"><button type="button" class="context-limit-badge" id="context-limit-badge">—</button><button type="button" class="context-limit-badge context-custom-trigger" id="context-limit-custom-btn" aria-expanded="false">✎</button><span class="tag" id="context-model">—</span></span></div>
      <div class="context-hero-row"><strong id="context-summary">—</strong><span class="context-hero-meta"><span class="tag context-compaction-pill" id="context-compaction-pill" hidden></span><span id="context-tokens">—</span></span></div>
      <div class="context-preview-alert" id="context-preview-alert" hidden></div>
      <div class="context-limit-editor" id="context-limit-editor" hidden>
        <input type="text" id="context-limit-input" class="context-limit-input" inputmode="text" autocomplete="off" spellcheck="false">
        <button type="button" class="context-limit-save" id="context-limit-apply" data-i18n="contextCustomApply">Apply</button>
        <button type="button" class="context-limit-reset" id="context-limit-auto" data-i18n="contextLimitAuto">Auto</button>
        <div class="context-limit-err" id="context-limit-err" hidden></div>
      </div>
      <div class="track" role="progressbar" data-i18n-aria="context" id="context-track"><i id="context-fill"></i></div>
      <div class="quota-bar-head"><div class="quota-spotlight-head" id="active-quota-group"><i class="spot-dot" id="spot-dot" aria-hidden="true"></i><strong class="spot-name" id="active-group-name">—</strong></div><div class="quota-actions"><span class="refresh quota-spinner" id="quota-spinner" role="status" data-i18n-aria="refreshing" aria-label="Refreshing…" aria-busy="false" hidden><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.8 6a5.1 5.1 0 1 0 .1 4M12.8 2.5V6H9.2"/></svg></span><span class="pace-badge" id="quota-pace" hidden><i class="pace-dot" aria-hidden="true"></i><span id="quota-pace-text"></span></span></div></div>
      <div class="quota-details">${['five','week'].map(name=>`<section class="quota-section" id="${name}-quota-section" data-i18n-aria="${name}" aria-label="${t(name)}"><div class="quota-row-top"><span class="quota-name">${svg(name)}<span id="${name}-quota-title" data-i18n="${name}">${t(name)}</span></span><span class="quota-meta"><span class="reset" id="${name}-countdown">—</span></span><strong id="${name}-balance">—</strong></div><div class="track quota-track" role="progressbar" data-i18n-aria="${name}" id="${name}-track"><i class="track-actual" id="${name}-fill"></i><i class="track-forecast" id="${name}-projected-fill" aria-hidden="true"></i></div><div class="quota-forecast" id="${name}-forecast" hidden><span class="forecast-main" id="${name}-forecast-text"></span></div><div class="quota-usage" id="${name}-usage" hidden><span data-i18n="quotaWindowUsage">${t('quotaWindowUsage')}</span><span class="quota-usage-val" id="${name}-usage-value">—</span></div><p class="footnote" id="${name}-note" hidden></p></section>`).join('')}</div>
      <div class="quota-siblings" id="quota-siblings" hidden></div>
    </section>`);
    row.insertBefore(node,branch.nextSibling);
    attribute(node,'data-speed-style',speedStyle.style);paintSpeed([],'idle',0.36,false);updateCatBadge($('style-cat-icon'),'idle');
    for(const card of root.querySelectorAll('.card')){const note=document.createElement('div');note.className='scope-note';note.dataset.i18n='subagentStats';card.querySelector('.heading').after(note);}
    for(const card of root.querySelectorAll('.card')){
      const notice=document.createElement('section');notice.className='collection-notice';notice.hidden=true;
      setMarkup(notice,'<strong class="collection-state"></strong><div data-i18n="collectionReason"></div><details><summary data-i18n="collectionDetails"></summary><div class="collection-budget-kind"></div><div class="collection-budget-size"></div><div data-i18n="collectionNoPartial"></div></details>');
      const docs=document.createElement('a');docs.href='https://github.com/ATtacK030130/antigrative-dashboard/blob/main/docs/LONG_CONVERSATIONS.md';docs.target='_blank';docs.rel='noopener noreferrer';docs.dataset.i18n='collectionDocs';notice.querySelector('details').append(docs);
      card.querySelector('.heading').after(notice);
      notice.querySelector('details').addEventListener('toggle',()=>{if(!disposed)position();});
    }
    const languageRow=document.createElement('div');languageRow.className='card-language';
    setMarkup(languageRow,'<div class="language-options" role="group" data-i18n-aria="language"><button type="button" class="language-button" id="card-language-en" data-language-choice="en" aria-label="English">EN</button><button type="button" class="language-button" id="card-language-zh" data-language-choice="zh-CN" aria-label="简体中文">简</button><button type="button" class="language-button" id="card-language-zh-tw" data-language-choice="zh-TW" aria-label="繁體中文">繁</button></div><button type="button" class="neon-toggle" id="neon-mascot-toggle" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 L9.8 6.2 L14.5 8 L9.8 9.8 L8 14.5 L6.2 9.8 L1.5 8 L6.2 6.2 Z"/></svg><span id="neon-mascot-label"></span></button>');
    $('context-card').append(languageRow);
    $('neon-mascot-toggle').addEventListener('click',()=>void neonMascotPref.choose(neonMascotPref.enabled?'off':'on'));
    if(window.__agPulseUpdateFactory&&window.agPulseHost.updatePlugin)updateMenu=window.__agPulseUpdateFactory({root,row:languageRow,language,setMarkup,request:input=>window.agPulseHost.updatePlugin(input),onOpen:hide});
    const saveNote=document.createElement('p');saveNote.className='footnote';saveNote.id='language-save-note';languageRow.after(saveNote);
    const guide=document.createElement('section');guide.className='language-guide';guide.id='language-guide';guide.hidden=true;guide.setAttribute('role','region');guide.setAttribute('aria-label','Language / 語言 / 语言');
    setMarkup(guide,'<div class="guide-heading"><strong>Language <span>/ 语言</span></strong><button type="button" id="guide-close" aria-label="Dismiss language tip / 关闭语言提示" title="Dismiss / 关闭">×</button></div><button type="button" id="guide-open"><span><span>Switch in context details</span><span lang="zh-CN">在上下文详情中切换语言</span></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></button><p class="footnote" id="guide-save-note"></p>');
    root.append(guide);
    $('guide-close').addEventListener('click',()=>void dismissGuide());
    $('guide-open').addEventListener('click',()=>{guideOpened=true;show('context');const btn=$(language.language==='zh-TW'?'card-language-zh-tw':'card-language-zh');btn.scrollIntoView({block:'nearest'});btn.focus({preventScroll:true});});
    // Escape ancestor stacking/paint contexts; ordinary z-index cannot do this.
    if(typeof HTMLElement.prototype.showPopover==='function')for(const card of root.querySelectorAll('.card'))card.setAttribute('popover','manual');
    if(typeof guide.showPopover==='function')guide.setAttribute('popover','manual');
    themeController=theme.attach(node,{embedded:true,onChange:()=>{if(!disposed&&!instDisposed)scheduleLayout();}});
    report('mounted',{editorFound:true,composerFound:true});
    observeComposer();
    for(const chip of root.querySelectorAll('[data-card]')){
      chip.addEventListener('pointerenter',()=>hoverChip(chip.dataset.card));chip.addEventListener('pointerleave',leaveChip);chip.addEventListener('focus',()=>{if(chip.matches(':focus-visible'))show(chip.dataset.card);});chip.addEventListener('click',()=>show(chip.dataset.card));
    }
    for(const card of root.querySelectorAll('.card')){
      card.addEventListener('pointerenter',()=>clearTimeout(hoverTimer));card.addEventListener('pointerleave',scheduleHide);
    }
    // A host composer may focus its editor on bubbled clicks. Keep plugin
    // controls' mouse actions inside the shadow root while retaining their
    // default focus/click behavior and document-level outside-click dismissal.
    for(const type of ['pointerdown','mousedown','click'])root.addEventListener(type,event=>event.stopPropagation());
    node.addEventListener('pointerenter',()=>clearTimeout(hoverTimer));node.addEventListener('pointerleave',scheduleHide);
    root.addEventListener('focusout',()=>setTimeout(()=>{if(!cardEngaged())hide();},0));
    for(const button of root.querySelectorAll('.refresh'))button.addEventListener('click',()=>refreshManually(false));
    for(const button of root.querySelectorAll('[data-language-choice]'))button.addEventListener('click',()=>void preferences.choose(button.dataset.languageChoice));
    for(const button of root.querySelectorAll('[data-speed-style-choice]'))button.addEventListener('click',()=>void speedStyle.choose(button.dataset.speedStyleChoice));
    $('context-limit-badge')?.addEventListener('click',event=>{
      event.stopPropagation();event.preventDefault();
      clearTimeout(hoverTimer);hoverTimer=null;
      const hostMax=data?.speed?.context?.maxTokens;
      const presets=['auto','512k','734k'].filter(p=>!(hostMax===512000&&p==='512k')&&!(hostMax===734000&&p==='734k'));
      const current=contextLimitPref.value;
      const idx=presets.indexOf(current);
      const next=presets[(idx+1)%presets.length];
      void contextLimitPref.choose(next);
      show('context');
    });
    function closeCustomLimitEditor(){
      const ed=$('context-limit-editor'),btn=$('context-limit-custom-btn'),err=$('context-limit-err');
      if(ed)hidden(ed,true);
      if(err){err.textContent='';hidden(err,true);}
      if(btn)attribute(btn,'aria-expanded',false);
      position();
    }
    function applyCustomLimitInput(){
      const input=$('context-limit-input'),err=$('context-limit-err');
      const parsed=language.parseContextLimitOverride(input?.value);
      if(!parsed){
        if(err){err.textContent=t('contextCustomInvalid');hidden(err,false);}
        input?.focus({preventScroll:true});
        position();
        return;
      }
      void contextLimitPref.choose(parsed);
      closeCustomLimitEditor();
      show('context');
    }
    $('context-limit-custom-btn')?.addEventListener('click',event=>{
      event.stopPropagation();event.preventDefault();
      clearTimeout(hoverTimer);hoverTimer=null;
      const ed=$('context-limit-editor'),btn=$('context-limit-custom-btn'),input=$('context-limit-input'),err=$('context-limit-err');
      if(!ed)return;
      const opening=ed.hidden;
      hidden(ed,!opening);
      if(btn)attribute(btn,'aria-expanded',opening);
      if(opening){
        if(err){err.textContent='';hidden(err,true);}
        if(input){
          input.value=contextLimitPref.value==='auto'?'':contextLimitPref.value;
          input.focus({preventScroll:true});input.select();
        }
        position();
      }else{
        closeCustomLimitEditor();
      }
    });
    $('context-limit-apply')?.addEventListener('click',event=>{event.stopPropagation();applyCustomLimitInput();});
    $('context-limit-auto')?.addEventListener('click',event=>{event.stopPropagation();void contextLimitPref.choose('auto');closeCustomLimitEditor();show('context');});
    $('context-limit-input')?.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(event.key==='Enter'){event.preventDefault();applyCustomLimitInput();}
      else if(event.key==='Escape'){event.preventDefault();closeCustomLimitEditor();}
    });
    if(window.__agPulseUsageFactory){
      const section=document.createElement('div');section.id='usage-entry';section.hidden=true;
      setMarkup(section,'<div class="usage-summary"><div><div class="usage-label" id="usage-today-label"></div><div class="usage-val"><strong id="usage-today"></strong><span class="usage-unit" id="usage-today-unit">toks</span></div></div><div><div class="usage-label" id="usage-month-label"></div><div class="usage-val"><strong id="usage-month"></strong><span class="usage-unit" id="usage-month-unit">toks</span></div></div></div><button type="button" id="open-usage"><span id="usage-open-label"></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></button>');$('cache-card').append(section);
      usageDashboard=window.__agPulseUsageFactory({root,language,setMarkup,hostLabel:surface?.usageHostLabel||'Antigravity',guideDismissed:usageGuideDismissed,onDismissGuide:async()=>{const saved=await window.agPulseHost.setPreferences({usageGuideDismissed:true});if(saved?.usageGuideDismissed!==true)throw Error('Usage guide could not be saved');syncGuide(saved);},onLanguage:next=>preferences.choose(next),onRefresh:()=>refreshManually(true),onScope:async next=>{
        const ticket=++scopeRequestEpoch,save=usageScope.choose(next);
        try{
          const result=await window.agPulseHost.getMetrics({conversationId:null,force:false,usageOnly:true,usageScope:next});
          if(!disposed&&!instDisposed&&ticket===scopeRequestEpoch&&result?.usage){
            if(data)data={...data,usage:result.usage};
            text('usage-today',compact(result.usage.todayTokens));text('usage-today-unit',tokUnit(result.usage.todayTokens));
            text('usage-month',compact(result.usage.monthTokens));text('usage-month-unit',tokUnit(result.usage.monthTokens));
            usageDashboard?.update(result.usage);
          }
        }finally{await save;}
      }});
      root.getElementById('usage-dashboard')?.addEventListener('close',scheduleLayout);
      $('open-usage').addEventListener('click',()=>{const trigger=root.querySelector('[data-card=cache]'),conversation=conversationId(),model=currentComposerModel();for(const other of instances)other.hide();usageDashboard.open(data?.usage,trigger);void window.agPulseHost.getMetrics({conversationId:conversation,force:true,usageSync:true,...(model?{composerModel:model}:{})}).then(result=>{if(!disposed&&!instDisposed&&result?.usage&&(!result.usage.scope||result.usage.scope===usageScope.scope)){if(data)data={...data,usage:result.usage};usageDashboard.update(result.usage);}}).catch(()=>{});});
    }
    lastConversation=conversationId();
    if(!lastConversation){hydrated=true;seenEmptySession=true;}
    localize();
    neonMascot.sync(composer,node,data);
    fit();position();
    refresh();
  }
  function render(){
    if(!root||!data)return;
    if(!parked&&composer)syncConversation();
    if(usageDashboard){
      const available=Boolean(data.usage);hidden($('usage-entry'),!available);
      text('usage-today',compact(data.usage?.todayTokens));text('usage-today-unit',tokUnit(data.usage?.todayTokens));
      text('usage-month',compact(data.usage?.monthTokens));text('usage-month-unit',tokUnit(data.usage?.monthTokens));
      usageDashboard.update(data.usage);
    }
    if(parked||!composer)return;
    const groups=data.groups||[],trigger=currentModelTrigger(),models=[trigger?.getAttribute('aria-label'),trigger?.getAttribute('title'),trigger?.textContent,data.speed?.model];
    autoGroupId=language.chooseQuotaGroup(groups,models,null)?.id||null;
    group=language.chooseQuotaGroup(groups,models,chosen);
    text('active-group-name',group?label(group):'—');
    hidden($('active-quota-group'),!group);
    const speed=data.speed,collection=data.collection;
    const taskUsage=Number.isSafeInteger(speed?.taskUsage?.subagents)&&speed.taskUsage.subagents>0?speed.taskUsage:null;
    const limited=collection?.state==='limited'&&collection.code==='budget-exceeded';
    const processing=collection?.state==='processing'&&collection.code==='background-collection',collectionActive=limited||processing;
    attribute(node,'data-collection',processing?'processing':limited?'limited':null);
    const cacheChip=root.querySelector('[data-card="cache"]');
    const currentOnly=!collectionActive&&taskUsage?.state==='partial'&&taskUsage.loadedSubagents===0;
    const cacheLabel=collectionActive?t(processing?'collectionProcessing':'collectionLimited'):currentOnly?t('taskCurrentOnly'):t('cacheTitle');
    attribute(cacheChip,'data-task-current-only',currentOnly?'true':null);
    attribute(cacheChip,'aria-label',cacheLabel);
    attribute(cacheChip,'title',collectionActive||currentOnly?cacheLabel:null);
    attribute(cacheChip,'aria-busy',processing?'true':null);
    const collectionLabel=root.querySelector('.collection-label'),collectionText=t(processing?'collectionProcessing':'collectionLimited');
    if(collectionLabel.textContent!==collectionText)collectionLabel.textContent=collectionText;
    for(const notice of root.querySelectorAll('.collection-notice')){
      hidden(notice,!collectionActive);if(!collectionActive){notice.querySelector('details').open=false;continue;}
      const set=(selector,value)=>{const element=notice.querySelector(selector);if(element.textContent!==value)element.textContent=value;};
      set('.collection-state',collection.freshness==='saved'&&Number.isFinite(Date.parse(collection.lastSuccessAt))?t('collectionSavedAt',{time:date(collection.lastSuccessAt)}):t(collection.freshness==='saved'?'collectionSaved':'collectionLimited'));
      set('[data-i18n="collectionReason"]',t(processing?'collectionProcessingReason':collection.reason?'collectionBackgroundFailed':'collectionReason'));
      set('summary',t(processing?'collectionProgress':'collectionDetails'));
      hidden(notice.querySelector('[data-i18n="collectionNoPartial"]'),processing);
      hidden(notice.querySelector('a'),processing);
      if(processing){
        if(collection.freshness!=='saved')set('.collection-state',t('collectionProcessing'));
        const stages={queued:'collectionQueued',steps:'collectionSteps',generators:'collectionGenerators',reducing:'collectionReducing',publishing:'collectionPublishing'};
        set('.collection-budget-kind',t(stages[collection.stage]||'collectionQueued'));
        const valid=n=>Number.isSafeInteger(n)&&n>=0,steps=collection.processedSteps,requests=collection.processedGenerators;
        hidden(notice.querySelector('.collection-budget-size'),!valid(steps)||!valid(requests));
        if(valid(steps)&&valid(requests))set('.collection-budget-size',t('collectionProgressCounts',{steps:count(steps),requests:count(requests)}));
        continue;
      }
      set('.collection-budget-kind',t(collection.kind==='projected-json'?'collectionProjected':collection.kind==='field'?'collectionField':'collectionRetained'));
      const characters=collection.unit==='characters',limit=characters?collection.limit:collection.limitBytes,observed=characters?collection.observed:collection.observedBytes;
      const valid=n=>Number.isSafeInteger(n)&&n>=0;
      const format=n=>characters?t('collectionCharacters',{n:count(n)}):`${(Math.floor(n/1048576*100)/100).toFixed(2)} MiB (${count(n)} B)`;
      const size=notice.querySelector('.collection-budget-size');hidden(size,!valid(limit)||!valid(observed));
      if(valid(limit)&&valid(observed))set('.collection-budget-size',t('collectionObserved',{observed:format(observed),limit:format(limit)}));
    }
    hidden(root.querySelector('[data-card="speed"]'),false);
    hidden(root.querySelector('[data-card="cache"]'),false);
    const context=speed?.context;
    const validHostMax=typeof context?.maxTokens==='number'&&context.maxTokens>0?context.maxTokens:null;
    const overrideTokens=language.contextLimitTokens(contextLimitPref.value);
    const effectiveMax=overrideTokens>0?overrideTokens:validHostMax;
    const isPreviewOverride=Boolean(overrideTokens>0&&overrideTokens!==validHostMax);
    const hasUsedTokens=typeof context?.usedTokens==='number'&&Number.isFinite(context.usedTokens);
    const hasCapacity=Boolean(effectiveMax!==null&&effectiveMax>0&&hasUsedTokens);
    const effectiveFraction=hasCapacity?(context.usedTokens/effectiveMax):0;
    const effectiveRemainingFraction=Math.max(0,1-effectiveFraction);
    const ringColor=!hasCapacity?'var(--pulse-ring)':effectiveFraction>=0.9?'var(--pulse-danger)':effectiveFraction>=0.75?'var(--pulse-warning)':'var(--pulse-ring)';
    hidden(root.querySelector('[data-card="context"]'),false);
    const empty=(surface&&!surface.useSharedComposer?surface.conversationState?.(composer).status==='new':composer?.kind==='main'&&(!lastConversation||(!speed?.requests&&!speed?.steps&&!hasCapacity)))&&data.connection==='live'&&!data.sessionError&&!collectionActive;
    text('context-percent',hasCapacity?`${Math.round(effectiveFraction*100)}%`:'—');
    style($('context-ring'),'--used-angle',`${hasCapacity?Math.min(1,effectiveFraction)*360:0}deg`);
    style($('context-ring'),'--ring-color',ringColor);
    text('context-summary',hasCapacity?t('contextUsed',{used:Math.round(effectiveFraction*100),remaining:Math.round(effectiveRemainingFraction*100)}):collectionActive?'—':t(empty?'waitingRequest':'contextUnknown'));
    text('context-tokens',context?t('contextTokens',{used:compact(context.usedTokens),max:effectiveMax===null?'—':compact(effectiveMax)}):'—');
    text('context-model',context?.model||'—');
    const transcript=speed?.transcriptStats;
    const compactions=transcript&&['ready','partial'].includes(transcript.status)&&typeof transcript.compactionMarkers==='number'?transcript.compactionMarkers:null;
    const compactionPill=$('context-compaction-pill');
    if(compactionPill){
      if(compactions!==null&&compactions>0){
        hidden(compactionPill,false);
        text('context-compaction-pill',`🗜 ${t('contextCompactionCount',{n:compactions})}`);
        attribute(compactionPill,'title',t('contextCompactionsTitle',{n:compactions}));
      }else{
        hidden(compactionPill,true);
      }
    }
    const ctxChip=root.querySelector('[data-card="context"]');
    if(ctxChip){
      const compSuffix=compactions!==null&&compactions>0?` · 🗜 ${t('contextCompactionCount',{n:compactions})}`:'';
      attribute(ctxChip,'title',hasCapacity?`Ctx ${Math.round(effectiveFraction*100)}% (${compact(context.usedTokens)} / ${compact(effectiveMax)})${compSuffix}`:(compSuffix?`Ctx${compSuffix}`:null));
    }
    const hostLabel=validHostMax!==null?compact(validHostMax):t('contextLimitUnknown');
    const limitBadge=$('context-limit-badge');
    if(limitBadge){
      const baseTip=isPreviewOverride?t('contextLimitTooltipOverride',{limit:compact(effectiveMax),host:hostLabel}):t('contextLimitTooltipHost',{limit:hostLabel});
      limitBadge.className='context-limit-badge'+(isPreviewOverride?' preview':'');
      text('context-limit-badge',isPreviewOverride?`👁 ${compact(effectiveMax)}`:(validHostMax!==null?compact(validHostMax):t('contextLimitAuto')));
      attribute(limitBadge,'title',contextLimitPref.error?`${baseTip} · ${t('contextLimitSaveFailed')}`:baseTip);
      attribute(limitBadge,'data-save-failed',contextLimitPref.error);
    }
    const previewAlert=$('context-preview-alert');
    if(previewAlert){
      hidden(previewAlert,!isPreviewOverride);
      if(isPreviewOverride)text('context-preview-alert',t('contextPreviewAlert',{limit:compact(effectiveMax),host:hostLabel}));
    }
    style($('context-fill'),'width',hasCapacity?`${Math.min(1,effectiveFraction)*100}%`:'0%');
    style($('context-fill'),'background',hasCapacity&&effectiveFraction>=.9?'var(--pulse-danger)':hasCapacity&&effectiveFraction>=.75?'var(--pulse-warning)':'');
    attribute($('context-track'),'aria-valuenow',hasCapacity?Math.min(100,effectiveFraction*100):null);attribute($('context-track'),'aria-valuemin','0');attribute($('context-track'),'aria-valuemax','100');
    const isFiniteRate=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
    const stripRate=!speed||speed.latestRateStatus==='legacy'?null:speed.latestRateStatus!=='unreliable'&&isFiniteRate(speed.latestTps)?speed.latestTps:isFiniteRate(speed.tps)?speed.tps:null;
    const isRunning=Boolean(speed&&/RUNNING/i.test(String(speed.status||'')));
    const trailSamples=speed&&speed.latestRateStatus!=='legacy'?(Array.isArray(speed.recentTps)&&speed.recentTps.length?speed.recentTps.filter(v=>isFiniteRate(v)&&v>0):stripRate>0?[Math.round(stripRate*10)/10]:[]):[];
    const relSpeed=trailSamples.length>=2?(()=>{const mean=trailSamples.reduce((a,b)=>a+b,0)/trailSamples.length;return mean>0?trailSamples[trailSamples.length-1]/mean:1;})():1;
    const catStride=Number.isFinite(relSpeed)&&relSpeed>0?Math.min(0.7,Math.max(0.14,0.36/(relSpeed*relSpeed))):0.36;
    const activeAge=Date.now()-Date.parse(speed?.lastActiveAt||speed?.context?.sampledAt||speed?.savedAt||'');
    const catMood=isRunning?(relSpeed>=1.1?'dash':'run'):Number.isFinite(activeAge)&&activeAge>1800000?'sleep':'idle';
    attribute(root.querySelector('[data-card="speed"]'),'data-running',isRunning?'true':null);
    paintSpeed(trailSamples,catMood,catStride,isRunning);
    text('tps',rate(stripRate));text('rounds',speed?t('rounds',{rounds:speed.rounds,steps:speed.steps}):'');
    text('speed-basis-tag',speed?t(speed.rateBasis==='all-output'?'basisShortAll':'basisShortResponse'):'');
    text('samples',speed?t('sample',{rounds:speed.rounds,steps:speed.steps,requests:speed.measuredRequests}):collectionActive?'—':t(data.sessionError?'collectionUnavailable':'waitingRequest'));
    const ttftVal=speed?.ttftSeconds;
    if(isFiniteRate(ttftVal)&&ttftVal<60){text('ttft',ttftVal>=10?ttftVal.toFixed(1):ttftVal.toFixed(2));text('ttft-unit',' s');attribute($('ttft-cell'),'title',`${t('ttft')}: ${seconds(ttftVal)}`);}
    else{text('ttft',seconds(ttftVal));text('ttft-unit','');attribute($('ttft-cell'),'title',null);}
    const legacyRate=speed?.latestRateStatus==='legacy',unreliableRate=speed?.latestRateStatus==='unreliable';
    text('session-rate',legacyRate?t('ratePending'):rate(speed?.tps));hidden($('session-unit'),Boolean(legacyRate));
    text('latest-rate',unreliableRate?t('timingUnreliable'):legacyRate?t('ratePending'):rate(stripRate));
    attribute($('latest-rate'),'data-status',unreliableRate||legacyRate?'true':null);
    hidden($('latest-unit'),Boolean(unreliableRate||legacyRate));
    const peakCandidate=legacyRate||!speed?-1:isFiniteRate(speed.peakTps)?speed.peakTps:Math.max(isFiniteRate(speed.tps)?speed.tps:-1,!unreliableRate&&isFiniteRate(speed.latestTps)?speed.latestTps:-1);
    text('peak-rate',peakCandidate>=0?rate(peakCandidate):'—');hidden($('peak-unit'),false);
    text('speed-times',speed?`${seconds(speed.modelSeconds)} / ${seconds(speed.toolSeconds)}`:'—');
    attribute($('speed-meta'),'title',speed?`${t('modelTime')}: ${seconds(speed.modelSeconds)} · ${t('toolTime')}: ${seconds(speed.toolSeconds)}`:null);
    const respOut=speed?.counts?.responseOutput,thinkOut=speed?.counts?.thinkingOutput;
    text('tokens',speed?`${count(respOut)} / ${count(thinkOut)} ${tokUnit((respOut||0)+(thinkOut||0))}`:'—');
    const usage=taskUsage||speed,cache=usage?.cache;
    text('cache-rate',pct(cache?.hitRate));text('cache-detail-rate',pct(cache?.hitRate));
    const tokens=usage?.tokens || cache;
    // Keep coverage in the data model; the compact card shows readable counters.
    const hasTotal=tokens?.measuredRequests&&Number.isSafeInteger(tokens.totalTokens)&&tokens.totalTokens>=0;
    const hasStripData=Boolean(collectionActive||stripRate!==null||hasTotal||(typeof cache?.hitRate==='number'&&Number.isFinite(cache.hitRate))||hasCapacity);
    if(!hasStripData){
      emptyCompact=true;
      if(hydrated)seenEmptySession=true;
    }else{
      if(emptyCompact){
        emptyCompact=false;
        if(seenEmptySession){seenEmptySession=false;springNextExpand=true;}
        else suppressNextMotion=true;
      }
      hydrated=true;
    }
    text('cache-total',hasTotal?`${compact(tokens.totalTokens)} tok`:'— tok');
    text('cache-coverage',hasTotal?(tokens.totalTokens>=1e9?compactDetail(tokens.totalTokens):count(tokens.totalTokens)):'—');
    text('cache-coverage-unit',hasTotal?tokUnit(tokens.totalTokens):'toks');
    attribute($('cache-hero-total'),'title',hasTotal&&tokens.totalTokens>=1e9?`${count(tokens.totalTokens)} ${tokUnit(tokens.totalTokens)}`:null);
    const inputCoverage={uncachedTokens:'uncachedRequests',cachedTokens:'cachedRequests',cacheWriteTokens:'cacheWriteRequests'};
    for(const [field,id,labelKey]of[['cachedTokens','cache-read','cacheRead'],['uncachedTokens','cache-miss','cacheMiss'],['outputTokens','cache-output','cacheOutput']]) {
      const available=field==='outputTokens'?(tokens?.outputAvailable??(tokens?.outputRequests??tokens?.measuredRequests)):(tokens?.[inputCoverage[field]]??tokens?.inputRequests??tokens?.measuredRequests);
      const known=Number.isSafeInteger(tokens?.[field])&&tokens[field]>=0;
      if(available&&known){
        const v=tokens[field];
        text(id,compactDetail(v));text(`${id}-unit`,` ${tokUnit(v)}`);hidden($(`${id}-unit`),false);
        attribute($(`${id}-cell`),'title',`${t(labelKey)}: ${count(v)} ${tokUnit(v)}`);
      }else{
        text(id,'—');hidden($(`${id}-unit`),true);attribute($(`${id}-cell`),'title',null);
      }
    }
    const cwAvail=tokens?.cacheWriteRequests??tokens?.inputRequests??tokens?.measuredRequests;
    const cwKnown=cwAvail&&Number.isSafeInteger(tokens?.cacheWriteTokens)&&tokens.cacheWriteTokens>=0;
    const cwVal=tokens?.cacheWriteTokens;
    text('cache-write',cwKnown?`${cwVal>=1e9?compactDetail(cwVal):count(cwVal)} ${tokUnit(cwVal)}`:'—');
    attribute($('cache-write-row'),'title',cwKnown&&cwVal>=1e9?`${count(cwVal)} ${tokUnit(cwVal)}`:null);
    const readVal=Number.isSafeInteger(tokens?.cachedTokens)&&tokens.cachedTokens>0?tokens.cachedTokens:0;
    const missVal=Number.isSafeInteger(tokens?.uncachedTokens)&&tokens.uncachedTokens>0?tokens.uncachedTokens:0;
    const outVal=Number.isSafeInteger(tokens?.outputTokens)&&tokens.outputTokens>0?tokens.outputTokens:0;
    const meterSum=readVal+missVal+outVal;
    style($('cache-seg-read'),'width',meterSum?`${(readVal/meterSum)*100}%`:'0%');
    style($('cache-seg-miss'),'width',meterSum?`${(missVal/meterSum)*100}%`:'0%');
    style($('cache-seg-out'),'width',meterSum?`${(outVal/meterSum)*100}%`:'0%');
    hidden($('cache-write-row'),!(tokens?.cacheWriteTokens>0));
    hidden($('task-own-row'),!taskUsage);hidden($('task-subagents-row'),!taskUsage);
    text('task-subagents-label',taskUsage?t('taskSubagents',{n:count(taskUsage.subagents)}):'');
    for(const [field,id,rowId]of[['ownTokens','task-own','task-own-row'],['subagentTokens','task-subagents','task-subagents-row']]){
      const value=taskUsage?.[field],known=field!=='subagentTokens'||taskUsage?.loadedSubagents>0;
      const ok=known&&Number.isSafeInteger(value)&&value>=0;
      text(id,ok?`${value>=1e9?compactDetail(value):count(value)} ${tokUnit(value)}`:'—');
      attribute($(rowId),'title',ok&&value>=1e9?`${count(value)} ${tokUnit(value)}`:null);
    }
    const taskNote=taskUsage?.state==='loading'?t('taskLoading'):taskUsage?.state==='partial'?t(taskUsage.loadedSubagents===0?'taskCurrentOnly':'taskPartial'):'';
    text('cache-note',taskNote);hidden($('cache-note'),!taskNote);
    const visibleQuotaWindows=language.quotaWindows(group),isArgon=language.quotaGroupKind(group)==='gemini-argon';
    const nextQuotaSig=JSON.stringify([data.quotaUpdatedAt||null,groups]);
    if(nextQuotaSig!==quotaSigCache){quotaSigCache=nextQuotaSig;quotaObservedAt=Date.now();}
    const paceNow=quotaObservedAt||Date.now();
    const pace=group?language.groupQuotaPace(group,paceNow):null;
    const paceBadge=$('quota-pace');
    if(paceBadge){
      hidden(paceBadge,!pace);
      if(pace){
        text('quota-pace-text',pace.label);
        attribute(paceBadge,'data-pace',pace.pace);
        attribute(paceBadge,'data-critical',pace.critical?'true':null);
        attribute(paceBadge,'title',pace.title);
      }
    }
    for(const [window,name]of[['5h','five'],['weekly','week']]){
      hidden($(`${name}-quota-section`),!visibleQuotaWindows.includes(window));
      const heading=t(window==='weekly'&&isArgon?'argonWeek':name);
      text(`${name}-quota-title`,heading);attribute($(`${name}-quota-section`),'aria-label',heading);attribute($(`${name}-track`),'aria-label',heading);
      const b=group?.windows?.[window],remaining=language.quotaRemaining(b),balance=b?.disabled?t('unavailableQuota'):pct(remaining);
      const forecast=language.quotaForecast(b,window,paceNow);
      const barBg=remaining!==null&&remaining<.05?'var(--pulse-danger)':(remaining!==null&&remaining<.2)||forecast?.willExhaust?'var(--pulse-warning)':'';
      // Solid fill is always the real balance; the hatched tail marks what the
      // current pace is expected to consume before the window resets.
      const hatch=Boolean(forecast?.forecastReady&&remaining!==null&&forecast.projectedRemaining<remaining-0.005);
      text(name,balance);text(`${name}-balance`,balance);
      style($(`${name}-fill`),'width',remaining!==null?`${remaining*100}%`:'0%');style($(`${name}-fill`),'background',barBg);
      const projEl=$(`${name}-projected-fill`);
      if(projEl){
        style(projEl,'left',hatch?`${forecast.projectedRemaining*100}%`:'0%');
        style(projEl,'width',hatch?`${(remaining-forecast.projectedRemaining)*100}%`:'0%');
      }
      const forecastEl=$(`${name}-forecast`),fTextEl=$(`${name}-forecast-text`);
      if(forecastEl&&fTextEl){
        const showF=Boolean(forecast&&typeof forecast.timeRemaining==='number');
        hidden(forecastEl,!showF);
        if(showF){
          if(forecast.willExhaust){
            text(`${name}-forecast-text`,t('forecastDepletes',{eta:language.shortEta(forecast.exhaustInMs),early:language.shortEta(forecast.earlyByMs)}));
            attribute(fTextEl,'data-alert','true');
          }else{
            attribute(fTextEl,'data-alert',null);
            text(`${name}-forecast-text`,forecast.warmingUp?t('forecastWarming',{pct:pct(forecast.used)}):t('forecastLeft',{pct:pct(forecast.projectedRemaining)}));
          }
          attribute(forecastEl,'title',t('forecastBasis',{remaining:pct(forecast.remaining),time:pct(forecast.timeRemaining)}));
        }
      }
      attribute($(`${name}-track`),'aria-valuenow',remaining!==null?remaining*100:null);attribute($(`${name}-track`),'aria-valuemin','0');attribute($(`${name}-track`),'aria-valuemax','100');
      const subagentNote=composer?.kind==='subagent'&&name==='five'?t('accountQuota'):'';
      const errNote=language.errorMessage(data.error)||(b?.disabled?t('disabledQuota'):!b?.available?t('noQuota'):'');
      const note=[subagentNote,errNote].filter(Boolean).join(' ');
      text(`${name}-note`,note);hidden($(`${name}-note`),!note);
      const usageRow=$(`${name}-usage`);
      if(usageRow){
        const winUsage=group?.id&&!b?.disabled&&b?.available?data.usage?.quotaWindows?.[`${group.id}:${window}`]:null;
        const showUsage=Boolean(winUsage&&typeof winUsage.observedTokens==='number'&&winUsage.observedTokens>0);
        hidden(usageRow,!showUsage);
        if(showUsage){
          const refText=winUsage.estimatedFullTokens?` (${t('quotaWindowFullRef',{full:compact(winUsage.estimatedFullTokens)})})`:'';
          text(`${name}-usage-value`,`${compact(winUsage.observedTokens)} ${tokUnit(winUsage.observedTokens)}${refText}`);
          attribute(usageRow,'title',t('quotaWindowBasis'));
        }else attribute(usageRow,'title',null);
      }
    }
    const sibWrap=$('quota-siblings');
    if(sibWrap){
      const siblings=group?groups.filter(g=>g.id!==group.id):groups;
      hidden(sibWrap,!siblings.length);
      const sibSig=JSON.stringify(siblings.map(g=>[g.id,label(g),language.quotaWindows(g),language.quotaGroupKind(g)==='gemini-argon',language.language]));
      if(sibWrap.dataset.signature!==sibSig){
        sibWrap.replaceChildren(...siblings.map(g=>{
          const btn=document.createElement('button');btn.type='button';btn.className='quota-sibling';btn.dataset.group=g.id;
          const wins=language.quotaWindows(g),sibArgon=language.quotaGroupKind(g)==='gemini-argon';
          const lbl=document.createElement('span');lbl.className='sibling-label';
          const dot=document.createElement('i');dot.className='sibling-dot';dot.setAttribute('aria-hidden','true');
          const name=document.createElement('span');name.className='sibling-name';name.textContent=label(g);
          lbl.append(dot,name);
          const metrics=document.createElement('span');metrics.className='sibling-metrics';
          for(const w of wins){
            const winEl=document.createElement('span');winEl.className='sibling-win';winEl.dataset.window=w;
            const tagEl=document.createElement('span');tagEl.className='sibling-tag';tagEl.textContent=w==='5h'?'5h':t(sibArgon?'argonWeek':'weekShort');
            const valEl=document.createElement('span');valEl.className='sibling-val';valEl.textContent='—';
            const bar=document.createElement('i');bar.className='sibling-bar';
            const fill=document.createElement('i');bar.append(fill);
            winEl.append(tagEl,valEl,bar);metrics.append(winEl);
          }
          btn.append(lbl,metrics);
          btn.addEventListener('click',()=>{
            const kb=btn.matches(':focus-visible');
            chosen=g.id===autoGroupId?null:g.id;
            render();
            if(kb)sibWrap.querySelector('.quota-sibling')?.focus({preventScroll:true});
          });
          return btn;
        }));
        sibWrap.dataset.signature=sibSig;
      }
      for(const btn of sibWrap.children){
        const g=groups.find(item=>item.id===btn.dataset.group);if(!g)continue;
        const wins=language.quotaWindows(g),sibArgon=language.quotaGroupKind(g)==='gemini-argon';
        const tipParts=[label(g)];
        for(const w of wins){
          const winEl=btn.querySelector(`.sibling-win[data-window="${w}"]`);if(!winEl)continue;
          const b=g?.windows?.[w],rem=language.quotaRemaining(b),val=b?.disabled?t('unavailableQuota'):pct(rem);
          const valEl=winEl.querySelector('.sibling-val'),fillEl=winEl.querySelector('.sibling-bar i');
          if(valEl&&valEl.textContent!==val)valEl.textContent=val;
          if(fillEl){
            style(fillEl,'width',rem!==null?`${rem*100}%`:'0%');
            style(fillEl,'background',rem!==null&&rem<.05?'var(--pulse-danger)':rem!==null&&rem<.2?'var(--pulse-warning)':'');
          }
          const tag=w==='5h'?'5h':t(sibArgon?'argonWeek':'weekShort');
          tipParts.push(`${tag} ${val}`);
        }
        attribute(btn,'title',tipParts.join(' · '));
      }
    }
    attribute($('dot'),'class',`dot ${data.connection}`);attribute($('dot'),'title',t(data.connection==='live'?'live':data.connection==='stale'?'stale':'offline'));neonMascot.sync(composer,node,data);tick();fit();position();
  }
  function tick(){
    if(!root)return;
    for(const [window,name]of[['5h','five'],['weekly','week']]){const b=group?.windows?.[window];text(`${name}-timer`,timer(b?.resetAt,true));text(`${name}-countdown`,timer(b?.resetAt));if(b?.resetAt&&Date.parse(b.resetAt)<=Date.now()&&Date.now()-lastExpiredRefresh>30000){lastExpiredRefresh=Date.now();refresh(true);}}
  }
  function setQuotaBusy(busy){
    const spinner=$('quota-spinner');if(!spinner)return;
    attribute(spinner,'aria-busy',String(busy));hidden(spinner,!busy);
    attribute(spinner,'aria-label',t('refreshing'));
  }
  function hoverQuotaRefresh(){
    if(disposed||instDisposed||parked||!node?.isConnected)return null;
    if(hoverQuotaRequest)return hoverQuotaRequest.promise;
    if(manualRequest)return manualRequest.promise;
    if(Date.now()-lastQuotaHoverAt<QUOTA_HOVER_COOLDOWN)return null;
    lastQuotaHoverAt=Date.now();
    const epoch=requestEpoch,request={};hoverQuotaRequest=request;setQuotaBusy(true);
    request.promise=(async()=>{
      try{if(pending)await refreshRequest;if(!disposed&&!instDisposed&&epoch===requestEpoch)await refresh(false,false,true);}
      finally{if(hoverQuotaRequest===request){hoverQuotaRequest=null;if(!manualRequest)setQuotaBusy(false);}}
    })();
    return request.promise;
  }
  function refreshManually(syncUsage=false){
    if(manualRequest)return manualRequest.promise;
    setQuotaBusy(true);const started=performance.now();
    const epoch=requestEpoch,request={};manualRequest=request;
    request.promise=(async()=>{
      try{if(pending)await refreshRequest;if(!disposed&&!instDisposed&&epoch===requestEpoch)await refresh(true,syncUsage);}
      finally{
        // A fast cached response still needs visible press feedback. This does
        // not delay data updates; only the indicator has a 250ms minimum.
        const remaining=250-(performance.now()-started);
        if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
        if(manualRequest===request){setQuotaBusy(false);manualRequest=null;}
      }
    })();
    return request.promise;
  }
  function refresh(force=false,syncUsage=false,quotaRefresh=false){
    if(disposed||instDisposed)return;
    if(!parked&&syncConversation())render();
    if(pending)return refreshRequest;
    if(!node?.isConnected)return;
    const conversation=parked?lastConversation:conversationId();
    const epoch=requestEpoch;
    const current=()=>!disposed&&!instDisposed&&epoch===requestEpoch&&node?.isConnected&&(parked||(conversation===conversationId()&&conversation===lastConversation));
    pending=true;lastFetch=Date.now();
    refreshRequest=(async()=>{
      const composerModel=currentComposerModel();
      try{const result=await window.agPulseHost.getMetrics({conversationId:conversation,force,...(quotaRefresh?{quotaRefresh:true}:{}),...(composerModel?{composerModel}:{}),...(syncUsage?{usageSync:true}:{})});if(!current())return;if(force||quotaRefresh)lastQuotaHoverAt=Date.now();node.style.visibility=result.enabled===false?'hidden':'';neonMascot.setEnabled(result.enabled!==false);if(result.enabled===false){hide();return;}if(!conversation||result.speed&&result.speed.conversationId!==conversation)result.speed=null;if(result.usage?.scope&&data?.usage?.scope===usageScope.scope&&result.usage.scope!==usageScope.scope)result.usage=data.usage;data=result;hydrated=true;if(result.preferences){syncGuide(result.preferences);preferences.sync(result.preferences);guideReady=!preferences.error;}if(Object.hasOwn(result,'theme'))themeController?.setHostTheme(result.theme);render();}
      catch{if(current()&&data){data.connection='stale';data.error=t('reconnecting');render();}}
      finally{if(epoch===requestEpoch){pending=false;refreshRequest=null;}}
    })();
    return refreshRequest;
  }
  return {
    get node(){return node;},
    get composer(){return composer;},
    get usageDashboard(){return usageDashboard;},
    get parked(){return parked;},
    get parkedKind(){return parkedKind;},
    get neonHost(){return neonMascot.host;},
    ownsNode(target){return neonMascot.ownsNode(target);},
    mountTo,park,dispose,hide,fit,tick,position,updateGuide,stopDensityMotion,
    setPrimary(flag,id){
      const changed=isPrimary!==flag;
      isPrimary=flag;
      if(node&&node.id!==id)node.id=id;
      if(changed)updateGuide();
    },
    onLocaleChanged(){if(root){localize();render();tick();position();}},
    onSpeedStyleChanged(){if(root){attribute(node,'data-speed-style',speedStyle.style);localize();paintSpeed([],'idle',0.36,false);render();tick();position();}},
    onUsageScopeChanged(){if(root){render();}},
    onNeonMascotChanged(){if(root){localize();neonMascot.position();}},
    onContextLimitChanged(){if(root){render();position();}},
    syncUsageGuide(){usageDashboard?.syncGuideDismissed();},
    poll(){
      if(instDisposed||!node)return;
      if(!parked){fit();tick();position();}
      if((!parked&&conversationId()!==lastConversation)||Date.now()-lastFetch>(document.hidden?10000:2200))refresh();
    },
  };
  }
  function scheduleLayout(){
    if(disposed||layoutFrame!==null)return;
    layoutFrame=requestAnimationFrame(()=>{layoutFrame=null;if(disposed)return;mount();for(const inst of instances)if(!inst.parked){inst.fit();inst.position();}});
  }
  function mount(){
    if(disposed)return;
    // A replaced instance's delayed preferences/observer callback must never
    // resurrect it. Also remove identifiable leftovers from older runtimes
    // before measuring the native toolbar or attaching live strips.
    const activeNodes=new Set(instances.map(inst=>inst.node).filter(Boolean));
    const activeMascots=new Set(instances.map(inst=>inst.neonHost).filter(Boolean));
    for(const orphan of document.querySelectorAll('[data-ag-pulse-neon-mascot]'))if(!activeMascots.has(orphan))orphan.remove();
    for(const orphan of document.querySelectorAll('[id^="'+ID+'"],[data-ag-pulse-bar]')){
      if(!activeNodes.has(orphan)&&['speed','cache','context'].every(name=>orphan.shadowRoot?.querySelector('.bar .chip[data-card="'+name+'"]')))orphan.remove();
    }
    const openModal=instances.find(inst=>inst.usageDashboard?.isOpen&&inst.node);
    if(openModal){
      if((!openModal.parked&&(!openModal.node.isConnected||!openModal.node.getClientRects().length))||!openModal.node.isConnected)openModal.park();
      return;
    }
    const foundList=findComposers();
    const used=new Set(),pairs=[];
    for(const found of foundList){
      const exact=instances.find(inst=>!used.has(inst)&&!inst.parked&&((found.box&&inst.composer?.box===found.box)||(inst.composer?.branch===found.branch&&inst.composer?.editor===found.editor)));
      if(exact){used.add(exact);pairs.push([exact,found]);}
      else pairs.push([null,found]);
    }
    for(const pair of pairs){
      if(pair[0])continue;
      const found=pair[1];
      const replacement=instances.find(inst=>!used.has(inst)&&(inst.parked||!inst.composer?.editor?.isConnected)&&(inst.composer?.kind||inst.parkedKind)===found.kind)
        ||instances.find(inst=>!used.has(inst)&&(inst.parked||!inst.composer?.editor?.isConnected));
      if(replacement){used.add(replacement);pair[0]=replacement;}
    }
    const nextInstances=[];
    for(const inst of instances){
      if(used.has(inst))continue;
      // Account usage does not belong to a composer lifecycle. Keep its frame
      // during reflows and park the host if the app replaces the input subtree.
      if(inst.usageDashboard?.isOpen&&inst.node){inst.park();nextInstances.push(inst);}
      else inst.dispose();
    }
    const attached=[];
    for(const [existing,found]of pairs){
      const inst=existing||createStripInstance();
      inst.mountTo(found);
      attached.push(inst);
    }
    instances.splice(0,instances.length,...attached,...nextInstances);
    const primary=attached.find(inst=>['main','ide'].includes(inst.composer?.kind)&&!(inst.composer.box||inst.composer.row).closest(PANE_BOUNDARY))||attached[0]||nextInstances[0]||null;
    let secondaryIndex=2;
    for(const inst of instances)if(inst!==primary)inst.setPrimary(false,`${ID}-${secondaryIndex++}`);
    if(primary)primary.setPrimary(true,ID);
  }
  const observer=new MutationObserver(records=>{if(records.some(record=>!isOwnNode(record.target)))scheduleLayout();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden','inert','data-cascade-id','data-testid','data-tooltip-id','aria-label','role','contenteditable']});
  const onKey=e=>{if(e.key==='Escape')for(const inst of instances)inst.hide();}, onPointer=e=>{for(const inst of instances)if(inst.node&&!e.composedPath().includes(inst.node))inst.hide();};
  const onFocus=e=>{if(!instances.length||!e.composedPath().some(isOwnNode))scheduleLayout();};
  const onMotionChange=()=>{for(const inst of instances)inst.stopDensityMotion();};
  document.addEventListener('keydown',onKey);document.addEventListener('pointerdown',onPointer);document.addEventListener('focusin',onFocus);
  window.addEventListener('resize',scheduleLayout);document.addEventListener('scroll',scheduleLayout,true);
  densityMedia.addEventListener('change',onMotionChange);
  const timerId=setInterval(()=>{mount();for(const inst of instances)inst.poll();},1000);
  window.__agPulseDispose=()=>{
    disposed=true;
    clearInterval(timerId);if(layoutFrame!==null)cancelAnimationFrame(layoutFrame);observer.disconnect();preferences.dispose();neonMascotPref.dispose();contextLimitPref.dispose();
    for(const inst of instances.splice(0))inst.dispose();
    document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',onPointer);document.removeEventListener('focusin',onFocus);
    document.removeEventListener('scroll',scheduleLayout,true);window.removeEventListener('resize',scheduleLayout);
    densityMedia.removeEventListener('change',onMotionChange);
    document.removeEventListener('DOMContentLoaded',mount);
    window.__agPulseInlineInstalled=false;delete window.__agPulseDispose;
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
};
