window.StudioLayout = (() => {
    'use strict';
    const C=StudioCore, cache=new Map(), mathCache=new Map(), loadedFonts=new Map();
    let sourceImages=Object.create(null);
    const penFields=new Map();
    const paperImages=new Map();
    async function preparePaper(s){
        const url=C.paperImage(s);if(!url)return;
        if(!paperImages.has(url)){
            if(paperImages.size>=3)paperImages.delete(paperImages.keys().next().value);
            const image=new Image();image.src=url;
            paperImages.set(url,image.decode().catch(()=>{paperImages.delete(url);throw new Error('纸张背景无法读取，请重新选择纸张或上传图片。');}));
        }
        await paperImages.get(url);
    }
    const fieldURL=s=>`/md2handwriting/studio/pen-field-${s.seed%4}.png`;
    async function preparePenField(s){if(!s.naturalness)return;const url=fieldURL(s);if(!penFields.has(url)){const image=new Image();image.src=url;penFields.set(url,image.decode());}await penFields.get(url);}
    let cacheBytes=0,mathBytes=0;
    function rememberBlock(key,value){const bytes=(value.html.length+value.source.length)*2;if(bytes>8*1024*1024)return;
        if(cache.has(key)){cacheBytes-=cache.get(key).bytes;cache.delete(key);}
        while(cache.size&&(cacheBytes+bytes>12*1024*1024||cache.size>=80)){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).bytes;cache.delete(oldest);}
        cache.set(key,{...value,bytes});cacheBytes+=bytes;
    }
    const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
    const mathHTML=t=>`<span class="math${t.display?' display-math':''}" data-tex="${C.escape(t.tex)}" data-display="${t.display}" data-atom></span>`;
    marked.use({gfm:true,breaks:true,extensions:[
        {name:'displayMath',level:'block',start:s=>s.search(/\$\$|\\\[|\\begin\{/),tokenizer(src){const m=C.mathAt(src,true);if(m)return{type:'displayMath',...m};},renderer:mathHTML},
        {name:'inlineMath',level:'inline',start:s=>s.search(/\$|\\[([]|\\begin\{/),tokenizer(src){const m=C.mathAt(src);if(m)return{type:'inlineMath',...m};},renderer:mathHTML},
        {name:'ink',level:'inline',start:s=>s.indexOf('[ink]'),tokenizer(src){if(src.startsWith('[ink]'))return{type:'ink',raw:'[ink]'};},renderer:()=>'<span class="ink-mark" data-atom></span>'},
        {name:'textcolor',level:'inline',start:s=>s.indexOf('\\textcolor{'),tokenizer(src){const m=C.colorAt(src);if(m)return{type:'textcolor',...m,tokens:this.lexer.inlineTokens(m.text)};},renderer(t){return `<span style="color:${t.color}">${this.parser.parseInline(t.tokens)}</span>`;}}
        ,{name:'footnoteDefinition',level:'block',start:s=>s.search(/^\[\^[^\]]+\]:/m),tokenizer(src){const m=/^\[\^([^\]]+)\]:\s*([^\n]*(?:\n {4}[^\n]*)*)/.exec(src);if(m)return{type:'footnoteDefinition',raw:m[0],label:m[1],tokens:this.lexer.inlineTokens(m[2].replace(/\n {4}/g,' '))};},renderer(t){return `<p class="footnote"><sup>${C.escape(t.label)}</sup> ${this.parser.parseInline(t.tokens)}</p>`;}},
        {name:'footnoteReference',level:'inline',start:s=>s.indexOf('[^'),tokenizer(src){const m=/^\[\^([^\]]+)\]/.exec(src);if(m)return{type:'footnoteReference',raw:m[0],label:m[1]};},renderer:t=>`<sup class="footnote-ref">[${C.escape(t.label)}]</sup>`}
    ],renderer:{html(t){return t.text.replace(/<[^>]+>/g,tag=>/^<\/?(?:br|sub|sup|u|mark|kbd|summary)\s*\/?>$/i.test(tag)?tag:/^<details>$/i.test(tag)?'<details open>':/^<\/details>$/i.test(tag)?tag:C.escape(tag));},image(t){
        let src=Object.hasOwn(sourceImages,t.href)?sourceImages[t.href]:t.href;
        if(/^https?:\/\//.test(src))src=src;
        else if(!/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src)&&!/^\/assets\/[a-f0-9]+\.jpg$/.test(src))return `<span class="missing-image">[图片：${C.escape(t.text||src)}，请使用“插入图片”导入本地文件]</span>`;
        return `<img class="md-image" crossorigin="anonymous" src="${C.escape(src)}" alt="${C.escape(t.text)}">`;
    },link(t){return this.parser.parseInline(t.tokens);}}});

    function flow(source,images={}) {
        sourceImages=images;
        const tokens=marked.lexer(source.replace(/\r\n?/g,'\n'));const blocks=[];
        function visit(items,depth=0) {
            for(const t of items) {
                if(t.type==='space')continue;
                if(t.type==='hr'){blocks.push({break:true});continue;}
                if(t.type==='list'){
                    t.items.forEach((item,i)=>{
                        let first=true;
                        for(const child of item.tokens){
                            if(child.type==='list'){visit([child],depth+1);continue;}
                            if(child.type==='space')continue;
                            const marker=first?`<span class="list-marker">${item.task?(item.checked?'☑':'☐'):t.ordered?`${Number(t.start)+i}.`:'•'} </span>`:'';
                            if(['text','paragraph'].includes(child.type)){
                                const content=child.tokens?marked.Parser.parseInline(child.tokens):C.escape(child.text||'');
                                blocks.push({html:`<p class="list-line" style="padding-left:${depth*22}px">${marker}${content}</p>`});
                            }else{
                                if(marker)blocks.push({html:`<p style="padding-left:${depth*22}px">${marker}</p>`});
                                const start=blocks.length;visit([child],depth+1);for(let n=start;n<blocks.length;n++)if(blocks[n].html)blocks[n].html=`<div style="padding-left:${(depth+1)*22}px">${blocks[n].html}</div>`;
                            }
                            first=false;
                        }
                    });continue;
                }
                if(t.type==='blockquote'){const start=blocks.length;visit(t.tokens,depth);for(let i=start;i<blocks.length;i++)if(blocks[i].html)blocks[i].html=`<div class="quote">${blocks[i].html}</div>`;continue;}
                blocks.push({html:marked.parser([t]),heading:t.type==='heading',table:t.type==='table',atomic:t.type==='displayMath'});
            }
        }
        visit(tokens);return blocks;
    }
    async function loadFont(s) {
        const url=await PagesRuntime.fontURL('text',s.font);
        const family='hand_'+C.hash(url);
        if(!loadedFonts.has(family)) loadedFonts.set(family,(async()=>{const face=new FontFace(family,`url("${url}")`);await face.load();document.fonts.add(face);})());
        await loadedFonts.get(family);
        return family;
    }
    function paperStyle(s,family) {
        const image=C.paperImage(s),size=C.pageSize(s);
        return `width:${size.width}px;height:${size.height}px;--content-height:${size.contentHeight-16}px;--hand-font:"${family}";--size:${s.fontSize}px;--leading:${s.lineHeight};--math-size:${s.mathSize};--pen-width:${s.penWidth}px;--light:${s.light/100};--texture:${s.texture/100};padding:${size.marginY}px ${size.marginX}px;${image?`background-image:url('${image}');background-size:cover;background-position:center center;background-repeat:no-repeat;`:''}`;
    }
    async function math(root,s,warnings) {
        if(!root.querySelector('.math'))return;
        await MathJax.startup.promise;
        let glyphs=null;
        if(s.mathFont) {
            if(!StudioLayout.mathFonts.has(s.mathFont)){
                const response=await fetch('/md2handwriting/api/math-font?name='+encodeURIComponent(s.mathFont));
                if(!response.ok)throw new Error('公式字体无法载入');
                StudioLayout.mathFonts.set(s.mathFont,await response.json());
            }
            glyphs=StudioLayout.mathFonts.get(s.mathFont);
        }
        for(const span of root.querySelectorAll('.math')) {
            const tex=span.dataset.tex, display=span.dataset.display==='true';
            const key=JSON.stringify([tex,display]);let html=mathCache.get(key);
            if(!html) {
                const result=await MathJax.tex2svgPromise(tex,{display});html=result.outerHTML;
                while(mathCache.size&&(mathCache.size>=250||mathBytes+html.length*2>6*1024*1024)){const oldest=mathCache.keys().next().value;mathBytes-=mathCache.get(oldest).length*2;mathCache.delete(oldest);}
                if(html.length<3*1024*1024){mathCache.set(key,html);mathBytes+=html.length*2;}
            }
            span.innerHTML=html;
            if(span.querySelector('[data-mml-node="merror"]'))warnings.add('有公式语法错误，已在预览中标出；请检查 LaTeX。');
            // Substitute only simple letter/number paths, preserving TeX advances and all structural glyphs.
            if(glyphs) for(const p of span.querySelectorAll('[data-mml-node="mi"] > path[data-c], [data-mml-node="mn"] > path[data-c], [data-mml-node="mo"] > path[data-c], [data-mml-node="mtext"] > path[data-c]')) {
                const code=Number.parseInt(p.dataset.c,16);
                if(!(code<0x400||code===0x210e||(code>=0x1d400&&code<=0x1d467)||(code>=0x1d6e2&&code<=0x1d71b)))continue;
                const ch=String.fromCodePoint(code).normalize('NFKC');const g=glyphs[ch];if(!g)continue;
                const bbox=p.getBBox();if(!bbox.width||!bbox.height)continue;
                const replacement=document.createElementNS('http://www.w3.org/2000/svg','path');replacement.setAttribute('d',g.centerline||g.path);
                if(g.centerline)replacement.dataset.centerline='true';
                replacement.dataset.handGlyph='true';
                if(code>=0x1d400&&code<=0x1d433)replacement.dataset.handBold='true';
                const scale=Math.min(bbox.width/Math.max(g.width,1),bbox.height/Math.max(g.height,1));
                replacement.setAttribute('transform',`translate(${bbox.x+(bbox.width-g.width*scale)/2-g.x*scale} ${bbox.y+bbox.height-g.height*scale-g.y*scale}) scale(${scale})`);
                const transform=p.getAttribute('transform');
                if(transform){const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('transform',transform);group.append(replacement);p.replaceWith(group);}
                else p.replaceWith(replacement);
            }
        }
        await PenFonts.normalizeText(root,s.font,warnings);
        await PenFonts.normalizeMath(root);
    }
    function fitTables(root,width,warnings){
        for(const table of root.querySelectorAll('table')){
            const columns=Math.max(1,...[...table.rows].map(row=>[...row.cells].reduce((n,cell)=>n+cell.colSpan,0)));
            const available=Math.min(width,table.parentElement.clientWidth),cellWidth=available/columns,font=parseFloat(getComputedStyle(table).fontSize);
            if(cellWidth<font*1.25+17){
                table.style.fontSize=Math.min(font,cellWidth*.62)+'px';
                for(const cell of table.querySelectorAll('th,td')){cell.style.paddingLeft=Math.min(8,cellWidth*.09)+'px';cell.style.paddingRight=Math.min(8,cellWidth*.09)+'px';}
                warnings.add('表格列数较多，已缩小表内字号和间距以适应纸张；可改用横版或更宽的纸张提升可读性。');
            }
        }
    }
    function fitMath(root,width,warnings) {
        for(const span of root.querySelectorAll('.math')) {
            const container=span.querySelector('mjx-container');if(!container)continue;
            // Width edits must start at the original size, not repeatedly shrink an already fitted formula.
            if(!span.dataset.baseMathSize)span.dataset.baseMathSize=parseFloat(getComputedStyle(span).fontSize);
            span.style.fontSize=span.dataset.baseMathSize+'px';span.classList.remove('wide-math');
            const drawing=container.querySelector(':scope > svg');
            const parent=span.closest('td,th,p,h1,h2,h3,h4,h5,h6,pre,.quote,.flow-block')||span.parentElement,style=getComputedStyle(parent);
            const inner=Math.min(width,parent.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight));
            const w=(drawing||container).getBoundingClientRect().width,available=Math.max(1,inner-Math.min(8,inner*.08));
            if(w>available){const scale=available/w;span.style.fontSize=`${parseFloat(getComputedStyle(span).fontSize)*scale}px`;span.classList.add('wide-math');warnings.add('超宽公式已按实际宽度缩放。可使用 aligned 分行以保留较大字号。');}
        }
    }
    function splitLines(block,maxHeight) {
        if(block.querySelector('img,pre'))return null;
        const atoms=Array.from(block.querySelectorAll('[data-atom]')).filter(a=>!a.parentElement.closest('[data-atom]'));
        if(atoms.length<2)return null;
        const top=block.getBoundingClientRect().top;let cut=null;
        for(const atom of atoms){if(atom.getBoundingClientRect().bottom-top>maxHeight-4){cut=atom;break;}}
        if(!cut||cut===atoms[0])return null;
        const left=document.createRange();left.selectNodeContents(block);left.setEndBefore(cut);
        const right=document.createRange();right.selectNodeContents(block);right.setStartBefore(cut);
        const a=block.cloneNode(false),b=block.cloneNode(false);a.append(left.cloneContents());b.append(right.cloneContents());b.classList.add('continued');
        return [a,b];
    }
    function splitTable(block,maxHeight) {
        const table=block.querySelector('table'),rows=Array.from(table.querySelectorAll('tbody>tr'));
        const top=block.getBoundingClientRect().top;let count=0;
        for(const row of rows){if(row.getBoundingClientRect().bottom-top>maxHeight-8)break;count++;}
        if(!count||count===rows.length)return null;
        const a=block.cloneNode(true),b=block.cloneNode(true);
        Array.from(a.querySelectorAll('tbody>tr')).slice(count).forEach(r=>r.remove());
        Array.from(b.querySelectorAll('tbody>tr')).slice(0,count).forEach(r=>r.remove());
        return [a,b];
    }
    function splitCode(block,maxHeight) {
        const code=block.querySelector('pre>code');if(!code)return null;
        const lines=code.textContent.split('\n');if(lines.length<2)return null;
        const original=code.textContent;let lo=0,hi=lines.length-1;
        while(lo<hi){const mid=Math.ceil((lo+hi)/2);code.textContent=lines.slice(0,mid).join('\n');if(block.offsetHeight+8<=maxHeight)lo=mid;else hi=mid-1;}
        code.textContent=original;if(!lo)return null;
        const a=block.cloneNode(true),b=block.cloneNode(true);a.querySelector('code').textContent=lines.slice(0,lo).join('\n')+'\n';b.querySelector('code').textContent=lines.slice(lo).join('\n');return[a,b];
    }
    function serialize(block,s,key){StudioEffects.table(block,s,key);StudioEffects.decorations(block,s,key);return block.outerHTML;}
    function paragraphChunks(block){
        if(block.querySelector('table,pre,img')||block.textContent.length<1800)return null;
        const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),texts=[];let text;
        while((text=walker.nextNode()))if(!text.parentElement.closest('.math,del,code'))texts.push(text);
        const chunks=[];let startNode=block,startOffset=0,count=0;
        for(const node of texts){for(let offset=0;offset<node.length;offset++){count++;
            if(count>=1300&&(/[。！？\s]/.test(node.data[offset])||count>=1600)){
                const range=document.createRange();range.setStart(startNode,startOffset);range.setEnd(node,offset+1);const wrapper=document.createElement('div');wrapper.append(range.cloneContents());chunks.push({html:wrapper.innerHTML,chunked:true});startNode=node;startOffset=offset+1;count=0;
            }
        }}
        if(!chunks.length)return null;const range=document.createRange();range.setStart(startNode,startOffset);range.setEnd(block,block.childNodes.length);const wrapper=document.createElement('div');wrapper.append(range.cloneContents());if(wrapper.textContent.trim()||wrapper.querySelector('.math'))chunks.push({html:wrapper.innerHTML,chunked:true});return chunks;
    }
    function blockText(block){return(block.textContent+' '+[...block.querySelectorAll('.math')].map(m=>m.dataset.tex).join(' ')+' '+[...block.querySelectorAll('img')].map(i=>i.getAttribute('src')).join(' ')).trim();}
    function blockType(block){return block.querySelector('table')?'table':block.querySelector('pre')?'code':block.querySelector('h1,h2,h3,h4,h5,h6')?'heading':block.querySelector('img')?'image':block.querySelector('.display-math')?'formula':block.querySelector('.quote')?'quote':block.querySelector('.list-line')?'list':'paragraph';}
    async function paginate(source,input={},onProgress=()=>{},isCanceled=()=>false,limit=Infinity,images={},manual={}) {
        const s=C.settings(input),size=C.pageSize(s),family=await loadFont(s),width=size.contentWidth,maxHeight=size.contentHeight;
        await Promise.all([preparePenField(s),preparePaper(s)]);
        const {background,backgroundSource,backgroundCrop,paper,paperVersion,scene,light,texture,quality,...layoutSettings}=s;const settingsKey=C.hash(JSON.stringify(layoutSettings));
        const stage=document.getElementById('layout-stage');stage.style.cssText=`width:${width}px;--content-height:${maxHeight-16}px;--hand-font:"${family}";--size:${s.fontSize}px;--leading:${s.lineHeight};--math-size:${s.mathSize};--pen-width:${s.penWidth}px`;
        const blocks=flow(source,images),pages=[],warnings=new Set(),occurrences=new Map(),layout=StudioBlocks.normalize(manual),counts=new Map(),ids=new Map();let segment=1,parts=[],used=0,truncated=false;
        for(const spec of blocks)if(spec.html)counts.set(spec.html,(counts.get(spec.html)||0)+1);
        for(const spec of blocks)if(spec.html){const n=ids.get(spec.html)||0;ids.set(spec.html,n+1);spec.baseId=`b-${C.hash(spec.html).toString(36)}-${C.hash('block:'+spec.html).toString(36)}-${counts.get(spec.html)}-${n}`;}
        if(size.marginX<s.marginX||size.marginY<s.marginY)warnings.add('小尺寸纸张已自动缩小留白，保证至少一半纸面可用于排版；字号与笔宽保持原设定。');
        const finish=()=>{if(parts.length){pages.push({html:parts.map(b=>b.html).join(''),blocks:parts,segment});parts=[];used=0;}};
        const pack=(block,spec,key,index,autoScale=1)=>{const text=blockText(block),id=`${spec.baseId}-${index}-${C.hash(text).toString(36)}`,type=blockType(block);let blockWidth=width,x=size.marginX;
            const picture=type==='image'&&!block.textContent.trim()?block.querySelector('img'):null,formula=type==='formula'?block.querySelector(':scope > .display-math > mjx-container > svg'):null;
            if(picture||formula){const node=picture||formula,rect=node.getBoundingClientRect(),parent=block.getBoundingClientRect(),padding=picture?0:4;blockWidth=Math.min(width,rect.width+padding*2);x+=(rect.left-parent.left-padding)*autoScale;}
            if(type==='heading'){const glyphs=[...block.querySelectorAll('.glyph,.math')];if(glyphs.length){const parent=block.getBoundingClientRect(),right=Math.max(...glyphs.map(g=>g.getBoundingClientRect().right));blockWidth=Math.min(width,Math.ceil(right-parent.left+8));}}
            return{id,sourceId:spec.baseId,type,text:text.slice(0,120),x,y:size.marginY+used,width:blockWidth,height:block.offsetHeight,autoScale,html:serialize(block,s,key)};};
        outer: for(let i=0;i<blocks.length;i++) {
            if(isCanceled())throw new Error('LAYOUT_CANCELED');
            if(pages.length>=limit){truncated=true;break;}
            const spec=blocks[i];if(spec.break){finish();segment++;continue;}
            const occurrence=occurrences.get(spec.html)||0;occurrences.set(spec.html,occurrence+1);
            const key=`${C.hash(spec.html)}:${settingsKey}:${occurrence}`;let saved=cache.get(key);if(saved?.source!==spec.html)saved=null;
            stage.innerHTML=saved?.html||(spec.prepared?spec.html:`<div class="flow-block">${spec.html}</div>`);
            if(!saved&&!spec.chunked&&!spec.heading&&!spec.atomic){const chunks=paragraphChunks(stage.firstElementChild);if(chunks){blocks.splice(i,1,...chunks.map((chunk,j)=>({...chunk,baseId:spec.baseId+'-c'+j})));i--;continue;}}
            if(!saved&&!spec.prepared) {
                await Promise.all(Array.from(stage.querySelectorAll('img')).map(async img=>{try{await img.decode();img.width=img.naturalWidth;img.height=img.naturalHeight;}catch{warnings.add('有图片无法载入，已保留图片说明；请检查地址或重新导入。');img.replaceWith(document.createTextNode(`[图片无法载入：${img.alt}]`));}}));
                if(stage.querySelector('.missing-image'))warnings.add('本地相对路径图片需要通过“插入图片”导入。');
                fitTables(stage,width,warnings);await math(stage,s,warnings);fitMath(stage,width,warnings);
                StudioEffects.mathematics(stage,s,`${C.hash(spec.html)}:${occurrence}`);
                const penFont=await PenFonts.prepare(stage,s.font);
                StudioEffects.lettering(stage,s,`${spec.html}:${occurrence}`,penFont);
                StudioEffects.rhythm(stage,s,`${C.hash(spec.html)}:${occurrence}`);
                saved={html:stage.innerHTML,source:spec.html,warnings:Array.from(warnings)};
                rememberBlock(key,saved);
            } else if(saved) saved.warnings.forEach(w=>warnings.add(w));
            await Promise.all(Array.from(stage.querySelectorAll('img')).map(img=>img.decode().catch(()=>{})));
            let block=stage.firstElementChild,fragment=0;
            const table=block.querySelector('table');
            if(spec.heading&&parts.length&&maxHeight-used<block.offsetHeight+s.fontSize*s.lineHeight*2)finish();
            while(block) {
                if(pages.length>=limit){truncated=true;break outer;}
                const height=block.offsetHeight+8;
                if(height<=maxHeight-used){parts.push(pack(block,spec,key,fragment++));used+=height;break;}
                const split=table?splitTable(block,maxHeight-used):block.querySelector('pre')?splitCode(block,maxHeight-used):(!spec.atomic?splitLines(block,maxHeight-used):null);
                if(split){stage.replaceChildren(split[0]);parts.push(pack(split[0],spec,key,fragment++));finish();stage.replaceChildren(split[1]);block=split[1];continue;}
                if(parts.length){finish();continue;}
                // An indivisible matrix/cases/code block taller than the paper is scaled as a whole.
                const scale=Math.min(1,(maxHeight-10)/height);warnings.add('有不可拆分的公式、图片或内容块被整体缩放，以适应当前纸张。');
                parts.push(pack(block,spec,key,fragment++,scale));finish();break;
            }
            if(i%6===0){onProgress({done:i+1,total:blocks.length,pages:pages.length+1});await tick();}
        }
        finish();const present=new Set();
        for(const page of pages)for(const block of page.blocks){present.add(block.id);const edit=layout.blocks[block.id];block.base={x:block.x,y:block.y,width:block.width,height:block.height};block.reflowSource=block.html;
            if(edit?.width!==undefined){if(!StudioBlocks.reflowable(block.type)){warnings.add('表格和图片使用缩放或拉伸；已忽略其排版宽度调整。');continue;}
                Object.assign(block,reflow(block,edit.width,{settings:s,size,family},warnings,stage));}
        }
        if(!truncated){const missing=Object.keys(layout.blocks).filter(id=>!present.has(id));if(missing.length)warnings.add(`${missing.length} 个旧布局调整无法匹配当前内容，已保留记录但不应用。可恢复原文或清除失效调整。`);}
        const issues=pages.flatMap((p,page)=>StudioBlocks.issues(p.blocks,layout,size).map(v=>({...v,page:page+1})));
        if(issues.some(i=>i.type==='outside'))warnings.add('有手动内容块超出纸张，导出会按纸张边缘裁切；请调整位置或缩放。');
        if(issues.some(i=>i.type==='overlap'))warnings.add('有手动内容块相互重叠，可进入自由编辑调整。');
        stage.replaceChildren();
        return {pages,settings:s,size,family,style:paperStyle(s,family),warnings:Array.from(warnings),truncated,layout,issues};
    }
    function reflow(block,widthMM,result,warnings=new Set(),stage=null){
        const ownsStage=!stage,s=result.settings,width=Math.max(20,Math.min(840,widthMM))*StudioBlocks.PX;
        if(ownsStage){stage=document.createElement('div');stage.className='paper-content block-reflow-stage';stage.style.cssText=`--hand-font:"${result.family}";--size:${s.fontSize}px;--leading:${s.lineHeight};--math-size:${s.mathSize};--pen-width:${s.penWidth}px`;document.body.append(stage);}
        try{
            stage.style.width=width+'px';stage.innerHTML=block.reflowSource||block.html;const node=stage.firstElementChild;
            node.querySelectorAll('.decoration-ink,.table-ink').forEach(e=>e.remove());
            for(const el of node.querySelectorAll('.glyph,.math,.ink-mark')){el.style.translate='';if(el.matches('.math'))el.style.transform='';}
            fitMath(stage,width,warnings);
            const angle=node.dataset.writingAngle===undefined?undefined:Number(node.dataset.writingAngle);
            StudioEffects.rhythm(stage,s,block.id,angle);
            return{...block,width,height:node.offsetHeight,html:serialize(node,s,block.id)};
        }finally{if(ownsStage)stage.remove();}
    }
    function mountStructures(text,structures,content){
        const sources=Array.from(text.querySelectorAll('.math,.table-ink,.decoration-ink,.md-image'));
        const original=sources.map(node=>({node,transform:node.style.transform,translate:node.style.translate}));
        // These elements are invisible in the text layer. Measure their fractional
        // layout positions without their own transforms, then restore them before paint.
        for(const item of original){item.node.style.transform='none';item.node.style.translate='none';}
        const bounds=content.getBoundingClientRect(),scale=bounds.width/parseFloat(getComputedStyle(content).width);
        const positions=original.map(item=>{const rect=item.node.getBoundingClientRect(),style=getComputedStyle(item.node),width=parseFloat(style.width)||rect.width/scale,height=parseFloat(style.height)||rect.height/scale;return{...item,x:(rect.left-bounds.left)/scale,y:(rect.top-bounds.top)/scale,width,height,parentScale:width?rect.width/scale/width:1,fontSize:style.fontSize,color:style.color,penWidth:style.getPropertyValue('--pen-width')};});
        for(const item of original){item.node.style.transform=item.transform;item.node.style.translate=item.translate;}
        const fragment=document.createDocumentFragment();
        for(const item of positions){
            const placement=document.createElement('div');placement.className='pen-placement';Object.assign(placement.style,{position:'absolute',left:`${item.x}px`,top:`${item.y}px`,width:`${item.width}px`,height:`${item.height}px`,transform:`scale(${item.parentScale})`,transformOrigin:'top left'});
            const copy=item.node.cloneNode(true);Object.assign(copy.style,{position:'absolute',left:'0',top:'0',width:`${item.width}px`,height:`${item.height}px`,margin:'0',fontSize:item.fontSize,color:item.color});copy.style.setProperty('--pen-width',item.penWidth);placement.append(copy);fragment.append(placement);
        }
        structures.replaceChildren(fragment);
    }
    function setBlockView(shell,block,result){
        const v=StudioBlocks.view(block,result.layout.blocks[block.id]);
        Object.assign(shell.style,{left:v.x+'px',top:v.y+'px',width:block.width+'px',height:block.height+'px',transform:`rotate(${v.rotation}deg) scale(${v.scale*v.stretchX},${v.scale*v.stretchY})`,transformOrigin:'0 0'});
        // Balance overall ink weight; nonuniform stretching still changes directional stroke proportions.
        shell.dataset.locked=String(v.locked);shell.style.setProperty('--pen-width',result.settings.penWidth/(v.scale*Math.sqrt(v.stretchX*v.stretchY))+'px');return v;
    }
    function mount(result,index,target) {
        target.replaceChildren();const record=result.pages[index];if(!record)return;
        const page=document.createElement('article');page.className=`paper paper-${result.settings.paper} scene-${result.settings.scene}`;page.style.cssText=result.style;
        const content=document.createElement('div');content.className='paper-content block-page-content';page.append(content);target.append(page);
        for(const block of record.blocks){
            const shell=document.createElement('div');shell.className='page-block';shell.dataset.blockId=block.id;shell.dataset.blockType=block.type;
            content.append(shell);mountBlock(shell,block,result);
        }
        return page;
    }
    function mountBlock(shell,block,result){
            const art=document.createElement('div');art.className='block-art';shell.replaceChildren(art);delete shell.dataset.raster;delete shell.dataset.rasterRatio;
            const v=setBlockView(shell,block,result);shell.style.transform='none';
            if(result.settings.naturalness>0){
                const filterId='text-pen-'+block.id,defs=document.createElementNS('http://www.w3.org/2000/svg','svg');defs.setAttribute('width','0');defs.setAttribute('height','0');defs.style.position='absolute';
                const n=PenGestures.strength(result.settings),scale=n*Math.min(3.6,result.settings.fontSize*.145),size=result.size;
                defs.innerHTML=`<filter id="${filterId}" filterUnits="userSpaceOnUse" x="-16" y="-16" width="${block.width+32}" height="${block.height+32}" color-interpolation-filters="sRGB"><feImage href="${fieldURL(result.settings)}" x="-16" y="${-16-(block.y-size.marginY)}" width="${size.contentWidth+32}" height="${size.height+32}" preserveAspectRatio="none" result="pen-field"/><feDisplacementMap in="SourceGraphic" in2="pen-field" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
                art.append(defs);const text=document.createElement('div');text.className='text-ink-layer';text.style.filter='url(#'+filterId+')';text.innerHTML=block.html;
                const structures=document.createElement('div');structures.className='structural-ink-layer';structures.setAttribute('aria-hidden','true');art.append(text,structures);mountStructures(text,structures,art);
            }else art.innerHTML=block.html;
            shell.style.transform=`rotate(${v.rotation}deg) scale(${v.scale*v.stretchX},${v.scale*v.stretchY})`;
    }
    function describe(result){const P=StudioBlocks.PX,round=n=>Math.round(n*1000)/1000;
        return {version:1,units:'mm',paper:{width:result.size.widthMM,height:result.size.heightMM},pages:result.pages.length,warnings:result.warnings,issues:result.issues,layout:result.layout,
            blocks:result.pages.flatMap((p,index)=>p.blocks.map(b=>{const v=StudioBlocks.view(b,result.layout.blocks[b.id]);return{id:b.id,page:index+1,type:b.type,text:b.text,x:round(v.x/P),y:round(v.y/P),width:round(v.width/P),height:round(v.height/P),scale:round(v.scale/(b.autoScale||1)),stretchX:round(v.stretchX),stretchY:round(v.stretchY),rotation:v.rotation,locked:v.locked,group:v.group,reflowable:StudioBlocks.reflowable(b.type),automatic:{x:round(b.base.x/P),y:round(b.base.y/P),width:round(b.base.width*(b.autoScale||1)/P),height:round(b.base.height*(b.autoScale||1)/P)}};}))};
    }
    return {paginate,mount,mountBlock,reflow,flow,describe,setBlockView,mathFonts:new Map(),cacheStats:()=>({blocks:cache.size,bytes:cacheBytes,mathBytes}),clearCache(){cache.clear();mathCache.clear();cacheBytes=0;mathBytes=0;}};
})();
