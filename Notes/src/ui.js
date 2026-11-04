/* ============================================================
 *  ui.js —— 渲染 / 交互 / 动画编排
 *
 *  交互约定：
 *    · 按住自己的成员拖出去  → 星星箭头流
 *        拖到舞台上   = 登台（花该成员的费）
 *        拖回自己阵营 = 下场（花该成员的费）
 *        拖到敌方成员 = 对战（台上出手 2★ / 从阵营出手 3★）
 *    · 按住手牌拖到目标身上（或明显拖出手牌区）= 打出剪影卡
 * ========================================================== */
(function (root) {
  "use strict";
  var BD = root.BD;
  var E = function () { return BD.Engine; };
  var R = function () { return BD.RULES; };

  var G = null;
  var busy = 0;
  var sel = null;      // {type:'card', idx} | {type:'member', uid}
  var drag = null;
  var rafId = 0;
  var dragEndAt = 0;          // 刚拖完的时间戳，用来吞掉紧跟的 click
  var dragGhost = null;       // 拖着走的卡影

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function bandOf(k) { return BD.BANDS[k] || BD.BANDS.NEU; }
  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  /* ============================================================
   *  小工具：锁 / 提示 / 飘字 / 粒子
   * ========================================================== */
  function lock() { busy++; document.body.classList.add("busy"); }
  function unlock(all) { busy = all ? 0 : Math.max(0, busy - 1); if (!busy) document.body.classList.remove("busy"); }
  function isBusy() { return busy > 0; }

  var endShown = false;         // 结算演出只播一次
  function checkEndNow() {
    if (!G) return false;
    if (!G.over) E().checkOver(G);      // 万一引擎侧还没判定，这里补一次
    if (G.over) { if (!endShown) showEnd(); return true; }
    return false;
  }

  var toastTimer = 0;
  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1700);
  }

  function banner(text, sub) {
    var b = $("banner");
    if (!b) return;
    b.innerHTML = "<b>" + esc(text) + "</b>" + (sub ? "<i>" + esc(sub) + "</i>" : "");
    b.classList.remove("show");
    void b.offsetWidth;
    b.classList.add("show");
  }

  function floatNum(x, y, text, cls) {
    var d = document.createElement("div");
    d.className = "floatnum " + (cls || "");
    d.textContent = text;
    d.style.left = x + "px";
    d.style.top = y + "px";
    $("fxLayer").appendChild(d);
    setTimeout(function () { d.remove(); }, 1050);
  }

  function burst(x, y, color, n, spread) {
    var layer = $("fxLayer");
    n = n || 16;
    spread = spread || 90;
    for (var i = 0; i < n; i++) {
      var s = document.createElement("i");
      s.className = "pt";
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.background = color;
      layer.appendChild(s);
      var ang = Math.random() * Math.PI * 2;
      var dist = 30 + Math.random() * spread;
      var dx = Math.cos(ang) * dist;
      var dy = Math.sin(ang) * dist - 24;
      s.animate(
        [{ transform: "translate(0,0) scale(1)", opacity: 1 },
         { transform: "translate(" + dx + "px," + dy + "px) scale(.15)", opacity: 0 }],
        { duration: 560 + Math.random() * 460, easing: "cubic-bezier(.2,.8,.3,1)" }
      );
      (function (el) { setTimeout(function () { el.remove(); }, 1200); })(s);
    }
  }

  function starFly(x, y, n, up) {
    var layer = $("fxLayer");
    for (var i = 0; i < (n || 5); i++) {
      var s = document.createElement("div");
      s.className = "starfly";
      s.textContent = "★";
      s.style.left = (x + (Math.random() * 40 - 20)) + "px";
      s.style.top = y + "px";
      s.style.setProperty("--sx", (Math.random() * 60 - 30) + "px");
      s.style.setProperty("--sy", ((up ? -1 : 1) * (50 + Math.random() * 50)) + "px");
      s.style.animationDelay = (i * 0.05) + "s";
      layer.appendChild(s);
      (function (el) { setTimeout(function () { el.remove(); }, 1150); })(s);
    }
  }

  function confetti() {
    var layer = $("fxLayer");
    var wrap = document.createElement("div");
    wrap.className = "confetti";
    var colors = ["#ff4d8d", "#ffd166", "#5ad2ff", "#b45cff", "#4ade80", "#ff5a3c"];
    for (var i = 0; i < 90; i++) {
      var c = document.createElement("i");
      c.style.left = (Math.random() * 100) + "%";
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (1.8 + Math.random() * 1.6) + "s";
      c.style.animationDelay = (Math.random() * 0.9) + "s";
      wrap.appendChild(c);
    }
    layer.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 4200);
  }

  /* FLIP：把元素从旧位置"飞"到现在的位置 */
  function flipFrom(el, oldRect, dur) {
    if (!el || !oldRect) return;
    var r = el.getBoundingClientRect();
    var dx = oldRect.left - r.left;
    var dy = oldRect.top - r.top;
    var sx = oldRect.width / Math.max(1, r.width);
    el.animate(
      [{ transform: "translate(" + dx + "px," + dy + "px) scale(" + sx.toFixed(3) + ")" },
       { transform: "translate(0,0) scale(1)" }],
      { duration: dur || 420, easing: "cubic-bezier(.2,.85,.25,1)" }
    );
  }

  /* ============================================================
   *  渲染
   * ========================================================== */
  function memberHTML(u) {
    var b = bandOf(u.band);
    var sk = E().skillOf(u);
    var pct = Math.max(0, Math.min(100, u.vita / u.maxVita * 100));
    var cls = ["member"];
    cls.push(u.owner === 0 ? "mine" : "foe");
    if (u.zone === "stage") cls.push("onstage");
    if (u.zone === "rest") cls.push("rest");
    if (u.tempSkill > 0) cls.push("buffed");
    if (u.shield > 0) cls.push("shielded");
    if (u.suppressed) cls.push("sup");
    if (u.pinned) cls.push("pin");
    if (u.veil) cls.push("veil");

    var badges = "";
    if (u.shield > 0) badges += '<span class="bd bd-shield" title="台风：受到的伤害 -' + u.shield + '">台' + u.shield + "</span>";
    if (u.tempSkill > 0) badges += '<span class="bd bd-buff" title="本回合技能值 +' + u.tempSkill + '">+' + u.tempSkill + "</span>";
    /* 怯场不再放小角标：整张卡会盖一层紫色遮罩（见下面的 .stunmask），足够醒目 */
    if (u.pinned) badges += '<span class="bd bd-pin" title="禁演：无法移动，也无法对战">禁</span>';
    if (u.veil) badges += '<span class="bd bd-veil" title="回避：这一回合无法被作为对战目标">回</span>';
    if (G && G.turn === u.owner && u.zone !== "rest" && u.attacksLeft <= 0) {
      badges += '<span class="bd bd-done" title="本回合已经对战过了">战</span>';
      cls.push("spent");
    }

    var mc = E().moveCost(u);
    return '<div class="' + cls.join(" ") + '" data-uid="' + u.uid + '" style="--band:' + b.color + ";--bandsoft:" + b.soft + '">' +
             '<div class="mhalo"></div>' +
             '<div class="mcost" title="行动费：登台／下场花 ' + mc + ' 颗星星"><b>' + mc + "</b><span>★</span></div>" +
             (u.leader ? '<div class="mcrown" title="队长：登台额外 +1 闪耀值">队长</div>' : "") +
             '<div class="mfig">' + BD.Art.figure(u.def || u) + "</div>" +
             '<div class="badges">' + badges + "</div>" +
             '<div class="mname">' + esc(u.name) + "</div>" +
             ((u.def && u.def.mask) ? '<div class="mmask">' + esc(u.def.mask) + "</div>" : "") +
             '<div class="mstat">' +
               '<span class="sk" title="技能值（攻击力）">♪ <b>' + sk + "</b></span>" +
               '<span class="vt" title="活力值（生命值）">' + u.vita + "/" + u.maxVita + "</span>" +
             "</div>" +
             '<div class="vbar"><i style="width:' + pct + '%"></i></div>' +
             (u.zone === "rest" ? '<div class="restmask"><b>' + (u.restLeft > 0 ? "休息" : "待回场") +
               '</b><span>' + Math.max(0, u.restLeft) + "</span></div>" : "") +
             (u.suppressed && u.zone !== "rest" ? '<div class="stunmask" title="怯场：它的下一个回合完全无法行动（不能移动／对战，也不计入闪耀结算）">' +
               '<b>怯 场</b><span>无法行动</span><i>1 回合</i></div>' : "") +
           "</div>";
  }

  function slotHTML(u) {
    var b = bandOf(u.band);
    return '<div class="mslot" data-uid="' + u.uid + '" style="--band:' + b.color + '">' +
             "<b>" + esc(u.name) + "</b><span>舞台上</span>" +
           "</div>";
  }

  function cardHTML(c, idx, opt) {
    opt = opt || {};
    var b = bandOf(c.band);
    var cls = ["card"];
    if (opt.dis) cls.push("dis");
    if (sel && sel.type === "card" && sel.idx === idx) cls.push("sel");
    return '<div class="' + cls.join(" ") + '" data-idx="' + idx + '" style="--band:' + b.color + ";--bandsoft:" + b.soft + '">' +
             '<div class="cost">' + c.cost + "</div>" +
             '<div class="cart">' + BD.Art.symbol(c.art) + "</div>" +
             '<div class="cname">' + esc(c.name) + "</div>" +
             '<div class="ctext">' + esc(c.text) + "</div>" +
             '<div class="cband">' + esc(b.name) + "</div>" +
           "</div>";
  }

  function actorHTML(idx) {
    var p = G.players[idx], b = bandOf(p.band);
    var pct = Math.min(100, p.spark / R().SPARK_GOAL * 100);
    var pips = "";
    for (var i = 0; i < p.starsMax; i++) pips += '<i class="' + (i < p.stars ? "on" : "") + '">★</i>';
    var onStage = E().stageMembers(G, idx).length;
    var resting = E().membersOf(G, idx, "rest").length;
    return '<div class="actor-inner" style="--band:' + b.color + ";--bandsoft:" + b.soft + '">' +
             '<div class="aband">' + esc(b.name) + "</div>" +
             '<div class="aspark">' +
               '<span class="lab">闪耀</span>' +
               '<div class="sbar"><i style="width:' + pct + '%"></i></div>' +
               '<span class="sv"><b>' + p.spark + "</b>/" + R().SPARK_GOAL + "</span>" +
             "</div>" +
             '<div class="ameta">' +
               '<span class="stars" title="星星">' + pips + "<em>" + p.stars + "/" + p.starsMax + "</em></span>" +
               '<span class="tag">台上 ' + onStage + "</span>" +
               (resting ? '<span class="tag rest">休息 ' + resting + "</span>" : "") +
             "</div>" +
           "</div>";
  }

  /* 写 innerHTML 前先比一下：一模一样就不动 DOM。
     整个棋盘原来每步操作都全量重建（弱机上单次 render 要 30ms），
     现在没变化的部分直接跳过 */
  function setHTML(el, html) {
    if (!el || el.__h === html) return false;
    el.__h = html;
    el.innerHTML = html;
    return true;
  }

  /* 成员卡签名：这些字段之外的渲染结果不会变 */
  function memberSig(u) {
    return [u.owner, u.zone, u.vita, u.maxVita, u.tempSkill, u.shield,
            u.suppressed ? 1 : 0, u.pinned ? 1 : 0, u.veil ? 1 : 0, u.attacksLeft, u.restLeft,
            G.turn === u.owner ? 1 : 0].join("|");
  }

  /* 按 uid 复用已有卡片元素：只重建真正变了的那个，图片不会被反复销毁重建。
     asSlot = 在阵营里时"人已上台"画成虚位；舞台行里永远画真人。 */
  function syncMembers(box, list, asSlot) {
    if (!box) return;
    var keep = {}, kids = box.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i].getAttribute("data-uid");
      if (k) keep[k] = kids[i];
    }
    var seq = [];
    list.forEach(function (u) {
      var isSlot = !!asSlot && u.zone === "stage";
      var sig = (isSlot ? "slot|" : "") + memberSig(u);
      var el = keep[u.uid];
      if (el && el.__sig === sig && el.__slot === isSlot) {
        delete keep[u.uid];
        seq.push(el);
        return;
      }
      var tmp = document.createElement("div");
      tmp.innerHTML = isSlot ? slotHTML(u) : memberHTML(u);
      var nu = tmp.firstChild;
      if (!nu) return;
      nu.__sig = sig;
      nu.__slot = isSlot;
      if (el && el.parentNode === box) box.replaceChild(nu, el);
      delete keep[u.uid];
      seq.push(nu);
    });
    Object.keys(keep).forEach(function (id) {
      var el = keep[id];
      if (el.parentNode === box) box.removeChild(el);
    });
    var cur = box.firstChild;
    seq.forEach(function (el) {
      if (el === cur) { cur = cur.nextSibling; return; }
      box.insertBefore(el, cur);
    });
  }

  function renderTop() {
    setHTML($("enemyInfo"), actorHTML(1));
    setHTML($("selfInfo"), actorHTML(0));
    $("turnNo").textContent = "第 " + G.turnNum + " 幕";
    $("btnEnd").classList.toggle("urge", G.turn === 0 && !G.over);
  }

  function renderBoard() {
    syncMembers($("enemyCamp"), G.players[1].members, true);
    syncMembers($("selfCamp"), G.players[0].members, true);
    syncMembers($("stageRow"), G.stage, false);
    $("stageZone").classList.toggle("empty", G.stage.length === 0);
    $("stageCount").textContent = G.stage.length + " / " + R().STAGE_SLOTS;

    renderSelfStars();
    $("laneSelf").classList.toggle("active", G.turn === 0 && !G.over);
    $("laneEnemy").classList.toggle("active", G.turn === 1 && !G.over);
  }

  /* 自己阵营旁边的大号星星 */
  function renderSelfStars() {
    var box = $("selfStars");
    if (!box) return;
    var p = G.players[0];
    var pips = "";
    for (var i = 0; i < p.starsMax; i++) pips += '<i class="' + (i < p.stars ? "on" : "") + '">★</i>';
    setHTML(box,
      '<div class="bsnum"><b>' + p.stars + "</b><em>/" + p.starsMax + "</em></div>" +
      '<div class="bspips">' + pips + "</div>" +
      '<div class="bslab">星星</div>');
    box.classList.toggle("full", p.stars >= p.starsMax);
    box.classList.toggle("low", p.stars < 2);
  }

  function renderHand() {
    var p = G.players[0], html = "", n = p.hand.length;
    p.hand.forEach(function (id, i) {
      var c = BD.card(id);
      var rot = (i - (n - 1) / 2) * 2.6;
      var lift = Math.abs(i - (n - 1) / 2) * 3;
      html += '<div class="cardslot" style="--rot:' + rot.toFixed(2) + "deg;--lift:" + lift.toFixed(1) + 'px">' +
                cardHTML(c, i, { dis: p.stars < c.cost }) +
              "</div>";
    });
    setHTML($("hand"), html);
    $("deckN").textContent = p.deck.length;
    $("discN").textContent = p.discard.length;
    $("enemyHandN").textContent = G.players[1].hand.length;
  }

  function renderLog() {
    var html = "";
    G.log.slice(-40).forEach(function (l) {
      html += '<div class="lg s' + l.side + '">' + esc(l.text) + "</div>";
    });
    if (setHTML($("logpane"), html)) $("logpane").scrollTop = 99999;
  }

  function renderDetail() {
    var d = $("detail");
    if (sel && sel.type === "card") {
      var c = BD.card(G.players[0].hand[sel.idx]);
      if (c) { setHTML(d, cardDetailHTML(c)); return; }
    }
    if (sel && sel.type === "member") {
      var u = E().unit(sel.uid);
      if (u) { setHTML(d, memberDetailHTML(u)); return; }
    }
    var gain = E().sparkGainFor(G, 0);
    var ac = R().COST_ATTACK_STAGE, cc = R().COST_ATTACK_CAMP;
    setHTML(d,
      '<div class="dhint">' +
        "<p><b>拖动自己的成员</b>：拖到舞台 = 登台（花该成员的费，见成员卡左上角），" +
        "拖回阵营 = 下场，拖到敌方成员 = 对战。" +
        "<br>站在<b>舞台上</b>出手 <b>" + ac + "★</b>；从<b>自己阵营</b>打台上的敌人 <b>" + cc + "★</b>。</p>" +
        "<p><b>拖动手牌</b>：需要目标的卡，拖到目标成员身上松手；不需要目标的卡，明显往上拖出手牌区再松手。</p>" +
        '<p class="dim">本回合结束时：台上 ' + E().stageMembers(G, 0).length + " 人 → 闪耀值 +" + gain + "。</p>" +
      "</div>");
  }

  function cardDetailHTML(c) {
    var b = bandOf(c.band);
    return '<div class="dcard" style="--band:' + b.color + ";--bandsoft:" + b.soft + '">' +
             '<div class="dcart">' + BD.Art.symbol(c.art) + "</div>" +
             '<div class="dname">' + esc(c.name) + "</div>" +
             '<div class="dmrow"><span class="chip">' + esc(b.name) + '</span><span class="chip cost">' + c.cost + " ★</span></div>" +
             '<div class="dtext">' + esc(c.text) + "</div>" +
             '<div class="dhint2">' + esc(BD.TARGET_HINT[c.target || "none"]) + "</div>" +
           "</div>";
  }

  function memberDetailHTML(u) {
    var b = bandOf(u.band);
    var role = BD.ROLES[u.role] || {};
    return '<div class="dcard" style="--band:' + b.color + ";--bandsoft:" + b.soft + '">' +
             '<div class="dcart">' + BD.Art.figure(u.def || u) + "</div>" +
             '<div class="dname">' + esc(u.name) + "</div>" +
             '<div class="dmrow"><span class="chip">' + esc(b.name) + '</span><span class="chip">' + esc(role.cn || "") + "</span></div>" +
             '<div class="dtext">技能值 <b>' + E().skillOf(u) + "</b>　活力值 <b>" + u.vita + "/" + u.maxVita + "</b></div>" +
             '<div class="dtext dim">登台 / 下场 <b>' + E().moveCost(u) + "★</b>　·　对战 <b>" + E().attackCost(u) + "★</b>" +
               (u.zone === "camp" ? "（从阵营出手）" : u.zone === "stage" ? "（台上出手）" : "") + "</div>" +
             '<div class="dtext dim">' + esc((u.def && u.def.line) || "") + "</div>" +
             '<div class="dhint2">' + (u.zone === "rest" ? "休息中，还剩 " + u.restLeft + " 回合" :
                u.zone === "stage" ? "正在舞台上" : "在自己阵营待命") + "</div>" +
           "</div>";
  }

  function renderHighlights() {
    document.querySelectorAll(".member").forEach(function (el) { el.classList.remove("tg", "dim", "sel"); });
    $("stageZone").classList.remove("dropok");
    $("laneSelf").classList.remove("dropok");

    if (sel && sel.type === "card") {
      var c = BD.card(G.players[0].hand[sel.idx]);
      if (c) {
        document.querySelectorAll(".member").forEach(function (el) {
          var uid = +el.dataset.uid;
          if (BD.Effects.legalTarget(G, c, uid)) el.classList.add("tg");
          else el.classList.add("dim");
        });
      }
    } else if (sel && sel.type === "member") {
      var u = E().unit(sel.uid);
      if (u && u.owner === 0) {
        var legal = E().attackableTargets(G, u.uid);
        document.querySelectorAll(".member").forEach(function (el) {
          if (legal.indexOf(+el.dataset.uid) >= 0) el.classList.add("tg");
        });
        if (E().canMove(G, u.uid, "stage").ok) $("stageZone").classList.add("dropok");
        if (E().canMove(G, u.uid, "camp").ok) $("laneSelf").classList.add("dropok");
        var own = document.querySelector('.member[data-uid="' + u.uid + '"]');
        if (own) own.classList.add("sel");
      }
    }
  }

  function render() {
    renderTop();
    renderBoard();
    renderHand();
    renderLog();
    renderDetail();
    renderHighlights();
  }

  /* ============================================================
   *  动作 + 动画
   * ========================================================== */
  function rectOfUid(uid) {
    var el = document.querySelector('.member[data-uid="' + uid + '"]');
    return el ? el.getBoundingClientRect() : null;
  }
  function elOfUid(uid) { return document.querySelector('.member[data-uid="' + uid + '"]'); }

  function sweepSpot() {
    var z = $("stageZone");
    if (!z) return;
    var s = document.createElement("div");
    s.className = "spot";
    z.appendChild(s);
    setTimeout(function () { s.remove(); }, 1000);
  }

  function doMove(uid, toZone) {
    if (isBusy() || G.over || G.turn !== 0) return;
    var before = rectOfUid(uid);
    var res = E().moveMember(G, uid, toZone);
    if (!res.ok) { toast(res.why); return; }
    sel = null;
    render();
    var el = elOfUid(uid);
    flipFrom(el, before, 520);
    if (el) {
      var c = center(el.getBoundingClientRect());
      burst(c.x, c.y + 34, bandOf(res.unit.band).color, 14, 70);
    }
    if (toZone === "stage") {
      sweepSpot();
      var sr = $("selfInfo").getBoundingClientRect();
      starFly(sr.left + 40, sr.top + 56, 3, true);
    }
    checkEndNow();
  }

  function doAttack(aUid, tUid) {
    if (isBusy() || G.over || G.turn !== 0) return;
    var aRect = rectOfUid(aUid), tRect = rectOfUid(tUid);
    var res = E().attack(G, aUid, tUid);
    if (!res.ok) { toast(res.why); return; }
    sel = null;

    var ac = center(aRect), tc = center(tRect);
    var dx = (tc.x - ac.x) * 0.45, dy = (tc.y - ac.y) * 0.45;
    render();

    var aEl = elOfUid(aUid), tEl = elOfUid(tUid);
    if (aEl) {
      aEl.classList.add("lunge");
      aEl.style.setProperty("--dx", dx.toFixed(1) + "px");
      aEl.style.setProperty("--dy", dy.toFixed(1) + "px");
      setTimeout(function () { aEl.classList.remove("lunge"); }, 480);
    }
    lock();
    setTimeout(function () {
      if (tEl) {
        tEl.classList.add("hit");
        setTimeout(function () { tEl.classList.remove("hit"); }, 460);
        var r = tEl.getBoundingClientRect();
        floatNum(r.left + r.width / 2, r.top + 30, (res.real > 0 ? "-" + res.real : "挡下"), res.real > 0 ? "dmg" : "star");
        burst(r.left + r.width / 2, r.top + r.height / 2, "#ff5470", 16, 80);
      }
      var sr = $("selfInfo").getBoundingClientRect();
      starFly(sr.left + 40, sr.top + 56, 3, true);
      if (res.ko) {
        document.body.classList.add("quake");
        setTimeout(function () { document.body.classList.remove("quake"); }, 360);
        setTimeout(function () { koAnim(tUid, tRect); }, 60);
      }
      unlock();
    }, 240);
  }

  function koAnim(uid, oldRect) {
    var el = elOfUid(uid);
    if (!el) return;
    var r = el.getBoundingClientRect();
    var dx = oldRect.left - r.left, dy = oldRect.top - r.top;
    el.animate(
      [{ transform: "translate(" + dx + "px," + dy + "px) scale(1) rotate(0deg)", opacity: 1, filter: "grayscale(0)" },
       { transform: "translate(" + (dx * 0.4) + "px," + (dy * 0.4 + 12) + "px) scale(.86) rotate(-7deg)", opacity: .9, filter: "grayscale(.7)", offset: .45 },
       { transform: "translate(0,0) scale(.72) rotate(4deg)", opacity: 1, filter: "grayscale(1)" }],
      { duration: 620, easing: "cubic-bezier(.3,.8,.3,1)" }
    );
    el.classList.add("ko");
    var c = center(r);
    floatNum(c.x, c.y - 10, "退场休息", "rest");
    setTimeout(function () { el.classList.remove("ko"); render(); }, 700);
  }

  function wakeAnim(uid) {
    var el = elOfUid(uid);
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.animate(
      [{ transform: "translateY(26px) scale(.7)", opacity: 0, filter: "brightness(.4)" },
       { transform: "translateY(0) scale(1)", opacity: 1, filter: "brightness(1)" }],
      { duration: 680, easing: "cubic-bezier(.2,.9,.25,1.2)" }
    );
    burst(r.left + r.width / 2, r.top + r.height / 2, "#ffd166", 20, 90);
    floatNum(r.left + r.width / 2, r.top + 20, "满活力回归", "heal");
  }

  function doPlayCard(idx, targetUid) {
    if (isBusy() || G.over || G.turn !== 0) return;
    var p = G.players[0];
    var id = p.hand[idx];
    var c = BD.card(id);
    if (!c) return;

    if (BD.Effects.needsTarget(c) && targetUid == null) {
      sel = (sel && sel.type === "card" && sel.idx === idx) ? null : { type: "card", idx: idx };
      render();
      if (sel) toast(BD.TARGET_HINT[c.target] + "（高亮的就是可选目标）");
      return;
    }

    var cardEl = document.querySelector('.card[data-idx="' + idx + '"]');
    var fromRect = cardEl ? cardEl.getBoundingClientRect() : null;
    var tRect = targetUid != null ? rectOfUid(targetUid) : null;

    var res = E().playCard(G, idx, targetUid);
    if (!res.ok) {
      if (res.needTarget) { sel = { type: "card", idx: idx }; render(); toast(BD.TARGET_HINT[c.target]); }
      else toast(res.why);
      return;
    }
    sel = null;

    if (fromRect) {
      var to = tRect || $("stageZone").getBoundingClientRect();
      var ghost = document.createElement("div");
      ghost.className = "ghost";
      ghost.style.left = fromRect.left + "px";
      ghost.style.top = fromRect.top + "px";
      ghost.style.width = fromRect.width + "px";
      ghost.style.height = fromRect.height + "px";
      ghost.innerHTML = '<div class="gh-inner" style="--band:' + bandOf(c.band).color + '">' + cardHTML(c, -1) + "</div>";
      $("fxLayer").appendChild(ghost);
      var tc = center(to);
      requestAnimationFrame(function () {
        ghost.style.transform = "translate(" + (tc.x - fromRect.width / 2 - fromRect.left) + "px," +
                                               (tc.y - fromRect.height / 2 - fromRect.top) + "px) scale(.55) rotate(6deg)";
        ghost.style.opacity = "0";
      });
      setTimeout(function () { ghost.remove(); }, 480);
    }

    lock();
    setTimeout(function () {
      var b = bandOf(c.band);
      var target = tRect ? center(tRect) : center($("stageZone").getBoundingClientRect());
      burst(target.x, target.y, b.color, 20, 100);
      (res.events || []).forEach(function (ev) { playEvent(ev); });
      render();
      unlock();
      checkEndNow();
    }, 300);
  }

  function playEvent(ev) {
    var el = ev.uid != null ? elOfUid(ev.uid) : null;
    var r = el ? el.getBoundingClientRect() : null;
    var cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
    var cy = r ? r.top + r.height / 2 : window.innerHeight / 2;
    switch (ev.type) {
      case "dmg":
        floatNum(cx, r ? r.top + 24 : cy, "-" + ev.amount, "dmg");
        if (el) { el.classList.add("hit"); setTimeout(function () { el.classList.remove("hit"); }, 460); }
        if (ev.ko) {
          document.body.classList.add("quake");
          setTimeout(function () { document.body.classList.remove("quake"); }, 360);
          setTimeout(function () { koAnim(ev.uid, r); }, 80);
        }
        break;
      case "heal":
        floatNum(cx, r ? r.top + 24 : cy, "+" + ev.amount, "heal");
        break;
      case "buff":
        floatNum(cx, r ? r.top + 24 : cy, "♪+" + ev.amount, "buff");
        break;
      case "shield":
        floatNum(cx, r ? r.top + 24 : cy, "台风 +" + ev.amount, "star");
        break;
      case "rally":
        floatNum(cx, r ? r.top + 24 : cy, "再来一次", "heal");
        break;
      case "cleanse":
        floatNum(cx, r ? r.top + 24 : cy, "净化", "heal");
        break;
      case "mark":
        floatNum(cx, r ? r.top + 24 : cy,
          ev.mark === "pin" ? "禁演" : ev.mark === "veil" ? "回避" : "怯场", "star");
        break;
      case "wake":
        render();
        wakeAnim(ev.uid);
        break;
      case "spark":
        sparkPop(ev.idx, ev.amount);
        break;
      case "star":
        var pr = (ev.idx === 0 ? $("selfInfo") : $("enemyInfo")).getBoundingClientRect();
        starFly(pr.left + 40, pr.top + 50, Math.min(6, ev.amount), false);
        break;
      case "clearStage":
        /* 谢幕：幕布降下 + 每张卡飞回阵营。
           render() 马上会把原卡从舞台移走，所以用克隆副本播动画，不受增量渲染影响。 */
        (function () {
          var layer = $("fxLayer");
          var sz = $("stageZone");
          var sr = sz ? sz.getBoundingClientRect() : null;
          if (sr && layer) {
            var curtain = document.createElement("div");
            curtain.className = "curtainfx";
            curtain.style.left = sr.left + "px";
            curtain.style.top = sr.top + "px";
            curtain.style.width = sr.width + "px";
            curtain.style.height = sr.height + "px";
            layer.appendChild(curtain);
            if (curtain.animate) curtain.animate(
              [{ transform: "scaleY(0)", opacity: .8 },
               { transform: "scaleY(1)", opacity: .9, offset: .45 },
               { transform: "scaleY(0)", opacity: 0 }],
              { duration: 760, easing: "ease-in-out" }
            );
            setTimeout(function () { curtain.remove(); }, 820);
            floatNum(sr.left + sr.width / 2, sr.top + 30, "谢幕 · 全员退场", "spark");
          }
          (ev.uids || []).forEach(function (uid, i) {
            var e = elOfUid(uid);
            if (!e || !layer) return;
            var rr = e.getBoundingClientRect();
            var c2 = center(rr);
            burst(c2.x, c2.y, "#b45cff", 10, 60);
            var gh = e.cloneNode(true);
            gh.classList.add("clearghost");
            gh.style.left = rr.left + "px";
            gh.style.top = rr.top + "px";
            gh.style.width = rr.width + "px";
            gh.style.height = rr.height + "px";
            layer.appendChild(gh);
            var dy = e.classList.contains("foe") ? -150 : 150;
            if (gh.animate) gh.animate(
              [{ transform: "translate(0,0) scale(1)", opacity: 1 },
               { transform: "translate(0," + dy + "px) scale(.55)", opacity: 0 }],
              { duration: 520, delay: i * 45, easing: "cubic-bezier(.3,.8,.3,1)", fill: "forwards" }
            );
            setTimeout(function () { gh.remove(); }, 900 + i * 45);
          });
        })();
        break;
    }
  }

  function sparkPop(idx, amount) {
    var box = idx === 0 ? $("selfInfo") : $("enemyInfo");
    if (!box) return;
    var r = box.getBoundingClientRect();
    floatNum(r.left + r.width / 2, r.top + 26, "闪耀 +" + amount, "spark");
    burst(r.left + r.width / 2, r.top + 44, "#ffd166", 18, 80);
    var bar = box.querySelector(".sbar i");
    if (bar && bar.animate) bar.animate([{ filter: "brightness(2.4)" }, { filter: "brightness(1)" }], { duration: 700 });
  }

  /* ============================================================
   *  回合
   * ========================================================== */
  /* 真正推进回合（内部用，不检查 busy，避免 AI 回合卡死） */
  function finishTurn() {
    if (G.over) return false;
    sel = null;
    var res = E().endTurn(G);
    if (res && res.spark && res.spark.gain > 0) sparkPop(res.spark.idx, res.spark.gain);
    render();
    if (checkEndNow()) return false;
    var p = G.players[G.turn];
    banner("第 " + G.turnNum + " 幕", p.name + " 的回合");
    return true;
  }

  /* 轮到 AI 就交给 AI */
  function maybeAI() {
    if (G.over) return;
    if (!G.players[G.turn].isAI) return;
    lock();
    setTimeout(aiTurn, Math.round(780 * BD.UI.speed));
  }

  function doEndTurn() {
    if (isBusy() || G.over) return;
    if (finishTurn()) maybeAI();
  }

  /* ============================================================
   *  AI 回合
   * ========================================================== */
  function aiTurn() {
    if (G.over) { unlock(); return; }
    if (!G.players[G.turn].isAI) { unlock(); return; }
    var a = BD.AI.step(G);
    var delay = 500;

    if (a.kind === "attack") {
      var tRect = rectOfUid(a.tUid);
      var res = E().attack(G, a.aUid, a.tUid);
      render();
      var aEl = elOfUid(a.aUid), tEl = elOfUid(a.tUid);
      if (aEl && tEl && res.ok) {
        var ac = center(aEl.getBoundingClientRect()), tc = center(tEl.getBoundingClientRect());
        aEl.classList.add("lunge");
        aEl.style.setProperty("--dx", ((tc.x - ac.x) * 0.45).toFixed(1) + "px");
        aEl.style.setProperty("--dy", ((tc.y - ac.y) * 0.45).toFixed(1) + "px");
        setTimeout(function () { aEl.classList.remove("lunge"); }, 480);
        setTimeout(function () {
          if (tEl) {
            tEl.classList.add("hit");
            setTimeout(function () { tEl.classList.remove("hit"); }, 460);
            var r = tEl.getBoundingClientRect();
            floatNum(r.left + r.width / 2, r.top + 30, "-" + res.real, "dmg");
            burst(r.left + r.width / 2, r.top + r.height / 2, "#ff5470", 16, 80);
          }
          if (res.ko) setTimeout(function () { koAnim(a.tUid, tRect); }, 60);
        }, 240);
      }
      delay = 950;
      if (checkEndNow()) { unlock(); return; }

    } else if (a.kind === "move") {
      var before = rectOfUid(a.uid);
      var mr = E().moveMember(G, a.uid, a.toZone);
      render();
      flipFrom(elOfUid(a.uid), before, 520);
      if (mr.ok && a.toZone === "stage") sweepSpot();
      delay = 820;
      if (checkEndNow()) { unlock(); return; }

    } else if (a.kind === "card") {
      var c = BD.card(G.players[G.turn].hand[a.handIdx]);
      var tR = a.targetUid != null ? rectOfUid(a.targetUid) : null;
      var cr = E().playCard(G, a.handIdx, a.targetUid);
      render();
      setTimeout(function () {
        var tc = tR ? center(tR) : center($("stageZone").getBoundingClientRect());
        burst(tc.x, tc.y, bandOf(c ? c.band : "NEU").color, 18, 90);
        if (cr.ok) (cr.events || []).forEach(playEvent);
        render();
        if (cr.ok) { if (checkEndNow()) { unlock(); return; } }
      }, 260);
      delay = 950;
      if (checkEndNow()) { unlock(); return; }

    } else {
      var alive = finishTurn();
      unlock();
      if (alive) maybeAI();
      return;
    }

    setTimeout(aiTurn, Math.max(0, Math.round(delay * BD.UI.speed)));
  }

  /* ============================================================
   *  拖拽：星星箭头流
   * ========================================================== */
  function dragLayer() { return $("dragLayer"); }

  function startDrag(uid, ev) {
    var u = E().unit(uid);
    if (!u || u.owner !== 0 || G.turn !== 0 || G.over) return;
    var atk = E().attackableTargets(G, uid);          // 射程 + 次数 + 星星 + 状态 全满足
    drag = {
      kind: "member",
      uid: uid,
      fromEl: elOfUid(uid),
      targets: atk,
      canStage: E().canMove(G, u.uid, "stage").ok,
      canCamp: E().canMove(G, u.uid, "camp").ok,
      canAttack: atk.length > 0,
      why: atk.length ? null : E().attackBlockReason(G, uid),
      hover: null,
      t0: performance.now()
    };
    // 能打的亮起来，不能打的暗下去
    document.querySelectorAll(".member").forEach(function (m) {
      var id = +m.dataset.uid;
      var t = E().unit(id);
      if (!t || t.owner === 0) return;
      m.classList.add(atk.indexOf(id) >= 0 ? "tg" : "dim");
    });
    document.body.classList.add("dragging");
    buildArrow();
    updateArrow(ev);
    if (rafId) cancelAnimationFrame(rafId);
    (function loop() {
      if (!drag) { rafId = 0; return; }
      tickStars();
      rafId = requestAnimationFrame(loop);
    })();
  }

  function buildArrow() {
    var L = dragLayer();
    L.innerHTML =
      '<defs><linearGradient id="lgline" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#ffd166" stop-opacity=".12"/>' +
        '<stop offset="1" stop-color="#ffd166" stop-opacity=".95"/>' +
      "</linearGradient></defs>" +
      '<path id="dragpath" class="dline" d=""/>' +
      '<polygon id="dhead" class="dhead" points="0,-9 17,0 0,9"/>' +
      '<g id="dstars"></g>';
    var g = L.querySelector("#dstars");
    for (var i = 0; i < 7; i++) {
      var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("class", "dstar");
      t.textContent = "★";
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "central");
      g.appendChild(t);
    }
    L.classList.add("on");
  }

  function updateArrow(ev) {
    if (!drag) return;
    var el = drag.fromEl || (drag.uid != null ? elOfUid(drag.uid) : null);
    if (!el) return;
    var a = center(el.getBoundingClientRect());
    var b = { x: ev.clientX, y: ev.clientY };
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var vx = b.x - a.x, vy = b.y - a.y;
    var len = Math.sqrt(vx * vx + vy * vy) || 1;
    var k = Math.min(0.22, 90 / len);
    var cx = mx - vy * k, cy = my + vx * k;
    var L = dragLayer();
    var path = L.querySelector("#dragpath");
    if (!path) return;
    path.setAttribute("d", "M " + a.x + " " + a.y + " Q " + cx + " " + cy + " " + b.x + " " + b.y);
    var head = L.querySelector("#dhead");
    var ang = Math.atan2(b.y - cy, b.x - cx) * 180 / Math.PI;
    head.setAttribute("transform", "translate(" + b.x + "," + b.y + ") rotate(" + ang + ")");
    var hot = drag.hover ? " hot" : "";
    head.setAttribute("class", "dhead" + hot);
    path.setAttribute("class", "dline" + hot);
    /* 路径长度只在改路径时量一次：原来每帧都 getTotalLength() + 7 次 getPointAtLength()，
       是拖拽时掉帧的主因 */
    try { drag.len = path.getTotalLength(); } catch (e) { drag.len = 0; }
  }

  function tickStars() {
    if (!drag) return;
    var L = dragLayer();
    var path = L.querySelector("#dragpath");
    if (!path) return;
    var total = drag.len || 0;
    if (!total) return;
    var t = (performance.now() - drag.t0) / 1000;
    var stars = L.querySelectorAll(".dstar");
    for (var i = 0; i < stars.length; i++) {
      var frac = (t * 0.5 + i / stars.length) % 1;
      var p = path.getPointAtLength(frac * total);
      var s = 0.65 + 0.55 * Math.sin(frac * Math.PI);
      stars[i].setAttribute("transform", "translate(" + p.x + "," + p.y + ") scale(" + s.toFixed(2) + ")");
      stars[i].setAttribute("opacity", (0.3 + 0.7 * Math.sin(frac * Math.PI)).toFixed(2));
    }
  }

  /* ---------------- 拖卡：按住手牌拖出去 ---------------- */
  function cardElOf(idx) { return document.querySelector('.card[data-idx="' + idx + '"]'); }

  function makeCardGhost(c, fromEl) {
    clearCardGhost();
    var r = fromEl.getBoundingClientRect();
    var g = document.createElement("div");
    g.className = "dragcard";
    g.style.width = r.width + "px";
    g.style.height = r.height + "px";
    g.style.setProperty("--band", bandOf(c.band).color);
    g.style.setProperty("--bandsoft", bandOf(c.band).soft);
    g.innerHTML = cardHTML(c, -1);
    $("fxLayer").appendChild(g);
    dragGhost = g;
  }

  function moveCardGhost(x, y) {
    if (!dragGhost) return;
    var w = dragGhost.offsetWidth || 112, h = dragGhost.offsetHeight || 158;
    dragGhost.style.transform =
      "translate(" + (x - w / 2).toFixed(1) + "px," + (y - h / 2).toFixed(1) + "px) scale(1.05) rotate(-3deg)";
  }

  function clearCardGhost() {
    if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
    dragGhost = null;
  }

  function startCardDrag(idx, ev) {
    if (isBusy() || G.over || G.turn !== 0) return;
    var c = BD.card(G.players[0].hand[idx]);
    if (!c) return;
    var chk = E().canPlay(G, c.id);
    if (!chk.ok) { toast(chk.why); return; }
    var el = cardElOf(idx);
    if (!el) return;

    var needs = BD.Effects.needsTarget(c);
    var legal = [];
    if (needs) {
      G.players[0].members.concat(G.players[1].members).forEach(function (u) {
        if (BD.Effects.legalTarget(G, c, u.uid)) legal.push(u.uid);
      });
      document.querySelectorAll(".member").forEach(function (m) {
        if (legal.indexOf(+m.dataset.uid) >= 0) m.classList.add("tg");
        else m.classList.add("dim");
      });
    }

    drag = {
      kind: "card", idx: idx, card: c, needsTarget: needs, legal: legal,
      fromEl: el, hover: null, armed: false, t0: performance.now(),
      targets: [], canStage: false, canCamp: false, canAttack: false, uid: null
    };
    document.body.classList.add("dragging");
    makeCardGhost(c, el);
    buildArrow();
    moveCardGhost(ev.clientX, ev.clientY);
    updateArrow(ev);
    if (rafId) cancelAnimationFrame(rafId);
    (function loop() {
      if (!drag) { rafId = 0; return; }
      tickStars();
      rafId = requestAnimationFrame(loop);
    })();
    if (!needs) toast("明显往上拖出手牌区，松手就打出");
  }

  function updateCardDrag(e) {
    if (!drag || drag.kind !== "card") return;
    moveCardGhost(e.clientX, e.clientY);
    if (drag.needsTarget) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var mel = el && el.closest ? el.closest(".member") : null;
      var hit = mel && drag.legal.indexOf(+mel.dataset.uid) >= 0;
      document.querySelectorAll(".member").forEach(function (m) {
        m.classList.toggle("dropok", !!(hit && m === mel));
      });
      drag.hover = hit ? "atk" : null;
    } else {
      var hb = document.querySelector(".handbar");
      var top = hb ? hb.getBoundingClientRect().top : (window.innerHeight - 140);
      var armed = e.clientY < top - 30;          // 明显拖出手牌区
      if (armed !== drag.armed) {
        drag.armed = armed;
        if (dragGhost) dragGhost.classList.toggle("armed", armed);
        if (armed) toast("松手打出「" + drag.card.name + "」");
      }
      drag.hover = armed ? "play" : null;
    }
  }

  /* 落点宽容判定：先精确命中，再在指针周围 ±26px 找一圈可打的敌人。
     避免「明明想打，因为差几个像素落到空处，结果变成登台」。 */
  function hitAttackTarget(ev, info) {
    var offs = [[0, 0], [0, -26], [0, 26], [-26, 0], [26, 0], [-18, -18], [18, -18]];
    for (var i = 0; i < offs.length; i++) {
      var el = document.elementFromPoint(ev.clientX + offs[i][0], ev.clientY + offs[i][1]);
      var m = el && el.closest ? el.closest(".member") : null;
      if (m && info.targets.indexOf(+m.dataset.uid) >= 0) return m;
    }
    return null;
  }

  function endDrag(ev, cancel) {
    if (!drag) return;
    var info = drag;
    drag = null;
    dragEndAt = performance.now();
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    document.body.classList.remove("dragging");
    var L = dragLayer();
    L.classList.remove("on");
    L.innerHTML = "";
    document.querySelectorAll(".member").forEach(function (m) { m.classList.remove("dropok", "tg", "dim"); });
    $("stageZone").classList.remove("dropok", "hoverdrop");
    $("laneSelf").classList.remove("dropok", "hoverdrop");
    if (cancel || !ev) { clearCardGhost(); renderHighlights(); return; }

    var el = document.elementFromPoint(ev.clientX, ev.clientY);
    var mel = el && el.closest ? el.closest(".member") : null;

    /* ---- 拖卡 ---- */
    if (info.kind === "card") {
      var idx = info.idx;
      if (info.needsTarget) {
        if (mel && info.legal.indexOf(+mel.dataset.uid) >= 0) {
          clearCardGhost();
          doPlayCard(idx, +mel.dataset.uid);
          return;
        }
        toast("把这张牌拖到高亮的成员身上再松手");
      } else {
        if (info.armed) {
          clearCardGhost();
          doPlayCard(idx, null);
          return;
        }
        toast("把牌明显往上拖出手牌区再松手");
      }
      clearCardGhost();
      renderHighlights();
      render();
      return;
    }

    var hit = (mel && info.targets.indexOf(+mel.dataset.uid) >= 0) ? mel
            : (info.canAttack ? hitAttackTarget(ev, info) : null);
    if (hit) {
      doAttack(info.uid, +hit.dataset.uid);
      return;
    }
    // 拖到了敌方成员身上却打不了 → 明确说出原因
    if (mel) {
      var tUid = +mel.dataset.uid;
      var tu = E().unit(tUid);
      if (tu && tu.owner === 1) {
        var chk = E().canAttack(G, info.uid, tUid);
        if (chk.ok) { doAttack(info.uid, tUid); return; }      // 拖起时还没算到，这里补一次
        toast(chk.why || info.why || "打不到这个目标");
        renderHighlights();
        return;
      }
    }
    if (el && el.closest && el.closest("#stageZone") && info.canStage) { doMove(info.uid, "stage"); return; }
    if (el && el.closest && el.closest("#laneSelf") && info.canCamp) { doMove(info.uid, "camp"); return; }
    // 什么都不成立：至少告诉玩家为什么打不了
    if (info.why) toast(info.why);
    renderHighlights();
  }

  /* ============================================================
   *  事件绑定
   * ========================================================== */
  var bound = false;
  /* 手机端「详情」抽屉：开着抽屉去操作棋盘 / 手牌时自动收起 */
  function closeMDetail() {
    if (document.body.classList.contains("m-detail")) document.body.classList.remove("m-detail");
  }
  function bindEvents() {
    /* 现在一局结束可以原地重开，事件只能绑一次，否则第二局会双触发 */
    if (bound) return;
    bound = true;
    var board = $("board");

    board.addEventListener("pointerdown", function (e) {
      closeMDetail();
      if (isBusy() || G.over || G.turn !== 0) return;
      var el = e.target.closest && e.target.closest(".member");
      if (!el) return;
      var uid = +el.dataset.uid;
      var u = E().unit(uid);
      if (!u) return;
      if (u.owner !== 0) return;   // 敌方成员：点击看详情（在 click 里处理）
      if (u.zone === "rest") return;
      startDrag(uid, e);
      e.preventDefault();
    });

    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      updateArrow(e);
      if (drag.kind === "card") { updateCardDrag(e); return; }
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var mel = el && el.closest ? el.closest(".member") : null;
      document.querySelectorAll(".member").forEach(function (m) { m.classList.remove("dropok"); });
      $("stageZone").classList.remove("hoverdrop");
      $("laneSelf").classList.remove("hoverdrop");
      if (mel && drag.targets.indexOf(+mel.dataset.uid) >= 0 && drag.canAttack) {
        mel.classList.add("dropok"); drag.hover = "atk";
      } else if (el && el.closest && el.closest("#stageZone") && drag.canStage) {
        $("stageZone").classList.add("hoverdrop"); drag.hover = "stage";
      } else if (el && el.closest && el.closest("#laneSelf") && drag.canCamp) {
        $("laneSelf").classList.add("hoverdrop"); drag.hover = "camp";
      } else {
        drag.hover = null;
      }
    });

    window.addEventListener("pointerup", function (e) { if (drag) endDrag(e, false); });
    window.addEventListener("pointercancel", function () { endDrag(null, true); });

    /* 出牌 = 拖：按住牌拖到目标上，或明显拖出手牌区 */
    $("hand").addEventListener("pointerdown", function (e) {
      closeMDetail();
      if (isBusy() || G.over || G.turn !== 0) return;
      var el = e.target.closest && e.target.closest(".card");
      if (!el) return;
      startCardDrag(+el.dataset.idx, e);
      e.preventDefault();
    });

    /* 单击手牌：只看详情并提示怎么打 */
    $("hand").addEventListener("click", function (e) {
      if (isBusy() || G.over || G.turn !== 0) return;
      var el = e.target.closest && e.target.closest(".card");
      if (!el) return;
      var idx = +el.dataset.idx;
      var c = BD.card(G.players[0].hand[idx]);
      if (!c) return;
      if (performance.now() - dragEndAt < 260) return;
      sel = null;
      render();
      $("detail").innerHTML = cardDetailHTML(c);
      toast(BD.Effects.needsTarget(c)
        ? "按住这张牌，拖到高亮的成员身上松手"
        : "按住这张牌，明显往上拖出手牌区再松手");
    });

    $("hand").addEventListener("pointerover", function (e) {
      var el = e.target.closest && e.target.closest(".card");
      if (!el) return;
      if (sel && sel.type === "card") return;
      var c = BD.card(G.players[0].hand[+el.dataset.idx]);
      if (c) $("detail").innerHTML = cardDetailHTML(c);
    });

    board.addEventListener("click", function (e) {
      if (isBusy() || G.over || G.turn !== 0) return;
      if (performance.now() - dragEndAt < 260) return;   // 刚拖完，不当成点击
      var el = e.target.closest && e.target.closest(".member");
      if (!el) return;
      var uid = +el.dataset.uid;
      if (sel && sel.type === "card") {
        var c = BD.card(G.players[0].hand[sel.idx]);
        if (c && BD.Effects.legalTarget(G, c, uid)) { doPlayCard(sel.idx, uid); return; }
        if (c) { toast("这张卡不能选他"); return; }
      }
      sel = { type: "member", uid: uid };
      render();
    });

    board.addEventListener("pointerover", function (e) {
      var el = e.target.closest && e.target.closest(".member");
      if (!el) return;
      if (sel && sel.type === "card") return;
      var u = E().unit(+el.dataset.uid);
      if (u) $("detail").innerHTML = memberDetailHTML(u);
    });

    $("btnEnd").addEventListener("click", function () { doEndTurn(); });
    /* 「规则」弹窗的开关已挪到 main.js 的 boot（页面加载即绑，主界面也能关） */
    /* 手机端「详情」按钮：侧栏变成右侧抽屉，再点一次收起 */
    $("btnDetail").addEventListener("click", function () {
      document.body.classList.toggle("m-detail");
    });
    /* 重开 / 结算按钮都交给 main.js 的流程控制（原来靠刷新页面，file:// 下不可靠） */
    $("btnRestart").addEventListener("click", function () { exitGame("replay"); });
    $("btnEndHome").addEventListener("click", function () { exitGame("home"); });
    $("btnAgain").addEventListener("click", function () { exitGame("replay"); });

    function exitGame(how) {
      var M = root.BD.Main;
      if (M && M.exit) { M.exit(how); return; }
      location.reload();          // 兜底
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { sel = null; if (drag) endDrag(null, true); render(); }
      if (e.key === " ") { e.preventDefault(); doEndTurn(); }
    });
  }

  /* ============================================================
   *  结算
   * ========================================================== */
  /* 赢方高亮演出：全场压暗 → 聚光灯打在赢方身上 → 赢方全员逐个亮起 */
  function victoryShow(w) {
    var p = G.players[w];
    document.body.classList.add("winshow");
    document.body.classList.add(w === 0 ? "win-me" : "win-foe");

    // 聚光灯
    var spot = document.createElement("div");
    spot.className = "vspot";
    $("fxLayer").appendChild(spot);

    // 赢方成员逐个亮起
    var units = p.members.filter(function (u) { return u.zone !== "rest"; });
    var pool = units.concat(p.members.filter(function (u) { return u.zone === "rest"; }));
    pool.forEach(function (u, i) {
      setTimeout(function () {
        /* 中途退回主菜单了就不要继续打高亮 */
        if (!document.body.classList.contains("winshow")) return;
        var el = elOfUid(u.uid);
        if (!el) return;
        el.classList.add("winglow");
        var r = el.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, "#ffd166", 14, 80);
      }, Math.round((260 + i * 150) * BD.UI.speed));
    });

    var box = w === 0 ? $("selfInfo") : $("enemyInfo");
    if (box) box.classList.add("winglow");
    var lane = w === 0 ? $("laneSelf") : $("laneEnemy");
    if (lane) lane.classList.add("winglow");

    banner("★ WINNER ★", p.name + "　闪耀值 " + p.spark + " / " + R().SPARK_GOAL);
  }

  /* 收掉结算演出留下的一切（压暗、聚光灯、成员高亮、彩带），
     并把 endShown 复位，下一局才能重新播一次结算。 */
  function clearEndFx() {
    endShown = false;
    document.body.classList.remove("winshow", "win-me", "win-foe");
    ["selfInfo", "enemyInfo", "laneSelf", "laneEnemy"].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.remove("winglow");
    });
    var mems = document.querySelectorAll(".winglow");
    for (var i = 0; i < mems.length; i++) mems[i].classList.remove("winglow");
    var fx = $("fxLayer");
    if (fx) fx.innerHTML = "";
    var v = $("endVerdict");
    if (v) { v.textContent = ""; v.className = "verdict"; }
    $("endModal").classList.add("hidden");
  }

  function showEnd() {
    if (endShown) return;
    endShown = true;
    var w = G.winner;
    var p = G.players[w];
    var playerWon = (w === 0);
    drag = null;
    unlock(true);
    sel = null;
    render();
    victoryShow(w);

    var wait = Math.round((300 + p.members.length * 150 + 900) * BD.UI.speed);
    setTimeout(function () {
      /* 演出期间玩家已经按了「重开」/退回主菜单，就别再弹旧结果 */
      if (!endShown) return;
      var v = $("endVerdict");
      v.textContent = playerWon ? "优胜" : "惜败";
      v.className = "verdict " + (playerWon ? "win" : "lose");
      $("endTitle").textContent = p.name + " 赢下了这场演出！";
      $("endSub").innerHTML = "闪耀值 <b>" + p.spark + "</b> / " + R().SPARK_GOAL +
        "　·　对手 " + G.players[1 - w].spark + "　·　共 " + G.turnNum + " 幕";
      $("endModal").classList.remove("hidden");
      confetti();
    }, wait);
  }

  BD.UI = {
    speed: 1,            // 动画速度倍率（0.05 = 快进，调试用）
    boot: function (game) {
      G = game;
      E().bind(G);
      clearEndFx();          // 上一局的结算残留（压暗/高亮/彩带）先清干净
      bindEvents();
      busy = 0; document.body.classList.remove("busy");
      render();
      banner("第 " + G.turnNum + " 幕", G.players[0].name + " 的回合");
      setTimeout(sweepSpot, 200);
    },
    render: render,
    doEndTurn: doEndTurn,
    /* 调试用：直接跳到结算演出（?win=1 我方胜 / ?win=foe 对手胜） */
    forceEnd: function (w) {
      var who = (w === 1 || w === "foe") ? 1 : 0;
      G.over = true;
      G.winner = who;
      G.players[who].spark = Math.max(G.players[who].spark, R().SPARK_GOAL);
      showEnd();
    },
    aiTurn: function () { lock(); aiTurn(); },
    /* 调试用：直接按手牌下标打出（?curtain=play 会走一遍完整动画） */
    cast: function (idx, targetUid) { return doPlayCard(idx, targetUid == null ? null : targetUid); },
    clearEndFx: clearEndFx,
    toast: toast,
    game: function () { return G; }
  };

})(typeof window !== "undefined" ? window : global);
