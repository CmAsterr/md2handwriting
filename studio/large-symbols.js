window.StudioLargeSymbols = (() => {
    const groups = {
        leftBrace:['7B','23A7','23A8','23A9'], rightBrace:['7D','23AB','23AC','23AD'],
        leftParen:['28','239B','239C','239D'], rightParen:['29','239E','239F','23A0'],
        leftBracket:['5B','23A1','23A2','23A3'], rightBracket:['5D','23A4','23A5','23A6'],
        integral:['222B','222C','222D','222E','222F','2230'],
        union:['222A','22C3'], intersection:['2229','22C2'],
        sum:['2211'], product:['220F'], coproduct:['2210']
    };
    const kinds = new Map(Object.entries(groups).flatMap(([kind,codes])=>codes.map(code=>[code,kind])));
    function draw(node,code,b,settings,r,unit,penStroke){
        const kind=kinds.get(code),n=settings.naturalness/100,p=settings.pressure/100;
        if(!kind)return false;
        // The fixed nib is shared with text, equations and table rules; symbol size
        // changes only the centerline gesture, never its stroke thickness.
        const width=settings.penWidth/unit;
        node.replaceChildren();node.dataset.handSymbol=kind;node.dataset.handStructure=code;
        const warp=PenGestures.symbol(kind,b,settings,r,unit);
        const stroke=(d,multiplier=1,closed=false)=>{
            const path=penStroke(node,n?PenGeometry.bendStroke(d,warp,unit,8):d,width,n,p,r,unit,{closed});
            if(n)path.dataset.handGesture='true';return path;
        };
        const point=(u,v)=>`${b.x+u*b.width} ${b.y+v*b.height}`;
        const delta=amount=>(r()-.5)*amount*n;
        if(kind.endsWith('Paren')){
            const left=kind==='leftParen',x=u=>left?u:1-u;
            const top=.94+delta(.20),bottom=.91+delta(.38),belly=.085+delta(.15),middle=.50+delta(.24);
            stroke(`M${point(x(top),.995)} C${point(x(.35+delta(.16)),.91)} ${point(x(belly+delta(.06)),.72)} ${point(x(belly),middle)} C${point(x(belly+delta(.10)),.27)} ${point(x(.35+delta(.20)),.08)} ${point(x(bottom),.005)}`);
        }else if(kind.endsWith('Brace')){
            const left=kind==='leftBrace',x=u=>left?u:1-u;
            const middle=.50+delta(.18),upper=.54+delta(.30),lower=.51+delta(.30),cusp=.07+delta(.08);
            stroke(`M${point(x(.95+delta(.08)),.995)} C${point(x(.40+delta(.13)),.985)} ${point(x(upper-.08),.88)} ${point(x(upper),.73)} C${point(x(upper+.09),.59)} ${point(x(.43+delta(.10)),middle+.035)} ${point(x(cusp),middle)} C${point(x(.42+delta(.10)),middle-.04)} ${point(x(lower-.09),.40)} ${point(x(lower),.27)} C${point(x(lower+.03),.11)} ${point(x(.48+delta(.13)),.035)} ${point(x(.93+delta(.17)),.005)}`);
        }else if(kind.endsWith('Bracket')){
            const left=kind==='leftBracket',x=u=>left?u:1-u,stem=.10+delta(.07);
            stroke(`M${point(x(.95),.995)} Q${point(x(.46),.99+delta(.025))} ${point(x(stem),.985)} C${point(x(stem+delta(.14)),.7)} ${point(x(stem+delta(.14)),.3)} ${point(x(stem),.015)} Q${point(x(.48),.01+delta(.025))} ${point(x(.94+delta(.10)),.005)}`);
        }else if(kind==='integral'){
            const count=code==='222C'||code==='222F'?2:code==='222D'||code==='2230'?3:1;
            const contour=['222E','222F','2230'].includes(code);
            const slot=b.width/(1+.60*(count-1));
            for(let i=0;i<count;i++){
                const x=b.x+i*slot*.60,pt=(u,v)=>`${x+u*slot} ${b.y+v*b.height}`;
                const upper=.68+delta(.18),lower=.33+delta(.18),lean=delta(.18);
                stroke(`M${pt(.88+delta(.08),.88+delta(.04))} C${pt(1,.995)} ${pt(upper,.998)} ${pt(upper,.87)} C${pt(.62+lean,.66)} ${pt(.48+lean,.35)} ${pt(lower,.12)} C${pt(lower,.002)} ${pt(.025,.002)} ${pt(.065+delta(.05),.115+delta(.03))}`,1+delta(.1));
            }
            if(contour){
                const cx=b.x+b.width*.5,cy=b.y+b.height*.5,rx=Math.min(b.width*.38,b.height*.15),ry=Math.min(b.width*.26,b.height*.13),k=.55228475;
                stroke(`M${cx+rx} ${cy} C${cx+rx} ${cy+k*ry} ${cx+k*rx} ${cy+ry} ${cx} ${cy+ry} C${cx-k*rx} ${cy+ry} ${cx-rx} ${cy+k*ry} ${cx-rx} ${cy} C${cx-rx} ${cy-k*ry} ${cx-k*rx} ${cy-ry} ${cx} ${cy-ry} C${cx+k*rx} ${cy-ry} ${cx+rx} ${cy-k*ry} ${cx+rx} ${cy} Z`,.82,true);
            }
        }else if(kind==='union'||kind==='intersection'){
            const y=v=>kind==='union'?v:1-v,left=.10+delta(.08),right=.90+delta(.08),low=.04+delta(.025);
            stroke(`M${point(left,y(.98+delta(.03)))} C${point(left+delta(.08),y(.73))} ${point(.06+delta(.05),y(.40))} ${point(.12+delta(.06),y(.22))} C${point(.19+delta(.07),y(low))} ${point(.76+delta(.09),y(low+delta(.02)))} ${point(.88+delta(.05),y(.22))} C${point(.95+delta(.04),y(.43))} ${point(right+delta(.05),y(.79))} ${point(right,y(.97+delta(.05)))}`);
        }else if(kind==='sum'){
            const middle=.5+delta(.10);
            stroke(`M${point(.96,.96+delta(.035))} Q${point(.48,1+delta(.02))} ${point(.065,.97)} C${point(.19,.82)} ${point(.37,.65)} ${point(.51+delta(.10),middle)} C${point(.34,.32)} ${point(.17,.13)} ${point(.065,.03)} Q${point(.49,.015+delta(.03))} ${point(.96,.04+delta(.03))}`);
        }else{
            const y=v=>kind==='coproduct'?1-v:v;
            stroke(`M${point(.02,y(.95))} Q${point(.52,y(.96+delta(.07)))} ${point(.98,y(.96+delta(.035)))}`);
            for(const u of [.14,.85])stroke(`M${point(u,y(.95))} C${point(u+delta(.07),y(.69))} ${point(u+delta(.07),y(.30))} ${point(u+delta(.05),y(.02))}`);
        }
        return true;
    }
    return {handles:code=>kinds.has(code),draw};
})();
