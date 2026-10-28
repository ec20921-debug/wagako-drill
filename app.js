// わが子ドリル工房 — 本体（ホーム・つくる・とく・きろく・ずかん）
// 記録は端末の中（localStorage）だけに置き、どこにも送らない
(() => {
  'use strict';

  const P = window.WagakoParser;
  const KEY = 'wagako-drill-v1';
  const $app = document.getElementById('app');

  // ---- 保存 ----
  const blank = () => ({ v: 1, drills: [], records: {}, stars: 0, rewardBase: 0, tickets: 0, stickers: {}, reward: { goal: 30, text: '' }, days: {}, samplesAdded: true });
  const TICKETS_PER_DAY = 3; // ガチャ券は1日3枚まで（同じ問題のくり返しで増やしすぎない）
  let canSave = true;
  let brokenNotice = false;
  let S = null; // 起動のときに load() で読む

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { canSave = false; }
    let x = null;
    if (raw) {
      try { x = JSON.parse(raw); } catch (e) {
        try { localStorage.setItem(KEY + '-broken-' + Date.now(), raw); } catch (e2) { /* 退避できなくても続ける */ }
        brokenNotice = true;
      }
    }
    const s = sanitize(x);
    if (!x || !x.samplesAdded) (window.WAGAKO_SAMPLES || []).forEach((d) => s.drills.push(sanitizeDrill(JSON.parse(JSON.stringify(d)))));
    return s;
  }
  function save() {
    if (!canSave) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { canSave = false; toast('この端末では記録を保存できません'); }
  }

  // 読み込んだデータを、1つずつ型を確かめて作り直す（壊れたファイル・細工したファイルを入れても壊れないように）
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : (d || 0); };
  const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max || 200);
  const isYmd = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  function sanitizeDrill(d) {
    if (!d || typeof d !== 'object') return null;
    const qs = (Array.isArray(d.questions) ? d.questions : []).map((q) => {
      if (!q || typeof q !== 'object') return null;
      const a = (Array.isArray(q.a) ? q.a : [q.a]).map((v) => str(v, 100).trim()).filter(Boolean);
      const choices = Array.isArray(q.choices) ? q.choices.map((v) => str(v, 100).trim()).filter(Boolean) : null;
      const qq = str(q.q, 500).trim();
      if (!qq || !a.length) return null;
      return { q: qq, choices: choices && choices.length >= 2 ? choices : undefined, a, e: str(q.e, 300) };
    }).filter(Boolean);
    if (!qs.length) return null;
    return {
      id: str(d.id, 40).replace(/[^\w-]/g, '') || uid(), sample: d.sample === true, title: str(d.title, 80).trim() || 'わが子ドリル',
      grade: P.GRADES.indexOf(d.grade) >= 0 ? d.grade : '小4', subject: P.SUBJECTS.indexOf(d.subject) >= 0 ? d.subject : 'そのほか',
      unit: str(d.unit, 80), type: d.type === 'choice' ? 'choice' : 'input', level: ['easy', 'normal', 'hard'].indexOf(d.level) >= 0 ? d.level : 'normal',
      createdAt: isYmd(d.createdAt) ? d.createdAt : '', questions: qs,
    };
  }
  function sanitize(x) {
    const s = blank();
    if (!x || typeof x !== 'object') return s;
    const seen = {};
    s.drills = (Array.isArray(x.drills) ? x.drills : []).map(sanitizeDrill).filter((d) => d && !seen[d.id] && (seen[d.id] = true));
    if (x.records && typeof x.records === 'object') {
      Object.keys(x.records).forEach((id) => {
        if (!seen[id]) return;
        const r = x.records[id] || {};
        const plays = (Array.isArray(r.plays) ? r.plays : []).map((p) => p && {
          d: isYmd(p.d) ? p.d : '', c: num(p.c), t: Math.max(1, num(p.t, 1)), m: ['all', 'five', 'weak'].indexOf(p.m) >= 0 ? p.m : 'all',
        }).filter((p) => p && p.d && p.c <= p.t).slice(-500);
        const qs = {};
        if (r.qs && typeof r.qs === 'object') Object.keys(r.qs).forEach((k) => { const i = num(k, -1); const v = r.qs[k] || {}; if (i >= 0 && i < 1000) qs[i] = { seen: num(v.seen), wrong: num(v.wrong) }; });
        s.records[id] = { plays, qs };
      });
    }
    s.stars = num(x.stars);
    s.rewardBase = Math.min(num(x.rewardBase), s.stars);
    s.tickets = Math.min(num(x.tickets), 999);
    if (x.stickers && typeof x.stickers === 'object') STICKERS.forEach((st) => { const n = num(x.stickers[st.id]); if (n) s.stickers[st.id] = n; });
    const rw = x.reward && typeof x.reward === 'object' ? x.reward : {};
    s.reward = { goal: Math.max(1, Math.min(999, num(rw.goal, 30) || 30)), text: str(rw.text, 60) };
    if (x.days && typeof x.days === 'object') Object.keys(x.days).forEach((k) => { if (isYmd(k)) { const v = x.days[k] || {}; s.days[k] = { plays: num(v.plays), c: num(v.c), t: num(v.t), tk: num(v.tk) }; } });
    return s;
  }

  // ---- 小道具 ----
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function ymd(d) { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function addDays(ds, n) { const [y, m, d] = ds.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }
  function daysBetween(a, b) { const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number); return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000); }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove(); return ok;
    }
  }
  const coach = (msg) => `<div class="coach"><div class="face">🦉</div><div class="bubble">${esc(msg)}</div></div>`;
  const drillById = (id) => S.drills.find((d) => d.id === id);
  const rec = (id) => (S.records[id] = S.records[id] || { plays: [], qs: {} });
  // さいこう点は「全部とく」の回だけで出す（5問だけ・まちがえた問題だけの回は数えない）
  function bestScore(id) {
    const r = S.records[id];
    const all = r ? r.plays.filter((p) => p.m === 'all') : [];
    return all.length ? Math.max(...all.map((p) => Math.round((p.c / p.t) * 100))) : null;
  }

  // ---- ほめ言葉・ガチャのシール ----
  const LINES = {
    home: ['きょうも1回だけ、やってみよう！', 'まちがえても大丈夫。まちがいは伸びるチャンス！', '1日5問でも、つづけたら力になるよ'],
    back: 'おかえり！きょうは5問だけでOK。',
    right: ['せいかい！', 'すごい！', 'いいね！', 'そのとおり！'],
    wrong: ['おしい！', 'つぎはできる！', 'ここで覚えちゃおう'],
  };
  const STICKERS = [
    ['apple', '🍎', 'りんご', 'N'], ['banana', '🍌', 'バナナ', 'N'], ['grape', '🍇', 'ぶどう', 'N'], ['straw', '🍓', 'いちご', 'N'],
    ['melon', '🍉', 'すいか', 'N'], ['peach', '🍑', 'もも', 'N'], ['cherry', '🍒', 'さくらんぼ', 'N'], ['kiwi', '🥝', 'キウイ', 'N'],
    ['pine', '🍍', 'パイナップル', 'N'], ['carrot', '🥕', 'にんじん', 'N'], ['corn', '🌽', 'とうもろこし', 'N'], ['donut', '🍩', 'ドーナツ', 'N'],
    ['cookie', '🍪', 'クッキー', 'N'], ['cake', '🍰', 'ケーキ', 'N'], ['cup', '🧁', 'カップケーキ', 'N'], ['onigiri', '🍙', 'おにぎり', 'N'],
    ['sushi', '🍣', 'おすし', 'N'], ['ramen', '🍜', 'ラーメン', 'N'], ['ice', '🍦', 'ソフトクリーム', 'N'], ['choco', '🍫', 'チョコ', 'N'],
    ['fox', '🦊', 'きつね', 'R'], ['panda', '🐼', 'パンダ', 'R'], ['koala', '🐨', 'コアラ', 'R'], ['tiger', '🐯', 'とら', 'R'],
    ['lion', '🦁', 'ライオン', 'R'], ['frog', '🐸', 'かえる', 'R'], ['penguin', '🐧', 'ペンギン', 'R'], ['owl', '🦉', 'ホー先生', 'R'],
    ['unicorn', '🦄', 'ユニコーン', 'SR'], ['dragon', '🐉', 'ドラゴン', 'SR'],
  ].map(([id, e, name, r]) => ({ id, e, name, r }));
  function drawSticker() {
    const x = Math.random();
    const r = x < 0.03 ? 'SR' : x < 0.25 ? 'R' : 'N';
    return pick(STICKERS.filter((s) => s.r === r));
  }

  // ---- 続けた日数 ----
  function streak() {
    let d = ymd(); let n = 0;
    if (!S.days[d]) d = addDays(d, -1);
    while (S.days[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function lastPlayDate() { const ks = Object.keys(S.days).sort(); return ks[ks.length - 1] || null; }

  // ---- 画面の切り替え ----
  function setTab(name) { document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name)); }
  function route() {
    const h = (location.hash || '#home').slice(1).split('/');
    window.scrollTo(0, 0);
    try {
      if (h[0] === 'make') return renderMake(h[1] || null);
      if (h[0] === 'play') return startPlay(h[1], h[2] || 'all');
      if (h[0] === 'records') return renderRecords();
      if (h[0] === 'zukan') return renderZukan();
      return renderHome();
    } catch (e) {
      $app.innerHTML = '<div class="card"><b>画面を表示できませんでした。</b><p class="small">「きろく」のバックアップから戻すか、ホームに戻ってください。</p><a class="btn wide" href="#home">ホームへ</a></div>';
    }
  }
  // 同じ画面への移動でも、もう一度表示し直す（同じ URL だと hashchange が起きないため）
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-go]');
    if (b) { ev.preventDefault(); go(b.dataset.go); }
  });

  // =================================================================
  // ホーム
  // =================================================================
  function renderHome() {
    setTab('home');
    const last = lastPlayDate();
    const gap = last ? daysBetween(last, ymd()) : 0;
    const msg = gap >= 3 ? LINES.back : pick(LINES.home);
    const toReward = Math.max(0, S.reward.goal - (S.stars - S.rewardBase));
    let html = coach(msg);
    html += `<div class="stats">
      <div class="stat"><b>⭐ ${S.stars}</b><span>スター</span></div>
      <div class="stat"><b>🔥 ${streak()}</b><span>日つづけてる</span></div>
      <div class="stat"><b>🎟 ${S.tickets}</b><span>ガチャ券</span></div>
    </div>`;
    if (S.reward.text) {
      html += toReward === 0
        ? `<div class="card tint"><b>🎁 ごほうびゲット！</b> おうちの人に見せよう（${esc(S.reward.text)}）</div>`
        : `<div class="card tint">🎁 <b>${esc(S.reward.text)}</b> まで あと ⭐${toReward}</div>`;
    }
    if (S.tickets > 0) html += `<a class="btn sub wide" href="#zukan">🎟 ガチャをひく（${S.tickets}まい）</a>`;
    html += '<h2>ドリル</h2>';
    if (!S.drills.length) html += '<p class="muted">まだドリルがありません。「つくる」から作りましょう。</p>';
    S.drills.forEach((d) => {
      const best = bestScore(d.id);
      html += `<div class="card">
        <div class="drill-title">${esc(d.title)}</div>
        <div>${d.sample ? '<span class="tag sample">見本</span>' : ''}<span class="tag">${esc(d.grade)}</span><span class="tag">${esc(P.subjectLabel(d.grade, d.subject))}</span><span class="tag">${d.questions.length}問</span>${best != null ? `<span class="tag">さいこう ${best}点</span>` : ''}</div>
        <div class="row" style="margin-top:10px">
          <a class="btn" href="#play/${esc(d.id)}/all">とく</a>
          <a class="btn sub" href="#play/${esc(d.id)}/five">5問だけ</a>
        </div>
      </div>`;
    });
    html += '<a class="btn mint wide" href="#make">＋ わが子ドリルをつくる</a>';
    html += `<div class="note">🔒 記録はこの端末の中だけに保存し、どこにも送りません。お子さんの名前などは入力しないでください。<br>✍️ AI が作った問題は、まちがいをふくむことがあります。おうちの人が正解をざっと確かめてから渡してください。</div>`;
    $app.innerHTML = html;
  }

  // =================================================================
  // つくる（えらぶ → AI に頼む → 貼る → 確かめて保存）
  // =================================================================
  const UNIT_HINT = {
    '算数・数学': '例：わり算の筆算／分数のたし算／正負の数',
    '国語': '例：3年生の漢字の読み／ことわざ',
    '英語': '例：be動詞／一般動詞の過去形',
    '理科': '例：こん虫の体のつくり／電流と電圧',
    '社会': '例：都道府県と県庁所在地／鎌倉時代',
    'そのほか': '例：九九／時計の読み方',
  };
  let mk = null;
  let pendingSimilar = null; // きろくの「にがてに似た問題」から来たときの頼み文
  function newMake(targetId) {
    const t = targetId ? drillById(targetId) : null;
    let sim = '';
    if (t) {
      // きろくから来たときはその頼み文。読み込み直したときは、にがて（なければ最初の3問）から作り直す
      if (pendingSimilar && pendingSimilar.id === t.id) sim = pendingSimilar.prompt;
      else {
        const w = weakList(t, 3);
        sim = P.buildSimilarPrompt(t, (w.length ? w : [0, 1, 2].filter((i) => t.questions[i])).map((i) => t.questions[i]), 5);
      }
    }
    return {
      target: t ? t.id : null,
      grade: t ? t.grade : '小4', subject: t ? t.subject : '算数・数学', unit: t ? t.unit : '', type: t ? t.type : 'input',
      count: t ? 5 : 10, level: t ? t.level : 'normal', prompt: sim, pasted: '', parsed: null, use: [], checked: false, title: '',
    };
  }

  function renderMake(targetId) {
    setTab('make');
    if (!mk || mk.target !== (targetId || null)) mk = newMake(targetId);
    const target = mk.target ? drillById(mk.target) : null;
    const seg = (name, items, cur) => `<div class="seg ${name === 'grade' || name === 'subject' ? 'grid3' : ''}" data-name="${name}">${items.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(cur) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
    let html = '';
    if (target) {
      html += `<h2>にがてから似た問題をふやす</h2><p class="muted">「${esc(target.title)}」に、似た問題を足します。</p>`;
    } else {
      html += '<h2>わが子ドリルをつくる</h2>' + coach('3つのステップでできるよ。AI はおうちの人がいつも使っているもので大丈夫！');
      html += `<div class="card"><h3><span class="step">1</span>えらぶ</h3>
        <label class="f">学年</label>${seg('grade', P.GRADES.map((g) => [g, g]), mk.grade)}
        <label class="f">教科</label>${seg('subject', P.SUBJECTS.map((s) => [s, s]), mk.subject)}
        <label class="f" for="unit">単元・テーマ</label>
        <input type="text" id="unit" value="${esc(mk.unit)}" placeholder="${esc(UNIT_HINT[mk.subject] || '')}">
        <label class="f">答え方</label>${seg('type', [['input', '答えを書く'], ['choice', '4つからえらぶ']], mk.type)}
        <label class="f">問題の数</label>${seg('count', [[5, '5問'], [10, '10問'], [20, '20問']], mk.count)}
        <label class="f">むずかしさ</label>${seg('level', [['easy', 'やさしい'], ['normal', 'ふつう'], ['hard', 'チャレンジ']], mk.level)}
        <button class="btn wide" id="mkPrompt" type="button">頼み文をつくる</button>
      </div>`;
    }
    if (mk.prompt) {
      html += `<div class="card"><h3><span class="step">2</span>AI に頼む</h3>
        <p class="small">下の文をコピーして、いつも使っている AI に貼って送ってください。</p>
        <textarea class="prompt" readonly id="promptBox">${esc(mk.prompt)}</textarea>
        <button class="btn wide" id="copyPrompt" type="button">📋 頼み文をコピー</button>
        <div class="ai-links">
          <a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
          <a href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a>
          <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>
        </div>
      </div>
      <div class="card"><h3><span class="step">3</span>AI の答えを貼る</h3>
        <p class="small">AI の答えを<b>全部</b>コピーして、ここに貼ってください。</p>
        <textarea id="paste" placeholder="Q: …&#10;A: …&#10;E: …&#10;---">${esc(mk.pasted)}</textarea>
        <button class="btn wide" id="doParse" type="button">読み取る</button>
      </div>`;
    }
    if (mk.parsed) html += previewHtml(target);
    $app.innerHTML = html;
    bindMake(target);
  }

  function previewHtml(target) {
    const r = mk.parsed;
    const bad = r.errors.filter((e) => e.no > 0).length;
    let html = `<div class="card"><h3>読み取った問題（${r.questions.length}問${bad ? `・注意 ${bad}問` : ''}）</h3>`;
    if (!r.questions.length) {
      html += `<p class="warn">${esc(r.errors[0].problems[0])}</p></div>`;
      return html;
    }
    html += '<p class="small">注意のある問題は、最初から「使わない」にしています。</p>';
    r.questions.forEach((q, i) => {
      const err = r.errors.find((e) => e.no === i + 1);
      html += `<div class="qprev ${q.ok ? '' : 'bad'}">
        <div><b>${i + 1}.</b> ${esc(q.q)}</div>
        ${q.choices ? `<div class="small">${q.choices.map((c) => (q.a.some((a) => P.norm(a) === P.norm(c)) ? `<span class="ans">${esc(c)}</span>` : esc(c))).join('　/　')}</div>` : ''}
        <div>答え：<span class="ans">${esc(q.a.join(' または '))}</span></div>
        ${q.e ? `<div class="small">💡 ${esc(q.e)}</div>` : ''}
        ${err ? `<div class="warn">⚠ ${esc(err.problems.join('／'))}<br>この問題は使えません。直すときは AI にもう一度頼んでください</div>` : `<label><input type="checkbox" class="useQ" data-i="${i}" ${mk.use[i] ? 'checked' : ''}> この問題を使う</label>`}
      </div>`;
    });
    if (!target) html += `<label class="f" for="title">ドリルの名前</label><input type="text" id="title" value="${esc(mk.title || mk.unit)}">`;
    html += `<label class="check"><input type="checkbox" id="checked" ${mk.checked ? 'checked' : ''}><span>AI の答えはまちがうことがあります。<br>正解をざっと確かめました</span></label>
      <button class="btn mint wide" id="saveDrill" type="button" ${mk.checked && mk.use.some(Boolean) ? '' : 'disabled'}>${target ? 'ドリルに足す' : 'ドリルを保存する'}</button></div>`;
    return html;
  }

  function bindMake(target) {
    $app.querySelectorAll('.seg').forEach((seg) => {
      seg.addEventListener('click', (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        const name = seg.dataset.name;
        mk[name] = name === 'count' ? Number(b.dataset.v) : b.dataset.v;
        const u = document.getElementById('unit'); if (u) mk.unit = u.value;
        if (mk.prompt && mk.unit.trim()) mk.prompt = P.buildPrompt(mk); // 選び直したら頼み文も作り直す
        renderMake(mk.target);
      });
    });
    const unit = document.getElementById('unit');
    if (unit) unit.addEventListener('input', () => { mk.unit = unit.value; });
    const mkPrompt = document.getElementById('mkPrompt');
    if (mkPrompt) mkPrompt.addEventListener('click', () => {
      mk.unit = (unit.value || '').trim();
      if (!mk.unit) { toast('単元・テーマを書いてください'); unit.focus(); return; }
      mk.prompt = P.buildPrompt(mk);
      mk.parsed = null;
      renderMake(mk.target);
      const box = document.getElementById('promptBox'); if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const cp = document.getElementById('copyPrompt');
    if (cp) cp.addEventListener('click', async () => { toast((await copy(mk.prompt)) ? 'コピーしました。AI に貼ってください' : 'コピーできませんでした。長押しで選んでください'); });
    const paste = document.getElementById('paste');
    if (paste) paste.addEventListener('input', () => { mk.pasted = paste.value; });
    const doParse = document.getElementById('doParse');
    if (doParse) doParse.addEventListener('click', () => {
      mk.pasted = paste.value;
      mk.parsed = P.parse(mk.pasted, mk.type);
      mk.use = mk.parsed.questions.map((q) => q.ok);
      mk.checked = false;
      renderMake(mk.target);
      const t = document.querySelector('.qprev'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $app.querySelectorAll('.useQ').forEach((c) => c.addEventListener('change', () => { mk.use[Number(c.dataset.i)] = c.checked; refreshSave(); }));
    const title = document.getElementById('title');
    if (title) title.addEventListener('input', () => { mk.title = title.value; });
    const chk = document.getElementById('checked');
    if (chk) chk.addEventListener('change', () => { mk.checked = chk.checked; refreshSave(); });
    const saveBtn = document.getElementById('saveDrill');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const qs = mk.parsed.questions.filter((q, i) => mk.use[i]).map((q) => ({ q: q.q, choices: q.choices || undefined, a: q.a, e: q.e }));
      if (!qs.length) return;
      if (target) {
        target.questions = target.questions.concat(qs);
        pendingSimilar = null;
        toast(`${qs.length}問 足しました`);
      } else {
        S.drills.unshift({ id: uid(), title: (mk.title || mk.unit || 'わが子ドリル').trim(), grade: mk.grade, subject: mk.subject, unit: mk.unit, type: mk.type, level: mk.level, createdAt: ymd(), questions: qs });
        toast('ドリルができました！');
      }
      save();
      mk = null;
      location.hash = '#home';
    });
    function refreshSave() {
      const b = document.getElementById('saveDrill');
      if (b) b.disabled = !(mk.checked && mk.use.some(Boolean));
    }
  }

  // =================================================================
  // とく
  // =================================================================
  let sess = null;
  let lastWeak = null; // 直前の回でまちがえた問題（「まちがえた問題だけ、もう一回」用）
  function startPlay(id, mode) {
    setTab('home');
    const d = drillById(id);
    if (!d || !d.questions.length) { location.hash = '#home'; return; }
    let order = shuffle(d.questions.map((_, i) => i));
    if (mode === 'five') order = order.slice(0, 5);
    if (mode === 'weak') {
      const w = lastWeak && lastWeak.id === d.id ? lastWeak.idx.filter((i) => d.questions[i]) : weakList(d, 10);
      order = w.length ? shuffle(w) : order;
    }
    sess = { d, mode, order, i: 0, correct: 0, wrong: [], answered: false, choices: {} };
    renderQuestion();
  }

  function renderQuestion() {
    const { d, order, i } = sess;
    const q = d.questions[order[i]];
    const left = order.length - i;
    let html = `<div class="muted">${esc(d.title)}</div>
      <div class="meter"><i style="width:${Math.round((i / order.length) * 100)}%"></i></div>
      <div class="meter-label">あと ${left} 問でクリア！</div>
      <div class="qcard">${esc(q.q)}</div>`;
    if (q.choices && q.choices.length) {
      const cs = sess.choices[i] || (sess.choices[i] = shuffle(q.choices));
      html += `<div class="choices">${cs.map((c) => `<button type="button" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    } else {
      html += `<div class="answer-row"><input type="text" id="ans" autocomplete="off" inputmode="text" aria-label="こたえ"><button class="btn" id="send" type="button">こたえる</button></div>`;
    }
    html += '<div id="fb"></div>';
    $app.innerHTML = html;
    sess.answered = false;
    if (q.choices && q.choices.length) {
      $app.querySelectorAll('.choices button').forEach((b) => b.addEventListener('click', () => judge(b.dataset.c, b)));
    } else {
      const inp = document.getElementById('ans');
      inp.focus();
      // 変換の確定の Enter（isComposing・229）では答えない。Enter はここで止めて「つぎへ」まで押さないようにする
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        judge(inp.value);
      });
      document.getElementById('send').addEventListener('click', () => judge(inp.value));
    }
  }

  function judge(given, btn) {
    if (sess.answered) return;
    if (!String(given || '').trim()) { toast('こたえを書いてね'); return; }
    sess.answered = true;
    const { d, order, i } = sess;
    const qi = order[i];
    const q = d.questions[qi];
    const ok = P.isCorrect(q, given);
    const r = rec(d.id);
    const st = (r.qs[qi] = r.qs[qi] || { seen: 0, wrong: 0 });
    st.seen++;
    if (ok) sess.correct++; else { st.wrong++; sess.wrong.push(qi); }
    if (btn) {
      $app.querySelectorAll('.choices button').forEach((b) => {
        b.disabled = true;
        if (P.isCorrect(q, b.dataset.c)) b.classList.add('right');
      });
      if (!ok) btn.classList.add('wrong');
    } else {
      const inp = document.getElementById('ans'); if (inp) inp.disabled = true;
      const sb = document.getElementById('send'); if (sb) sb.disabled = true;
    }
    const last = i === order.length - 1;
    const canOverride = !ok && !btn; // 書く問題で×のときだけ、おうちの人が「これも正解」にできる
    document.getElementById('fb').innerHTML = `
      <div class="judge ${ok ? 'ok' : 'ng'}" id="judgeMark">${ok ? '⭕' : '❌'}</div>
      <div id="coachLine">${coach(ok ? pick(LINES.right) : pick(LINES.wrong))}</div>
      ${ok ? '' : `<div class="explain">こたえ：<b>${esc(q.a.join(' または '))}</b></div>`}
      ${q.e ? `<div class="explain">💡 ${esc(q.e)}</div>` : ''}
      ${canOverride ? '<button class="btn ghost wide" id="override" type="button">おうちの人：この答えも正解にする</button>' : ''}
      <button class="btn wide" id="next" type="button">${last ? 'けっかを見る' : 'つぎへ'}</button>`;
    save();
    const nx = document.getElementById('next');
    setTimeout(() => nx.focus(), 300); // 答えた直後のキー入力で「つぎへ」が押されないよう、少し待ってから
    nx.addEventListener('click', () => { if (last) finish(); else { sess.i++; renderQuestion(); } });
    const ov = document.getElementById('override');
    if (ov) ov.addEventListener('click', () => {
      if (!confirm(`「${String(given).trim()}」も正解にしますか？（このドリルの答えに足します）`)) return;
      q.a.push(String(given).trim().slice(0, 100));
      sess.correct++;
      sess.wrong.pop();
      st.wrong = Math.max(0, st.wrong - 1);
      save();
      ov.remove();
      document.getElementById('judgeMark').className = 'judge ok';
      document.getElementById('judgeMark').textContent = '⭕';
      document.getElementById('coachLine').innerHTML = coach('おうちの人が正解にしてくれたよ！');
    });
  }

  function finish() {
    const { d, correct, order, wrong, mode } = sess;
    const total = order.length;
    const pct = Math.round((correct / total) * 100);
    const r = rec(d.id);
    r.plays.push({ d: ymd(), c: correct, t: total, m: mode });
    const day = (S.days[ymd()] = S.days[ymd()] || { plays: 0, c: 0, t: 0, tk: 0 });
    day.plays++; day.c += correct; day.t += total;
    S.stars += correct;
    // ガチャ券：3問以上を8割できたら1枚。「まちがえた問題だけ」の回は出さず、1日3枚まで
    const ticket = mode !== 'weak' && total >= 3 && pct >= 80 && (day.tk || 0) < TICKETS_PER_DAY;
    if (ticket) { S.tickets++; day.tk = (day.tk || 0) + 1; }
    save();
    lastWeak = { id: d.id, idx: wrong.slice() };
    const msg = ticket ? 'クリア！ガチャ券ゲット！'
      : pct >= 80 ? 'クリア！きょうのガチャ券はおしまい。また明日！'
      : pct >= 50 ? 'よくがんばった！まちがえた問題だけ、もう一回やってみよう' : 'むずかしかったね。5問だけで、もう一回やってみよう';
    let html = `<div class="muted">${esc(d.title)}</div>
      <div class="big">${correct} / ${total}</div>
      <p style="text-align:center;margin:0">⭐ +${correct}${ticket ? '　🎟 +1' : ''}</p>
      ${coach(msg)}`;
    if (wrong.length) html += `<button class="btn wide" type="button" data-go="#play/${esc(d.id)}/weak">まちがえた問題だけ、もう一回（${wrong.length}問）</button>`;
    if (S.tickets > 0) html += `<a class="btn sub wide" href="#zukan">🎟 ガチャをひく</a>`;
    html += `<a class="btn ghost wide" href="#home">ホームへ</a>`;
    $app.innerHTML = html;
    sess = null;
  }

  // =================================================================
  // ずかん・ガチャ
  // =================================================================
  function renderZukan(drawn) {
    setTab('zukan');
    const have = Object.keys(S.stickers).length;
    let html = `<h2>ずかん（${have} / ${STICKERS.length}）</h2>`;
    html += `<div class="card gacha">
      <div class="capsule ${drawn ? 'spin' : ''}">${drawn ? drawn.e : '🎁'}</div>
      ${drawn ? `<div><span class="rar ${drawn.r}">${drawn.r}</span>　<b>${esc(drawn.name)}</b>${S.stickers[drawn.id] > 1 ? '（もってた！）' : '（はじめて！）'}</div>` : '<div class="muted">ドリルを8割できるとガチャ券がもらえるよ</div>'}
      <button class="btn wide" id="draw" type="button" ${S.tickets > 0 ? '' : 'disabled'}>🎟 ガチャをひく（のこり ${S.tickets}）</button>
    </div>`;
    html += `<div class="zukan">${STICKERS.map((s) => `<div class="${S.stickers[s.id] ? '' : 'none'}">${S.stickers[s.id] ? s.e : '❔'}<small>${S.stickers[s.id] ? esc(s.name) : s.r}</small></div>`).join('')}</div>`;
    $app.innerHTML = html;
    document.getElementById('draw').addEventListener('click', () => {
      if (S.tickets <= 0) return;
      S.tickets--;
      const s = drawSticker();
      S.stickers[s.id] = (S.stickers[s.id] || 0) + 1;
      save();
      renderZukan(s);
    });
  }

  // =================================================================
  // きろく（おうちの人向け）
  // =================================================================
  function review(d) {
    const r = S.records[d.id];
    const since = addDays(ymd(), -2);
    const recent = r ? r.plays.filter((p) => p.d >= since) : [];
    if (!r || !r.plays.length) return 'まだ記録がありません。まずは1回といてみましょう。';
    if (!recent.length) return 'この3日はお休み中。「5問だけ」で軽く再開するのがおすすめです。';
    const c = recent.reduce((a, p) => a + p.c, 0), t = recent.reduce((a, p) => a + p.t, 0);
    const pct = Math.round((c / t) * 100);
    const head = `この3日で ${recent.length}回・正答率 ${pct}%。`;
    if (pct < 60) return head + 'むずかしすぎるかもしれません。むずかしさを「やさしい」にして作り直すのも手です。';
    if (pct >= 90 && recent.length >= 3) return head + 'かんぺきです！むずかしさを1段上げるか、次の単元へ進みましょう。';
    return head + 'にがての問題に似た問題を足すと、ぐっと伸びます。';
  }

  function weakList(d, n) {
    const r = S.records[d.id];
    if (!r) return [];
    return Object.keys(r.qs).map(Number).filter((i) => d.questions[i] && r.qs[i].wrong > 0)
      .sort((a, b) => r.qs[b].wrong - r.qs[a].wrong).slice(0, n || 3);
  }

  function renderRecords() {
    setTab('records');
    let html = '<h2>きろく（おうちの人向け）</h2>';
    if (!S.drills.length) html += '<p class="muted">ドリルがありません。</p>';
    S.drills.forEach((d) => {
      const r = S.records[d.id];
      const plays = r ? r.plays : [];
      const best = bestScore(d.id);
      const weak = weakList(d, 3);
      html += `<div class="card"><div class="drill-title">${esc(d.title)}</div>
        <div class="muted">${plays.length}回　${best != null ? `さいこう ${best}点　` : ''}${plays.length ? `さいご ${esc(plays[plays.length - 1].d)}` : ''}</div>`;
      if (plays.length) html += `<div class="bars">${plays.slice(-10).map((p) => `<i style="height:${Math.max(6, Math.round((p.c / p.t) * 100))}%" title="${p.c}/${p.t}"></i>`).join('')}</div>`;
      html += `<p class="small">🦉 ${esc(review(d))}</p>`;
      if (weak.length) {
        html += '<div class="small"><b>にがて TOP' + weak.length + '</b></div>';
        weak.forEach((i) => { html += `<div class="weak">${esc(d.questions[i].q)}<br><span class="muted">答え：${esc(d.questions[i].a.join(' または '))}／まちがい ${r.qs[i].wrong}回</span></div>`; });
        html += `<button class="btn sub wide simBtn" data-id="${esc(d.id)}" type="button">にがてに似た問題を AI に頼む</button>`;
      }
      html += `<div class="row"><button class="btn ghost renBtn" data-id="${esc(d.id)}" type="button">名前をかえる</button><button class="btn ghost delBtn" data-id="${esc(d.id)}" type="button">けす</button></div></div>`;
    });
    html += `<h2>ごほうび</h2><div class="card">
      <label class="f" for="rwText">⭐がたまったら、もらえるもの（空にすると表示しません）</label>
      <input type="text" id="rwText" value="${esc(S.reward.text)}" placeholder="例：すきなおやつ／公園で1時間あそぶ">
      <label class="f" for="rwGoal">⭐の数</label>
      <input type="number" id="rwGoal" min="1" max="999" value="${S.reward.goal}">
      <div class="row" style="margin-top:10px"><button class="btn" id="rwSave" type="button">保存</button><button class="btn sub" id="rwDone" type="button">ごほうびを渡した</button></div>
      <p class="muted small">いまの⭐：${S.stars - S.rewardBase}（ごほうびを渡すと0から数え直します）</p>
    </div>`;
    html += `<h2>バックアップ</h2><div class="card">
      <p class="small">記録はこの端末の中だけにあります。機種変更の前などに保存しておくと安心です。</p>
      <div class="row"><button class="btn sub" id="exp" type="button">ファイルに保存</button><label class="btn sub" for="imp">ファイルから戻す</label></div>
      <input type="file" id="imp" accept="application/json,.json" hidden>
    </div>`;
    $app.innerHTML = html;

    $app.querySelectorAll('.simBtn').forEach((b) => b.addEventListener('click', () => {
      const d = drillById(b.dataset.id);
      const weak = weakList(d, 3).map((i) => d.questions[i]);
      pendingSimilar = { id: d.id, prompt: P.buildSimilarPrompt(d, weak, 5) };
      mk = null;
      location.hash = '#make/' + d.id;
    }));
    $app.querySelectorAll('.renBtn').forEach((b) => b.addEventListener('click', () => {
      const d = drillById(b.dataset.id);
      const name = prompt('新しい名前', d.title);
      if (name && name.trim()) { d.title = name.trim(); save(); renderRecords(); }
    }));
    $app.querySelectorAll('.delBtn').forEach((b) => b.addEventListener('click', () => {
      const d = drillById(b.dataset.id);
      if (!confirm(`「${d.title}」をけしますか？記録も消えます。`)) return;
      S.drills = S.drills.filter((x) => x.id !== d.id);
      delete S.records[d.id];
      save(); renderRecords();
    }));
    document.getElementById('rwSave').addEventListener('click', () => {
      S.reward.text = document.getElementById('rwText').value.trim();
      S.reward.goal = Math.max(1, Math.min(999, Number(document.getElementById('rwGoal').value) || 30));
      save(); toast('保存しました');
    });
    document.getElementById('rwDone').addEventListener('click', () => {
      if (!confirm('ごほうびを渡しましたか？⭐を0から数え直します')) return;
      S.rewardBase = S.stars; save(); renderRecords();
    });
    document.getElementById('exp').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `wagako-drill-${ymd()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    document.getElementById('imp').addEventListener('change', (ev) => {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = ''; // 同じファイルをもう一度選んでも読めるように
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { toast('ファイルが大きすぎます'); return; }
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const x = JSON.parse(fr.result);
          if (!x || !Array.isArray(x.drills)) throw new Error('形がちがいます');
          const next = sanitize(x);
          if (!confirm(`いまの記録を、このファイルの中身（ドリル ${next.drills.length}こ）に置きかえます。よろしいですか？`)) return;
          S = next; lastWeak = null; mk = null;
          save(); toast('戻しました'); renderRecords();
        } catch (e) { toast('このファイルは読めませんでした'); }
      };
      fr.readAsText(f);
    });
  }

  // ---- 起動 ----
  S = load();
  save();
  route();
  if (brokenNotice) toast('記録が読めなかったので、新しく始めました（前のデータは端末に残しています）');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
