import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRectsIntoLines, groupLinesIntoBlocks, focusRange, stepFocusIndex } from '../web/lineFocus.ts';

const R = (top, bottom, left, right) => ({ top, bottom, left, right });

test('同一行多段合并，乱序也行', () => {
  assert.deepEqual(
    groupRectsIntoLines([R(40, 58, 10, 90), R(10, 28, 120, 300), R(10, 28, 10, 120), R(40, 58, 90, 300)]),
    [R(10, 28, 10, 300), R(40, 58, 10, 300)],
  );
});

test('批注高亮 span 高度略不同仍算同一行', () => {
  assert.deepEqual(
    groupRectsIntoLines([R(10, 28, 10, 100), R(9, 30, 100, 160), R(11, 27, 160, 300)]),
    [R(9, 30, 10, 300)],
  );
});

test('行距很紧但不重叠过半的分成两行', () => {
  assert.deepEqual(
    groupRectsIntoLines([R(10, 30, 10, 300), R(24, 44, 10, 300)]),
    [R(10, 30, 10, 300), R(24, 44, 10, 300)],
  );
});

test('上下错开但重叠过半的仍算同一行', () => {
  assert.deepEqual(
    groupRectsIntoLines([R(10, 30, 10, 150), R(18, 38, 150, 300)]),
    [R(10, 38, 10, 300)],
  );
});

test('零宽/零高的 rect 丢掉', () => {
  assert.deepEqual(
    groupRectsIntoLines([R(10, 28, 10, 10), R(10, 10, 10, 50), R(50, 68, 10, 200)]),
    [R(50, 68, 10, 200)],
  );
});

test('标题大字号与正文分行，图片自成一行', () => {
  const input = [R(0, 40, 80, 220), R(60, 78, 10, 300), R(100, 300, 50, 250), R(320, 338, 10, 120)];
  assert.deepEqual(groupRectsIntoLines(input), input);
});

test('空输入', () => {
  assert.deepEqual(groupRectsIntoLines([]), []);
});

// —— 逐段 ——
const L = (top, bottom, left, right, block) => (block === undefined ? R(top, bottom, left, right) : { ...R(top, bottom, left, right), block });
const B = (top, bottom, left, right, first, last, block) => ({ top, bottom, left, right, ...(block === undefined ? {} : { block }), first, last });

// 本页：段0 两行（首行缩进）、图片一行、段2 三行（末行短）
const page = [L(10, 28, 40, 300, 0), L(40, 58, 10, 300, 0), L(70, 200, 50, 250), L(212, 230, 40, 300, 2), L(242, 260, 10, 300, 2), L(274, 292, 10, 120, 2)];

test('同一行里不同段的 rect 合并后段号取第一块', () => {
  assert.deepEqual(
    groupRectsIntoLines([L(10, 28, 10, 100, 0), L(10, 28, 100, 300, 0), L(40, 58, 10, 300, 1)]),
    [L(10, 28, 10, 300, 0), L(40, 58, 10, 300, 1)],
  );
});

test('按段合并成外接框，图片自成一块', () => {
  assert.deepEqual(groupLinesIntoBlocks(page),
    [B(10, 58, 10, 300, 0, 1, 0), B(70, 200, 50, 250, 2, 2), B(212, 292, 10, 300, 3, 5, 2)]);
  assert.equal(groupLinesIntoBlocks([L(0, 50, 0, 100), L(60, 110, 0, 100)]).length, 2, '相邻两张图不并');
});

test('逐段框住当前行所在整段，逐行框不变', () => {
  assert.deepEqual(focusRange(page, 4, 'para'), B(212, 292, 10, 300, 3, 5, 2));
  assert.deepEqual(focusRange(page, 4, 'line'), page[4]);
});

test('逐段一次跳一整段，落在那段第一行；走出本页交给翻页', () => {
  assert.deepEqual([0, 1, 2].map(i => stepFocusIndex(page, i, 1, 'para')), [2, 2, 3]);
  assert.deepEqual([5, 2].map(i => stepFocusIndex(page, i, -1, 'para')), [2, 0]);
  assert.equal(stepFocusIndex(page, 4, 1, 'para'), null);
  assert.equal(stepFocusIndex(page, 1, -1, 'para'), null);
});

test('逐行走法不变', () => {
  assert.deepEqual([stepFocusIndex(page, 0, 1, 'line'), stepFocusIndex(page, 5, 1, 'line'), stepFocusIndex(page, 0, -1, 'line')], [1, null, null]);
});

test('跨页段落：上一页框前半截、下一页先落后半截', () => {
  // 上一页末段只剩两行（段的前半截），下一页开头一行是它的后半截
  const pageA = [L(10, 28, 40, 300, 0), L(40, 58, 10, 200, 0), L(80, 98, 40, 300, 1), L(110, 128, 10, 300, 1)];
  const pageB = [L(10, 28, 10, 160, 0), L(50, 68, 40, 300, 1), L(80, 98, 10, 300, 1)];
  assert.deepEqual(focusRange(pageA, 2, 'para'), B(80, 128, 10, 300, 2, 3, 1), '上一页只框本页的前半截');
  assert.equal(stepFocusIndex(pageA, 2, 1, 'para'), null, '前半截往下交给翻页');
  assert.deepEqual(focusRange(pageB, 0, 'para'), B(10, 28, 10, 160, 0, 0, 0), '翻过去落第一行，框的是后半截');
  assert.equal(stepFocusIndex(pageB, 0, 1, 'para'), 1, '后半截往下走到下一段');
  assert.equal(stepFocusIndex(pageB, 0, -1, 'para'), null, '后半截往上交给翻页');
  assert.deepEqual(focusRange(pageA, pageA.length - 1, 'para'), B(80, 128, 10, 300, 2, 3, 1), '回上一页落最后一行=前半截');
});

test('示范文字只有一段：逐段框整段', () => {
  assert.deepEqual(focusRange([L(10, 28, 40, 300, 0), L(40, 58, 10, 300, 0), L(70, 88, 10, 90, 0)], 0, 'para'), B(10, 88, 10, 300, 0, 2, 0));
});

test('空页', () => {
  assert.equal(focusRange([], 0, 'para'), null);
  assert.equal(stepFocusIndex([], 0, 1, 'para'), null);
  assert.deepEqual(groupLinesIntoBlocks([]), []);
});
