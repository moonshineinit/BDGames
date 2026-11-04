/* ============================================================
 *  bands.js —— BanG Dream! Our Notes 五乐队 × 五名成员 = 25 人
 *
 *  当前数值（按你的设定）：
 *    队长（每队 Vo，leader: true） → 费 3 / 技能值 3
 *    其余成员                      → 费 2 / 技能值 2
 *    全员活力值                    → 5
 *    队长登台                      → 额外 +1 闪耀值
 *
 *  ★ 想改数值直接改下面这张表，引擎、UI、AI 全部自动读取，不用改别的地方。
 *
 *  字段：
 *    id     唯一标识
 *    name   成员名（日文汉字照官方写法）
 *    en     罗马字名
 *    mask   Ave Mujica 的假面名（其它乐队没有）
 *    band   乐队  MYGO / AVE / MUGEN / MILLS / IKKA
 *    role   定位 vo 主唱 / gt 吉他 / ba 贝斯 / dr 鼓 / key 键盘 / dj DJ
 *    inst   剪影手持的乐器（决定剪影造型）
 *    hair   剪影发型（决定剪影轮廓）
 *    leader 是否为队长（队长登台额外 +1 闪耀值）
 *    cost   行动费（登台 / 下场要花的星星）
 *    skill  技能值（攻击力）
 *    vita   活力值（生命值，归零就退场休息）
 *    line   一句台词（只在详情面板里显示，纯装饰）
 * ========================================================== */
