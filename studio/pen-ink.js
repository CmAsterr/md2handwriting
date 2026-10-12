window.PenInk = (() => {
    const ns='http://www.w3.org/2000/svg';
    const point=(m,x,y)=>[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f];
    function paint(path,settings,r,model){
        const style=getComputedStyle(path),color=style.fill==='none'?style.stroke:style.fill;
        if(color&&color!=='none'&&!color.startsWith('url('))path.style.color=color;
        path.style.strokeWidth='';path.removeAttribute('stroke-width');path.setAttribute('opacity',PenGestures.opacity(settings,r));
        if(path.dataset.inkFill){path.classList.remove('ballpoint-stroke');path.setAttribute('fill','currentColor');path.setAttribute('stroke','none');}
        else{path.classList.add('ballpoint-stroke');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');}
        path.dataset.handModel=model;if(settings.naturalness)path.dataset.handDeformed='true';
        if(model!=='glyph'){path.dataset.handStroke='true';path.dataset.handCenterline=path.getAttribute('d');}
    }
    function stroke(host,d,settings,r,model='stroke'){
        const path=document.createElementNS(ns,'path');path.setAttribute('d',d);host.append(path);paint(path,settings,r,model);return path;
    }
    function warp(paths,settings,r,model,{factory,gain=1,math=true,limitX=Infinity,limitY=Infinity,fast=false}={}){
        const entries=paths.filter(p=>p.getAttribute('d')).map(path=>({path,matrix:path.getScreenCTM(),box:path.getBoundingClientRect()})).filter(e=>e.matrix&&Math.abs(e.matrix.a*e.matrix.d-e.matrix.b*e.matrix.c)>1e-12);
        if(!entries.length)return;
        const left=Math.min(...entries.map(e=>e.box.left)),top=Math.min(...entries.map(e=>e.box.top)),right=Math.max(...entries.map(e=>e.box.right)),bottom=Math.max(...entries.map(e=>e.box.bottom));
        const bounds={x:left,y:top,width:right-left,height:bottom-top};
        const field=factory?factory(bounds):PenGestures.operator(bounds,settings,r,{gain,math,limitX,limitY});
        for(const {path,matrix} of entries){
            if(settings.naturalness){const inverse=matrix.inverse(),unit=Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d));
                const transform=(x,y)=>point(inverse,...field(...point(matrix,x,y)));
                path.setAttribute('d',fast?PenGeometry.deformPath(path.getAttribute('d'),transform):PenGeometry.bendStroke(path.getAttribute('d'),transform,unit,8));
            }
            paint(path,settings,r,model);
        }
    }
    function primitive(element){
        if(element.hasAttribute('data-bgcolor'))return null;
        const tag=element.tagName.toLowerCase(),get=(name,def=0)=>Number(element.getAttribute(name)??def),style=getComputedStyle(element),matrix=element.getScreenCTM();
        let d='',rule=false,filled=false;
        if(tag==='line'){d=`M${get('x1')} ${get('y1')}L${get('x2')} ${get('y2')}`;rule=true;}
        else if(tag==='rect'){
            const x=get('x'),y=get('y'),w=get('width'),h=get('height');if(!w||!h)return null;
            if(style.fill!=='none'&&w>h*4){d=`M${x} ${y+h/2}L${x+w} ${y+h/2}`;rule=true;}
            else if(style.fill!=='none'&&h>w*4){d=`M${x+w/2} ${y}L${x+w/2} ${y+h}`;rule=true;}
            else{const radius=Math.min(get('rx'),w/2,h/2);d=radius?`M${x+radius} ${y}H${x+w-radius}Q${x+w} ${y} ${x+w} ${y+radius}V${y+h-radius}Q${x+w} ${y+h} ${x+w-radius} ${y+h}H${x+radius}Q${x} ${y+h} ${x} ${y+h-radius}V${y+radius}Q${x} ${y} ${x+radius} ${y}Z`:`M${x} ${y}H${x+w}V${y+h}H${x}Z`;filled=style.fill!=='none';}
        }else if(tag==='circle'||tag==='ellipse'){
            const x=get('cx'),y=get('cy'),rx=get(tag==='circle'?'r':'rx'),ry=get(tag==='circle'?'r':'ry'),k=.55228475;
            d=`M${x+rx} ${y}C${x+rx} ${y+ry*k} ${x+rx*k} ${y+ry} ${x} ${y+ry}C${x-rx*k} ${y+ry} ${x-rx} ${y+ry*k} ${x-rx} ${y}C${x-rx} ${y-ry*k} ${x-rx*k} ${y-ry} ${x} ${y-ry}C${x+rx*k} ${y-ry} ${x+rx} ${y-ry*k} ${x+rx} ${y}Z`;filled=style.fill!=='none';
        }else if(tag==='polygon'||tag==='polyline'){
            const numbers=(element.getAttribute('points')||'').match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number)||[];
            if(numbers.length<4)return null;d=`M${numbers[0]} ${numbers[1]}`;for(let i=2;i+1<numbers.length;i+=2)d+=`L${numbers[i]} ${numbers[i+1]}`;if(tag==='polygon')d+='Z';filled=tag==='polygon'&&style.fill!=='none';
        }
        if(!d)return null;
        const owner=element.parentElement,path=document.createElementNS(ns,'path'),group=document.createElementNS(ns,'g');
        for(const name of ['transform','class','style','color','stroke'])if(element.hasAttribute(name))path.setAttribute(name,element.getAttribute(name));
        path.setAttribute('d',d);path.dataset.inkPrimitive=tag;if(filled)path.dataset.inkFill='true';
        path.style.color=style.fill==='none'?style.stroke:style.fill;path.setAttribute('fill',filled?'currentColor':'none');
        if(style.strokeDasharray!=='none'&&matrix){const unit=Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d));path.style.strokeDasharray=style.strokeDasharray.split(/[ ,]+/).map(n=>parseFloat(n)*unit+'px').join(' ');}
        if(rule)group.dataset.handRule='true';group.append(path);element.replaceWith(group);return{path,owner,rule};
    }
    const clearance=gap=>Math.max(.3,gap*.45);
    function mathematics(root,settings,key){
        for(const [index,span] of [...root.querySelectorAll('.math')].entries()){
            const r=StudioCore.random(`${settings.seed}:math:${span.dataset.tex}:${index}:${key}`);
            const records=[...span.querySelectorAll('rect,line,polyline,polygon,circle,ellipse')].map(primitive).filter(Boolean);
            // Canonical large symbols retain their recognizable pen gestures.
            for(const mo of span.querySelectorAll('[data-mml-node="mo"]')){
                const code=mo.querySelector('path[data-c]')?.dataset.c;
                if(['2C6','5E','2C7','30C'].includes(code)&&['mover','munder','munderover'].includes(mo.parentElement.dataset.mmlNode)){
                    const b=mo.getBBox(),up=['2C6','5E'].includes(code),y=v=>b.y+b.height*(up?v:1-v),path=document.createElementNS(ns,'path');
                    path.setAttribute('d',`M${b.x+b.width*.02} ${y(.18)}L${b.x+b.width*.5} ${y(.85)}L${b.x+b.width*.98} ${y(.18)}`);path.dataset.c=code;path.dataset.centerline='true';path.dataset.preparedAccent='true';mo.replaceChildren(path);continue;
                }
                if(!StudioLargeSymbols.handles(code))continue;
                const b=mo.getBBox(),m=mo.getScreenCTM(),unit=Math.hypot(m.a,m.b);if(!b.width||!b.height)continue;
                StudioLargeSymbols.draw(mo,code,b,settings,r,unit,(host,d)=>stroke(host,d,settings,r,'symbol'));
            }
            // Radical stem and its bar move in the same coordinate frame. Nested
            // radicals each own their own ink, never the radicand's text paths.
            for(const radical of span.querySelectorAll('[data-mml-node="msqrt"],[data-mml-node="mroot"]')){
                const paths=[...radical.querySelectorAll(':scope > [data-mml-node="mo"] path')],bars=records.filter(e=>e.owner===radical).map(e=>e.path);
                if(!paths.length&&!bars.length)continue;paths.push(...bars);
                const content=[...radical.children].find(e=>e.tagName==='g'&&e.dataset.mmlNode!=='mo'&&!e.dataset.handRule),bar=bars[0]?.getBoundingClientRect();
                const gap=content&&bar?content.getBoundingClientRect().top-(bar.top+bar.bottom)/2:4;
                warp(paths,settings,r,'radical',{factory:b=>PenGestures.field(b,settings,r,{limitX:settings.fontSize*.13,limitY:clearance(gap)})});
            }
            for(const mo of span.querySelectorAll('[data-mml-node="mo"]')){
                const paths=[...mo.querySelectorAll('path')].filter(p=>!p.dataset.handModel);if(!paths.length)continue;
                const parent=mo.parentElement,accent=['mover','munder','munderover'].includes(parent.dataset.mmlNode)&&parent.firstElementChild!==mo;
                let limitY=Infinity;
                if(accent){const base=parent.firstElementChild.getBoundingClientRect(),b=mo.getBoundingClientRect(),gap=Math.max(base.top-b.bottom,b.top-base.bottom);if(gap>0)limitY=clearance(gap);}
                if(paths.some(p=>p.dataset.preparedAccent))limitY=Math.min(.45,Array.isArray(limitY)?Math.min(...limitY):limitY);
                warp(paths,settings,r,accent?'accent':'operator',{limitY,gain:paths.every(p=>p.dataset.handGlyph)? .55:1});
            }
            // Boxes, cancellation strokes, and MathJax array rules also use a
            // shared field, so intersections and closed corners stay joined.
            const owners=new Set(records.filter(e=>!e.path.dataset.handModel&&['menclose','mtable'].includes(e.owner.dataset.mmlNode)).map(e=>e.owner));
            for(const owner of owners){const paths=records.filter(e=>e.owner===owner&&!e.path.dataset.handModel).map(e=>e.path);warp(paths,settings,r,owner.dataset.mmlNode==='mtable'?'math-table':'enclosure',{factory:b=>PenGestures.field(b,settings,r,{limitX:settings.fontSize*.16,limitY:settings.fontSize*.16})});}
            for(const {path,owner} of records){
                if(path.dataset.handModel)continue;
                if(owner.dataset.mmlNode==='mfrac'){
                    const bar=path.getBoundingClientRect(),y=(bar.top+bar.bottom)/2,parts=[...owner.children].filter(e=>e.tagName==='g'&&!e.dataset.handRule).map(e=>e.getBoundingClientRect());
                    const limits=parts.length>=2?[clearance(y-parts[0].bottom),clearance(parts[1].top-y)]:Infinity;
                    warp([path],settings,r,'fraction',{limitY:limits});
                }else warp([path],settings,r,'primitive');
            }
            // No operator-code allowlist here: any normalized path not handled
            // above receives the common compact-glyph model.
            for(const path of span.querySelectorAll('path:not([data-hand-model])')){
                if(!path.getAttribute('d'))continue;
                if(path.dataset.inkFallback==='font'){
                    // Newly supplied SVG text did not consume the legacy formula
                    // random stream. Keep every following selected-font glyph stable.
                    warp([path],settings,StudioCore.random(`${settings.seed}:fallback-text:${key}:${index}:${path.dataset.inkChar}`),'glyph',{gain:.48,limitX:.85,limitY:.85});continue;
                }
                if(path.closest('[data-mml-node="mi"],[data-mml-node="mn"]')&&!path.dataset.inkFill){
                    const variant=Math.floor(r()*8);path.dataset.handVariant=String(variant);
                    const amount=PenVariants.amount(settings),code=Number.parseInt(path.dataset.c||'',16),ch=path.dataset.handChar||(Number.isFinite(code)?String.fromCodePoint(code).normalize('NFKC'):'math');
                    warp([path],settings,r,'glyph',{factory:b=>settings.glyphStyle==='expressive'&&amount&&b.width>.1&&b.height>.1?PenVariants.warp(b,{seed:settings.seed,ch,slot:variant,amount,style:'expressive',kind:'math'}):PenGestures.glyph(b,settings,r,variant)});
                }else warp([path],settings,r,'glyph',{gain:.48,fast:!path.dataset.inkFill,limitX:.85,limitY:.85});
            }
        }
    }
    return{paint,stroke,warp,mathematics};
})();
