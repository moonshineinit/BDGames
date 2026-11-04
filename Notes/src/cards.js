/* ============================================================
 *  cards.js —— 剪影卡牌库（数据层）
 *
 *  加卡只往 CARDS 里追加一个对象，引擎、UI、AI 都不用改。
 *
 *  字段：
 *    id      唯一标识
 *    name    卡名
 *    band    MYGO / AVE / MUGEN / MILLS / IKKA / NEU
 *    cost    消耗星星
 *    art     剪影图形（见 art.js 的 SYM：star / spark / flame / heart / note /
 *            moon / bolt / wings / crown / shield / curtain / glowstick /
 *            mic / guitar / bass / drums / keyboard / dj / clock / starflow）
 *    target  none 不用选 / allyMember 己方成员 / enemyMember 敌方成员 /
 *            anyMember 任意成员
 *    text    卡面文字（写的就是实际生效的效果）
 *    fx      效果数组，见 effects.js
 *    copies  可选：每方牌库固定放几张（不写就按 MAX_COPIES 随机洗入）
 * ========================================================== */
(function (root) {
  var BD = root.BD = root.BD || {};

  /* ---------------- MyGO!!!!!：羁绊 · 重整旗鼓 ----------------
   * 前 4 张是官方曲名，后 2 张为原创主题卡，可自由改。
   */
  var MYGO = [
    { id: "mygo_meisei", name: "迷星叫", band: "MYGO", cost: 4, art: "bolt",
      target: "enemyMember", text: "对一名敌方成员造成 3 点伤害。",
      fx: [{ op: "dmg", amount: 3 }] },

    { id: "mygo_hekitan", name: "碧天伴走", band: "MYGO", cost: 3, art: "wings",
      target: "allyMember", text: "一名己方成员本回合技能值 +2，并回复 2 点活力值。",
      fx: [{ op: "buff", skill: 2 }, { op: "heal", amount: 2 }] },

    { id: "mygo_shichou", name: "詩超絆", band: "MYGO", cost: 5, art: "heart",
      target: "allyMember", text: "一名己方成员回复 3 点活力值，且直到你的下个回合开始，无法被作为对战目标。",
      fx: [{ op: "heal", amount: 3 }, { op: "veil" }] },

    { id: "mygo_hitoshizuku", name: "壱雫空", band: "MYGO", cost: 3, art: "starflow",
      target: "none", text: "立刻获得 3 点闪耀值。",
      fx: [{ op: "spark", amount: 3 }] },

    { id: "mygo_kageiro", name: "影色舞", band: "MYGO", cost: 3, art: "curtain",
      target: "enemyMember", text: "使一名敌方成员怯场：它的下一个回合完全无法行动（不能移动、不能对战，也不计入闪耀结算）。",
      fx: [{ op: "suppress" }] },

    { id: "mygo_kowareta", name: "壊れた世界の秒針は", band: "MYGO", cost: 4, art: "flame",
      target: "none", text: "对舞台上所有敌方成员造成 2 点伤害。",
      fx: [{ op: "dmgAll", scope: "enemyStage", amount: 2 }] }
  ];

  /* ---------------- Ave Mujica：假面 · 支配 · 高单点 ---------------- */
  var AVE = [
    { id: "ave_kuro", name: "黒のバースデイ", band: "AVE", cost: 5, art: "bolt",
      target: "enemyMember", text: "对一名敌方成员造成 5 点伤害。",
      fx: [{ op: "dmg", amount: 5 }] },

    { id: "ave_tenkyu", name: "天球のMúsica", band: "AVE", cost: 4, art: "crown",
      target: "allyMember", text: "一名己方成员本回合技能值 +3。",
      fx: [{ op: "buff", skill: 3 }] },

    { id: "ave_angel", name: "Angelfire", band: "AVE", cost: 3, art: "wings",
      target: "allyMember", text: "一名己方成员回复 3 点活力值，并清除其负面状态。",
      fx: [{ op: "heal", amount: 3 }, { op: "cleanse" }] },

    { id: "ave_prison", name: "Imprisoned XII", band: "AVE", cost: 3, art: "curtain",
      target: "enemyMember", text: "使一名敌方成员怯场（下回合完全无法行动），并使其禁演（无法移动，也无法对战）。",
      fx: [{ op: "suppress" }, { op: "pin" }] },

    { id: "ave_masque", name: "Masquerade Rhapsody", band: "AVE", cost: 4, art: "starflow",
      target: "none", text: "对舞台上所有敌方成员造成 2 点伤害。",
      fx: [{ op: "dmgAll", scope: "enemyStage", amount: 2 }] },

    { id: "ave_georgette", name: "Georgette Me", band: "AVE", cost: 4, art: "shield",
      target: "allyMember", text: "一名己方成员获得台风 3，并可以再行动一次。",
      fx: [{ op: "shield", amount: 3 }, { op: "rally" }] }
  ];

  /* ---------------- 夢限大みゅーたいぷ：无限大 · 元气 · 资源 ---------------- */
  var MUGEN = [
    { id: "mug_big", name: "無限大宣言！", band: "MUGEN", cost: 4, art: "starflow",
      target: "none", text: "立刻获得 3 点闪耀值。",
      fx: [{ op: "spark", amount: 3 }] },

    { id: "mug_cheer", name: "全力・応援モード", band: "MUGEN", cost: 3, art: "glowstick",
      target: "allyMember", text: "一名己方成员本回合技能值 +2，并回复 2 点活力值。",
      fx: [{ op: "buff", skill: 2 }, { op: "heal", amount: 2 }] },

    { id: "mug_yuno", name: "ユノのターンテーブル", band: "MUGEN", cost: 3, art: "dj",
      target: "none", text: "抽 2 张牌，并获得 1 颗星星。",
      fx: [{ op: "draw", amount: 2 }, { op: "star", amount: 1 }] },

    { id: "mug_ritsu", name: "律のシャウト", band: "MUGEN", cost: 3, art: "flame",
      target: "enemyMember", text: "对一名敌方成员造成 3 点伤害。",
      fx: [{ op: "dmg", amount: 3 }] },

    { id: "mug_arale", name: "あられのひとこと", band: "MUGEN", cost: 2, art: "mic",
      target: "enemyMember", text: "使一名敌方成员禁演（无法移动，也无法对战）。",
      fx: [{ op: "pin" }] },

    { id: "mug_dream", name: "夢は無限大", band: "MUGEN", cost: 5, art: "wings",
      target: "allyMember", text: "让一名休息中的己方成员立刻回场（活力值全满），本回合技能值 +2。",
      fx: [{ op: "wake" }, { op: "buff", skill: 2 }] }
  ];

  /* ---------------- millsage：幸福 · 回复 · 稳守 ---------------- */
  var MILLS = [
    { id: "mil_happy", name: "両手いっぱいの幸せ", band: "MILLS", cost: 3, art: "heart",
      target: "allyMember", text: "一名己方成员回复 3 点活力值。",
      fx: [{ op: "heal", amount: 3 }] },

    { id: "mil_hotaru", name: "蛍のメロディ", band: "MILLS", cost: 3, art: "keyboard",
      target: "none", text: "抽 2 张牌。",
      fx: [{ op: "draw", amount: 2 }] },

    { id: "mil_houka", name: "朋花のビート", band: "MILLS", cost: 4, art: "drums",
      target: "allyMember", text: "一名己方成员获得台风 2，并可以再行动一次。",
      fx: [{ op: "shield", amount: 2 }, { op: "rally" }] },

    { id: "mil_nagi", name: "凪のユニゾン", band: "MILLS", cost: 3, art: "spark",
      target: "allyMember", text: "一名己方成员本回合技能值 +2。",
      fx: [{ op: "buff", skill: 2 }] },

    { id: "mil_mahoro", name: "まほろのグルーヴ", band: "MILLS", cost: 3, art: "bass",
      target: "enemyMember", text: "使一名敌方成员禁演（无法移动，也无法对战）。",
      fx: [{ op: "pin" }] },

    { id: "mil_smile", name: "幸せのおすそわけ", band: "MILLS", cost: 1, art: "star",
      target: "none", text: "获得 3 颗星星。",
      fx: [{ op: "star", amount: 3 }] }
  ];

  /* ---------------- 一家Dumb Rock!：家族 · 热闹 · 齐奏 ---------------- */
  var IKKA = [
    { id: "ikka_homie", name: "Homie's Tie!!", band: "IKKA", cost: 4, art: "flame",
      target: "none", text: "对舞台上所有敌方成员造成 2 点伤害，并抽 1 张牌。",
      fx: [{ op: "dmgAll", scope: "enemyStage", amount: 2 }, { op: "draw", amount: 1 }] },

    { id: "ikka_family", name: "マイ・ファミリー", band: "IKKA", cost: 3, art: "heart",
      target: "allyMember", text: "一名己方成员回复 3 点活力值，且本回合技能值 +1。",
      fx: [{ op: "heal", amount: 3 }, { op: "buff", skill: 1 }] },

    { id: "ikka_raika", name: "蕾叶のシャウト", band: "IKKA", cost: 3, art: "mic",
      target: "allyMember", text: "一名己方成员本回合技能值 +3。",
      fx: [{ op: "buff", skill: 3 }] },

    { id: "ikka_chieri", name: "ちえりのドラムソロ", band: "IKKA", cost: 3, art: "drums",
      target: "enemyMember", text: "对一名敌方成员造成 3 点伤害。",
      fx: [{ op: "dmg", amount: 3 }] },

    { id: "ikka_yomogi", name: "蓬咲のサポート", band: "IKKA", cost: 3, art: "shield",
      target: "allyMember", text: "一名己方成员获得台风 3（受到的伤害 -3，持续到你的下个回合开始）。",
      fx: [{ op: "shield", amount: 3 }] },

    { id: "ikka_danran", name: "一家団欒", band: "IKKA", cost: 1, art: "star",
      target: "none", text: "获得 2 颗星星，并抽 1 张牌。",
      fx: [{ op: "star", amount: 2 }, { op: "draw", amount: 1 }] }
  ];

  /* ---------------- 共通卡 ---------------- */
  var NEUTRAL = [
    { id: "neu_soundcheck", name: "试音", band: "NEU", cost: 2, art: "note",
      target: "none", text: "抽 1 张牌。",
      fx: [{ op: "draw", amount: 1 }] },

    { id: "neu_spotlight", name: "聚光灯", band: "NEU", cost: 3, art: "spark",
      target: "allyMember", text: "一名己方成员本回合技能值 +2。",
      fx: [{ op: "buff", skill: 2 }] },

    { id: "neu_encore", name: "安可！", band: "NEU", cost: 3, art: "starflow",
      target: "allyMember", text: "一名己方成员本回合可以再行动一次。",
      fx: [{ op: "rally" }] },

    { id: "neu_merch", name: "物贩区", band: "NEU", cost: 1, art: "star",
      target: "none", text: "获得 2 颗星星。",
      fx: [{ op: "star", amount: 2 }] },

    { id: "neu_firework", name: "烟花特效", band: "NEU", cost: 4, art: "flame",
      target: "none", text: "对舞台上所有敌方成员造成 2 点伤害。",
      fx: [{ op: "dmgAll", scope: "enemyStage", amount: 2 }] },

    { id: "neu_bis", name: "再来一首！", band: "NEU", cost: 3, art: "heart",
      target: "allyMember", text: "一名己方成员回复 3 点活力值。",
      fx: [{ op: "heal", amount: 3 }] },

    { id: "neu_rest", name: "后台休息室", band: "NEU", cost: 4, art: "moon",
      target: "allyMember", text: "让一名休息中的己方成员立刻回场（活力值全满）。",
      fx: [{ op: "wake" }] },

    { id: "neu_mc", name: "MC 串场", band: "NEU", cost: 2, art: "mic",
      target: "enemyMember", text: "使一名敌方成员禁演（无法移动，也无法对战）。",
      fx: [{ op: "pin" }] },

    /* 强制清场：6★，每方牌库固定 2 张（copies 由 engine.js 的 buildDeck 处理） */
    { id: "neu_finale", name: "谢幕", band: "NEU", cost: 6, art: "curtain",
      target: "none", copies: 2,
      text: "强制让舞台上的所有成员（双方）下台，各自退回自己的阵营。",
      fx: [{ op: "clearStage" }] }
  ];

  BD.CARDS = [].concat(MYGO, AVE, MUGEN, MILLS, IKKA, NEUTRAL);

  BD.CARD_MAP = {};
  BD.CARDS.forEach(function (c) { BD.CARD_MAP[c.id] = c; });

  BD.card = function (id) { return BD.CARD_MAP[id]; };

  BD.cardsOfBand = function (band) {
    return BD.CARDS.filter(function (c) {
      return c.band === band || c.band === "NEU";
    });
  };

  /* 目标提示文案 */
  BD.TARGET_HINT = {
    none: "不需要选择目标",
    allyMember: "选一名己方成员",
    enemyMember: "选一名敌方成员",
    anyMember: "选一名成员"
  };

})(typeof window !== "undefined" ? window : global);
