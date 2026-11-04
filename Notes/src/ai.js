/* ============================================================
 *  ai.js —— 电脑对手
 *  step() 只走一步，UI 一步一步播动画，直到返回 {kind:'end'}。
 * ========================================================== */
(function (root) {
  var BD = root.BD = root.BD || {};
  var E = function () { return BD.Engine; };

  function R() { return BD.RULES; }

  /* ---------- 己方成员里挑一个最值得上台的 ---------- */
  /* 阵营里最便宜的一次上台要花多少星（成员费可能不同） */
  function minMoveCost(g, me) {
    var m = Infinity;
    E().membersOf(g, me, "camp").forEach(function (u) { m = Math.min(m, E().moveCost(u)); });
    return m === Infinity ? R().COST_MOVE : m;
  }

  function pickToEnter(g, me) {
    var cands = E().membersOf(g, me, "camp").filter(function (u) {
      return !u.pinned && !u.suppressed && E().canMove(g, u.uid, "stage").ok;
    });
    if (!cands.length) return null;
    cands.sort(function (a, b) {
      var sa = (a.leader ? 5 : 0) + a.vita * 0.6 + a.skill * 2;   // 队长登台有额外闪耀，优先
      var sb = (b.leader ? 5 : 0) + b.vita * 0.6 + b.skill * 2;
      return sb - sa;
    });
    return cands[0];
  }

  /* ---------- 挑一次最划算的对战 ---------- */
  function pickAttack(g, me, diff) {
    var best = null;
    E().aliveMembers(g, me).forEach(function (a) {
      var targets = E().legalAttackTargets(g, a.uid);
      if (!targets.length) return;
      targets.forEach(function (tUid) {
        if (!E().canAttack(g, a.uid, tUid).ok) return;
        var t = E().unit(tUid);
        if (!t) return;
        if (!diff.campChase && t.zone !== "stage") return;      // 简单难度不追击阵营里的人
        var dmg = E().skillOf(a);
        var score = 0;
        if (dmg >= t.vita + (t.shield || 0)) score += 14;      // 能打退场
        score += Math.min(dmg, t.vita) * 1.6;
        if (t.zone === "stage") score += 3;                     // 把台上的人打下去更有价值
        score -= t.skill * 0.4;
        if (diff.focusLeader && t.leader) score += 4;           // 困难：优先集火队长（登台 +1 闪耀、技能 3）
        if (diff.focusLeader && t.zone === "camp" && t.vita <= 2) score += 2;  // 困难：顺手把残血压回休息
        if (!best || score > best.score) best = { aUid: a.uid, tUid: tUid, score: score };
      });
    });
    return best;
  }

  /* ---------- 卡牌打分 ---------- */
  function fxScore(g, me, c) {
    var s = 0;
    var foe = 1 - me;
    var damaged = E().aliveMembers(g, me).filter(function (u) { return u.vita < u.maxVita; });
    var resting = E().membersOf(g, me, "rest");
    var enemies = E().aliveMembers(g, foe);

    (c.fx || []).forEach(function (e) {
      switch (e.op) {
        case "dmg":
          if (enemies.length) s += (e.amount || 0) * 1.5;
          break;
        case "dmgAll":
          if (E().stageMembers(g, foe).length) s += (e.amount || 0) * 1.4 * E().stageMembers(g, foe).length;
          break;
        case "heal":
          if (damaged.length) s += Math.min(e.amount || 0, damaged[0].maxVita - damaged[0].vita) * 1.3 + 2;
          break;
        case "buff":
          if (E().stageMembers(g, me).length) s += (e.skill || 0) * 1.6;
          break;
        case "shield":
          s += (e.amount || 0) * 1.1;
          break;
        case "spark":
          s += (e.amount || 0) * 3.2;
          break;
        case "star":
          s += (e.amount || 0) * 1.6;
          break;
        case "draw":
          s += (e.amount || 0) * 1.6;
          break;
        case "wake":
          if (resting.length) s += 9;
          break;
        case "suppress":
        case "pin":
          s += enemies.length ? 3 : 0;
          break;
        case "rally":
          s += 3.5;
          break;
        case "cleanse":
          s += 0.5;
          break;
        case "veil":
          // 保住一个残血的人不被下一轮集火
          s += damaged.length ? 2.5 : 1;
          break;
        case "clearStage":
          // 清场只在「敌方台上人多、自己台上人少」时才划算
          s += E().stageMembers(g, foe).length * 3.4 - E().stageMembers(g, me).length * 3.8;
          break;
      }
    });
    return s - c.cost * 0.35;
  }

  function pickTarget(g, me, c) {
    var foe = 1 - me;
    if (c.target === "enemyMember") {
      var list = E().aliveMembers(g, foe).filter(function (u) {
        return BD.Effects.legalTarget(g, c, u.uid);
      });
      if (!list.length) return null;
      list.sort(function (a, b) { return (a.vita + (a.shield || 0)) - (b.vita + (b.shield || 0)); });
      return list[0].uid;
    }
    if (c.target === "allyMember") {
      var mine = g.players[me].members.filter(function (u) {
        return BD.Effects.legalTarget(g, c, u.uid);
      });
      if (!mine.length) return null;
      var wantsHeal = (c.fx || []).some(function (e) { return e.op === "heal"; });
      var wantsWake = (c.fx || []).some(function (e) { return e.op === "wake"; });
      if (wantsWake) {
        var rest = mine.filter(function (u) { return u.zone === "rest"; });
        if (rest.length) return rest[0].uid;
      }
      if (wantsHeal) {
        mine.sort(function (a, b) { return (a.vita / a.maxVita) - (b.vita / b.maxVita); });
        return mine[0].uid;
      }
      var onStage = mine.filter(function (u) { return u.zone === "stage"; });
      if (onStage.length) {
        onStage.sort(function (a, b) { return b.skill - a.skill; });
        return onStage[0].uid;
      }
      mine.sort(function (a, b) { return b.skill - a.skill; });
      return mine[0].uid;
    }
    return null;
  }

  /* ---------- 出牌 ---------- */
  function pickCard(g, me) {
    var p = g.players[me];
    var best = null;
    p.hand.forEach(function (id, i) {
      var c = BD.card(id);
      if (!c || !E().canPlay(g, id).ok) return;
      var tUid = BD.Effects.needsTarget(c) ? pickTarget(g, me, c) : null;
      if (BD.Effects.needsTarget(c) && tUid == null) return;
      var s = fxScore(g, me, c);
      if (s <= 0) return;
      if (!best || s > best.score) best = { handIdx: i, targetUid: tUid, score: s, card: c };
    });
    return best;
  }

  /* ---------- 一步 ---------- */
  function step(g) {
    if (g.over) return { kind: "end" };
    var me = g.turn, p = g.players[me];
    var rules = R();
    var diff = g.diff || BD.DIFFICULTY.normal;

    // 难度预算：这一回合已经走了 steps 步就收手
    p._acts = p._acts || 0;
    if (p.isAI && p._acts >= diff.budget) return { kind: "end" };

    function act(a) { if (p.isAI) p._acts++; return a; }

    // 1) 台上人不够 → 先派人上台。
    //    闪耀值是唯一的胜负手，而且舞台 5 个位置双方共用：
    //    自己多占一个，对手就少一个能上台抢闪耀的名额。
    var onStage = E().stageMembers(g, me).length;
    if (p.stars >= minMoveCost(g, me) && onStage < Math.min(rules.STAGE_SLOTS, diff.stageGoal)) {
      var mover = pickToEnter(g, me);
      if (mover) return act({ kind: "move", uid: mover.uid, toZone: "stage" });
    }

    // 2) 能打就打（星星够 + 有合法目标）
    if (p.stars >= rules.COST_ATTACK_STAGE) {
      var atk = pickAttack(g, me, diff);
      if (atk) return act({ kind: "attack", aUid: atk.aUid, tUid: atk.tUid });
    }

    // 3) 出牌
    var card = pickCard(g, me);
    if (card) return act({ kind: "card", handIdx: card.handIdx, targetUid: card.targetUid });

    // 4) 星星还有富余 → 继续上台，把舞台占满（不受 stageGoal 限制）
    if (p.stars >= minMoveCost(g, me) && onStage < rules.STAGE_SLOTS) {
      var m2 = pickToEnter(g, me);
      if (m2) return act({ kind: "move", uid: m2.uid, toZone: "stage" });
    }

    return { kind: "end" };
  }

  BD.AI = { step: step };

})(typeof window !== "undefined" ? window : global);
