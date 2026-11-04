/* ============================================================
 *  engine.js —— 规则引擎（Our Notes · 舞台争夺战）
 *
 *  三个区域：自己阵营 camp / 舞台 stage / 休息 rest
 *  距离规则：自己阵营 ↔ 舞台 = 1，舞台 ↔ 对方阵营 = 1，攻击距离 2
 *    · 在阵营里  → 只能打舞台上的敌人
 *    · 在舞台上  → 能打舞台上的敌人 + 对方阵营里的敌人
 *    · 己方成员永远不能移动到对方阵营
 * ========================================================== */
(function (root) {
  var BD = root.BD = root.BD || {};
  var R = null;

  function rules() { return R || (R = BD.RULES); }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------------- 建立对局 ---------------- */
  function makeMember(g, def, owner) {
    var u = {
      uid: g._uid++,
      id: def.id, def: def,
      name: def.name, band: def.band, role: def.role, inst: def.inst, hair: def.hair,
      owner: owner,
      skill: def.skill,                 // 技能值（攻击力）
      cost: def.cost != null ? def.cost : rules().COST_MOVE,  // 行动费（登台/下场）
      leader: !!def.leader,             // 队长：登台额外 +1 闪耀值
      maxVita: def.vita, vita: def.vita, // 活力值（生命值）
      zone: "camp",                     // camp / stage / rest
      restLeft: 0,
      attacksLeft: 0, movesLeft: 0,
      tempSkill: 0,                     // 本回合临时技能值加成
      shield: 0,                        // 台风（减伤）
      suppressed: false,                // 怯场：无法行动
      pinned: false,                    // 禁演：无法移动，也无法对战
      veil: false                       // 回避：一回合内无法被作为对战目标
    };
    g._units[u.uid] = u;
    return u;
  }

  function makePlayer(g, band, name, isAI, ownerIdx) {
    return {
      band: band,
      name: name || BD.BANDS[band].name,
      isAI: !!isAI,
      spark: 0,                                    // 闪耀值
      stars: 0,
      starsMax: rules().STAR_START - rules().STAR_STEP, // 第一次 startTurn 会变成 STAR_START
      deck: [], hand: [], discard: [],
      members: BD.membersOfBand(band).map(function (d) { return makeMember(g, d, ownerIdx); })
    };
  }

  function buildDeck(band) {
    var pool = BD.cardsOfBand(band).slice();
    if (!pool.length) pool = BD.CARDS.slice();
    var deck = [], used = {}, guard = 0;

    /* 写了 copies 的卡（例如「谢幕」每方固定 2 张）先按份数放好，不参与随机 */
    pool.forEach(function (c) {
      if (c.copies > 0) {
        for (var k = 0; k < c.copies && deck.length < rules().DECK_SIZE; k++) deck.push(c.id);
        used[c.id] = c.copies;
      }
    });
    var randPool = pool.filter(function (c) { return !c.copies; });

    while (deck.length < rules().DECK_SIZE && guard++ < 200) {
      shuffle(randPool);
      for (var i = 0; i < randPool.length && deck.length < rules().DECK_SIZE; i++) {
        var c = randPool[i];
        used[c.id] = used[c.id] || 0;
        if (used[c.id] >= rules().MAX_COPIES) continue;
        used[c.id]++;
        deck.push(c.id);
      }
    }
    return shuffle(deck);
  }

  function createGame(opts) {
    opts = opts || {};
    var bands = opts.bands || ["MYGO", "AVE"];
    var diffKey = BD.DIFFICULTY[opts.difficulty] ? opts.difficulty : "normal";
    var g = {
      players: [],
      stage: [],                 // 舞台上的成员（最多 STAGE_SLOTS 人，双方共用）
      turn: 0, turnNum: 1,
      over: false, winner: null,
      difficulty: diffKey, diff: BD.DIFFICULTY[diffKey],
      log: [], _uid: 1, _units: {}
    };
    g.players.push(makePlayer(g, bands[0], opts.names && opts.names[0], false, 0));
    g.players.push(makePlayer(g, bands[1], opts.names && opts.names[1], true, 1));
    bind(g);
    g.players.forEach(function (p) { p.deck = buildDeck(p.band); });
    for (var i = 0; i < rules().START_HAND; i++) { draw(g, 0, 1); draw(g, 1, 1); }
    return g;
  }

  /* ---------------- 查询 ---------------- */
  function unit(uid) { return BD.__g && BD.__g._units[uid]; }

  function bind(g) { BD.__g = g; return g; }

  function membersOf(g, idx, zone) {
    return g.players[idx].members.filter(function (u) {
      return !zone || u.zone === zone;
    });
  }
  function aliveMembers(g, idx) {
    return g.players[idx].members.filter(function (u) { return u.zone !== "rest"; });
  }
  function stageMembers(g, idx) {
    return g.stage.filter(function (u) { return u && (idx == null || u.owner === idx); });
  }
  /* 台上「还能发挥作用」的人：怯场的人完全无法行动，也不参与闪耀结算 */
  function activeStageMembers(g, idx) {
    return stageMembers(g, idx).filter(function (u) { return !u.suppressed; });
  }
  function skillOf(u) { return Math.max(0, u.skill + u.tempSkill); }
  function moveCost(u) { return u.cost != null ? u.cost : rules().COST_MOVE; }
  /* 对战费：站在舞台上出手 2★，从自己阵营够台上的敌人 3★ */
  function attackCost(u) {
    return (u && u.zone === "stage") ? rules().COST_ATTACK_STAGE : rules().COST_ATTACK_CAMP;
  }

  function log(g, side, text) {
    g.log.push({ side: side, text: text });
    if (g.log.length > 300) g.log.splice(0, g.log.length - 300);
  }

  /* ---------------- 回合 ---------------- */
  function startTurn(g) {
    if (g.over) return;
    bind(g);
    var p = g.players[g.turn];

    // 星星上限增长（涨到 STAR_MAX 就停），并补满
    // 困难难度给电脑一点额外资源（aiStarBonus），玩家的规则完全不变
    var diff = g.diff || BD.DIFFICULTY.normal;
    var aiStarBonus = (p.isAI && diff.aiStarBonus) ? diff.aiStarBonus : 0;
    p.starsMax = Math.min(rules().STAR_MAX + aiStarBonus, p.starsMax + rules().STAR_STEP);
    if (rules().STAR_REFILL) p.stars = p.starsMax;

    // 休息结束的成员回场（活力值全满）
    p.members.forEach(function (u) {
      if (u.zone === "rest" && u.restLeft <= 0) wakeUp(g, u);
    });

    // 重置行动次数与临时加成（台风 / 回避持续到自己的下个回合开始）
    p.members.forEach(function (u) {
      u.attacksLeft = rules().ATTACKS_PER_TURN;
      u.movesLeft = rules().MOVES_PER_TURN;
      u.tempSkill = 0;
      u.shield = 0;
      u.veil = false;
    });
    p._acts = 0;                    // 电脑这一回合已经行动了几步（难度预算用）

    // 困难难度电脑多抽几张（aiDrawBonus）
    var aiDrawBonus = (p.isAI && diff.aiDrawBonus) ? diff.aiDrawBonus : 0;
    draw(g, g.turn, rules().DRAW_PER_TURN + aiDrawBonus);
    log(g, g.turn, "—— 第 " + g.turnNum + " 幕 · " + p.name + " ——");
  }

  function endTurn(g) {
    if (g.over) return;
    bind(g);
    var p = g.players[g.turn];

    // 闪耀结算：台上每 1 个「没在怯场」的人 +1，人数达到 3/4/5 再额外 +1/+2/+3
    var all = stageMembers(g, g.turn).length;
    var n = activeStageMembers(g, g.turn).length;
    var stunned = all - n;
    var extra = rules().SPARK_TIER[n] || 0;
    var gain = n + extra;
    if (gain > 0) {
      p.spark += gain;
      log(g, g.turn, "台上 " + n + " 人" + (stunned ? "（另有 " + stunned + " 人怯场，不计入）" : "") +
          " → 闪耀值 +" + gain + (extra ? "（全员加成 +" + extra + "）" : "") + "，共 " + p.spark);
    } else if (stunned) {
      log(g, g.turn, "台上的人全在怯场，无法行动，没有收获闪耀值");
    } else {
      log(g, g.turn, "台上无人，没有收获闪耀值");
    }
    checkOver(g);
    if (g.over) return { spark: { idx: g.turn, gain: gain, n: n } };

    // 负面状态在其拥有者的回合结束时清除
    p.members.forEach(function (u) { u.suppressed = false; u.pinned = false; });

    // 休息倒计时
    p.members.forEach(function (u) {
      if (u.zone === "rest" && u.restLeft > 0) u.restLeft--;
    });

    g.turn = 1 - g.turn;
    g.turnNum++;
    startTurn(g);
    return { spark: { idx: 1 - g.turn, gain: gain, n: n } };
  }

  /* ---------------- 抽牌 ---------------- */
  function draw(g, idx, n) {
    var p = g.players[idx], got = 0;
    for (var i = 0; i < n; i++) {
      if (!p.deck.length) {
        // 牌库耗尽：把弃牌堆洗回去
        if (!p.discard.length) break;
        p.deck = shuffle(p.discard.slice());
        p.discard = [];
        if (!p.deck.length) break;
      }
      var id = p.deck.pop();
      if (p.hand.length >= rules().HAND_MAX) { p.discard.push(id); continue; }
      p.hand.push(id);
      got++;
    }
    return got;
  }

  /* ---------------- 移动（上场 / 下场） ---------------- */
  function canMove(g, uid, toZone) {
    var u = unit(uid);
    if (!u) return { ok: false, why: "成员不存在" };
    if (g.over) return { ok: false, why: "对局已结束" };
    if (u.owner !== g.turn) return { ok: false, why: "不是你的成员" };
    if (u.zone === "rest") return { ok: false, why: "还在休息中" };
    if (u.suppressed) return { ok: false, why: "怯场中：本回合完全无法行动（下回合恢复）" };
    if (u.pinned) return { ok: false, why: "被禁演，无法移动" };
    if (u.movesLeft <= 0) return { ok: false, why: "本回合已经移动过" };
    var mc = moveCost(u);
    if (g.players[g.turn].stars < mc) return { ok: false, why: "星星不足（需要 " + mc + "）" };
    if (toZone === "stage") {
      if (u.zone === "stage") return { ok: false, why: "已经在舞台上了" };
      if (g.stage.length >= rules().STAGE_SLOTS) return { ok: false, why: "舞台已经站满了" };
    } else {
      if (u.zone === "camp") return { ok: false, why: "已经在阵营里了" };
    }
    return { ok: true };
  }

  function moveMember(g, uid, toZone) {
    bind(g);
    var chk = canMove(g, uid, toZone);
    if (!chk.ok) return chk;
    var u = unit(uid);
    g.players[g.turn].stars -= moveCost(u);
    u.movesLeft--;
    if (toZone === "stage") {
      u.zone = "stage";
      g.stage.push(u);
      log(g, u.owner, "「" + u.name + "」登上舞台");
      // 队长登台：额外闪耀值
      var bonus = u.leader ? (rules().LEADER_SPARK || 0) : 0;
      if (bonus > 0) {
        g.players[u.owner].spark += bonus;
        log(g, u.owner, "★ 队长登台！闪耀值 +" + bonus + "（共 " + g.players[u.owner].spark + "）");
        checkOver(g);
      }
    } else {
      var i = g.stage.indexOf(u);
      if (i >= 0) g.stage.splice(i, 1);
      u.zone = "camp";
      log(g, u.owner, "「" + u.name + "」退回阵营");
    }
    return { ok: true, unit: u, toZone: toZone };
  }

  /* ---------------- 对战（攻击） ---------------- */
  function inRange(g, a, t) {
    if (a.zone === "camp") return t.zone === "stage";
    if (a.zone === "stage") return t.zone === "stage" || t.zone === "camp";
    return false;
  }

  function legalAttackTargets(g, uid) {
    var a = unit(uid);
    if (!a) return [];
    var out = [];
    g.players[1 - a.owner].members.forEach(function (t) {
      if (t.zone === "rest") return;
      if (inRange(g, a, t)) out.push(t.uid);
    });
    return out;
  }

  /* 「射程内」的目标（不考虑行动次数 / 星星 / 状态） */
  function inRangeTargets(g, uid) {
    return legalAttackTargets(g, uid);
  }

  /* 「现在真的能打」的目标：射程 + 行动次数 + 星星 + 状态 全部满足 */
  function attackableTargets(g, uid) {
    return legalAttackTargets(g, uid).filter(function (tUid) {
      return canAttack(g, uid, tUid).ok;
    });
  }

  /* 为什么打不了某个目标（能打就返回 null） */
  function attackBlockReason(g, uid) {
    var a = unit(uid);
    if (!a) return "成员不存在";
    if (a.zone === "rest") return "还在休息中";
    if (a.suppressed) return "怯场中：本回合完全无法行动（下回合恢复）";
    if (a.pinned) return "被禁演，无法行动（不能移动，也不能对战）";
    if (a.attacksLeft <= 0) return "本回合已经对战过了";
    var ac = attackCost(a);
    if (g.players[g.turn].stars < ac) {
      return "星星不足（" + (a.zone === "stage" ? "台上出战" : "从阵营出战") +
             "需要 " + ac + "★，现在 " + g.players[g.turn].stars + "）";
    }
    if (a.zone === "camp" && !g.players[1 - a.owner].members.some(function (t) { return t.zone === "stage"; })) {
      return "在阵营里只能打舞台上的敌人，现在台上没有敌人";
    }
    return "射程内没有可对战的敌人";
  }

  function canAttack(g, aUid, tUid) {
    var a = unit(aUid), t = unit(tUid);
    if (!a || !t) return { ok: false, why: "成员不存在" };
    if (g.over) return { ok: false, why: "对局已结束" };
    if (a.owner !== g.turn) return { ok: false, why: "不是你的成员" };
    if (a.zone === "rest") return { ok: false, why: "还在休息中" };
    if (t.owner === a.owner) return { ok: false, why: "不能打自己人" };
    if (t.zone === "rest") return { ok: false, why: "对方正在休息" };
    if (a.suppressed) return { ok: false, why: "怯场中：本回合完全无法行动（下回合恢复）" };
    if (a.pinned) return { ok: false, why: "被禁演，无法行动（不能移动，也不能对战）" };
    if (t.veil) return { ok: false, why: "对方处于回避状态，这一回合无法被作为对战目标" };
    if (a.attacksLeft <= 0) return { ok: false, why: "本回合已经对战过了" };
    var ac = attackCost(a);
    if (g.players[g.turn].stars < ac) {
      return { ok: false, why: "星星不足（" + (a.zone === "stage" ? "台上出战" : "从阵营出战") + "需要 " + ac + "★）" };
    }
    if (!inRange(g, a, t)) {
      return { ok: false, why: a.zone === "camp" ? "在阵营里只能打舞台上的敌人" : "打不到那个目标" };
    }
    return { ok: true };
  }

  function attack(g, aUid, tUid) {
    bind(g);
    var chk = canAttack(g, aUid, tUid);
    if (!chk.ok) return chk;
    var a = unit(aUid), t = unit(tUid);
    g.players[g.turn].stars -= attackCost(a);
    a.attacksLeft--;
    var dmg = skillOf(a);
    log(g, a.owner, "「" + a.name + "」对战「" + t.name + "」");
    var r = damage(g, t, dmg, { src: a.name, srcIdx: a.owner });
    return { ok: true, attacker: a, target: t, dmg: dmg, real: r.real, ko: r.ko };
  }

  /* ---------------- 伤害 / 退场休息 ---------------- */
  function removeFromStage(g, u) {
    var i = g.stage.indexOf(u);
    if (i >= 0) g.stage.splice(i, 1);
  }

  function damage(g, u, amount, opt) {
    opt = opt || {};
    bind(g);
    var real = Math.max(0, amount - (u.shield || 0));
    if (real !== amount && amount > 0) {
      log(g, u.owner, "台风抵消了 " + (amount - real) + " 点伤害");
    }
    u.vita -= real;
    if (real > 0) {
      log(g, opt.srcIdx != null ? opt.srcIdx : (1 - u.owner),
        (opt.src ? opt.src + " → " : "") + "「" + u.name + "」活力值 -" + real + "（剩 " + Math.max(0, u.vita) + "）");
    }
    var ko = false;
    if (u.vita <= 0) {
      u.vita = 0;
      ko = true;
      removeFromStage(g, u);
      u.zone = "rest";
      u.restLeft = rules().REST_TURNS;
      u.tempSkill = 0; u.shield = 0;
      log(g, u.owner, "「" + u.name + "」活力值归零，退回阵营休息 " + rules().REST_TURNS + " 回合");
    }
    return { real: real, ko: ko };
  }

  function wakeUp(g, u) {
    bind(g);
    u.zone = "camp";
    u.restLeft = 0;
    u.vita = u.maxVita;
    log(g, u.owner, "「" + u.name + "」休息结束，活力值全满回到阵营！");
    return u;
  }

  /* ---------------- 出牌 ---------------- */
  function canPlay(g, cardId) {
    var c = BD.card(cardId);
    if (!c) return { ok: false, why: "未知卡牌" };
    if (g.over) return { ok: false, why: "对局已结束" };
    var p = g.players[g.turn];
    if (p.stars < c.cost) return { ok: false, why: "星星不足（需要 " + c.cost + "）" };
    return { ok: true };
  }

  function playCard(g, handIdx, targetUid) {
    bind(g);
    var p = g.players[g.turn];
    var id = p.hand[handIdx];
    var c = BD.card(id);
    if (!c) return { ok: false, why: "手牌不存在" };
    var chk = canPlay(g, id);
    if (!chk.ok) return chk;

    if (BD.Effects.needsTarget(c)) {
      if (targetUid == null) return { ok: false, why: "需要选择目标", needTarget: true };
      if (!BD.Effects.legalTarget(g, c, targetUid)) return { ok: false, why: "目标不合法" };
    }

    p.stars -= c.cost;
    p.hand.splice(handIdx, 1);
    p.discard.push(id);
    log(g, g.turn, "打出「" + c.name + "」");

    var ev = BD.Effects.run(g, { ownerIdx: g.turn, targetUid: targetUid, srcName: c.name }, c.fx || []);
    checkOver(g);
    return { ok: true, card: c, events: ev };
  }

  /* ---------------- 胜负 ---------------- */
  function sparkGainFor(g, idx) {
    var n = activeStageMembers(g, idx).length;
    return n + (rules().SPARK_TIER[n] || 0);
  }

  function checkOver(g) {
    if (g.over) return;
    for (var i = 0; i < 2; i++) {
      if (g.players[i].spark >= rules().SPARK_GOAL) {
        g.over = true;
        g.winner = i;
        log(g, i, "★ " + g.players[i].name + " 的闪耀值达到 " + rules().SPARK_GOAL + "，赢下这场演出 ★");
        return;
      }
    }
  }

  BD.Engine = {
    createGame: createGame, startTurn: startTurn, endTurn: endTurn,
    moveMember: moveMember, canMove: canMove,
    attack: attack, canAttack: canAttack, attackCost: attackCost,
    legalAttackTargets: legalAttackTargets, attackableTargets: attackableTargets,
    attackBlockReason: attackBlockReason, inRange: inRange,
    playCard: playCard, canPlay: canPlay,
    damage: damage, wakeUp: wakeUp, draw: draw,
    unit: function (uid) { return BD.__g && BD.__g._units[uid]; },
    bind: bind,
    membersOf: membersOf, aliveMembers: aliveMembers, stageMembers: stageMembers,
    activeStageMembers: activeStageMembers,
    skillOf: skillOf, sparkGainFor: sparkGainFor, moveCost: moveCost,
    checkOver: checkOver, log: log, shuffle: shuffle, removeFromStage: removeFromStage
  };

})(typeof window !== "undefined" ? window : global);
