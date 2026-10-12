window.StudioRaster=(()=>{
    'use strict';
    const cache=new Map(),assets=new Map(),sources=new WeakMap(),tickets=new WeakMap();let bytes=0,hits=0,draws=0,cssPromise,current,refreshTimer;
    const MAX=64*1024*1024,PAD=24;
    async function dataURL(url){if(url.startsWith('data:'))return url;if(!assets.has(url)){if(assets.size>=16)assets.delete(assets.keys().next().value);assets.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('缓存素材读取失败');return r.blob();}).then(blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);})).catch(e=>{assets.delete(url);throw e;}));}return assets.get(url);}
    async function stylesheet(){if(!cssPromise)cssPromise=fetch('/md2handwriting/studio/style.css').then(r=>r.text()).then(async text=>{for(const match of [...text.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)])if(!match[1].startsWith('#'))text=text.replaceAll(match[0],`url("${await dataURL(match[1])}")`);return text;});return cssPromise;}
    async function raster(art,block,result,ratio){
        const source=sources.get(art)||art.innerHTML,pen=Number.parseFloat(getComputedStyle(art).getPropertyValue('--pen-width')),key=JSON.stringify([block.id,StudioCore.hash(source),block.width,block.height,pen,ratio,result.settings.fontSize,result.settings.lineHeight]);sources.set(art,source);
        const known=cache.get(key);if(known&&known.source===source){hits++;cache.delete(key);cache.set(key,known);return known;}
        const clone=art.cloneNode(false),computed=getComputedStyle(art);clone.innerHTML=source;clone.style.cssText=`position:relative;width:${block.width}px;height:${block.height}px;font-family:${computed.fontFamily};font-size:${computed.fontSize};line-height:${result.settings.lineHeight};--math-size:${result.settings.mathSize};--pen-width:${pen}px;--size:${result.settings.fontSize}px;--leading:${result.settings.lineHeight};--content-height:${result.size.contentHeight-16}px;color:#222b32`;
        for(const element of clone.querySelectorAll('img,feImage')){const attr=element.tagName.toLowerCase()==='img'?'src':'href',url=element.getAttribute(attr);if(url&&!url.startsWith('#'))element.setAttribute(attr,await dataURL(url));}
        // Only the used reusable glyph definitions are embedded in the bitmap.
        const defs=document.createElementNS('http://www.w3.org/2000/svg','svg');defs.setAttribute('width','0');defs.setAttribute('height','0');defs.style.position='absolute';const holder=document.createElementNS(defs.namespaceURI,'defs');defs.append(holder);
        PenFonts.ensure(clone);const refs=new Set([...clone.querySelectorAll('use')].map(e=>e.getAttribute('href')).filter(h=>h?.startsWith('#')));for(const id of refs){const original=document.getElementById(id.slice(1));if(original)holder.append(original.cloneNode(true));}clone.prepend(defs);
        const width=Math.ceil(block.width+PAD*2),height=Math.ceil(block.height+PAD*2),canvas=document.createElement('canvas');canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);
        if(canvas.width*canvas.height>18000000)throw Error('内容块过大，保留矢量预览');
        const css=await stylesheet(),wrap=document.createElement('div');wrap.setAttribute('xmlns','http://www.w3.org/1999/xhtml');wrap.style.cssText=`padding:${PAD}px;width:${width}px;height:${height}px;overflow:hidden`;wrap.append(clone);
        const xml=new XMLSerializer().serializeToString(wrap);
        const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${width} ${height}"><style>${css.replace(/&/g,'&amp;').replace(/</g,'&lt;')} :root{background:transparent!important}</style><foreignObject width="${width}" height="${height}">${xml}</foreignObject></svg>`;
        const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),image=new Image();try{image.src=url;await image.decode();canvas.getContext('2d').drawImage(image,0,0);}finally{URL.revokeObjectURL(url);}
        const value={canvas,width,height,source,bytes:canvas.width*canvas.height*4};draws++;
        while(cache.size&&(bytes+value.bytes>MAX||cache.size>=100)){const first=cache.keys().next().value;bytes-=cache.get(first).bytes;cache.delete(first);}if(value.bytes<=MAX){cache.set(key,value);bytes+=value.bytes;}return value;
    }
    async function mount(page,result,index){
        current={page,result,index};const ticket=(tickets.get(page)||0)+1;tickets.set(page,ticket);page.dataset.raster='preparing';
        let prepared=0;for(const block of result.pages[index]?.blocks||[]){if(!page.isConnected||tickets.get(page)!==ticket)return;const shell=[...page.querySelectorAll('.page-block')].find(e=>e.dataset.blockId===block.id),art=shell?.querySelector('.block-art');if(!art)continue;
            const v=StudioBlocks.view(block,result.layout.blocks[block.id]),scale=v.scale*Math.max(v.stretchX,v.stretchY),preview=Number.parseFloat(document.querySelector('#paper-host')?.style.getPropertyValue('--preview-scale'))||1;
            const ratio=Math.max(1,Math.min(6,Math.ceil(Math.max(preview,1)*Math.max(scale,1)*devicePixelRatio),Math.sqrt(16000000/((block.width+PAD*2)*(block.height+PAD*2)))));
            if(shell.dataset.raster==='ready'&&Number(shell.dataset.rasterRatio)===ratio){prepared++;continue;}
            try{const value=await raster(art,block,result,ratio);if(!page.isConnected||!art.isConnected||tickets.get(page)!==ticket)return;const canvas=document.createElement('canvas');canvas.width=value.canvas.width;canvas.height=value.canvas.height;canvas.getContext('2d').drawImage(value.canvas,0,0);Object.assign(canvas.style,{position:'absolute',left:-PAD+'px',top:-PAD+'px',width:value.width+'px',height:value.height+'px',pointerEvents:'none'});canvas.setAttribute('aria-label',block.text);art.replaceChildren(canvas);shell.dataset.raster='ready';shell.dataset.rasterRatio=ratio;prepared++;}catch(error){shell.dataset.raster='fallback';console.warn('笔迹预览缓存：'+error.message);}
            // Spread large-page preparation across tasks so input stays responsive.
            await new Promise(resolve=>setTimeout(resolve,0));
        }
        if(page.isConnected){page.dataset.raster='ready';page.dataset.rasterBlocks=prepared;}
    }
    window.addEventListener('studio-zoom',()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(current?.page.isConnected&&!window.StudioEditor?.dragging)mount(current.page,current.result,current.index);},240);});
    return {mount,stats:()=>({bytes,entries:cache.size,hits,draws}),clear(){cache.clear();bytes=0;}};
})();
