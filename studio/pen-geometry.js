(function (root, factory) {
    if (typeof module === 'object') module.exports = factory();
    else root.PenGeometry = factory();
})(globalThis, function () {
    // Deform vector control points while preserving continuous quadratic/cubic contours.
    // Arc paths are left untouched rather than approximated with jagged segments.
    function deformPath(source, warp) {
        if (/[Aa]/.test(source)) return source;
        const tokens = source.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
        const counts = {M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2};
        let index=0,command='',previous='',x=0,y=0,sx=0,sy=0,cx=0,cy=0,qx=0,qy=0;
        const result=[];
        const point=(a,b)=>{const p=warp(a,b);if(!p.every(Number.isFinite))throw new Error('Invalid pen coordinates');return p.map(n=>Number(n.toFixed(3))).join(' ');};
        try {
            while(index<tokens.length){
                if(/^[a-zA-Z]$/.test(tokens[index]))command=tokens[index++];
                const type=command.toUpperCase(),relative=command!==type;
                if(type==='Z'){result.push('Z');x=sx;y=sy;previous='Z';command='';continue;}
                const count=counts[type];if(!count||index+count>tokens.length)return source;
                const values=tokens.slice(index,index+count).map(Number);if(!values.every(Number.isFinite))return source;index+=count;
                const px=i=>values[i]+(relative?x:0),py=i=>values[i]+(relative?y:0);
                let endX=x,endY=y;
                if(type==='M'||type==='L'){endX=px(0);endY=py(1);result.push(type+point(endX,endY));if(type==='M'){sx=endX;sy=endY;command=relative?'l':'L';}}
                else if(type==='H'){endX=px(0);result.push('L'+point(endX,endY));}
                else if(type==='V'){endY=py(0);result.push('L'+point(endX,endY));}
                else if(type==='C'){cx=px(2);cy=py(3);endX=px(4);endY=py(5);result.push('C'+point(px(0),py(1))+' '+point(cx,cy)+' '+point(endX,endY));}
                else if(type==='S'){const ax=['C','S'].includes(previous)?2*x-cx:x,ay=['C','S'].includes(previous)?2*y-cy:y;cx=px(0);cy=py(1);endX=px(2);endY=py(3);result.push('C'+point(ax,ay)+' '+point(cx,cy)+' '+point(endX,endY));}
                else if(type==='Q'){qx=px(0);qy=py(1);endX=px(2);endY=py(3);result.push('Q'+point(qx,qy)+' '+point(endX,endY));}
                else if(type==='T'){qx=['Q','T'].includes(previous)?2*x-qx:x;qy=['Q','T'].includes(previous)?2*y-qy:y;endX=px(0);endY=py(1);result.push('Q'+point(qx,qy)+' '+point(endX,endY));}
                x=endX;y=endY;previous=type;
            }
            return result.join('');
        } catch { return source; }
    }
    // Subdivide a centerline before a nonlinear warp. Transform endpoint tangents
    // with the warp's Jacobian, so adjacent Beziers share a tangent (no polyline
    // corners), even when a long bracket needs several independent bends.
    function bendStroke(source,warp,pixelsPerUnit=1,maxSpan=10){
        if(/[Aa]/.test(source))return source;
        const canonical=deformPath(source,(x,y)=>[x,y]);
        const tokens=canonical.match(/[A-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)||[];
        const epsilon=.025/Math.max(pixelsPerUnit,1e-6),out=[];
        let index=0,start=[0,0],current=start;
        const fmt=p=>p.map(v=>Number(v.toFixed(3))).join(' ');
        function mapped(p,tangent){
            const q=warp(...p),xp=warp(p[0]+epsilon,p[1]),xm=warp(p[0]-epsilon,p[1]),yp=warp(p[0],p[1]+epsilon),ym=warp(p[0],p[1]-epsilon);
            return{p:q,d:[0,1].map(k=>((xp[k]-xm[k])*tangent[0]+(yp[k]-ym[k])*tangent[1])/(2*epsilon))};
        }
        function cubic(p0,p1,p2,p3){
            const length=Math.hypot(p1[0]-p0[0],p1[1]-p0[1])+Math.hypot(p2[0]-p1[0],p2[1]-p1[1])+Math.hypot(p3[0]-p2[0],p3[1]-p2[1]);
            const count=Math.max(1,Math.min(96,Math.ceil(length*pixelsPerUnit/maxSpan)));
            function at(t){const s=1-t;return mapped([0,1].map(k=>s*s*s*p0[k]+3*s*s*t*p1[k]+3*s*t*t*p2[k]+t*t*t*p3[k]),[0,1].map(k=>3*s*s*(p1[k]-p0[k])+6*s*t*(p2[k]-p1[k])+3*t*t*(p3[k]-p2[k])));}
            let a=at(0);
            for(let i=1;i<=count;i++){const b=at(i/count),step=1/(3*count);out.push('C'+fmt(a.p.map((v,k)=>v+a.d[k]*step))+' '+fmt(b.p.map((v,k)=>v-b.d[k]*step))+' '+fmt(b.p));a=b;}
            current=p3;
        }
        try{while(index<tokens.length){const command=tokens[index++];
            const read=()=>[Number(tokens[index++]),Number(tokens[index++])];
            if(command==='M'){current=read();start=current;out.push('M'+fmt(warp(...current)));}
            else if(command==='C')cubic(current,read(),read(),read());
            else if(command==='Q'){const q=read(),end=read();cubic(current,current.map((v,k)=>v+(q[k]-v)*2/3),end.map((v,k)=>v+(q[k]-v)*2/3),end);}
            else if(command==='L'){const end=read();cubic(current,current.map((v,k)=>v+(end[k]-v)/3),current.map((v,k)=>v+(end[k]-v)*2/3),end);}
            else if(command==='Z'){if(Math.hypot(current[0]-start[0],current[1]-start[1])>1e-8)cubic(current,current.map((v,k)=>v+(start[k]-v)/3),current.map((v,k)=>v+(start[k]-v)*2/3),start);out.push('Z');current=start;}
            else return source;
        }const result=out.join('');return /NaN|Infinity/.test(result)?source:result;}catch{return source;}
    }
    return {deformPath,bendStroke};
});
