/* ============================================================
 *  dragtest.js —— 拖拽交互的自动化验证（只在 ?dragtest=1 时加载）
 *
 *  模拟真实的指针操作：
 *    1. 按住阵营里的成员 → 拖到舞台 → 松开  → 应该登台（花该成员的费）
 *    2. 按住舞台上的成员 → 拖到敌方成员   → 松开  → 应该开打（台上出手 2★）
 *    3. 按住舞台上的成员 → 拖回自己阵营   → 松开  → 应该下场
 *    4. 按住手牌 → 拖到目标成员身上 → 松开   → 出牌生效
 *    5. 无目标的牌：明显往上拖出手牌区 → 松开  → 打出
 *    6. 没拖出手牌区就松手 → 不该打出
 *    7. 同一成员本回合第二次对战 → 拒绝，并提示「本回合已经对战过了」
 *    8. 队长登台把闪耀值顶到达标 → 不等结束回合，立刻演结算并显示「优胜」
 *  结果写进 <html data-dragtest="...">
 * ========================================================== */
(function () {
  var BD = window.BD;
  var out = [];

  function log(name, ok, extra) {
    out.push((ok ? "PASS " : "FAIL ") + name + (extra ? " (" + extra + ")" : ""));
  }

  function fire(target, type, x, y) {
    var ev = new PointerEvent(type, {
      clientX: x, clientY: y, bubbles: true, cancelable: true,
      pointerId: 1, isPrimary: true, pointerType: "mouse",
      buttons: type === "pointerup" ? 0 : 1
    });
    target.dispatchEvent(ev);
  }

  function center(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: el };
  }

  function dragTo(fromEl, toEl) {
    var a = center(fromEl), b = center(toEl);
    fire(fromEl, "pointerdown", a.x, a.y);
    var steps = 6;
    for (var i = 1; i <= steps; i++) {
      fire(window, "pointermove", a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps);
    }
    fire(window, "pointerup", b.x, b.y);
  }

  function myMemberInCamp() {
    var g = BD.UI.game();
    var u = g.players[0].members.filter(function (m) { return m.zone === "camp"; })[0];
    return u ? document.querySelector('.member[data-uid="' + u.uid + '"]') : null;
  }
  function enemyOnStage() {
    var g = BD.UI.game();
    var u = g.stage.filter(function (m) { return m.owner === 1; })[0];
    return u ? { unit: u, el: document.querySelector('.member[data-uid="' + u.uid + '"]') } : null;
  }
  function mineOnStage() {
    var g = BD.UI.game();
    var u = g.stage.filter(function (m) { return m.owner === 0; })[0];
    return u ? { unit: u, el: document.querySelector('.member[data-uid="' + u.uid + '"]') } : null;
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function run() {
    var g = BD.UI.game();
    var E = BD.Engine;

    /* ---- 1. 登台 ---- */
    g.players[0].stars = 10;
    var el = myMemberInCamp();
    var uid = el ? +el.dataset.uid : 0;
    dragTo(el, document.getElementById("stageZone"));
    await wait(700);
    var u = E.unit(uid);
    log("拖动成员上台", u && u.zone === "stage", u ? u.zone : "?");
    log("登台扣该成员的费 " + E.moveCost(u) + "★", g.players[0].stars === 10 - E.moveCost(u), g.players[0].stars);

    /* ---- 2. 对战 ---- */
    // 让一个敌人也上台
    g.turn = 1;
    g.players[1].stars = 10;
    var foe = g.players[1].members.filter(function (m) { return m.zone === "camp" && !m.pinned && !m.suppressed; })[0];
    foe.movesLeft = 1;
    E.bind(g);
    E.moveMember(g, foe.uid, "stage");
    g.turn = 0;
    g.players[0].stars = 10;
    u.movesLeft = 1; u.attacksLeft = 1;
    BD.UI.render();
    await wait(120);

    var me2 = mineOnStage(), foe2 = enemyOnStage();
    var hpBefore = foe2.unit.vita;
    var atkCost = E.attackCost(me2.unit);
    dragTo(me2.el, foe2.el);
    await wait(800);
    log("拖动到敌方成员 = 对战", foe2.unit.vita < hpBefore,
        hpBefore + "→" + foe2.unit.vita);
    log("台上出手扣 " + atkCost + "★", g.players[0].stars === 10 - atkCost, g.players[0].stars);

    /* ---- 3. 下场 ---- */
    var me3 = mineOnStage();
    if (me3) {
      me3.unit.movesLeft = 1;
      BD.UI.render();
      await wait(80);
      var el3 = document.querySelector('.member[data-uid="' + me3.unit.uid + '"]');
      dragTo(el3, document.getElementById("laneSelf"));
      await wait(700);
      log("拖回自己阵营 = 下场", me3.unit.zone === "camp", me3.unit.zone);
    } else {
      log("拖回自己阵营 = 下场", false, "台上没有己方成员");
    }

    /* ---- 4. 拖牌到目标成员身上 = 出牌 ---- */
    g.players[0].stars = 10;
    g.players[0].hand = ["mygo_shichou"];
    var target = g.players[0].members.filter(function (m) { return m.zone !== "rest"; })[0];
    target.vita = 1;
    BD.UI.render();
    await wait(120);
    var cardEl = document.querySelector(".card");
    var targetEl = document.querySelector('.member[data-uid="' + target.uid + '"]');
    dragTo(cardEl, targetEl);
    await wait(800);
    var healAmt = BD.card("mygo_shichou").fx.filter(function (e) { return e.op === "heal"; })[0].amount;
    var wantVita = Math.min(target.maxVita, 1 + healAmt);
    log("拖牌到成员身上 = 出牌生效（回复 " + healAmt + "）", target.vita === wantVita, target.vita + " / 期望 " + wantVita);

    /* ---- 5. 无目标的牌：拖出手牌区 = 打出 ---- */
    g.players[0].stars = 10;
    g.players[0].hand = ["mygo_hitoshizuku"];      // 壱雫空：无需目标，闪耀 +3
    BD.UI.render();
    await wait(120);
    var spBefore = g.players[0].spark;
    var card2 = document.querySelector(".card");
    var hb = document.querySelector(".handbar").getBoundingClientRect();
    var a2 = center(card2);
    fire(card2, "pointerdown", a2.x, a2.y);
    [0.25, 0.5, 0.75, 1].forEach(function (t) {
      fire(window, "pointermove", a2.x, a2.y + (hb.top - 60 - a2.y) * t);
    });
    fire(window, "pointerup", a2.x, hb.top - 60);
    await wait(800);
    log("无目标的牌拖出手牌区 = 打出", g.players[0].spark === spBefore + 3, g.players[0].spark);

    /* ---- 6. 没拖出去就不该打出 ---- */
    g.players[0].stars = 10;
    g.players[0].hand = ["mygo_hitoshizuku"];
    BD.UI.render();
    await wait(120);
    var sp2 = g.players[0].spark;
    var card3 = document.querySelector(".card");
    var a3 = center(card3);
    fire(card3, "pointerdown", a3.x, a3.y);
    fire(window, "pointermove", a3.x + 12, a3.y - 8);
    fire(window, "pointerup", a3.x + 12, a3.y - 8);
    await wait(400);
    log("没拖出手牌区 = 不打出", g.players[0].spark === sp2 && g.players[0].hand.length === 1,
        "spark " + g.players[0].spark + " / hand " + g.players[0].hand.length);

    /* ---- 7. 同一成员本回合第二次对战：应该被拒绝，而且要说出原因 ---- */
    g.players[0].stars = 10;
    var meU7 = g.players[0].members.filter(function (m) { return m.zone === "camp"; })[0];
    var foeU7 = g.stage.filter(function (m) { return m.owner === 1; })[0];
    if (meU7 && foeU7) {
      meU7.attacksLeft = 0;                 // 装成本回合已经打过了
      BD.UI.render();
      await wait(150);
      var meEl7 = document.querySelector('.member[data-uid="' + meU7.uid + '"]');
      var foeEl7 = document.querySelector('.member[data-uid="' + foeU7.uid + '"]');
      var hp7 = foeU7.vita;
      dragTo(meEl7, foeEl7);
      await wait(600);
      var t7 = document.getElementById("toast");
      log("本回合已对战过 → 拒绝并给出原因",
          foeU7.vita === hp7 && /已经对战/.test(t7 ? t7.textContent : ""),
          "活力 " + hp7 + "→" + foeU7.vita + " / 提示=" + (t7 ? t7.textContent : "-"));
    } else {
      log("本回合已对战过 → 拒绝并给出原因", false, "找不到可测的成员");
    }

    /* ---- 8. 闪耀值一达标就立刻演出结算，不用等结束回合 ---- */
    var goal = BD.RULES ? BD.RULES.SPARK_GOAL : 50;
    var cap = g.players[0].members.filter(function (m) { return m.leader; })[0];
    if (cap.zone === "stage") { cap.movesLeft = 1; g.players[0].stars = 10; E.moveMember(g, cap.uid, "camp"); }
    if (cap.zone === "rest") { cap.restLeft = 0; E.wakeUp(g, cap); }
    cap.movesLeft = 1;
    g.players[0].stars = 10;
    g.players[0].spark = goal - 1;
    BD.UI.render();
    await wait(150);

    var capEl = document.querySelector('.member[data-uid="' + cap.uid + '"]');
    var sz = document.getElementById("stageZone");
    var sr = sz.getBoundingClientRect();
    var a8 = center(capEl);
    /* 找一个「确实落在舞台里、且没压到任何成员卡」的落点：
       小视口下台面下沿会被手牌区盖住，写死坐标会误判成「没拖到舞台」 */
    var b8 = { x: sr.left + sr.width / 2, y: sr.bottom - 26 };
    (function () {
      var xs = [sr.left + 18, sr.left + sr.width * .25, sr.left + sr.width / 2, sr.right - 18];
      var ys = [sr.top + 14, sr.bottom - 14, sr.top + sr.height / 2];
      for (var i = 0; i < ys.length; i++) {
        for (var j = 0; j < xs.length; j++) {
          var x = xs[j], y = ys[i];
          var el = document.elementFromPoint(x, y);
          if (el && el.closest && el.closest("#stageZone") &&
              !el.closest(".member") && !el.closest(".handbar")) {
            b8 = { x: x, y: y }; return;
          }
        }
      }
    })();
    fire(capEl, "pointerdown", a8.x, a8.y);
    for (var i8 = 1; i8 <= 6; i8++) {
      fire(window, "pointermove", a8.x + (b8.x - a8.x) * i8 / 6, a8.y + (b8.y - a8.y) * i8 / 6);
    }
    fire(window, "pointerup", b8.x, b8.y);
    await wait(400);
    log("队长登台 → 闪耀值立刻达标并结束对局", cap.zone === "stage" && g.over === true,
        "zone=" + cap.zone + " spark=" + g.players[0].spark + " over=" + g.over +
        " / canMove=" + JSON.stringify(E.canMove(g, cap.uid, "stage")) +
        " / stars=" + g.players[0].stars + " / turn=" + g.turn +
        " / toast=" + (document.getElementById("toast") ? document.getElementById("toast").textContent : "-"));
    await wait(2600);

    var modal = document.getElementById("endModal");
    var verdict = document.getElementById("endVerdict");
    log("闪耀值达标 → 立刻演出并弹「优胜」",
        g.over === true && !modal.classList.contains("hidden") && verdict.textContent === "优胜",
        "over=" + g.over + " / 弹窗=" + (modal.classList.contains("hidden") ? "没弹" : "已弹") +
        " / 判定=" + verdict.textContent);

    document.documentElement.setAttribute("data-dragtest", out.join(" | "));
    document.title = out.every(function (x) { return x.indexOf("PASS") === 0; }) ? "DRAGTEST OK" : "DRAGTEST FAIL";
  }

  /* ?cardshot=1：把牌拖到一半停住，方便截图看拖卡的样子 */
  if (/cardshot=1/.test(location.search)) {
    setTimeout(function () {
      var g = BD.UI.game();
      g.players[0].stars = 10;
      g.players[0].hand = ["ave_kuro"];
      BD.UI.render();
      setTimeout(function () {
        var el = document.querySelector(".card");
        var target = document.querySelector(".member.foe");
        if (!el || !target) { document.title = "CARDSHOT MISS"; return; }
        var a = center(el), b = center(target);
        fire(el, "pointerdown", a.x, a.y);
        [0.3, 0.6, 0.85].forEach(function (t) {
          fire(window, "pointermove", a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        });
        document.title = "CARDSHOT";
      }, 260);
    }, 400);
    return;
  }

  /* ?dragshot=1：只把箭头拉出来停住，方便截图看星星箭头流 */
  if (/dragshot=1/.test(location.search)) {
    setTimeout(function () {
      var g = BD.UI.game();
      g.players[0].stars = 10;
      var el = myMemberInCamp();
      var a = center(el);
      var b = center(document.getElementById("stageZone"));
      fire(el, "pointerdown", a.x, a.y);
      [0.25, 0.5, 0.75, 1].forEach(function (t) {
        fire(window, "pointermove", a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - 40 * t);
      });
      document.title = "DRAGSHOT";
    }, 500);
    return;
  }

  setTimeout(function () { run().catch(function (e) { document.title = "DRAGTEST ERROR " + e.message; }); }, 500);
})();
