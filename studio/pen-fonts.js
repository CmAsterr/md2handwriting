window.PenFonts = (() => {
    const ns='http://www.w3.org/2000/svg',families=new Map(),paths=new Map();
    const segmenter=new Intl.Segmenter('zh',{granularity:'grapheme'});
    async function api(url,value){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const result=await response.json();if(!response.ok)throw new Error(result.error||'笔画准备失败');return result;}
    function definitions(){let defs=document.getElementById('monoline-font-defs');if(!defs){const svg=document.createElementNS(ns,'svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';svg.setAttribute('aria-hidden','true');defs=document.createElementNS(ns,'defs');defs.id='monoline-font-defs';svg.append(defs);document.body.append(svg);}return defs;}
    async function load(chars,name){
        if(!families.has(name))families.set(name,{glyphs:{}});const family=families.get(name);
        const missing=Array.from(chars).filter(ch=>ch.length<=32&&!Object.hasOwn(family.glyphs,ch));
        for(let i=0;i<missing.length;i+=256){const result=await api('/md2handwriting/api/pen-font',{type:'text',font:name,chars:missing.slice(i,i+256)});Object.assign(family,{id:result.id,units:result.units,ascent:result.ascent,descent:result.descent});Object.assign(family.glyphs,result.glyphs);}
        const defs=definitions();
        for(const ch of chars){const glyph=family.glyphs[ch];if(!glyph)continue;glyph.id=`pen-${family.id}-${Array.from(ch,c=>c.codePointAt(0).toString(16)).join('-')}`;
            if(!document.getElementById(glyph.id)){const path=document.createElementNS(ns,'path');path.id=glyph.id;path.setAttribute('d',glyph.path);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.style.strokeWidth='inherit';path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.setAttribute('vector-effect','non-scaling-stroke');defs.append(path);}}
        return family;
    }
    async function prepare(root,name){
        const chars=new Set(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
        while((node=walker.nextNode()))if(!node.parentElement.closest('.math,pre,code,.ink-mark,svg'))for(const {segment} of segmenter.segment(node.data))chars.add(segment);
        return load(chars,name);
    }
    async function normalizeText(root,name,warnings){
        const nodes=[...root.querySelectorAll('.math svg text')];if(!nodes.length)return;
        const chars=new Set();for(const node of nodes)for(const {segment} of segmenter.segment(node.textContent))chars.add(segment);
        const family=await load(chars,name);
        for(const node of nodes){
            const segments=[...segmenter.segment(node.textContent)].map(s=>s.segment);
            if(segments.some(ch=>!family.glyphs[ch])){node.dataset.inkFallback='missing-glyph';warnings.add('有公式文字缺少所选字体的字形，已保留系统字形。');continue;}
            let x=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const paths=[];
            for(const ch of segments){const g=family.glyphs[ch];if(g.path){paths.push(PenGeometry.deformPath(g.path,(a,b)=>[a+x,b]));minX=Math.min(minX,x+g.x);minY=Math.min(minY,g.y);maxX=Math.max(maxX,x+g.x+g.width);maxY=Math.max(maxY,g.y+g.height);}x+=g.advance;}
            if(!paths.length)continue;const b=node.getBBox(),scale=Math.min(b.width/(maxX-minX),b.height/(maxY-minY));if(!Number.isFinite(scale)||scale<=0)continue;
            const group=document.createElementNS(ns,'g'),path=document.createElementNS(ns,'path');for(const attr of node.attributes)if(['transform','style','color','fill'].includes(attr.name))group.setAttribute(attr.name,attr.value);
            path.setAttribute('d',paths.join(''));path.setAttribute('transform',`translate(${b.x+(b.width-(maxX-minX)*scale)/2-minX*scale} ${b.y+b.height+minY*scale}) scale(${scale} ${-scale})`);path.dataset.centerline='true';path.dataset.handGlyph='true';path.dataset.mathText=node.textContent;const title=document.createElementNS(ns,'title');title.textContent=node.textContent;group.append(title,path);node.replaceWith(group);
        }
    }
    function glyphElement(ch,family){const glyph=family?.glyphs[ch];if(!glyph||!family.units)return null;
        const svg=document.createElementNS(ns,'svg'),height=family.ascent-family.descent;svg.classList.add('monoline-glyph');svg.setAttribute('viewBox',`0 ${-family.ascent} ${Math.max(1,glyph.advance)} ${height}`);svg.style.width=`${glyph.advance/family.units}em`;svg.style.height=`${height/family.units}em`;svg.style.verticalAlign=`${family.descent/family.units}em`;svg.setAttribute('aria-label',ch);
        const title=document.createElementNS(ns,'title');title.textContent=ch;svg.append(title);
        const use=document.createElementNS(ns,'use');use.setAttribute('href','#'+glyph.id);use.setAttribute('transform','scale(1 -1)');use.classList.add('ballpoint-stroke');svg.append(use);return svg;
    }
    async function normalizeMath(root){
        const nodes=Array.from(root.querySelectorAll('.math path:not([data-centerline])')).filter(p=>{
            const mo=p.closest('[data-mml-node="mo"]'),code=mo?.querySelector('path[data-c]')?.dataset.c;
            if(['2022','2219','25A0','25AA','25FC','25B2','25B4','25B6','25B8','25BC','25BE','25C0','25C2','25C6','25CF','2660','2663','29EB'].includes(p.dataset.c)){p.dataset.inkFill='true';return false;}
            if(['2C6','5E','2C7','30C'].includes(code)&&['mover','munder','munderover'].includes(mo?.parentElement.dataset.mmlNode))return false;
            return !StudioLargeSymbols.handles(code);
        });
        const todo=new Map(),entries=[];
        for(const node of nodes){const b=node.getBBox(),d=node.getAttribute('d');if(!d||!b.width||!b.height)continue;
            const box={x:b.x,y:b.y,width:b.width,height:b.height},key=StudioCore.hash(d)+':'+StudioCore.hash(JSON.stringify(box));entries.push({node,key});if(!paths.has(key))todo.set(key,{key,d,box});}
        const pending=Array.from(todo.values());
        for(let i=0;i<pending.length;i+=200){const result=await api('/md2handwriting/api/pen-paths',{items:pending.slice(i,i+200)});for(const [key,d]of Object.entries(result))paths.set(key,d);}
        for(const {node,key}of entries){const d=paths.get(key);if(d){node.setAttribute('d',d);node.dataset.centerline='true';}}
    }
    return {prepare,glyphElement,normalizeMath,normalizeText};
})();
