// node test/lq-finger.test.js — Lateinische Quadrate step-by-step solver ("ngón tay theo vị trí")
const assert = require('assert');
const LQF = require('../src/lq-finger.js');
const CASES = [
  ['1.16', 'C_?__/_E_B_/E____/_D_AC/D__EA', 'A'],
  ['.14', 'CAE__/___?_/__BA_/_B__C/__DCB', 'E'],
  ['.15', '__ADC/___C_/B__AD/D_B_A/_?___', 'A'],
  ['.19', '_B_D_/D_?__/B__CD/A___E/_E_A_', 'B'],
  ['1.20', '_C_AE/A_B_C/?A___/_____/__AD_', 'E'],
];
const key = (r, c) => r * 5 + c;
function checkNoOldTemps(sol) {
  // every chain may only read printed letters, known cells of T and cells it produced itself
  sol.rounds.filter(rd => rd.type === 'chain').forEach((rd, n) => {
    const ok = new Set(rd.usable);
    rd.steps.forEach((st, t) => {
      st.deps.forEach(([r, c]) => assert(ok.has(key(r, c)), `chain ${n + 1} step ${t + 1} uses ${LQF.name(r, c)}, which is neither printed, known in T nor made by this chain`));
      st.set.forEach(([r, c]) => ok.add(key(r, c)));
    });
  });
}
let pass = 0;
for (const [id, grid, want] of CASES) {
  const sol = LQF.solve(grid);
  assert(sol.ok, `${id}: no solution`);
  assert.strictEqual(sol.letter, want, `${id}: got ${sol.letter}, want ${want}`);
  checkNoOldTemps(sol);
  const v = LQF.views(sol);
  assert(v.length >= 2 && v[v.length - 1].final, `${id}: views end with the answer`);
  pass++;
  console.log(`✓ ${id}: ? = ${sol.letter} · T = ${LQF.lineName(...sol.target)} · ${sol.rounds.filter(r => r.type === 'chain').map(r => `${LQF.name(...r.target)}(${r.steps.length} bước, giữ ≤${r.maxHeld})`).join(' → ')}`);
}
// method details from the spec
const s19 = LQF.solve(CASES[3][1]);
assert.deepStrictEqual(s19.target, ['row', 1], '.19: T = hàng 2');
assert.deepStrictEqual(s19.rounds.filter(r => r.type === 'chain').slice(0, 2).map(r => LQF.name(...r.target)), ['δ2', 'β2'], '.19: first chains fill δ2 then β2');
const p19 = s19.rounds.find(r => r.partner); assert(p19 && LQF.name(...p19.partner) === 'ε2', '.19: ε2 is the partner cell');
const s20 = LQF.solve(CASES[4][1]);
assert.deepStrictEqual(s20.target, ['col', 0], '1.20: T = cột α');
assert.deepStrictEqual(s20.rounds.filter(r => r.type === 'chain').slice(0, 2).map(r => LQF.name(...r.target)), ['α1', 'α5'], '1.20: α1 then α5');
const p20 = s20.rounds.find(r => r.partner); assert(p20 && LQF.name(...p20.partner) === 'α4', '1.20: α4 is the partner cell');
assert.strictEqual(s19.rounds[s19.rounds.length - 1].type, 'final-last', '.19: ? read off the hand at the end');
// every chain adds exactly one cell of T
for (const [, g] of CASES) LQF.solve(g).rounds.filter(r => r.type === 'chain').forEach(r => assert.strictEqual(r.fills.length, 1));
console.log(`${pass}/${CASES.length} bài mẫu đúng + kiểm tra phương pháp OK`);
// optional: every digitised book puzzle
const fs = require('fs'), path = require('path'), gp = path.join(__dirname, '..', 'src', 'latin_grids.json');
if (fs.existsSync(gp)) {
  const grids = JSON.parse(fs.readFileSync(gp, 'utf8')), keyAns = process.env.LQ_KEY ? JSON.parse(fs.readFileSync(process.env.LQ_KEY, 'utf8')) : {};
  let ok = 0, bad = [];
  for (const [id, gstr] of Object.entries(grids)) { const s = LQF.solve(gstr); try { assert(s.ok); checkNoOldTemps(s); LQF.views(s); if (keyAns[id]) assert.strictEqual(s.letter, keyAns[id]); ok++; } catch (e) { bad.push(id + ': ' + (s.letter || 'none') + ' vs ' + keyAns[id]); } }
  console.log(`sách: ${ok}/${Object.keys(grids).length} bài giải được bằng phương pháp ngón tay`, bad.length ? bad : '');
}
// the app inlines src/lq-finger.js: both copies must stay identical
const tpl = fs.readFileSync(path.join(__dirname, '..', 'src', 'testas-deathmatch.template.html'), 'utf8');
const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'lq-finger.js'), 'utf8').replace("if (typeof module !== 'undefined') module.exports = LQF;\n", '');
assert(tpl.includes(mod), 'template must contain the current src/lq-finger.js (copy it in after editing)');
console.log('template ⇄ src/lq-finger.js: giống nhau');
