import {Buffer} from 'buffer';
import * as fontkit from 'fontkit';
import {thin,trace,vectors} from './centerline.js';
globalThis.Buffer=Buffer;
const fonts=new Map(),memory=new Map(),pending=new Map();
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value)),b=>b.toString(16).padStart(2,'0')).join('');
const database=new Promise((resolve,reject)=>{const r=indexedDB.open('md2hw-pages-pen-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('glyphs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function cached(key,produce){
    if(memory.has(key))return memory.get(key);if(pending.has(key))return pending.get(key);
    const work=(async()=>{let value;try{const db=await database;value=await new Promise(resolve=>{const r=db.transaction('glyphs').objectStore('glyphs').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve();});}catch{}
        if(value===undefined){value=await produce();try{const db=await database,tx=db.transaction('glyphs','readwrite');tx.objectStore('glyphs').put(value,key);}catch{}}
        if(memory.size>=5000)memory.delete(memory.keys().next().value);memory.set(key,value);return value;})();pending.set(key,work);try{return await work;}finally{pending.delete(key);}
}
function centerline(parts,box,em=1000){
    if(!box.width||!box.height)return'';
    const pad=Math.max(em*.025,box.width*.025,box.height*.025),vw=box.width+2*pad,vh=box.height+2*pad,scale=Math.min(112/em,144/vw,144/vh),w=Math.max(8,Math.ceil(vw*scale)),h=Math.max(8,Math.ceil(vh*scale));
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.fillStyle='#000';ctx.setTransform(w/vw,0,0,-h/vh,-(box.x-pad)*w/vw,(box.y+box.height+pad)*h/vh);
    for(const part of parts){ctx.save();ctx.translate(part.x||0,part.y||0);ctx.fill(new Path2D(part.d));ctx.restore();}
    const pixels=ctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h);for(let i=0;i<mask.length;i++)mask[i]=pixels[i*4]<160?1:0;
    thin(mask,w,h);return vectors(trace(mask,w,h),box,pad,w/vw,h/vh);
}
async function fontEntry(url){
    if(!fonts.has(url)){if(fonts.size>=4)fonts.delete(fonts.keys().next().value);fonts.set(url,(async()=>{const res=await fetch(url);if(!res.ok)throw Error('字体下载失败，请重试');const bytes=await res.arrayBuffer(),opened=fontkit.create(Buffer.from(bytes)),font=typeof opened.layout==='function'?opened:opened.fonts?.[0];if(!font)throw Error('不支持的字体文件');return{id:(await digest(bytes)).slice(0,24),font};})().catch(error=>{fonts.delete(url);throw error;}));}return fonts.get(url);
}
async function glyph(entry,text){return cached(entry.id+':'+text,()=>{const font=entry.font,run=font.layout(text);if(run.glyphs.some(g=>!g.id))return null;
    let x=0,y=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const parts=[];
    run.glyphs.forEach((g,i)=>{const p=run.positions[i],b=g.bbox,px=x+p.xOffset,py=y+p.yOffset;parts.push({d:g.path.toSVG(),x:px,y:py});if(b.maxX>b.minX&&b.maxY>b.minY){minX=Math.min(minX,b.minX+px);minY=Math.min(minY,b.minY+py);maxX=Math.max(maxX,b.maxX+px);maxY=Math.max(maxY,b.maxY+py);}x+=p.xAdvance;y+=p.yAdvance;});
    const box=Number.isFinite(minX)?{x:minX,y:minY,width:maxX-minX,height:maxY-minY}:{x:0,y:0,width:0,height:0};return{path:centerline(parts,box,font.unitsPerEm),advance:x,...box};});}
async function execute(type,value){
    if(type==='paths'){const result={};for(const item of value.items)result[item.key]=await cached('path:'+await digest(JSON.stringify([item.d,item.box])),()=>centerline([{d:item.d}],item.box,Math.max(item.box.width,item.box.height,500)));return result;}
    const entry=await fontEntry(value.url),font=entry.font;
    if(type==='validate')return{id:entry.id};
    if(type==='glyphs'){const result={};for(const ch of new Set(value.chars))result[ch]=await glyph(entry,ch);return{id:entry.id,units:font.unitsPerEm,ascent:font.ascent,descent:font.descent,glyphs:result};}
    if(type==='math'){const result={};for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789αβγδεζηθικλμνξοπρστυφχψωΓΔΘΛΞΠΣΦΨΩ'){
        const g=font.glyphForCodePoint(ch.codePointAt(0));if(!g.id)continue;const b=g.bbox,normalized=await glyph(entry,ch);result[ch]={path:g.path.toSVG(),centerline:normalized?.path,x:b.minX,y:b.minY,width:b.maxX-b.minX,height:b.maxY-b.minY};}return result;}
    throw Error('未知笔迹操作');
}
self.onmessage=async event=>{const {id,type,value}=event.data;try{self.postMessage({id,result:await execute(type,value)});}catch(error){self.postMessage({id,error:error.message});}};
