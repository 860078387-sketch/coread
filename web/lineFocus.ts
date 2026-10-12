export interface LineRect { top: number; bottom: number; left: number; right: number }

export function groupRectsIntoLines(rects: LineRect[]): LineRect[] {
    const sorted = rects
        .filter(r => r.right - r.left >= 1 && r.bottom - r.top >= 1)
        .sort((a, b) => a.top - b.top || a.left - b.left);
    const lines: LineRect[] = [];
    for (const r of sorted) {
        const last = lines[lines.length - 1];
        if (last) {
            const overlap = Math.min(last.bottom, r.bottom) - Math.max(last.top, r.top);
            if (overlap > 0.5 * Math.min(last.bottom - last.top, r.bottom - r.top)) {
                last.top = Math.min(last.top, r.top);
                last.bottom = Math.max(last.bottom, r.bottom);
                last.left = Math.min(last.left, r.left);
                last.right = Math.max(last.right, r.right);
                continue;
            }
        }
        lines.push({ ...r });
    }
    return lines;
}

// 文字区域含字体上下预留的空白，中文字在里面偏上；换成字本身的上下边，框才能把字摆正
const INK_SAMPLE = '国永中';
const inkCache = new Map<string, { top: number; bottom: number } | null>();
let inkCtx: CanvasRenderingContext2D | null | undefined;
// 画布的 fontBoundingBox 只算首选字体；中文常由后备字体画，文字区域按后备字体撑开，基线只能在页面里量
function domAscent(font: string): number {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap';
    probe.style.font = font;
    probe.style.lineHeight = 'normal';
    const text = document.createTextNode(INK_SAMPLE);
    const mark = document.createElement('span');
    mark.style.cssText = 'display:inline-block;width:0;height:0';
    probe.append(text, mark);
    document.body.appendChild(probe);
    const range = document.createRange();
    range.selectNodeContents(text);
    const r = range.getClientRects()[0];
    const ascent = r ? mark.getBoundingClientRect().bottom - r.top : 0;
    probe.remove();
    return ascent;
}
function inkOffsets(el: Element | null): { top: number; bottom: number } | null {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if (inkCache.has(font)) return inkCache.get(font)!;
    if (inkCtx === undefined) inkCtx = document.createElement('canvas').getContext('2d');
    let res: { top: number; bottom: number } | null = null;
    if (inkCtx) {
        inkCtx.font = font;
        const m = inkCtx.measureText(INK_SAMPLE);
        const ascent = domAscent(font);
        if (ascent > 0 && m.actualBoundingBoxAscent > 0) {
            res = { top: ascent - m.actualBoundingBoxAscent, bottom: ascent + m.actualBoundingBoxDescent };
        }
    }
    inkCache.set(font, res);
    return res;
}

export function measurePageLines(root: HTMLElement, origin: HTMLElement): LineRect[] {
    const o = origin.getBoundingClientRect();
    const maxBottom = o.top + origin.clientHeight;
    const rects: LineRect[] = [];
    const push = (r: DOMRect, ink: { top: number; bottom: number } | null = null) => {
        if (r.bottom <= o.top || r.top >= maxBottom) return;
        const dy = origin.scrollTop - o.top, dx = origin.scrollLeft - o.left;
        const top = ink ? r.top + ink.top : r.top, bottom = ink ? r.top + ink.bottom : r.bottom;
        rects.push({ top: top + dy, bottom: bottom + dy, left: r.left + dx, right: r.right + dx });
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: n => n.nodeType === Node.TEXT_NODE
            ? (n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)
            : ((n as Element).tagName === 'IMG' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) {
            range.selectNodeContents(n);
            const ink = inkOffsets(n.parentElement);
            for (const r of Array.from(range.getClientRects())) push(r, ink);
        } else {
            push((n as Element).getBoundingClientRect());
        }
    }
    range.detach?.();
    return groupRectsIntoLines(rects);
}
