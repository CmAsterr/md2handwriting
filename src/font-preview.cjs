const path = require('path');
const previews = new Map();
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

async function fontPreview(root, type, name, monoline, compact = false) {
    if (!['text', 'math'].includes(type) || path.basename(name) !== name || name.includes('..')) throw new Error('字体名称无效');
    const key = `${type}:${name}:${compact}`;
    if (previews.has(key)) return previews.get(key);
    let sample = type === 'text' ? (compact ? '山水日月 0123' : '山水日月，文字 0123') : (compact ? 'Aa xyz 0123' : 'Aa Bb xyz 012345');
    let glyphs, units;
    if (!name) {
        const {TeXFont} = require('mathjax-full/js/output/svg/fonts/tex.js');
        const font = new TeXFont(), items = [];
        sample = compact ? 'Aa xyz 0123 αβ' : 'Aa Bb xyz 012345 αβγ'; units = 1000; glyphs = {};
        for (const ch of new Set(sample)) {
            if (ch === ' ') { glyphs[ch] = {path:'',advance:250}; continue; }
            let metrics = font.getChar(/[0-9]/.test(ch) ? 'normal' : 'italic', ch.codePointAt(0));
            if (metrics[3].smp) metrics = font.getChar('normal', metrics[3].smp);
            const [height, depth, width, data] = metrics;
            glyphs[ch] = {advance:width * units};
            // TeX metrics include ascenders and descenders; allow italic side bearings.
            items.push({key:ch,d:'M'+data.p+'Z',box:{x:-100,y:-depth*units,width:(width+(data.ic||0))*units+200,height:(height+depth)*units}});
        }
        const centerlines = await monoline.paths(items);
        for (const [ch,d] of Object.entries(centerlines)) glyphs[ch].path = d;
    } else {
        const {font} = monoline.font(type, name);
        if (type === 'math' && [...'αβγ'].every(ch => font.hasGlyphForCodePoint(ch.codePointAt(0)))) sample += ' αβγ';
        // Specimens use the same centerlines as the page, without loading full CJK fonts.
        ({glyphs,units} = await monoline.glyphs(type, name, Array.from(sample)));
    }
    const advance = ch => glyphs[ch]?.advance ?? units;
    const width = compact ? 260 : 354, height = compact ? 40 : 46;
    const scale = Math.min((compact ? 26 : 28) / units, (width - 8) / Math.max(1, Array.from(sample).reduce((sum, ch) => sum + advance(ch), 0)));
    let x = 0;
    const paths = [];
    Array.from(sample).forEach(ch => {
        const glyph = glyphs[ch];
        if (glyph) paths.push(`<path d="${escape(glyph.path)}" transform="translate(${x} 0)"/>`);
        else paths.push(`<rect x="${x}" y="0" width="${units * .65}" height="${units * .6}"/>`);
        x += advance(ch);
    });
    const content = `<style>path,rect{fill:none;stroke:currentColor;stroke-width:1.15px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}</style><g transform="translate(3 ${compact ? 30 : 34}) scale(${scale} ${-scale})">${paths.join('')}</g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${escape(name || '标准数学字形')}：${escape(sample)}</title><g fill="#26392f" color="#26392f">${content}</g></svg>`;
    if (previews.size >= 100) previews.delete(previews.keys().next().value);
    previews.set(key, svg);
    return svg;
}
module.exports = { fontPreview };

