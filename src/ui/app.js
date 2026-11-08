/* 应用层：路由、绑定、导出、主题。
   渲染策略：状态变化 → 重建当前视图 HTML → 把焦点还给刚才那个输入框。
   这样既不需要框架，也不会在打字时丢焦点。 */
(function (global) {
  'use strict';

  var K = global.CS.calc;
  var F = global.CS.factors;
  var P = global.CS.project;
  var V = global.CS.views;
  var S = global.CS.store;

  var ICONS = {
    overview: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z',
    personal: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2',
    enterprise: 'M3 21h18M6 21V8l6-4 6 4v13M10 12h4M10 16h4',
    points: 'M12 3l2.6 6.1 6.4.6-4.8 4.3 1.4 6.2L12 17l-5.6 3.2 1.4-6.2L3 9.7l6.4-.6z',
    dashboard: 'M4 19V5m0 14h16M8 15l3-4 3 2 4-6',
    project: 'M6 3h9l4 4v14H6zM15 3v5h5M9 13h7M9 17h5',
    team: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 21v-1.5a3.5 3.5 0 0 0-2.5-3.35M4 21v-1.5a3.5 3.5 0 0 1 2.5-3.35',
    method: 'M9 3h6M10 3v6l-4 8a2 2 0 0 0 1.8 3h8.4A2 2 0 0 0 18 17l-4-8V3',
    research: 'M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.3 7.3l2.1 2.1M6.3 17.7l2.1-2.1m7.3-7.3l2.1-2.1M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    economics: 'M3 17l5-6 4 3 5-7 4 4M3 21h18M7 21v-4m5 4v-2m4 2v-6'
  };

  var NAV = [
    { group: '平台演示', items: [
      { k: 'overview', label: '概览' },
      { k: 'personal', label: '个人碳足迹' },
      { k: 'enterprise', label: '企业碳账本' },
      { k: 'points', label: '绿色积分' },
      { k: 'dashboard', label: '数据看板' },
      { k: 'economics', label: '推广测算' }
    ] },
    { group: '项目资料', items: [
      { k: 'project', label: '项目资料' },
      { k: 'team', label: '团队与成果' },
      { k: 'research', label: '关联研究' },
      { k: 'method', label: '数据与方法' }
    ] }
  ];

  var TITLES = {
    overview: '概览', personal: '个人碳足迹', enterprise: '企业碳账本', points: '绿色积分',
    dashboard: '数据看板', economics: '推广测算', project: '项目资料', team: '团队与成果', research: '关联研究', method: '数据与方法'
  };

  var ECON = global.CS.econ;
  var state = S.load(K, ECON);
  var main, rail;

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function buildRail() {
    var html = '<div class="rail-caption">MODULES</div>';
    NAV.forEach(function (g) {
      html += '<div class="rail-group">' + g.group + '</div>';
      g.items.forEach(function (it) {
        html += '<button type="button" data-go="' + it.k + '" data-key="' + it.k + '">' +
          '<span class="ico"><svg viewBox="0 0 24 24"><path d="' + ICONS[it.k] + '"/></svg></span>' +
          '<span>' + it.label + '</span></button>';
      });
    });
    html += '<div class="rail-foot">碳寻 · Carbon Seeker<br>v1.0 · 单文件构建</div>';
    rail.innerHTML = html;
  }

  function syncRail() {
    Array.prototype.forEach.call(rail.querySelectorAll('button[data-key]'), function (b) {
      var on = b.getAttribute('data-key') === state.view;
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }

  function render() {
    var view = typeof V[state.view] === 'function' ? state.view : 'overview';
    var active = document.activeElement;
    var focusKey = null, caret = null;
    if (active && main.contains(active)) {
      if (active.getAttribute('data-bind')) focusKey = { kind: 'bind', v: active.getAttribute('data-bind') };
      else if (active.getAttribute('data-row')) focusKey = { kind: 'row', v: active.getAttribute('data-row') + '|' + active.getAttribute('data-field') };
      if (focusKey && active.setSelectionRange) {
        try { caret = active.selectionStart; } catch (e) { caret = null; }
      }
    }

    main.innerHTML = V[view](state);
    syncRail();
    document.title = '碳寻 · ' + (TITLES[view] || '概览') + ' | Carbon Seeker';
    S.save(state);

    if (focusKey) {
      var sel = focusKey.kind === 'bind'
        ? '[data-bind="' + focusKey.v.replace(/"/g, '') + '"]'
        : '[data-row="' + focusKey.v.split('|')[0] + '"][data-field="' + focusKey.v.split('|')[1] + '"]';
      var el = main.querySelector(sel);
      if (el) {
        el.focus();
        if (caret != null && el.setSelectionRange) {
          try { el.setSelectionRange(caret, caret); } catch (e) { /* number 输入不支持，忽略 */ }
        }
      }
    }
  }

  function setView(view, push) {
    if (!V[view]) view = 'overview';
    state.view = view;
    if (push !== false && global.location.hash !== '#' + view) {
      history.replaceState(null, '', '#' + view);
    }
    render();
    global.scrollTo({ top: 0, behavior: 'instant' in global ? 'instant' : 'auto' });
  }

  /* ---------------- 导出 ---------------- */

  function reportMarkdown() {
    var em = K.personalEmission(state.personal);
    var bench = K.personalBenchmark(em.annual);
    var sug = K.suggestions(state.personal, em);
    var ent = K.enterpriseSummary(state.enterprise);
    var potential = K.suggestionsTotal(sug);
    var pts = K.pointsFromCarbonKg(potential);
    var plan = K.redeemPlan(pts, F.POINTS.items);
    var L = [];

    L.push('# 碳寻 · 测算报告');
    L.push('');
    L.push('- 项目：' + P.meta.name + '（' + P.meta.en + '）— ' + P.meta.tagline);
    L.push('- 生成时间：' + new Date().toLocaleString('zh-CN'));
    L.push('- 口径：全部因子见「数据与方法」，计算在浏览器本地完成');
    L.push('');
    L.push('## 一、个人碳足迹');
    L.push('');
    L.push('| 指标 | 数值 |');
    L.push('| --- | --- |');
    L.push('| 月排放 | ' + K.fmt(em.monthly, 1) + ' kgCO₂e |');
    L.push('| 年排放 | ' + K.fmt(em.annual / 1000, 2) + ' tCO₂e |');
    L.push('| 绿色出行抵扣 | ' + K.fmt(em.savedAnnual, 1) + ' kgCO₂e/年 |');
    L.push('| 对比基准（' + K.fmt(bench.benchmark / 1000, 1) + ' t） | ' + (bench.ratio * 100).toFixed(0) + '% |');
    L.push('');
    L.push('### 构成');
    L.push('');
    L.push('| 类别 | kgCO₂e/月 | 占比 |');
    L.push('| --- | --- | --- |');
    ['food', 'home', 'travel', 'goods'].forEach(function (g) {
      var name = { food: '食物', home: '居住', travel: '出行', goods: '用品' }[g];
      var v = em.groups[g];
      L.push('| ' + name + ' | ' + K.fmt(v, 1) + ' | ' + (em.grossMonthly > 0 ? (v / em.grossMonthly * 100).toFixed(1) : '0.0') + '% |');
    });
    L.push('');
    L.push('### 减排建议');
    L.push('');
    L.push('| # | 建议 | 可减 kgCO₂e/年 | 积分 | 难度 |');
    L.push('| --- | --- | --- | --- | --- |');
    sug.forEach(function (x) {
      L.push('| ' + x.rank + ' | ' + x.title + ' | ' + K.fmt(x.save, 0) + ' | ' + K.fmt(x.points, 0) + ' | ' + x.level + ' |');
    });
    L.push('');
    L.push('建议合计可减 ' + K.fmt(potential, 0) + ' kgCO₂e/年，折 ' + K.fmt(pts, 0) + ' 绿色积分。');
    L.push('');
    L.push('## 二、企业碳账本');
    L.push('');
    L.push('- 企业：' + state.enterprise.name + '（' + (ent.sector ? ent.sector.name : '未选行业') + '）');
    L.push('- 年产值：' + K.fmt(ent.output, 0) + ' 万元；员工：' + K.fmt(state.enterprise.employees, 0) + ' 人');
    L.push('');
    L.push('| 范围 | tCO₂e | 占比 |');
    L.push('| --- | --- | --- |');
    [1, 2, 3].forEach(function (n) {
      var v = ent.byScope[n] || 0;
      L.push('| Scope ' + n + ' | ' + K.fmt(v, 2) + ' | ' + (ent.total > 0 ? (v / ent.total * 100).toFixed(1) : '0.0') + '% |');
    });
    L.push('| 合计 | ' + K.fmt(ent.total, 2) + ' | 100.0% |');
    L.push('');
    L.push('| 排放源 | 用量 | 单位 | 因子 | tCO₂e |');
    L.push('| --- | --- | --- | --- | --- |');
    ent.rows.forEach(function (r) {
      L.push('| ' + r.name + ' | ' + K.fmt(r.qty, 0) + ' | ' + r.unit + ' | ' + K.fmt(r.factor, 3) + ' | ' + K.fmt(r.t, 3) + ' |');
    });
    L.push('');
    L.push('- 排放强度：' + K.fmt(ent.intensity, 3) + ' tCO₂e/万元');
    L.push('- 行业基准：' + K.fmt(ent.benchmark, 3) + ' tCO₂e/万元（' + (ent.ratio * 100).toFixed(0) + '%）');
    L.push('- 免费配额：' + K.fmt(ent.freeQuota, 2) + ' t；缺口：' + K.fmt(ent.gap, 2) + ' t');
    L.push('');
    L.push('## 三、绿色积分');
    L.push('');
    L.push('| 兑换物 | 单价 | 份数 | 消耗 | 固碳 kgCO₂e |');
    L.push('| --- | --- | --- | --- | --- |');
    plan.list.forEach(function (it) {
      L.push('| ' + it.name + ' | ' + it.cost + ' | ' + it.count + ' | ' + it.spent + ' | ' + (it.kind === 'carbon' ? K.fmt(it.credit, 2) : '—') + ' |');
    });
    L.push('');
    L.push('合计消耗 ' + plan.spent + ' 分，剩余 ' + plan.left + ' 分，固碳 ' + K.fmt(plan.credit, 2) + ' kgCO₂e，海洋垃圾清理 ' + plan.oceanKg + ' kg。');
    L.push('');
    L.push('---');
    L.push('由碳寻展示站自动生成。因子与边界见站点「数据与方法」页；本站为项目演示，不构成碳核查结论。');
    return L.join('\n');
  }

  function reportJson() {
    var em = K.personalEmission(state.personal);
    var sug = K.suggestions(state.personal, em);
    var ent = K.enterpriseSummary(state.enterprise);
    var payload = {
      app: 'carbon-seeker',
      generatedAt: new Date().toISOString(),
      input: { personal: state.personal, enterprise: state.enterprise, points: state.points },
      result: {
        personal: {
          monthlyKg: em.monthly, annualKg: em.annual, grossMonthlyKg: em.grossMonthly,
          activeSavingKg: em.savedAnnual, groups: em.groups, shares: em.shares,
          benchmark: K.personalBenchmark(em.annual),
          suggestions: sug.map(function (x) { return { id: x.id, title: x.title, saveKgYear: x.save, points: x.points, level: x.level }; }),
          potentialKgYear: K.suggestionsTotal(sug)
        },
        enterprise: {
          totalT: ent.total, byScope: ent.byScope, intensity: ent.intensity,
          benchmark: ent.benchmark, ratio: ent.ratio, freeQuotaT: ent.freeQuota, gapT: ent.gap,
          rows: ent.rows.map(function (r) { return { name: r.name, scope: r.scope, qty: r.qty, unit: r.unit, factor: r.factor, t: r.t }; })
        },
        points: K.redeemPlan(K.pointsFromCarbonKg(K.suggestionsTotal(sug)), F.POINTS.items)
      },
      factorsVersion: '2024-01 (站内表)',
      build: global.__BUILD__ || null
    };
    return JSON.stringify(payload, null, 2);
  }

  function reportCsv() {
    var ent = K.enterpriseSummary(state.enterprise);
    var lines = ['范围,排放源,用量,单位,因子kgCO2e/单位,tCO2e,备注'];
    ent.rows.forEach(function (r) {
      lines.push([r.scope, r.name, r.qty, r.unit, r.factor, r.t.toFixed(4), (r.note || '').replace(/,/g, '；')].join(','));
    });
    lines.push(['合计', '', '', '', '', ent.total.toFixed(4), '强度 ' + ent.intensity.toFixed(4) + ' t/万元'].join(','));
    return '\uFEFF' + lines.join('\r\n');
  }

  /* ---------------- 事件 ---------------- */

  function action(name) {
    switch (name) {
      case 'personal-reset':
        state.personal = S.clone(K.PERSONAL_DEFAULT); break;
      case 'personal-zero':
        Object.keys(state.personal).forEach(function (g) {
          Object.keys(state.personal[g]).forEach(function (k) { state.personal[g][k] = 0; });
        });
        break;
      case 'enterprise-reset':
        state.enterprise = S.clone(K.ENTERPRISE_DEFAULT); break;
      case 'econ-reset':
        state.econ = S.clone(ECON.ECON_DEFAULT); break;
      case 'points-auto':
        state.points = null; break;
      case 'row-add': {
        var id = 'r' + Math.random().toString(36).slice(2, 8);
        state.enterprise.rows.push({ id: id, scope: 1, fk: 'gas', qty: 0, note: '' });
        break;
      }
      case 'export-md':
        S.download('碳寻测算报告_' + S.stamp() + '.md', reportMarkdown(), 'text/markdown;charset=utf-8'); return;
      case 'export-json':
        S.download('碳寻测算_' + S.stamp() + '.json', reportJson(), 'application/json;charset=utf-8'); return;
      case 'export-csv':
        S.download('碳寻碳账本_' + S.stamp() + '.csv', reportCsv(), 'text/csv;charset=utf-8'); return;
      case 'print':
        global.print(); return;
      case 'theme':
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.body.classList.toggle('dark', state.theme === 'dark');
        var btn = document.getElementById('themeBtn');
        if (btn) btn.setAttribute('aria-label', state.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
        S.save(state);
        return;
      default: return;
    }
    render();
  }

  function onClick(e) {
    var go = e.target.closest('[data-go]');
    if (go) { e.preventDefault(); setView(go.getAttribute('data-go')); return; }

    var del = e.target.closest('[data-del]');
    if (del) {
      var id = del.getAttribute('data-del');
      state.enterprise.rows = state.enterprise.rows.filter(function (r) { return r.id !== id; });
      render(); return;
    }

    var act = e.target.closest('[data-act]');
    if (act) { e.preventDefault(); action(act.getAttribute('data-act')); return; }
  }

  function onInput(e) {
    var t = e.target;
    if (!t || !t.matches) return;

    if (t.hasAttribute('data-bind')) {
      var path = t.getAttribute('data-bind');
      var isNum = t.type === 'number';
      var raw = t.value;

      if (path === 'points') {
        state.points = raw === '' ? null : Math.max(0, Math.round(parseFloat(raw) || 0));
        if (raw === '') return;   // 允许清空输入框，不立刻回填
        render(); return;
      }
      if (isNum) {
        if (raw === '') { setPath(state, path, 0); return; }  // 空值先静默置 0
        var v = parseFloat(raw);
        if (isNaN(v)) v = 0;
        setPath(state, path, Math.max(0, v));
      } else {
        setPath(state, path, raw);
      }
      render(); return;
    }

    if (t.hasAttribute('data-row')) {
      var rid = t.getAttribute('data-row');
      var fieldName = t.getAttribute('data-field');
      var row = state.enterprise.rows.filter(function (r) { return r.id === rid; })[0];
      if (!row) return;
      if (fieldName === 'qty') {
        var q = t.value === '' ? 0 : Math.max(0, parseFloat(t.value) || 0);
        row.qty = q;
        if (t.value === '') return;
      } else if (fieldName === 'scope') {
        row.scope = Number(t.value);
      } else {
        row[fieldName] = t.value;
      }
      render();
    }
  }

  function boot() {
    main = document.getElementById('main');
    rail = document.getElementById('rail');
    buildRail();

    document.body.classList.toggle('dark', state.theme === 'dark');

    var hash = (global.location.hash || '').replace('#', '');
    if (hash && V[hash]) state.view = hash;

    render();

    document.addEventListener('click', onClick);
    main.addEventListener('input', onInput);
    main.addEventListener('change', onInput);
    global.addEventListener('hashchange', function () {
      var v = (global.location.hash || '').replace('#', '');
      if (v && V[v] && v !== state.view) { state.view = v; render(); }
    });

    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', function () { action('theme'); });

    var buildTag = document.getElementById('buildTag');
    if (buildTag && global.__BUILD__) {
      buildTag.textContent = 'build ' + global.__BUILD__.digest;
      buildTag.title = '构建时间 ' + global.__BUILD__.time + ' · 源提交 ' + (global.__BUILD__.sourceCommit || 'dev');
    }

    var status = document.getElementById('statusText');
    if (status) status.textContent = '就绪 · 全部计算在本地完成';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
