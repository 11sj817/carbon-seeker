/* 推广经济模型 + TAM 传导测算
   目的：补上结题报告自陈的短板——“未考虑经济效率（开发成本与推广成本）”。
   全部为纯函数，浏览器与 node --test 共用；口径与边界写在页面「数据与方法」里。
   */
(function (global) {
  'use strict';

  var F = (typeof module !== 'undefined' && module.exports)
    ? require('./factors.js')
    : (global.CS && global.CS.factors);

  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* 全国碳市场 CEA 价格区间（示意，用于“推广成本能否被碳价覆盖”的对照） */
  var CARBON_PRICE = { low: 50, mid: 70, high: 90, note: '元 / tCO₂e，按近年全国碳市场配额成交价区间取的示意值' };

  var ECON_DEFAULT = {
    budget: 20,        // 推广预算（万元）
    cac: 9,            // 单用户获客成本（元/人）
    retention: 0.62,   // 月度留存率
    perUserKg: 420,    // 人均年减碳量（kgCO₂e）
    creditCost: 0.15,  // 积分兑付成本（元 / kg 减排）
    fixedCost: 3.5     // 运营固定成本（万元/年）
  };

  /* ---------- 核心测算 ---------- */
  function promoteEconomy(m) {
    var s = m || ECON_DEFAULT;
    var budgetYuan = num(s.budget) * 10000;
    var cac = num(s.cac);
    var users = cac > 0 ? budgetYuan / cac : 0;

    /* 留存率上限取 1（循环按幂计算，不会出现除零）；超过 1 的输入视为无效并夹到 1 */
    var r = clamp(num(s.retention), 0, 1);
    var curve = [], sumActive = 0;
    for (var i = 1; i <= 12; i++) {
      var active = users * Math.pow(r, i - 1);
      curve.push({ month: i + '月', value: active, index: i });
      sumActive += active;
    }
    var avgActive = sumActive / 12;
    var endActive = users * Math.pow(r, 11);

    var yearKg = avgActive * num(s.perUserKg);
    var yearT = yearKg / 1000;

    var acquire = budgetYuan;
    var credit = yearKg * num(s.creditCost);
    var fixed = num(s.fixedCost) * 10000;
    var total = acquire + credit + fixed;

    var perT = yearT > 0 ? total / yearT : 0;
    var perUser = avgActive > 0 ? total / avgActive : 0;

    /* 碳价对照：若把减碳量按中位碳价变现，能覆盖多少推广成本 */
    var revenue = yearT * CARBON_PRICE.mid;
    var coverage = total > 0 ? revenue / total : 0;
    var gap = total - revenue;

    return {
      users: users,
      avgActive: avgActive,
      endActive: endActive,
      curve: curve,
      yearKg: yearKg,
      yearT: yearT,
      cost: { acquire: acquire, credit: credit, fixed: fixed, total: total },
      perT: perT,
      perUserYear: perUser,
      revenue: revenue,
      coverage: coverage,
      gap: gap,
      verdict: yearT <= 0 ? 'none' : (coverage >= 1 ? 'covered' : coverage >= 0.5 ? 'partial' : 'heavy')
    };
  }

  /* ---------- 预算敏感度 ---------- */
  var SWEEP = [0.5, 0.75, 1, 1.5, 2, 3];
  function budgetSweep(m) {
    var s = m || ECON_DEFAULT;
    var base = num(s.budget);
    return SWEEP.map(function (k) {
      var probe = {};
      Object.keys(s).forEach(function (key) { probe[key] = s[key]; });
      probe.budget = base * k;
      var e = promoteEconomy(probe);
      return { budget: probe.budget, users: e.users, yearT: e.yearT, perT: e.perT, factor: k };
    });
  }

  /* ---------- 情景对比 ---------- */
  var SCENARIOS = [
    { k: 'conservative', name: '保守', patch: { cac: 14, retention: 0.5, perUserKg: 300 } },
    { k: 'base', name: '基准', patch: {} },
    { k: 'optimistic', name: '乐观', patch: { cac: 5.5, retention: 0.76, perUserKg: 560 } }
  ];

  function scenarioTable(m) {
    var s = m || ECON_DEFAULT;
    return SCENARIOS.map(function (sc) {
      var probe = {};
      Object.keys(s).forEach(function (key) { probe[key] = s[key]; });
      Object.keys(sc.patch).forEach(function (key) { probe[key] = sc.patch[key]; });
      var e = promoteEconomy(probe);
      return {
        k: sc.k, name: sc.name,
        cac: num(probe.cac), retention: num(probe.retention), perUserKg: num(probe.perUserKg),
        users: e.users, yearT: e.yearT, perT: e.perT, coverage: e.coverage
      };
    });
  }

  /* ---------- TAM 传导链 ----------
     只用结题报告给出的三条标准化路径系数：
       感知易用性 → 感知有用性  0.509
       感知有用性 → 使用态度    0.533
       使用态度   → 行为意愿    0.559
     报告未给出 H2（易用性→态度）与 H5（主观规范→意愿）的系数，
     因此这里不臆造，只做“已知链路的传导强度”分解，并明确标注为连乘近似。 */
  var TAM = {
    easeToUseful: 0.509,
    usefulToAttitude: 0.533,
    attitudeToIntention: 0.559
  };

  function tamTransmission() {
    var a = TAM.easeToUseful, b = TAM.usefulToAttitude, c = TAM.attitudeToIntention;
    return {
      coefficients: TAM,
      /* 三段路径的强度 */
      steps: [
        { from: '感知易用性', to: '感知有用性', coef: a },
        { from: '感知有用性', to: '使用态度', coef: b },
        { from: '使用态度', to: '行为意愿', coef: c }
      ],
      /* 逐段累计：走到“行为意愿”还剩多少 */
      cumulative: [
        { label: '易用性 → 有用性', value: a },
        { label: '易用性 → 态度（经有用性）', value: a * b },
        { label: '易用性 → 意愿（全程）', value: a * b * c },
        { label: '有用性 → 意愿（经态度）', value: b * c },
        { label: '态度 → 意愿（直接）', value: c }
      ],
      /* 一句话结论用的数字 */
      decay: a * b * c,
      note: '标准化路径系数连乘，用于比较不同起点的传导强度，不是因果增量。'
    };
  }

  /* ---------- 困境 → 路径 覆盖矩阵 ----------
     来源：结题报告 2.1–2.4（困境）与 4.1–4.4（路径）。
     强度：2 = 直接对症，1 = 部分缓解，0 = 关系弱。 */
  var MATRIX = {
    barriers: [
      { k: 'b1', name: '激励方式难满足需求' },
      { k: 'b2', name: '碳足迹追踪繁琐' },
      { k: 'b3', name: '缺乏统一核算标准' },
      { k: 'b4', name: '平台独立、缺乏联动' }
    ],
    paths: [
      { k: 'p1', name: '区块链 + 云计算' },
      { k: 'p2', name: '区块链碳交易' },
      { k: 'p3', name: '虚拟现实体验' },
      { k: 'p4', name: '多技术综合激励' }
    ],
    score: {
      b1: { p1: 0, p2: 0, p3: 1, p4: 2 },
      b2: { p1: 2, p2: 1, p3: 0, p4: 1 },
      b3: { p1: 1, p2: 2, p3: 0, p4: 0 },
      b4: { p1: 2, p2: 1, p3: 0, p4: 1 }
    }
  };

  function matrixSummary() {
    var out = { rows: [], pathTotals: {}, barrierTotals: {} };
    MATRIX.paths.forEach(function (p) { out.pathTotals[p.k] = 0; });
    MATRIX.barriers.forEach(function (b) {
      var row = { k: b.k, name: b.name, cells: [], total: 0 };
      MATRIX.paths.forEach(function (p) {
        var v = MATRIX.score[b.k][p.k] || 0;
        row.cells.push({ path: p.k, score: v });
        row.total += v;
        out.pathTotals[p.k] += v;
      });
      out.barrierTotals[b.k] = row.total;
      out.rows.push(row);
    });
    /* 哪条路径覆盖面最广 */
    var best = null;
    MATRIX.paths.forEach(function (p) {
      if (!best || out.pathTotals[p.k] > out.pathTotals[best.k]) best = p;
    });
    out.best = best;
    out.weakestBarrier = MATRIX.barriers.slice().sort(function (x, y) {
      return out.barrierTotals[x.k] - out.barrierTotals[y.k];
    })[0];
    return out;
  }

  var API = {
    ECON_DEFAULT: ECON_DEFAULT,
    CARBON_PRICE: CARBON_PRICE,
    promoteEconomy: promoteEconomy,
    budgetSweep: budgetSweep,
    scenarioTable: scenarioTable,
    tamTransmission: tamTransmission,
    MATRIX: MATRIX,
    matrixSummary: matrixSummary,
    num: num,
    clamp: clamp
  };

  global.CS = global.CS || {};
  global.CS.econ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
