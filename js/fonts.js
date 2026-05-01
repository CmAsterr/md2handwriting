(function () {
    const HW = window.HW = window.HW || {};
    const { el, escapeHtml } = HW.utils;

    const fallbacks = {
        text: "'Kaiti', 'STKaiti', serif",
        math: "'MathJax_Math', 'Cambria Math', 'Times New Roman', serif"
    };

    function defaultFont(type) {
        return type === 'math' ? fallbacks.math : `'MyHandwriting', ${fallbacks.text}`;
    }

    function injectFont(font) {
        if (document.getElementById(`font-face-${font.id}`)) return;
        const style = document.createElement('style');
        style.id = `font-face-${font.id}`;
        style.textContent = `@font-face { font-family: '${font.id}'; src: url('${font.url}'); font-display: swap; }`;
        document.head.appendChild(style);
    }

    function setActive(listEl, item) {
        Array.from(listEl.children).forEach(child => child.classList.remove('active'));
        item.classList.add('active');
    }

    function selectFont(type, fontName, item, shouldRender = true) {
        const listEl = el(`${type}FontList`);
        const target = item || (listEl && listEl.querySelector(`[data-val="${CSS.escape(String(fontName))}"]`));
        if (listEl && target) setActive(listEl, target);

        const fontStr = fontName === 'default' ? defaultFont(type) : `'${fontName}', ${fallbacks[type]}`;
        document.documentElement.style.setProperty(`--${type}-font`, fontStr);
        HW.state[`${type}Font`] = fontName;
        if (HW.app && HW.app.saveState) HW.app.saveState();
        if (shouldRender && HW.renderer && HW.renderer.debounceRender) HW.renderer.debounceRender();
    }

    function makeBuiltinItem(type, font) {
        injectFont(font);
        const item = document.createElement('div');
        item.className = 'font-item';
        item.dataset.val = font.id;
        item.innerHTML = `<span class="font-item-text" style="font-family:'${font.id}', ${fallbacks[type]};"><span class="tag-builtin">内置</span>${escapeHtml(font.name)}</span>`;
        item.onclick = () => {
            const textSpan = item.querySelector('.font-item-text');
            const original = textSpan.innerHTML;
            textSpan.innerHTML = `<span class="tag-builtin" style="background:#f59e0b;color:white;">加载中</span>${escapeHtml(font.name)}`;
            document.fonts.load(`16px "${font.id}"`).then(() => {
                textSpan.innerHTML = original;
                selectFont(type, font.id, item);
            }).catch(() => {
                textSpan.innerHTML = `<span class="tag-builtin" style="background:#ef4444;color:white;">失败</span>${escapeHtml(font.name)}`;
                setTimeout(() => { textSpan.innerHTML = original; }, 1600);
            });
        };
        return item;
    }

    function initBuiltinFonts() {
        for (const type of ['text', 'math']) {
            const listEl = el(`${type}FontList`);
            if (!listEl) continue;
            listEl.style.display = 'block';
            const defaultText = type === 'math' ? '系统默认 (MathJax/Cambria)' : '系统默认 (原手写体)';
            listEl.innerHTML = `<div class="font-item active" data-val="default"><span class="font-item-text">${defaultText}</span></div>`;
            listEl.querySelector('[data-val="default"]').onclick = event => selectFont(type, 'default', event.currentTarget);
            HW.config.fonts[type].forEach(font => listEl.appendChild(makeBuiltinItem(type, font)));
        }
    }

    function bindFontUploader(inputId, listId, typeName) {
        const input = el(inputId);
        const listEl = el(listId);
        if (!input || !listEl) return;
        input.addEventListener('change', event => {
            const files = Array.from(event.target.files || []).filter(file => /\.(ttf|otf|woff|woff2)$/i.test(file.name));
            if (!files.length) return;
            listEl.style.display = 'block';

            files.forEach((file, index) => {
                const fontName = `Custom_${typeName}_${Date.now()}_${index}`;
                const reader = new FileReader();
                reader.onload = async readEvent => {
                    const style = document.createElement('style');
                    style.textContent = `@font-face { font-family: '${fontName}'; src: url('${readEvent.target.result}'); }`;
                    document.head.appendChild(style);
                    try {
                        await document.fonts.load(`16px "${fontName}"`);
                        const item = document.createElement('div');
                        item.className = 'font-item';
                        item.dataset.val = fontName;
                        item.innerHTML = `
                            <span class="font-item-text" style="font-family:'${fontName}', ${fallbacks[typeName]};">
                                <span class="tag-imported">导入</span>${escapeHtml(file.name)}
                            </span>
                            <span class="font-del-btn" title="移除该字体">×</span>
                        `;
                        item.onclick = clickEvent => {
                            if (clickEvent.target.className === 'font-del-btn') return;
                            selectFont(typeName, fontName, item);
                        };
                        item.querySelector('.font-del-btn').onclick = clickEvent => {
                            clickEvent.stopPropagation();
                            if (item.classList.contains('active')) {
                                const defaultEl = listEl.querySelector('[data-val="default"]');
                                if (defaultEl) selectFont(typeName, 'default', defaultEl);
                            }
                            item.remove();
                            style.remove();
                        };
                        listEl.appendChild(item);
                        if (index === 0) selectFont(typeName, fontName, item);
                    } catch (err) {
                        console.error('字体应用失败', err);
                    }
                };
                reader.readAsDataURL(file);
            });
            event.target.value = '';
        });
    }

    function restoreSelectedFonts(state, shouldRender = true) {
        for (const type of ['text', 'math']) {
            const saved = state && state[`${type}Font`] ? state[`${type}Font`] : 'default';
            const listEl = el(`${type}FontList`);
            const item = listEl && listEl.querySelector(`[data-val="${CSS.escape(String(saved))}"]`);
            selectFont(type, item ? saved : 'default', item || (listEl && listEl.querySelector('[data-val="default"]')), shouldRender);
        }
    }

    HW.fonts = { initBuiltinFonts, bindFontUploader, selectFont, restoreSelectedFonts };
})();
