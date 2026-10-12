(function(root,factory){if(typeof module==='object')module.exports=factory(require('./core'),require('./pen-geometry'));else root.FallbackInk=factory(root.StudioCore,root.PenGeometry);})(globalThis,function(C,G){
    const VERSION='fallback-v3';
    function field(box,settings,key){
        const r=C.random(`${settings.seed}:${VERSION}:${key}`),n=Math.pow(Math.max(0,Math.min(100,settings.naturalness??35))/100,.85),w=Math.max(.001,box.width),h=Math.max(.001,box.height);
        const a=(r()-.5)*1.1*n,b=(r()-.5)*.95*n,c=(r()-.5)*.7*n,d=(r()-.5)*.6*n,phase=r()*Math.PI*2;
        const bias=(t,p)=>{const e=Math.exp(p);return t<0?t/e:t>1?1+(t-1)*e:t/(t+e*(1-t));};
        // Triangular monotone maps preserve holes, crossings and stroke order.
        return(x,y)=>{const u=(x-box.x)/w,v=(y-box.y)/h,s=.055*n+(1-.11*n)*bias(u,a+c*Math.sin(Math.PI*v))+.04*n*Math.sin(Math.PI*v+phase);const t=.035*n+(1-.07*n)*bias(v,b+d*Math.sin(Math.PI*s))+.025*n*Math.sin(Math.PI*s-phase);return[box.x+s*w,box.y+t*h];};
    }
    function path(source,box,settings,key,unit=1){return settings.naturalness?G.bendStroke(source,field(box,settings,key),unit,7):source;}
    function apply(root,settings,key){
        if(settings.fallbackStyle!=='hand')return;
        for(const [i,p]of [...root.querySelectorAll('path[data-ink-fallback="math-default"]')].entries()){
            if(p.dataset.fallbackApplied)continue;const box=p.getBBox(),m=p.getScreenCTM();if(!m||!box.width||!box.height)continue;
            p.setAttribute('d',path(p.getAttribute('d'),box,settings,`${key}:${p.dataset.c||''}:${i}`,Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d))));p.dataset.fallbackApplied='true';
        }
    }
    function audit(root){const items=new Map();for(const node of root.querySelectorAll('[data-ink-fallback]')){const kind=node.dataset.inkFallback;if(kind==='selected')continue;const char=node.dataset.inkChar||node.dataset.mathText||(node.dataset.c?String.fromCodePoint(parseInt(node.dataset.c,16)):node.textContent);if(!char?.trim())continue;const k=kind+':'+char;const item=items.get(k)||{kind,char,count:0};item.count++;items.set(k,item);}return [...items.values()];}
    function summary(blocks){const items=new Map();for(const b of blocks)for(const item of b.fallbacks||[]){const key=item.kind+':'+item.char;const entry=items.get(key)||{...item,count:0};entry.count+=item.count;items.set(key,entry);}return [...items.values()];}
    return{VERSION,field,path,apply,audit,summary};
});
