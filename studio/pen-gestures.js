(function(root,factory){
    if(typeof module==='object')module.exports=factory();
    else root.PenGestures=factory();
})(globalThis,function(){
    const strength=s=>Math.pow(s.naturalness/100,.85);
    const signed=r=>(r()<.5?-1:1)*(.55+.45*r());
    function profile(settings,math=true){return{strength:strength(settings),em:settings.fontSize*(math?settings.mathSize:1)};}
    function noise(length,spacing,r,pin=true){
        const count=Math.max(2,Math.min(96,Math.ceil(length/Math.max(4,spacing))));
        const values=Array.from({length:count+1},(_,i)=>pin&&(i===0||i===count)?0:signed(r));
        const slopes=values.map((v,i)=>i===0||i===count?0:(values[i+1]-values[i-1])*.5);
        return t=>{const pos=Math.max(0,Math.min(count,t*count)),i=Math.min(count-1,Math.floor(pos)),a=pos-i,a2=a*a,a3=a2*a;return(2*a3-3*a2+1)*values[i]+(a3-2*a2+a)*slopes[i]+(-2*a3+3*a2)*values[i+1]+(a3-a2)*slopes[i+1];};
    }
    // One calibration for short and long pen movements. Long strokes gain local
    // direction changes at a physical spacing instead of stretching a few bends.
    function ribbon(length,settings,r,{gain=1,pin=false,math=true,local=1}={}){
        const {strength:n,em}=profile(settings,math),reach=Math.min(em*.17,length*.085);
        const bow=signed(r)*reach*.85,correction=signed(r)*reach*.34,phase=r()*Math.PI*2,frequency=1.5+r();
        const tip=Math.min(em*.04,length*.025),start=pin?0:signed(r)*tip,end=pin?0:signed(r)*tip;
        const drift=noise(length,em*1.05,r),driftSize=Math.min(em*.06,length*.035);
        return t=>n*gain*(start*(1-t)+end*t+bow*Math.sin(Math.PI*t)+correction*Math.sin(Math.PI*t)*Math.sin(frequency*Math.PI*t+phase)+local*driftSize*drift(t));
    }
    function mesh(width,height,spacing,r){
        const nx=Math.max(1,Math.min(64,Math.ceil(width/spacing))),ny=Math.max(1,Math.min(64,Math.ceil(height/spacing)));
        const values=Array.from({length:ny+1},()=>Array.from({length:nx+1},()=>signed(r)));
        const cubic=(a,b,c,d,t)=>b+(.5*(c-a)+((a-2.5*b+2*c-.5*d)+(-.5*a+1.5*b-1.5*c+.5*d)*t)*t)*t;
        return(u,v)=>{const x=Math.max(0,Math.min(nx,u*nx)),y=Math.max(0,Math.min(ny,v*ny)),ix=Math.min(nx-1,Math.floor(x)),iy=Math.min(ny-1,Math.floor(y)),rows=[];
            for(let j=-1;j<=2;j++){const row=values[Math.max(0,Math.min(ny,iy+j))],p=[];for(let k=-1;k<=2;k++)p.push(row[Math.max(0,Math.min(nx,ix+k))]);rows.push(cubic(...p,x-ix));}
            return cubic(...rows,y-iy);
        };
    }
    const bound=(value,limit)=>{if(Array.isArray(limit))limit=limit[value<0?0:1];return Number.isFinite(limit)&&limit>0?limit*Math.tanh(value/limit):value;};
    function line(x1,y1,x2,y2,settings,r,{unit=1,...options}={}){
        const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy)||1,normal=[-dy/length,dx/length];
        const offset=ribbon(length*unit,settings,r,options);
        return(x,y)=>{const t=((x-x1)*dx+(y-y1)*dy)/(length*length),d=bound(offset(t),options.limit)/unit;return[x+normal[0]*d,y+normal[1]*d];};
    }
    function field(b,settings,r,{gain=1,math=true,limitX=Infinity,limitY=Infinity}={}){
        const {em,strength:n}=profile(settings,math),w=Math.max(.1,b.width),h=Math.max(.1,b.height);
        const across=ribbon(w,settings,r,{gain:gain*.65,math,local:0}),down=ribbon(h,settings,r,{gain:gain*.65,math,local:0});
        const horizontal=mesh(w,h,em*1.2,r),vertical=mesh(w,h,em*1.2,r),detail=n*gain*Math.min(em*.075,Math.max(w,h)*.035);
        return(x,y)=>{const u=(x-b.x)/w,v=(y-b.y)/h;
            return[x+bound(down(v)+detail*horizontal(u,v),limitX),y+bound(across(u)+detail*vertical(u,v),limitY)];
        };
    }
    function operator(b,settings,r,{gain=1,math=true,limitX=Infinity,limitY=Infinity}={}){
        // Composite arrows, accents and double bars get one map shared by every
        // component, retaining their joins and relative spacing.
        if(b.width>2*b.height){const warp=line(b.x,b.y+b.height/2,b.x+b.width,b.y+b.height/2,settings,r,{gain,math,limit:limitY});return warp;}
        if(b.height>2*b.width){const warp=line(b.x+b.width/2,b.y,b.x+b.width/2,b.y+b.height,settings,r,{gain,math,limit:limitX});return warp;}
        return field(b,settings,r,{gain:gain*.65,math,limitX,limitY});
    }
    function opacity(settings,r){return(.62+.36*Math.sqrt(settings.pressure/100)-strength(settings)*r()*.025).toFixed(3);}
    function symbol(kind,b,settings,r,unit){
        const {strength,em}=profile(settings),height=b.height*unit,width=b.width*unit;
        const signed=()=>(r()<.5?-1:1)*(.55+.45*r());
        // Work in paper pixels, not a percentage of a very narrow glyph. A tall
        // 4px bracket otherwise receives imperceptible fractions of a pixel.
        const reach=Math.min(em*.17,Math.max(.6,height*.085));
        const lean=signed()*Math.min(em*.19,height*.09);
        let bow=signed()*Math.min(reach*.85,width*(kind.endsWith('Bracket')?.34:.48));
        if(kind.endsWith('Paren')&&bow*(kind.startsWith('left')?1:-1)>0)bow*=.55;
        const correction=signed()*reach*.34,phase=r()*Math.PI*2,frequency=1.5+r();
        const offsetX=signed()*Math.min(.65,em*.035),offsetY=signed()*Math.min(.8,height*.035);
        const trim=signed()*Math.min(em*.12,height*.055),squeeze=(r()-.5)*.22;
        const spans=Math.max(2,Math.min(12,Math.ceil(height/(em*.82))));
        const drift=Array.from({length:spans+1},(_,i)=>i===0||i===spans?0:signed());
        const slope=drift.map((v,i)=>i===0||i===spans?0:(drift[i+1]-drift[i-1])*.5);
        const driftSize=Math.min(em*.06,height*.035);
        function localDrift(t){
            const position=Math.max(0,Math.min(spans,t*spans)),i=Math.min(spans-1,Math.floor(position)),a=position-i,a2=a*a,a3=a2*a;
            return(2*a3-3*a2+1)*drift[i]+(a3-2*a2+a)*slope[i]+(-2*a3+3*a2)*drift[i+1]+(a3-a2)*slope[i+1];
        }
        const inward=kind.startsWith('left')?1:kind.startsWith('right')?-1:0;
        return (x,y)=>{
            const t=(y-b.y)/b.height,u=(x-b.x)/b.width;
            let dx=offsetX+lean*(t-.5)+bow*Math.sin(Math.PI*t)+correction*Math.sin(Math.PI*t)*Math.sin(frequency*Math.PI*t+phase)+(u-.5)*width*squeeze+driftSize*localDrift(t);
            // Limit inward movement near the tips. The limit depends on height,
            // not x, so this map stays monotone across the glyph and cannot fold
            // a hook onto itself or reverse a bracket's open side.
            if(inward&&dx*inward>0){const envelope=Math.sin(Math.PI*Math.max(0,Math.min(1,t)))**2,limit=.7+envelope*Math.min(em*.18,width*.65);dx=inward*limit*Math.tanh(dx*inward/limit);}
            return[x+strength*dx/unit,y+strength*(offsetY+trim*(t-.5))/unit];
        };
    }
    function glyph(b,settings,r,variant){
        const n=strength(settings),w=Math.max(.1,b.width),h=Math.max(.1,b.height);
        // Related handwriting variants, with a different waist, lean and bowl
        // balance. These are continuous coordinate maps, retaining stroke joins.
        const profiles=[[-.12,.08,-.09],[.12,-.07,.06],[-.05,-.1,.10],[.08,.1,-.06],[-.14,.02,.04],[.03,-.12,-.08],[.13,.05,.08],[-.04,.12,.02]];
        const [lean,waist,balance]=profiles[variant],phase=r()*Math.PI*2,squeeze=(r()-.5)*.12;
        const lx=Math.min(1.4,w*.22),ly=Math.min(.95,h*.13);
        return(x,y)=>{const u=(x-b.x)/w-.5,v=(y-b.y)/h,t=Math.max(0,Math.min(1,v));
            const dx=lean*h*(v-.65)+waist*w*Math.sin(Math.PI*t)*(1-3*u*u)+squeeze*w*u+balance*w*u*(2*t-1);
            const dy=balance*h*Math.sin(Math.PI*t)*Math.sin(u*Math.PI)+h*.028*Math.sin(2*Math.PI*t+phase)*Math.sin(Math.PI*t);
            return[x+n*bound(dx,lx),y+n*bound(dy,ly)];
        };
    }
    return {strength,profile,noise,ribbon,line,field,operator,opacity,symbol,glyph};
});
