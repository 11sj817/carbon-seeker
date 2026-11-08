/* 计算内核：个人碳足迹、企业碳账本、绿色积分与兑换。
   纯函数，无 DOM 依赖 —— 浏览器与 node --test 共用同一份代码。 */
(function (global) {
  'use strict';

  var F = (typeof module !== 'undefined' && module.exports)
    ? require('./factors.js')
    : (global.CS && global.CS.factors);

  if (!F) throw new Error('碳寻：排放因子库未加载（core/factors.js 必须先于 core/calc.js）');

  var MAP = F.map;

  /* ---------------- 个人碳足迹 ---------------- */

  var PERSONAL_DEFAULT = {
    food: { beef: 2, pork: 3, poultry: 2, fish: 1.5, egg: 2, dairy: 9, rice: 9, wheat: 3, veg: 12, fruit: 9, meal: 4 },
    home: { elec: 150, gas: 15, water: 6, heat: 0 },
    travel: { car: 400, bus: 60, metro: 80, rail: 0, flight: 0, bike: 40 },
    goods: { tshirt: 1, pants: 1, coat: 0.4, paper: 150, bottle: 20, bag: 20 }
  };

  var FOOD_KEYS = ['beef', 'pork', 'poultry', 'fish', 'egg', 'dairy', 'rice', 'wheat', 'veg', 'fruit', 'meal'];
  var HOME_KEYS = ['elec', 'gas', 'water', 'heat'];
  var TRAVEL_KEYS = ['car', 'bus', 'metro', 'rail', 'flight'];
  var GOODS_KEYS = ['tshirt', 'pants', 'coat', 'paper', 'bottle', 'bag'];

  function num(v, d) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* 每月排放（kgCO₂e）。衣物按「件/年」录入后摊到月。 */
  function personalEmission(input) {
    var s = input || PERSONAL_DEFAULT;
    var detail = { food: [], home: [], travel: [], goods: [] };
    var g = { food: 0, home: 0, travel: 0, goods: 0 };

    FOOD_KEYS.forEach(function (k) {
      var kg = num(s.food && s.food[k]) * MAP[k].v;
      detail.food.push({ k: k, name: MAP[k].name, unit: MAP[k].unit, qty: num(s.food && s.food[k]), kg: kg });
      g.food += kg;
    });
    HOME_KEYS.forEach(function (k) {
      var kg = num(s.home && s.home[k]) * MAP[k].v;
      detail.home.push({ k: k, name: MAP[k].name, unit: MAP[k].unit, qty: num(s.home && s.home[k]), kg: kg });
      g.home += kg;
    });
    TRAVEL_KEYS.forEach(function (k) {
      var kg = num(s.travel && s.travel[k]) * MAP[k].v;
      detail.travel.push({ k: k, name: MAP[k].name, unit: MAP[k].unit, qty: num(s.travel && s.travel[k]), kg: kg });
      g.travel += kg;
    });
    GOODS_KEYS.forEach(function (k) {
      var q = num(s.goods && s.goods[k]);
      var monthly = (k === 'tshirt' || k === 'pants' || k === 'coat') ? q / 12 : q;
      var kg = monthly * MAP[k].v;
      detail.goods.push({ k: k, name: MAP[k].name, unit: MAP[k].unit, qty: q, kg: kg });
      g.goods += kg;
    });

    /* 骑行 / 步行按替代小汽车计减排（不产生负排放，单列抵扣） */
    var bikeKm = num(s.travel && s.travel.bike);
    var activeSaving = bikeKm * MAP.car.v;

    var gross = g.food + g.home + g.travel + g.goods;
    var net = Math.max(0, gross - activeSaving);

    var items = [];
    ['food', 'home', 'travel', 'goods'].forEach(function (grp) {
      detail[grp].forEach(function (it) { if (it.kg > 0) items.push(it); });
    });
    items.sort(function (a, b) { return b.kg - a.kg; });

    var share = function (v) { return gross > 0 ? v / gross : 0; };

    return {
      detail: detail,
      groups: g,
      grossMonthly: gross,
      activeSaving: activeSaving,
      monthly: net,
      annual: net * 12,
      grossAnnual: gross * 12,
      savedAnnual: activeSaving * 12,
      shares: { food: share(g.food), home: share(g.home), travel: share(g.travel), goods: share(g.goods) },
      topItems: items.slice(0, 5)
    };
  }

  function personalBenchmark(annualKg) {
    var b = F.BENCHMARK.personalAnnual;
    return {
      benchmark: b,
      ratio: b > 0 ? annualKg / b : 0,
      delta: annualKg - b
    };
  }

  /* 减排建议：每条都用当前输入算潜在年减排量，不写死结论。 */
  function suggestions(input, emission) {
    var s = input || PERSONAL_DEFAULT;
    var e = emission || personalEmission(s);
    var out = [];

    var carKm = num(s.travel.car), metroKm = num(s.travel.metro), busKm = num(s.travel.bus);
    if (carKm > 0) {
      var shift = carKm * 0.3;
      var saveCar = shift * (MAP.car.v - MAP.metro.v) * 12;
      out.push({
        id: 'car-to-metro',
        title: '把三成驾车里程换乘轨道 / 公交',
        detail: '每月 ' + Math.round(shift) + ' km 改乘轨道交通，按 0.17 与 0.041 kgCO₂/km 的差值计算。',
        save: saveCar, level: '中'
      });
    }

    var meat = num(s.food.beef) + num(s.food.pork) + num(s.food.poultry);
    if (meat > 0) {
      var meatKg = (num(s.food.beef) * 60 + num(s.food.pork) * 7.2 + num(s.food.poultry) * 6.1);
      out.push({
        id: 'less-beef',
        title: '每周两天素食，牛肉减半',
        detail: '肉类结构里牛肉占比最高时收益最大；按现有肉类排放的 35% 折算可减量。',
        save: meatKg * 0.35 * 12, level: '易'
      });
    }

    var elec = num(s.home.elec);
    if (elec > 0) {
      out.push({
        id: 'elec-26',
        title: '空调 26 ℃、待机断电',
        detail: '按家庭月度用电 8% 的降幅估算，乘 0.5703 kgCO₂/kWh 的电网因子。',
        save: elec * 0.08 * MAP.elec.v * 12, level: '易'
      });
    }

    var paper = num(s.goods.paper);
    if (paper > 0) {
      out.push({
        id: 'paper-double',
        title: 'A4 双面打印、无纸化归档',
        detail: '纸张用量减半，单张 5 gCO₂e。',
        save: paper * 0.5 * MAP.paper.v * 12, level: '易'
      });
    }

    var bottle = num(s.goods.bottle);
    if (bottle > 0) {
      out.push({
        id: 'cup',
        title: '自带水杯与餐具',
        detail: '一次性 PET 瓶减少 80%，单瓶 0.082 kgCO₂e。',
        save: bottle * 0.8 * MAP.bottle.v * 12, level: '易'
      });
    }

    var clothKg = (num(s.goods.tshirt) * MAP.tshirt.v + num(s.goods.pants) * MAP.pants.v + num(s.goods.coat) * MAP.coat.v);
    if (clothKg > 0) {
      out.push({
        id: 'cloth-life',
        title: '衣物延寿一年、优先二手',
        detail: '新购量减少 40%，按现有服装隐含碳折算。',
        save: clothKg * 0.4, level: '中'
      });
    }

    var bikeKm = num(s.travel.bike);
    var bikeTarget = Math.max(120, bikeKm * 2);
    out.push({
      id: 'active-travel',
      title: '5 km 内通勤改骑行 / 步行',
      detail: '把每月骑行里程提到 ' + Math.round(bikeTarget) + ' km，替代小汽车出行。',
      save: Math.max(0, (bikeTarget - bikeKm)) * MAP.car.v * 12, level: '中'
    });

    if (e.groups.food > 0) {
      out.push({
        id: 'food-waste',
        title: '按需备餐，减少 10% 食物浪费',
        detail: '食物从生产到餐桌的隐含碳按现有食物排放的 10% 折算。',
        save: e.groups.food * 0.1 * 12, level: '中'
      });
    }

    out = out.filter(function (x) { return x.save > 0; });
    out.sort(function (a, b) { return b.save - a.save; });
    out.forEach(function (x, i) { x.rank = i + 1; x.points = pointsFromCarbonKg(x.save); });
    return out;
  }

  function suggestionsTotal(list) {
    return list.reduce(function (s, x) { return s + x.save; }, 0);
  }

  /* ---------------- 企业碳账本 ---------------- */

  var ENTERPRISE_DEFAULT = {
    name: '示例企业（机械制造）',
    output: 5000,      // 万元产值
    employees: 300,
    sector: 'machinery',
    rows: [
      { id: 'r1', scope: 1, fk: 'gas', qty: 12000, note: '锅炉与食堂天然气' },
      { id: 'r2', scope: 1, fk: 'gasoline', qty: 2000, note: '公务车汽油' },
      { id: 'r3', scope: 1, fk: 'diesel', qty: 1500, note: '厂内叉车与货车' },
      { id: 'r4', scope: 2, fk: 'elec', qty: 1200000, note: '外购电力（生产+办公）' },
      { id: 'r5', scope: 3, fk: 'commute', qty: 1500000, note: '员工通勤 300 人 × 20 km × 250 工作日' },
      { id: 'r6', scope: 3, fk: 'freight', qty: 200000, note: '上游原材料公路运输' },
      { id: 'r7', scope: 3, fk: 'flight', qty: 60000, note: '差旅航空' },
      { id: 'r8', scope: 3, fk: 'paper', qty: 20000, note: '办公用纸' }
    ]
  };

  function enterpriseRows(rows) {
    var list = (rows || []).map(function (r) {
      var f = MAP[r.fk] || { v: 0, name: r.fk || '自定义', unit: '-' };
      var kg = num(r.qty) * f.v;
      return {
        id: r.id, scope: r.scope, fk: r.fk, qty: num(r.qty), note: r.note || '',
        name: f.name, unit: f.unit, factor: f.v, kg: kg, t: kg / 1000
      };
    });
    return list;
  }

  function enterpriseSummary(model) {
    var m = model || ENTERPRISE_DEFAULT;
    var list = enterpriseRows(m.rows);
    var total = 0, byScope = { 1: 0, 2: 0, 3: 0 };
    list.forEach(function (r) {
      total += r.t;
      byScope[r.scope] = (byScope[r.scope] || 0) + r.t;
    });

    var output = num(m.output);
    var intensity = output > 0 ? total / output : 0;

    var sector = null;
    for (var i = 0; i < F.SECTORS.length; i++) if (F.SECTORS[i].k === m.sector) sector = F.SECTORS[i];
    var bench = sector ? sector.v : 0;
    var freeQuota = output * bench;
    var gap = total - freeQuota;

    var sorted = list.slice().sort(function (a, b) { return b.t - a.t; });
    var acc = 0;
    var pareto = sorted.map(function (r) {
      acc += r.t;
      return { name: r.name, note: r.note, t: r.t, share: total > 0 ? r.t / total : 0, cum: total > 0 ? acc / total : 0 };
    });

    var perCapita = num(m.employees) > 0 ? total * 1000 / num(m.employees) : 0;

    return {
      rows: list, total: total, byScope: byScope,
      output: output, intensity: intensity,
      sector: sector, benchmark: bench, freeQuota: freeQuota, gap: gap,
      ratio: bench > 0 ? intensity / bench : 0,
      pareto: pareto, perCapita: perCapita,
      emissionLevel: intensity === 0 ? 'none' : (intensity <= bench * 0.85 ? 'low' : (intensity <= bench * 1.1 ? 'mid' : 'high'))
    };
  }

  /* ---------------- 积分 / 兑换 ---------------- */

  function pointsFromCarbonKg(kg) {
    return Math.max(0, Math.round(num(kg) * F.POINTS.perKg));
  }

  function redeemPlan(points, items) {
    var left = Math.max(0, Math.round(num(points)));
    var list = (items || F.POINTS.items).map(function (it) {
      var count = it.cost > 0 ? Math.floor(left / it.cost) : 0;
      left -= count * it.cost;
      return {
        k: it.k, name: it.name, cost: it.cost, kind: it.kind,
        count: count, spent: count * it.cost,
        credit: it.kind === 'carbon' ? count * (it.credit || 0) : 0,
        note: it.note
      };
    });
    var spent = list.reduce(function (s, x) { return s + x.spent; }, 0);
    var credit = list.reduce(function (s, x) { return s + x.credit; }, 0);
    var ocean = list.filter(function (x) { return x.k === 'ocean'; })
      .reduce(function (s, x) { return s + x.count; }, 0);
    return { list: list, spent: spent, left: left, credit: credit, oceanKg: ocean };
  }

  /* ---------------- 图表数据 ---------------- */

  var SEASON = [0.92, 0.88, 0.9, 0.94, 0.98, 1.08, 1.14, 1.13, 1.02, 0.97, 1.0, 1.04];

  function monthlyTrend(monthlyKg) {
    var m = num(monthlyKg);
    return SEASON.map(function (w, i) {
      return { month: (i + 1) + '月', value: m * w, index: i };
    });
  }

  /* ---------------- 格式化 ---------------- */

  function fmt(n, d) {
    var v = typeof n === 'number' ? n : parseFloat(n);
    if (!isFinite(v)) v = 0;
    var digits = typeof d === 'number' ? d : 1;
    return v.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function fmtKg(kg) {
    var v = typeof kg === 'number' ? kg : parseFloat(kg);
    if (!isFinite(v)) v = 0;
    if (v >= 1000) return fmt(v / 1000, 2) + ' t';
    return fmt(v, v < 10 ? 2 : 0) + ' kg';
  }
  function fmtPct(x, d) { return fmt(num(x) * 100, typeof d === 'number' ? d : 1) + '%'; }

  var API = {
    PERSONAL_DEFAULT: PERSONAL_DEFAULT,
    ENTERPRISE_DEFAULT: ENTERPRISE_DEFAULT,
    FOOD_KEYS: FOOD_KEYS, HOME_KEYS: HOME_KEYS, TRAVEL_KEYS: TRAVEL_KEYS, GOODS_KEYS: GOODS_KEYS,
    personalEmission: personalEmission,
    personalBenchmark: personalBenchmark,
    suggestions: suggestions,
    suggestionsTotal: suggestionsTotal,
    enterpriseRows: enterpriseRows,
    enterpriseSummary: enterpriseSummary,
    pointsFromCarbonKg: pointsFromCarbonKg,
    redeemPlan: redeemPlan,
    monthlyTrend: monthlyTrend,
    fmt: fmt, fmtKg: fmtKg, fmtPct: fmtPct,
    clone: clone, num: num
  };

  global.CS = global.CS || {};
  global.CS.calc = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
