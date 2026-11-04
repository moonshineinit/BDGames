/* ============================================================
 *  art.js —— 剪影美术生成器
 *  全部是内联 SVG：成员剪影（发型 + 乐器）与卡牌符号剪影。
 *  单色填充 + 乐队色背光，营造 Livehouse 逆光剪影的味道。
 * ========================================================== */
(function (root) {
  var BD = root.BD = root.BD || {};

  /* ---------------- 发型（画在身体后面，形成轮廓） ---------------- */
  var HAIR = {
    short: function () {
      return '<ellipse cx="50" cy="26" rx="15.5" ry="15"/>';
    },
    bob: function () {
      return '<path d="M33 28 C33 45 35 56 39 62 C45 66 55 66 61 62 C65 56 67 45 67 28 C60 19 40 19 33 28 Z"/>';
    },
    long: function () {
      return '<path d="M32 28 C30 48 32 66 36 79 C42 83 58 83 64 79 C68 66 70 48 68 28 C60 18 40 18 32 28 Z"/>';
    },
    ponytail: function () {
      return '<ellipse cx="50" cy="26" rx="15.5" ry="15"/>' +
             '<path d="M62 22 C74 31 78 51 74 71 C69 67 67 50 63 40 Z"/>';
    },
    twin: function () {
      return '<ellipse cx="50" cy="26" rx="15" ry="14.5"/>' +
             '<path d="M36 28 C27 37 25 55 29 71 C33 65 34 50 38 40 Z"/>' +
             '<path d="M64 28 C73 37 75 55 71 71 C67 65 66 50 62 40 Z"/>';
    },
    curly: function () {
      return '<ellipse cx="50" cy="27" rx="15.5" ry="14"/>' +
             '<circle cx="35" cy="16" r="8"/><circle cx="50" cy="11" r="9"/><circle cx="65" cy="16" r="8"/>';
    },
    spiky: function () {
      return '<ellipse cx="50" cy="27" rx="15" ry="14"/>' +
             '<path d="M36 18 L40 4 L45 17 Z"/><path d="M46 16 L51 2 L56 16 Z"/><path d="M57 18 L62 6 L66 19 Z"/>';
    }
  };

  /* ---------------- 乐器（画在身体前面） ---------------- */
  var INST = {
    mic: function () {
      return '<rect x="73" y="58" width="3.5" height="64" rx="1.7"/>' +
             '<rect x="56" y="52" width="21" height="3.6" rx="1.8" transform="rotate(-22 56 52)"/>' +
             '<ellipse cx="55" cy="50" rx="5" ry="7" transform="rotate(-35 55 50)"/>';
    },
    guitar: function () {
      return '<ellipse cx="40" cy="80" rx="17" ry="13.5" transform="rotate(-20 40 80)"/>' +
             '<rect x="49" y="50" width="6.5" height="34" rx="2" transform="rotate(-20 52 67)"/>' +
             '<rect x="52" y="44" width="8" height="7" rx="2" transform="rotate(-20 56 47)"/>';
    },
    bass: function () {
      return '<ellipse cx="40" cy="80" rx="18" ry="14" transform="rotate(-20 40 80)"/>' +
             '<rect x="50" y="46" width="6" height="38" rx="2" transform="rotate(-20 53 65)"/>' +
             '<rect x="53" y="39" width="8" height="8" rx="2" transform="rotate(-20 57 43)"/>';
    },
    drums: function () {
      return '<circle cx="50" cy="108" r="18"/>' +
             '<ellipse cx="27" cy="92" rx="12" ry="5.5"/>' +
             '<rect x="33" y="96" width="2.5" height="20"/>' +
             '<ellipse cx="74" cy="80" rx="14" ry="3.6"/>' +
             '<rect x="73.5" y="82" width="2.5" height="28"/>' +
             '<rect x="60" y="58" width="3" height="32" rx="1.5" transform="rotate(28 61 74)"/>' +
             '<rect x="36" y="58" width="3" height="32" rx="1.5" transform="rotate(-28 37 74)"/>';
    },
    keyboard: function () {
      return '<rect x="24" y="84" width="52" height="10" rx="2.5"/>' +
             '<rect x="28" y="94" width="3.5" height="26" rx="1.5"/>' +
             '<rect x="68" y="94" width="3.5" height="26" rx="1.5"/>' +
             '<rect x="34" y="70" width="32" height="3.4" rx="1.6"/>' +
             '<rect x="46" y="73" width="3" height="11"/>';
    },
    dj: function () {
      return '<rect x="24" y="84" width="52" height="12" rx="2.5"/>' +
             '<circle cx="34" cy="76" r="7"/><circle cx="66" cy="76" r="7"/>' +
             '<path d="M34 28 C34 13 66 13 66 28" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>';
    }
  };

  /* ---------------- 身体 ---------------- */
  function body() {
    return '<rect x="45" y="40" width="10" height="10"/>' +
           '<path d="M38 47 C43 41 57 41 62 47 L66 86 L34 86 Z"/>' +
           '<rect x="34" y="82" width="32" height="12" rx="6"/>' +
           '<rect x="37" y="90" width="10" height="42" rx="5"/>' +
           '<rect x="53" y="90" width="10" height="42" rx="5"/>' +
           '<rect x="33" y="128" width="15" height="6" rx="3"/>' +
           '<rect x="52" y="128" width="15" height="6" rx="3"/>' +
           '<path d="M38 50 C29 58 27 70 30 84 L38 82 C36 68 38 58 43 53 Z"/>' +
           '<path d="M62 50 C71 58 73 70 70 84 L62 82 C64 68 62 58 57 53 Z"/>';
  }

  /* ---------------- 成员剪影 ---------------- */
  BD.Art = {};

  BD.Art.member = function (m, opt) {
    opt = opt || {};
    var hair = HAIR[m.hair] ? m.hair : "short";
    var inst = INST[m.inst] ? m.inst : "mic";
    var cls = "sil " + (opt.cls || "");
    return '<svg class="' + cls + '" viewBox="0 0 100 138" aria-hidden="true">' +
             '<g fill="currentColor">' +
               HAIR[hair]() +
               body() +
               '<circle cx="50" cy="30" r="13"/>' +
             '</g>' +
             '<g fill="currentColor" stroke="currentColor">' + INST[inst]() + '</g>' +
           '</svg>';
  };

  /* ---------------- 人物立绘（图片） ----------------
   *  图片放在 assets/members/<成员 id>.webp（透明底，已裁白边 + 缩到 560px 高，
   *  原图 1800px 太大，直接塞进卡片会吃掉几百 MB 内存）。
   *  取不到图片就自动回退成剪影，所以缺图也不会开天窗。 */
  BD.Art.PHOTO_DIR = "assets/members/";
  BD.Art._missing = {};

  BD.Art.photoSrc = function (m) {
    return BD.Art.PHOTO_DIR + encodeURIComponent(m.id) + ".webp";
  };
  BD.Art.hasPhoto = function (m) { return !!m && !BD.Art._missing[m.id]; };
  BD.Art.markMissing = function (id) { if (id) BD.Art._missing[id] = true; };

  BD.Art.photo = function (m, opt) {
    opt = opt || {};
    return '<img class="mimg ' + (opt.cls || "") + '" src="' + BD.Art.photoSrc(m) + '"' +
           ' alt="" aria-hidden="true" draggable="false" decoding="async" data-mid="' + esc(m.id) + '">';
  };

  /* 统一入口：有图出图，没图出剪影 */
  BD.Art.figure = function (m, opt) {
    if (!m) return "";
    return BD.Art.hasPhoto(m) ? BD.Art.photo(m, opt) : BD.Art.member(m, opt);
  };

  /* 图片挂了 → 换成剪影（innerHTML 重建时大量 <img> 触发 error，用捕获阶段统一兜底） */
  BD.Art.fallbackImg = function (img) {
    var id = img.getAttribute("data-mid");
    if (!id) return;
    BD.Art.markMissing(id);
    var m = BD.member ? BD.member(id) : null;
    var holder = document.createElement("div");
    holder.innerHTML = m ? BD.Art.member(m) : "";
    var svg = holder.firstChild;
    if (svg && img.parentNode) img.parentNode.replaceChild(svg, img);
    else if (img.parentNode) img.parentNode.removeChild(img);
  };

  /* 开局前先把 25 张图拉进缓存，避免渲染时反复解码 */
  BD.Art.preload = function (ids, done) {
    var list = ids || (BD.MEMBERS || []).map(function (m) { return m.id; });
    var left = list.length;
    if (!left) { if (done) done(); return; }
    list.forEach(function (id) {
      var im = new Image();
      var fin = function () { if (--left <= 0 && done) done(); };
      im.onload = fin;
      im.onerror = function () { BD.Art.markMissing(id); fin(); };
      im.src = BD.Art.PHOTO_DIR + encodeURIComponent(id) + ".webp";
    });
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------------- 符号剪影（卡牌画面） ---------------- */
  var SYM = {
    star: '<path d="M50 6 L61.6 37.6 L95 38.2 L68.5 58.4 L78.6 91.6 L50 71.6 L21.4 91.6 L31.5 58.4 L5 38.2 L38.4 37.6 Z"/>',
    spark: '<path d="M50 4 C54 34 66 46 96 50 C66 54 54 66 50 96 C46 66 34 54 4 50 C34 46 46 34 50 4 Z"/>' +
           '<path d="M84 12 C86 20 90 22 98 24 C90 26 86 30 84 38 C82 30 78 26 70 24 C78 22 82 20 84 12 Z"/>',
    flame: '<path d="M50 4 C57 26 78 30 78 54 C78 76 65 90 50 96 C35 90 22 76 22 54 C22 36 38 32 43 20 C45 27 48 16 50 4 Z"/>' +
           '<path d="M50 40 C55 56 62 60 62 72 C62 84 56 90 50 94 C44 90 38 84 38 72 C38 60 45 56 50 40 Z" opacity=".45"/>',
    heart: '<path d="M50 90 C18 66 12 44 25 31 C35 21 47 27 50 38 C53 27 65 21 75 31 C88 44 82 66 50 90 Z"/>',
    note: '<rect x="34" y="16" width="6" height="58"/>' +
          '<ellipse cx="27" cy="74" rx="12" ry="9" transform="rotate(-22 27 74)"/>' +
          '<rect x="66" y="8" width="5" height="48"/>' +
          '<ellipse cx="60" cy="56" rx="10" ry="7.5" transform="rotate(-22 60 56)"/>' +
          '<path d="M34 18 L40 16 L40 74 L34 74 Z" opacity=".35"/>',
    moon: '<path d="M64 8 A44 44 0 1 0 64 92 A36 36 0 1 1 64 8 Z"/>' +
          '<circle cx="76" cy="26" r="4" opacity=".6"/><circle cx="82" cy="48" r="3" opacity=".45"/>',
    bolt: '<path d="M58 4 L22 56 L46 56 L38 96 L78 40 L52 40 Z"/>',
    wings: '<path d="M6 62 C22 38 38 32 50 46 C62 32 78 38 94 62 C76 54 63 56 50 68 C37 56 24 54 6 62 Z"/>' +
           '<path d="M50 46 C46 58 46 70 50 80 C54 70 54 58 50 46 Z" opacity=".5"/>',
    crown: '<path d="M10 78 L20 26 L37 50 L50 18 L63 50 L80 26 L90 78 Z"/>' +
           '<rect x="10" y="78" width="80" height="10" rx="4"/>',
    shield: '<path d="M50 6 L86 22 V54 C86 78 67 90 50 95 C33 90 14 78 14 54 V22 Z"/>',
    curtain: '<path d="M6 8 H94 L86 94 H14 Z"/>' +
             '<path d="M30 8 L34 94 M50 8 L50 94 M70 8 L66 94" fill="none" stroke="currentColor" stroke-width="4" opacity=".5"/>',
    glowstick: '<rect x="26" y="22" width="9" height="54" rx="4.5" transform="rotate(20 30 49)"/>' +
               '<rect x="65" y="22" width="9" height="54" rx="4.5" transform="rotate(-20 70 49)"/>' +
               '<circle cx="24" cy="18" r="7"/><circle cx="76" cy="18" r="7"/>',
    mic: '<rect x="46" y="42" width="7" height="50" rx="3.5"/>' +
         '<ellipse cx="49" cy="28" rx="13" ry="16"/>' +
         '<path d="M36 34 C36 66 62 66 62 34" fill="none" stroke="currentColor" stroke-width="5"/>',
    guitar: '<ellipse cx="40" cy="74" rx="22" ry="17" transform="rotate(-20 40 74)"/>' +
            '<rect x="52" y="18" width="8" height="46" rx="3" transform="rotate(-20 56 41)"/>' +
            '<rect x="55" y="8" width="12" height="11" rx="3" transform="rotate(-20 61 13)"/>',
    bass: '<ellipse cx="40" cy="76" rx="23" ry="18" transform="rotate(-20 40 76)"/>' +
          '<rect x="53" y="12" width="7" height="52" rx="3" transform="rotate(-20 56 38)"/>',
    drums: '<circle cx="50" cy="66" r="24"/>' +
           '<ellipse cx="18" cy="42" rx="15" ry="6"/>' +
           '<ellipse cx="82" cy="38" rx="17" ry="5"/>' +
           '<rect x="46" y="88" width="3" height="12"/><rect x="66" y="42" width="3" height="30"/>',
    keyboard: '<rect x="8" y="52" width="84" height="22" rx="4"/>' +
              '<rect x="14" y="74" width="5" height="20"/><rect x="81" y="74" width="5" height="20"/>' +
              '<rect x="8" y="52" width="84" height="6" opacity=".45"/>',
    dj: '<rect x="10" y="56" width="80" height="20" rx="4"/>' +
        '<circle cx="28" cy="42" r="11"/><circle cx="72" cy="42" r="11"/>' +
        '<path d="M28 24 C28 8 72 8 72 24" fill="none" stroke="currentColor" stroke-width="6"/>',
    clock: '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="8"/>' +
           '<rect x="46" y="22" width="8" height="30" rx="4"/><rect x="48" y="48" width="22" height="8" rx="4"/>',
    starflow: '<path d="M50 8 L60 40 L92 44 L64 62 L74 94 L50 74 L26 94 L36 62 L8 44 L40 40 Z"/>' +
              '<circle cx="16" cy="16" r="5"/><circle cx="86" cy="20" r="4"/><circle cx="82" cy="86" r="5"/>'
  };

  BD.Art.symbol = function (kind, opt) {
    opt = opt || {};
    var k = SYM[kind] ? kind : "star";
    return '<svg class="sil ' + (opt.cls || "") + '" viewBox="0 0 100 100" aria-hidden="true">' +
             '<g fill="currentColor" stroke="currentColor" stroke-width="0">' + SYM[k] + '</g>' +
           '</svg>';
  };

  /* ---------------- 卡背 ---------------- */
  BD.Art.back = function () {
    return '<svg class="sil" viewBox="0 0 100 100" aria-hidden="true">' +
             '<g fill="currentColor">' +
               '<path d="M50 14 L60 40 L88 42 L65 60 L74 88 L50 70 L26 88 L35 60 L12 42 L40 40 Z"/>' +
             '</g></svg>';
  };

  /* ---------------- 乐队海报 ----------------
   * 五个人从暗处站到光里：后排小、前排大，中间那位（主唱）最高。
   * 用纯 DOM + CSS 排版，人像优先用 assets/members 里的立绘。 */
  BD.Art.poster = function (bandKey) {
    var b = BD.BANDS[bandKey] || BD.BANDS.NEU;
    var mem = BD.membersOfBand(bandKey);
    // 队长（主唱）站中间最前，其余四人在两翼依次排开
    var ldr = 0;
    mem.forEach(function (m, i) { if (m.leader) ldr = i; });
    var others = mem.map(function (m, i) { return i; }).filter(function (i) { return i !== ldr; });
    var order = [others[0], others[1], ldr, others[2], others[3]];
    var figs = "";
    order.forEach(function (idx, slot) {
      var m = mem[idx];
      if (!m) return;
      figs += '<span class="pf pf' + slot + '">' + BD.Art.figure(m) + "</span>";
    });
    return '<div class="poster" style="--band:' + b.color + ";--bandsoft:" + b.soft + '">' +
             '<span class="pglow"></span>' +
             '<span class="pbeam pb1"></span><span class="pbeam pb2"></span><span class="pbeam pb3"></span>' +
             '<span class="pfigs">' + figs + "</span>" +
             '<span class="pcap">' +
               '<b class="pname">' + b.name + "</b>" +
               '<i class="ptag">' + b.tag + "</i>" +
               '<em class="pmem">' + mem.map(function (m) { return m.name; }).join(" · ") + "</em>" +
             "</span>" +
           "</div>";
  };

  BD.Art.SYMBOLS = Object.keys(SYM);

})(typeof window !== "undefined" ? window : global);
