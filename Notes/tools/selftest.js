/* ============================================================
 *  selftest.js —— 无头自测：数据校验 + 规则单测 + AI 对战
 *  运行：node tools/selftest.js
 * ========================================================== */
global.window = global;
var path = require("path");
var fs = require("fs");
var vm = require("vm");
var base = path.join(process.cwd(), "src");

["config.js", "art.js", "bands.js", "cards.js", "effects.js", "engine.js", "ai.js"].forEach(function (f) {
  var code = fs.readFileSync(path.join(base, f), "utf8");
  vm.runInThisContext(code, { filename: f });
});

var BD = global.BD, E = BD.Engine, R = BD.RULES;

var pass = 0, fail = 0, group = "";
function G(name) { group = name; console.log("\n── " + name + " " + "─".repeat(Math.max(2, 46 - name.length))); }
function ok(cond, name, extra) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (extra ? "  → " + extra : "")); }
}

/* ============================================================
 *  1. 数据校验
 * ========================================================== */
G("成员数据");
ok(BD.MEMBERS.length === 25, "共 25 名成员", BD.MEMBERS.length);
var byBand = {};
BD.MEMBERS.forEach(function (m) { byBand[m.band] = (byBand[m.band] || 0) + 1; });
ok(BD.BAND_ORDER.every(function (b) { return byBand[b] === 5; }), "五个乐队各 5 人", JSON.stringify(byBand));
ok(BD.MEMBERS.every(function (m) { return m.skill > 0 && m.vita > 0; }), "技能值 / 活力值都大于 0");
ok(BD.MEMBERS.every(function (m) { return BD.ROLES[m.role]; }), "定位合法");
ok(BD.MEMBERS.every(function (m) { return BD.BANDS[m.band]; }), "乐队合法");
ok(BD.MEMBERS.every(function (m) { return m.vita === 5; }), "全员活力值 5");
ok(BD.MEMBERS.every(function (m) { return m.skill === (m.leader ? 3 : 2); }), "队长技能值 3、其余 2");
ok(BD.MEMBERS.every(function (m) { return m.cost === (m.leader ? 3 : 2); }), "队长费 3、其余 2");
ok(BD.BAND_ORDER.every(function (b) {
  return BD.membersOfBand(b).filter(function (m) { return m.leader; }).length === 1;
}), "每队恰好一名队长");
var ids = {};
ok(BD.MEMBERS.every(function (m) { if (ids[m.id]) return false; ids[m.id] = 1; return true; }), "成员 id 不重复");
ok(BD.MEMBERS.every(function (m) { return BD.Art.member(m).indexOf("<svg") === 0; }), "每个成员都能生成剪影");

G("卡牌数据");
ok(BD.CARDS.length >= 30, "卡池 >= 30 张", BD.CARDS.length);
ok(BD.CARDS.every(function (c) { return c.cost >= 1; }), "费用都 >= 1");
ok(BD.CARDS.every(function (c) { return BD.BANDS[c.band]; }), "乐队合法");
ok(BD.CARDS.every(function (c) { return BD.Art.SYMBOLS.indexOf(c.art) >= 0; }), "剪影图形都存在");
ok(BD.CARDS.every(function (c) { return c.text && c.text.length > 2; }), "都有效果文字");
var badOp = BD.CARDS.filter(function (c) {
  return (c.fx || []).some(function (e) { return !BD.Effects.OPS[e.op]; });
});
ok(badOp.length === 0, "所有效果 op 都能解析", badOp.map(function (c) { return c.id; }).join(","));
var badTgt = BD.CARDS.filter(function (c) { return !BD.TARGET_HINT[c.target || "none"]; });
ok(badTgt.length === 0, "目标类型都合法", badTgt.map(function (c) { return c.id; }).join(","));
var cid = {};
ok(BD.CARDS.every(function (c) { if (cid[c.id]) return false; cid[c.id] = 1; return true; }), "卡 id 不重复");

G("卡组构建");
BD.BAND_ORDER.forEach(function (b) {
  var g = E.createGame({ bands: [b, "AVE"] });
  var d = g.players[0].deck;
  var okSize = d.length + g.players[0].hand.length === R.DECK_SIZE;
  var okOwn = d.concat(g.players[0].hand).every(function (id) {
    var c = BD.card(id);
    return c.band === b || c.band === "NEU";
  });
  var cnt = {}, okCopy = true;
  d.concat(g.players[0].hand).forEach(function (id) {
    cnt[id] = (cnt[id] || 0) + 1;
    if (cnt[id] > R.MAX_COPIES) okCopy = false;
  });
  ok(okSize && okOwn && okCopy, b + " 卡组合规（" + R.DECK_SIZE + " 张 / 只含本乐队+共通 / 同名 ≤" + R.MAX_COPIES + "）");
});

