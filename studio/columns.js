(() => {
    'use strict';
    const main = document.querySelector('main');
    const panes = ['.settings', '.editor-pane', '.preview-pane'].map(selector => main.querySelector(selector));
    const minimums = [190, 240, 280];
    const storageKey = 'md2handwriting-next-column-widths';
    let ratios = null, widths = [], drag = null, lastWidth = 0;
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (Array.isArray(saved) && saved.length === 3 && saved.every(n => Number.isFinite(n) && n > 0)) {
            const total = saved.reduce((sum, n) => sum + n, 0);
            ratios = saved.map(n => n / total);
        }
    } catch {}
    panes.forEach((pane, i) => { pane.id ||= ['settings-pane', 'editor-pane', 'preview-pane'][i]; });
    const handles = [0, 1].map(index => {
        const handle = document.createElement('div');
        handle.className = 'column-resizer';
        handle.dataset.boundary = index;
        handle.tabIndex = 0;
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', index === 0 ? '调整参数栏与编辑栏宽度' : '调整编辑栏与预览栏宽度');
        handle.setAttribute('aria-controls', panes[index].id + ' ' + panes[index + 1].id);
        handle.title = '拖动调整列宽 · 双击恢复默认 · 方向键微调';
        main.append(handle);
        return handle;
    });
    function fit(total) {
        if (!ratios) {
            const left = innerWidth <= 1100 ? 205 : 244;
            const share = innerWidth <= 1100 ? .8 / 1.8 : .85 / 2.35;
            const middle = Math.max(minimums[1], Math.min(total - left - minimums[2], (total - left) * share));
            return [left, middle, total - left - middle];
        }
        // Allocate fixed minimums first, then distribute the remaining space.
        const result = ratios.map(r => r * total);
        const fixed = new Set();
        for (let pass = 0; pass < 3; pass++) {
            for (let i = 0; i < 3; i++) if (result[i] < minimums[i]) fixed.add(i);
            const remaining = total - [...fixed].reduce((sum, i) => sum + minimums[i], 0);
            const freeRatio = ratios.reduce((sum, r, i) => sum + (fixed.has(i) ? 0 : r), 0);
            for (let i = 0; i < 3; i++) result[i] = fixed.has(i) ? minimums[i] : remaining * ratios[i] / freeRatio;
        }
        return result;
    }
    function paint(next) {
        widths = next;
        main.style.gridTemplateColumns = next.map(n => `${n}px`).join(' ');
        handles.forEach((handle, index) => {
            handle.style.left = `${next.slice(0, index + 1).reduce((sum, n) => sum + n, 0)}px`;
            handle.setAttribute('aria-valuemin', String(minimums[index]));
            handle.setAttribute('aria-valuemax', String(Math.round(next[index] + next[index + 1] - minimums[index + 1])));
            handle.setAttribute('aria-valuenow', String(Math.round(next[index])));
            handle.setAttribute('aria-valuetext', `${Math.round(next[index])} 像素`);
        });
    }
    function save() {
        const total = widths.reduce((sum, n) => sum + n, 0);
        ratios = widths.map(n => n / total);
        try { localStorage.setItem(storageKey, JSON.stringify(ratios)); } catch {}
    }
    function resize(force = false) {
        const total = main.clientWidth;
        if (!force && total === lastWidth) return;
        lastWidth = total;
        if (innerWidth <= 780) { main.style.removeProperty('grid-template-columns'); return; }
        paint(fit(total));
    }
    function move(index, start, delta) {
        const next = [...start];
        const pair = start[index] + start[index + 1];
        next[index] = Math.max(minimums[index], Math.min(pair - minimums[index + 1], start[index] + delta));
        next[index + 1] = pair - next[index];
        paint(next);
    }
    function finish(cancel = false) {
        if (!drag) return;
        const current = drag; drag = null;
        if (cancel) paint(current.widths); else save();
        document.body.classList.remove('resizing-columns');
        if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
    }
    function reset() {
        finish(true); ratios = null;
        try { localStorage.removeItem(storageKey); } catch {}
        resize(true);
    }
    handles.forEach((handle, index) => {
        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0 || innerWidth <= 780) return;
            drag = {handle, pointerId: event.pointerId, x: event.clientX, widths: [...widths], index};
            handle.focus(); handle.setPointerCapture(event.pointerId);
            document.body.classList.add('resizing-columns'); event.preventDefault();
        });
        handle.addEventListener('pointermove', event => { if (drag?.handle === handle) move(index, drag.widths, event.clientX - drag.x); });
        handle.addEventListener('pointerup', () => finish());
        handle.addEventListener('pointercancel', () => finish(true));
        handle.addEventListener('lostpointercapture', () => finish(true));
        handle.addEventListener('dblclick', reset);
        handle.addEventListener('keydown', event => {
            if (event.key === 'Escape') { finish(true); return; }
            if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Home') reset();
            else { move(index, widths, (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 40 : 10)); save(); }
        });
    });
    window.addEventListener('resize', () => { finish(); resize(true); });
    new ResizeObserver(() => resize()).observe(main);
    resize(true);
})();
