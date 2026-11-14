/* Lateinische Quadrate — step-by-step solution the way it is done in the head ("ngón tay theo vị trí").
   Shared by the app (inlined into testas-deathmatch.template.html) and by test/lq-finger.test.js.

   Method
   1. Target line T: the row or the column through "?" with more printed letters (tie: more crossing lines
      through T's empty cells that already hold ≥ 3 printed letters; still tied: the row). Only T is tracked.
   2. Left hand = the 5 POSITIONS of T (row: thumb = α … little finger = ε; column: thumb = row 1 … = row 5).
      A filled cell folds its finger; the finger of "?" always stands.
   3. The letters of T are recited in ABC order.
   4. A chain fills exactly one more cell of T. It may only use printed letters + the known cells of T + the
      temporary cells it creates itself, never temporaries of an earlier chain (they are forgotten).
   5. When T has two empty cells ("?" and P), P is the partner cell; the next chain aims at P or "?",
      whichever is shorter.
   6. One empty cell left in T → the answer is the missing letter.
   Deductions: last (a line with one empty cell), pair (a line with two empty cells missing {X, Y} and a
   crossing line through one of them holding X), naked (row + column of a cell hold four different letters). */
const LQF = (() => {
  const L = 'ABCDE', G = ['α', 'β', 'γ', 'δ', 'ε'], FINGER = ['cái', 'trỏ', 'giữa', 'áp út', 'út'];
  const name = (r, c) => G[c] + (r + 1);
  const key = (r, c) => r * 5 + c;
  const cells = (k, i) => [0, 1, 2, 3, 4].map(j => k === 'row' ? [i, j] : [j, i]);
  const lineName = (k, i) => k === 'row' ? 'hàng ' + (i + 1) : 'cột ' + G[i];
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const abc = vs => [...vs].sort((a, b) => a - b).map(v => L[v]);

  function parse(s) {
    let tr = -1, tc = -1;
    const g = s.split('/').map((row, r) => [...row].map((x, c) => { if (x === '?') { tr = r; tc = c; } return L.indexOf(x); }));
    return { g, tr, tc };
  }

  function chooseTarget(g, tr, tc) {
    const count = (k, i) => cells(k, i).filter(([r, c]) => g[r][c] >= 0).length;
    const cross = (k, i) => cells(k, i).filter(([r, c]) => g[r][c] < 0)
      .filter(([r, c]) => (k === 'row' ? count('col', c) : count('row', r)) >= 3).length;
    const row = ['row', tr], col = ['col', tc], a = count(...row), b = count(...col);
    if (a !== b) return a > b ? row : col;
    const x = cross(...row), y = cross(...col);
    return y > x ? col : row;
  }

  // forward inference in waves from a base grid; every derived cell remembers the step that produced it
  function infer(base, allowHidden) {
    const g = base.map(r => r.slice()), steps = [], by = new Map();   // by: cell key → step index
    for (let guard = 0; guard < 30; guard++) {
      const wave = [], claimed = new Set();
      const add = st => { if (st.set.some(([r, c]) => claimed.has(key(r, c)) || g[r][c] >= 0)) return; st.set.forEach(([r, c]) => claimed.add(key(r, c))); wave.push(st); };
      for (const k of ['row', 'col']) for (let i = 0; i < 5; i++) {
        const cs = cells(k, i), emp = cs.filter(([r, c]) => g[r][c] < 0), full = cs.filter(([r, c]) => g[r][c] >= 0);
        const have = new Set(full.map(([r, c]) => g[r][c])), miss = [0, 1, 2, 3, 4].filter(v => !have.has(v));
        if (emp.length === 1) add({ type: 'last', k, i, set: [[...emp[0], miss[0]]], deps: full });
        else if (emp.length === 2) {
          for (let e = 0; e < 2; e++) for (let m = 0; m < 2; m++) {
            const [r, c] = emp[e], [ck, ci] = k === 'row' ? ['col', c] : ['row', r];
            const b = cells(ck, ci).find(([x, y]) => g[x][y] === miss[m]);
            if (b) { const o = emp[1 - e]; add({ type: 'pair', k, i, miss, emp, cross: [ck, ci], blocker: b, bl: miss[m], set: [[r, c, miss[1 - m]], [o[0], o[1], miss[m]]], deps: [...full, b] }); }
          }
        } else if (allowHidden && emp.length > 2) {   // fallback only: letter X fits in just one empty cell of the line
          for (const v of miss) {
            const poss = [], bl = [];
            for (const [r, c] of emp) { const [ck, ci] = k === 'row' ? ['col', c] : ['row', r], b = cells(ck, ci).find(([x, y]) => g[x][y] === v); if (b) bl.push(b); else poss.push([r, c]); }
            if (poss.length === 1) add({ type: 'hidden', k, i, v, blk: bl, set: [[...poss[0], v]], deps: bl });
          }
        }
      }
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (g[r][c] < 0) {
        const seen = new Map();
        for (let j = 0; j < 5; j++) { if (g[r][j] >= 0 && !seen.has(g[r][j])) seen.set(g[r][j], [r, j]); }
        for (let j = 0; j < 5; j++) { if (g[j][c] >= 0 && !seen.has(g[j][c])) seen.set(g[j][c], [j, c]); }
        if (seen.size === 4) add({ type: 'naked', r, c, set: [[r, c, [0, 1, 2, 3, 4].find(x => !seen.has(x))]], deps: [...seen.values()] });
      }
      if (!wave.length) break;
      for (const st of wave) { const idx = steps.length; steps.push(st); for (const [r, c, v] of st.set) { g[r][c] = v; by.set(key(r, c), idx); } }
    }
    return { g, steps, by };
  }

  // minimal chain (step indices, in order) that produces cell (r, c)
  function chainFor(inf, r, c) {
    const need = new Set(), stack = [inf.by.get(key(r, c))];
    while (stack.length) { const s = stack.pop(); if (s === undefined || need.has(s)) continue; need.add(s);
      for (const [x, y] of inf.steps[s].deps) { const p = inf.by.get(key(x, y)); if (p !== undefined && !need.has(p)) stack.push(p); } }
    return [...need].sort((a, b) => a - b);
  }

  // temporaries (cells outside T) a chain makes, and how many must be held at the same time
  function holding(inf, chain, isTarget) {
    const born = new Map(), lastUse = new Map();
    chain.forEach((s, t) => {
      for (const [x, y] of inf.steps[s].deps) { const k = key(x, y); if (born.has(k)) lastUse.set(k, t); }
      for (const [x, y] of inf.steps[s].set) { const k = key(x, y); if (!isTarget(x, y)) { born.set(k, t); lastUse.set(k, t); } }
    });
    const live = chain.map((s, t) => [...born.keys()].filter(k => born.get(k) <= t && lastUse.get(k) >= t));
    return { live, max: Math.max(0, ...live.map(x => x.length)) };
  }

  function solve(str) {
    const { g, tr, tc } = parse(str);
    const [k, i] = chooseTarget(g, tr, tc), T = cells(k, i), inT = (r, c) => k === 'row' ? r === i : c === i;
    const known = new Map();   // derived cells of T: key → value
    const rounds = [];
    for (let guard = 0; guard < 10; guard++) {
      const base = g.map(row => row.slice()); known.forEach((v, kk) => { base[Math.floor(kk / 5)][kk % 5] = v; });
      if (base[tr][tc] >= 0) break;
      const empT = T.filter(([r, c]) => base[r][c] < 0);
      const have = T.filter(([r, c]) => base[r][c] >= 0).map(([r, c]) => base[r][c]);
      if (empT.length === 1) { rounds.push({ type: 'final-last', have, value: [0, 1, 2, 3, 4].find(v => !have.includes(v)) }); known.set(key(tr, tc), rounds[rounds.length - 1].value); break; }
      let inf = infer(base, false);
      if (!empT.some(([r, c]) => inf.by.has(key(r, c)))) inf = infer(base, true);
      let best = null;
      for (const [r, c] of empT) {
        if (!inf.by.has(key(r, c))) continue;
        const ch = chainFor(inf, r, c), h = holding(inf, ch, (x, y) => x === r && y === c), isQ = r === tr && c === tc;
        const score = [ch.length, h.max, isQ ? 1 : 0];   // tie: the partner cell first, then "?" follows from the hand
        const less = (x, y) => { for (let j = 0; j < x.length; j++) if (x[j] !== y[j]) return x[j] < y[j]; return false; };
        if (!best || less(score, best.score)) best = { r, c, ch, h, score };
      }
      if (!best) return { ok: false, tr, tc, target: [k, i], rounds };
      const partner = empT.length === 2 ? empT.find(([r, c]) => !(r === tr && c === tc)) : null;
      const steps = best.ch.map(s => inf.steps[s]);
      const fills = [[best.r, best.c, inf.g[best.r][best.c]]];   // a chain adds exactly one cell to T; everything else it made is forgotten
      const usable = new Set(); for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (base[r][c] >= 0) usable.add(key(r, c));
      rounds.push({ type: 'chain', target: [best.r, best.c], partner, emptyBefore: empT.length, missBefore: [0, 1, 2, 3, 4].filter(v => !have.includes(v)),
        steps, live: best.h.live, maxHeld: best.h.max, fills, usable: [...usable] });
      fills.forEach(([r, c, v]) => known.set(key(r, c), v));
    }
    const ans = known.get(key(tr, tc));
    return { ok: ans !== undefined, answer: ans, letter: ans !== undefined ? L[ans] : null, g, tr, tc, target: [k, i], rounds };
  }

  // ---------- views for the step-by-step UI ----------
  function views(sol) {
    const { g, tr, tc } = sol, [k, i] = sol.target, T = cells(k, i), inT = (r, c) => k === 'row' ? r === i : c === i;
    const Tn = lineName(k, i), finger = (r, c) => FINGER[k === 'row' ? c : r], pos = (r, c) => k === 'row' ? G[c] : 'hàng ' + (r + 1);
    const known = new Map(), out = [];
    const tLetters = () => abc([...T.filter(([r, c]) => g[r][c] >= 0).map(([r, c]) => g[r][c]), ...known.values()]);
    const snapshot = extra => Object.assign({ known: new Map(known), temps: [], hl: T, point: null, held: [] }, extra);
    const printedT = T.filter(([r, c]) => g[r][c] >= 0);
    out.push(snapshot({ label: 'Bắt đầu: chọn đường đích',
      text: `Chọn ${Tn}. ` + (printedT.length
        ? `${cap(Tn)} có sẵn ${printedT.map(([r, c]) => `${L[g[r][c]]} ở ${name(r, c)}`).join(', ')}: gập ngón ${printedT.map(([r, c]) => finger(r, c)).join(', ')}. Nhẩm “${tLetters().join('-')}”.`
        : `${cap(Tn)} chưa có chữ nào: cả 5 ngón dựng.`) }));
    sol.rounds.forEach((rd, n) => {
      if (rd.type === 'final-last') return;
      const cur = g.map(r => r.slice()); known.forEach((v, kk) => { cur[Math.floor(kk / 5)][kk % 5] = v; });
      if (rd.partner) {
        const [pr, pc] = rd.partner, [X, Y] = rd.missBefore.map(v => L[v]);
        out.push(snapshot({ label: 'Nhìn tay: ô bạn đời', point: rd.partner,
          text: `Tay còn 2 ngón dựng: ngón ${finger(tr, tc)} (ô ?) và ngón ${finger(pr, pc)} (${name(pr, pc)}). ${name(pr, pc)} là ô bạn đời: ${Tn} còn thiếu ${X}, ${Y}, biết ${name(pr, pc)} là biết ?.` +
            (rd.steps.length >= 5 ? ` Chuỗi tìm ra ${rd.target[0] === tr && rd.target[1] === tc ? 'ô ?' : name(pr, pc)} dài ${rd.steps.length} bước. Gấp giờ thì đoán 50/50 giữa ${X} và ${Y} rồi qua câu khác.` : '') }));
      }
      const temps = new Map();
      rd.steps.forEach((st, t) => {
        const [r0, c0, v0] = st.set[0];
        let text, hl, label;
        const letters = list => abc(list.map(([a, b]) => cur[a][b]));
        if (st.type === 'last') {
          label = 'Đường còn 1 ô trống'; hl = cells(st.k, st.i);
          text = `${cap(lineName(st.k, st.i))} chỉ còn trống ${name(r0, c0)}, nên ${name(r0, c0)} = ${L[v0]}.`;
        } else if (st.type === 'pair') {
          label = 'Cặp 2 ô trống'; hl = [...cells(st.k, st.i), ...cells(...st.cross)];
          const full = cells(st.k, st.i).filter(([a, b]) => cur[a][b] >= 0), [b1, b2] = st.blocker;
          text = `${cap(lineName(st.k, st.i))} (có ${letters(full).join(', ')}) thiếu ${abc(st.miss).join(', ')} ở ${st.emp.map(([a, b]) => name(a, b)).join(', ')}. ${cap(lineName(...st.cross))} có ${L[st.bl]} (ở ${name(b1, b2)}), nên ${st.set.filter(([a, b]) => !(a === tr && b === tc) || (rd.target[0] === tr && rd.target[1] === tc)).map(([a, b, v]) => `${name(a, b)} = ${L[v]}`).join(', ')}.`;
        } else if (st.type === 'hidden') {
          label = 'Chữ chỉ còn 1 chỗ'; hl = cells(st.k, st.i);
          text = `Trong ${lineName(st.k, st.i)}, chữ ${L[st.v]} chỉ còn đặt được ở ${name(r0, c0)}: ${st.blk.map(([a, b]) => `${L[st.v]} ở ${name(a, b)} chặn ${st.k === 'row' ? 'cột ' + G[b] : 'hàng ' + (a + 1)}`).join('; ')}. Nên ${name(r0, c0)} = ${L[st.v]}.`;
        } else {
          label = 'Giỏ đủ 4 chữ'; hl = [...cells('row', r0), ...cells('col', c0)];
          const rowL = st.deps.filter(([a]) => a === r0), colL = st.deps.filter(([a, b]) => a !== r0 && b === c0);
          text = `${name(r0, c0)}: hàng ${r0 + 1} có ${letters(rowL).join(', ') || '—'}, cột ${G[c0]} có ${letters(colL).join(', ') || '—'}, nên ${name(r0, c0)} = ${L[v0]}.`;
        }
        const isTgt = (a, b) => a === rd.target[0] && b === rd.target[1], isQ = (a, b) => a === tr && b === tc;
        st.set.forEach(([a, b, v]) => { cur[a][b] = v; if (!isTgt(a, b) && !isQ(a, b)) temps.set(key(a, b), v); });
        const intoT = st.set.filter(([a, b]) => isTgt(a, b));
        intoT.forEach(([a, b, v]) => known.set(key(a, b), v));
        if (intoT.length) text += ' ' + intoT.map(([a, b]) => `${name(a, b)} nằm trong ${Tn}: gập ngón ${finger(a, b)}.`).join(' ') + ` Nhẩm “${tLetters().join('-')}”.`;
        const held = rd.live[t].map(kk => [Math.floor(kk / 5), kk % 5, temps.get(kk)]).filter(x => x[2] !== undefined);
        out.push(snapshot({ label: `Chuỗi ${n + 1} · ${label}`, text, hl, point: [r0, c0], newc: st.set.filter(([a, b]) => !(a === tr && b === tc) || (rd.target[0] === tr && rd.target[1] === tc)), temps: [...temps.entries()].map(([kk, v]) => [Math.floor(kk / 5), kk % 5, v]), held, heavy: held.length >= 3 && held.length === rd.maxHeld, maxHeld: rd.maxHeld }));
      });
      if (temps.size && !known.has(key(tr, tc))) out.push(snapshot({ label: 'Hết chuỗi', text: 'Hết chuỗi: quên các ô tạm, nhấc tay phải.' }));
    });
    const have = tLetters().filter(x => x !== sol.letter);
    const fin = sol.rounds[sol.rounds.length - 1];
    known.set(key(tr, tc), sol.answer);
    out.push(snapshot({ label: 'Kết luận', final: true, point: [tr, tc],
      text: fin && fin.type === 'final-last' ? `${cap(Tn)} có “${abc(fin.have).join('-')}”, thiếu ${sol.letter}, vậy ? = ${sol.letter}.` : `Chuỗi vừa rồi ra thẳng ô ?: ? = ${sol.letter}. (${cap(Tn)} lúc này có “${have.join('-')}”.)` }));
    return out;
  }

  return { parse, chooseTarget, infer, solve, views, cells, lineName, name, L, G, FINGER, key };
})();
if (typeof module !== 'undefined') module.exports = LQF;