/* ============================================================
 *  2. 规则单测
 * ========================================================== */
function fresh(bands) {
  var g = E.createGame({ bands: bands || ["MYGO", "AVE"] });
  E.bind(g);
  E.startTurn(g);
  return g;
}

G("星星");
(function () {
  var g = fresh();
  ok(g.players[0].starsMax === R.STAR_START, "第 1 回合上限 = " + R.STAR_START, g.players[0].starsMax);
  ok(g.players[0].stars === R.STAR_START, "第 1 回合星星补满", g.players[0].stars);
  E.endTurn(g);
  ok(g.players[1].starsMax === R.STAR_START, "对手的第 1 回合同样是 " + R.STAR_START, g.players[1].starsMax);
  E.endTurn(g);
  ok(g.players[0].starsMax === R.STAR_START + 1, "自己的第 2 回合上限 +1", g.players[0].starsMax);
  // 一直涨到 STAR_MAX 就停
  var gg = fresh();
  for (var i = 0; i < 40; i++) E.endTurn(gg);
  ok(gg.players[gg.turn].starsMax === R.STAR_MAX, "上限涨到 " + R.STAR_MAX + " 后停止", gg.players[gg.turn].starsMax);
})();

G("移动与登台");
(function () {
  var g = fresh();
  g.players[0].stars = 10;
  var m = g.players[0].members[0];
  var before = g.players[0].stars;
  var r = E.moveMember(g, m.uid, "stage");
  ok(r.ok && m.zone === "stage", "可以登台");
  ok(g.players[0].stars === before - E.moveCost(m), "登台消耗该成员的费 " + E.moveCost(m) + "★", g.players[0].stars);

  // 队长登台额外闪耀值
  var gl = fresh();
  gl.players[0].stars = 10;
  var cap = gl.players[0].members.filter(function (u) { return u.leader; })[0];
  var normal = gl.players[0].members.filter(function (u) { return !u.leader; })[0];
  ok(!!cap, "每支乐队都有队长");
  var sp0 = gl.players[0].spark;
  E.moveMember(gl, cap.uid, "stage");
  ok(gl.players[0].spark === sp0 + R.LEADER_SPARK, "队长登台闪耀值 +" + R.LEADER_SPARK, gl.players[0].spark);
  E.endTurn(gl); E.endTurn(gl);
  var sp1 = gl.players[0].spark;
  E.moveMember(gl, normal.uid, "stage");
  ok(gl.players[0].spark === sp1, "普通成员登台不额外加闪耀", gl.players[0].spark);
  ok(E.moveMember(g, m.uid, "stage").ok === false, "同一回合不能重复移动");
  var r2 = E.moveMember(g, m.uid, "camp");
  ok(r2.ok === false, "本回合已经移动过 → 拒绝");
  // 舞台上限
  var g2 = fresh();
  g2.players[0].stars = 99;
  for (var i = 0; i < R.STAGE_SLOTS; i++) {
    g2.players[0].members[i].movesLeft = 1;
    E.moveMember(g2, g2.players[0].members[i].uid, "stage");
  }
  ok(g2.stage.length === R.STAGE_SLOTS, "舞台最多站 " + R.STAGE_SLOTS + " 人", g2.stage.length);
})();

