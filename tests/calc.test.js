/* 计算内核与图表生成器的最小可信测试集：node --test tests/
   只校验可复算的数值与结构，不假装验证浏览器排版。 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const F = require(path.join(__dirname, '..', 'src', 'core', 'factors.js'));
const K = require(path.join(__dirname, '..', 'src', 'core', 'calc.js'));
const C = require(path.join(__dirname, '..', 'src', 'core', 'charts.js'));
const P = require(path.join(__dirname, '..', 'src', 'data', 'project.js'));

const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

test('因子库：键唯一、系数为正、单位与来源齐全', () => {
  const keys = new Set();
  F.FACTORS.forEach((f) => {
    assert.ok(!keys.has(f.k), `重复的因子键：${f.k}`);
    keys.add(f.k);
    assert.ok(f.v > 0, `${f.name} 系数应为正`);
    assert.ok(f.unit && f.unit.length, `${f.name} 缺单位`);
    assert.ok(f.src && f.src.length > 6, `${f.name} 缺来源说明`);
  });
  assert.equal(F.FACTORS.length, 34);  // 能源 8 + 出行 7 + 食物 11 + 用品 8
});

test('个人碳足迹：默认参数手算可复现', () => {
  const em = K.personalEmission(K.PERSONAL_DEFAULT);

  // 食物：120+21.6+12.2+7.65+9+27+36+4.2+6+6.3+10 = 259.95
  assert.ok(near(em.groups.food, 259.95, 0.05), `食物 ${em.groups.food}`);
  // 居住：85.545+32.43+2.064 = 120.039
  assert.ok(near(em.groups.home, 120.039, 0.05), `居住 ${em.groups.home}`);
  // 出行：68+6.18+3.28 = 77.46
  assert.ok(near(em.groups.travel, 77.46, 0.05), `出行 ${em.groups.travel}`);
  // 用品：26.5/12 + 0.75 + 1.64 + 0.66 = 5.2583
  assert.ok(near(em.groups.goods, 5.2583, 0.02), `用品 ${em.groups.goods}`);

  assert.ok(near(em.grossMonthly, 462.7073, 0.1), `毛排放 ${em.grossMonthly}`);
  assert.ok(near(em.activeSaving, 6.8, 0.001), `骑行抵扣 ${em.activeSaving}`);
  assert.ok(near(em.monthly, 455.9073, 0.1), `净排放 ${em.monthly}`);
  assert.ok(near(em.annual, 5470.888, 1), `年排放 ${em.annual}`);
  assert.ok(near(em.grossAnnual, 5552.488, 1));

  const shareSum = em.shares.food + em.shares.home + em.shares.travel + em.shares.goods;
  assert.ok(near(shareSum, 1, 1e-6), '四项占比之和应为 1');
});

test('个人碳足迹：全零输入不产生 NaN，占比归零', () => {
  const zero = { food: {}, home: {}, travel: {}, goods: {} };
  K.FOOD_KEYS.forEach((k) => (zero.food[k] = 0));
  K.HOME_KEYS.forEach((k) => (zero.home[k] = 0));
  K.TRAVEL_KEYS.forEach((k) => (zero.travel[k] = 0));
  zero.travel.bike = 0;
  K.GOODS_KEYS.forEach((k) => (zero.goods[k] = 0));

  const em = K.personalEmission(zero);
  assert.equal(em.monthly, 0);
  assert.equal(em.annual, 0);
  assert.equal(em.shares.food, 0);
  assert.ok(Number.isFinite(em.grossMonthly));
  assert.equal(K.pointsFromCarbonKg(em.annual), 0);
});

test('个人碳足迹：负数与文字输入被夹到 0', () => {
  const em = K.personalEmission({ food: { beef: -5 }, home: { elec: 'abc' }, travel: {}, goods: {} });
  assert.equal(em.groups.food, 0);
  assert.equal(em.groups.home, 0);
  assert.ok(Number.isFinite(em.monthly));
});

test('基准对照：默认参数高于 2.6 t 参照值', () => {
  const em = K.personalEmission(K.PERSONAL_DEFAULT);
  const b = K.personalBenchmark(em.annual);
  assert.equal(b.benchmark, 2600);
  assert.ok(b.ratio > 2 && b.ratio < 2.2, `比值 ${b.ratio}`);
  assert.ok(b.delta > 0);
});

test('减排建议：排序、正收益、积分一致', () => {
  const em = K.personalEmission(K.PERSONAL_DEFAULT);
  const list = K.suggestions(K.PERSONAL_DEFAULT, em);

  assert.ok(list.length >= 6, `建议数量 ${list.length}`);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].save >= list[i].save, '建议应按可减量降序');
  }
  list.forEach((s) => {
    assert.ok(s.save > 0, `${s.title} 应带来正减排`);
    assert.ok(Number.isFinite(s.save));
    assert.equal(s.points, Math.round(s.save * F.POINTS.perKg));
    assert.ok(['易', '中', '难'].includes(s.level));
    assert.ok(s.rank >= 1);
  });
  const total = K.suggestionsTotal(list);
  assert.ok(total > 0);
  assert.ok(near(total, list.reduce((a, s) => a + s.save, 0), 1e-6));
});

test('减排建议：零输入时不出现正收益的伪建议', () => {
  const zero = JSON.parse(JSON.stringify(K.PERSONAL_DEFAULT));
  Object.keys(zero).forEach((g) => Object.keys(zero[g]).forEach((k) => (zero[g][k] = 0)));
  const em = K.personalEmission(zero);
  const list = K.suggestions(zero, em);
  // 只剩“提骑行里程”这类由目标值驱动、且当前记为 0 的建议时，收益仍应大于 0 或整条被过滤
  list.forEach((s) => assert.ok(s.save > 0));
  assert.ok(list.length <= 2, `零输入仍给出 ${list.length} 条建议`);
});

test('企业碳账本：示例企业总量、强度、配额缺口', () => {
  const s = K.enterpriseSummary(K.ENTERPRISE_DEFAULT);
  // 25.944 + 4.24 + 3.9 + 684.36 + 180 + 12.4 + 14.76 + 0.1
  assert.ok(near(s.total, 925.704, 0.05), `总量 ${s.total}`);
  assert.ok(near(s.byScope[1], 34.084, 0.05));
  assert.ok(near(s.byScope[2], 684.36, 0.05));
  assert.ok(near(s.byScope[3], 207.26, 0.05));
  assert.ok(near(s.intensity, 0.1851408, 1e-5));
  assert.ok(near(s.freeQuota, 2100, 0.01));
  assert.ok(near(s.gap, 925.704 - 2100, 0.05));
  assert.ok(s.ratio < 0.5, `对标比值 ${s.ratio}`);
  assert.equal(s.emissionLevel, 'low');
  assert.ok(near(s.perCapita, 925704 / 300, 0.1));
});

test('企业碳账本：帕累托累计到 100%，行换算正确', () => {
  const s = K.enterpriseSummary(K.ENTERPRISE_DEFAULT);
  assert.equal(s.pareto.length, K.ENTERPRISE_DEFAULT.rows.length);
  assert.ok(near(s.pareto[s.pareto.length - 1].cum, 1, 1e-9));
  const top = s.pareto[0];
  assert.equal(top.name, '外购电力');
  assert.ok(top.share > 0.7);
  const row = s.rows.find((r) => r.fk === 'elec');
  assert.equal(row.t, 684.36);
});

test('企业碳账本：产值缺失时强度为 0 而不是 Infinity', () => {
  const m = JSON.parse(JSON.stringify(K.ENTERPRISE_DEFAULT));
  m.output = 0;
  m.employees = 0;
  const s = K.enterpriseSummary(m);
  assert.equal(s.intensity, 0);
  assert.equal(s.perCapita, 0);
  assert.ok(Number.isFinite(s.gap));
});

test('企业碳账本：空账本与未知因子不崩', () => {
  const s = K.enterpriseSummary({ output: 100, employees: 1, sector: 'machinery', rows: [] });
  assert.equal(s.total, 0);
  assert.equal(s.pareto.length, 0);
  const s2 = K.enterpriseSummary({ output: 100, employees: 1, sector: 'nope', rows: [{ id: 'x', scope: 1, fk: 'nope', qty: 10 }] });
  assert.equal(s2.total, 0);
  assert.equal(s2.benchmark, 0);
});

test('积分兑换：贪心分配、守恒且不超支', () => {
  const plan = K.redeemPlan(1000, F.POINTS.items);
  assert.equal(plan.spent, 1000);
  assert.equal(plan.left, 0);
  assert.equal(plan.list[0].count, 2);           // 500 × 2 螺旋藻
  assert.ok(near(plan.credit, 0.36, 1e-9));       // 2 × 0.18
  assert.equal(plan.spent + plan.left, 1000);

  const p2 = K.redeemPlan(260, F.POINTS.items);
  assert.equal(p2.spent, 200);        // 只剩旧物循环（200 分）可换
  assert.equal(p2.left, 60);
  assert.equal(p2.list.find((i) => i.k === 'reuse').count, 1);

  const p3 = K.redeemPlan(-50, F.POINTS.items);
  assert.equal(p3.spent, 0);
  assert.equal(p3.left, 0);
});

test('积分兑换：海洋垃圾不计碳，只计生态量', () => {
  const plan = K.redeemPlan(300, F.POINTS.items);
  const ocean = plan.list.find((i) => i.k === 'ocean');
  assert.equal(ocean.count, 1);
  assert.equal(ocean.credit, 0);
  assert.equal(plan.oceanKg, 1);
  assert.equal(plan.credit, 0);
});

test('积分换算：10 分 / kg，四舍五入', () => {
  assert.equal(K.pointsFromCarbonKg(0), 0);
  assert.equal(K.pointsFromCarbonKg(0.04), 0);
  assert.equal(K.pointsFromCarbonKg(0.05), 1);
  assert.equal(K.pointsFromCarbonKg(123.4), 1234);
});

test('月度趋势：12 个月、均值等于月排放', () => {
  const t = K.monthlyTrend(400);
  assert.equal(t.length, 12);
  const avg = t.reduce((a, d) => a + d.value, 0) / 12;
  assert.ok(near(avg, 400, 0.5), `均值 ${avg}`);
  assert.ok(t.every((d) => d.value > 0 && /月$/.test(d.month)));
});

test('格式化：kg/t 切换与百分比', () => {
  assert.equal(K.fmtKg(950), '950 kg');
  assert.equal(K.fmtKg(5470.9), '5.47 t');
  assert.equal(K.fmtPct(0.1234, 1), '12.3%');
});

test('图表：SVG 输出包含要素且转义标签', () => {
  const donut = C.donut([{ label: '食物', value: 3 }, { label: '出行', value: 1 }], { centerValue: '4', centerLabel: 'kg' });
  assert.ok(donut.startsWith('<svg'));
  assert.ok(donut.includes('stroke-dasharray'));
  assert.ok(donut.includes('4') && donut.includes('kg'));

  const bars = C.bars([{ label: '1月', value: 10 }, { label: '2月', value: 20 }]);
  assert.ok(bars.includes('<rect'));
  assert.ok(bars.includes('1月'));

  const hb = C.hbars([{ label: '本企业', value: 0.18, marker: 0.42 }], { unit: ' t/万元' });
  assert.ok(hb.includes('stroke-dasharray="3 2"'));
  assert.ok(hb.includes('0.18'));

  const tr = C.trend(K.monthlyTrend(100));
  assert.ok(tr.includes('<polyline') && tr.includes('12月'));

  const danger = C.donut([{ label: '<script>alert(1)</script>', value: 1 }]);
  assert.ok(!danger.includes('<script>'));
  assert.ok(danger.includes('&lt;script&gt;'));
});

test('图表：空数据与全零不抛异常', () => {
  assert.ok(C.donut([], {}).startsWith('<svg'));
  assert.ok(C.bars([{ label: 'a', value: 0 }]).includes('<svg'));
  assert.ok(C.hbars([], {}).includes('<svg'));
  assert.ok(C.trend([]).includes('<svg'));
  assert.equal(C.niceMax(0), 1);
  assert.equal(C.niceMax(462), 500);
});

test('项目事实数据：人数、份额、占比自洽', () => {
  assert.equal(P.team.length, 9);
  assert.equal(P.mentors.length, 4);
  assert.equal(P.partners.length, 7);
  assert.equal(P.timeline.length, 6);
  assert.equal(P.stp.sample, 519);
  const sum = (rows) => rows.reduce((a, r) => a + r.n, 0);
  assert.equal(sum(P.stp.education), 519);
  assert.equal(sum(P.stp.age), 519);
  assert.equal(sum(P.stp.city), 519);
  const pct = (rows) => rows.reduce((a, r) => a + r.p, 0);
  assert.ok(near(pct(P.stp.education), 100, 0.05));
  assert.ok(near(pct(P.stp.age), 100, 0.05));
  assert.ok(near(pct(P.stp.city), 100, 0.15));
  assert.equal(P.finance.useTotal, 10.0);
  assert.ok(near(P.finance.use.reduce((a, u) => a + u.amount, 0), 10.0, 1e-9), '资金明细应与合计一致');
  assert.ok(P.meta.award.includes('铜奖'));
});
