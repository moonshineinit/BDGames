/* ============================================================
 *  config.js —— 规则常量 / 五个乐队 / 定位 / 区域
 *
 *  ★ 想调平衡只改这个文件，其它地方都不用动。
 * ========================================================== */
(function (root) {
  var BD = root.BD = root.BD || {};

  /* ---------------- 规则常量 ---------------- */
  BD.RULES = {
    /* 胜负：谁的闪耀值先到这个数就赢（后续想改就改这里） */
    SPARK_GOAL: 50,

    /* 星星：第 1 回合上限 = STAR_START，之后每回合 +STAR_STEP，
       涨到 STAR_MAX 就停止增长（这里不是写死的，系统不强制任何上限） */
    STAR_START: 1,
    STAR_STEP: 1,
    STAR_MAX: 8,
    STAR_REFILL: true,          // 每回合开始补满到当前上限

    /* 舞台位置数（舞台不画固定方框，成员上台后自适应排列） */
    STAGE_SLOTS: 5,

    /* 消耗：卡牌看卡面 cost；上/下台 = 该成员的 cost（见 bands.js，队长 3、其余 2，
       COST_MOVE 只是成员没写 cost 时的兜底） */
    COST_MOVE: 2,

    /* 对战消耗按「攻击者站在哪儿」算：
         舞台 → 舞台 / 舞台 → 对方阵营   = 2★
         自己阵营 → 舞台上的敌人          = 3★（从台下出手更费劲） */
    COST_ATTACK_STAGE: 2,
    COST_ATTACK_CAMP: 3,

    /* 队长登台额外获得的闪耀值 */
    LEADER_SPARK: 1,

    /* 每回合每个成员能做的事 */
    ATTACKS_PER_TURN: 1,
    MOVES_PER_TURN: 1,

    /* 活力值归零后：退回自己阵营休息几回合，回来时活力值全满 */
    REST_TURNS: 3,

    /* 回合结束的闪耀结算：
       台上每有 1 人 +1；人数达到 3 / 4 / 5 再额外 +1 / +2 / +3
       下标 = 台上人数 */
    SPARK_TIER: [0, 0, 0, 1, 2, 3],

    /* 牌库 */
    DECK_SIZE: 34,
    START_HAND: 4,
    HAND_MAX: 8,
    DRAW_PER_TURN: 1,
    MAX_COPIES: 3
  };

  /* ---------------- 五个乐队（BanG Dream! Our Notes） ---------------- */
  BD.BANDS = {
    MYGO:  { key: "MYGO",  name: "MyGO!!!!!",          cn: "MyGO!!!!!",          tag: "迷子でもいい、前へ進め", color: "#2ec4b0", soft: "#a5ece0" },
    AVE:   { key: "AVE",   name: "Ave Mujica",         cn: "Ave Mujica",         tag: "ようこそ、マスカレードへ", color: "#c9205a", soft: "#ffbed6" },
    MUGEN: { key: "MUGEN", name: "夢限大みゅーたいぷ", cn: "夢限大みゅーたいぷ", tag: "夢は、限りなく大きく", color: "#ff5fa8", soft: "#ffc6e4" },
    MILLS: { key: "MILLS", name: "millsage",           cn: "millsage",           tag: "両手いっぱいの幸せを", color: "#4f8cff", soft: "#bed6ff" },
    IKKA:  { key: "IKKA",  name: "一家Dumb Rock!",     cn: "一家Dumb Rock!",     tag: "始めようか、マイ・ファミリー", color: "#ff8a3d", soft: "#ffd2ad" },
    NEU:   { key: "NEU",   name: "共通",               cn: "共通",               tag: "所有乐队通用", color: "#7c86a2", soft: "#d3d8e4" }
  };
  BD.BAND_ORDER = ["MYGO", "AVE", "MUGEN", "MILLS", "IKKA"];

  /* ---------------- 难度（只影响电脑对手） ----------------
   *  budget       每回合最多走几步
   *  stageGoal    想把几个人推上台
   *  campChase    会不会追击躲在阵营里的敌人
   *  aiStarBonus  电脑每回合的星星上限额外 +几（玩家的规则完全不变）
   *  aiDrawBonus  电脑每回合额外多抽几张
   *  focusLeader  会不会优先集火对方的队长
   *  ---------------------------------------------- */
  BD.DIFFICULTY = {
    easy:   { key: "easy",   cn: "简单", tag: "对手慢慢来",
              desc: "每回合最多 2 步，积极上台，只打舞台上的敌人。",
              budget: 2, stageGoal: 3, campChase: false,
              aiStarBonus: 0, aiDrawBonus: 0, focusLeader: false },
    normal: { key: "normal", cn: "普通", tag: "势均力敌",
              desc: "每回合最多 4 步，积极上台、也会追击阵营里的人。",
              budget: 4, stageGoal: 4, campChase: true,
              aiStarBonus: 0, aiDrawBonus: 0, focusLeader: false },
    hard:   { key: "hard",   cn: "困难", tag: "全场压过来",
              desc: "每回合最多 8 步，五个人全推上台；每回合还多 1★、多抽 1 张，优先集火你的队长。",
              budget: 8, stageGoal: 5, campChase: true,
              aiStarBonus: 1, aiDrawBonus: 1, focusLeader: true }
  };
  BD.DIFF_ORDER = ["easy", "normal", "hard"];

  /* ---------------- 定位（决定剪影姿态，不决定射程） ---------------- */
  BD.ROLES = {
    vo:  { key: "vo",  cn: "主唱", short: "Vo"  },
    gt:  { key: "gt",  cn: "吉他", short: "Gt"  },
    ba:  { key: "ba",  cn: "贝斯", short: "Ba"  },
    dr:  { key: "dr",  cn: "鼓",   short: "Dr"  },
    key: { key: "key", cn: "键盘", short: "Key" },
    dj:  { key: "dj",  cn: "DJ",   short: "DJ"  }
  };

  /* ---------------- 区域 ----------------
   *  camp  自己阵营（距离舞台 1）
   *  stage 舞台（双方共用，最多 STAGE_SLOTS 人）
   *  rest  休息中（活力值归零，倒计时结束回场）
   *  ------------------------------------ */
  BD.ZONES = {
    camp:  { key: "camp",  cn: "阵营", dist: 0 },
    stage: { key: "stage", cn: "舞台", dist: 1 },
    rest:  { key: "rest",  cn: "休息", dist: 0 }
  };

  /* 攻击距离：自己阵营 ↔ 舞台 = 1， 舞台 ↔ 对方阵营 = 1
     角色攻击距离 = 2，所以
       在阵营里  → 只能打舞台上的敌人
       在舞台上  → 能打舞台上的敌人 + 对方阵营里的敌人
     己方成员永远不能移动到对方阵营。 */
  BD.ATTACK_RANGE = 2;

  /* ---------------- 关键字词典 ---------------- */
  BD.KEYWORDS = {
    blitz:     { cn: "即演", desc: "本回合可以再行动一次。" },
    encore:    { cn: "安可", desc: "每回合可以发动两次对战。" },
    poise:     { cn: "台风", desc: "受到的伤害减少（数值见状态）。" },
    suppress:  { cn: "怯场", desc: "下一个回合完全无法行动：不能移动、不能对战，也不计入闪耀结算；到该回合结束自动解除。" },
    pin:       { cn: "禁演", desc: "无法移动（登台／下场），也无法对战。" },
    veil:      { cn: "回避", desc: "无法被作为对战目标，持续到施放者的下个回合开始。" },
    bond:      { cn: "羁绊", desc: "在场时己方全员技能值 +1。" }
  };

})(typeof window !== "undefined" ? window : global);
