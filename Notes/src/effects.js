/* ============================================================
 *  effects.js —— 声明式效果解析器
 *  卡牌的 fx 是声明式配置，这里负责把它翻译成对局面的实际操作，
 *  并返回一串「动画事件」给 UI 播放。
 *
 *  想加新效果：在 OPS 里加一个函数即可，其它文件不用动。
 *
 *  可用 op：
 *    dmg 伤害 / heal 回复 / buff 本回合技能值 / shield 台风
 *    spark 闪耀值 / star 星星 / draw 抽牌
 *    suppress 怯场 / pin 禁演 / rally 再行动 / cleanse 清除负面 / wake 唤醒
 *    dmgAll 范围伤害（scope: enemyStage / enemyCamp / allEnemy）
 *    clearStage 强制清场：双方台上的成员全部退回自己阵营
 *    veil 回避：一回合内无法被作为对战目标
 * ========================================================== */
(function (root) {
  var BD = root.BD = root.BD || {};

  var OPS = {
    dmg: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u) return;
      var r = BD.Engine.damage(g, u, e.amount || 0, { src: ctx.srcName, srcIdx: ctx.ownerIdx });
      if (r) ev.push({ type: "dmg", uid: u.uid, amount: r.real, ko: r.ko });
    },

    heal: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u) return;
      var before = u.vita;
      u.vita = Math.min(u.maxVita, u.vita + (e.amount || 0));
      var got = u.vita - before;
      if (got > 0) ev.push({ type: "heal", uid: u.uid, amount: got });
    },

    buff: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u) return;
      u.tempSkill += (e.skill || 0);
      ev.push({ type: "buff", uid: u.uid, amount: e.skill || 0 });
    },

    shield: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u) return;
      u.shield = Math.max(u.shield || 0, e.amount || 0);
      ev.push({ type: "shield", uid: u.uid, amount: e.amount || 0 });
    },

    spark: function (g, ctx, e, ev) {
      var p = g.players[ctx.ownerIdx];
      p.spark += (e.amount || 0);
      ev.push({ type: "spark", idx: ctx.ownerIdx, amount: e.amount || 0 });
      BD.Engine.checkOver(g);
    },

    star: function (g, ctx, e, ev) {
      var p = g.players[ctx.ownerIdx];
      // 卡牌给的星星可以超过本回合上限，但最多到该玩家的上限（电脑有难度加成时更高）
      var cap = Math.max(BD.RULES.STAR_MAX, p.starsMax || 0);
      p.stars = Math.min(cap, p.stars + (e.amount || 0));
      ev.push({ type: "star", idx: ctx.ownerIdx, amount: e.amount || 0 });
    },

    draw: function (g, ctx, e, ev) {
      var got = BD.Engine.draw(g, ctx.ownerIdx, e.amount || 1);
      if (got) ev.push({ type: "draw", idx: ctx.ownerIdx, amount: got });
    },

    suppress: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u) return;
      u.suppressed = true;
      BD.Engine.log(g, u.owner,
        "「" + u.name + "」陷入怯场：下一个回合完全无法行动（不能移动／对战，也不计入闪耀结算）");
      ev.push({ type: "mark", uid: u.uid, mark: "suppress" });
    },

    pin: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u) return;
      u.pinned = true;
      BD.Engine.log(g, u.owner, "「" + u.name + "」被禁演：无法移动（上台／下台），也无法对战");
      ev.push({ type: "mark", uid: u.uid, mark: "pin" });
    },

    rally: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u) return;
      u.attacksLeft += 1;
      u.movesLeft += 1;
      ev.push({ type: "rally", uid: u.uid });
    },

    cleanse: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u) return;
      u.suppressed = false; u.pinned = false;
      ev.push({ type: "cleanse", uid: u.uid });
    },

    /* 回避：一回合内无法被作为对战目标。
       施放在自己回合里，到「施放者的下个回合开始」自动解除（和台风同样的时长）。 */
    veil: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u) return;
      u.veil = true;
      BD.Engine.log(g, u.owner, "「" + u.name + "」进入回避：直到对方回合结束，无法被作为对战目标");
      ev.push({ type: "mark", uid: u.uid, mark: "veil" });
    },

    wake: function (g, ctx, e, ev) {
      var u = BD.Engine.unit(ctx.targetUid);
      if (!u || u.zone !== "rest") return;
      BD.Engine.wakeUp(g, u);
      ev.push({ type: "wake", uid: u.uid });
    },

    dmgAll: function (g, ctx, e, ev) {
      var list = [];
      var foe = 1 - ctx.ownerIdx;
      if (e.scope === "enemyStage") {
        list = g.stage.filter(function (u) { return u && u.owner === foe; });
      } else if (e.scope === "enemyCamp") {
        list = g.players[foe].members.filter(function (u) { return u.zone === "camp"; });
      } else {
        list = g.players[foe].members.filter(function (u) { return u.zone !== "rest"; });
      }
      list.forEach(function (u) {
        var r = BD.Engine.damage(g, u, e.amount || 0, { src: ctx.srcName, srcIdx: ctx.ownerIdx });
        if (r) ev.push({ type: "dmg", uid: u.uid, amount: r.real, ko: r.ko });
      });
    },

    /* 谢幕：强制清场。无视禁演 / 怯场 / 行动次数 / 星星，也不消耗移动次数，
       台上双方所有成员一律退回自己的阵营（舞台清空）。 */
    clearStage: function (g, ctx, e, ev) {
      var list = g.stage.filter(function (u) { return !!u; }).slice();
      list.forEach(function (u) {
        BD.Engine.removeFromStage(g, u);
        u.zone = "camp";
      });
      BD.Engine.log(g, ctx.ownerIdx, "「" + ctx.srcName + "」谢幕：舞台上的 " +
        list.length + " 名成员全部强制退回各自的阵营");
      ev.push({
        type: "clearStage",
        uids: list.map(function (u) { return u.uid; }),
        count: list.length
      });
    }
  };

  BD.Effects = {
    OPS: OPS,

    /* 这张卡打出去要不要选目标 */
    needsTarget: function (card) {
      return !!card.target && card.target !== "none";
    },

    /* 目标是否合法 */
    legalTarget: function (g, card, uid) {
      var u = BD.Engine.unit(uid);
      if (!u) return false;
      var me = g.turn;
      if (u.zone === "rest") {
        // 休息中的成员只有「唤醒」类卡能选
        return card.fx.some(function (e) { return e.op === "wake"; }) && u.owner === me;
      }
      switch (card.target) {
        case "allyMember":  return u.owner === me;
        case "enemyMember": return u.owner !== me;
        case "anyMember":   return true;
        default:            return false;
      }
    },

    run: function (g, ctx, fx) {
      var ev = [];
      (fx || []).forEach(function (e) {
        var fn = OPS[e.op];
        if (fn) fn(g, ctx, e, ev);
      });
      return ev;
    }
  };

})(typeof window !== "undefined" ? window : global);
