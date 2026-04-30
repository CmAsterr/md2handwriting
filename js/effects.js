(function () {
    const HW = window.HW = window.HW || {};
    const { hashString, rng } = HW.utils;

    function stroke(seed, index, dense) {
        const r = rng(hashString(`${seed}:stroke:${index}`));
        const y = dense ? 16 + r() * 68 : 36 + r() * 30;
        const x = -6 + r() * 12;
        const w = 94 + r() * 18;
        const h = dense ? 1.8 + r() * 3.2 : 1.2 + r() * 1.1;
        const a = dense ? 0.52 + r() * 0.34 : 0.65 + r() * 0.22;
        const rot = -8 + r() * 16;
        const blur = dense ? 0.1 + r() * 0.6 : r() * 0.25;
        return `<span class="scribble-stroke" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--w:${w.toFixed(1)}%;--h:${h.toFixed(2)}px;--a:${a.toFixed(2)};--r:${rot.toFixed(2)}deg;--b:${blur.toFixed(2)}px"></span>`;
    }

    function scribble(seed, style, intensity = 1) {
        const type = String(style || '1');
        const dense = type === '3';
        const count = type === '1' ? 2 : type === '2' ? 5 : 8;
        const lines = [];
        const scaled = Math.max(1, Math.round(count * Math.max(0.5, intensity)));
        for (let i = 0; i < scaled; i++) lines.push(stroke(seed, i, dense));
        return `<span class="scribble-effect scribble-type-${type}">${lines.join('')}</span>`;
    }

    function ink(seed, style, scaleBase = 1) {
        const type = String(style || '1');
        const r = rng(hashString(`${seed}:ink:${type}`));
        const scale = (0.75 + r() * 0.65) * scaleBase;
        const rot = -35 + r() * 70;
        const ox = -28 + r() * 18;
        const oy = -10 + r() * 20;
        const parts = [`<span class="ink-core"></span>`];

        const dotCount = type === '1' ? 4 : type === '2' ? 8 : 5;
        for (let i = 0; i < dotCount; i++) {
            const s = 2 + r() * (type === '2' ? 6 : 4);
            const x = -2 + r() * 36;
            const y = -3 + r() * 27;
            const a = 0.42 + r() * 0.42;
            parts.push(`<span class="ink-dot" style="--s:${s.toFixed(1)}px;--x:${x.toFixed(1)}px;--y:${y.toFixed(1)}px;--a:${a.toFixed(2)}"></span>`);
        }

        if (type === '3') {
            parts.push(`<span class="ink-smear" style="--r:${(-8 + r() * 16).toFixed(1)}deg"></span>`);
        }

        return `<span class="ink-blot ink-type-${type}" style="transform: translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px) scale(${scale.toFixed(2)}) rotate(${rot.toFixed(1)}deg);">${parts.join('')}</span>`;
    }

    HW.effects = { scribble, ink };
})();