G("攻击距离");
(function () {
  var g = fresh();
  var mine = g.players[0].members[0];       // 在自己阵营
  var foeOnStage = g.players[1].members[0];
  var foeInCamp = g.players[1].members[1];
  E.endTurn(g);                             // 轮到对手，让他的人先上台
  g.players[1].stars = 99;
  E.moveMember(g, foeOnStage.uid, "stage");
  E.endTurn(g);                             // 回到我方回合
  g.players[0].stars = 99;

  ok(E.canAttack(g, mine.uid, foeOnStage.uid).ok, "阵营 → 舞台上的敌人：可以打");
  ok(!E.canAttack(g, mine.uid, foeInCamp.uid).ok, "阵营 → 对方阵营：打不到");

  E.moveMember(g, mine.uid, "stage");
  mine.movesLeft = 1; mine.attacksLeft = 1;
  g.players[0].stars = 99;
  ok(E.canAttack(g, mine.uid, foeOnStage.uid).ok, "舞台 → 舞台上的敌人：可以打");
  ok(E.canAttack(g, mine.uid, foeInCamp.uid).ok, "舞台 → 对方阵营：可以打");
  ok(!E.canAttack(g, mine.uid, g.players[0].members[2].uid).ok, "不能打自己人");

  var before = g.players[0].stars;
  ok(E.attackCost(mine) === R.COST_ATTACK_STAGE, "台上出手算 " + R.COST_ATTACK_STAGE + "★", E.attackCost(mine));
  E.attack(g, mine.uid, foeInCamp.uid);
  ok(g.players[0].stars === before - R.COST_ATTACK_STAGE,
     "对战消耗 " + R.COST_ATTACK_STAGE + "★（台上出手）", g.players[0].stars);
  ok(E.attack(g, mine.uid, foeInCamp.uid).ok === false, "每回合只能对战 1 次");

  /* 从自己阵营打台上的敌人：贵 1 颗 */
  var gC = fresh();
  var aC = gC.players[0].members[0];        // 在阵营
  var eC = gC.players[1].members[0];
  E.endTurn(gC);
  gC.players[1].stars = 99;
  E.moveMember(gC, eC.uid, "stage");
  E.endTurn(gC);
  gC.players[0].stars = 99;
  ok(E.attackCost(aC) === R.COST_ATTACK_CAMP, "从阵营出手算 " + R.COST_ATTACK_CAMP + "★", E.attackCost(aC));
  var bc = gC.players[0].stars;
  E.attack(gC, aC.uid, eC.uid);
  ok(gC.players[0].stars === bc - R.COST_ATTACK_CAMP,
     "阵营 → 舞台 扣 " + R.COST_ATTACK_CAMP + "★", gC.players[0].stars);

  /* 「真正能打」的目标列表：必须同时满足射程 + 行动次数 + 星星 + 状态 */
  var g2 = fresh();
  var a2 = g2.players[0].members[0];
  var e2 = g2.players[1].members[0];
  E.endTurn(g2);
  g2.players[1].stars = 99;
  E.moveMember(g2, e2.uid, "stage");
  E.endTurn(g2);
  g2.players[0].stars = 99;

  ok(E.attackableTargets(g2, a2.uid).indexOf(e2.uid) >= 0, "星星够、在射程内 → 是可对战目标");
  ok(E.legalAttackTargets(g2, a2.uid).indexOf(e2.uid) >= 0, "射程列表里也有它");

  g2.players[0].stars = E.attackCost(a2) - 1;
  ok(E.attackableTargets(g2, a2.uid).length === 0, "星星不足 → 没有可对战目标（不再出现「能拖但打不了」）");
  ok(E.legalAttackTargets(g2, a2.uid).length === 1, "但射程列表仍有它（射程不受星星影响）");

  g2.players[0].stars = 99;
  E.attack(g2, a2.uid, e2.uid);
  ok(E.attackableTargets(g2, a2.uid).length === 0, "本回合已经对战过 → 没有可对战目标");
  ok(/已经对战/.test(E.attackBlockReason(g2, a2.uid)), "attackBlockReason 会说明「已经对战过了」");

  var g3 = fresh();
  var a3 = g3.players[0].members[0];
  g3.players[0].stars = 99;
  ok(E.attackableTargets(g3, a3.uid).length === 0, "台上没敌人时，阵营里的成员没有可对战目标");
  ok(/台上没有敌人/.test(E.attackBlockReason(g3, a3.uid)), "attackBlockReason 会说明「台上没有敌人」");
  a3.suppressed = true;
  ok(E.attackableTargets(g3, a3.uid).length === 0, "怯场中 → 不能对战");
  ok(/怯场/.test(E.attackBlockReason(g3, a3.uid)), "attackBlockReason 会说明「怯场」");
})();

G("闪耀值达标立刻结束");
(function () {
  var g = fresh();
  ok(!g.over, "开局还没结束");

  // 卡牌加闪耀 → 当场判定结束
  g.players[0].stars = 10;
  g.players[0].spark = R.SPARK_GOAL - 1;
  g.players[0].hand = ["mygo_hitoshizuku"];      // 壱雫空：闪耀 +3
  E.playCard(g, 0, null);
  ok(g.over === true && g.winner === 0, "卡牌把闪耀值顶到目标 → 立刻判定结束");

  // 队长登台的额外 +1 → 也当场判定
  var g2 = fresh();
  g2.players[0].stars = 10;
  g2.players[0].spark = R.SPARK_GOAL - 1;
  var cap = g2.players[0].members.filter(function (u) { return u.leader; })[0];
  E.moveMember(g2, cap.uid, "stage");
  ok(g2.over === true && g2.winner === 0, "队长登台的 +1 闪耀达标 → 立刻判定结束");

  // 已经是结束态就不再重复判定
  var w = g2.winner;
  E.checkOver(g2);
  ok(g2.over === true && g2.winner === w, "重复判定不会改变结果");
})();

