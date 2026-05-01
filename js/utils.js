(function () {
    const HW = window.HW = window.HW || {};

    const utils = {
        el(id) {
            return document.getElementById(id);
        },

        escapeHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        hashString(value) {
            let h = 2166136261;
            const str = String(value || '');
            for (let i = 0; i < str.length; i++) {
                h ^= str.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return h >>> 0;
        },

        rng(seed) {
            let t = seed >>> 0;
            return function () {
                t += 0x6D2B79F5;
                let r = Math.imul(t ^ (t >>> 15), 1 | t);
                r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
                return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
            };
        },

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        nextFrame() {
            return new Promise(resolve => requestAnimationFrame(() => resolve()));
        },

        async yieldToBrowser() {
            await utils.nextFrame();
            await Promise.resolve();
        },

        safeFilename(name) {
            return String(name || '手写作业').replace(/[\\/:*?"<>|]+/g, '_').trim() || '手写作业';
        },

        dataUrlToBlob(dataUrl) {
            const [meta, body] = dataUrl.split(',');
            const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'application/octet-stream';
            const bin = atob(body);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], { type: mime });
        },

        blobToDataUrl(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        },

        loadImage(dataUrl) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = dataUrl;
            });
        },

        canvasToBlob(canvas, type = 'image/jpeg', quality = 0.94) {
            return new Promise(resolve => canvas.toBlob(resolve, type, quality));
        },

        setProgress(text, percent) {
            const pText = utils.el('progress-text');
            const pBar = utils.el('progress-bar');
            if (pText && text) pText.innerText = text;
            if (pBar && Number.isFinite(percent)) {
                const clamped = Math.max(0, Math.min(100, percent));
                const floor = Number(HW.state.exportProgressFloor) || 0;
                const next = Math.max(floor, clamped);
                HW.state.exportProgressFloor = next;
                pBar.style.width = `${next}%`;
            }
        },

        showProgress(text) {
            const modal = utils.el('progress-modal');
            HW.state.exportProgressFloor = 0;
            if (modal) modal.style.display = 'flex';
            utils.setProgress(text || '正在准备导出...', 0);
        },

        hideProgress(delay = 600) {
            const modal = utils.el('progress-modal');
            if (!modal) return;
            setTimeout(() => { modal.style.display = 'none'; }, delay);
        },

        waitForMathJax() {
            if (!window.MathJax || !MathJax.startup || !MathJax.startup.promise) return Promise.resolve();
            return MathJax.startup.promise;
        },

        encodeCssUrl(url) {
            return String(url).replace(/\\/g, '/').replace(/'/g, "\\'");
        }
    };

    HW.utils = utils;
})();