(function (root) {
  var BD = root.BD = root.BD || {};

  BD.MEMBERS = [

    /* ---------------- MyGO!!!!! ---------------- */
    { id: "mygo_tomori", leader: true, name: "高松 燈",   en: "Tomori Takamatsu", band: "MYGO", role: "vo", cost: 3,  inst: "mic",      hair: "short",    skill: 3, vita: 5, line: "……我想，把这份心情唱出来。" },
    { id: "mygo_anon",   name: "千早 愛音", en: "Anon Chihaya",     band: "MYGO", role: "gt", cost: 2,  inst: "guitar",   hair: "ponytail", skill: 2, vita: 5, line: "我已经，不会再逃了！" },
    { id: "mygo_rana",   name: "要 楽奈",   en: "Rana Kaname",      band: "MYGO", role: "gt", cost: 2,  inst: "guitar",   hair: "curly",    skill: 2, vita: 5, line: "楽奈，想弹的时候就弹。" },
    { id: "mygo_soyo",   name: "長崎 そよ", en: "Soyo Nagasaki",    band: "MYGO", role: "ba", cost: 2,  inst: "bass",     hair: "long",     skill: 2, vita: 5, line: "大家在一起的话，就不再是迷子了。" },
    { id: "mygo_taki",   name: "椎名 立希", en: "Taki Shiina",      band: "MYGO", role: "dr", cost: 2,  inst: "drums",    hair: "bob",      skill: 2, vita: 5, line: "节奏交给我，跟上就好。" },
    /* ---------------- Ave Mujica ---------------- */
    { id: "ave_uika", leader: true,    name: "三角 初華",     en: "Uika Misumi",     mask: "Doloris",    band: "AVE", role: "vo", cost: 3,  inst: "guitar",   hair: "ponytail", skill: 3, vita: 5, line: "这个瞬间，我愿称之为命运。" },
    { id: "ave_mutsumi", name: "若葉 睦",       en: "Mutsumi Wakaba",  mask: "Mortis",     band: "AVE", role: "gt", cost: 2,  inst: "guitar",   hair: "bob",      skill: 2, vita: 5, line: "……Mortis，也在看着。" },
    { id: "ave_umiri",   name: "八幡 海鈴",     en: "Umiri Yahata",    mask: "Timoris",    band: "AVE", role: "ba", cost: 2,  inst: "bass",     hair: "short",    skill: 2, vita: 5, line: "低音由我来支撑，放心演奏吧。" },
    { id: "ave_nyamu",   name: "祐天寺 にゃむ", en: "Nyamu Yutenji",   mask: "Amoris",     band: "AVE", role: "dr", cost: 2,  inst: "drums",    hair: "twin",     skill: 2, vita: 5, line: "nya～ にゃむ要上咯！" },
    { id: "ave_sakiko",  name: "豊川 祥子",     en: "Sakiko Togawa",   mask: "Oblivionis", band: "AVE", role: "key", cost: 2, inst: "keyboard", hair: "long",     skill: 2, vita: 5, line: "欢迎来到 Ave Mujica 的假面舞会。" },
    /* ---------------- 夢限大みゅーたいぷ ---------------- */
    { id: "mug_arale", leader: true,  name: "仲町 あられ", en: "Arale Nakamachi", band: "MUGEN", role: "vo", cost: 3,  inst: "mic",      hair: "twin",     skill: 3, vita: 5, line: "梦，要放到无限大！" },
    { id: "mug_nonoka", name: "宮永 ののか", en: "Nonoka Miyanaga", band: "MUGEN", role: "gt", cost: 2,  inst: "guitar",   hair: "ponytail", skill: 2, vita: 5, line: "今天也要全力全开！" },
    { id: "mug_ritsu",  name: "峰月 律",     en: "Ritsu Minetsuki", band: "MUGEN", role: "gt", cost: 2,  inst: "guitar",   hair: "short",    skill: 2, vita: 5, line: "音量，再大一点。" },
    { id: "mug_miyako", name: "藤 都子",     en: "Miyako Fuji",     band: "MUGEN", role: "key", cost: 2, inst: "keyboard", hair: "long",     skill: 2, vita: 5, line: "我来给这场梦伴奏。" },
    { id: "mug_yuno",   name: "千石 ユノ",   en: "Yuno Sengoku",    band: "MUGEN", role: "dj", cost: 2,  inst: "dj",       hair: "bob",      skill: 2, vita: 5, line: "回る回る～ 交给ユノ吧！" },
    /* ---------------- millsage ---------------- */
    { id: "mil_hotaru", leader: true, name: "汐見 蛍",     en: "Hotaru Shiomi",  band: "MILLS", role: "key", cost: 3, inst: "keyboard", hair: "long",     skill: 3, vita: 5, line: "把满满的幸福，交给你。" },
    { id: "mil_natsume", name: "伊沢 なつめ", en: "Natsume Izawa",  band: "MILLS", role: "gt", cost: 2,  inst: "guitar",   hair: "bob",      skill: 2, vita: 5, line: "なつめ，会好好弹的。" },
    { id: "mil_nagi",   name: "琴平 凪",     en: "Nagi Kotohira",  band: "MILLS", role: "gt", cost: 2,  inst: "guitar",   hair: "ponytail", skill: 2, vita: 5, line: "……嗯，交给我。" },
    { id: "mil_mahoro", name: "浜崎 まほろ", en: "Mahoro Hamasaki",band: "MILLS", role: "ba", cost: 2,  inst: "bass",     hair: "twin",     skill: 2, vita: 5, line: "まほろ的低音，响起来吧！" },
    { id: "mil_houka",  name: "和泉 朋花",   en: "Houka Izumi",    band: "MILLS", role: "dr", cost: 2,  inst: "drums",    hair: "short",    skill: 2, vita: 5, line: "朋花的鼓点，咚咚咚！" },
    /* ---------------- 一家Dumb Rock! ---------------- */
    { id: "ikka_raika", leader: true,   name: "須賀 蕾叶",   en: "Raika Suga",     band: "IKKA", role: "vo", cost: 3,  inst: "guitar",   hair: "ponytail", skill: 3, vita: 5, line: "一家は、いつでもここにいるよ。" },
    { id: "ikka_miku",    name: "馬橋 心玖",   en: "Miku Mahashi",   band: "IKKA", role: "gt", cost: 2,  inst: "guitar",   hair: "bob",      skill: 2, vita: 5, line: "心玖也要，一起唱！" },
    { id: "ikka_yomogi",  name: "矢倉 蓬咲",   en: "Yomogi Yakura",  band: "IKKA", role: "ba", cost: 2,  inst: "bass",     hair: "long",     skill: 2, vita: 5, line: "蓬咲，稳稳地撑住大家。" },
    { id: "ikka_chieri",  name: "梅里 ちえり", en: "Chieri Umezato", band: "IKKA", role: "dr", cost: 2,  inst: "drums",    hair: "twin",     skill: 2, vita: 5, line: "ちえり，敲得响响的！" },
    { id: "ikka_shizuku", name: "四宮 寧月",   en: "Shizuku Shinomiya", band: "IKKA", role: "key", cost: 2, inst: "keyboard", hair: "long",   skill: 2, vita: 5, line: "宁月，为大家添上音色。" }
  ];

  BD.MEMBER_MAP = {};
  BD.MEMBERS.forEach(function (m) { BD.MEMBER_MAP[m.id] = m; });

  BD.member = function (id) { return BD.MEMBER_MAP[id]; };

  BD.membersOfBand = function (band) {
    return BD.MEMBERS.filter(function (m) { return m.band === band; });
  };

})(typeof window !== "undefined" ? window : global);