G("活力值归零 → 休息");
(function () {
  var g = fresh();
  var foe = g.players[1].members[0];
  E.moveMember(g, foe.uid, "stage");
  E.damage(g, foe, foe.vita + 5, { src: "测试" });
  ok(foe.zone === "rest", "活力值归零 → 退回休息");
  ok(foe.restLeft === R.REST_TURNS, "休息倒计时 = " + R.REST_TURNS, foe.restLeft);
  ok(g.stage.indexOf(foe) < 0, "立刻让出舞台位置");
  ok(foe.vita === 0, "活力值为 0");

  // 对手（player 1）的回合里倒计时递减
  var turns = 0;
  while (foe.zone === "rest" && turns < 20) {
    E.endTurn(g);
    turns++;
  }
  ok(foe.zone === "camp", "休息结束后回到自己阵营", foe.zone);
  ok(foe.vita === foe.maxVita, "回来时活力值全满", foe.vita + "/" + foe.maxVita);
  ok(turns >= R.REST_TURNS, "至少休息了 " + R.REST_TURNS + " 个回合", turns);
})();

G("闪耀值结算");
function sparkTest(n) {
  var g = fresh();
  g.players[0].stars = 99;
  for (var i = 0; i < n; i++) {
    g.players[0].members[i].movesLeft = 1;
    E.moveMember(g, g.players[0].members[i].uid, "stage");
  }
  var before = g.players[0].spark;
  E.endTurn(g);
  return g.players[0].spark - before;
}
ok(sparkTest(0) === 0, "台上 0 人 → +0");
ok(sparkTest(1) === 1, "台上 1 人 → +1");
ok(sparkTest(2) === 2, "台上 2 人 → +2");
ok(sparkTest(3) === 3 + 1, "台上 3 人 → +4");
ok(sparkTest(4) === 4 + 2, "台上 4 人 → +6");
ok(sparkTest(5) === 5 + 3, "台上 5 人 → +8");

G("胜负判定");
(function () {
  var g = fresh();
  g.players[0].spark = R.SPARK_GOAL - 1;
  g.players[0].stars = 99;
  g.players[0].members[0].movesLeft = 1;
  E.moveMember(g, g.players[0].members[0].uid, "stage");
  E.endTurn(g);
  ok(g.over === true && g.winner === 0, "闪耀值达到 " + R.SPARK_GOAL + " 就赢", g.over + "/" + g.winner);
})();

G("卡牌效果");
(function () {
  var g = fresh();
  g.players[0].stars = 99;
  var foe = g.players[1].members[0];
  var mine = g.players[0].members[0];

  // 伤害
  g.players[0].hand = ["mug_ritsu"];
  var hp = foe.vita;
  var r = E.playCard(g, 0, foe.uid);
  ok(r.ok && foe.vita === hp - 3, "「律のシャウト」造成 3 点伤害", foe.vita);

  // 治疗
  g.players[0].stars = 99;
  mine.vita = 1;
  g.players[0].hand = ["mygo_shichou"];
  E.playCard(g, 0, mine.uid);
  ok(mine.vita === Math.min(mine.maxVita, 4), "「詩超絆」回复 3 点活力值（不超上限 " + mine.maxVita + "）", mine.vita);

  // 闪耀
  g.players[0].stars = 99;
  g.players[0].hand = ["mug_big"];
  var sp = g.players[0].spark;
  E.playCard(g, 0, null);
  ok(g.players[0].spark === sp + 3, "「無限大宣言！」加 3 点闪耀值", g.players[0].spark);

  // 星星
  g.players[0].stars = 4;                    // 卡本身 1★，出手后剩 3，再 +3
  g.players[0].hand = ["mil_smile"];
  E.playCard(g, 0, null);
  ok(g.players[0].stars === 6, "「幸せのおすそわけ」净加 3 颗星星", g.players[0].stars);

  // 抽牌
  g.players[0].stars = 99;
  var hn = g.players[0].hand.length;
  g.players[0].hand = ["mil_hotaru"];
  E.playCard(g, 0, null);
  ok(g.players[0].hand.length === 2, "「蛍のメロディ」抽 2 张", g.players[0].hand.length);

  // 目标合法性
  g.players[0].stars = 99;
  g.players[0].hand = ["mygo_shichou"];
  ok(E.playCard(g, 0, foe.uid).ok === false, "己方治疗卡不能选敌方成员");

  // 唤醒
  var g2 = fresh();
  g2.players[0].stars = 99;
  var m2 = g2.players[0].members[1];
  E.damage(g2, m2, 999, {});
  ok(m2.zone === "rest", "先打进休息");
  g2.players[0].hand = ["neu_rest"];
  E.playCard(g2, 0, m2.uid);
  ok(m2.zone === "camp" && m2.vita === m2.maxVita, "「后台休息室」立刻唤醒并回满");
})();

G("状态");
(function () {
  var g = fresh();
  g.players[0].stars = 99;
  var foe = g.players[1].members[0];
  g.players[0].hand = ["neu_mc"];
  E.playCard(g, 0, foe.uid);
  ok(foe.pinned === true, "禁演生效");
  ok(E.canMove(g, foe.uid, "stage").ok === false || foe.owner !== g.turn, "禁演无法移动");

  var g2 = fresh();
  g2.players[0].stars = 99;
  var mine = g2.players[0].members[0];
  g2.players[0].hand = ["ikka_yomogi"];
  E.playCard(g2, 0, mine.uid);
  var before = mine.vita;
  E.damage(g2, mine, 5, {});
  ok(mine.vita === before - 2, "台风 3 抵消 3 点伤害", before + "→" + mine.vita);
})();

