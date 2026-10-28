// 読み取り部分の試験（node test/parser.test.js）
const assert = require('assert');
const P = require('../parser.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok', name); }

t('基本の4択を読み取る', () => {
  const r = P.parse(`Q: I ___ a student.
C: am | is | are | be
A: am
E: I のときは am
---
Q: She ___ my sister.
C: am | is | are | be
A: is
E: She のときは is
---`, 'choice');
  assert.strictEqual(r.questions.length, 2);
  assert.strictEqual(r.errors.length, 0);
  assert.deepStrictEqual(r.questions[0].choices, ['am', 'is', 'are', 'be']);
  assert.deepStrictEqual(r.questions[1].a, ['is']);
});

t('ChatGPT のよくある崩れ（太字・番号・コードの囲み・全角コロン）', () => {
  const r = P.parse("```\n**Q1:** 84 ÷ 4 は？\n**A：** 21\n**E:** 8÷4=2、4÷4=1\n\n**Q2.** 96 ÷ 3 は？\nA: 32\nE: 9÷3=3、6÷3=2\n```", 'input');
  assert.strictEqual(r.questions.length, 2);
  assert.strictEqual(r.errors.length, 0);
  assert.strictEqual(r.questions[0].q, '84 ÷ 4 は？');
  assert.deepStrictEqual(r.questions[1].a, ['32']);
});

t('区切り線がなくても Q で次の問題に進む', () => {
  const r = P.parse('Q: 1+1は？\nA: 2\nQ: 2+3は？\nA: 5', 'input');
  assert.strictEqual(r.questions.length, 2);
});

t('正解が選択肢にないときは注意を出す', () => {
  const r = P.parse('Q: 3×4は？\nC: 7 | 10 | 14 | 16\nA: 12', 'choice');
  assert.strictEqual(r.errors.length, 1);
  assert.ok(r.errors[0].problems[0].includes('選択肢の中にありません'));
  assert.strictEqual(r.questions[0].ok, false);
});

t('4択なのに選択肢がないときは注意を出す', () => {
  const r = P.parse('Q: 3×4は？\nA: 12', 'choice');
  assert.ok(r.errors[0].problems.some((p) => p.includes('C:')));
});

t('答えの「または」を2通りとして受け付ける', () => {
  const r = P.parse('Q: 「さん」を数字で書くと？\nA: 3 または 三', 'input');
  assert.deepStrictEqual(r.questions[0].a, ['3', '三']);
  assert.ok(P.isCorrect(r.questions[0], '３'));
  assert.ok(P.isCorrect(r.questions[0], '三'));
});

t('答え合わせは全角・空白・マイナス・カンマのゆれを許す', () => {
  const q = { a: ['-4'] };
  assert.ok(P.isCorrect(q, '－４'));
  assert.ok(P.isCorrect(q, '−4'));
  assert.ok(P.isCorrect(q, ' -4 '));
  assert.ok(P.isCorrect({ a: ['1200'] }, '1,200'));
  assert.ok(P.isCorrect({ a: ['Apple'] }, 'apple'));
  assert.ok(!P.isCorrect({ a: ['21'] }, '12'));
  assert.ok(!P.isCorrect({ a: ['21'] }, ''));
});

t('分数の答えは割らずにそのまま比べる', () => {
  const r = P.parse('Q: 1/2 と 1/2 をたすと？\nA: 1\n---\nQ: 1/4 を2つ合わせると？\nA: 1/2', 'input');
  assert.deepStrictEqual(r.questions[1].a, ['1/2']);
  assert.ok(P.isCorrect(r.questions[1], '1/2'));
});

t('選択肢の「A. 」「① 」などの記号を取る', () => {
  const r = P.parse('Q: 日本の首都は？\nC: A. 東京 | B. 大阪 | C. 京都 | D. 名古屋\nA: 東京', 'choice');
  assert.deepStrictEqual(r.questions[0].choices, ['東京', '大阪', '京都', '名古屋']);
  assert.strictEqual(r.errors.length, 0);
});

t('何も読み取れないときは案内を出す', () => {
  const r = P.parse('すみません、もう少し詳しく教えてください。', 'input');
  assert.strictEqual(r.questions.length, 0);
  assert.strictEqual(r.errors[0].no, 0);
});

