(function () {
    const HW = window.HW = window.HW || {};
    const { hashString, rng } = HW.utils;

    function n(value) {
        return Number(value).toFixed(1).replace(/\.0$/, '');
    }

    function path(d, width, alpha = 0.92) {
        return `<path d="${d}" pathLength="100" style="--sw:${n(width)};--a:${n(alpha)}"></path>`;
    }

    function edgePoint(r, side) {
        if (side === 0) return [8 + r() * 16, 12 + r() * 76];
        if (side === 1) return [76 + r() * 16, 12 + r() * 76];
        if (side === 2) return [12 + r() * 76, 8 + r() * 16];
        return [12 + r() * 76, 76 + r() * 16];
    }

    function looseLine(r, index) {
        const [x1, y1] = edgePoint(r, index % 4);
        const [x2, y2] = edgePoint(r, (index + 2 + Math.floor(r() * 2)) % 4);
        const cx = 50 + (r() - 0.5) * 34;
        const cy = 50 + (r() - 0.5) * 46;
        return `M${n(x1)} ${n(y1)} Q${n(cx)} ${n(cy)} ${n(x2)} ${n(y2)}`;
    }

    function slantedLine(r, index, chaos) {
        const templates = [
            [3, 58, 97, 42],
            [0, 46, 94, 50],
            [8, 70, 88, 60],
            [12, 34, 96, 26],
            [2, 82, 76, 66],
            [22, 24, 88, 18],
            [18, 52, 82, 45],
            [30, 72, 96, 56]
        ];
        const base = templates[index % templates.length];
        const jitter = 2.4 + chaos * 1.3;
        const x1 = base[0] + (r() - 0.5) * jitter;
        const y1 = base[1] + (r() - 0.5) * jitter;
        const x2 = base[2] + (r() - 0.5) * jitter;
        const y2 = base[3] + (r() - 0.5) * jitter;
        return `M${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}`;
    }

    function scribble(seed, style, widthScale = 1, chaosScale = 1) {
        const type = String(style || '1');
        const r = rng(hashString(`${seed}:scribble:${type}`));
        const widthMul = Math.max(0.15, Math.min(2.5, Number(widthScale) || 1));
        const chaos = Math.max(0, Math.min(3, Number(chaosScale) || 1));
        const width = (type === '1' ? 3.2 : type === '2' ? 3.0 : 3.3) * widthMul;
        const parts = [];

        if (type === '1') {
            const flip = r() > 0.5 ? 1 : -1;
            const d = flip > 0
                ? `M${n(17 + r() * 8)} ${n(80 + r() * 10)} C${n(34 + r() * 8)} ${n(58 + r() * 10)} ${n(56 + r() * 8)} ${n(34 + r() * 8)} ${n(82 + r() * 7)} ${n(13 + r() * 8)}`
                : `M${n(18 + r() * 8)} ${n(18 + r() * 8)} C${n(35 + r() * 8)} ${n(36 + r() * 8)} ${n(58 + r() * 8)} ${n(58 + r() * 8)} ${n(84 + r() * 6)} ${n(82 + r() * 8)}`;
            parts.push(path(d, width, 0.96));
        } else if (type === '2') {
            const count = Math.round(3 + chaos * 2);
            for (let i = 0; i < count; i++) {
                parts.push(path(slantedLine(r, i, chaos), width * (0.82 + r() * 0.22), 0.78 + r() * 0.18));
            }
            if (chaos > 0.8) {
                const ticks = Math.round(chaos);
                for (let i = 0; i < ticks; i++) {
                    const x = 28 + r() * 48;
                    const y = 24 + r() * 42;
                    parts.push(path(`M${n(x)} ${n(y)} L${n(x + 5 + r() * 8)} ${n(y + 18 + r() * 18)}`, width * 0.72, 0.72));
                }
            }
        } else {
            parts.push(path(`M18 78 C6 32 88 10 84 58 C80 100 18 92 24 48 C31 5 82 18 72 62 C63 96 32 78 40 42`, width * 1.02, 0.94));
            parts.push(path(`M26 20 C82 18 88 80 40 86 C8 88 16 36 54 32 C92 28 80 78 42 70`, width * 0.9, 0.9));
            parts.push(path(`M22 72 C42 52 58 46 80 24`, width * 0.88, 0.88));
            parts.push(path(`M18 28 C42 44 60 58 88 74`, width * 0.86, 0.86));
            const extra = Math.round(2 + chaos * 3);
            for (let i = 0; i < extra; i++) {
                parts.push(path(looseLine(r, i + 3), width * (0.72 + r() * 0.22), 0.72 + r() * 0.18));
            }
        }

        return `<span class="scribble-effect scribble-type-${type}"><svg class="scribble-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${parts.join('')}</svg></span>`;
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
