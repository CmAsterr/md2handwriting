(function(root,factory){if(typeof module==='object')module.exports=factory(require('./core'),require('./pen-geometry'));else root.SetSymbols=factory(root.StudioCore,root.PenGeometry);})(globalThis,function(C,G){
    'use strict';
    const VERSION='set-symbols-v1',letters={'ℕ':'N','ℚ':'Q','ℤ':'Z','ℝ':'R','ℂ':'C'},ns='http://www.w3.org/2000/svg';
    const handles=ch=>Object.hasOwn(letters,ch);
    function nib(p,shape,settings){const base=settings.penWidth||1,factor=shape.ink/base;p.dataset.setInkFactor=String(factor);p.style.strokeWidth=`calc(var(--pen-width, ${base}px) * ${factor})`;}
    function draw(ch,box,settings,key,unit=1){
        if(!handles(ch)||!(box.width>0)||!(box.height>0))return null;
        const width=Math.max(.001,box.width*Math.abs(unit)),height=Math.max(.001,box.height*Math.abs(unit));
        // Very small superscripts cannot fit two full-width strokes. Cap only
        // these symbols' nib when necessary, keeping the double stroke readable.
        const ink=Math.min(settings.penWidth||1,width*.17,height*.16),gap=Math.max(.22,Math.min(.34,ink*1.85/width));
        let source;
        switch(letters[ch]){
            case 'N':source=`M.12 .95C.12 .66 .15 .29 .17 .06M${.12+gap} .95C${.12+gap} .69 ${.15+gap} .30 ${.17+gap} .09M.17 .12C.36 .35 .69 .69 .84 .94M.84 .99C.86 .67 .89 .26 .91 .05`;break;
            case 'Q':source='M.28 .17C.08 .23 .06 .62 .22 .77C.39 .93 .72 .87 .83 .69C.95 .49 .88 .20 .71 .12C.55 .03 .38 .08 .28 .17M.34 .02C.33 .26 .34 .64 .34 .90M.69 .63C.76 .76 .88 .88 .98 .98';break;
            case 'Z':source=`M.04 .13C.29 .11 .63 .12 ${.66+gap} .12M.24 .88C.49 .87 .78 .89 .98 .86M.66 .12C.54 .36 .34 .71 .24 .88M${.66+gap} .12C${.54+gap} .36 ${.34+gap} .71 ${.24+gap} .94`;break;
            case 'R':source=`M.12 .94C.10 .65 .10 .31 .08 .10M${.12+gap} .99C${.11+gap} .64 ${.08+gap} .28 ${.08+gap} .06M.08 .10C.39 .015 .80 .08 .86 .33C.94 .54 .44 .58 .10 .57M.11 .57C.31 .67 .70 .79 .97 .93`;break;
            case 'C':source='M.89 .11C.74 .025 .40 .04 .23 .24C.07 .41 .035 .64 .13 .80C.22 .96 .45 .94 .61 .88C.75 .83 .85 .74 .97 .64M.34 .09C.32 .31 .35 .77 .35 .98';break;
        }
        const r=C.random(`${settings.seed||1}:${VERSION}:${ch}:${key}`),n=Math.pow(Math.max(0,Math.min(100,settings.naturalness||0))/100,.85),lean=(r()-.5)*.07*n,bow=(r()-.5)*.035*n,phase=r()*Math.PI*2;
        const shape=(u,v)=>{const x=.02+.96*u+lean*(v-.5)+bow*Math.sin(Math.PI*v),y=.02+.96*v+.012*n*Math.sin(Math.PI*u+phase)*Math.sin(Math.PI*v);return[box.x+x*box.width,box.y+(1-y)*box.height];};
        return{path:G.bendStroke(source,shape,Math.max(width,height),7),ink,gap,strokes:(source.match(/M/g)||[]).length};
    }
    function textGlyph(ch,family,settings,key){
        const units=family?.units||1000,existing=family?.glyphs?.[ch],box=existing?.width&&existing?.height?existing:{x:units*.06,y:0,width:units*.73,height:units*.76},advance=existing?.advance||units*.86,ascent=family?.ascent||units*.85,descent=family?.descent||-units*.2;
        const shape=draw(ch,box,settings,key,(settings.fontSize||27)/units);if(!shape)return null;
        const svg=document.createElementNS(ns,'svg');svg.classList.add('monoline-glyph');svg.setAttribute('viewBox',`0 ${-ascent} ${advance} ${ascent-descent}`);svg.style.width=advance/units+'em';svg.style.height=(ascent-descent)/units+'em';svg.style.verticalAlign=descent/units+'em';svg.setAttribute('aria-label',ch);svg.dataset.setSymbol=ch;svg.dataset.inkFallback='set-symbol';svg.dataset.inkChar=ch;
        const title=document.createElementNS(ns,'title');title.textContent=ch;const p=document.createElementNS(ns,'path');p.setAttribute('d',shape.path);p.setAttribute('transform','scale(1 -1)');p.classList.add('ballpoint-stroke');nib(p,shape,settings);svg.append(title,p);return svg;
    }
    function applyMath(root,settings,key){
        if(settings.fallbackStyle!=='hand')return;
        let occurrence=0;
        // Run after the original painter: changing these five drawings must not
        // alter the random sequence or generic fallback indices of other glyphs.
        for(const p of root.querySelectorAll('.math path')){
            const ch=p.dataset.handChar||p.dataset.mathText||(p.dataset.c?String.fromCodePoint(parseInt(p.dataset.c,16)):'');if(!handles(ch))continue;
            const b=p.getBBox(),m=p.getScreenCTM();if(!m)continue;const shape=draw(ch,b,settings,`${key}:${occurrence++}`,Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)));if(!shape)continue;
            p.setAttribute('d',shape.path);p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.classList.add('ballpoint-stroke');nib(p,shape,settings);delete p.dataset.inkFill;
            p.dataset.setSymbol=ch;p.dataset.handModel='set-symbol';p.dataset.inkFallback='set-symbol';p.dataset.inkChar=ch;p.dataset.centerline='true';
        }
    }
    return{VERSION,handles,draw,textGlyph,applyMath};
});
