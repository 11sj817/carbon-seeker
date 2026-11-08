/* 状态持久化与导出工具。localStorage 不可用时自动退化为内存态。 */
(function (global) {
  'use strict';

  var KEY = 'carbon-seeker:state:v1';
  var memory = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaults(calc, econ) {
    return {
      view: 'overview',
      theme: 'light',
      personal: clone(calc.PERSONAL_DEFAULT),
      enterprise: clone(calc.ENTERPRISE_DEFAULT),
      econ: clone((econ || calc).ECON_DEFAULT),
      points: null
    };
  }

  function merge(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    Object.keys(patch).forEach(function (k) {
      var v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        merge(base[k], v);
      } else {
        base[k] = v;
      }
    });
    return base;
  }

  function load(calc, econ) {
    var base = defaults(calc, econ);
    var raw = null;
    try { raw = global.localStorage ? global.localStorage.getItem(KEY) : memory; } catch (err) { raw = memory; }
    if (!raw) return base;
    try {
      var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return merge(base, parsed);
    } catch (err) {
      return base;
    }
  }

  function save(state) {
    var raw = JSON.stringify({ view: state.view, theme: state.theme, personal: state.personal, enterprise: state.enterprise, econ: state.econ, points: state.points });
    memory = raw;
    try { if (global.localStorage) global.localStorage.setItem(KEY, raw); } catch (err) { /* 隐私模式下静默 */ }
  }

  function reset(calc, econ) {
    var base = defaults(calc, econ);
    try { if (global.localStorage) global.localStorage.removeItem(KEY); } catch (err) { /* noop */ }
    memory = null;
    return base;
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function stamp(d) {
    var t = d || new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()) + '-' + p(t.getHours()) + p(t.getMinutes());
  }

  var API = { KEY: KEY, load: load, save: save, reset: reset, download: download, stamp: stamp, clone: clone };
  global.CS = global.CS || {};
  global.CS.store = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
