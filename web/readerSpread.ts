export type PageLayout = 'auto' | 'single' | 'double';

/** pagePadX：单页左右内边距合计；双页时每页一行最多 maxChars 个字宽 */
export function readerColumns(layout: PageLayout, width: number, height: number, fontSize: number, pagePadX: number, gutter: number, maxChars: number) {
    const avail = (width - 2 * pagePadX - gutter) / 2;
    const spread = layout === 'double' ? avail >= fontSize * 14
        : layout === 'auto' ? width >= 900 && width > height && avail >= fontSize * 22
        : false;
    const contentWidth = Math.max(1, spread ? Math.floor(Math.min(avail, fontSize * maxChars)) : width - pagePadX);
    return { spread, contentWidth };
}
