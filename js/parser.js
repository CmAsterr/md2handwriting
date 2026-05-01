(function () {
    const HW = window.HW = window.HW || {};
    const { escapeHtml, hashString } = HW.utils;

    const TOKEN_RE = /@@(?:MATH|INK)_\d+@@|@@PAGE_BREAK@@|@@S_START@@|@@S_END@@|@@C_START_[^@]+@@|@@C_END@@/g;

    function isEscaped(text, index) {
        let count = 0;
        for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) count++;
        return count % 2 === 1;
    }

    function findUnescaped(text, needle, start) {
        let at = start;
        while (at < text.length) {
            const found = text.indexOf(needle, at);
            if (found === -1) return -1;
            if (!isEscaped(text, found)) return found;
            at = found + needle.length;
        }
        return -1;
    }

    function splitByTokens(text, mapper) {
        let out = '';
        let last = 0;
        TOKEN_RE.lastIndex = 0;
        let match;
        while ((match = TOKEN_RE.exec(text))) {
            out += mapper(text.slice(last, match.index));
            out += match[0];
            last = match.index + match[0].length;
        }
        out += mapper(text.slice(last));
        return out;
    }

    function stripMarkdownText(text) {
        return text
            .replace(/```[a-zA-Z0-9_-]*\n?/g, '')
            .replace(/```/g, '')
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/^#{1,6}\s*/gm, '')
            .replace(/^>\s*/gm, '')
            .replace(/^[ \t]*[-+*][ \t]+/gm, '')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/(^|[^\w])\*([^*\n]+)\*/g, '$1$2')
            .replace(/`([^`]+)`/g, '$1');
    }

    function colorizeText(text) {
        let out = '';
        let i = 0;
        while (i < text.length) {
            if (text.startsWith('\\textcolor{', i)) {
                const cStart = i + 11;
                const cEnd = text.indexOf('}', cStart);
                if (cEnd !== -1 && text[cEnd + 1] === '{') {
                    const color = text.slice(cStart, cEnd).trim();
                    let depth = 1;
                    let j = cEnd + 2;
                    while (j < text.length && depth > 0) {
                        if (text[j] === '\\' && (text[j + 1] === '{' || text[j + 1] === '}')) {
                            j += 2;
                            continue;
                        }
                        if (text[j] === '{') depth++;
                        else if (text[j] === '}') depth--;
                        j++;
                    }
                    if (depth === 0) {
                        const content = colorizeText(text.slice(cEnd + 2, j - 1));
                        out += `@@C_START_${color}@@${content}@@C_END@@`;
                        i = j;
                        continue;
                    }
                }
            }
            out += text[i];
            i++;
        }
        return out;
    }

    function findTopLevelRelations(tex) {
        const relations = [];
        let depth = 0;
        const commandOps = ['\\leq', '\\geq', '\\le', '\\ge', '\\neq', '\\approx', '\\sim', '\\equiv', '\\to', '\\rightarrow', '\\Rightarrow'];
        for (let i = 0; i < tex.length; i++) {
            const ch = tex[i];
            if (ch === '\\') {
                const command = tex.slice(i).match(/^\\[a-zA-Z]+/);
                const op = command ? commandOps.find(item => item === command[0]) : commandOps.find(item => tex.startsWith(item, i));
                if (op && depth === 0) {
                    relations.push({ index: i, op, len: op.length });
                    i += op.length - 1;
                    continue;
                }
                if (command) i += command[0].length - 1;
                continue;
            }
            if (ch === '{' || ch === '(' || ch === '[') depth++;
            else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
            else if (depth === 0 && (ch === '=' || ch === '<' || ch === '>' || ch === '≤' || ch === '≥')) {
                relations.push({ index: i, op: ch, len: 1 });
            }
        }
        return relations;
    }

    function relationChainScore(inner) {
        return inner
            .replace(/\\(?:left|right|mathrm|text|operatorname)\b/g, '')
            .replace(/\\[a-zA-Z]+/g, 'xxxx')
            .replace(/[{}\s]/g, '')
            .length;
    }

    function relationWrapThreshold(options) {
        const width = Number(options.inlineMathWidth) || 680;
        const fontSize = Number(options.fontSize) || 28;
        const mathSize = Number(options.mathSize) || 0.85;
        const approxGlyphWidth = Math.max(7, fontSize * mathSize * 0.45);
        return Math.max(42, Math.floor(width / approxGlyphWidth));
    }

    function buildWrappedRelationRows(parts, ops, threshold) {
        const lineBudget = Math.floor(threshold * 1.45);
        const rows = [];
        let current = parts[0];
        let currentScore = relationChainScore(current);

        for (let i = 0; i < ops.length; i++) {
            const segment = `${ops[i]} ${parts[i + 1]}`;
            const segmentScore = relationChainScore(segment);
            if (i > 0 && currentScore + segmentScore > lineBudget) {
                rows.push(current);
                current = segment;
                currentScore = segmentScore;
            } else {
                current += ` ${segment}`;
                currentScore += segmentScore;
            }
        }

        if (current.trim()) rows.push(current);
        return rows;
    }

    function alignRelationChain(inner, options) {
        if (/\\begin\{|\\\\/.test(inner)) return inner;
        const relations = findTopLevelRelations(inner);
        if (relations.length < 2) return inner;
        const threshold = relationWrapThreshold(options);
        if (relationChainScore(inner) <= threshold) return inner;

        const parts = [];
        const ops = [];
        let last = 0;
        for (const rel of relations) {
            parts.push(inner.slice(last, rel.index).trim());
            ops.push(rel.op);
            last = rel.index + rel.len;
        }
        parts.push(inner.slice(last).trim());
        if (parts.some(part => part === '')) return inner;

        const rows = buildWrappedRelationRows(parts, ops, threshold);
        if (rows.length < 2) return inner;
        return `\\begin{array}{l}${rows.join('\\\\') }\\end{array}`;
    }

    function normalizeMath(raw, kind, options) {
        if (!options.splitMathEq) return raw;
        if (kind === 'env') return raw;

        let open = '$';
        let close = '$';
        let inner = raw;
        if (raw.startsWith('$$')) {
            open = '$$'; close = '$$'; inner = raw.slice(2, -2);
        } else if (raw.startsWith('\\[')) {
            open = '\\['; close = '\\]'; inner = raw.slice(2, -2);
        } else if (raw.startsWith('\\(')) {
            open = '\\('; close = '\\)'; inner = raw.slice(2, -2);
        } else if (raw.startsWith('$')) {
            open = '$'; close = '$'; inner = raw.slice(1, -1);
        }

        const aligned = alignRelationChain(inner, options);
        return aligned === inner ? raw : `${open}${aligned}${close}`;
    }

    function pushMath(blocks, raw, kind, options) {
        const normalized = normalizeMath(raw, kind, options);
        const index = blocks.push({
            type: 'math',
            raw: normalized,
            display: kind === 'block' || kind === 'env' || /\\begin\{(?:aligned|array)\}/.test(normalized)
        }) - 1;
        return `@@MATH_${index}@@`;
    }

    function tokenizeMathAndInk(text, options, blocks) {
        let out = '';
        const seedBase = hashString(text);
        for (let i = 0; i < text.length;) {
            if (text.startsWith('[ink]', i)) {
                const index = blocks.push({
                    type: 'ink',
                    html: HW.effects.ink(`${seedBase}:ink:${blocks.length}`, options.inkStyle, options.inkSize)
                }) - 1;
                out += `@@INK_${index}@@`;
                i += 5;
                continue;
            }

            const envMatch = text.slice(i).match(/^\\begin\{([a-zA-Z0-9*]+)\}/);
            if (envMatch && !isEscaped(text, i)) {
                const endTag = `\\end{${envMatch[1]}}`;
                const end = text.indexOf(endTag, i + envMatch[0].length);
                if (end !== -1) {
                    const raw = text.slice(i, end + endTag.length);
                    out += pushMath(blocks, raw, 'env', options);
                    i = end + endTag.length;
                    continue;
                }
            }

            if (text.startsWith('$$', i) && !isEscaped(text, i)) {
                const end = findUnescaped(text, '$$', i + 2);
                if (end !== -1) {
                    out += pushMath(blocks, text.slice(i, end + 2), 'block', options);
                    i = end + 2;
                    continue;
                }
            }

            if (text.startsWith('\\[', i) && !isEscaped(text, i)) {
                const end = findUnescaped(text, '\\]', i + 2);
                if (end !== -1) {
                    out += pushMath(blocks, text.slice(i, end + 2), 'block', options);
                    i = end + 2;
                    continue;
                }
            }

            if (text.startsWith('\\(', i) && !isEscaped(text, i)) {
                const end = findUnescaped(text, '\\)', i + 2);
                if (end !== -1) {
                    out += pushMath(blocks, text.slice(i, end + 2), 'inline', options);
                    i = end + 2;
                    continue;
                }
            }

            if (text[i] === '$' && text[i + 1] !== '$' && !isEscaped(text, i)) {
                const end = findUnescaped(text, '$', i + 1);
                if (end !== -1) {
                    out += pushMath(blocks, text.slice(i, end + 1), 'inline', options);
                    i = end + 1;
                    continue;
                }
            }

            out += text[i];
            i++;
        }
        return out;
    }

    function autoMathText(text, blocks) {
        return text.replace(/[a-zA-Z]+(?:\d+)?|\d+(?:\.\d+)?/g, match => {
            const index = blocks.push({ type: 'math', raw: `$${match}$`, display: false }) - 1;
            return `@@MATH_${index}@@`;
        });
    }

    function parse(source, options) {
        const blocks = [];
        let text = String(source || '').replace(/\r\n?/g, '\n');
        if (options.removeEmptyLines) text = text.replace(/\n\s*\n+/g, '\n');
        text = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '@@PAGE_BREAK@@');
        text = tokenizeMathAndInk(text, options, blocks);
        text = colorizeText(text);
        text = splitByTokens(text, stripMarkdownText);
        if (options.autoMath) text = splitByTokens(text, part => autoMathText(part, blocks));
        text = text.replace(/~~([\s\S]*?)~~/g, '@@S_START@@$1@@S_END@@');
        return { text: text.trimEnd(), blocks, seed: hashString(source) };
    }

    function getBlock(token, blocks) {
        const match = token.match(/^@@(?:MATH|INK)_(\d+)@@$/);
        return match ? blocks[Number(match[1])] : null;
    }

    function restore(text, blocks) {
        return text.replace(/@@(MATH|INK)_(\d+)@@/g, (token, type, index) => {
            const block = blocks[Number(index)];
            if (!block) return token;
            if (block.type === 'ink') return block.html;
            return escapeHtml(block.raw);
        });
    }

    function isMathOnlyLine(line, blocks) {
        const trimmed = line.trim();
        const match = trimmed.match(/^@@MATH_(\d+)@@$/);
        if (!match) return false;
        const block = blocks[Number(match[1])];
        return !!(block && block.display);
    }

    HW.parser = { parse, restore, splitByTokens, TOKEN_RE, getBlock, isMathOnlyLine };
})();
