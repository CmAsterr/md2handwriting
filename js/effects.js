(function () {
    const HW = window.HW = window.HW || {};
    const { hashString, rng } = HW.utils;

    function stroke(seed, index, profile) {
        const r = rng(hashString(`${seed}:stroke:${index}:${profile.type}`));
        const y = profile.yMin + r() * (profile.yMax - profile.yMin);
        const x = profile.xMin + r() * (profile.xMax - profile.xMin);
        const w = profile.wMin + r() * (profile.wMax - profile.wMin);
        const h = profile.hMin + r() * (profile.hMax - profile.hMin);
        const a = profile.aMin + r() * (profile.aMax - profile.aMin);
        const rot = profile.rMin + r() * (profile.rMax - profile.rMin);
        const blur = profile.bMin + r() * (profile.bMax - profile.bMin);
        const skew = profile.skMin + r() * (profile.skMax - profile.skMin);
        const shadow = profile.shadowMin + r() * (profile.shadowMax - profile.shadowMin);
        return `<span class="scribble-stroke" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--w:${w.toFixed(1)}%;--h:${h.toFixed(2)}px;--a:${a.toFixed(2)};--r:${rot.toFixed(2)}deg;--b:${blur.toFixed(2)}px;--sk:${skew.toFixed(2)}deg;--shadow:${shadow.toFixed(2)}px"></span>`;
    }

    function scribble(seed, style, intensity = 1) {
        const type = String(style || '1');
        const profiles = {
            '1': { type: '1', count: 2, yMin: 42, yMax: 58, xMin: -8, xMax: 3, wMin: 98, wMax: 116, hMin: 1.05, hMax: 1.75, aMin: 0.82, aMax: 0.96, rMin: -5, rMax: 5, bMin: 0, bMax: 0.08, skMin: -3, skMax: 3, shadowMin: 0, shadowMax: 0.25 },
            '2': { type: '2', count: 6, yMin: 22, yMax: 76, xMin: -14, xMax: 8, wMin: 78, wMax: 124, hMin: 0.95, hMax: 1.85, aMin: 0.72, aMax: 0.94, rMin: -20, rMax: 20, bMin: 0, bMax: 0.12, skMin: -7, skMax: 7, shadowMin: 0, shadowMax: 0.35 },
            '3': { type: '3', count: 10, yMin: 12, yMax: 88, xMin: -18, xMax: 10, wMin: 84, wMax: 132, hMin: 1.05, hMax: 2.1, aMin: 0.74, aMax: 0.98, rMin: -22, rMax: 22, bMin: 0.02, bMax: 0.16, skMin: -8, skMax: 8, shadowMin: 0.05, shadowMax: 0.45 }
        };
        const profile = profiles[type] || profiles['1'];
        const lines = [];
        const scaled = Math.max(profile.count, Math.round(profile.count * Math.max(0.75, intensity)));
        for (let i = 0; i < scaled; i++) lines.push(stroke(seed, i, profile));
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