G("禁演 = 不能移动，也不能对战");
(function () {
  var g = fresh();
  g.players[0].stars = 99;
  var mine = g.players[0].members[0];
  var foe = g.players[1].members[0];
  mine.zone = "stage"; foe.zone = "stage";
  g.stage.push(mine, foe);
  mine.pinned = true;
  ok(E.canAttack(g, mine.uid, foe.uid).ok === false, "禁演中的成员不能对战", E.canAttack(g, mine.uid, foe.uid).why);
  ok(E.attackBlockReason(g, mine.uid).indexOf("禁演") >= 0, "打不了的原因会提示「禁演」", E.attackBlockReason(g, mine.uid));
  ok(E.attackableTargets(g, mine.uid).length === 0, "禁演成员的可打目标列表为空");
  mine.pinned = false;
  ok(E.canAttack(g, mine.uid, foe.uid).ok, "解除禁演后可以正常对战");
})();

G("回避 = 一回合无法被作为对战目标");
(function () {
  var card = BD.card("mygo_shichou");
  ok(card.fx[1].op === "veil" && card.fx[0].op === "heal", "「詩超絆」效果 = 回复 3 + 回避",
     card.fx.map(function (e) { return e.op; }).join(","));

  var g = fresh();
  g.players[0].stars = 99;
  var mine = g.players[0].members[0];
  mine.vita = 2;
  g.players[0].hand = ["mygo_shichou"];
  var r = E.playCard(g, 0, mine.uid);
  ok(r.ok && mine.veil === true && mine.vita === 5, "打出后回复到 5 并进入回避", mine.vita);

  E.endTurn(g);                                 // 轮到对手
  var foe = g.players[1].members[0];
  g.players[1].stars = 99;
  foe.zone = "stage"; g.stage.push(foe);        // 对手上台（射程覆盖我方阵营）
  ok(E.canAttack(g, foe.uid, mine.uid).ok === false, "回避中的成员不能被选为对战目标",
     E.canAttack(g, foe.uid, mine.uid).why);
  ok(E.attackableTargets(g, foe.uid).indexOf(mine.uid) < 0, "回避成员不出现在可打列表里");
  var other = g.players[0].members[1];
  ok(E.canAttack(g, foe.uid, other.uid).ok, "回避只保护它自己，别人照样能打");

  E.endTurn(g);                                 // 回到我方回合开始 → 回避解除
  ok(g.turn === 0 && mine.veil === false, "到施放者的下个回合开始自动解除");
})();

G("怯场 = 完全无法行动");
(function () {
  /* 1) 卡牌能把目标打进怯场，并且持续到它自己的回合 */
  var g = fresh();
  g.players[0].stars = 99;
  var foe = g.players[1].members[0];
  var mine = g.players[0].members[0];
  foe.zone = "stage"; mine.zone = "stage";
  g.stage.push(foe, mine);                      // 双方台上都有人，保证本来能对战
  g.players[0].hand = ["mygo_kageiro"];
  var r = E.playCard(g, 0, foe.uid);
  ok(r.ok && foe.suppressed === true, "「影色舞」让目标进入怯场");
  ok(E.activeStageMembers(g, 1).length === 0, "怯场的人不算「台上可用人数」", E.activeStageMembers(g, 1).length);

  E.endTurn(g);                                 // 轮到被怯场的一方
  ok(g.turn === 1 && foe.suppressed === true, "怯场持续到拥有者自己的回合");
  ok(E.canMove(g, foe.uid, "camp").ok === false, "怯场：不能移动（下场也不行）");
  ok(E.canAttack(g, foe.uid, mine.uid).ok === false, "怯场：不能对战");
  ok(E.attackableTargets(g, foe.uid).length === 0, "怯场：不出现在可打目标列表");
  var aiAct = BD.AI.step(g);
  ok(aiAct.kind === "end" || aiAct.aUid !== foe.uid, "AI 不会指挥怯场的人出手");

  E.endTurn(g);                                 // 它的回合结束
  ok(foe.suppressed === false, "怯场在拥有者回合结束时自动解除（只封 1 回合）");

  /* 2) 怯场的人不参与回合结束的闪耀结算 */
  var g2 = fresh();
  var a = g2.players[0].members[0], b = g2.players[0].members[1];
  a.zone = "stage"; b.zone = "stage"; b.suppressed = true;
  g2.stage.push(a, b);
  ok(E.stageMembers(g2, 0).length === 2 && E.activeStageMembers(g2, 0).length === 1,
    "台上站 2 人，但怯场的那个不计入结算");
  ok(E.sparkGainFor(g2, 0) === 1, "预览闪耀只算 1 人", E.sparkGainFor(g2, 0));
  var sp = g2.players[0].spark;
  E.endTurn(g2);
  ok(g2.players[0].spark === sp + 1, "回合结束只 +1 闪耀（不是 +2）", sp + "→" + g2.players[0].spark);

  /* 3) 净化可以提前解除 */
  var g3 = fresh();
  g3.players[0].stars = 99;
  var t = g3.players[0].members[0];
  t.suppressed = true;
  g3.players[0].hand = ["ave_angel"];
  E.playCard(g3, 0, t.uid);
  ok(t.suppressed === false, "「Angelfire」的净化能解除怯场");
})();

