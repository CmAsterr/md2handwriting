(function () {
    const HW = window.HW = window.HW || {};
    const { el, escapeHtml, hashString, rng } = HW.utils;

    let renderTimeout = null;
    let globalPageCounter = 0;

    function readRenderOptions() {
        return {
            padTop: parseInt(el('padTop').value, 10),
            padBottom: parseInt(el('padBottom').value, 10),
            padLeft: parseInt(el('padLeft').value, 10),
            padRight: parseInt(el('padRight').value, 10),
            fontSize: parseInt(el('fontSize').value, 10),
            mathSize: parseFloat(el('mathSize').value) || 0.85,
            lineHeight: parseFloat(el('lineHeight').value) || 1.5,
            wobble: parseFloat(el('wobble').value) || 0,
            maxSlant: parseFloat(el('lineSlant').value) || 0,
            maxTilt: parseFloat(el('charTilt').value) || 0,
            maxY: parseFloat(el('charY').value) || 0,
            maxX: parseFloat(el('charX').value) || 0,
            maxScale: parseFloat(el('charScale').value) || 0,
            letterSpace: parseFloat(el('letterSpace').value) || 0,
            inkSize: parseFloat(el('inkSize').value) || 1,
            scribbleRand: parseFloat(el('scribbleRand').value) || 1,
            splitMathEq: !!(el('splitMathEq') && el('splitMathEq').checked),
            autoMath: !!(el('autoMath') && el('autoMath').checked),
            removeEmptyLines: !!(el('removeEmptyLines') && el('removeEmptyLines').checked),
            inkStyle: HW.state.inkStyle,
            scribbleStyle: HW.state.scribbleStyle
        };
    }

    function colorStyle(renderState) {
        if (!renderState.colorStack.length) return '';
        const color = renderState.colorStack[renderState.colorStack.length - 1];
        if (!/^[#a-zA-Z0-9(),.%\s-]+$/.test(color)) return '';
        return `color:${color};`;
    }

    function stepRandomWalk(current, max, random, factor) {
        if (max <= 0) return 0;
        const next = current + (random() - 0.5) * max * factor;
        return Math.max(-max, Math.min(max, next));
    }

    function applyJitter(line, parsed, options, lineIndex, renderState) {
        let result = '';
        let i = 0;
        let currentTilt = 0;
        let currentY = 0;
        let currentX = 0;
        let currentScaleDiff = 0;
        const random = rng(hashString(`${parsed.seed}:line:${lineIndex}:${line}`));

        while (i < line.length) {
            if (line.startsWith('@@S_START@@', i)) {
                renderState.isScribble = true;
                i += 11;
                continue;
            }
            if (line.startsWith('@@S_END@@', i)) {
                renderState.isScribble = false;
                i += 9;
                continue;
            }
            if (line.startsWith('@@C_START_', i)) {
                const match = line.slice(i).match(/^@@C_START_([^@]+)@@/);
                if (match) {
                    renderState.colorStack.push(match[1]);
                    i += match[0].length;
                    continue;
                }
            }
            if (line.startsWith('@@C_END@@', i)) {
                renderState.colorStack.pop();
                i += 9;
                continue;
            }

            const tokenMatch = line.slice(i).match(/^@@(MATH|INK)_(\d+)@@/);
            if (tokenMatch) {
                const token = tokenMatch[0];
                const block = parsed.blocks[Number(tokenMatch[2])];
                const style = colorStyle(renderState);
                if (tokenMatch[1] === 'MATH') {
                    if (renderState.isScribble) {
                        const seed = `${parsed.seed}:math:${lineIndex}:${i}`;
                        result += `<span class="scribble-target ${block && block.display ? 'block-math-scribble' : 'inline-math-scribble'}" style="${style}">${token}${HW.effects.scribble(seed, options.scribbleStyle, options.scribbleRand)}</span>`;
                    } else {
                        result += style ? `<span style="${style}">${token}</span>` : token;
                    }
                } else {
                    result += token;
                }
                i += token.length;
                continue;
            }

            const ch = line[i];
            if (ch === ' ') {
                result += renderState.isScribble
                    ? `<span class="char-span" style="margin-right:${options.letterSpace}px;">&nbsp;${HW.effects.scribble(`${parsed.seed}:space:${lineIndex}:${i}`, options.scribbleStyle, options.scribbleRand)}</span>`
                    : ' ';
                i++;
                continue;
            }

            currentTilt = HW.state.modes.tiltMode === 'random'
                ? stepRandomWalk(currentTilt, options.maxTilt, random, 0.42)
                : (HW.state.modes.tiltMode === 'left' ? -options.maxTilt : options.maxTilt);
            currentY = HW.state.modes.yMode === 'random'
                ? stepRandomWalk(currentY, options.maxY, random, 0.32)
                : (HW.state.modes.yMode === 'up' ? -options.maxY : options.maxY);
            currentX = stepRandomWalk(currentX, options.maxX, random, 0.48);
            currentScaleDiff = stepRandomWalk(currentScaleDiff, options.maxScale, random, 0.38);

            const actualScale = 1 + currentScaleDiff;
            const scribble = renderState.isScribble
                ? HW.effects.scribble(`${parsed.seed}:char:${lineIndex}:${i}`, options.scribbleStyle, options.scribbleRand)
                : '';
            result += `<span class="char-span" style="transform:translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px) rotate(${currentTilt.toFixed(2)}deg) scale(${actualScale.toFixed(3)}); margin-right:${options.letterSpace}px; ${colorStyle(renderState)}">${escapeHtml(ch)}${scribble}</span>`;
            i++;
        }

        return result;
    }

    function lineKind(line, parsed) {
        const trimmed = line.trim();
        if (!trimmed) return 'blank';
        if (trimmed === '@@PAGE_BREAK@@') return 'break';
        if (HW.parser.isMathOnlyLine(trimmed, parsed.blocks)) return 'formula';
        const plain = trimmed
            .replace(/@@(?:MATH|INK)_\d+@@/g, 'x')
            .replace(/@@C_START_[^@]+@@|@@C_END@@|@@S_START@@|@@S_END@@/g, '');
        if (/^(\d+(?:\.\d+)*[.、]|[（(]\d+[)）]|[一二三四五六七八九十]+[、.])/.test(plain)) return 'question';
        return 'normal';
    }

    function buildStagingHtml(parsed, options) {
        const lines = parsed.text.split('\n');
        const renderState = { isScribble: false, colorStack: [] };
        const html = [];
        lines.forEach((line, index) => {
            const kind = lineKind(line, parsed);
            if (kind === 'break') {
                html.push('<div class="page-break" data-page-break="true"></div>');
                renderState.isScribble = false;
                renderState.colorStack = [];
                return;
            }
            if (kind === 'blank') {
                html.push('<div class="paragraph-gap"></div>');
                return;
            }
            let lineAngle = 0;
            if (HW.state.modes.slantMode === 'random') {
                const random = rng(hashString(`${parsed.seed}:slant:${index}:${line}`));
                lineAngle = (random() * options.maxSlant * 2) - options.maxSlant;
            } else {
                lineAngle = HW.state.modes.slantMode === 'up' ? -options.maxSlant : options.maxSlant;
            }
            const extraMargin = Math.abs(Math.sin(lineAngle * Math.PI / 180) * (HW.config.page.width - options.padLeft - options.padRight));
            const jittered = applyJitter(line, parsed, options, index, renderState);
            const cls = kind === 'formula' ? 'formula-block' : `line-block ${kind === 'question' ? 'question-start' : kind === 'normal' && /^\s/.test(line) ? 'continuation' : ''}`;
            html.push(`<div class="${cls}" style="transform:rotate(${lineAngle.toFixed(2)}deg);margin-bottom:${(extraMargin * 0.35).toFixed(2)}px;">${jittered}</div>`);
        });
        return HW.parser.restore(html.join(''), parsed.blocks);
    }

    function createNewPage(options, segment) {
        globalPageCounter++;
        const filterId = `handdrawn-wobble-${globalPageCounter}`;
        const pageDiv = document.createElement('div');
        pageDiv.className = 'paper-page';
        pageDiv.dataset.segment = String(segment);
        pageDiv.dataset.page = String(globalPageCounter);
        pageDiv.style.padding = `${options.padTop}px ${options.padRight}px ${options.padBottom}px ${options.padLeft}px`;

        const svgWrapper = document.createElement('div');
        svgWrapper.innerHTML = `<svg style="position:absolute;width:0;height:0;overflow:hidden"><filter id="${filterId}"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" result="noise"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="${options.wobble}" xChannelSelector="R" yChannelSelector="G" class="wobble-map"></feDisplacementMap></filter></svg>`;
        pageDiv.appendChild(svgWrapper);

        const contentBox = document.createElement('div');
        contentBox.className = 'content-box';
        contentBox.style.fontSize = `${options.fontSize}px`;
        contentBox.style.lineHeight = options.lineHeight;
        contentBox.style.filter = `url(#${filterId})`;
        pageDiv.appendChild(contentBox);
        el('paper-container').appendChild(pageDiv);
        return contentBox;
    }

    function applyMathJitter(parsed, options) {
        document.querySelectorAll('#staging-area mjx-container').forEach((mjx, index) => {
            const random = rng(hashString(`${parsed.seed}:mjx:${index}`));
            const mTilt = (random() - 0.5) * options.maxTilt * 0.45;
            const mY = (random() - 0.5) * options.maxY * 0.45;
            const mScale = 1 + (random() - 0.5) * 0.035;
            mjx.style.transform = `translate(0px, ${mY.toFixed(2)}px) rotate(${mTilt.toFixed(2)}deg) scale(${mScale.toFixed(3)})`;
            if (!mjx.hasAttribute('display')) {
                mjx.style.display = 'inline-block';
                mjx.style.margin = '0 2px';
            }
        });
    }

    async function renderContent() {
        HW.state.isRenderingCanceled = false;
        const options = readRenderOptions();
        document.documentElement.style.setProperty('--math-scale', options.mathSize);

        const source = el('textInput').value || '';
        HW.state.source = source;
        HW.state.renderSeed = hashString(source);
        const parsed = HW.parser.parse(source, options);
        const stageWidth = HW.config.page.width - options.padLeft - options.padRight;
        const stagingArea = el('staging-area');
        stagingArea.style.width = `${stageWidth}px`;
        stagingArea.style.fontSize = `${options.fontSize}px`;
        stagingArea.style.lineHeight = options.lineHeight;
        stagingArea.style.fontFamily = 'var(--text-font)';
        stagingArea.innerHTML = buildStagingHtml(parsed, options);

        await HW.utils.waitForMathJax();
        if (window.MathJax && MathJax.typesetClear) MathJax.typesetClear([stagingArea]);
        if (window.MathJax && MathJax.typesetPromise) await MathJax.typesetPromise([stagingArea]);
        applyMathJitter(parsed, options);

        const scrollArea = document.querySelector('.paper-scroll-area');
        const previousScrollTop = scrollArea ? scrollArea.scrollTop : 0;
        const container = el('paper-container');
        container.innerHTML = '';
        globalPageCounter = 0;

        const maxHeight = HW.config.page.height - options.padTop - options.padBottom;
        let segment = 1;
        let currentBox = createNewPage(options, segment);
        const children = Array.from(stagingArea.children);
        for (const child of children) {
            if (child.classList.contains('page-break')) {
                segment++;
                currentBox = createNewPage(options, segment);
                continue;
            }
            currentBox.appendChild(child);
            if (currentBox.offsetHeight > maxHeight && currentBox.children.length > 1) {
                currentBox.removeChild(child);
                currentBox = createNewPage(options, segment);
                currentBox.appendChild(child);
            }
        }

        document.querySelectorAll('.paper-page').forEach(page => {
            const box = page.querySelector('.content-box');
            if (box && box.innerText.trim() === '' && !box.querySelector('mjx-container') && !box.querySelector('.ink-blot')) page.remove();
        });
        Array.from(document.querySelectorAll('.paper-page')).forEach((page, index) => {
            page.dataset.page = String(index + 1);
        });
        if (scrollArea) scrollArea.scrollTop = previousScrollTop;
        return Array.from(document.querySelectorAll('.paper-page'));
    }

    function debounceRender() {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
            if (HW.app && HW.app.saveState) HW.app.saveState();
            renderContent();
        }, 360);
    }

    function forceRender() {
        clearTimeout(renderTimeout);
        if (HW.app && HW.app.saveState) HW.app.saveState();
        return renderContent();
    }

    HW.renderer = { readRenderOptions, renderContent, debounceRender, forceRender };
})();