t('頼み文に学年・単元・形式が入る', () => {
  const p = P.buildPrompt({ grade: '中1', subject: '算数・数学', unit: '正負の数', type: 'input', level: 'normal', count: 10 });
  assert.ok(p.includes('中1の子どもに数学'));
  assert.ok(p.includes('「正負の数」'));
  assert.ok(p.includes('10問'));
  assert.ok(!p.includes('C: 選択肢'));
  const c = P.buildPrompt({ grade: '小4', subject: '算数・数学', unit: 'わり算', type: 'choice', level: 'easy', count: 5 });
  assert.ok(c.includes('小4の子どもに算数'));
  assert.ok(c.includes('C: 選択肢1'));
});

t('似た問題の頼み文に、つまずいた問題が入る', () => {
  const p = P.buildSimilarPrompt({ grade: '小4', subject: '算数・数学', unit: 'わり算', type: 'input', level: 'normal' }, [{ q: '84 ÷ 4 は？', a: ['21'] }], 5);
  assert.ok(p.includes('84 ÷ 4 は？（答え：21）'));
  assert.ok(p.indexOf('つまずいた問題') < p.indexOf('【書き方】'));
});

t('英語の空欄 ___ を消さない', () => {
  const r = P.parse('Q: I ___ a student.\nC: am | is | are | be\nA: am\n---\nQ: **She ____ my sister.**\nC: am | is | are | be\nA: is', 'choice');
  assert.strictEqual(r.questions[0].q, 'I ___ a student.');
  assert.strictEqual(r.questions[1].q, 'She ____ my sister.');
});

t('小数の選択肢を記号とまちがえない', () => {
  const r = P.parse('Q: 3 ÷ 2 は？\nC: 1.5 | 2.5 | 3.5 | 0.5\nA: 1.5', 'choice');
  assert.deepStrictEqual(r.questions[0].choices, ['1.5', '2.5', '3.5', '0.5']);
  assert.strictEqual(r.errors.length, 0);
});

t('答えが記号（B・②）だけのときは、その選択肢に置きかえる', () => {
  const r = P.parse('Q: 日本の首都は？\nC: A. 大阪 | B. 東京 | C. 京都 | D. 名古屋\nA: B\n---\nQ: 1+1は？\nC: ① 3 | ② 2 | ③ 4 | ④ 5\nA: ②', 'choice');
  assert.deepStrictEqual(r.questions[0].a, ['東京']);
  assert.deepStrictEqual(r.questions[1].a, ['2']);
  assert.strictEqual(r.errors.length, 0);
});

t('丸数字の答えは、数字の選択肢と取り違えずに「何番目か」で読む', () => {
  const r = P.parse('Q: 2+3は？\nC: ① 3 | ② 5 | ③ 2 | ④ 4\nA: ②', 'choice');
  assert.deepStrictEqual(r.questions[0].a, ['5']);
});

t('記号のない選択肢では、答えの「B」を勝手に置きかえない', () => {
  const r = P.parse('Q: ビタミンの名前は？\nC: A | B | C | D\nA: B', 'choice');
  assert.deepStrictEqual(r.questions[0].a, ['B']);
  assert.strictEqual(r.errors.length, 0);
});

t('小数は 0.5 と 0.50 を同じと見る。3けた区切りでない 1,2 は 12 にしない', () => {
  assert.ok(P.isCorrect({ a: ['0.5'] }, '0.50'));
  assert.ok(!P.isCorrect({ a: ['12'] }, '1,2'));
  assert.ok(P.isCorrect({ a: ['12000'] }, '12,000'));
});

t('大文字が2つ以上の答え（化学式など）は大文字・小文字を区別する', () => {
  assert.ok(P.isCorrect({ a: ['CO2'] }, 'CO2'));
  assert.ok(P.isCorrect({ a: ['CO2'] }, 'ＣＯ２'));
  assert.ok(!P.isCorrect({ a: ['CO2'] }, 'Co2'));
  assert.ok(P.isCorrect({ a: ['Tokyo'] }, 'tokyo'));
});

t('4択の頼み文に「記号や番号は書かない」が入る', () => {
  const c = P.buildPrompt({ grade: '小4', subject: '算数・数学', unit: 'わり算', type: 'choice', level: 'easy', count: 5 });
  assert.ok(c.includes('記号や番号は書かない'));
});

console.log(`\n${n} 件すべて合格`);