/* ============================================================
 *  3. AI 对战
 * ========================================================== */
G("AI 对战 20 局");
(function () {
  var done = 0, steps = 0, maxSteps = 0, err = null;
  for (var n = 0; n < 20; n++) {
    var bands = [BD.BAND_ORDER[n % 5], BD.BAND_ORDER[(n + 2) % 5]];
    var g = E.createGame({ bands: bands });
    E.bind(g);
    E.startTurn(g);
    var guard = 0;
    try {
      while (!g.over && guard++ < 3000) {
        var a = BD.AI.step(g);
        if (a.kind === "end") E.endTurn(g);
        else if (a.kind === "attack") E.attack(g, a.aUid, a.tUid);
        else if (a.kind === "move") E.moveMember(g, a.uid, a.toZone);
        else if (a.kind === "card") E.playCard(g, a.handIdx, a.targetUid);
      }
    } catch (e) { err = e.message + "\n" + e.stack; break; }
    if (g.over) done++;
    steps += guard;
    maxSteps = Math.max(maxSteps, guard);
  }
  ok(!err, "AI 对战无异常", err);
  ok(done === 20, "20 局全部分出胜负", done + "/20");
  console.log("    平均 " + Math.round(steps / 20) + " 步 / 最长 " + maxSteps + " 步");
})();

/* ============================================================
 *  难度
 * ========================================================== */
G("难度");
(function () {
  ok(BD.DIFF_ORDER.join(",") === "easy,normal,hard", "三档难度：简单 / 普通 / 困难");
  ok(BD.DIFF_ORDER.every(function (k) { return BD.DIFFICULTY[k] && BD.DIFFICULTY[k].budget > 0; }), "每档都有行动步数预算");

  var ge = E.createGame({ bands: ["MYGO", "AVE"], difficulty: "hard" });
  ok(ge.difficulty === "hard" && ge.diff.cn === "困难", "开局能带上难度", ge.difficulty);

  /* 一回合内电脑最多走几步：不能超过该难度的预算 */
  function actsPerTurn(key) {
    var g = E.createGame({ bands: ["MYGO", "AVE"], difficulty: key });
    E.bind(g);
    E.startTurn(g);
    E.endTurn(g);                 // 正经轮到电脑（行动次数才会重置）
    g.players[1]._acts = 0;
    g.players[1].stars = 99;
    var n = 0, guard = 0;
    while (guard++ < 40) {
      var a = BD.AI.step(g);
      if (a.kind === "end") break;
      n++;
      if (a.kind === "attack") E.attack(g, a.aUid, a.tUid);
      else if (a.kind === "move") E.moveMember(g, a.uid, a.toZone);
      else if (a.kind === "card") E.playCard(g, a.handIdx, a.targetUid);
    }
    return n;
  }
  BD.DIFF_ORDER.forEach(function (k) {
    var n = actsPerTurn(k);
    ok(n <= BD.DIFFICULTY[k].budget, "「" + BD.DIFFICULTY[k].cn + "」一回合最多 " + BD.DIFFICULTY[k].budget + " 步", n + " 步");
  });

  /* 困难档的额外资源：只加在电脑那一侧，玩家规则不变 */
  var H = BD.DIFFICULTY.hard;
  ok(H.budget > BD.DIFFICULTY.normal.budget, "困难档步数预算高于普通档", H.budget + " > " + BD.DIFFICULTY.normal.budget);
  ok(H.aiStarBonus >= 1 && H.aiDrawBonus >= 1 && H.focusLeader === true, "困难档有额外 ★ / 额外抽牌 / 集火队长");

  /* 上台目标：三档都要积极，且随难度递增 */
  var D = BD.DIFFICULTY;
  ok(D.easy.stageGoal >= 3 && D.normal.stageGoal >= 4 && D.hard.stageGoal >= 5,
     "三档都积极上台（>= 3 / 4 / 5 人）",
     "easy " + D.easy.stageGoal + " / normal " + D.normal.stageGoal + " / hard " + D.hard.stageGoal);
  ok(D.easy.stageGoal <= D.normal.stageGoal && D.normal.stageGoal <= D.hard.stageGoal,
     "上台目标随难度递增");

  /* AI 第一步：台上人不够时先上台，而不是先对战 */
  (function () {
    var g = E.createGame({ bands: ["MYGO", "AVE"], difficulty: "easy" });
    E.bind(g);
    E.startTurn(g);
    E.endTurn(g);                 // 轮到电脑，行动次数重置
    g.players[1]._acts = 0;
    g.players[1].stars = 8;
    var t = g.players[0].members[0];        // 玩家侧有人上台，AI 本来可以直接打他
    t.zone = "stage"; g.stage.push(t);
    var a = BD.AI.step(g);
    ok(a.kind === "move" && a.toZone === "stage", "台上人不够时，AI 优先上台而不是先对战", a.kind);
  })();

  (function () {
    var g = E.createGame({ bands: ["MYGO", "AVE"], difficulty: "hard" });
    E.bind(g);
    for (var i = 0; i < 30; i++) E.endTurn(g);        // 一路推到星星上限
    var p0 = g.players[0], p1 = g.players[1];
    ok(p0.starsMax === R.STAR_MAX, "困难档玩家星星上限仍是 " + R.STAR_MAX + "★", p0.starsMax);
    ok(p1.starsMax === R.STAR_MAX + H.aiStarBonus, "困难档电脑星星上限 = " + (R.STAR_MAX + H.aiStarBonus) + "★", p1.starsMax);
    ok(p0.stars === p0.starsMax && p1.stars === p1.starsMax, "两边每回合都补满");

    var g2 = E.createGame({ bands: ["MYGO", "AVE"], difficulty: "hard" });
    E.bind(g2); E.startTurn(g2);
    g2.turn = 1;
    var before = g2.players[1].hand.length;
    E.startTurn(g2);
    ok(g2.players[1].hand.length === before + R.DRAW_PER_TURN + H.aiDrawBonus,
      "困难档电脑每回合抽 " + (R.DRAW_PER_TURN + H.aiDrawBonus) + " 张", g2.players[1].hand.length - before + " 张");
  })();
})();


