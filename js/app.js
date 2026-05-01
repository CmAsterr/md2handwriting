(function () {
    const HW = window.HW = window.HW || {};
    const { el } = HW.utils;
    let cropper = null;

    function saveState() {
        const bgImageVar = document.documentElement.style.getPropertyValue('--paper-bg-image');
        const bgMatch = bgImageVar && bgImageVar.match(/url\(['"]?(data:image[^'")]+)['"]?\)/);
        const state = captureState();
        state.customBg = bgMatch ? bgMatch[1] : null;
        localStorage.setItem(HW.config.stateKey, JSON.stringify(state));
    }

    function captureState() {
        const state = {
            text: el('textInput') ? el('textInput').value : '',
            removeEmptyLines: !!(el('removeEmptyLines') && el('removeEmptyLines').checked),
            autoMath: !!(el('autoMath') && el('autoMath').checked),
            splitMathEq: !!(el('splitMathEq') && el('splitMathEq').checked),
            useLocalExporter: !!(el('useLocalExporter') && el('useLocalExporter').checked),
            scribble: HW.state.scribbleStyle,
            ink: HW.state.inkStyle,
            textFont: HW.state.textFont || 'default',
            mathFont: HW.state.mathFont || 'default',
            scribbleCss: el('customScribbleCss') ? el('customScribbleCss').value : '',
            inkCss: el('customInkCss') ? el('customInkCss').value : '',
            config: { ...HW.state.modes }
        };
        HW.config.controls.forEach(id => {
            if (el(id)) state[id] = el(id).value;
        });
        return state;
    }

    function setMode(type, val, item, shouldRender = true) {
        const parent = item && item.parentElement;
        if (parent) Array.from(parent.children).forEach(child => child.classList.remove('active'));
        if (item) item.classList.add('active');
        HW.state.modes[`${type}Mode`] = val;
        saveState();
        if (shouldRender) HW.renderer.debounceRender();
    }

    function setStyle(type, val, item, shouldRender = true) {
        const strVal = String(val);
        const parent = item && item.parentElement;
        if (parent) Array.from(parent.children).forEach(child => child.classList.remove('active'));
        if (item) item.classList.add('active');

        if (type === 'scribble') {
            HW.state.scribbleStyle = strVal;
            const cssInput = el('customScribbleCss');
            if (cssInput) cssInput.style.display = strVal === 'custom' ? 'block' : 'none';
        }
        if (type === 'ink') {
            HW.state.inkStyle = strVal;
            const cssInput = el('customInkCss');
            if (cssInput) cssInput.style.display = strVal === 'custom' ? 'block' : 'none';
        }
        updateCustomCss();
        saveState();
        if (shouldRender) HW.renderer.forceRender();
    }

    function updateCustomCss() {
        const scribbleCss = el('customScribbleCss') ? el('customScribbleCss').value : '';
        const inkCss = el('customInkCss') ? el('customInkCss').value : '';
        let styleTag = el('geek-custom-css');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'geek-custom-css';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = `
            .scribble-effect.scribble-type-custom { position:absolute; pointer-events:none; z-index:8; inset:-0.12em -4px; ${scribbleCss} }
            .ink-type-custom { width: 28px; height: 22px; ${inkCss} }
        `;
    }

    function closeCropModal() {
        const modal = el('cropModal');
        if (modal) modal.style.display = 'none';
        if (cropper) cropper.destroy();
        cropper = null;
        if (el('bgImageInput')) el('bgImageInput').value = '';
    }

    function applyBg(value) {
        document.documentElement.style.setProperty('--paper-bg-image', `url('${value}')`);
        if (el('bgPreview')) {
            el('bgPreview').style.backgroundImage = `url('${value}')`;
            el('bgPreview').style.display = 'block';
        }
        if (el('resetBgBtn')) el('resetBgBtn').style.display = 'block';
    }

    function resetBg() {
        document.documentElement.style.setProperty('--paper-bg-image', 'none');
        if (el('bgPreview')) el('bgPreview').style.display = 'none';
        if (el('resetBgBtn')) el('resetBgBtn').style.display = 'none';
        saveState();
        HW.renderer.debounceRender();
    }

    function createCropperFromSource(src) {
        const cropImage = el('cropImage');
        cropImage.src = src;
        el('cropModal').style.display = 'flex';
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropImage, {
            aspectRatio: HW.config.page.width / HW.config.page.height,
            viewMode: 1,
            autoCropArea: 0.9,
            wheelZoomRatio: 0.05,
            ready() {
                const data = this.cropper.getImageData();
                const initialZoom = data.width / data.naturalWidth;
                el('cropZoomSlider').value = initialZoom;
                el('cropZoomInput').value = initialZoom.toFixed(2);
            },
            zoom(event) {
                el('cropZoomSlider').value = event.detail.ratio;
                el('cropZoomInput').value = event.detail.ratio.toFixed(2);
            }
        });
    }

    function applyCrop() {
        if (!cropper) return;
        const croppedCanvas = cropper.getCroppedCanvas({ width: HW.config.page.width, height: HW.config.page.height });
        const base64Data = croppedCanvas.toDataURL('image/jpeg', 0.9);
        applyBg(base64Data);
        closeCropModal();
        saveState();
        HW.renderer.debounceRender();
    }

    function setPresetBg(url) {
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.blob();
            })
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => createCropperFromSource(reader.result);
                reader.readAsDataURL(blob);
            })
            .catch(error => {
                console.error('背景加载失败:', error);
                alert('内置图片加载失败，请确认正在通过本地服务器或 GitHub Pages 运行。');
            });
    }

    function bindBackgroundControls() {
        el('bgImageInput').addEventListener('change', event => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = readEvent => createCropperFromSource(readEvent.target.result);
            reader.readAsDataURL(file);
        });
        el('cropZoomSlider').addEventListener('input', function () {
            if (cropper) cropper.zoomTo(parseFloat(this.value));
            el('cropZoomInput').value = parseFloat(this.value).toFixed(2);
        });
        el('cropZoomInput').addEventListener('change', function () {
            let val = parseFloat(this.value);
            if (Number.isNaN(val) || val <= 0) val = 0.1;
            if (cropper) cropper.zoomTo(val);
            this.value = val.toFixed(2);
            el('cropZoomSlider').value = val;
        });
    }

    function bindControls() {
        document.querySelectorAll('.editable-val').forEach(span => {
            span.addEventListener('blur', function () {
                let inputId = this.id.replace('val', '');
                inputId = inputId.charAt(0).toLowerCase() + inputId.slice(1);
                const inputEl = el(inputId);
                if (!inputEl) return;
                let val = parseFloat(this.innerText);
                if (Number.isNaN(val)) val = parseFloat(inputEl.value);
                val = Math.max(parseFloat(inputEl.min), Math.min(parseFloat(inputEl.max), val));
                inputEl.value = val;
                this.innerText = val;
                if (inputId === 'wobble') document.querySelectorAll('.wobble-map').forEach(map => map.setAttribute('scale', val));
                HW.renderer.debounceRender();
            });
            span.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    span.blur();
                }
            });
        });

        HW.config.controls.forEach(id => {
            const input = el(id);
            if (!input) return;
            input.addEventListener('input', function () {
                const valId = `val${id.charAt(0).toUpperCase()}${id.slice(1)}`;
                if (el(valId)) el(valId).innerText = this.value;
                if (id === 'wobble') document.querySelectorAll('.wobble-map').forEach(map => map.setAttribute('scale', this.value));
                HW.renderer.debounceRender();
            });
        });
    }

    function restoreState(state, options = {}) {
        if (!state) return;
        if (state.text !== undefined && el('textInput')) el('textInput').value = state.text;
        ['removeEmptyLines', 'autoMath', 'splitMathEq', 'useLocalExporter'].forEach(id => {
            if (state[id] !== undefined && el(id)) el(id).checked = !!state[id];
        });
        if (state.scribbleCss && el('customScribbleCss')) el('customScribbleCss').value = state.scribbleCss;
        if (state.inkCss && el('customInkCss')) el('customInkCss').value = state.inkCss;
        HW.config.controls.forEach(id => {
            if (state[id] !== undefined && el(id)) {
                el(id).value = state[id];
                const valId = `val${id.charAt(0).toUpperCase()}${id.slice(1)}`;
                if (el(valId)) el(valId).innerText = state[id];
            }
        });
        if (state.scribble) {
            const btn = document.querySelector(`#scribbleSelector .style-btn[data-val="${CSS.escape(String(state.scribble))}"]`);
            if (btn) setStyle('scribble', state.scribble, btn, false);
        }
        if (state.ink) {
            const btn = document.querySelector(`#inkSelector .style-btn[data-val="${CSS.escape(String(state.ink))}"]`);
            if (btn) setStyle('ink', state.ink, btn, false);
        }
        if (state.config) {
            HW.state.modes = { ...HW.state.modes, ...state.config };
            ['tilt', 'y', 'slant'].forEach(type => {
                const val = HW.state.modes[`${type}Mode`];
                const btn = document.querySelector(`#${type}Mode .mode-btn[data-val="${CSS.escape(String(val))}"]`);
                if (btn) {
                    Array.from(btn.parentElement.children).forEach(child => child.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        }
        if (state.customBg) applyBg(state.customBg);
        HW.fonts.restoreSelectedFonts(state, !options.skipRender);
        updateCustomCss();
        if (!options.skipRender) HW.renderer.renderContent();
    }

    async function applyExternalState(state, markdown) {
        restoreState(state || {}, { skipRender: true });
        if (markdown !== undefined) el('textInput').value = markdown;
        saveState();
        return HW.renderer.renderContent();
    }

    async function init() {
        HW.fonts.initBuiltinFonts();
        HW.fonts.bindFontUploader('textFontInput', 'textFontList', 'text');
        HW.fonts.bindFontUploader('mathFontInput', 'mathFontList', 'math');
        bindBackgroundControls();
        bindControls();

        let saved = null;
        try {
            const savedStr = localStorage.getItem(HW.config.stateKey);
            if (savedStr) saved = JSON.parse(savedStr);
        } catch (error) {
            console.error('缓存恢复失败，已跳过', error);
        }
        if (saved) restoreState(saved, { skipRender: true });
        else HW.fonts.restoreSelectedFonts({}, false);
        updateCustomCss();
        await HW.renderer.renderContent();
    }

    HW.app = {
        init,
        saveState,
        captureState,
        restoreState,
        applyExternalState,
        setMode,
        setStyle,
        updateCustomCss,
        closeCropModal,
        applyCrop,
        setPresetBg,
        resetBg
    };

    window.setMode = setMode;
    window.setStyle = setStyle;
    window.updateCustomCss = updateCustomCss;
    window.debounceRender = HW.renderer.debounceRender;
    window.forceRender = HW.renderer.forceRender;
    window.openExportModal = HW.exporter.openExportModal;
    window.closeExportModal = HW.exporter.closeExportModal;
    window.cancelExport = HW.exporter.cancelExport;
    window.confirmExport = HW.exporter.confirmExport;
    window.closeCropModal = closeCropModal;
    window.applyCrop = applyCrop;
    window.setPresetBg = setPresetBg;
    window.resetBg = resetBg;

    window.addEventListener('load', init);
})();
