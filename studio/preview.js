window.StudioPreview = (() => {
    const viewport=document.querySelector('.preview-scroll'),wrap=document.getElementById('paper-wrap'),host=document.getElementById('paper-host');
    const select=document.getElementById('preview-zoom'),minus=document.getElementById('zoom-out'),plus=document.getElementById('zoom-in');
    const steps=[.25,.5,.75,1,1.25,1.5,2,3],storageKey='md2handwriting-next-preview-zoom';
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    let mode='fit-width',scale=1,initialized=false,drag=null,wheelMotion=null,lastWidth=0,lastHeight=0;
    const pageSize=()=>({width:host.firstElementChild?.offsetWidth||800,height:host.firstElementChild?.offsetHeight||1131});
    try{const saved=JSON.parse(localStorage.getItem(storageKey));if(['fit-width','fit-page','manual'].includes(saved?.mode)){mode=saved.mode;if(Number.isFinite(saved.scale))scale=Math.max(.25,Math.min(3,saved.scale));}}catch{}
    function fit(kind){const page=pageSize(),style=getComputedStyle(viewport),width=viewport.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=viewport.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);return Math.max(.05,Math.min(3,kind==='fit-page'?Math.min(width/page.width,height/page.height):width/page.width));}
    function sync(){
        select.querySelector('[value="fit-width"]').textContent=`适应宽度 · ${Math.round(fit('fit-width')*100)}%`;
        select.querySelector('[value="fit-page"]').textContent=`整页 · ${Math.round(fit('fit-page')*100)}%`;
        let custom=select.querySelector('[value="custom"]');const preset=steps.find(n=>Math.abs(n-scale)<.000001);
        if(mode==='manual'&&preset===undefined){if(!custom){custom=new Option('','custom');select.add(custom);}custom.textContent=Math.round(scale*100)+'%';select.value='custom';}
        else{custom?.remove();select.value=mode==='manual'?String(preset):mode;}
        const empty=!host.firstElementChild;minus.disabled=empty||scale<=.25;plus.disabled=empty||scale>=3;select.disabled=empty;
        viewport.classList.toggle('can-pan',wrap.offsetWidth>viewport.clientWidth||wrap.offsetHeight>viewport.clientHeight);
        StudioControls.sync('preview-zoom');
    }
    function apply(next,anchor=null,reset=false){
        if(!Number.isFinite(next)||next<=0)return;
        const page=pageSize();if(page.width!==lastWidth||page.height!==lastHeight){reset=true;lastWidth=page.width;lastHeight=page.height;}
        if(!reset&&initialized&&Math.abs(next-scale)<.00001){sync();return;}
        const old=wrap.getBoundingClientRect(),bounds=viewport.getBoundingClientRect();
        const point=anchor||{x:bounds.left+viewport.clientWidth/2,y:bounds.top+viewport.clientHeight/2};
        const x=point.paperX??(point.x-old.left)/scale,y=point.paperY??(point.y-old.top)/scale;
        const preserve=initialized&&!reset;scale=next;
        host.style.width=page.width+'px';host.style.setProperty('--preview-scale',scale);host.style.transform=`scale(${scale})`;wrap.style.width=page.width*scale+'px';wrap.style.height=page.height*scale+'px';
        if(preserve){const current=wrap.getBoundingClientRect();viewport.scrollLeft+=current.left+x*scale-point.x;viewport.scrollTop+=current.top+y*scale-point.y;}
        else{viewport.scrollLeft=0;viewport.scrollTop=0;}
        initialized=true;sync();
        window.dispatchEvent(new CustomEvent('studio-zoom',{detail:scale}));
    }
    function save(){try{localStorage.setItem(storageKey,JSON.stringify({mode,scale}));}catch{}}
    function stopWheel(){if(!wheelMotion)return;cancelAnimationFrame(wheelMotion.frame);wheelMotion=null;save();}
    function manual(next,anchor){stopWheel();mode='manual';apply(Math.max(.25,Math.min(3,next)),anchor);save();}
    function animateWheel(now){
        const motion=wheelMotion;if(!motion)return;
        const dt=Math.max(1,Math.min(32,now-motion.time));motion.time=now;
        // Frame-rate-independent easing: new wheel input changes the target, not the
        // current rendered size. Stop within half a CSS pixel to avoid a long tail.
        const done=Math.abs(motion.target-scale)*pageSize().width<.5;
        apply(done?motion.target:scale+(motion.target-scale)*(1-Math.exp(-dt/45)),motion.anchor);
        if(done){wheelMotion=null;save();}else motion.frame=requestAnimationFrame(animateWheel);
    }
    const toolbar=document.querySelector('.preview-toolbar');
    toolbar.addEventListener('pointerdown',stopWheel,{capture:true});
    toolbar.addEventListener('keydown',stopWheel,{capture:true});
    function refresh(){const page=pageSize();if(page.width!==lastWidth||page.height!==lastHeight)stopWheel();apply(mode==='manual'?scale:fit(mode));}
    plus.onclick=()=>manual(steps.find(n=>n>scale+.001)||3);
    minus.onclick=()=>manual([...steps].reverse().find(n=>n<scale-.001)||.25);
    select.onchange=()=>{if(select.value==='custom')return;if(select.value.startsWith('fit-')){stopWheel();mode=select.value;apply(fit(mode),null,true);save();}else manual(Number(select.value));};
    document.getElementById('zoom-fit').onclick=()=>{stopWheel();mode='fit-width';apply(fit(mode),null,true);save();};
    viewport.addEventListener('wheel',event=>{
        if(!(event.ctrlKey||event.metaKey)||!host.firstElementChild){stopWheel();return;}
        event.preventDefault();const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);
        if(!delta)return;
        const direction=Math.sign(delta),bounds=wrap.getBoundingClientRect();
        const previous=wheelMotion;
        const anchor=previous&&Math.hypot(event.clientX-previous.anchor.x,event.clientY-previous.anchor.y)<1?previous.anchor:
            {x:event.clientX,y:event.clientY,paperX:(event.clientX-bounds.left)/scale,paperY:(event.clientY-bounds.top)/scale};
        // A wheel detent now changes the target by about 14%, with sub-pixel deltas
        // retained for touchpads. Reversing direction takes effect immediately.
        const base=previous&&previous.direction===direction?previous.target:scale;
        const target=Math.max(.25,Math.min(3,base*Math.exp(-Math.max(-250,Math.min(250,delta))*.0011)));
        if(reducedMotion.matches){manual(target,anchor);return;}
        mode='manual';
        if(previous){previous.target=target;previous.anchor=anchor;previous.direction=direction;}
        else{wheelMotion={target,anchor,direction,time:performance.now(),frame:0};wheelMotion.frame=requestAnimationFrame(animateWheel);}
    },{passive:false});
    viewport.addEventListener('pointerdown',event=>{
        stopWheel();
        if(window.StudioEditor?.enabled&&!StudioEditor.panKey)return;
        if(event.button!==0||event.pointerType!=='mouse'||!event.target.closest('#paper-wrap')||!viewport.classList.contains('can-pan'))return;
        drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(event.pointerId);event.preventDefault();
    });
    viewport.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>3)viewport.classList.add('panning');viewport.scrollLeft=drag.left+drag.x-event.clientX;viewport.scrollTop=drag.top+drag.y-event.clientY;});
    function finish(){if(!drag)return;const id=drag.id;drag=null;viewport.classList.remove('panning');if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);}
    viewport.addEventListener('pointerup',finish);viewport.addEventListener('pointercancel',finish);viewport.addEventListener('lostpointercapture',finish);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')stopWheel();});
    new ResizeObserver(refresh).observe(viewport);refresh();
    return {refresh};
})();