/* ============================================================
 *  卡牌平衡（防止调完数值又被改回去 / 文案和效果对不上）
 * ========================================================== */
G("卡牌平衡");
(function () {
  var HEAL_CAP = 3;          // 单卡回复量上限
  var AOE_MIN = 4;           // 群体伤害卡最低费用
  var WAKE_MIN = 3;          // 复活卡最低费用

  function has(c, op) { return (c.fx || []).some(function (e) { return e.op === op; }); }

  var bigHeal = BD.CARDS.filter(function (c) {
    return (c.fx || []).some(function (e) { return e.op === "heal" && e.amount > HEAL_CAP; });
  });
  ok(bigHeal.length === 0, "没有回复量超过 " + HEAL_CAP + " 的卡", bigHeal.map(function (c) { return c.name + "(" + c.fx.filter(function (e) { return e.op === "heal"; })[0].amount + ")"; }).join(","));

  var cheapAoe = BD.CARDS.filter(function (c) { return has(c, "dmgAll") && c.cost < AOE_MIN; });
  ok(cheapAoe.length === 0, "群体伤害卡都 >= " + AOE_MIN + "★", cheapAoe.map(function (c) { return c.name + "(" + c.cost + "★)"; }).join(","));

  var aoe = BD.CARDS.filter(function (c) { return has(c, "dmgAll"); });
  ok(aoe.every(function (c) { return c.cost === 4; }), "群体伤害卡统一 4★",
     aoe.map(function (c) { return c.name + " " + c.cost + "★"; }).join(" / "));

  var cheapWake = BD.CARDS.filter(function (c) { return has(c, "wake") && c.cost < WAKE_MIN; });
  ok(cheapWake.length === 0, "复活卡都 >= " + WAKE_MIN + "★", cheapWake.map(function (c) { return c.name + "(" + c.cost + "★)"; }).join(","));

  ok(BD.CARDS.every(function (c) { return c.cost <= R.STAR_MAX; }), "没有卡贵到打不出（<= " + R.STAR_MAX + "★）");

  /* 文案里写的数字要和 fx 里的数字一致（只查最常见的三类） */
  var mismatch = [];
  BD.CARDS.forEach(function (c) {
    (c.fx || []).forEach(function (e) {
      if (e.op === "heal" && c.text.indexOf("回复 " + e.amount + " 点活力值") < 0) mismatch.push(c.name + " heal" + e.amount);
      if (e.op === "dmg" && c.text.indexOf("造成 " + e.amount + " 点伤害") < 0) mismatch.push(c.name + " dmg" + e.amount);
      if (e.op === "buff" && c.text.indexOf("技能值 +" + e.skill) < 0) mismatch.push(c.name + " buff" + e.skill);
    });
  });
  ok(mismatch.length === 0, "卡面文字与效果数值一致", mismatch.join(","));

  /* 同样的效果不该一张贵一张便宜太多（技能 +3 的两张做个对照） */
  var b3 = BD.CARDS.filter(function (c) { return (c.fx || []).some(function (e) { return e.op === "buff" && e.skill === 3; }); });
  var lo = Math.min.apply(null, b3.map(function (c) { return c.cost; }));
  var hi = Math.max.apply(null, b3.map(function (c) { return c.cost; }));
  ok(hi - lo <= 1, "「技能值 +3」的几张卡费用差不超过 1★", b3.map(function (c) { return c.name + " " + c.cost + "★"; }).join(" / "));
})();


