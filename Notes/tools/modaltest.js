/* ============================================================
 *  modaltest.js —— 弹窗关闭回归（无头浏览器跑）
 *  用法：index.html?modaltest=1
 *  验证：主界面打开「玩法说明」后，「知道了」和右上角 ✕ 都能关掉
 *  （原来的 bug：知道了 绑在开局才执行的 bindEvents 里，主界面点不动）
 * ========================================================== */
(function () {
  "use strict";
  var W = 300, results = [];
  function $(id) { return document.getElementById(id); }
  function visible(id) { return !$(id).classList.contains("hidden"); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function log(name, pass, info) {
    results.push((pass ? "OK " : "FAIL ") + name + (info ? " | " + info : ""));
  }
  function click(el) {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  Promise.resolve()
    .then(function () {
      if ($("titleScreen").classList.contains("hidden")) {
        log("前置：停在主界面", false, "titleScreen 不可见");
        return;
      }
      log("前置：停在主界面", true);
      click($("btnRules2"));
      return wait(120);
    })
    .then(function () {
      log("点「玩法说明」→ 规则弹窗弹出", visible("rulesModal"), "visible=" + visible("rulesModal"));
      click($("btnCloseRules"));
      return wait(120);
    })
    .then(function () {
      var ok = !visible("rulesModal");
      log("底部「知道了」能关闭（原 bug 点不动）", ok, "visible=" + visible("rulesModal"));
      click($("btnRules2"));
      return wait(120);
    })
    .then(function () {
      log("再次打开弹窗", visible("rulesModal"));
      click($("btnCloseRulesX"));
      return wait(120);
    })
    .then(function () {
      var ok = !visible("rulesModal");
      log("右上角 ✕ 能关闭", ok, "visible=" + visible("rulesModal"));
    })
    .catch(function (e) { log("脚本异常", false, String(e)); })
    .then(function () {
      var allOk = results.every(function (r) { return r.indexOf("FAIL") < 0; });
      document.title = (allOk ? "MODALTEST OK" : "MODALTEST FAIL") + " | " + results.join(" | ");
      var m = document.createElement("div");
      m.setAttribute("data-modaltest", results.join("|"));
      document.body.appendChild(m);
    });
})();
