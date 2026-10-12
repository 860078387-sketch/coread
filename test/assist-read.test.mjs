import test from 'node:test';
import assert from 'node:assert/strict';
import { splitAssistTokens, placeTokens, classifyToken, createSegmenter, tokenStyle, assistSpacing, FUNCTION_WORDS } from '../web/assistRead.ts';

const seg = createSegmenter();
const demo = '对于一种被认为已经过时的音乐格式，录音带的销售目前似乎正在快速推进。';

test('环境有 Intl.Segmenter', () => {
  assert.ok(seg);
});

test('切词拼回去等于原文', () => {
  assert.equal(splitAssistTokens(demo, seg).map(t => t.text).join(''), demo);
  const mixed = '他说：“Hello, world！” 2024年\n  第二行……\t然后';
  assert.equal(splitAssistTokens(mixed, seg).map(t => t.text).join(''), mixed);
});

test('虚词、实词、标点分类', () => {
  const toks = splitAssistTokens(demo, seg);
  const kindOf = w => toks.find(t => t.text === w)?.kind;
  for (const w of ['对于', '一种', '被', '已经', '的', '目前', '似乎', '正在']) assert.equal(kindOf(w), 'function', w);
  for (const w of ['认为', '过时', '音乐', '格式', '销售', '推进']) assert.equal(kindOf(w), 'content', w);
  assert.equal(kindOf('，'), 'punct');
  assert.equal(kindOf('。'), 'punct');
  assert.equal(classifyToken('Hello'), 'content');
  assert.equal(classifyToken('2024'), 'content');
  assert.equal(classifyToken(' \n\t'), 'punct');
});

test('相邻标点空白并成一段', () => {
  assert.equal(splitAssistTokens('好。」  然后', seg).filter(t => t.kind === 'punct').length, 1);
});

test('空串', () => {
  assert.equal(splitAssistTokens('', seg).length, 0);
  assert.equal(placeTokens([], 0, 0).length, 0);
});

test('虚词表够大且不含标点', () => {
  assert.ok(FUNCTION_WORDS.size > 300);
  for (const w of FUNCTION_WORDS) assert.equal(classifyToken(w), 'function', w);
});

test('截取片段与原文切片对齐', () => {
  const toks = splitAssistTokens(demo, seg);
  const placed = placeTokens(toks, 5, 20);
  assert.equal(placed.map(t => t.text).join(''), demo.slice(5, 20));
  for (const t of placed) assert.equal(demo.slice(t.start, t.start + t.text.length), t.text);
});

test('词后是标点不留空隙', () => {
  const full = placeTokens(splitAssistTokens(demo, seg), 0, demo.length);
  assert.equal(full.find(t => t.text === '格式').gapAfter, false);
  assert.equal(full.find(t => t.text === '音乐').gapAfter, true);
});

test('放大与加粗同开以放大为准，标点不包样式', () => {
  const o = { split: true, bold: true, enlarge: true };
  assert.equal(tokenStyle('content', '音乐', o, 4, true, false)?.fontSize, '1.12em');
  assert.equal(tokenStyle('function', '的', o, 4, false, false)?.fontSize, '0.88em');
  assert.equal(tokenStyle('punct', '，', o, 4, false, false), null);
});

test('间距三档行距字距一起拉', () => {
  assert.equal(assistSpacing(1.85, 0.3, 16, 0).lineHeight, 1.85);
  assert.equal(assistSpacing(1.85, 0.3, 16, 2).lineHeight, 2.55);
  assert.ok(assistSpacing(1.85, 0.3, 16, 1).letterSpacing > 0.3);
});