/* ============================================================
 *  谢幕（6★ 强制清场）
 * ========================================================== */
G("谢幕 · 强制清场");
(function () {
  var card = BD.card("neu_finale");
  ok(!!card, "「谢幕」在卡池里");
  ok(card && card.cost === 6, "「谢幕」费用 6★", card && card.cost);
  ok(card && card.target === "none" && card.fx.length === 1 && card.fx[0].op === "clearStage",
     "不需要目标、只做强制清场");
  ok(card && card.copies === 2, "每方牌库固定 2 张", card && card.copies);

  var g0 = E.createGame({ bands: ["MYGO", "AVE"] });
  [0, 1].forEach(function (i) {
    var all = g0.players[i].deck.concat(g0.players[i].hand);
    var n = all.filter(function (id) { return id === "neu_finale"; }).length;
    ok(n === 2, "第 " + (i === 0 ? "一" : "二") + " 方牌库恰好 2 张「谢幕」", n + " 张");
  });
  ok(g0.players[0].deck.concat(g0.players[0].hand).length === R.DECK_SIZE,
     "固定份数卡加入后牌库仍是 " + R.DECK_SIZE + " 张",
     g0.players[0].deck.length + g0.players[0].hand.length);

  var g = fresh();
  g.players[0].stars = 99;
  var mine = g.players[0].members.slice(0, 2);
  var foe = g.players[1].members.slice(0, 2);
  mine.concat(foe).forEach(function (u) { u.zone = "stage"; g.stage.push(u); });

  /* 强制：禁演 / 怯场 / 本回合已移动过，也照样被请下台 */
  mine[0].pinned = true;
  foe[0].suppressed = true;
  foe[1].movesLeft = 0;
  var vitaBefore = mine.concat(foe).map(function (u) { return u.vita; });
  var movesBefore = mine.concat(foe).map(function (u) { return u.movesLeft; });
  var sparkBefore = g.players[0].spark;
  var restGuy = g.players[0].members[4];
  restGuy.zone = "rest"; restGuy.restLeft = 3;
  var campGuy = g.players[1].members[4];

  g.players[0].hand.push("neu_finale");
  var res = E.playCard(g, g.players[0].hand.length - 1, null);
  ok(res.ok, "「谢幕」可以打出", res.why || "");
  ok(g.stage.length === 0, "舞台被清空", g.stage.length + " 人");
  ok(mine.concat(foe).every(function (u) { return u.zone === "camp"; }),
     "双方台上的成员都退回各自阵营");
  ok(res.events && res.events[0] && res.events[0].type === "clearStage" &&
     res.events[0].count === 4 && res.events[0].uids.length === 4,
     "动画事件带上了全部 4 名成员", res.events && res.events[0] && res.events[0].count);
  ok(mine.concat(foe).every(function (u, i) { return u.vita === vitaBefore[i]; }),
     "清场不造成任何伤害 / 回复");
  ok(mine.concat(foe).every(function (u, i) { return u.movesLeft === movesBefore[i]; }),
     "清场不消耗移动次数（强制，不算一次移动）");
  ok(g.players[0].spark === sparkBefore, "清场不直接增加闪耀值");
  ok(restGuy.zone === "rest" && campGuy.zone === "camp", "休息中 / 阵营里的人不受影响");
  ok(E.sparkGainFor(g, 0) === 0 && E.sparkGainFor(g, 1) === 0,
     "清场后回合结束双方都拿不到台上闪耀");

  var g2 = fresh();
  g2.players[0].stars = 99;
  g2.players[0].hand.push("neu_finale");
  var r2 = E.playCard(g2, g2.players[0].hand.length - 1, null);
  ok(r2.ok && g2.stage.length === 0, "舞台本来就空时打出也不出错");
})();

console.log("\n" + "═".repeat(52));
console.log(fail === 0 ? "  全部通过：" + pass + " 项 ✓" : "  通过 " + pass + " 项，失败 " + fail + " 项 ✗");
console.log("═".repeat(52) + "\n");
process.exit(fail === 0 ? 0 : 1);
