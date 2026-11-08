/* 轻量 SVG 图表：环形、柱状、横条（可带对标标记）、趋势。
   全部返回字符串，无第三方依赖，颜色取自 CSS 变量（dark 主题由变量自动跟随）。 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function niceMax(v) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return 1;
    var exp = Math.floor(Math.log(n) / Math.LN10);
    var base = Math.pow(10, exp);
    var f = n / base;
    var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) {
      if (f <= steps[i] + 1e-9) return steps[i] * base;
    }
    return 10 * base;
  }

  function fnum(v, d) {
    var n = Number(v);
    if (!isFinite(n)) n = 0;
    var digits = typeof d === 'number' ? d : 1;
    return n.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  var PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
  function color(i) { return PALETTE[i % PALETTE.length]; }

  /* ---------- 环形图 ---------- */
  function donut(items, opts) {
    var o = opts || {};
    var size = o.size || 196;
    var thick = o.thickness || 24;
    var r = (size - thick) / 2;
    var cx = size / 2, cy = size / 2;
    var C = 2 * Math.PI * r;
    var total = (items || []).reduce(function (s, it) { return s + Math.max(0, Number(it.value) || 0); }, 0);

    var svg = ['<svg class="chart donut" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(o.aria || '构成占比环形图') + '" width="' + size + '" height="' + size + '">'];
    svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--line-soft)" stroke-width="' + thick + '"/>');

    if (total > 0) {
      var acc = 0;
      (items || []).forEach(function (it, i) {
        var v = Math.max(0, Number(it.value) || 0);
        if (v <= 0) return;
        var len = (v / total) * C;
        var dash = Math.max(0, len - 2);
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (it.color || color(i)) +
          '" stroke-width="' + thick + '" stroke-dasharray="' + dash.toFixed(2) + ' ' + (C - dash).toFixed(2) +
          '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="butt">' +
          '<title>' + esc(it.label + '：' + fnum(v, 2) + '（' + ((v / total) * 100).toFixed(1) + '%）') + '</title></circle>');
        acc += len;
      });
    }

    if (o.centerLabel || o.centerValue) {
      svg.push('<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="20" font-weight="700" fill="var(--txt)" class="val">' + esc(o.centerValue || '') + '</text>');
      svg.push('<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" font-size="10.5" fill="var(--dim)">' + esc(o.centerLabel || '') + '</text>');
    }
    svg.push('</svg>');
    return svg.join('');
  }

  /* ---------- 竖向柱状图 ---------- */
  function bars(items, opts) {
    var o = opts || {};
    var W = 640, H = o.height || 230;
    var padL = 44, padR = 12, padT = 16, padB = 30;
    var iw = W - padL - padR, ih = H - padT - padB;
    var list = items || [];
    var max = niceMax(Math.max.apply(null, list.map(function (d) { return Number(d.value) || 0; }).concat([0])) || 1);
    var n = Math.max(1, list.length);
    var step = iw / n;
    var bw = Math.min(46, step * 0.58);

    var svg = ['<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '柱状图') + '" preserveAspectRatio="xMidYMid meet">'];
    for (var t = 0; t <= 4; t++) {
      var y = padT + ih - (ih * t) / 4;
      svg.push('<line class="gridline" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke-dasharray="' + (t === 0 ? '0' : '3 4') + '"/>');
      svg.push('<text x="' + (padL - 8) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" class="val">' + esc(fnum((max * t) / 4, max < 10 ? 1 : 0)) + '</text>');
    }

    list.forEach(function (d, i) {
      var v = Math.max(0, Number(d.value) || 0);
      var h = max > 0 ? (v / max) * ih : 0;
      var x = padL + step * i + (step - bw) / 2;
      var yTop = padT + ih - h;
      svg.push('<rect x="' + x.toFixed(1) + '" y="' + yTop.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, h).toFixed(1) +
        '" rx="4" fill="' + (d.color || 'var(--c1)') + '"><title>' + esc(d.label + '：' + fnum(v, 2)) + '</title></rect>');
      if (o.showValue !== false) {
        svg.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (yTop - 5).toFixed(1) + '" text-anchor="middle" font-size="9.5" class="val" fill="var(--dim)">' + esc(fnum(v, v < 10 ? 1 : 0)) + '</text>');
      }
      svg.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="9.5">' + esc(d.label) + '</text>');
    });

    svg.push('</svg>');
    return svg.join('');
  }

  /* ---------- 横向条（带可选对标标记）---------- */
  function hbars(items, opts) {
    var o = opts || {};
    var W = 640;
    var list = items || [];
    var rowH = o.rowH || 30;
    var H = Math.max(70, list.length * rowH + 26);
    var padL = o.labelWidth || 132, padR = o.valueWidth || 96, padT = 8;
    var iw = W - padL - padR;
    var max = niceMax(Math.max.apply(null, list.map(function (d) {
      return Math.max(Number(d.value) || 0, Number(d.marker) || 0);
    }).concat([0])) || 1);

    var svg = ['<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '横向条形图') + '" preserveAspectRatio="xMidYMid meet">'];
    list.forEach(function (d, i) {
      var y = padT + i * rowH;
      var v = Math.max(0, Number(d.value) || 0);
      var w = max > 0 ? (v / max) * iw : 0;
      svg.push('<text x="0" y="' + (y + rowH / 2 + 3.5) + '" font-size="10.5">' + esc(d.label) + '</text>');
      svg.push('<rect x="' + padL + '" y="' + (y + 7) + '" width="' + iw + '" height="10" rx="5" fill="var(--line-soft)"/>');
      svg.push('<rect x="' + padL + '" y="' + (y + 7) + '" width="' + Math.max(1, w).toFixed(1) + '" height="10" rx="5" fill="' + (d.color || 'var(--c1)') + '"><title>' + esc(d.label + '：' + fnum(v, 2)) + '</title></rect>');
      if (d.marker != null && isFinite(Number(d.marker))) {
        var mx = padL + (Number(d.marker) / max) * iw;
        svg.push('<line x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="' + (y + 2) + '" y2="' + (y + 22) + '" stroke="var(--c3)" stroke-width="1.6" stroke-dasharray="3 2"/>');
      }
      svg.push('<text x="' + (padL + iw + 6) + '" y="' + (y + rowH / 2 + 3.5) + '" font-size="10" class="val">' + esc(fnum(v, 2) + (o.unit || '')) + '</text>');
    });
    svg.push('</svg>');
    return svg.join('');
  }

  /* ---------- 趋势面积图 ---------- */
  function trend(items, opts) {
    var o = opts || {};
    var W = 640, H = o.height || 200;
    var padL = 44, padR = 14, padT = 14, padB = 26;
    var iw = W - padL - padR, ih = H - padT - padB;
    var list = items || [];
    var max = niceMax(Math.max.apply(null, list.map(function (d) { return Number(d.value) || 0; }).concat([1])));
    var n = Math.max(1, list.length - 1);

    function px(i) { return padL + (iw * i) / n; }
    function py(v) { return padT + ih - (Math.max(0, Number(v) || 0) / max) * ih; }

    var svg = ['<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '趋势图') + '" preserveAspectRatio="xMidYMid meet">'];
    for (var t = 0; t <= 4; t++) {
      var y = padT + ih - (ih * t) / 4;
      svg.push('<line class="gridline" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke-dasharray="' + (t === 0 ? '0' : '3 4') + '"/>');
      svg.push('<text x="' + (padL - 8) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" class="val">' + esc(fnum((max * t) / 4, 0)) + '</text>');
    }

    var pts = list.map(function (d, i) { return px(i).toFixed(1) + ',' + py(d.value).toFixed(1); });
    if (pts.length) {
      var area = 'M' + px(0).toFixed(1) + ',' + (padT + ih) + ' L' + pts.join(' L') + ' L' + px(list.length - 1).toFixed(1) + ',' + (padT + ih) + ' Z';
      svg.push('<path d="' + area + '" fill="var(--c1)" fill-opacity="0.13" stroke="none"/>');
      svg.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--c1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>');
      list.forEach(function (d, i) {
        if (list.length <= 13) {
          svg.push('<circle cx="' + px(i).toFixed(1) + '" cy="' + py(d.value).toFixed(1) + '" r="2.6" fill="var(--panel)" stroke="var(--c1)" stroke-width="1.6"><title>' + esc(d.month + '：' + fnum(d.value, 1) + (o.unit || ' kg')) + '</title></circle>');
        }
        svg.push('<text x="' + px(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9">' + esc(d.month) + '</text>');
      });
    }
    svg.push('</svg>');
    return svg.join('');
  }

  function legend(items) {
    return '<div class="legend">' + (items || []).map(function (it, i) {
      return '<span><i style="background:' + (it.color || color(i)) + '"></i>' + esc(it.label) + '</span>';
    }).join('') + '</div>';
  }

  var API = { donut: donut, bars: bars, hbars: hbars, trend: trend, legend: legend, esc: esc, niceMax: niceMax, color: color, fnum: fnum };
  global.CS = global.CS || {};
  global.CS.charts = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
