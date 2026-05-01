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
            '1': { type: '1', count: 5, yMin: 34, yMax: 64, xMin: -12, xMax: 2, wMin: 102, wMax: 124, hMin: 2.2, hMax: 4.4, aMin: 0.78, aMax: 0.96, rMin: -10, rMax: 10, bMin: 0.02, bMax: 0.22, skMin: -5, skMax: 5, shadowMin: 0, shadowMax: 1.4 },
            '2': { type: '2', count: 8, yMin: 16, yMax: 78, xMin: -18, xMax: 8, wMin: 84, wMax: 130, hMin: 1.8, hMax: 4.0, aMin: 0.66, aMax: 0.94, rMin: -26, rMax: 26, bMin: 0.02, bMax: 0.36, skMin: -11, skMax: 11, shadowMin: 0, shadowMax: 1.1 },
            '3': { type: '3', count: 12, yMin: 8, yMax: 88, xMin: -20, xMax: 10, wMin: 92, wMax: 138, hMin: 2.8, hMax: 6.4, aMin: 0.70, aMax: 0.98, rMin: -20, rMax: 20, bMin: 0.10, bMax: 0.58, skMin: -9, skMax: 9, shadowMin: 0.4, shadowMax: 2.0 }
        };
        const profile = profiles[type] || profiles['1'];
        const lines = [];
        const scaled = Math.max(3, Math.round(profile.count * Math.max(0.75, intensity)));
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
