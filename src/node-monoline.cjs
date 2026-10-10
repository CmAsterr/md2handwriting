'use strict';
const fs=require('fs'),fsp=fs.promises,path=require('path'),crypto=require('crypto');
const sharp=require('sharp'),fontkit=require('fontkit');
const VERSION='centerline-v1';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

// Zhang-Suen topology-preserving thinning, with the two subiterations applied in batches.
function thin(mask,w,h){
    const remove=[];
    for(let round=0;round<Math.max(w,h);round++){
        let changed=0;
        for(let step=0;step<2;step++){
            remove.length=0;
            for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
                const i=y*w+x;if(!mask[i])continue;
                const n=[mask[i-w],mask[i-w+1],mask[i+1],mask[i+w+1],mask[i+w],mask[i+w-1],mask[i-1],mask[i-w-1]];
                const count=n.reduce((a,b)=>a+b,0);if(count<2||count>6)continue;
                let transitions=0;for(let k=0;k<8;k++)if(!n[k]&&n[(k+1)%8])transitions++;
                if(transitions!==1)continue;
                if(step===0?(n[0]*n[2]*n[4]||n[2]*n[4]*n[6]):(n[0]*n[2]*n[6]||n[0]*n[4]*n[6]))continue;
                remove.push(i);
            }
            for(const i of remove)mask[i]=0;changed+=remove.length;
        }
        if(!changed)break;
    }
    return mask;
}
function simplify(points,epsilon=.65){
    if(points.length<3)return points;
    const a=points[0],b=points.at(-1),dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;let largest=0,at=0;
    for(let i=1;i<points.length-1;i++){const p=points[i],t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0,dist=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);if(dist>largest){largest=dist;at=i;}}
    if(largest<=epsilon)return[a,b];
    return simplify(points.slice(0,at+1),epsilon).slice(0,-1).concat(simplify(points.slice(at),epsilon));
}
function trace(mask,w,h){
    const graph=new Map();
    for(let i=0;i<mask.length;i++){if(!mask[i])continue;const x=i%w,y=Math.floor(i/w),neighbors=[];
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
            if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=h||!mask[j])continue;
            if(dx&&dy&&(mask[y*w+xx]||mask[yy*w+x]))continue;
            neighbors.push(j);
        }graph.set(i,neighbors);
    }
    const visited=new Set(),paths=[],edge=(a,b)=>Math.min(a,b)*mask.length+Math.max(a,b);
    function walk(start,next){const ids=[start];let previous=start,current=next;visited.add(edge(start,next));
        for(let k=0;k<mask.length;k++){ids.push(current);if(current===start||graph.get(current).length!==2)break;const candidate=graph.get(current).find(n=>n!==previous);if(candidate===undefined||visited.has(edge(current,candidate)))break;visited.add(edge(current,candidate));previous=current;current=candidate;}
        const points=ids.map(i=>({x:i%w,y:Math.floor(i/w)}));
        // Discard only tiny terminal spurs at junctions, never isolated dots or closed loops.
        if(points.length<=2&&graph.get(start).length===1&&graph.get(ids.at(-1)).length>2)return;
        paths.push(simplify(points));
    }
    for(const [i,neighbors] of graph){if(!neighbors.length){paths.push([{x:i%w,y:Math.floor(i/w)}]);continue;}if(neighbors.length===2)continue;for(const j of neighbors)if(!visited.has(edge(i,j)))walk(i,j);}
    for(const [i,neighbors] of graph)for(const j of neighbors)if(!visited.has(edge(i,j)))walk(i,j);
    return paths;
}
function vectors(paths,box,pad,sx,sy){
    const point=p=>({x:box.x-pad+(p.x+.5)/sx,y:box.y+box.height+pad-(p.y+.5)/sy});
    const fmt=p=>`${Number(p.x.toFixed(2))} ${Number(p.y.toFixed(2))}`;
    const corner=(a,b,c)=>{const u=[b.x-a.x,b.y-a.y],v=[c.x-b.x,c.y-b.y],m=Math.hypot(...u)*Math.hypot(...v);return m&&((u[0]*v[0]+u[1]*v[1])/m)<.55;};
    return paths.map(raw=>{
        const pts=raw.map(point);if(pts.length===1)return`M${fmt(pts[0])}l.01 0`;
        let d=`M${fmt(pts[0])}`;
        for(let i=0;i<pts.length-1;i++){
            const a=pts[Math.max(0,i-1)],b=pts[i],c=pts[i+1],e=pts[Math.min(pts.length-1,i+2)];
            const c1=corner(a,b,c)?b:{x:b.x+(c.x-a.x)/6,y:b.y+(c.y-a.y)/6};
            const c2=corner(b,c,e)?c:{x:c.x-(e.x-b.x)/6,y:c.y-(e.y-b.y)/6};
            d+=`C${fmt(c1)} ${fmt(c2)} ${fmt(c)}`;
        }
        return d;
    }).join('');
}
async function centerline(contents,box,em=1000){
    if(!box.width||!box.height)return'';
    const pad=Math.max(em*.025,box.width*.025,box.height*.025),vw=box.width+2*pad,vh=box.height+2*pad;
    const scale=Math.min(112/em,144/vw,144/vh),w=Math.max(8,Math.ceil(vw*scale)),h=Math.max(8,Math.ceil(vh*scale));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box.x-pad} ${-box.y-box.height-pad} ${vw} ${vh}" preserveAspectRatio="none"><g fill="black" transform="scale(1 -1)">${contents}</g></svg>`;
    const pixels=await sharp(Buffer.from(svg)).flatten({background:'#fff'}).greyscale().raw().toBuffer();
    const mask=Uint8Array.from(pixels,v=>v<160?1:0);thin(mask,w,h);
    return vectors(trace(mask,w,h),box,pad,w/vw,h/vh);
}
class Monoline {
    constructor(root,data){this.root=root;this.cache=path.join(data,'pen-cache',VERSION);this.fonts=new Map();this.pending=new Map();this.memory=new Map();}
    font(type,name){
        if(!['text','math'].includes(type)||path.basename(name)!==name||/[\\/:\x00]/.test(name)||name.includes('..'))throw new Error('字体名称无效');
        const file=path.join(this.root,'fonts',type==='text'?'正文字体':'公式字体',name),stat=fs.statSync(file),id=digest(`${file}:${stat.size}:${stat.mtimeMs}`).slice(0,24);
        if(!this.fonts.has(id)){const opened=fontkit.openSync(file),font=typeof opened.layout==='function'?opened:opened.fonts?.[0];if(!font)throw new Error('字体无法读取');if(this.fonts.size>=4)this.fonts.delete(this.fonts.keys().next().value);this.fonts.set(id,{id,font});}
        return this.fonts.get(id);
    }
    async cached(key,produce){
        if(this.memory.has(key))return this.memory.get(key);
        if(this.pending.has(key))return this.pending.get(key);
        const work=(async()=>{const file=path.join(this.cache,key+'.json');let result;try{result=JSON.parse(await fsp.readFile(file,'utf8'));}catch{result=await produce();await fsp.mkdir(this.cache,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fsp.writeFile(temp,JSON.stringify(result),{flag:'wx'});await fsp.rename(temp,file);}finally{await fsp.unlink(temp).catch(()=>{});}}
            if(this.memory.size>=5000)this.memory.delete(this.memory.keys().next().value);this.memory.set(key,result);return result;})();
        this.pending.set(key,work);try{return await work;}finally{this.pending.delete(key);}
    }
    async glyph(type,name,text,entry=this.font(type,name)){
        const font=entry.font,key=digest(`${entry.id}:${text}`);
        return this.cached(key,async()=>{
            const run=font.layout(text);if(run.glyphs.some(g=>!g.id))return null;
            let x=0,y=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const parts=[];
            run.glyphs.forEach((g,i)=>{const p=run.positions[i],b=g.bbox,px=x+p.xOffset,py=y+p.yOffset;parts.push(`<path d="${escape(g.path.toSVG())}" transform="translate(${px} ${py})"/>`);if(b.maxX>b.minX&&b.maxY>b.minY){minX=Math.min(minX,b.minX+px);minY=Math.min(minY,b.minY+py);maxX=Math.max(maxX,b.maxX+px);maxY=Math.max(maxY,b.maxY+py);}x+=p.xAdvance;y+=p.yAdvance;});
            const box=Number.isFinite(minX)?{x:minX,y:minY,width:maxX-minX,height:maxY-minY}:{x:0,y:0,width:0,height:0};
            return{path:await centerline(parts.join(''),box,font.unitsPerEm),advance:x,...box};
        });
    }
    async glyphs(type,name,chars){
        if(!Array.isArray(chars)||chars.length>3000||chars.some(c=>typeof c!=='string'||c.length>32))throw new Error('字形请求无效');
        const entry=this.font(type,name),{font,id}=entry,result=Object.create(null);
        // Yield through Sharp's asynchronous rasterizer between characters; requests remain responsive.
        for(const ch of new Set(chars))result[ch]=await this.glyph(type,name,ch,entry);
        return{id,units:font.unitsPerEm,ascent:font.ascent,descent:font.descent,glyphs:result};
    }
    async paths(items){
        if(!Array.isArray(items)||items.length>400)throw new Error('笔画请求无效');
        const result=Object.create(null);for(const item of items){const b=item?.box;if(!item||typeof item.key!=='string'||typeof item.d!=='string'||item.d.length>200000||/[^MLHVCSQTAZmlhvcsqtaz0-9eE.,+\-\s]/.test(item.d)||!b||!['x','y','width','height'].every(k=>Number.isFinite(b[k])&&Math.abs(b[k])<1e7)||b.width<0||b.height<0)throw new Error('路径无效');
            const key=digest(JSON.stringify([item.d,b]));result[item.key]=await this.cached(key,()=>centerline(`<path d="${escape(item.d)}"/>`,b,Math.max(b.width,b.height,500)));}
        return result;
    }
}
module.exports={Monoline,thin,trace,centerline};
