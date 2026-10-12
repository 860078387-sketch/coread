import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRectsIntoLines } from '../web/lineFocus.ts';

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
