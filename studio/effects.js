/* Seeded, bounded gestures. Structural math strokes never receive displacement filters. */
window.StudioEffects = (() => {
    const { random } = StudioCore;
    const ns = 'http://www.w3.org/2000/svg';
    function svg(w,h) { const el = document.createElementNS(ns,'svg'); el.setAttribute('viewBox',`0 0 ${w} ${h}`); el.setAttribute('preserveAspectRatio','none'); return el; }
    function path(el,d,width,opacity,fixedNib=true) { const p = document.createElementNS(ns,'path'); p.setAttribute('d',d); p.setAttribute('fill','none'); p.setAttribute('stroke','currentColor'); p.setAttribute('stroke-width',width); p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); p.setAttribute('opacity',opacity); if(fixedNib)p.classList.add('ballpoint-stroke'); el.append(p); }
    const mathematics=(root,settings,key)=>PenInk.mathematics(root,settings,key);
    function scribble(el,seed,type,settings) {
        const source=random(seed),natural=PenGestures.strength(settings),r=()=>.5+(source()-.5)*natural; const w = Math.max(24,el.offsetWidth), h = Math.max(22,el.offsetHeight);
        const s = svg(w,h); s.classList.add('scribble-overlay');
        if (type === 'mixed') type = ['strike','loop','cross','dense'][Math.floor(source()*4)];
        if (type === 'strike' || type === 'cross') {
            // Aim through the visible writing, not the line box's leading above it.
            const box=el.getBoundingClientRect(),marks=[...el.querySelectorAll('.monoline-glyph use,.math [data-mml-node="math"]')].map(e=>e.getBoundingClientRect()).filter(b=>b.height>0);
            const top=marks.length?Math.min(...marks.map(b=>b.top))-box.top:h*.25,bottom=marks.length?Math.max(...marks.map(b=>b.bottom))-box.top:h*.8;
            const y=Math.max(2,Math.min(h-2,(top+bottom)/2+(r()-.5)*(bottom-top)*.18));
            path(s,`M-2 ${y} C${w*.25} ${y-2} ${w*.7} ${y+2} ${w+3} ${y-1}`,1.2+r(),.8);
            if (type === 'cross') path(s,`M0 ${h*.8} C${w*.3} ${h*.6} ${w*.6} ${h*.3} ${w+1} ${h*.12}`,1.2+r()*.7,.85);
            else if (r()>.5) path(s,`M0 ${y+4} Q${w*.5} ${y+2} ${w} ${y+3}`,1,.6);
        } else {
            const passes = type === 'dense' ? 3 : 1;
            for(let p=0;p<passes;p++) {
                const n = Math.max(3,Math.ceil(w/(8+r()*9)));let d=`M-2 ${h*.6}`,x=-2;
                for(let i=0;i<n;i++) { const step=(w+4-x)/(n-i)*(0.65+r()*.6),top=h*(-.06+r()*.3),bottom=h*(.65+r()*.42),slant=(r()-.25)*step;
                    d+=` C${x+step*.8+slant} ${top} ${x-step*.45+slant} ${top+h*.1} ${x+step*.1} ${bottom} S${x+step*1.5} ${bottom-h*.07} ${x+step} ${h*(.3+r()*.3)}`;x+=step;
                }
                path(s,d,.9+r()*1.1,.65+r()*.22);
                if(passes>1||r()>.45)path(s,`M${w+2} ${h*.65} C${w*.67} ${h*(.2+r()*.5)} ${w*.28} ${h*(.4+r()*.5)} -2 ${h*.38}`,.7+r()*.6,.55+r()*.3);
            }
        }
        el.append(s);
        PenInk.warp([...s.querySelectorAll('path')],settings,source,'correction',{factory:b=>PenGestures.field(b,settings,source,{math:false,gain:.7,limitX:1.4,limitY:1.4})});
    }
    function ink(el,seed,type,settings) {
        const r=random(seed); if(type==='mixed') type=['drop','splash','drag','dry'][Math.floor(r()*4)];
        const s=svg(70,45); s.classList.add('ink-art');s.style.transform=`scale(${settings.inkScale??1})`;s.style.transformOrigin='23px 22px';
        if(type==='dry'||type==='drag') {
            for(let i=0;i<12;i++) { const y=18+r()*11; path(s,`M${8+r()*10} ${y} Q35 ${y+r()*4} ${40+r()*26} ${y-4+r()*7}`, .3+r()*1.7, .12+r()*.42, false); }
        }
        if(type!=='dry') {
            // Closed Catmull-Rom outline: low frequency capillary edge, not a perfect ellipse.
            const points=[]; const count=18, radius=type==='splash'?6:9;
            for(let i=0;i<count;i++){ const a=i/count*Math.PI*2, rad=radius*(.83+r()*.34); points.push([23+Math.cos(a)*rad,22+Math.sin(a)*rad*.8]); }
            let d=`M${points[0].join(' ')}`;
            for(let i=0;i<count;i++){const p0=points[(i+count-1)%count],p1=points[i],p2=points[(i+1)%count],p3=points[(i+2)%count];d+=` C${p1[0]+(p2[0]-p0[0])/6} ${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6} ${p2[1]-(p3[1]-p1[1])/6} ${p2.join(' ')}`;}
            const p=document.createElementNS(ns,'path');p.setAttribute('d',d+' Z');p.setAttribute('fill','currentColor');p.setAttribute('opacity','.8');s.append(p);
            const halo=p.cloneNode();halo.setAttribute('opacity','.12');halo.setAttribute('transform','translate(-1.15 -1.1) scale(1.05)');s.prepend(halo);
            for(let i=0;i<(type==='splash'?15:4);i++){const dot=document.createElementNS(ns,'ellipse'),a=r()*Math.PI*2,dist=10+r()*18; dot.setAttribute('cx',23+Math.cos(a)*dist);dot.setAttribute('cy',22+Math.sin(a)*dist*.62);dot.setAttribute('rx',.4+r()*1.8);dot.setAttribute('ry',.4+r());dot.setAttribute('fill','currentColor');dot.setAttribute('opacity',.3+r()*.5);s.append(dot);}
        }
        el.append(s);
    }
    function lettering(root,settings,key,penFont) {
        const n=PenGestures.strength(settings), pressure=settings.pressure/100;
        for(const [i,marker] of [...root.querySelectorAll('.list-marker')].entries()){
            const text=marker.textContent,kind=text.trim();if(!['☑','☐','•'].includes(kind))continue;
            const r=random(`${settings.seed}:${key}:marker:${i}`),size=settings.fontSize*.8,s=svg(size,size),title=document.createElementNS(ns,'title');title.textContent=text;s.append(title);s.classList.add('task-ink');
            marker.replaceChildren(s);marker.classList.add('glyph');marker.dataset.atom='';marker.dataset.inkMarker=kind;
            const paths=[];
            if(kind==='•')PenInk.stroke(s,`M${size*.45} ${size*.5}l.01 0`,settings,r,'list-marker');
            else{
                paths.push(PenInk.stroke(s,`M2 2H${size-2}V${size-2}H2Z`,settings,r,'task-marker'));
                if(kind==='☑')paths.push(PenInk.stroke(s,`M${size*.22} ${size*.49}L${size*.43} ${size*.7}L${size*.8} ${size*.25}`,settings,r,'task-marker'));
                PenInk.warp(paths,settings,r,'task-marker',{factory:b=>PenGestures.field(b,settings,r,{math:false,gain:.65,limitX:.9,limitY:.9})});
            }
        }
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes=[];let node;
        while((node=walker.nextNode())) if(!node.parentElement.closest('.math, pre, code, .ink-mark, svg, [data-ink-marker]')) nodes.push(node);
        const segmenter=new Intl.Segmenter('zh',{granularity:'grapheme'}),latin=/^[\p{Script=Latin}\p{M}0-9]+$/u,occurrences=new Map(),variantAmount=PenVariants.amount(settings); let index=0;
        for(const text of nodes) {
            if(!text.data.trim()&&text.data.includes('\n')){text.remove();continue;}
            const fragment=document.createDocumentFragment(),segments=[...segmenter.segment(text.data)].map(s=>s.segment);let word=null;
            for(let at=0;at<segments.length;at++) {const segment=segments[at],letter=latin.test(segment),connector=/^['’\-]$/.test(segment)&&latin.test(segments[at-1]||'')&&latin.test(segments[at+1]||''),optical=letter||connector||/^[.,;:!?()\[\]"'’“”\-]$/.test(segment);
                if(segment==='\n'){ fragment.append(document.createTextNode(' '));continue; }
                if(/^[ \t]$/.test(segment)){const space=document.createElement('span');space.className='word-space';space.textContent=' ';fragment.append(space);word=null;index++;continue;}
                const r=random(`${settings.seed}:${key}:${index}`); const span=document.createElement('span');span.className='glyph';span.dataset.atom='';
                const occurrence=occurrences.get(segment)||0;occurrences.set(segment,occurrence+1);
                const variation={seed:settings.seed,amount:variantAmount,naturalness:settings.naturalness,style:settings.glyphStyle,fontSize:settings.fontSize,penWidth:settings.penWidth,fallbackStyle:settings.fallbackStyle,slot:PenVariants.slot(settings.seed,key,segment,occurrence)};
                const glyph=PenFonts.glyphElement(segment,penFont,optical,variation);if(glyph)span.append(glyph);else{span.textContent=segment;span.dataset.inkFallback='unresolved';span.dataset.inkChar=segment;}
                // Slow drift + small individual variation, bounded so glyphs cannot collide.
                const wave=Math.sin(index*.32+(StudioCore.hash(key)%100)),size=settings.fontSize/27;
                span.style.transform=`translate(${((r()-.5)*.6*n*size).toFixed(2)}px,${((wave*2.3+(r()-.5)*1.3)*n*size).toFixed(2)}px) rotate(${((r()-.5)*9*n).toFixed(2)}deg) scale(${(1+(r()-.5)*.12*n).toFixed(3)})`;
                span.style.opacity=(.62+.36*Math.sqrt(pressure)-n*r()*.025).toFixed(3);
                span.style.letterSpacing=`${((r()-.5)*1.6*n*size).toFixed(2)}px`;
                if(letter||connector){
                    if(!word){const wr=random(`${settings.seed}:${key}:word:${index}`);word={start:index,angle:(wr()-.5)*4,scale:1+(wr()-.5)*.035,phase:wr()*Math.PI*2};}
                    const local=index-word.start,wr=random(`${settings.seed}:${key}:latin:${index}`);
                    span.classList.add('latin-glyph');span.style.letterSpacing='0px';
                    span.style.transform=`translate(${((wr()-.5)*.18*n*size).toFixed(2)}px,${(Math.sin(local*.22+word.phase)*.65*n*size).toFixed(2)}px) rotate(${((word.angle+(wr()-.5)*1.6)*n).toFixed(2)}deg) scale(${(1+(word.scale-1+(wr()-.5)*.018)*n).toFixed(3)})`;
                }else{word=null;if(optical)span.style.letterSpacing='0px';}
                fragment.append(span);index++;
            }
            text.replaceWith(fragment);
        }
        // Keep western words and CJK closing punctuation together at line boundaries.
        function join(left,right){let group=left;if(!left.classList.contains('text-cluster')){group=document.createElement('span');group.className='text-cluster';group.dataset.atom='';left.before(group);group.append(left);}group.append(right);return group;}
        for(const glyph of Array.from(root.querySelectorAll('.glyph'))){
            if(glyph.closest('.math,.text-cluster'))continue;
            const previous=glyph.previousElementSibling;
            if(previous&&previous.nextSibling===glyph&&/^[，。！？；：、）》】〉”’…,.!?;:%)\]}]$/.test(glyph.textContent))join(previous,glyph);
            else if(glyph.classList.contains('latin-glyph')&&previous&&previous.nextSibling===glyph&&/^[\p{Script=Latin}\p{M}0-9'’\-]{1,31}$/u.test(previous.textContent))join(previous,glyph);
        }
        for(const glyph of Array.from(root.querySelectorAll('.glyph'))){
            if(glyph.closest('.text-cluster'))continue;
            const next=glyph.nextElementSibling;
            if(next&&glyph.nextSibling===next&&/^[（《【〈“‘(\[{]$/.test(glyph.textContent))join(glyph,next);
        }
        root.querySelectorAll('del').forEach((el,i)=>{el.className='correction';el.dataset.atom='';scribble(el,`${settings.seed}:${key}:s${i}`,settings.scribble,settings);});
        root.querySelectorAll('.ink-mark').forEach((el,i)=>ink(el,`${settings.seed}:${key}:i${i}`,settings.ink,settings));
    }
    function table(block,settings,key) {
        const t=block.querySelector('table');if(!t)return;
        block.querySelectorAll('.table-ink').forEach(el=>el.remove());
        const rect=t.getBoundingClientRect(),parent=block.getBoundingClientRect();
        const s=svg(rect.width,rect.height);s.classList.add('table-ink');s.style.cssText=`left:${rect.left-parent.left}px;top:${rect.top-parent.top}px;width:${rect.width}px;height:${rect.height}px`;
        const r=random(`${settings.seed}:table:${t.textContent}`),ys=new Set([0]),xs=new Set([0]);
        const neat=settings.tableStyle==='ruled'?.8:1;
        for(const row of t.rows)ys.add(Math.round(row.getBoundingClientRect().bottom-rect.top));
        if(t.rows[0])for(const cell of t.rows[0].cells)xs.add(Math.round(cell.getBoundingClientRect().right-rect.left));
        t.classList.add('hand-grid');
        const headerBottom=t.tHead?.getBoundingClientRect().bottom-rect.top;
        block.append(s);
        const strokes=[];
        for(const y of ys){if(settings.tableStyle==='minimal'&&y!==0&&y!==Math.max(...ys)&&Math.abs(y-headerBottom)>2)continue;
            const p=PenInk.stroke(s,`M0 ${y}L${rect.width} ${y}`,settings,r,'table');p.dataset.gridAxis='h';p.dataset.gridPosition=y;strokes.push(p);}
        if(settings.tableStyle!=='minimal')for(const x of xs){const p=PenInk.stroke(s,`M${x} 0L${x} ${rect.height}`,settings,r,'table');p.dataset.gridAxis='v';p.dataset.gridPosition=x;strokes.push(p);}
        PenInk.warp(strokes,settings,r,'table',{factory:b=>PenGestures.field(b,settings,r,{math:false,gain:neat,limitX:settings.fontSize*.18,limitY:settings.fontSize*.16})});
    }
    function rhythm(root,settings,key,fixedAngle){
        const n=PenGestures.strength(settings);if(!n)return;
        const block=root.firstElementChild;if(!block)return;
        const r=random(`${settings.seed}:rhythm:${key}`),width=root.clientWidth;
        const angle=Number.isFinite(fixedAngle)?fixedAngle:(.35+r()*.95)*(r()>.5?1:-1)*n;
        const slope=Math.tan(angle*Math.PI/180),guard=Math.ceil(Math.abs(slope)*width*.25+1.5*n);
        block.style.paddingTop=`${guard}px`;block.style.paddingBottom=`${guard}px`;block.dataset.writingAngle=angle.toFixed(3);
        // Read all positions before writing transforms, avoiding a layout read/write loop.
        const positions=Array.from(block.querySelectorAll('.glyph,.math,.ink-mark,.correction')).filter(node=>!node.parentElement.closest('.correction')).map(node=>({node,x:node.offsetLeft,y:node.offsetTop,w:node.offsetWidth}));
        for(const {node,x,y,w} of positions){
            if(node.matches('.display-math,.wide-math')){
                node.style.transform=`rotate(${(angle*.65).toFixed(3)}deg)`;node.style.transformOrigin='50% 50%';
            }else{
                const drift=(x+w*.5-width*.5)*slope+Math.sin(y*.008+x*.006)*1.2*n;
                node.style.translate=`0 ${drift.toFixed(2)}px`;
            }
        }
    }
    function decorations(block,settings,key){
        block.querySelectorAll('.decoration-ink').forEach(e=>e.remove());
        if(!block.querySelector('.quote,pre,u'))return;
        const bounds=block.getBoundingClientRect(),s=svg(Math.max(1,bounds.width),Math.max(1,bounds.height));s.classList.add('decoration-ink');s.style.cssText=`position:absolute;left:0;top:0;width:${bounds.width}px;height:${bounds.height}px;overflow:visible;pointer-events:none`;
        const r=random(`${settings.seed}:${key}:decoration`);block.append(s);let count=0;
        function line(x1,y1,x2,y2,color,model){const p=PenInk.stroke(s,`M${x1} ${y1}L${x2} ${y2}`,settings,r,model);p.style.color=color;PenInk.warp([p],settings,r,model,{math:false,gain:.85,limitX:1.8,limitY:1.3});count++;}
        for(const quote of block.querySelectorAll('.quote')){const b=quote.getBoundingClientRect();quote.classList.add('hand-quote');line(b.left-bounds.left+1,b.top-bounds.top+2,b.left-bounds.left+1,b.bottom-bounds.top-2,getComputedStyle(quote).color,'quote-rule');}
        for(const code of block.querySelectorAll('pre')){const b=code.getBoundingClientRect();code.classList.add('hand-code-rule');line(b.left-bounds.left+1,b.top-bounds.top+2,b.left-bounds.left+1,b.bottom-bounds.top-2,getComputedStyle(code).color,'code-rule');}
        for(const underline of block.querySelectorAll('u')){const color=getComputedStyle(underline).color;underline.classList.add('hand-underline');for(const b of underline.getClientRects())line(b.left-bounds.left,b.bottom-bounds.top-1,b.right-bounds.left,b.bottom-bounds.top-1,color,'underline');}
        if(!count)s.remove();
    }
    return { lettering, table, mathematics, rhythm, decorations };
})();
