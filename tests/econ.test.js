/* 推广经济模型与 TAM 传导的数值校验 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

require(path.join(__dirname, '..', 'src', 'core', 'factors.js'));
const E = require(path.join(__dirname, '..', 'src', 'core', 'econ.js'));

const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

test('推广测算：默认参数的获客数与留存均值可手算复现', () => {
  const r = E.promoteEconomy(E.ECON_DEFAULT);
  // 20 万元 / 9 元 = 22 222.2 人
  assert.ok(near(r.users, 200000 / 9, 0.01));
  // 12 个月几何级数 (1-0.62^12)/0.38 = 2.62309，均值再 /12
  const sumGeo = (1 - Math.pow(0.62, 12)) / (1 - 0.62);
  assert.ok(near(r.avgActive, (200000 / 9) * sumGeo / 12, 0.01));
  assert.equal(r.curve.length, 12);
  assert.ok(r.curve[0].value > r.curve[11].value, '留存应逐月衰减');
  assert.ok(near(r.endActive, (200000 / 9) * Math.pow(0.62, 11), 0.01));
});

test('推广测算：年减碳量与单位成本', () => {
  const r = E.promoteEconomy(E.ECON_DEFAULT);
  assert.ok(near(r.yearKg, r.avgActive * 420, 0.01));
  assert.ok(near(r.yearT, r.yearKg / 1000, 1e-9));
  assert.ok(near(r.cost.acquire, 200000, 0.01));
  assert.ok(near(r.cost.credit, r.yearKg * 0.15, 0.01));
  assert.ok(near(r.cost.fixed, 35000, 0.01));
  assert.ok(near(r.cost.total, r.cost.acquire + r.cost.credit + r.cost.fixed, 0.01));
  assert.ok(near(r.perT, r.cost.total / r.yearT, 0.01));
});

test('推广测算：默认情景下碳价覆盖不足，判定为 heavy', () => {
  const r = E.promoteEconomy(E.ECON_DEFAULT);
  // 每吨成本 ≈ 265 元，碳价中位 70 元 → 覆盖约 26%
  assert.ok(r.perT > 200 && r.perT < 320, `每吨成本 ${r.perT}`);
  assert.ok(r.coverage > 0.2 && r.coverage < 0.35, `覆盖率 ${r.coverage}`);
  assert.equal(r.verdict, 'heavy');
  assert.ok(r.gap > 0);
});

test('推广测算：极端与非法输入不产生 NaN / Infinity', () => {
  const zero = E.promoteEconomy({ budget: 0, cac: 0, retention: 0, perUserKg: 0, creditCost: 0, fixedCost: 0 });
  assert.equal(zero.users, 0);
  assert.equal(zero.yearT, 0);
  assert.equal(zero.perT, 0);
  assert.equal(zero.verdict, 'none');
  assert.ok(Number.isFinite(zero.coverage));

  const neg = E.promoteEconomy({ budget: -5, cac: -1, retention: 1.8, perUserKg: -3, creditCost: -1, fixedCost: -2 });
  assert.equal(neg.users, 0);
  assert.ok(Number.isFinite(neg.perT));
  assert.ok(neg.curve.every((c) => Number.isFinite(c.value)));
});

test('推广测算：留存率 100% 时月活等于获客数', () => {
  const r = E.promoteEconomy({ budget: 10, cac: 10, retention: 1, perUserKg: 100, creditCost: 0, fixedCost: 0 });
  assert.equal(r.users, 10000);
  assert.ok(near(r.avgActive, 10000, 1e-6));
  assert.ok(near(r.endActive, 10000, 1e-6));
  assert.ok(near(r.yearT, 1000, 1e-6));
});

test('预算敏感度：预算翻倍则获客翻倍，单位成本基本不变', () => {
  const sweep = E.budgetSweep(E.ECON_DEFAULT);
  assert.equal(sweep.length, 6);
  const half = sweep.find((s) => s.factor === 0.5);
  const twice = sweep.find((s) => s.factor === 2);
  assert.ok(near(twice.users, half.users * 4, 1));
  assert.ok(near(twice.yearT, half.yearT * 4, 1));
  // 获客与积分成本同比例放大，固定成本摊薄 → 单位成本随规模下降
  assert.ok(twice.perT < half.perT, '规模上去后每吨成本应下降');
});

test('情景对比：保守 / 基准 / 乐观 三档齐全且单调', () => {
  const rows = E.scenarioTable(E.ECON_DEFAULT);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.name), ['保守', '基准', '乐观']);
  assert.ok(rows[0].perT > rows[1].perT, '保守的每吨成本应高于基准');
  assert.ok(rows[1].perT > rows[2].perT, '基准的每吨成本应高于乐观');
  rows.forEach((r) => {
    assert.ok(Number.isFinite(r.perT) && r.perT > 0);
    assert.ok(Number.isFinite(r.coverage));
  });
});

test('TAM 传导：只用报告给出的三条系数，连乘值正确', () => {
  const t = E.tamTransmission();
  assert.equal(t.coefficients.easeToUseful, 0.509);
  assert.equal(t.coefficients.usefulToAttitude, 0.533);
  assert.equal(t.coefficients.attitudeToIntention, 0.559);
  const full = 0.509 * 0.533 * 0.559;
  assert.ok(near(t.decay, full, 1e-12));
  assert.ok(t.decay > 0.14 && t.decay < 0.16, `全程传导 ${t.decay}`);
  // 逐段累计应单调递减
  const c = t.cumulative;
  assert.ok(c[0].value > c[1].value && c[1].value > c[2].value);
  assert.ok(c[4].value > c[3].value, '态度→意愿的直接效应最强');
  assert.ok(t.note.includes('不是因果增量'));
});

test('困境×路径矩阵：行列齐全、强度合法、最优路径可判定', () => {
  const s = E.matrixSummary();
  assert.equal(s.rows.length, 4);
  s.rows.forEach((row) => {
    assert.equal(row.cells.length, 4);
    row.cells.forEach((c) => assert.ok([0, 1, 2].includes(c.score)));
  });
  // 区块链+云计算覆盖：追踪(2) + 标准(1) + 孤岛(2) = 5
  assert.equal(s.pathTotals.p1, 5);
  assert.equal(s.best.k, 'p1');
  // 每条困境都有解（总分 > 0）
  Object.keys(s.barrierTotals).forEach((k) => assert.ok(s.barrierTotals[k] > 0));
});
