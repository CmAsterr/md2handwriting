'use strict';
// Operates on a traced stroke graph, never on character names/code points.
// Only shorten paired, very small terminal arms of a T-junction. Do not delete
// connected components, isolated marks, closed loops or junction-to-junction edges.
function softenTerminals(paths){
    const key=p=>`${p.x},${p.y}`,ends=new Map();
    const length=p=>p.slice(1).reduce((sum,v,i)=>sum+Math.hypot(v.x-p[i].x,v.y-p[i].y),0);
    const all=paths.flat(),width=Math.max(...all.map(p=>p.x))-Math.min(...all.map(p=>p.x)),height=Math.max(...all.map(p=>p.y))-Math.min(...all.map(p=>p.y));
    if(!all.length||Math.min(width,height)<12)return paths;
    for(const [i,p]of paths.entries()){if(p.length<2||key(p[0])===key(p.at(-1)))continue;for(const [end,neighbor]of [[0,1],[p.length-1,p.length-2]]){const k=key(p[end]);if(!ends.has(k))ends.set(k,[]);ends.get(k).push({i,end,p:p[end],neighbor:p[neighbor],length:length(p)});}}
    const result=paths.map(p=>p.map(v=>({...v}))),limit=Math.min(width,height)*.16;
    const direction=e=>{const dx=e.neighbor.x-e.p.x,dy=e.neighbor.y-e.p.y,n=Math.hypot(dx,dy)||1;return[dx/n,dy/n];};
    for(const entries of ends.values()){
        if(entries.length!==3)continue;
        const arms=entries.filter(e=>e.length<limit&&e.length>0&&(ends.get(key(paths[e.i][e.end===0?paths[e.i].length-1:0]))||[]).length===1);
        if(arms.length!==2)continue;const stem=entries.find(e=>!arms.includes(e));if(stem.length<Math.max(...arms.map(e=>e.length))*3.5)continue;
        const [a,b,c]=[...arms,stem].map(direction),dot=(u,v)=>u[0]*v[0]+u[1]*v[1];if(dot(a,b)>-.88||Math.abs(dot(a,c))>.25||Math.abs(dot(b,c))>.25)continue;
        for(const arm of arms)for(const p of result[arm.i]){p.x=arm.p.x+(p.x-arm.p.x)*.35;p.y=arm.p.y+(p.y-arm.p.y)*.35;}
    }
    // Round small mechanical corners only inside each stroke. Shared endpoints
    // stay fixed, so branches still meet and isolated marks remain intact.
    return result.map(points=>{
        if(points.length<3)return points;
        const closed=key(points[0])===key(points.at(-1)),n=closed?points.length-1:points.length;
        const rounded=points.slice(0,n).map((p,i)=>{
            if(!closed&&(i===0||i===n-1))return p;
            const a=points[(i+n-1)%n],b=points[(i+1)%n],la=Math.hypot(p.x-a.x,p.y-a.y),lb=Math.hypot(p.x-b.x,p.y-b.y),radius=Math.min(la,lb,Math.min(width,height)*.07)*.3;
            if(!la||!lb)return p;return{x:p.x+radius*((a.x-p.x)/la+(b.x-p.x)/lb),y:p.y+radius*((a.y-p.y)/la+(b.y-p.y)/lb)};
        });if(closed)rounded.push({...rounded[0]});return rounded;
    });
}
module.exports={softenTerminals};
