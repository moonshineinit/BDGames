/* ============================================================
 *  main.js —— 主界面 / 开演前流程 / 启动 + 调试参数
 *
 *  流程：主界面「开始游戏」
 *          → 请选择乐队（五张海报里选一）
 *          → 请选择敌方乐队（剩下四支里选一）
 *          → 请选择难度（简单 / 普通 / 困难）
 *          → 开演
 *
 *  ?auto=MYGO-AVE     直接开局（跳过主界面与三次选择）
 *  &diff=easy|normal|hard  指定难度（默认 normal）
 *  &theme=light       日场配色
 *  &uitest=1          玩家一侧也交给 AI，自动打完一整局（查运行时错误用）
 *  &stun=1            让敌方前两名成员陷入怯场（看「完全无法行动」的遮罩）
 *  &curtain=1         摆好双方都在台上的场面，并把「谢幕」放进手牌（看强制清场）
 *  &noboot=1          只停在主界面
 * ========================================================== */
(function (root) {
  var BD = root.BD;

  root.onerror = function (msg, src, line) {
    var t = "JS ERROR: " + msg + " @" + (src || "") + ":" + (line || "");
    document.title = t;
    document.documentElement.setAttribute("data-error", t);
    console.error(t);
  };

  function qs(name) {
    var m = location.search.match(new RegExp("[?&]" + name + "=([^&]+)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function $(id) { return document.getElementById(id); }

  /* 选择进度：band → foe → diff */
  var PICK = { me: null, foe: null, diff: "normal", step: "band" };

  var STEP_META = {
    band: { title: "请选择乐队",        sub: "五支乐队各有一张海报，选你要带的那一支。",  step: 0 },
    foe:  { title: "请选择敌方乐队",    sub: "剩下的四支里挑一个对手。",                    step: 1 },
    diff: { title: "请选择难度",        sub: "难度只影响电脑对手的思考程度，你的规则不变。", step: 2 }
  };

  function posterCard(key) {
    var b = BD.BANDS[key];
    return '<button class="postercard" data-band="' + key + '" type="button" ' +
             'style="--band:' + b.color + ";--bandsoft:" + b.soft + '">' +
             BD.Art.poster(key) +
             '<span class="pickmark">选这一支</span>' +
           "</button>";
  }

  function diffCard(key) {
    var d = BD.DIFFICULTY[key];
    var dots = "";
    for (var i = 0; i < 3; i++) dots += '<i class="' + (i <= BD.DIFF_ORDER.indexOf(key) ? "on" : "") + '"></i>';
    return '<button class="diffcard d-' + key + '" data-diff="' + key + '" type="button">' +
             '<span class="dhead">' +
               '<b class="dname">' + d.cn + "</b>" +
               '<span class="ddots">' + dots + "</span>" +
             "</span>" +
             '<span class="dtag">' + d.tag + "</span>" +
             '<span class="ddesc">' + d.desc + "</span>" +
             '<span class="dpick">用这个难度开演</span>' +
           "</button>";
  }

  function renderPick() {
    var meta = STEP_META[PICK.step];
    $("pickTitle").textContent = meta.title;
    $("pickSub").textContent = meta.sub;

    var lis = $("pickSteps").children;
    for (var i = 0; i < lis.length; i++) {
      lis[i].classList.toggle("on", i === meta.step);
      lis[i].classList.toggle("done", i < meta.step);
    }
    $("btnPickBack").textContent = PICK.step === "band" ? "返回主界面" : "上一步";

    var pool = $("pickPool"), html = "";
    if (PICK.step === "diff") {
      html = BD.DIFF_ORDER.map(diffCard).join("");
      pool.className = "pool diffpool";
    } else {
      var list = BD.BAND_ORDER.filter(function (k) {
        return PICK.step === "band" ? true : k !== PICK.me;
      });
      html = list.map(posterCard).join("");
      pool.className = "pool postpool" + (PICK.step === "foe" ? " four" : "");
    }
    pool.innerHTML = html;
  }

  function openPick(step) {
    PICK.step = step;
    /* 主界面留在后面当背景（压暗 + 虚化），不要露出空棋盘 */
    $("titleScreen").classList.remove("hidden");
    $("titleScreen").classList.add("dim");
    $("pickModal").classList.remove("hidden");
    renderPick();
  }

  function backToTitle() {
    $("pickModal").classList.add("hidden");
    $("titleScreen").classList.remove("dim");
    PICK.me = null; PICK.foe = null; PICK.step = "band";
  }

  /* ------------------------------------------------------------
   *  退出对局：home = 回主界面，replay = 用同一组乐队和难度再开一局
   *  （不再靠 location.reload()，file:// 下刷新不稳定）
   * ---------------------------------------------------------- */
  var LAST = null;                       // 记住上一局的 me / foe / diff

  function exitGame(how) {
    $("endModal").classList.add("hidden");
    if (BD.UI && BD.UI.clearEndFx) BD.UI.clearEndFx();

    if (how === "replay" && LAST) {
      startGame(LAST.me, LAST.foe, LAST.diff);
      return;
    }
    /* 回主界面：把对局收起来，露出标题页 */
    $("pickModal").classList.add("hidden");
    $("titleScreen").classList.remove("dim");
    $("titleScreen").classList.remove("hidden");
    PICK.me = null; PICK.foe = null; PICK.step = "band";
  }

  function bindPick() {
    $("pickPool").addEventListener("click", function (e) {
      var bandBtn = e.target.closest && e.target.closest("[data-band]");
      if (bandBtn) {
        var key = bandBtn.dataset.band;
        bandBtn.classList.add("picked");
        if (PICK.step === "band") {
          PICK.me = key;
          setTimeout(function () { openPick("foe"); }, 200);
        } else if (PICK.step === "foe") {
          PICK.foe = key;
          setTimeout(function () { openPick("diff"); }, 200);
        }
        return;
      }
      var diffBtn = e.target.closest && e.target.closest("[data-diff]");
      if (diffBtn && PICK.step === "diff") {
        PICK.diff = diffBtn.dataset.diff;
        diffBtn.classList.add("picked");
        setTimeout(function () { startGame(PICK.me, PICK.foe, PICK.diff); }, 220);
      }
    });

    $("btnPickBack").addEventListener("click", function () {
      if (PICK.step === "diff") openPick("foe");
      else if (PICK.step === "foe") openPick("band");
      else backToTitle();
    });
  }

  function renderTitleBands() {
    var box = $("tsBands");
    if (!box) return;
    box.innerHTML = BD.BAND_ORDER.map(function (k) {
      var b = BD.BANDS[k];
      return '<span class="tsb" style="--band:' + b.color + '"><i></i>' + b.name + "</span>";
    }).join("");
  }

  /* 不开动画地快进 N 步，用来截中局 / 调平衡 */
  function fastForward(g, steps) {
    var guard = 0;
    while (!g.over && guard++ < steps) {
      var a = BD.AI.step(g);
      if (a.kind === "end") BD.Engine.endTurn(g);
      else if (a.kind === "attack") BD.Engine.attack(g, a.aUid, a.tUid);
      else if (a.kind === "move") BD.Engine.moveMember(g, a.uid, a.toZone);
      else if (a.kind === "card") BD.Engine.playCard(g, a.handIdx, a.targetUid);
      else break;
    }
  }

  var firstStart = true;             // 调试钩子只在第一次开局生效

  function startGame(me, foe, difficulty) {
    var diff = BD.DIFFICULTY[difficulty] ? difficulty : (PICK.diff || "normal");
    var dbg = firstStart; firstStart = false;
    LAST = { me: me, foe: foe, diff: diff };
    var g = BD.Engine.createGame({ bands: [me, foe], difficulty: diff });
    $("pickModal").classList.add("hidden");
    $("titleScreen").classList.remove("dim");
    $("titleScreen").classList.add("hidden");
    document.documentElement.setAttribute("data-theme", qs("theme") || "dark");
    $("btnTheme").textContent = (qs("theme") === "light") ? "夜场" : "日场";
    renderDiffChip(g);
    BD.Engine.startTurn(g);
    if (dbg && qs("sim")) fastForward(g, parseInt(qs("sim"), 10) || 0);
    if (dbg && (qs("uitest") || qs("fast"))) BD.UI.speed = 0.04;
    BD.UI.boot(g);
    /* 调试：?spent=1 → 让我方成员都显示成「本回合已经对战过」 */
    if (dbg && qs("spent")) {
      setTimeout(function () {
        BD.UI.game().players[0].members.forEach(function (u) { u.attacksLeft = 0; });
        BD.UI.render();
      }, Math.round(300 * BD.UI.speed));
    }

    /* 调试：?stun=1 → 让敌方前两名成员陷入怯场，看「完全无法行动」的遮罩 */
    if (dbg && qs("stun")) {
      setTimeout(function () {
        BD.UI.game().players[1].members.slice(0, 2).forEach(function (u) { u.suppressed = true; });
        BD.UI.render();
      }, Math.round(300 * BD.UI.speed));
    }

    /* 调试：?curtain=1 → 摆一个双方都在台上的场面，把「谢幕」塞进手牌、给满星星 */
    if (dbg && qs("curtain")) {
      setTimeout(function () {
        var g2 = BD.UI.game();
        g2.players[0].members.slice(0, 2).concat(g2.players[1].members.slice(0, 2))
          .forEach(function (u) {
            if (u.zone === "camp") { u.zone = "stage"; g2.stage.push(u); }
          });
        g2.players[0].stars = Math.max(g2.players[0].stars, 8);
        g2.players[0].hand.unshift("neu_finale");
        BD.UI.render();
        if (qs("curtain") === "play") {
          setTimeout(function () { BD.UI.cast(0, null); }, Math.round(700 * BD.UI.speed));
        }
      }, Math.round(300 * BD.UI.speed));
    }

    if (dbg && qs("win")) {
      var who = qs("win") === "foe" ? 1 : 0;
      setTimeout(function () { BD.UI.forceEnd(who); }, Math.round(400 * BD.UI.speed));
    }

    if (dbg && qs("uitest")) {
      g.players[0].isAI = true;
      BD.UI.render();
      setTimeout(function () { BD.UI.aiTurn(); }, Math.round(400 * BD.UI.speed));
    }
    return g;
  }

  function renderDiffChip(g) {
    var box = $("diffChip");
    if (!box || !g.diff) return;
    box.innerHTML = '难度 <b class="d-' + g.diff.key + '">' + g.diff.cn + "</b>";
    box.title = g.diff.desc;
  }

  /* ---------- 流畅模式 ----------
   * 关掉纯装饰的舞台光效（光束 / 桁架灯 / 观众荧光棒 / 台口跑马灯），
   * 只保留人物和卡牌。手机会记在 localStorage 里，下次进来照样生效。 */
  var PERF_KEY = "bd.perf";
  function setPerf(on, quiet) {
    document.body.classList.toggle("perf", !!on);
    var b = $("btnPerf");
    if (b) {
      b.classList.toggle("on", !!on);
      b.textContent = on ? "流畅 · 开" : "流畅";
    }
    try { localStorage.setItem(PERF_KEY, on ? "1" : "0"); } catch (e) {}
    if (on && !quiet && BD.UI && BD.UI.toast) BD.UI.toast("已开流畅模式：关掉舞台光效，弱机更顺");
  }

  /* 头 1.2 秒量一下帧率，低于 46 就自动切过去（只在没手动设过时） */
  function autoPerf() {
    var times = [], last = performance.now(), t0 = last;
    (function tick(t) {
      times.push(t - last); last = t;
      if (t - t0 < 1200) { requestAnimationFrame(tick); return; }
      times.sort(function (a, b) { return a - b; });
      var avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
      if (1000 / avg < 46) setPerf(true, true);
    })(last);
  }

  function boot() {
    var theme = qs("theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
    if (qs("noanim")) document.documentElement.classList.add("noanim");

    $("btnTheme").addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var next = cur === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      this.textContent = next === "light" ? "夜场" : "日场";
    });

    /* 流畅模式：手动开关 + 首次进入自动判断 */
    $("btnPerf").addEventListener("click", function () {
      setPerf(!document.body.classList.contains("perf"));
    });
    var savedPerf = null;
    try { savedPerf = localStorage.getItem(PERF_KEY); } catch (e) {}
    if (qs("perf") || savedPerf === "1") setPerf(true, true);
    else if (savedPerf !== "0" && !qs("noanim")) autoPerf();

    // 规则弹窗里把当前数值写死进文案
    var R = BD.RULES;
    $("rGoal").textContent = R.SPARK_GOAL;
    $("rMove").textContent = BD.MEMBERS.filter(function (m) { return m.leader; })[0].cost;
    $("rAtkStage").textContent = R.COST_ATTACK_STAGE;
    $("rAtkCamp").textContent = R.COST_ATTACK_CAMP;
    $("rStar").textContent = R.STAR_MAX;
    $("rSlot").textContent = R.STAGE_SLOTS;
    $("rRest").textContent = R.REST_TURNS;

    renderTitleBands();
    bindPick();

    /* 人物立绘：开局前一次性拉进浏览器缓存，避免每次重渲染都重新解码；
       哪张图不在，就自动回退成剪影 */
    document.addEventListener("error", function (e) {
      var t = e.target;
      if (t && t.tagName === "IMG" && t.classList && t.classList.contains("mimg")) {
        BD.Art.fallbackImg(t);
      }
    }, true);
    BD.Art.preload();

    $("btnPlay").addEventListener("click", function () { openPick("band"); });
    $("btnRules2").addEventListener("click", function () { $("rulesModal").classList.remove("hidden"); });
    /* 规则弹窗的关闭：必须页面加载时就绑好（原来绑在 ui.js 的 bindEvents 里，
       开局才执行 → 从主界面打开弹窗时「知道了」点了没反应）。
       「右上角 ✕」和「最下方 知道了」都能关；游戏内顶栏的「规则」按钮也在这里绑。 */
    function closeRules() { $("rulesModal").classList.add("hidden"); }
    $("btnRules").addEventListener("click", function () { $("rulesModal").classList.remove("hidden"); });
    $("btnCloseRules").addEventListener("click", closeRules);
    $("btnCloseRulesX").addEventListener("click", closeRules);

    var auto = qs("auto");
    if (qs("dragtest")) {
      var s = document.createElement("script");
      s.src = "tools/dragtest.js";
      document.body.appendChild(s);
    }
    if (qs("modaltest")) {
      var s2 = document.createElement("script");
      s2.src = "tools/modaltest.js";
      document.body.appendChild(s2);
    }
    if (auto) {
      var parts = auto.split("-");
      PICK.diff = qs("diff") || "normal";
      startGame(parts[0] || "MYGO", parts[1] || "AVE", PICK.diff);
      return;
    }
    if (qs("noboot")) {
      // 停在主界面：?noboot=1&pick=band 可以直接看选乐队那一步
      var p = qs("pick");
      if (p) openPick(p);
      return;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  BD.debug = { startGame: startGame, qs: qs, pick: PICK, exit: exitGame };
  BD.Main = { exit: exitGame, backToTitle: backToTitle };

})(typeof window !== "undefined" ? window : global);
