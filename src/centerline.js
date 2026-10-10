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

export {thin,trace,vectors};
