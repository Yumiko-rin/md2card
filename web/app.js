/* ============================================================
 * md2card · Web 应用逻辑
 * ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "md2card:state:v1";

  var DEMO_MD = [
    "# 用 md2card 分享灵感",
    "",
    "把 Markdown 变成一张**精美的分享卡片**，",
    "一键导出高清 PNG，发朋友圈、发群、发社交媒体。",
    "",
    "## ✨ 核心特性",
    "",
    "- **6 套精调主题**，一键切换",
    "- 代码块语法高亮，技术分享不失真",
    "- 支持 GFM：表格、任务列表、删除线",
    "- 纯前端运行，数据不出本地",
    "",
    "## 💻 代码高亮",
    "",
    "```python",
    "def fibonacci(n: int) -> list[int]:",
    '    """生成斐波那契数列前 n 项"""',
    "    seq = [0, 1]",
    "    while len(seq) < n:",
    "        seq.append(seq[-1] + seq[-2])",
    "    return seq[:n]",
    "",
    'print("Hello, md2card!")',
    "```",
    "",
    "## 📋 任务清单",
    "",
    "- [x] 写下要分享的内容",
    "- [x] 挑一个喜欢的主题",
    "- [ ] 导出 PNG，点击右上角按钮",
    "",
    "## 🎨 主题一览",
    "",
    "| 主题 | 风格 |",
    "| :--- | :--- |",
    "| 静谧 Serenity | 明亮极简 |",
    "| 深空夜航 Midnight | 暗色科技 |",
    "| 纸墨 InkPaper | 黑白印刷 |",
    "",
    "> 写作即排版，分享即设计。",
    ">",
    "> —— md2card"
  ].join("\n");

  var THEME_DOT = {
    serenity: "linear-gradient(135deg,#4f6ef2,#38bdf8)",
    midnight: "linear-gradient(135deg,#39d2c0,#4f8ef7)",
    sunset:   "linear-gradient(135deg,#fb923c,#f43f5e)",
    sakura:   "linear-gradient(135deg,#f472b6,#c084fc)",
    matcha:   "linear-gradient(135deg,#86c99b,#4f9d5d)",
    inkpaper: "linear-gradient(135deg,#211f1a,#b9b5a5)"
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var editor = $("#editor");
  var card = $("#card");
  var toastBox = $("#toast-container");
  var statusInfo = $("#status-info");
  var renderTimer = null;

  var state = {
    theme: "midnight",
    width: 420,
    scale: 2,
    watermark: "@Yumiko-rin",
    showHeader: true,
    showFooter: true,
    markdown: DEMO_MD
  };

  md2card.init({ libBase: "lib/" });

  /* ---------- 状态持久化 ---------- */

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var k in state) if (k in saved) state[k] = saved[k];
      }
    } catch (e) { /* 损坏的存档直接忽略 */ }
  }

  /* ---------- 渲染 ---------- */

  function todayStr() {
    try {
      return new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  function render() {
    md2card.render(card, state.markdown, {
      theme: state.theme,
      width: state.width,
      showHeader: state.showHeader,
      date: todayStr(),
      showFooter: state.showFooter,
      watermark: state.watermark,
      showBrand: true
    });
    syncToolbar();
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      state.markdown = editor.value;
      saveState();
      render();
    }, 250);
  }

  /* ---------- 工具栏同步 ---------- */

  function buildThemeChips() {
    var box = $("#theme-chips");
    box.innerHTML = "";
    md2card.THEMES.forEach(function (t) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "theme-chip";
      chip.dataset.theme = t.id;
      chip.title = t.name;
      chip.innerHTML =
        '<span class="theme-dot" style="background:' + THEME_DOT[t.id] + '"></span>' + t.name.split(" ")[0];
      chip.addEventListener("click", function () {
        state.theme = t.id;
        saveState();
        render();
      });
      box.appendChild(chip);
    });
  }

  function syncToolbar() {
    document.querySelectorAll(".theme-chip").forEach(function (chip) {
      chip.classList.toggle("active", chip.dataset.theme === state.theme);
    });
    $("#opt-width").value = String(state.width);
    $("#opt-scale").value = String(state.scale);
    $("#opt-header").checked = state.showHeader;
    $("#opt-footer").checked = state.showFooter;
    $("#opt-watermark").value = state.watermark;
  }

  /* ---------- Toast ---------- */

  function toast(msg, type) {
    var el = document.createElement("div");
    el.className = "toast " + (type || "");
    el.textContent = msg;
    toastBox.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity .25s";
      setTimeout(function () { el.remove(); }, 260);
    }, 2200);
  }

  function setStatus(text) { statusInfo.textContent = text; }

  /* ---------- 导出 ---------- */

  function exportFilename(ext) {
    var titleEl = card.querySelector(".mdc-header .mdc-title");
    var title = (!card.querySelector(".mdc-header").hidden && titleEl && titleEl.textContent) || "md2card";
    var safe = title.replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "") || "md2card";
    return safe + "-" + state.theme + "." + ext;
  }

  async function renderCardPng() {
    setStatus("正在渲染图片…");
    await md2card.inlineRemoteImages(card);
    var dataUrl = await htmlToImage.toPng(card, {
      pixelRatio: state.scale,
      cacheBust: true,
      skipFonts: true  /* 仅用系统字体，跳过字体内联可避免 file:// 下的跨域报错 */
    });
    setStatus("渲染完成");
    return dataUrl;
  }

  async function downloadPng() {
    var btn = $("#btn-download");
    btn.disabled = true;
    try {
      var dataUrl = await renderCardPng();
      var a = document.createElement("a");
      a.href = dataUrl;
      a.download = exportFilename("png");
      a.click();
      toast("已导出 " + a.download, "success");
    } catch (err) {
      console.error(err);
      toast("导出失败：" + (err && err.message || err), "error");
    } finally {
      btn.disabled = false;
    }
  }

  async function copyPng() {
    var btn = $("#btn-copy");
    btn.disabled = true;
    try {
      var dataUrl = await renderCardPng();
      var blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast("已复制到剪贴板", "success");
    } catch (err) {
      console.error(err);
      toast("复制失败，请使用「下载 PNG」（部分浏览器限制剪贴板权限）", "error");
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- 事件绑定 ---------- */

  function bindEvents() {
    editor.addEventListener("input", scheduleRender);

    $("#opt-width").addEventListener("change", function (e) {
      state.width = parseInt(e.target.value, 10);
      saveState(); render();
    });
    $("#opt-scale").addEventListener("change", function (e) {
      state.scale = parseInt(e.target.value, 10);
      saveState();
    });
    $("#opt-header").addEventListener("change", function (e) {
      state.showHeader = e.target.checked;
      saveState(); render();
    });
    $("#opt-footer").addEventListener("change", function (e) {
      state.showFooter = e.target.checked;
      saveState(); render();
    });
    $("#opt-watermark").addEventListener("input", function (e) {
      state.watermark = e.target.value;
      saveState(); render();
    });

    $("#btn-download").addEventListener("click", downloadPng);
    $("#btn-copy").addEventListener("click", copyPng);

    $("#btn-demo").addEventListener("click", function () {
      editor.value = DEMO_MD;
      state.markdown = DEMO_MD;
      saveState(); render();
      toast("已载入示例文档", "success");
    });
    $("#btn-clear").addEventListener("click", function () {
      editor.value = "";
      state.markdown = "";
      saveState(); render();
      editor.focus();
    });

    /* Ctrl/Cmd + S 快捷导出 */
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        downloadPng();
      }
    });
  }

  /* ---------- 启动 ---------- */

  loadState();
  editor.value = state.markdown;
  buildThemeChips();
  bindEvents();
  render();
  setStatus("就绪 · 卡片高度随内容自适应");
})();
