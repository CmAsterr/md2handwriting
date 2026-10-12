window.PenFonts = (() => {
    const ns='http://www.w3.org/2000/svg',families=new Map(),paths=new Map(),bases=new Map(),variants=new Map(),mathExtras=new Map();
    const MAX_VARIANT_BYTES=8*1024*1024;let variantBytes=0,variantHits=0,variantBuilds=0;
    const segmenter=new Intl.Segmenter('zh',{granularity:'grapheme'});
    async function api(url,value){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const result=await response.json();if(!response.ok)throw new Error(result.error||'笔画准备失败');return result;}
    function definitions(){let defs=document.getElementById('monoline-font-defs');if(!defs){const svg=document.createElementNS(ns,'svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';svg.setAttribute('aria-hidden','true');defs=document.createElementNS(ns,'defs');defs.id='monoline-font-defs';svg.append(defs);document.body.append(svg);}return defs;}
    async function load(chars,name,fallbackStyle='original'){
        const familyKey=name+':'+fallbackStyle;if(!families.has(familyKey))families.set(familyKey,{glyphs:{}});const family=families.get(familyKey);
        const missing=Array.from(chars).filter(ch=>ch.length<=32&&!Object.hasOwn(family.glyphs,ch));
        for(let i=0;i<missing.length;i+=256){const result=await api('/md2handwriting/api/pen-font',{type:'text',font:name,chars:missing.slice(i,i+256),fallbackStyle});Object.assign(family,{id:result.id,units:result.units,ascent:result.ascent,descent:result.descent});Object.assign(family.glyphs,result.glyphs);}
        const defs=definitions();
        for(const ch of chars){const glyph=family.glyphs[ch];if(!glyph)continue;glyph.id=`pen-${family.id}-${glyph.fallback?'fallback-v4-'+glyph.sourceId+'-':''}${Array.from(ch,c=>c.codePointAt(0).toString(16)).join('-')}`;bases.set(glyph.id,{glyph,units:family.units,ch});
            if(!document.getElementById(glyph.id)){const path=document.createElementNS(ns,'path');path.id=glyph.id;path.setAttribute('d',glyph.path);path.setAttribute('fill',glyph.filled?'currentColor':'none');path.setAttribute('stroke',glyph.filled?'none':'currentColor');path.style.strokeWidth='inherit';path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.setAttribute('vector-effect','non-scaling-stroke');defs.append(path);}}
        return family;
    }
    async function prepare(root,name,settings={},warnings=new Set()){
        const chars=new Set(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
        while((node=walker.nextNode()))if(!node.parentElement.closest('.math,pre,code,.ink-mark,svg'))for(const {segment} of segmenter.segment(node.data))chars.add(segment);
        const family=await load(chars,name,settings.fallbackStyle);const missing=[...chars].filter(ch=>ch.trim()&&!family.glyphs[ch]&&!(settings.fallbackStyle==='hand'&&SetSymbols.handles(ch)));if(missing.length&&settings.fallbackStyle==='hand')warnings.add('这些字符未找到可用笔画，仍使用系统字体：'+missing.slice(0,16).join(' '));return family;
    }
    async function normalizeText(root,name,warnings,settings={}){
        const nodes=[...root.querySelectorAll('.math svg text')];if(!nodes.length)return;
        const chars=new Set();for(const node of nodes)for(const {segment} of segmenter.segment(node.textContent))chars.add(segment);
        const family=await load(chars,name,settings.fallbackStyle);
        for(const node of nodes){
            const segments=[...segmenter.segment(node.textContent)].map(s=>s.segment);
            if(segments.length>1&&segments.some(ch=>family.glyphs[ch]?.filled||(settings.fallbackStyle==='hand'&&SetSymbols.handles(ch)))){
                let offset=0;for(const ch of segments){const copy=node.cloneNode(false);copy.textContent=ch;let dx=0;try{dx=node.getSubStringLength(0,offset);}catch{}copy.setAttribute('x',String(Number(node.getAttribute('x')||0)+dx));node.before(copy);offset+=ch.length;}node.remove();await normalizeText(root,name,warnings,settings);return;
            }
            if(segments.some(ch=>!family.glyphs[ch])){
                // Keep only the unresolved graphemes native; the rest still use
                // their selected/fallback outlines. SVG substring metrics retain placement.
                if(segments.length>1){let offset=0;for(const ch of segments){const copy=node.cloneNode(false);copy.textContent=ch;let dx=0;try{dx=node.getSubStringLength(0,offset);}catch{}copy.setAttribute('x',String(Number(node.getAttribute('x')||0)+dx));node.before(copy);offset+=ch.length;}node.remove();await normalizeText(root,name,warnings,settings);return;}
                node.dataset.inkFallback='unresolved';node.dataset.inkChar=node.textContent;warnings.add('公式中这些字符未找到可用笔画，仍使用系统字形：'+node.textContent);continue;
            }
            let x=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const paths=[];
            for(const ch of segments){const g=family.glyphs[ch];if(g.path){const d=g.fallback?FallbackInk.path(g.path,g,settings,`${name}:${ch}`,24/family.units):g.path;paths.push(PenGeometry.deformPath(d,(a,b)=>[a+x,b]));minX=Math.min(minX,x+g.x);minY=Math.min(minY,g.y);maxX=Math.max(maxX,x+g.x+g.width);maxY=Math.max(maxY,g.y+g.height);}x+=g.advance;}
            if(!paths.length)continue;const b=node.getBBox(),scale=Math.min(b.width/(maxX-minX),b.height/(maxY-minY));if(!Number.isFinite(scale)||scale<=0)continue;
            const group=document.createElementNS(ns,'g'),path=document.createElementNS(ns,'path');for(const attr of node.attributes)if(['transform','style','color','fill'].includes(attr.name))group.setAttribute(attr.name,attr.value);
            path.setAttribute('d',paths.join(''));path.setAttribute('transform',`translate(${b.x+(b.width-(maxX-minX)*scale)/2-minX*scale} ${b.y+b.height+minY*scale}) scale(${scale} ${-scale})`);path.dataset.centerline='true';path.dataset.handGlyph='true';path.dataset.mathText=node.textContent;const title=document.createElementNS(ns,'title');title.textContent=node.textContent;group.append(title,path);node.replaceWith(group);
            const supplemented=segments.filter(ch=>family.glyphs[ch]?.fallback);if(supplemented.length){path.dataset.inkFallback='font';path.dataset.inkChar=supplemented.join('');}
            if(segments.every(ch=>family.glyphs[ch]?.filled))path.dataset.inkFill='true';
        }
    }
    function ensureVariant(use){
        const id=use.getAttribute('href')?.slice(1);if(!id||document.getElementById(id))return;
        const base=bases.get(use.dataset.penBase);if(!base)throw Error('字形变体缺少基础笔画，请重新排版');
        let value=variants.get(id);if(value){variantHits++;variants.delete(id);variants.set(id,value);}
        else{const {glyph,units,ch}=base,d=glyph.fallback?FallbackInk.path(glyph.path,glyph,{seed:Number(use.dataset.penSeed),naturalness:Number(use.dataset.penAmount)},`${ch}:${use.dataset.penVariant}`,24/units):PenVariants.path(glyph.path,glyph,units,{seed:Number(use.dataset.penSeed),slot:Number(use.dataset.penVariant),amount:Number(use.dataset.penAmount),style:use.dataset.penStyle||'subtle',ch});value={d,bytes:d.length*2};variantBuilds++;
            while(variants.size&&(variantBytes+value.bytes>MAX_VARIANT_BYTES||variants.size>=2048)){const first=variants.keys().next().value;variantBytes-=variants.get(first).bytes;variants.delete(first);}if(value.bytes<=MAX_VARIANT_BYTES){variants.set(id,value);variantBytes+=value.bytes;}}
        const original=document.getElementById(base.glyph.id),path=original.cloneNode(false);path.id=id;path.dataset.penVariant='true';path.setAttribute('d',value.d);definitions().append(path);
    }
    function ensure(root){for(const use of root.querySelectorAll('use[data-pen-base]'))ensureVariant(use);}
    function prune(){const live=new Set([...document.querySelectorAll('use[data-pen-base]')].map(e=>e.getAttribute('href')?.slice(1)));for(const path of definitions().querySelectorAll('[data-pen-variant]'))if(!live.has(path.id))path.remove();}
    function glyphElement(ch,family,optical=false,variation=null){
        if(variation?.fallbackStyle==='hand'&&SetSymbols.handles(ch))return SetSymbols.textGlyph(ch,family,variation,variation.slot);
        const glyph=family?.glyphs[ch];if(!glyph||!family.units)return null;
        // Some CJK handwriting fonts give Latin letters almost a full character
        // cell. Trim only side bearings; preserve every stroke's scale and shape.
        const padding=family.units*(/^[\p{Script=Latin}\p{M}0-9]+$/u.test(ch)?.04:.035);
        const fitted=optical&&glyph.width>0&&glyph.width+padding*2<glyph.advance;
        const start=fitted?glyph.x-padding:0,advance=fitted?glyph.width+padding*2:glyph.advance;
        const svg=document.createElementNS(ns,'svg'),height=family.ascent-family.descent;svg.classList.add('monoline-glyph');svg.setAttribute('viewBox',`0 ${-family.ascent} ${Math.max(1,glyph.advance)} ${height}`);svg.style.width=`${glyph.advance/family.units}em`;svg.style.height=`${height/family.units}em`;svg.style.verticalAlign=`${family.descent/family.units}em`;svg.setAttribute('aria-label',ch);
        if(optical){svg.setAttribute('viewBox',`${start} ${-family.ascent} ${Math.max(1,advance)} ${height}`);svg.style.width=`${advance/family.units}em`;svg.dataset.spacing='optical';}
        const title=document.createElementNS(ns,'title');title.textContent=ch;svg.append(title);
        const use=document.createElementNS(ns,'use');use.setAttribute('href','#'+glyph.id);use.setAttribute('transform','scale(1 -1)');use.classList.add('ballpoint-stroke');
        if(glyph.filled){use.classList.remove('ballpoint-stroke');use.setAttribute('fill','currentColor');use.setAttribute('stroke','none');}
        const amount=glyph.fallback?variation?.naturalness:variation?.amount;
        if(amount&&glyph.path&&(glyph.fallback||/^[\p{L}\p{M}\p{N}]+$/u.test(ch))){const style=glyph.fallback?'fallback':variation.style||'subtle',id=`${glyph.id}-${PenVariants.VERSION}-${style}-${variation.seed}-${amount}-${variation.slot}`;use.setAttribute('href','#'+id);use.dataset.penBase=glyph.id;use.dataset.penSeed=variation.seed;use.dataset.penAmount=amount;use.dataset.penVariant=variation.slot;use.dataset.penStyle=style;ensureVariant(use);}
        if(glyph.fallback){svg.dataset.inkFallback='font';svg.dataset.inkChar=ch;svg.dataset.inkSource=glyph.source;}
        svg.append(use);return svg;
    }
    async function normalizeMath(root,settings={}){
        const nodes=Array.from(root.querySelectorAll('.math path:not([data-centerline])')).filter(p=>{
            const mo=p.closest('[data-mml-node="mo"]'),code=mo?.querySelector('path[data-c]')?.dataset.c;
            if(['2022','2219','25A0','25AA','25FC','25B2','25B4','25B6','25B8','25BC','25BE','25C0','25C2','25C6','25CF','2660','2663','29EB'].includes(p.dataset.c)){p.dataset.inkFill='true';return false;}
            if(['2C6','5E','2C7','30C'].includes(code)&&['mover','munder','munderover'].includes(mo?.parentElement.dataset.mmlNode))return false;
            return !StudioLargeSymbols.handles(code);
        });
        const todo=new Map(),entries=[];
        for(const node of nodes){const b=node.getBBox(),d=node.getAttribute('d');if(!d||!b.width||!b.height)continue;
            const fallback=!node.dataset.handGlyph&&settings.fallbackStyle==='hand';
            const box={x:b.x,y:b.y,width:b.width,height:b.height},key=StudioCore.hash(d)+':'+StudioCore.hash(JSON.stringify(box))+(fallback?':fallback-v4':'');entries.push({node,key});if(!paths.has(key))todo.set(key,{key,d,box,fallback});if(fallback)node.dataset.inkFallback='math-default';}
        const pending=Array.from(todo.values());
        for(let i=0;i<pending.length;i+=200){const result=await api('/md2handwriting/api/pen-paths',{items:pending.slice(i,i+200)});for(const [key,d]of Object.entries(result))paths.set(key,d);}
        for(const {node,key}of entries){const result=paths.get(key),d=typeof result==='string'?result:result?.path;if(d){node.setAttribute('d',d);node.dataset.centerline='true';if(result?.filled)node.dataset.inkFill='true';}}
    }
    async function supplementMath(root,settings){
        if(settings.fallbackStyle!=='hand'||!settings.mathFont)return;
        const nodes=[...root.querySelectorAll('.math path[data-c]:not([data-hand-glyph])')].filter(p=>{
            const owner=p.parentElement,kind=owner.dataset.mmlNode;if(!['mi','mn','mo'].includes(kind))return false;
            if(kind==='mo'&&(StudioLargeSymbols.handles(p.dataset.c)||['mover','munder','munderover','msqrt','mroot'].includes(owner.parentElement?.dataset.mmlNode)))return false;
            return true;
        });
        if(!mathExtras.has(settings.mathFont))mathExtras.set(settings.mathFont,{});const glyphs=mathExtras.get(settings.mathFont);
        const code=p=>String.fromCodePoint(parseInt(p.dataset.c,16)),chars=[...new Set(nodes.map(code))],missing=chars.filter(ch=>!Object.hasOwn(glyphs,ch));
        for(let i=0;i<missing.length;i+=200){const result=await api('/md2handwriting/api/pen-font',{type:'math',font:settings.mathFont,chars:missing.slice(i,i+200)});Object.assign(glyphs,result.glyphs);}
        for(const p of nodes){
            const ch=code(p),g=glyphs[ch];if(!g?.path)continue;const b=p.getBBox();if(!b.width||!b.height||!g.width||!g.height)continue;
            p.fallbackSupplement={ch,g,b:{x:b.x,y:b.y,width:b.width,height:b.height}};
        }
    }
    function applyMathSupplements(root,settings,key){
        let index=0;
        for(const p of [...root.querySelectorAll('.math path')]){
            if(!p.fallbackSupplement)continue;const {ch,g,b}=p.fallbackSupplement;
            const scale=Math.min(b.width/g.width,b.height/g.height),replacement=document.createElementNS(ns,'path');
            replacement.setAttribute('d',g.path);replacement.setAttribute('transform',`translate(${b.x+(b.width-g.width*scale)/2-g.x*scale} ${b.y+b.height-g.height*scale-g.y*scale}) scale(${scale})`);
            replacement.dataset.handGlyph='true';replacement.dataset.handChar=ch;replacement.dataset.centerline='true';replacement.dataset.inkFallback='math-font';replacement.dataset.inkChar=ch;
            const transform=p.getAttribute('transform');if(transform){const group=document.createElementNS(ns,'g');group.setAttribute('transform',transform);group.append(replacement);p.replaceWith(group);}else p.replaceWith(replacement);
            PenInk.warp([replacement],settings,StudioCore.random(`${settings.seed}:math-supplement:${key}:${ch}:${index++}`),'glyph',{gain:.55});
        }
    }
    return {prepare,glyphElement,supplementMath,applyMathSupplements,normalizeMath,normalizeText,ensure,prune,variantStats:()=>({bytes:variantBytes,entries:variants.size,hits:variantHits,builds:variantBuilds,definitions:definitions().querySelectorAll('[data-pen-variant]').length})};
})();
