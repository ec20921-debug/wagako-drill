// わが子ドリル工房 — AI への頼み文づくりと、AI の答えの読み取り
// ブラウザでは window.WagakoParser、node では module.exports で使う（test/parser.test.js）
(function (root) {
  'use strict';

  var GRADES = ['小1', '小2', '小3', '小4', '小5', '小6', '中1', '中2', '中3'];
  var SUBJECTS = ['算数・数学', '国語', '英語', '理科', '社会', 'そのほか'];
  var LEVELS = { easy: 'やさしい（基本だけ）', normal: 'ふつう（教科書の練習問題くらい）', hard: 'チャレンジ（少しむずかしい）' };

  // 学年に合わせて教科名を言いかえる（小学校は算数、中学校は数学）
  function subjectLabel(grade, subject) {
    if (subject === '算数・数学') return grade.charAt(0) === '中' ? '数学' : '算数';
    return subject;
  }

  // AI に貼る頼み文をつくる
  function buildPrompt(o) {
    var n = o.count || 10;
    var subj = subjectLabel(o.grade, o.subject);
    var lines = [
      'あなたは、' + o.grade + 'の子どもに' + subj + 'を教える、やさしくて正確な先生です。',
      '「' + o.unit + '」の練習問題を' + n + '問つくってください。',
      '',
      '【条件】',
      '- ' + o.grade + 'の教科書の範囲で、むずかしさは「' + (LEVELS[o.level] || LEVELS.normal) + '」',
      '- 答えが1つに決まる問題だけにする',
      '- 図や表がなくても、文章だけで解ける問題にする',
      '- 問題文は短く、' + o.grade + 'が読めることばで書く',
      '- 子どもの名前や、実在の人の名前は使わない',
    ];
    if (o.type === 'choice') {
      lines.push('- 選択肢は4つ。正解は1つだけにして、ほかの3つはよくある間違いにする');
    } else {
      lines.push('- 答えは数字か短いことば（10文字まで）にする');
      lines.push('- 答えの書き方が2通りあるときは「または」でつなぐ（例：3 または 三）');
    }
    lines.push('- 書き終えたら、すべての答えが正しいかを自分でもう一度確かめる');
    lines.push('');
    lines.push('【書き方】下の形だけで書き、ほかの説明やあいさつは書かない');
    lines.push('Q: 問題文');
    if (o.type === 'choice') {
      lines.push('C: 選択肢1 | 選択肢2 | 選択肢3 | 選択肢4');
      lines.push('A: 正解（選択肢の文字をそのまま書く。記号や番号は書かない）');
    } else {
      lines.push('A: 正解');
    }
    lines.push('E: ひとことの解説（30文字くらい）');
    lines.push('---');
    lines.push('（これを' + n + '回くりかえす）');
    return lines.join('\n');
  }

  // 苦手な問題をもとに、似た問題を頼む文をつくる
  function buildSimilarPrompt(drill, weakQs, count) {
    var n = count || 5;
    var base = buildPrompt({ grade: drill.grade, subject: drill.subject, unit: drill.unit, type: drill.type, level: drill.level, count: n });
    var ex = ['', '【つまずいた問題（これと同じ考え方で、数字や中身を変えた問題をつくる）】'];
    weakQs.forEach(function (q) { ex.push('- ' + q.q + '（答え：' + q.a.join(' または ') + '）'); });
    return base.replace('【書き方】', ex.join('\n') + '\n\n【書き方】');
  }

  // 文字のゆれをそろえる（全角→半角、マイナス記号、空白、句点）。keepCase なら大文字・小文字を区別する
  function norm(s, keepCase) {
    if (s == null) return '';
    var t = String(s);
    if (t.normalize) t = t.normalize('NFKC');
    t = t.replace(/[−‐-―－]/g, '-'); // いろいろなマイナス・ダッシュ
    t = t.replace(/\s+/g, '').replace(/[。．]+$/, '').replace(/(\D)\.+$/, '$1');
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, ''); // 1,200 → 1200（3けた区切りだけ）
    return keepCase ? t : t.toLowerCase();
  }

  // ** の太字と行頭の記号だけ外す（英語の空欄 ___ は残す）
  function stripMd(line) {
    return line.replace(/^\s*[-*>]\s+/, '').replace(/\*\*/g, '').trim();
  }

  // 行頭のラベルを見分ける（Q / C / A / E と、日本語のラベル・番号つきに対応）
  var LABELS = [
    { key: 'q', re: /^(?:Q|Ｑ|問題|問|もんだい)\s*\d*\s*[\.．、:：）)]\s*/i },
    { key: 'c', re: /^(?:C|Ｃ|選択肢|せんたくし)\s*[:：]\s*/i },
    { key: 'a', re: /^(?:A|Ａ|答え|こたえ|正解|せいかい)\s*[:：]\s*/i },
    { key: 'e', re: /^(?:E|Ｅ|解説|かいせつ)\s*[:：]\s*/i },
  ];

  // 選択肢を分ける。「A. 東京」「① 東京」の記号は外して、記号の並びも返す（A: B のような答えに対応するため）
  var MARK = /^(?:([A-DＡ-Ｄa-d])[\.．\)）:：]\s+|([①-④])\s*|([1-4])[\)）:：]\s+)/;
  function splitChoices(s) {
    var parts = s.split(/\s*[|｜]\s*/);
    if (parts.length < 2) parts = s.split(/\s*[\/／]\s+|\s+[\/／]\s*/); // 「 / 」区切りだけは許す
    var marks = [];
    var list = parts.map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
      var m = x.match(MARK);
      if (m) { marks.push(norm(m[1] || m[2] || m[3])); return x.slice(m[0].length).trim(); }
      marks.push(null);
      return x;
    });
    return { list: list, marks: marks };
  }
  var MARK_ORDER = { a: 0, b: 1, c: 2, d: 3, '①': 0, '②': 1, '③': 2, '④': 3, '1': 0, '2': 1, '3': 2, '4': 3 };

  // AI の答え（文章）を問題の配列に読み取る。errors は人に見せる注意
  function parse(text, type) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var items = [];
    var cur = null;
    function flush() { if (cur && (cur.q || cur.a || cur.c)) items.push(cur); cur = null; }
    lines.forEach(function (raw) {
      var line = stripMd(raw);
      if (!line || /^```/.test(line)) return;
      if (/^-{3,}$|^={3,}$|^_{3,}$/.test(line)) { flush(); return; }
      for (var i = 0; i < LABELS.length; i++) {
        var m = line.match(LABELS[i].re);
        if (m) {
          var key = LABELS[i].key;
          var val = line.slice(m[0].length).trim();
          if (key === 'q') { flush(); cur = { q: val }; }
          else {
            if (!cur) cur = {};
            if (cur[key] != null && key !== 'e') { flush(); cur = {}; }
            cur[key] = val;
          }
          return;
        }
      }
      // ラベルのない行は、直前の項目の続きとして足す（問題文が2行にわたるとき）
      if (cur && cur.q != null && cur.a == null && cur.c == null) cur.q += '\n' + line;
      else if (cur && cur.e != null) cur.e += line;
    });
    flush();

    var questions = [];
    var errors = [];
    items.forEach(function (it, idx) {
      var no = idx + 1;
      var q = (it.q || '').trim();
      var answers = (it.a || '').split(/\s*または\s*|\s+or\s+/i).map(function (x) { return x.trim(); }).filter(Boolean);
      var problems = [];
      if (!q) problems.push('問題文がありません');
      if (!answers.length) problems.push('正解がありません');
      var choices = null;
      if (it.c != null) {
        var sc = splitChoices(it.c);
        choices = sc.list;
        // 答えが「B」「②」のような記号だけで、選択肢に記号がついていたら、その選択肢に置きかえる。
        // 丸数字は必ず「何番目か」として読む（NFKC で ②→2 になり、選択肢の「2」と取り違えるため）。
        // 文字や数字は、選択肢の中に同じものがないときだけ置きかえる（ビタミン B のような答えを守る）
        var rawA = answers.length === 1 ? answers[0].replace(/[\.．\)）:：]$/, '') : '';
        if (rawA && sc.marks.some(Boolean)) {
          var circled = /^[①-④]$/.test(rawA);
          var inChoices = choices.some(function (c) { return norm(c) === norm(rawA); });
          if (circled || !inChoices) {
            var key = norm(rawA);
            var at = sc.marks.indexOf(key);
            if (at < 0 && MARK_ORDER[key] != null) at = MARK_ORDER[key];
            if (at >= 0 && choices[at]) answers = [choices[at]];
          }
        }
        if (choices.length < 2) problems.push('選択肢が読み取れません');
        var seen = {};
        choices.forEach(function (c) { var k = norm(c); if (seen[k]) problems.push('同じ選択肢が2つあります（' + c + '）'); seen[k] = 1; });
        if (answers.length && !choices.some(function (c) { return answers.some(function (a) { return norm(a) === norm(c); }); })) {
          problems.push('正解が選択肢の中にありません');
        }
      } else if (type === 'choice') {
        problems.push('4択の選択肢（C:）がありません');
      }
      if (problems.length) errors.push({ no: no, q: q, problems: problems });
      questions.push({ q: q, choices: choices, a: answers, e: (it.e || '').trim(), ok: problems.length === 0 });
    });
    if (!items.length) errors.push({ no: 0, q: '', problems: ['問題が1つも読み取れませんでした。AI の答えをそのまま全部貼ってください'] });
    return { questions: questions, errors: errors };
  }

  // 子どもの答えが正しいか。大文字が2つ以上ある答え（CO2 など）は大文字・小文字を区別する
  function isCorrect(question, given) {
    if (!norm(given)) return false;
    return question.a.some(function (a) {
      var keep = /[A-Z].*[A-Z]/.test(String(a));
      var na = norm(a, keep), ng = norm(given, keep);
      if (na === ng) return true;
      var num = /^-?\d+(\.\d+)?$/;
      return num.test(na) && num.test(ng) && parseFloat(na) === parseFloat(ng); // 0.5 と 0.50
    });
  }

  var api = { GRADES: GRADES, SUBJECTS: SUBJECTS, LEVELS: LEVELS, buildPrompt: buildPrompt, buildSimilarPrompt: buildSimilarPrompt, parse: parse, isCorrect: isCorrect, norm: norm, subjectLabel: subjectLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WagakoParser = api;
})(this);
