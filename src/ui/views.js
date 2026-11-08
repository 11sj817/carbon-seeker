/* 视图层：每个视图都是纯函数 (state) -> HTML 字符串。
   交互由 ui/app.js 通过事件委托完成，视图本身不绑定事件。 */
(function (global) {
  'use strict';

  var C = global.CS.charts;
  var K = global.CS.calc;
  var P = global.CS.project;
  var F = global.CS.factors;
  var esc = C.esc;
  /* 骑行/步行没有独立排放因子（直接排放按 0 计，减排另计抵扣），这里给出展示用元数据 */
  var ACTIVE = { name: '骑行 / 步行', unit: '人·km', v: 0 };
  function meta(k) { return F.map[k] || ACTIVE; }

  /* ---------------- 通用小部件 ---------------- */

  function kpi(label, value, unit, delta, cls) {
    return '<div class="kpi ' + (cls || '') + '">' +
      '<div class="k">' + esc(label) + '</div>' +
      '<div class="v">' + esc(value) + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</div>' +
      (delta ? '<div class="d">' + esc(delta) + '</div>' : '') +
      '</div>';
  }

  function field(path, label, value, unit, opts) {
    var o = opts || {};
    return '<div class="field">' +
      '<label for="f-' + esc(path) + '"><span>' + esc(label) + '</span><b>' + esc(unit || '') + '</b></label>' +
      '<input id="f-' + esc(path) + '" type="number" inputmode="decimal" min="' + (o.min != null ? o.min : 0) + '"' +
      ' step="' + (o.step || 1) + '" value="' + esc(value) + '" data-bind="' + esc(path) + '"' +
      ' title="' + esc(o.title || label) + '">' +
      '</div>';
  }

  function pageHead(eyebrow, title, desc, actions) {
    return '<header class="page-head">' +
      '<div><div class="eyebrow">' + esc(eyebrow) + '</div>' +
      '<h2>' + title + '</h2>' +
      '<p>' + desc + '</p></div>' +
      (actions ? '<div class="page-actions">' + actions + '</div>' : '') +
      '</header>';
  }

  function bar(pct, color) {
    var w = Math.max(0, Math.min(100, pct * 100));
    return '<div class="bar"><i style="width:' + w.toFixed(1) + '%' + (color ? ';background:' + color : '') + '"></i></div>';
  }

  function table(headers, rows, opts) {
    var o = opts || {};
    return '<div class="table-wrap"><table' + (o.plain ? ' class="plain"' : '') + '>' +
      '<thead><tr>' + headers.map(function (h) {
        return '<th' + (h.num ? ' class="num"' : '') + '>' + esc(h.label != null ? h.label : h) + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows + '</tbody>' +
      (o.foot ? '<tfoot>' + o.foot + '</tfoot>' : '') +
      '</table></div>';
  }

  /* ---------------- 概览 ---------------- */

  function overview(state) {
    var em = K.personalEmission(state.personal);
    var sug = K.suggestions(state.personal, em);
    var ent = K.enterpriseSummary(state.enterprise);
    var bench = K.personalBenchmark(em.annual);
    var potential = K.suggestionsTotal(sug);

    var kpis = '<section class="kpis">' +
      kpi('个人年排放', K.fmt(em.annual / 1000, 2), 'tCO₂e', '参照基准 ' + K.fmt(bench.benchmark / 1000, 1) + ' t', 'hl') +
      kpi('示例企业年排放', K.fmt(ent.total, 0), 'tCO₂e', '强度 ' + K.fmt(ent.intensity, 3) + ' t/万元') +
      kpi('可挖掘减碳潜力', K.fmt(potential / 1000, 2), 'tCO₂e/年', '来自 ' + sug.length + ' 条可执行建议') +
      kpi('绿色积分（可兑现）', K.fmt(K.pointsFromCarbonKg(potential), 0), '分', '1 kg 减排 = 10 分') +
      '</section>';

    var hero = '<div class="card pad-lg accent">' +
      '<div class="eyebrow">参照 DAC Workbench 的证据式工作台结构 · 全部计算在本机浏览器完成</div>' +
      '<h2 style="font-size:26px;line-height:1.35;letter-spacing:-.5px;margin:9px 0 10px">把“排了多少碳”变成一笔算得清、换得掉的账。</h2>' +
      '<p class="lead">' + esc(P.meta.oneLine) + '</p>' +
      '<div class="hero-actions">' +
      '<button class="btn primary" data-go="personal">开始记录个人碳足迹</button>' +
      '<button class="btn" data-go="enterprise">打开企业碳账本</button>' +
      '<button class="btn" data-go="points">看绿色积分怎么用</button>' +
      '</div>' +
      '<div class="note" style="margin-top:16px">本站是<b>项目展示 + 可操作演示</b>：排放因子、公式与来源全部公开在「数据与方法」页；' +
      '计算不联网、不上传，所有输入只保存在你自己的浏览器里。</div>' +
      '</div>';

    var tiles = '<div class="tiles">' +
      tile('personal', '个人碳足迹', '衣食住行逐项录入，实时给出月/年排放、结构占比与可执行减排清单。', 'M4 7h16M4 12h16M4 17h10') +
      tile('enterprise', '企业碳账本', '按 Scope 1/2/3 填报，自动算强度、配额缺口与行业对标。', 'M3 21h18M6 21V9m6 12V4m6 17v-7') +
      tile('points', '绿色积分', '减排量折积分，可兑螺旋藻、海洋垃圾清理、旧物循环与合作林场。', 'M12 3l2.6 6.1 6.4.6-4.8 4.3 1.4 6.2L12 17l-5.6 3.2 1.4-6.2L3 9.7l6.4-.6z') +
      tile('dashboard', '数据看板', '把个人与企业两侧的排放、强度、趋势放在同一屏比较。', 'M4 19V5m0 14h16M8 15l3-4 3 2 4-6') +
      tile('project', '项目资料', '政策、市场、痛点、商业模式、财务与规划，一页读完计划书核心。', 'M6 3h9l4 4v14H6zM15 3v5h5') +
      tile('team', '团队与成果', '9 名学生、4 位导师、7 家合作企业，以及省赛铜奖的来路。', 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z') +
      tile('economics', '推广测算', '每减一吨碳要花多少钱推出去？算清获客、留存与每吨成本，再和碳价对照。', 'M3 17l5-6 4 3 5-7 4 4M3 21h18M7 21v-4m5 4v-2m4 2v-6') +
      tile('research', '关联研究', '大创结题报告：TAM+SEM 解释“为什么愿意用”，四条元宇宙实现路径。', 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 3v3m0 12v3M3 12h3m12 0h3') +
      '</div>';

    var pains = '<div class="card"><h3>项目要解决的三个问题 <span class="sub">计划书 3.3 / PPT 第 5 页</span></h3>' +
      '<div class="tiles">' + P.pains.map(function (p) {
        return '<div class="tile" style="cursor:default">' +
          '<h4>' + esc(p.t) + '</h4>' +
          '<p style="margin-bottom:8px">' + esc(p.d) + '</p>' +
          '<div class="pill block acc">' + esc(p.fix) + '</div></div>';
      }).join('') + '</div></div>';

    var tl = '<div class="card"><h3>政策与舆论时间轴 <span class="sub">计划书表 3-1</span></h3>' +
      '<ul class="timeline">' + P.timeline.map(function (x) {
        return '<li><b>' + esc(x.t) + '</b>' + esc(x.d) + '</li>';
      }).join('') + '</ul></div>';

    var market = '<div class="card"><h3>碳市场底色 <span class="sub">计划书 3.2</span></h3>' +
      table([{ label: '口径' }, { label: '累计成交额', num: true }, { label: '累计成交量', num: true }],
        P.market.rows.map(function (r) {
          return '<tr><td>' + esc(r.name) + '</td><td class="num">' + esc(r.amount) + '</td><td class="num">' + esc(r.volume) + '</td></tr>';
        }).join('')) +
      '<div class="grid two" style="margin-top:14px">' +
      '<ul class="small muted" style="margin:0;padding-left:18px;line-height:2">' +
      P.market.facts.slice(0, 2).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
      '<ul class="small muted" style="margin:0;padding-left:18px;line-height:2">' +
      P.market.facts.slice(2).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
      '</div></div>';

    var snapshot = '<div class="card"><h3>当前测算快照 <span class="sub">参数来自左侧两个模块，可随时改动</span></h3>' +
      '<div class="grid two" style="align-items:center;gap:10px">' +
      '<div>' + C.donut([
        { label: '食物', value: em.groups.food, color: 'var(--c1)' },
        { label: '居住', value: em.groups.home, color: 'var(--c2)' },
        { label: '出行', value: em.groups.travel, color: 'var(--c3)' },
        { label: '用品', value: em.groups.goods, color: 'var(--c4)' }
      ], { size: 176, thickness: 22, centerValue: K.fmt(em.monthly, 0), centerLabel: 'kgCO₂e / 月', aria: '个人排放构成快照' }) +
      C.legend([
        { label: '食物', color: 'var(--c1)' }, { label: '居住', color: 'var(--c2)' },
        { label: '出行', color: 'var(--c3)' }, { label: '用品', color: 'var(--c4)' }
      ]) + '</div>' +
      '<div>' + sug.slice(0, 3).map(function (x) {
        return '<div class="sugg" style="grid-template-columns:22px minmax(0,1fr) auto">' +
          '<div class="n">' + x.rank + '</div>' +
          '<div><div class="t">' + esc(x.title) + '</div><div class="m">' + esc(x.detail) + '</div></div>' +
          '<div class="v">−' + K.fmt(x.save, 0) + ' kg<small>/年</small></div></div>';
      }).join('') +
      '<button class="btn mini" data-go="personal" style="margin-top:4px">查看全部 ' + sug.length + ' 条建议 →</button>' +
      '</div></div></div>';

    return pageHead('CARBON SEEKER · 项目展示站',
      '碳寻 · 企业碳减排管理的碳应用平台',
      '个人记录碳足迹、企业建立碳账本、平台提供碳咨询与人才培养 —— 三个角色共用一套积分与数据口径。',
      '<button class="btn" data-go="method">数据与方法</button>' +
      '<button class="btn primary" data-act="export-md">导出当前测算</button>') +
      kpis + hero + snapshot + '<div class="card"><h3>八个入口 <span class="sub">五个能算的 + 三个能读的</span></h3>' + tiles + '</div>' +
      '<div class="grid two" style="align-items:start">' + pains + tl + '</div>' + market;
  }

  function tile(view, title, desc, path) {
    return '<button class="tile" data-go="' + esc(view) + '">' +
      '<span class="k"><svg viewBox="0 0 24 24"><path d="' + esc(path) + '"/></svg></span>' +
      '<h4>' + esc(title) + '</h4><p>' + esc(desc) + '</p></button>';
  }

  /* ---------------- 个人碳足迹 ---------------- */

  var FOOD_LABEL = {
    beef: '牛肉', pork: '猪肉', poultry: '禽肉', fish: '水产', egg: '蛋类', dairy: '奶及奶制品',
    rice: '米面主食', wheat: '小麦制品', veg: '蔬菜', fruit: '水果', meal: '外出就餐'
  };
  var HOME_LABEL = { elec: '用电', gas: '天然气', water: '自来水', heat: '集中供热' };
  var TRAVEL_LABEL = { car: '汽油私家车', bus: '公共汽车', metro: '地铁 / 轻轨', rail: '高铁 / 普速', flight: '国内航空', bike: '骑行 / 步行' };
  var GOODS_LABEL = { tshirt: '棉质 T 恤', pants: '长裤', coat: '外套', paper: 'A4 复印纸', bottle: 'PET 饮料瓶', bag: '塑料袋' };
  var GOODS_UNIT = { tshirt: '件/年', pants: '件/年', coat: '件/年', paper: '张/月', bottle: '个/月', bag: '个/月' };

  /* 明细表里用口语化名称，避免同一项在输入区叫“用电”、明细里叫“外购电力” */
  var NAME_MAP = (function () {
    var m = {};
    [FOOD_LABEL, HOME_LABEL, TRAVEL_LABEL, GOODS_LABEL].forEach(function (src) {
      Object.keys(src).forEach(function (k) { m[k] = src[k]; });
    });
    return m;
  })();

  function personal(state) {
    var s = state.personal;
    var em = K.personalEmission(s);
    var bench = K.personalBenchmark(em.annual);
    var sug = K.suggestions(s, em);
    var potential = K.suggestionsTotal(sug);

    var kpis = '<section class="kpis">' +
      kpi('月排放', K.fmt(em.monthly, 1), 'kgCO₂e', '含绿色出行抵扣 ' + K.fmt(em.activeSaving, 1) + ' kg', 'hl') +
      kpi('年排放', K.fmt(em.annual / 1000, 2), 'tCO₂e', '毛排放 ' + K.fmt(em.grossAnnual / 1000, 2) + ' t') +
      kpi('对比基准', (bench.ratio * 100).toFixed(0) + '%', '基准值', (bench.delta >= 0 ? '高出 ' : '低于 ') + K.fmt(Math.abs(bench.delta) / 1000, 2) + ' t') +
      kpi('可减碳潜力', K.fmt(potential / 1000, 2), 'tCO₂e/年', '落地后约减 ' + K.fmt(Math.min(99, potential / Math.max(1, em.annual) * 100), 0) + '%') +
      '</section>';

    var foodCard = '<div class="card accent"><h3>① 食物 <span class="sub">每月用量</span></h3>' +
      '<div class="row-inline">' + K.FOOD_KEYS.map(function (k) {
        return field('personal.food.' + k, FOOD_LABEL[k] || meta(k).name, s.food[k], 'kg/月',
          { step: 0.5, title: meta(k).name + ' ' + meta(k).v + ' kgCO₂e/' + meta(k).unit });
      }).join('') + '</div></div>';

    var homeCard = '<div class="card"><h3>② 居住 <span class="sub">每月用量</span></h3>' +
      '<div class="row-inline">' + K.HOME_KEYS.map(function (k) {
        return field('personal.home.' + k, HOME_LABEL[k] || meta(k).name, s.home[k], meta(k).unit + '/月',
          { step: k === 'heat' ? 0.1 : 1, title: meta(k).name + ' ' + meta(k).v + ' kgCO₂e/' + meta(k).unit });
      }).join('') + '</div></div>';

    var travelCard = '<div class="card"><h3>③ 出行 <span class="sub">每月里程</span></h3>' +
      '<div class="row-inline">' + K.TRAVEL_KEYS.concat(['bike']).map(function (k) {
        return field('personal.travel.' + k, TRAVEL_LABEL[k] || meta(k).name, s.travel[k], 'km/月',
          { step: 10, title: meta(k).name + ' ' + meta(k).v + ' kgCO₂e/' + meta(k).unit });
      }).join('') + '</div>' +
      '<div class="note" style="margin-top:4px">骑行 / 步行按替代小汽车 0.17 kgCO₂/km 计入抵扣，不产生负排放。</div></div>';

    var goodsCard = '<div class="card"><h3>④ 用品 <span class="sub">衣物按年、耗材按月</span></h3>' +
      '<div class="row-inline">' + K.GOODS_KEYS.map(function (k) {
        return field('personal.goods.' + k, GOODS_LABEL[k] || meta(k).name, s.goods[k], GOODS_UNIT[k] || (meta(k).unit + '/月'),
          { step: k === 'coat' ? 0.1 : 1, title: meta(k).name + ' ' + meta(k).v + ' kgCO₂e/' + meta(k).unit });
      }).join('') + '</div>' +
      '<div class="page-actions" style="margin-top:6px">' +
      '<button class="btn mini" data-act="personal-reset">恢复示例值</button>' +
      '<button class="btn mini" data-act="personal-zero">全部清零</button>' +
      '</div></div>';

    var groups = [
      { k: 'food', label: '食物', v: em.groups.food, color: 'var(--c1)' },
      { k: 'home', label: '居住', v: em.groups.home, color: 'var(--c2)' },
      { k: 'travel', label: '出行', v: em.groups.travel, color: 'var(--c3)' },
      { k: 'goods', label: '用品', v: em.groups.goods, color: 'var(--c4)' }
    ];

    var donut = C.donut(groups.map(function (g) { return { label: g.label, value: g.v, color: g.color }; }),
      { size: 190, thickness: 24, centerValue: K.fmt(em.monthly, 0), centerLabel: 'kgCO₂e / 月', aria: '个人排放构成' });

    var breakdown = groups.map(function (g) {
      var pct = em.grossMonthly > 0 ? g.v / em.grossMonthly : 0;
      return '<div style="margin-bottom:11px">' +
        '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">' +
        '<span>' + esc(g.label) + '</span>' +
        '<span class="mono">' + K.fmt(g.v, 1) + ' kg · ' + (pct * 100).toFixed(0) + '%</span></div>' +
        bar(pct, g.color) + '</div>';
    }).join('');

    var compose = '<div class="card"><h3>排放构成 <span class="sub">每月 kgCO₂e</span></h3>' +
      '<div class="grid two" style="align-items:center;gap:8px">' +
      '<div>' + donut + '</div><div>' + breakdown + '</div></div>' +
      '<div class="note" style="margin-top:6px">毛排放 ' + K.fmt(em.grossMonthly, 1) + ' kg − 绿色出行抵扣 ' +
      K.fmt(em.activeSaving, 1) + ' kg = <b>' + K.fmt(em.monthly, 1) + ' kg/月</b>。</div></div>';

    var trendCard = '<div class="card"><h3>月度趋势 <span class="sub">按季节系数还原的演示曲线</span></h3>' +
      C.trend(K.monthlyTrend(em.monthly), { height: 190, unit: ' kg' }) +
      '<div class="note" style="margin-top:6px">季节系数取 0.88–1.14（夏冬季用电与出行偏高），用于展示波动，' +
      '不代表真实月度计量；真实项目需按电表与出行账单逐月核算。</div></div>';

    var topRows = em.topItems.length ? em.topItems.map(function (it) {
      return '<tr><td>' + esc(NAME_MAP[it.k] || it.name) + '</td><td class="num">' + K.fmt(it.qty, 1) + '</td><td>' + esc(it.unit) + '</td>' +
        '<td class="num">' + K.fmt(it.kg, 1) + '</td><td class="num">' + ((it.kg / Math.max(1, em.grossMonthly)) * 100).toFixed(1) + '%</td></tr>';
    }).join('') : '<tr><td colspan="5" class="muted">还没有排放项，先在上面填几个数。</td></tr>';

    var top = '<div class="card"><h3>排放明细 Top 5 <span class="sub">按贡献排序</span></h3>' +
      table([{ label: '项目' }, { label: '用量', num: true }, { label: '单位' }, { label: 'kgCO₂e/月', num: true }, { label: '占比', num: true }], topRows) +
      '</div>';

    var suggList = sug.slice(0, 6).map(function (x) {
      return '<div class="sugg"><div class="n">' + x.rank + '</div>' +
        '<div><div class="t">' + esc(x.title) + ' <span class="pill">' + esc(x.level) + '</span></div>' +
        '<div class="m">' + esc(x.detail) + '</div></div>' +
        '<div class="v">−' + K.fmt(x.save, 0) + ' kg<small>/年 · ' + K.fmt(x.points, 0) + ' 分</small></div></div>';
    }).join('');

    var suggCard = '<div class="card"><h3>减排建议 <span class="sub">按当前输入实算，不写死结论</span></h3>' +
      (suggList || '<div class="muted small">填入用量后这里会出现按可减量排序的建议。</div>') +
      '<div class="note" style="margin-top:6px">全部建议落地合计约 <b>' + K.fmt(potential, 0) + ' kgCO₂e/年</b>，' +
      '相当于基准值的 ' + ((potential / Math.max(1, bench.benchmark)) * 100).toFixed(0) + '%。</div></div>';

    var pointsCard = '<div class="card"><h3>绿色积分 <span class="sub">1 kg 减排 = 10 分</span></h3>' +
      '<div class="grid two" style="gap:12px">' +
      '<div><div class="kpi hl" style="margin:0"><div class="k">按建议全部落地可获积分</div>' +
      '<div class="v">' + K.fmt(K.pointsFromCarbonKg(potential), 0) + '<small>分</small></div>' +
      '<div class="d">' + K.fmt(potential, 0) + ' kgCO₂e/年 减排量</div></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn primary" data-go="points">去兑换</button>' +
      '<button class="btn" data-act="export-json">导出 JSON</button>' +
      '<button class="btn" data-act="export-md">导出 Markdown 报告</button>' +
      '</div></div></div>';

    return pageHead('个人模块 · 碳足迹记录',
      '衣食住行逐项算，一个月多少碳',
      '四类输入全部按自然单位录入（kg、kWh、m³、km、件），右侧结果随输入实时更新；每个因子都能在「数据与方法」里查到出处。',
      '<button class="btn" data-act="export-json">导出 JSON</button>' +
      '<button class="btn primary" data-act="export-md">导出报告</button>') +
      kpis +
      '<div class="grid side">' +
      '<div>' + foodCard + homeCard + travelCard + goodsCard + '</div>' +
      '<div>' + compose + trendCard + top + suggCard + pointsCard + '</div>' +
      '</div>';
  }

  /* ---------------- 企业碳账本 ---------------- */

  function factorOptions(selected) {
    var groups = {};
    F.FACTORS.forEach(function (f) { (groups[f.g] = groups[f.g] || []).push(f); });
    return Object.keys(groups).map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (f) {
        return '<option value="' + esc(f.k) + '"' + (f.k === selected ? ' selected' : '') + '>' +
          esc(f.name) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }

  function enterprise(state) {
    var m = state.enterprise;
    var sum = K.enterpriseSummary(m);

    var kpis = '<section class="kpis">' +
      kpi('排放总量', K.fmt(sum.total, 1), 'tCO₂e', m.rows.length + ' 条排放源', 'hl') +
      kpi('排放强度', K.fmt(sum.intensity, 3), 't/万元', '产值 ' + K.fmt(sum.output, 0) + ' 万元') +
      kpi('行业对标', sum.benchmark > 0 ? (sum.ratio * 100).toFixed(0) + '%' : '—', sum.sector ? sum.sector.name : '未选行业',
        sum.benchmark > 0 ? (sum.ratio <= 1 ? '优于基准 ' : '高于基准 ') + K.fmt(Math.abs(sum.intensity - sum.benchmark), 3) : '') +
      kpi(sum.gap > 0 ? '配额缺口' : '配额盈余', K.fmt(Math.abs(sum.gap), 1), 'tCO₂e', '免费配额 ' + K.fmt(sum.freeQuota, 1) + ' t') +
      '</section>';

    var info = '<div class="card accent"><h3>企业基本信息</h3>' +
      '<div class="field"><label for="entName"><span>企业名称</span><b>展示用</b></label>' +
      '<input id="entName" type="text" value="' + esc(m.name) + '" data-bind="enterprise.name"></div>' +
      '<div class="row-inline">' +
      field('enterprise.output', '年产值', m.output, '万元', { step: 100 }) +
      field('enterprise.employees', '员工人数', m.employees, '人', { step: 10 }) +
      '</div>' +
      '<div class="field"><label for="entSector"><span>所属行业</span><b>强度基准</b></label>' +
      '<select id="entSector" data-bind="enterprise.sector">' + F.SECTORS.map(function (s) {
        return '<option value="' + esc(s.k) + '"' + (s.k === m.sector ? ' selected' : '') + '>' +
          esc(s.name + '（' + s.v + ' t/万元）') + '</option>';
      }).join('') + '</select></div>' +
      '<button class="btn mini" data-act="enterprise-reset">恢复示例企业</button>' +
      '</div>';

    var scopeName = { 1: 'Scope 1', 2: 'Scope 2', 3: 'Scope 3' };
    var rows = m.rows.map(function (r) {
      var f = F.map[r.fk] || { v: 0, unit: '-', name: '-' };
      var t = (parseFloat(r.qty) || 0) * f.v / 1000;
      return '<tr>' +
        '<td><select data-row="' + esc(r.id) + '" data-field="scope" aria-label="排放范围">' +
        [1, 2, 3].map(function (n) {
          return '<option value="' + n + '"' + (Number(r.scope) === n ? ' selected' : '') + '>' + scopeName[n] + '</option>';
        }).join('') + '</select></td>' +
        '<td><select data-row="' + esc(r.id) + '" data-field="fk" aria-label="排放源">' + factorOptions(r.fk) + '</select></td>' +
        '<td class="num"><input type="number" min="0" step="1" value="' + esc(r.qty) + '" data-row="' + esc(r.id) + '" data-field="qty" style="width:118px" aria-label="用量"></td>' +
        '<td>' + esc(f.unit) + '</td>' +
        '<td class="num">' + K.fmt(f.v, f.v >= 100 ? 0 : 3) + '</td>' +
        '<td class="num"><b>' + K.fmt(t, 2) + '</b></td>' +
        '<td><input type="text" value="' + esc(r.note || '') + '" data-row="' + esc(r.id) + '" data-field="note" style="min-width:150px" aria-label="备注"></td>' +
        '<td><button class="btn mini danger" data-del="' + esc(r.id) + '" aria-label="删除该行">×</button></td>' +
        '</tr>';
    }).join('');

    var foot = '<tr><td colspan="5">合计</td><td class="num">' + K.fmt(sum.total, 2) + ' t</td><td colspan="2" class="muted">' +
      'S1 ' + K.fmt(sum.byScope[1] || 0, 1) + ' · S2 ' + K.fmt(sum.byScope[2] || 0, 1) + ' · S3 ' + K.fmt(sum.byScope[3] || 0, 1) + '</td></tr>';

    var ledger = '<div class="card"><h3>碳账本 <span class="sub">按 Scope 1 / 2 / 3 填报，单位自适应</span>' +
      '<button class="btn mini" data-act="row-add" style="margin-left:auto">+ 新增排放源</button></h3>' +
      table([
        { label: '范围' }, { label: '排放源' }, { label: '用量', num: true }, { label: '单位' },
        { label: '因子', num: true }, { label: 'tCO₂e', num: true }, { label: '备注' }, { label: '' }
      ], rows, { foot: foot }) +
      '<div class="note" style="margin-top:10px">Scope 1 = 自有燃烧与逸散；Scope 2 = 外购电与热；Scope 3 = 通勤、货运、差旅、办公等价值链排放。' +
      '因子列显示当前换算系数（kgCO₂e / 单位），改排放源会自动换单位。</div></div>';

    var scopeItems = [
      { label: 'Scope 1 直接排放', value: sum.byScope[1] || 0, color: 'var(--c3)' },
      { label: 'Scope 2 外购能源', value: sum.byScope[2] || 0, color: 'var(--c1)' },
      { label: 'Scope 3 价值链', value: sum.byScope[3] || 0, color: 'var(--c2)' }
    ];

    var scopeCard = '<div class="card"><h3>排放范围构成</h3>' +
      C.donut(scopeItems, { size: 190, thickness: 24, centerValue: K.fmt(sum.total, 0), centerLabel: 'tCO₂e / 年', aria: '企业排放范围构成' }) +
      '<div style="margin-top:10px">' + scopeItems.map(function (it) {
        var pct = sum.total > 0 ? it.value / sum.total : 0;
        return '<div style="margin-bottom:11px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;margin-bottom:4px">' +
          '<span>' + esc(it.label) + '</span><span class="mono">' + K.fmt(it.value, 1) + ' t · ' + (pct * 100).toFixed(0) + '%</span></div>' +
          bar(pct, it.color) + '</div>';
      }).join('') + '</div>' +
      '<div class="note">人均排放 ' + K.fmt(sum.perCapita / 1000, 2) + ' tCO₂e/人·年（' + K.fmt(m.employees, 0) + ' 人）。</div></div>';

    var benchItems = [{ label: '本企业', value: sum.intensity, color: 'var(--c1)', marker: sum.intensity }].concat(
      F.SECTORS.map(function (s) { return { label: s.name, value: s.v, color: 'var(--c4)', marker: sum.intensity }; })
    );

    var benchCard = '<div class="card"><h3>行业强度对标 <span class="sub">虚线 = 本企业强度</span></h3>' +
      C.hbars(benchItems, { unit: ' t/万元', labelWidth: 128, rowH: 30, aria: '行业碳强度对标' }) +
      '<div class="note" style="margin-top:8px">行业强度为示意值，用于同一口径下的相对比较；正式披露应采用生态环境部发布的行业核算指南与基准值。</div></div>';

    var paretoCard = '<div class="card"><h3>排放源帕累托 <span class="sub">找出前 3 个该先动的口子</span></h3>' +
      (sum.pareto.length ? C.hbars(sum.pareto.map(function (p, i) {
        return { label: p.name, value: p.t, color: i === 0 ? 'var(--c1)' : (i < 3 ? 'var(--c2)' : 'var(--c4)') };
      }), { unit: ' t', labelWidth: 156, rowH: 28 }) : '<div class="muted small">还没有排放源。</div>') +
      (sum.pareto.length ? table([{ label: '排名' }, { label: '排放源' }, { label: 'tCO₂e', num: true }, { label: '占比', num: true }, { label: '累计', num: true }],
        sum.pareto.slice(0, 6).map(function (p, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.name) + (p.note ? ' <span class="muted small">' + esc(p.note) + '</span>' : '') + '</td>' +
            '<td class="num">' + K.fmt(p.t, 2) + '</td><td class="num">' + (p.share * 100).toFixed(1) + '%</td>' +
            '<td class="num">' + (p.cum * 100).toFixed(1) + '%</td></tr>';
        }).join(''), { plain: true }) : '') +
      '</div>';

    return pageHead('企业模块 · 碳账本',
      '一家企业的碳账本长什么样',
      '按排放源逐行填报，自动汇总 Scope 占比、产值强度、行业对标与配额缺口；示例企业为机械制造，可按自己的行业替换。',
      '<button class="btn" data-act="export-csv">导出 CSV</button>' +
      '<button class="btn primary" data-act="export-md">导出报告</button>') +
      kpis +
      '<div class="grid split">' +
      '<div>' + info + scopeCard + '</div>' +
      '<div>' + ledger + '</div>' +
      '</div>' +
      '<div class="grid two" style="align-items:start">' + benchCard + paretoCard + '</div>';
  }

  /* ---------------- 绿色积分 ---------------- */

  function points(state) {
    var em = K.personalEmission(state.personal);
    var sug = K.suggestions(state.personal, em);
    var potential = K.suggestionsTotal(sug);
    var auto = K.pointsFromCarbonKg(potential);
    var balance = state.points == null ? auto : Math.max(0, Math.round(Number(state.points) || 0));
    var plan = K.redeemPlan(balance, F.POINTS.items);

    var kpis = '<section class="kpis">' +
      kpi('可用积分', K.fmt(balance, 0), '分', state.points == null ? '来自个人页的减排潜力' : '手动设定', 'hl') +
      kpi('折算减排量', K.fmt(balance / F.POINTS.perKg, 1), 'kgCO₂e', '1 kg = 10 分') +
      kpi('兑换固碳量', K.fmt(plan.credit, 2), 'kgCO₂e', '螺旋藻 / 旧物 / 林木合计') +
      kpi('生态贡献', K.fmt(plan.oceanKg, 0), 'kg 海洋垃圾', '计生态量，不折碳') +
      '</section>';

    var ruleCard = '<div class="card accent"><h3>积分怎么来、怎么用</h3>' +
      '<ol class="small muted" style="margin:0 0 12px;padding-left:18px;line-height:2.1">' +
      '<li>签到、微信步数同步、观看广告获得基础积分。</li>' +
      '<li>减碳行为按 <b>1 kg 减排 = 10 分</b> 折算，由平台核算后排碳量。</li>' +
      '<li>积分可兑换螺旋藻制品、海洋垃圾清理、旧物循环与合作林场。</li>' +
      '<li>企业侧积分可计入员工绩效考核，助力碳中和企业认证。</li>' +
      '</ol>' +
      '<div class="field"><label for="pts"><span>手动设定积分（留空 = 用个人页测算值 ' + K.fmt(auto, 0) + '）</span><b>分</b></label>' +
      '<input id="pts" type="number" min="0" step="100" value="' + (state.points == null ? '' : esc(state.points)) + '" data-bind="points" placeholder="' + K.fmt(auto, 0) + '"></div>' +
      '<div class="page-actions">' +
      '<button class="btn mini" data-act="points-auto">用测算值</button>' +
      '<button class="btn mini" data-go="personal">去减少排放</button>' +
      '</div></div>';

    var itemsCard = '<div class="card"><h3>可兑换物 <span class="sub">按当前积分计算可换数量</span></h3>' +
      plan.list.map(function (it) {
        var pct = it.cost > 0 ? Math.min(1, balance / it.cost) : 0;
        return '<div class="sugg" style="grid-template-columns:minmax(0,1fr) auto;align-items:center">' +
          '<div><div class="t">' + esc(it.name) + ' <span class="pill ' + (it.count > 0 ? 'ok' : '') + '">' +
          (it.count > 0 ? '可换 ' + it.count + ' 份' : '差 ' + K.fmt(it.cost - balance, 0) + ' 分') + '</span></div>' +
          '<div class="m">' + esc(it.note) + ' · ' + K.fmt(it.cost, 0) + ' 分/份</div>' +
          '<div style="margin-top:6px;max-width:320px">' + bar(pct) + '</div></div>' +
          '<div class="v">' + (it.kind === 'carbon' ? '−' + K.fmt(it.credit, 2) + ' kg CO₂e' : '生态贡献') +
          '<small>已换 ' + it.count + ' 份</small></div></div>';
      }).join('') + '</div>';

    var simRows = plan.list.map(function (it) {
      return '<tr><td>' + esc(it.name) + '</td><td class="num">' + K.fmt(it.cost, 0) + '</td>' +
        '<td class="num">' + it.count + '</td><td class="num">' + K.fmt(it.spent, 0) + '</td>' +
        '<td class="num">' + (it.kind === 'carbon' ? K.fmt(it.credit, 2) + ' kg' : '—') + '</td></tr>';
    }).join('');

    var simCard = '<div class="card"><h3>兑换模拟 <span class="sub">按“先贵后便宜”的贪心顺序</span></h3>' +
      table([{ label: '兑换物' }, { label: '单价', num: true }, { label: '份数', num: true }, { label: '消耗', num: true }, { label: '固碳', num: true }],
        simRows,
        { foot: '<tr><td>合计</td><td></td><td></td><td class="num">' + K.fmt(plan.spent, 0) + ' 分</td><td class="num">' + K.fmt(plan.credit, 2) + ' kg</td></tr>' }) +
      '<div class="note" style="margin-top:10px">剩余 <b>' + K.fmt(plan.left, 0) + ' 分</b>。兑换顺序可在正式产品中改为用户自选；' +
      '海洋垃圾清理属于生态服务，不折算碳减排，避免把两种量纲混在一起。</div></div>';

    return pageHead('个人模块 · 绿色积分',
      '减排量怎么变成能换东西的积分',
      '积分不是营销道具，而是减碳量的记账凭证：每一分都能追到一条减排记录、一个因子和一次兑换。',
      '<button class="btn" data-go="personal">回到碳足迹</button>' +
      '<button class="btn primary" data-act="export-md">导出报告</button>') +
      kpis +
      '<div class="grid two" style="align-items:start">' + ruleCard + itemsCard + '</div>' + simCard;
  }

  /* ---------------- 数据看板 ---------------- */

  function dashboard(state) {
    var em = K.personalEmission(state.personal);
    var ent = K.enterpriseSummary(state.enterprise);
    var sug = K.suggestions(state.personal, em);
    var potential = K.suggestionsTotal(sug);
    var bench = K.personalBenchmark(em.annual);

    var kpis = '<section class="kpis">' +
      kpi('个人年排放', K.fmt(em.annual / 1000, 2), 'tCO₂e', '基准 ' + K.fmt(bench.benchmark / 1000, 1) + ' t', 'hl') +
      kpi('企业年排放', K.fmt(ent.total, 0), 'tCO₂e', '强度 ' + K.fmt(ent.intensity, 3) + ' t/万元') +
      kpi('两侧合计', K.fmt(ent.total + em.annual / 1000, 1), 'tCO₂e', '企业与个人同口径相加') +
      kpi('减碳潜力', K.fmt(potential / 1000, 2), 'tCO₂e/年', '仅个人侧建议') +
      '</section>';

    var personalGroups = [
      { label: '食物', value: em.groups.food, color: 'var(--c1)' },
      { label: '居住', value: em.groups.home, color: 'var(--c2)' },
      { label: '出行', value: em.groups.travel, color: 'var(--c3)' },
      { label: '用品', value: em.groups.goods, color: 'var(--c4)' }
    ];
    var scopeData = [
      { label: 'Scope 1', value: ent.byScope[1] || 0, color: 'var(--c3)' },
      { label: 'Scope 2', value: ent.byScope[2] || 0, color: 'var(--c1)' },
      { label: 'Scope 3', value: ent.byScope[3] || 0, color: 'var(--c2)' }
    ];

    var cards = '<div class="grid two">' +
      '<div class="card"><h3>个人侧 · 排放结构</h3>' +
      C.donut(personalGroups, { size: 176, thickness: 22, centerValue: K.fmt(em.monthly, 0), centerLabel: 'kg / 月' }) +
      C.legend(personalGroups) + '</div>' +
      '<div class="card"><h3>企业侧 · 范围结构</h3>' +
      C.donut(scopeData, { size: 176, thickness: 22, centerValue: K.fmt(ent.total, 0), centerLabel: 't / 年' }) +
      C.legend(scopeData) + '</div>' +
      '</div>';

    var trendCard = '<div class="card"><h3>个人月度排放趋势 <span class="sub">kgCO₂e</span></h3>' +
      C.trend(K.monthlyTrend(em.monthly), { height: 200 }) + '</div>';

    var compRows = [
      { k: '统计边界', p: '个人生活消费', e: '企业前后台运营 + 价值链' },
      { k: '主要排放源', p: em.topItems.length ? em.topItems[0].name : '—', e: ent.pareto.length ? ent.pareto[0].name : '—' },
      { k: '总量', p: K.fmt(em.annual / 1000, 2) + ' t/年', e: K.fmt(ent.total, 1) + ' t/年' },
      { k: '强度指标', p: (bench.ratio * 100).toFixed(0) + '% 基准', e: K.fmt(ent.intensity, 3) + ' t/万元' },
      { k: '可操作口子', p: sug.length + ' 条建议', e: ent.pareto.length + ' 个排放源' }
    ];
    var compTable = '<div class="card"><h3>两侧口径对照</h3>' +
      table([{ label: '维度' }, { label: '个人侧' }, { label: '企业侧' }], compRows.map(function (r) {
        return '<tr><td>' + esc(r.k) + '</td><td>' + esc(r.p) + '</td><td>' + esc(r.e) + '</td></tr>';
      }).join('')) +
      '<div class="note warn" style="margin-top:10px">看板上的数据全部来自左侧两个模块当前参数，属于<b>演示测算</b>；' +
      '个人侧年度值 = 月值 × 12，未做季节积分。</div></div>';

    return pageHead('数据看板',
      '两侧放在一起看，才知道该先动哪里',
      '个人高在饮食与出行，企业高在外购电与通勤 —— 同一套因子、同一套口径，才能比较、才能排序。',
      '<button class="btn" data-go="personal">调整个人参数</button>' +
      '<button class="btn" data-go="enterprise">调整企业参数</button>') +
      kpis + cards + trendCard + compTable;
  }

  /* ---------------- 项目资料 ---------------- */

  function accordion(title, body, open, tag) {
    return '<details class="acc"' + (open ? ' open' : '') + '><summary>' + esc(title) +
      (tag ? '<span class="tag">' + esc(tag) + '</span>' : '') + '</summary><div class="acc-body">' + body + '</div></details>';
  }

  function project() {
    var pest = '<div class="grid two">' + P.pest.map(function (x) {
      return '<div class="card" style="margin:0"><h3><span class="pill acc">' + esc(x.k) + '</span>' + esc(x.name) + '因素</h3>' +
        '<ul class="small muted" style="margin:0;padding-left:18px;line-height:2">' +
        x.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';

    var marketBody = table([{ label: '口径' }, { label: '累计成交额', num: true }, { label: '累计成交量', num: true }],
      P.market.rows.map(function (r) {
        return '<tr><td>' + esc(r.name) + '</td><td class="num">' + esc(r.amount) + '</td><td class="num">' + esc(r.volume) + '</td></tr>';
      }).join('')) + '<ul class="small muted" style="padding-left:18px;line-height:2;margin-top:12px">' +
      P.market.facts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';

    var swot = '<div class="swot">' + ['s', 'w', 'o', 't'].map(function (k) {
      var g = P.swot[k];
      return '<section data-k="' + k + '"><h5><i></i>' + esc(g.name) + '</h5><ul>' +
        g.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></section>';
    }).join('') + '</div>';

    var products = '<div class="grid three">' + P.products.map(function (p) {
      return '<div class="card" style="margin:0"><h3>' + esc(p.name) + '</h3><ul class="small muted" style="margin:0;padding-left:16px;line-height:2">' +
        p.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';

    var revenue = table([{ label: '模式' }, { label: '特点' }, { label: '举例' }],
      P.revenue.rows.map(function (r) {
        return '<tr><td>' + esc(r.mode) + '</td><td>' + esc(r.feature) + '</td><td>' + esc(r.eg) + '</td></tr>';
      }).join('')) + '<p class="small muted" style="margin:10px 0 0">' + esc(P.revenue.detail) + '</p>';

    var stp = '<div class="grid three">' +
      stpTable('学历', P.stp.education) + stpTable('年龄', P.stp.age) + stpTable('城市', P.stp.city) +
      '</div><div class="note" style="margin-top:12px">样本 ' + P.stp.sample + ' 份。' + esc(P.stp.conclusion) + '</div>';

    var financeBody =
      '<div class="grid two" style="align-items:start">' +
      '<div><h4>资金使用明细（万元）</h4>' +
      table([{ label: '科目' }, { label: '金额', num: true }], P.finance.use.map(function (u) {
        return '<tr><td>' + esc(u.item) + '</td><td class="num">' + K.fmt(u.amount, 1) + '</td></tr>';
      }).join(''), { foot: '<tr><td>合计</td><td class="num">' + K.fmt(P.finance.useTotal, 1) + '</td></tr>' }) +
      '</div><div><h4>经营预测</h4>' +
      table([{ label: '年度' }, { label: '个人用户' }, { label: '个人收入', num: true }, { label: '企业数' }, { label: '企业收入', num: true }, { label: '合计', num: true }],
        P.finance.forecast.map(function (f) {
          return '<tr><td>' + esc(f.year) + '</td><td>' + esc(f.users) + '</td><td class="num">' + K.fmt(f.userRevenue, 2) + '</td>' +
            '<td>' + esc(f.firms) + '</td><td class="num">' + K.fmt(f.firmRevenue, 2) + '</td><td class="num"><b>' + K.fmt(f.total, 2) + '</b></td></tr>';
        }).join('')) +
      '<p class="small muted" style="margin:8px 0 0">单位：万元。三大报表（资产负债、利润、现金流）见计划书 8.2.3；' +
      '原表存在个别录入不一致，本站只引用可复核的汇总项。</p></div></div>' +
      '<div class="grid two" style="margin-top:14px;align-items:start">' +
      '<div><h4>股权结构</h4><div class="note">' + esc(P.finance.capital.note) + '</div>' +
      '<div style="margin-top:10px">' + bar(P.finance.capital.studentShare / 100, 'var(--c1)') + '</div>' +
      '<div class="small muted" style="margin-top:6px">学生团队 ' + P.finance.capital.student + ' 万元 · ' + P.finance.capital.studentShare + '%　|　' +
      '外部融资 ' + P.finance.capital.external + ' 万元 · ' + P.finance.capital.externalShare + '%</div></div>' +
      '<div><h4>融资计划</h4>' + table([{ label: '阶段' }, { label: '金额' }, { label: '说明' }],
        P.finance.funding.map(function (f) {
          return '<tr><td>' + esc(f.stage) + '</td><td>' + esc(f.amount) + '</td><td class="small">' + esc(f.note) + '</td></tr>';
        }).join('')) + '</div></div>' +
      '<h4>财务假设</h4><ul class="small muted" style="padding-left:18px;line-height:2">' +
      P.finance.assumptions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';

    var risks = P.risks.map(function (r) {
      return '<div class="card" style="margin-bottom:10px"><h3>' + esc(r.t) + '</h3>' +
        '<p class="small muted" style="margin:0 0 8px">' + esc(r.d) + '</p>' +
        '<div class="note"><b>对策：</b>' + esc(r.s) + '</div></div>';
    }).join('');

    var plan = '<div class="grid three">' + P.plan.map(function (g) {
      return '<div class="card" style="margin:0"><h3>' + esc(g.k) + '</h3><ul class="small muted" style="margin:0;padding-left:16px;line-height:2">' +
        g.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';

    return pageHead('项目资料 · 计划书核心',
      '从政策到财务：这个项目凭什么成立',
      '内容取自《碳寻计划书12.docx》与省赛 PPT，按“背景—市场—痛点—模式—营销—规划—财务—风险”重排，便于评委和合作方快速定位。',
      '<button class="btn" data-go="team">团队与成果</button>') +
      accordion('一、项目背景与政策环境', pest, true, 'PEST') +
      accordion('二、市场规模与碳市场底色', marketBody, false, '3.2') +
      accordion('三、市场痛点与我们的切口', '<div class="grid three">' + P.pains.map(function (p) {
        return '<div class="card" style="margin:0"><h3>' + esc(p.t) + '</h3><p class="small muted">' + esc(p.d) + '</p>' +
          '<div class="pill acc">' + esc(p.fix) + '</div></div>';
      }).join('') + '</div>', false, '3.3') +
      accordion('四、SWOT 分析', swot, false, '第四章') +
      accordion('五、产品构成：个人 / 企业 / 会员', products, false, '5.2') +
      accordion('六、盈利模式', revenue, false, '5.3') +
      accordion('七、市场调研与 STP', stp, false, '第六章') +
      accordion('八、发展规划与四条业务线', plan, false, '第七章') +
      accordion('九、财务与融资', financeBody, false, '第八章') +
      accordion('十、风险与对策', risks, false, '第十章');
  }

  function stpTable(title, rows) {
    return '<div class="card" style="margin:0"><h3>' + esc(title) + '分布</h3>' +
      table([{ label: '分组' }, { label: '人数', num: true }, { label: '占比', num: true }],
        rows.map(function (r) {
          return '<tr><td>' + esc(r.label) + '</td><td class="num">' + r.n + '</td><td class="num">' + r.p.toFixed(2) + '%</td></tr>';
        }).join('')) + '</div>';
  }

  /* ---------------- 团队与成果 ---------------- */

  function team() {
    var results = '<section class="kpis">' + P.results.map(function (r) {
      return kpi(r.short || r.v, r.k, '', r.v, r.k === '铜奖' ? 'hl' : '');
    }).join('') + '</section>';

    var people = '<div class="people">' + P.team.map(function (m) {
      return '<div class="person"><div class="nm">' + esc(m.name) + '</div>' +
        '<div class="role">' + esc(m.role) + '</div><p>' + esc(m.info) + '</p></div>';
    }).join('') + '</div>';

    var mentors = '<div class="grid two">' + P.mentors.map(function (m) {
      return '<div class="person"><div class="nm">' + esc(m.name) + '</div>' +
        '<div class="role">' + esc(m.role) + '</div><p>' + esc(m.info) + '</p></div>';
    }).join('') + '</div>';

    var partners = table([{ label: '企业' }, { label: '主营 / 备注' }],
      P.partners.map(function (p) {
        return '<tr><td>' + esc(p.name) + '</td><td class="small muted">' + esc(p.note) + '</td></tr>';
      }).join(''));

    var honors = '<ul class="small muted" style="margin:0;padding-left:18px;line-height:2.1">' +
      P.honors.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>';

    return pageHead('团队与成果',
      '9 名学生、4 位导师、7 家企业的合作意向',
      '从校级一等奖到省赛铜奖，这支跨学院团队把一份课程作业推进到了有合作意向书、有论文支撑的项目。',
      '<button class="btn" data-go="project">回到项目资料</button>') +
      results +
      '<div class="card accent"><h3>学生团队 <span class="sub">市场营销 / 财税 / 商务英语 / 旅游 / 工商管理 / 管理科学与工程</span></h3>' + people + '</div>' +
      '<div class="card"><h3>导师团队</h3>' + mentors + '</div>' +
      '<div class="grid two" style="align-items:start">' +
      '<div class="card"><h3>合作意向企业 <span class="sub">' + P.partners.length + ' 家</span></h3>' + partners + '</div>' +
      '<div class="card"><h3>获奖与立项</h3>' + honors +
      '<div class="note" style="margin-top:12px">' + esc(P.meta.award) + '（' + esc(P.meta.awardDetail) + '）</div></div>' +
      '</div>';
  }

  /* ---------------- 数据与方法 ---------------- */

  function method(state) {
    var groups = {};
    F.FACTORS.forEach(function (f) { (groups[f.g] = groups[f.g] || []).push(f); });

    var tables = Object.keys(groups).map(function (g) {
      return '<h4>' + esc(g) + '</h4>' +
        table([{ label: '指标' }, { label: '单位' }, { label: '因子 kgCO₂e/单位', num: true }, { label: '来源与口径' }],
          groups[g].map(function (f) {
            return '<tr><td>' + esc(f.name) + '</td><td class="mono">' + esc(f.unit) + '</td>' +
              '<td class="num">' + esc(String(f.v)) + '</td>' +
              '<td class="small muted">' + esc(f.src) + '</td></tr>';
          }).join(''));
    }).join('');

    var formulas = '<ul class="small muted" style="padding-left:18px;line-height:2.1">' +
      '<li><b>单项排放</b> = 用量 × 排放因子 ÷ 1000（tCO₂e）</li>' +
      '<li><b>个人月排放</b> = Σ食物 + Σ居住 + Σ出行 + Σ用品/12 − 骑行抵扣</li>' +
      '<li><b>年排放</b> = 月排放 × 12（未做季节积分，季节系数只用于趋势展示）</li>' +
      '<li><b>企业强度</b> = 排放总量 ÷ 年产值（万元）</li>' +
      '<li><b>配额缺口</b> = 排放总量 − 产值 × 行业强度基准</li>' +
      '<li><b>绿色积分</b> = 减排量（kg）× 10</li>' +
      '<li><b>螺旋藻固碳</b> = 干重（kg）× 1.8 kgCO₂</li>' +
      '</ul>';

    var caveats = '<div class="note warn"><b>边界与限制：</b>' +
      '<ul style="margin:8px 0 0;padding-left:18px;line-height:2">' +
      '<li>个人侧因子为生活消费口径，未含公共基础设施与政府服务分摊，因此与“全国人均 8 t”这类含工业口径的数字不可直接比较。</li>' +
      '<li>企业侧示例数据为演示构造；行业强度基准为示意值，正式披露须使用生态环境部行业核算指南。</li>' +
      '<li>食物因子取全球均值的取整值，区域供应链差异会带来 ±30% 波动。</li>' +
      '<li>螺旋藻固碳、旧物循环、林木固碳均为估算，不构成可交易的核证减排量（CCER）。</li>' +
      '<li>趋势图为按季节系数还原的演示曲线，不是真实月度计量。</li>' +
      '</ul></div>';

    var build = '<div class="note"><b>构建信息：</b><span class="mono" id="buildInfo">' +
      esc((global.__BUILD__ && global.__BUILD__.digest) ? ('digest ' + global.__BUILD__.digest + ' · ' + global.__BUILD__.time) : 'dev 模式（未注入构建摘要）') +
      '</span>。单文件构建，无框架、无外部字体、无网络请求；输入只写入浏览器 localStorage。</div>';

    return pageHead('数据与方法',
      '每个数字都能追到一个因子',
      '这一页是整站的可信度基础：因子、公式、基准、边界全部公开。评审或合作方要复核任何一个结论，都可以从这里出发。',
      '<button class="btn" data-act="print">打印为 PDF</button>') +
      '<div class="grid two" style="align-items:start">' +
      '<div class="card accent"><h3>计算公式</h3>' + formulas +
      '<h4>人均参照</h4><div class="note">' + esc(F.BENCHMARK.personalLabel) + '；含工业与电力的全国人均约 ' +
      K.fmt(F.BENCHMARK.nationalPerCapita / 1000, 1) + ' tCO₂e（背景参考，不用于本页对标）。</div></div>' +
      '<div class="card"><h3>使用与合规说明</h3>' + caveats +
      '<div class="note" style="margin-top:10px">本站为创新创业项目展示与教学演示，不提供碳核查、碳交易或认证服务；' +
      '对外披露请以第三方核查机构出具的报告为准。</div></div>' +
      '</div>' +
      '<div class="card"><h3>排放因子表 <span class="sub">' + F.FACTORS.length + ' 项</span></h3>' + tables + '</div>' +
      '<div class="card"><h3>版本与部署</h3>' + build +
      '<p class="small muted" style="margin:10px 0 0">源码结构与 DAC Workbench 一致：<span class="mono">src/</span> 分模块开发，' +
      '<span class="mono">build.py</span> 合成单文件 <span class="mono">dist/index.html</span>，' +
      '<span class="mono">docs/</span> 作为 GitHub Pages 发布目录，<span class="mono">tests/</span> 用 node --test 校验计算内核。</p></div>';
  }

  /* ---------------- 关联研究 ---------------- */

  function research() {
    var R = P.research;

    var head = pageHead('关联研究 · 大创结题报告',
      '为什么“愿意用”比“能算碳”更难',
      '《' + esc(R.title) + '》用 TAM + SEM 解释公众愿不愿意用个人碳账户，并给出四条元宇宙实现路径。' +
      '这一页把它的结论接进来，也顺手记下了复核时发现的几处待修订项。',
      '<button class="btn" data-go="personal">看个人侧怎么算</button>' +
      '<button class="btn" data-go="project">回到项目资料</button>');

    var kpis = '<section class="kpis">' +
      kpi('受访者仍在使用', '57.6', '%', 'n = 线上有偿问卷', 'hl') +
      kpi('曾用后流失', '24.1', '%', '比“从未使用”还高', '') +
      kpi('行为意愿 ← 使用态度', '0.559', '路径系数', 'SEM 最强路径之一') +
      kpi('项目经费', K.fmt(R.budget, 0), '元', '4 项支出已核对自洽') +
      '</section>';

    var dossier = '<div class="card accent"><h3>项目档案</h3>' +
      '<div class="table-wrap" style="border:0"><table class="plain">' +
      '<tbody>' +
      '<tr><td class="muted">项目名称</td><td>' + esc(R.title) + '</td></tr>' +
      '<tr><td class="muted">项目编号</td><td class="mono">' + esc(R.no) + '</td></tr>' +
      '<tr><td class="muted">类别</td><td>' + esc(R.kind) + '</td></tr>' +
      '<tr><td class="muted">负责人</td><td>' + esc(R.leader) + '</td></tr>' +
      '<tr><td class="muted">指导教师</td><td>' + esc(R.advisors) + '（与本站项目共同指导教师）</td></tr>' +
      '<tr><td class="muted">执行年限</td><td>' + esc(R.period) + '</td></tr>' +
      '<tr><td class="muted">填表日期</td><td>' + esc(R.filed) + '</td></tr>' +
      '</tbody></table></div></div>';

    var outcomes = '<div class="card"><h3>两项成果</h3>' +
      R.outcomes.map(function (o) {
        return '<div class="sugg" style="grid-template-columns:minmax(0,1fr);gap:4px">' +
          '<div class="t">' + esc(o.name) + '</div>' +
          '<div class="pill block ok">' + esc(o.award) + '</div></div>';
      }).join('') + '</div>';

    var survey = '<div class="card"><h3>调研：谁在用、谁走了 <span class="sub">报告图 1</span></h3>' +
      '<div class="grid two" style="align-items:center;gap:10px">' +
      '<div>' + C.donut(R.survey.usage, {
        size: 184, thickness: 22,
        centerValue: '57.6%', centerLabel: '仍在使用', aria: '个人碳账户使用情况'
      }) + '</div>' +
      '<div>' + R.survey.usage.map(function (u) {
        return '<div style="margin-bottom:11px">' +
          '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">' +
          '<span>' + esc(u.label) + '</span><span class="mono">' + u.v + '%</span></div>' +
          bar(u.v / 100, u.color) + '</div>';
      }).join('') + '</div></div>' +
      '<div class="note warn" style="margin-top:8px"><b>口径提醒：</b>' + esc(R.survey.note) +
      '。有偿线上问卷存在自选择偏差，57.6% 与 2023 年个人碳账户的实际渗透率差距较大，' +
      '引用时宜限定为“受访者中”。</div></div>';

    var barriers = '<div class="card"><h3>四条推广困境 <span class="sub">报告 2.1–2.4</span></h3>' +
      R.barriers.map(function (b, i) {
        return '<div class="sugg" style="grid-template-columns:24px minmax(0,1fr)">' +
          '<div class="n">' + (i + 1) + '</div>' +
          '<div><div class="t">' + esc(b.t) + '</div>' +
          '<div class="m">' + esc(b.d) + '</div>' +
          '<div class="m" style="margin-top:4px"><span class="mono">例：</span>' + esc(b.eg) + '</div></div></div>';
      }).join('') + '</div>';

    var fitRows = R.tam.fitInitial.map(function (f) {
      return '<tr><td class="mono">' + esc(f.k) + '</td><td class="num">' + esc(f.v) + '</td>' +
        '<td class="mono muted">' + esc(f.threshold) + '</td>' +
        '<td>' + (f.ok ? '<span class="pill ok">达标</span>' : '<span class="pill bad">未达标</span>') + '</td></tr>';
    }).join('');

    var pathRows = R.tam.paths.map(function (p) {
      return '<div style="display:grid;grid-template-columns:150px minmax(0,1fr) 54px;gap:9px;align-items:center;margin-bottom:9px">' +
        '<span class="small">' + esc(p.from) + ' → ' + esc(p.to) + '</span>' +
        bar(p.coef / 0.6, 'var(--c1)') +
        '<span class="mono small" style="text-align:right">' + p.coef.toFixed(3) + '</span></div>';
    }).join('');

    var obsRows = R.tam.observed.map(function (o) {
      var vals = o.coefs ? o.coefs.map(function (c) { return c.toFixed(3); }).join('、') : '均 > 0.700';
      return '<tr><td style="white-space:nowrap">' + esc(o.latent) + '</td><td class="mono">' + esc(vals) + '</td>' +
        '<td class="small muted">' + esc(o.note) + '</td></tr>';
    }).join('');

    var tamCard = '<div class="card"><h3>模型：TAM + 结构方程 <span class="sub">报告 3.1–3.5</span></h3>' +
      '<div class="note" style="margin-bottom:12px">五个潜变量：' + R.tam.latent.map(function (l) {
        return '<span class="pill acc" style="margin-right:5px">' + esc(l) + '</span>';
      }).join('') + '</div>' +
      '<div class="grid two" style="align-items:start">' +
      '<div><h4>初始模型拟合（未达标项已标红）</h4>' +
      table([{ label: '指标' }, { label: '实测', num: true }, { label: '常用阈值' }, { label: '判定' }], fitRows, { plain: true }) +
      '<div class="note" style="margin-top:10px">GFI、RMSEA、CMIN/DF 三项未达常用阈值，报告据此做了修正；' +
      '修正后只写“均达到显著标准”，未给具体数值。</div></div>' +
      '<div><h4>主要路径系数</h4>' + pathRows +
      '<div class="note" style="margin-top:8px">使用态度对行为意愿影响最大 —— 换句话说，<b>先让人觉得“这事有意义”</b>，' +
      '比先做功能更能带来使用意愿。</div></div>' +
      '</div>' +
      '<h4>观测变量对潜变量的影响</h4>' +
      table([{ label: '潜变量' }, { label: '观测系数', num: true }, { label: '报告结论' }], obsRows, { plain: true }) +
      '<h4>五条研究假设</h4><ul class="small muted" style="margin:0;padding-left:18px;line-height:2">' +
      R.tam.hypotheses.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul></div>';

    var pathsCard = '<div class="card"><h3>四条实现路径 <span class="sub">报告 4.1–4.4</span></h3>' +
      '<div class="tiles">' + R.paths4.map(function (p) {
        return '<div class="tile" style="cursor:default">' +
          '<div class="pill acc" style="margin-bottom:8px">' + esc(p.k) + '</div>' +
          '<h4>' + esc(p.t) + '</h4><p>' + esc(p.d) + '</p></div>';
      }).join('') + '</div>' +
      '<div class="note" style="margin-top:12px"><b>报告自陈局限：</b>' + esc(R.limits) + '</div></div>';

    var relation = '<div class="card"><h3>和“碳寻”是什么关系</h3>' +
      R.relation.map(function (r) {
        return '<div class="sugg" style="grid-template-columns:120px minmax(0,1fr)">' +
          '<div class="t" style="margin:0">' + esc(r.side) + '</div>' +
          '<div class="m" style="font-size:12px">' + esc(r.d) + '</div></div>';
      }).join('') + '</div>';

    var errata = '<div class="card"><h3>复核时发现的待修订项 <span class="sub">供作者改稿，不影响站内引用</span></h3>' +
      table([{ label: '等级' }, { label: '问题' }, { label: '说明' }],
        R.errata.map(function (e) {
          var cls = e.level === '高' ? 'bad' : e.level === '中' ? 'warn' : e.level === '低' ? '' : 'ok';
          return '<tr><td style="white-space:nowrap;width:66px"><span class="pill ' + cls + '">' + esc(e.level) + '</span></td>' +
            '<td style="white-space:nowrap">' + esc(e.t) + '</td><td class="small muted">' + esc(e.d) + '</td></tr>';
        }).join(''), { plain: true }) +
      '<div class="note" style="margin-top:10px">前两项（时间线年份、拟合指标符号）是评委最容易追问的地方，建议改稿时优先处理；' +
      '其余为编号、缺值与错别字。经费与成果名称已逐项核对。</div></div>';

    /* 报告自陈局限之后的两处深化：传导链衰减 + 困境×路径覆盖 */
    var ECON = global.CS.econ;
    var tam = ECON.tamTransmission();
    var chainRows = tam.cumulative.map(function (c) {
      var pct = Math.min(1, c.value / 0.6);
      return '<div style="display:grid;grid-template-columns:200px minmax(0,1fr) 58px;gap:9px;align-items:center;margin-bottom:9px">' +
        '<span class="small">' + esc(c.label) + '</span>' +
        bar(pct, c.value >= 0.5 ? 'var(--c1)' : 'var(--c3)') +
        '<span class="mono small" style="text-align:right">' + c.value.toFixed(3) + '</span></div>';
    }).join('');

    var chainCard = '<div class="card"><h3>传导链的衰减 <span class="sub">把三条已知系数连起来看</span></h3>' +
      chainRows +
      '<div class="note">从“易用性”起步，走到“行为意愿”只剩 <b>' + tam.decay.toFixed(3) + '</b>；' +
      '而“态度 → 意愿”这一段本身就是 <b>0.559</b>。也就是说：<b>把界面做好能带来的意愿提升，' +
      '远不如先让人相信“这事有用”</b>。报告没有给出 H2、H5 的系数，这里不做外推。</div>' +
      '<div class="note warn" style="margin-top:8px">方法说明：' + esc(tam.note) + '</div></div>';

    var mx = ECON.matrixSummary();
    var dotHtml = function (v) {
      if (v === 2) return '<span style="color:var(--acc);letter-spacing:1px">●●●</span>';
      if (v === 1) return '<span style="color:var(--c3);letter-spacing:1px">●●</span>';
      return '<span class="muted">—</span>';
    };
    var matrixTable = '<div class="table-wrap"><table>' +
      '<thead><tr><th>推广困境 ＼ 技术路径</th>' +
      ECON.MATRIX.paths.map(function (p) {
        return '<th class="num">' + esc(p.name) + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      ECON.MATRIX.barriers.map(function (b) {
        var row = mx.rows.filter(function (r) { return r.k === b.k; })[0];
        return '<tr><td>' + esc(b.name) + '</td>' +
          row.cells.map(function (c) { return '<td class="num">' + dotHtml(c.score) + '</td>'; }).join('') +
          '</tr>';
      }).join('') +
      '</tbody></table></div>';

    var matrixCard = '<div class="card"><h3>哪条路径治哪个病 <span class="sub">困境 × 路径覆盖矩阵</span></h3>' +
      matrixTable +
      '<div class="note" style="margin-top:10px">覆盖最广的是 <b>' + esc(mx.best.name) + '</b>（合计 ' +
      mx.pathTotals[mx.best.k] + ' 分）—— 它同时解“追踪繁琐”和“平台孤岛”。' +
      '相对最难解的是 <b>' + esc(mx.weakestBarrier.name) + '</b>（' + mx.barrierTotals[mx.weakestBarrier.k] + ' 分），' +
      '因为它是商业模式问题，不是技术问题。</div>' +
      '<div class="legend" style="margin-top:8px"><span><b style="color:var(--acc)">●●●</b> 直接对症</span>' +
      '<span><b style="color:var(--c3)">●●</b> 部分缓解</span><span class="muted">— 关系弱</span></div></div>';

    return head + kpis +
      '<div class="grid two" style="align-items:start">' + dossier + outcomes + '</div>' +
      '<div class="grid two" style="align-items:start">' + survey + barriers + '</div>' +
      tamCard + chainCard + matrixCard + pathsCard +
      '<div class="grid two" style="align-items:start">' + relation + errata + '</div>';
  }

  /* ---------------- 推广测算 ---------------- */

  function economics(state) {
    var E = global.CS.econ;
    var m = state.econ;
    var r = E.promoteEconomy(m);
    var sweep = E.budgetSweep(m);
    var scenes = E.scenarioTable(m);
    var price = E.CARBON_PRICE;

    var kpis = '<section class="kpis">' +
      kpi('可获用户', K.fmt(r.users, 0), '人', '按 ' + K.fmt(m.cac, 1) + ' 元/人获客') +
      kpi('年减碳量', K.fmt(r.yearT, 1), 'tCO₂e', '月均活跃 ' + K.fmt(r.avgActive, 0) + ' 人', 'hl') +
      kpi('每吨碳推广成本', K.fmt(r.perT, 0), '元/tCO₂e', '碳价中位 ' + price.mid + ' 元/t') +
      kpi('碳价覆盖率', K.fmt(r.coverage * 100, 0), '%', r.gap > 0 ? '缺口 ' + K.fmt(r.gap / 10000, 1) + ' 万元' : '可由碳价覆盖') +
      '</section>';

    var inputCard = '<div class="card accent"><h3>推广参数</h3>' +
      '<div class="row-inline">' +
      field('econ.budget', '推广预算', m.budget, '万元', { step: 1 }) +
      field('econ.cac', '单用户获客成本', m.cac, '元/人', { step: 0.5 }) +
      '</div>' +
      '<div class="row-inline">' +
      field('econ.retention', '月度留存率', m.retention, '0–1', { step: 0.01, max: 1 }) +
      field('econ.perUserKg', '人均年减碳', m.perUserKg, 'kg/人·年', { step: 10 }) +
      '</div>' +
      '<div class="row-inline">' +
      field('econ.creditCost', '积分兑付成本', m.creditCost, '元/kg', { step: 0.01 }) +
      field('econ.fixedCost', '运营固定成本', m.fixedCost, '万元/年', { step: 0.5 }) +
      '</div>' +
      '<div class="note">人均年减碳量可直接用「个人碳足迹」页算出的<b>可减碳潜力</b>；' +
      '积分兑付成本按 1 kg 减排 = 10 分折算，10 分约合 0.1–0.2 元。</div>' +
      '<button class="btn mini" data-act="econ-reset" style="margin-top:10px">恢复基准值</button></div>';

    var verdictText = r.verdict === 'covered'
      ? '按当前参数，<b>减碳量按碳价变现即可覆盖推广成本</b>，模型自洽。'
      : r.verdict === 'partial'
        ? '碳价只能覆盖约 <b>' + K.fmt(r.coverage * 100, 0) + '%</b> 的推广成本，其余要靠其他收入补。'
        : '碳价只能覆盖约 <b>' + K.fmt(r.coverage * 100, 0) + '%</b> 的推广成本 —— 纯靠碳价养不活，' +
          '必须叠加广告、电商或企业服务收入。';

    var verdictCard = '<div class="card"><h3>结论 <span class="sub">每吨成本 vs 碳价</span></h3>' +
      '<div class="note ' + (r.verdict === 'covered' ? '' : 'warn') + '">' + verdictText + '</div>' +
      '<div style="margin-top:12px">' +
      '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px">' +
      '<span>碳价覆盖推广成本的比例</span><span class="mono">' + K.fmt(r.coverage * 100, 1) + '%</span></div>' +
      bar(Math.min(1, r.coverage), r.coverage >= 1 ? 'var(--c1)' : 'var(--c3)') + '</div>' +
      '<div class="grid two" style="margin-top:14px;gap:10px">' +
      '<div><div class="muted small">每吨推广成本</div><div class="mono" style="font-size:19px;font-weight:700">' +
      K.fmt(r.perT, 0) + ' <small class="muted">元/t</small></div></div>' +
      '<div><div class="muted small">碳价中位（示意）</div><div class="mono" style="font-size:19px;font-weight:700">' +
      price.mid + ' <small class="muted">元/t</small></div></div>' +
      '</div>' +
      '<div class="note" style="margin-top:12px">这正是结题报告自陈的短板：<b>没算经济效率</b>。' +
      '把成本放进来看，个人碳账户的推广不是“技术能不能做到”，而是“谁来付这笔钱”。' +
      '碳寻的答案是：用个人侧引流、企业侧（碳咨询与培训）收钱。' + '</div></div>';

    var costItems = [
      { label: '获客投放', value: r.cost.acquire, color: 'var(--c1)' },
      { label: '积分兑付', value: r.cost.credit, color: 'var(--c2)' },
      { label: '运营固定', value: r.cost.fixed, color: 'var(--c4)' }
    ];
    var costCard = '<div class="card"><h3>成本构成 <span class="sub">首年</span></h3>' +
      C.donut(costItems, {
        size: 180, thickness: 22,
        centerValue: K.fmt(r.cost.total / 10000, 1), centerLabel: '万元 / 年', aria: '推广成本构成'
      }) +
      '<div style="margin-top:12px">' + costItems.map(function (it) {
        var pct = r.cost.total > 0 ? it.value / r.cost.total : 0;
        return '<div style="margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">' +
          '<span>' + esc(it.label) + '</span><span class="mono">' + K.fmt(it.value / 10000, 1) + ' 万元 · ' + (pct * 100).toFixed(0) + '%</span></div>' +
          bar(pct, it.color) + '</div>';
      }).join('') + '</div>' +
      '<div class="note">获客与积分是两笔硬支出；固定成本随规模摊薄，是唯一能靠增长改善的部分。</div></div>';

    var curveCard = '<div class="card"><h3>用户留存衰减 <span class="sub">首年获客 ' + K.fmt(r.users, 0) + ' 人</span></h3>' +
      C.trend(r.curve, { height: 190, unit: ' 人' }) +
      '<div class="note">首月 ' + K.fmt(r.users, 0) + ' 人 → 第 12 月 ' + K.fmt(r.endActive, 0) + ' 人，' +
      '月均活跃 <b>' + K.fmt(r.avgActive, 0) + '</b> 人。留存率每降 10 个百分点，年减碳量几乎同比例下降。</div></div>';

    var sweepCard = '<div class="card"><h3>预算敏感度 <span class="sub">预算 ×0.5 ~ ×3 时的每吨成本</span></h3>' +
      C.hbars(sweep.map(function (s) {
        return { label: K.fmt(s.budget, 1) + ' 万元', value: s.perT };
      }), { unit: ' 元/t', labelWidth: 96, rowH: 28, aria: '预算与单位成本' }) +
      '<div class="note">规模上去后每吨成本下降 —— 因为固定成本被摊薄；但<b>获客与积分成本是同比例的</b>，' +
      '所以指望“多投钱就便宜”并不成立，真正要降的是获客单价与留存率。</div></div>';

    var sceneCard = '<div class="card"><h3>三档情景 <span class="sub">只改获客、留存与人均减碳</span></h3>' +
      table([
        { label: '情景' }, { label: '获客成本', num: true }, { label: '月留存', num: true },
        { label: '人均减碳', num: true }, { label: '年减碳 t', num: true },
        { label: '元/t', num: true }, { label: '碳价覆盖', num: true }
      ], scenes.map(function (s) {
        return '<tr><td>' + esc(s.name) + '</td>' +
          '<td class="num">' + K.fmt(s.cac, 1) + '</td>' +
          '<td class="num">' + (s.retention * 100).toFixed(0) + '%</td>' +
          '<td class="num">' + K.fmt(s.perUserKg, 0) + '</td>' +
          '<td class="num">' + K.fmt(s.yearT, 0) + '</td>' +
          '<td class="num"><b>' + K.fmt(s.perT, 0) + '</b></td>' +
          '<td class="num">' + K.fmt(s.coverage * 100, 0) + '%</td></tr>';
      }).join('')) +
      '<div class="note" style="margin-top:10px">三档都覆盖不住碳价时，说明这门生意的收入不来自碳市场，' +
      '而来自碳寻原本写的那四个变现口：广告、电商、线下活动、付费社群。</div></div>';

    return pageHead('平台演示 · 推广测算',
      '每减一吨碳，要花多少钱把它推出去',
      '结题报告明确写了“未考虑经济效率（开发成本与推广成本）”。这一页把它补上：' +
      '给定预算、获客成本、留存率与人均减碳量，算清可获用户、年减碳量与每吨碳的推广成本，再和碳价对照。',
      '<button class="btn" data-go="research">回到关联研究</button>' +
      '<button class="btn primary" data-act="export-md">导出报告</button>') +
      kpis +
      '<div class="grid split">' +
      '<div>' + inputCard + costCard + '</div>' +
      '<div>' + verdictCard + curveCard + '</div>' +
      '</div>' +
      '<div class="grid two" style="align-items:start">' + sweepCard + sceneCard + '</div>' +
      '<div class="card"><h3>这套算法怎么来的</h3>' +
      '<ul class="small muted" style="margin:0;padding-left:18px;line-height:2.1">' +
      '<li><b>可获用户</b> = 推广预算 ÷ 单用户获客成本</li>' +
      '<li><b>第 m 月活跃</b> = 可获用户 × 留存率<sup>m−1</sup>；<b>月均活跃</b> = 12 个月之和 ÷ 12</li>' +
      '<li><b>年减碳量</b> = 月均活跃 × 人均年减碳量 ÷ 1000（tCO₂e）</li>' +
      '<li><b>总成本</b> = 推广预算 + 年减碳量(kg) × 积分兑付单价 + 运营固定成本</li>' +
      '<li><b>每吨成本</b> = 总成本 ÷ 年减碳量；<b>碳价覆盖</b> = 年减碳量 × 碳价 ÷ 总成本</li>' +
      '</ul>' +
      '<div class="note warn" style="margin-top:12px"><b>边界：</b>碳价取 ' + price.low + '–' + price.high +
      ' 元/t 的示意区间（' + esc(price.note) + '）；未计入碳市场对个人开放的政策不确定性、' +
      '未计入企业侧收入，也未做折现。这是<b>量级判断</b>，不是财务模型。</div></div>';
  }

  global.CS = global.CS || {};
  global.CS.views = {
    overview: overview, personal: personal, enterprise: enterprise, points: points,
    dashboard: dashboard, project: project, team: team, method: method, research: research,
    economics: economics
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
