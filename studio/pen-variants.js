(function(root,factory){if(typeof module==='object')module.exports=factory(require('./core'),require('./pen-geometry'));else root.PenVariants=factory(root.StudioCore,root.PenGeometry);})(globalThis,function(C,G){
    'use strict';
    const VERSION='v2',COUNT=8;
    function amount(settings){return Math.round(Math.max(0,Math.min(100,settings.glyphVariation??55))*Math.pow(Math.max(0,Math.min(100,settings.naturalness??35))/100,.85)*10);}
    // A document-wide bias, not a new independent writer for every character.
    function writer(seed){const r=C.random('writer:'+seed);return Array.from({length:6},()=>r()*2-1);}
    function slot(seed,key,ch,occurrence){return(C.hash(`${seed}:${key}:${ch}`)+occurrence*3)%COUNT;}
    function expressive(box,{seed,ch,slot,amount,kind}){
        const w=Math.max(.001,box.width),h=Math.max(.001,box.height),habit=writer(seed),r=C.random(`expressive:${seed}:${ch}:${slot}`);
        const profiles=[[.68,-.42,.24,-.18,.20],[-.68,.42,-.24,.18,-.20],[.25,.68,-.20,.25,-.18],[-.25,-.68,.20,-.25,.18],[.50,.46,.28,.20,.26],[-.50,-.46,-.28,-.20,-.26],[.06,-.08,.40,-.34,.38],[-.06,.08,-.40,.34,-.38]];
        const p=profiles[slot%COUNT].map((v,i)=>v*.9+habit[i]*.07+(r()-.5)*.08);
        const latin=/^[\p{Script=Latin}\p{M}0-9]+$/u.test(ch),strength=Math.max(0,Math.min(1000,amount))/1000*(kind==='math'?.62:latin?.82:1);
        // Compose triangular monotone maps. Each derivative in its own axis is
        // positive, so even strong component shifts cannot fold a glyph.
        const bias=(t,power)=>{const e=Math.exp(power);return t<0?t/e:t>1?1+(t-1)*e:t/(t+e*(1-t));};
        const waist=(t,power)=>t<0?t*(1+power):t>1?1+(t-1)*(1+power):t+power*Math.sin(2*Math.PI*t)/(2*Math.PI);
        return(x,y)=>{const u=(x-box.x)/w,v=(y-box.y)/h;
            const sx=waist(bias(u,strength*(p[0]+p[4]*(2*v-1))),strength*p[2]);
            const sy=waist(bias(v,strength*(p[1]+p[4]*.6*(2*sx-1))),strength*p[3]);
            return[box.x+w*sx,box.y+h*sy];};
    }
    function warp(box,{seed,ch,slot,amount,style='subtle',kind}){
        if(style==='expressive')return expressive(box,{seed,ch,slot,amount,kind});
        const w=Math.max(.001,box.width),h=Math.max(.001,box.height),habit=writer(seed),r=C.random(`shape:${seed}:${ch}:${slot}`);
        const latin=/^[\p{Script=Latin}\p{M}0-9]+$/u.test(ch),gain=(latin?.045:.075)*Math.max(0,Math.min(1000,amount))/1000;
        const coefficients=habit.map(v=>v*.42+(r()*2-1)*.58),[a,b,c,d,e,f]=coefficients;
        // Low-frequency, boundary-pinned deformation keeps counters, junctions,
        // advance width and reading order. All disconnected strokes share one map.
        return(x,y)=>{const u=(x-box.x)/w,v=(y-box.y)/h;
            return[x+gain*w*Math.sin(Math.PI*u)*(a*.55+b*(2*v-1)*.3+c*Math.sin(2*Math.PI*v)*.3),
                y+gain*h*Math.sin(Math.PI*v)*(d*.55+e*(2*u-1)*.3+f*Math.sin(2*Math.PI*u)*.3)];};
    }
    function path(source,box,units,descriptor){if(!descriptor.amount||!box.width||!box.height)return source;return G.bendStroke(source,warp(box,descriptor),24/units,8);}
    return{VERSION,COUNT,amount,writer,slot,warp,path};
});
