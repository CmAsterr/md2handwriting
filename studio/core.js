(function (root, factory) {
    const api = factory();
    if (typeof module === 'object') module.exports = api;
    else root.StudioCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const defaults = Object.freeze({ font: 'handwritten-fixed.ttf', mathFont: 'Kalam-Light.ttf', fontSize: 27, mathSize: 0.92,
        lineHeight: 1.65, marginX: 62, marginY: 65, naturalness: 35, pressure: 30, seed: 1,
        scribble: 'mixed', ink: 'mixed', paper: 'plain', paperVersion: 2, background: '', backgroundSource: '', backgroundCrop: null, quality: 2,
        scene: 'scan', light: 35, texture: 25, tableStyle: 'hand', penWidth: 1, pageWidth: 210, pageHeight: 297 });
    const paperSizes=Object.freeze({a4:[210,297],a5:[148,210],a3:[297,420],b5:[176,250],letter:[215.9,279.4]});
    function pageSize(input={}){
        const mm=(v,fallback)=>Number.isFinite(Number(v))&&v!==null?Math.round(Math.max(50,Math.min(420,Number(v)))*10)/10:fallback;
        const widthMM=mm(input.pageWidth,210),heightMM=mm(input.pageHeight,297);
        const width=Math.round(widthMM*800/210),height=Math.round(heightMM*800/210);
        const marginX=Math.min(Number(input.marginX)||defaults.marginX,Math.floor(width/4)),marginY=Math.min(Number(input.marginY)||defaults.marginY,Math.floor(height/4));
        const preset=Object.entries(paperSizes).find(([,v])=>(v[0]===widthMM&&v[1]===heightMM)||(v[1]===widthMM&&v[0]===heightMM));
        return {widthMM,heightMM,width,height,marginX,marginY,contentWidth:width-2*marginX,contentHeight:height-2*marginY,
            points:[widthMM*72/25.4,heightMM*72/25.4],preset:preset?.[0]||'custom',label:preset?preset[0].toUpperCase():'自定义'};
    }
    function hash(value) { let h = 2166136261; for (const ch of String(value)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
    function random(seed) { let a = hash(seed); return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function escape(text) { return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
    function settings(input = {}) {
        const out = { ...defaults };
        for (const key of ['font', 'mathFont', 'scribble', 'ink', 'paper', 'background','backgroundSource','scene','tableStyle']) if (typeof input[key] === 'string') out[key] = input[key];
        for (const [key, lo, hi] of [['fontSize',16,52],['mathSize',0.6,1.5],['lineHeight',1.2,2.6],['marginX',20,150],['marginY',20,180],['naturalness',0,100],['pressure',0,100],['seed',1,2147483647],['quality',1,3],['light',0,100],['texture',0,100],['penWidth',.4,2]]) {
            if (Number.isFinite(Number(input[key]))) out[key] = Math.max(lo, Math.min(hi, Number(input[key])));
        }
        const size=pageSize(input);out.pageWidth=size.widthMM;out.pageHeight=size.heightMM;out.quality=Math.round(out.quality);
        if (!['plain', 'ruled', 'grid', 'photo-plain', 'photo-ruled', 'custom'].includes(out.paper)) out.paper = 'plain';
        if (!['scan','desk','side'].includes(out.scene)) out.scene = 'scan';
        if (!['hand','ruled','minimal'].includes(out.tableStyle)) out.tableStyle = 'hand';
        if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(out.background)) out.background = '';
        if (!out.background || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(out.backgroundSource)) out.backgroundSource = '';
        if(out.backgroundSource&&input.backgroundCrop){
            const crop=input.backgroundCrop,limit=(v,lo,hi,fallback)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):fallback;
            out.backgroundCrop={x:limit(crop.x,0,1,.5),y:limit(crop.y,0,1,.5),zoom:limit(crop.zoom,1,4,1)};
        }
        // Older drafts had an independent photo layer that overrode the paper
        // label. Preserve that appearance, but identify it correctly on load.
        if(Number(input.paperVersion)!==2&&out.background&&['plain','ruled','grid'].includes(out.paper))out.paper='custom';
        if(out.paper==='custom'&&!out.background)out.paper='plain';
        for (const key of ['font','mathFont']) if (/[\\/\x00-\x1f]/.test(out[key]) || out[key].includes('..')) out[key] = defaults[key];
        return out;
    }
    function escaped(text, i) { let n = 0; while (i > 0 && text[--i] === '\\') n++; return !!(n % 2); }
    // Match complete delimiters and nested environments. Never split TeX by '=' or line length.
    function mathAt(text, blockOnly = false) {
        const pairs = blockOnly ? [['$$','$$'],['\\[','\\]']] : [['$$','$$'],['\\[','\\]'],['\\(','\\)'],['$','$']];
        for (const [open, close] of pairs) {
            if (!text.startsWith(open)) continue;
            if (open === '$' && text.startsWith('$$')) continue;
            for (let i = open.length; i < text.length; i++) {
                if (text.startsWith(close, i) && !escaped(text, i)) {
                    if (open === '$' && (text[i+1] === '$' || text.slice(1,i).includes('\n'))) continue;
                    return { raw: text.slice(0, i + close.length), tex: text.slice(open.length, i), display: open === '$$' || open === '\\[' };
                }
            }
        }
        const start = /^\\begin\{([A-Za-z*]+)\}/.exec(text);
        if (start) {
            const stack = []; const re = /\\(begin|end)\{([A-Za-z*]+)\}/g; let m;
            while ((m = re.exec(text))) {
                if (escaped(text, m.index)) continue;
                if (m[1] === 'begin') stack.push(m[2]);
                else if (stack.pop() !== m[2]) return null;
                if (!stack.length) return { raw: text.slice(0, re.lastIndex), tex: text.slice(0, re.lastIndex), display: true };
            }
        }
        return null;
    }
    function colorAt(text) {
        const match = /^\\textcolor\{(red|blue|black|#[0-9a-fA-F]{3,8})\}\{/.exec(text);
        if (!match) return null;
        let depth = 1;
        for (let i = match[0].length; i < text.length; i++) {
            if (escaped(text, i)) continue;
            if (text[i] === '{') depth++;
            if (text[i] === '}') depth--;
            if (!depth) return { raw: text.slice(0, i+1), color: match[1], text: text.slice(match[0].length, i) };
        }
        return null;
    }
    const safeName = name => (String(name || '手写作业').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0,80) || '手写作业');
    function paperImage(s){
        if(s.paper==='custom')return s.background||'';
        const preset={'photo-plain':'空白.jpg','photo-ruled':'横线.jpg'}[s.paper];
        return preset?'/md2handwriting/仿真背景图/'+encodeURIComponent(preset):'';
    }
    return { defaults, settings, paperSizes, pageSize, paperImage, hash, random, escape, mathAt, colorAt, safeName };
});
