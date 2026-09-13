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

  var ZOOMS = [0.5, 0.75, 1, 1.25, 1.5];

  var TOAST_ICON = {
    success: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var editor = $("#editor");
  var card = $("#card");
  var toastBox = $("#toast-container");
  var statusInfo = $("#status-info");
  var lineBox = $("#line-numbers");
  var stageEmpty = $("#stage-empty");
  var renderTimer = null;

  var state = {
    theme: "midnight",
    width: 420,
    scale: 2,
    zoom: 1,
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
    stageEmpty.hidden = state.markdown.trim() !== "";
    applyZoom();
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

  /* 主题切换时给卡片一个轻量的换装动效 */
  function animateCardSwap() {
    card.classList.remove("swap");
    void card.offsetWidth;  /* 强制重排以重启动画 */
    card.classList.add("swap");
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
        if (state.theme === t.id) return;
        state.theme = t.id;
        saveState();
        render();
        animateCardSwap();
      });
      box.appendChild(chip);
    });
  }

  function syncToolbar() {
    document.querySelectorAll(".theme-chip").forEach(function (chip) {
      var active = chip.dataset.theme === state.theme;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    $("#opt-width").value = String(state.width);
    $("#opt-scale").value = String(state.scale);
    $("#opt-header").checked = state.showHeader;
    $("#opt-footer").checked = state.showFooter;
    $("#opt-watermark").value = state.watermark;
    $("#zoom-label").textContent = Math.round(state.zoom * 100) + "%";
  }

  /* ---------- 编辑器：行号 / 统计 / Tab 缩进 ---------- */

  function updateLineNumbers() {
    var count = editor.value.split("\n").length;
    if (lineBox.dataset.count !== String(count)) {
      var out = [];
      for (var i = 1; i <= count; i++) out.push(i);
      lineBox.textContent = out.join("\n");
      lineBox.dataset.count = String(count);
    }
    lineBox.scrollTop = editor.scrollTop;
  }

  function updateCounts() {
    $("#count-lines").textContent = editor.value.split("\n").length + " 行";
    $("#count-chars").textContent = editor.value.length + " 字";
  }

  function bindEditor() {
    editor.addEventListener("input", function () {
      updateLineNumbers();
      updateCounts();
      scheduleRender();
    });
    editor.addEventListener("scroll", function () {
      lineBox.scrollTop = editor.scrollTop;
    });

    /* Tab 插入两个空格而不是跳出输入框 */
    editor.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || e.shiftKey) return;
      e.preventDefault();
      editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end");
      editor.dispatchEvent(new Event("input"));
    });
  }

  /* ---------- 预览缩放 ---------- */

  function applyZoom() {
    card.style.zoom = state.zoom === 1 ? "" : String(state.zoom);
    $("#zoom-label").textContent = Math.round(state.zoom * 100) + "%";
  }

  function stepZoom(dir) {
    var idx = ZOOMS.indexOf(state.zoom);
    if (idx === -1) idx = ZOOMS.indexOf(1);
    idx = Math.min(ZOOMS.length - 1, Math.max(0, idx + dir));
    if (ZOOMS[idx] === state.zoom) return;
    state.zoom = ZOOMS[idx];
    saveState();
    applyZoom();
  }

  /* ---------- Toast ---------- */

  function toast(msg, type) {
    var el = document.createElement("div");
    el.className = "toast " + (type || "");
    var icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.innerHTML = TOAST_ICON[type] || TOAST_ICON.info;
    var text = document.createElement("span");
    text.textContent = msg;
    el.appendChild(icon);
    el.appendChild(text);
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
    var prevZoom = card.style.zoom;
    card.style.zoom = "";  /* 按 100% 尺寸导出，与缩放预览无关 */
    try {
      /* 线上(https)内联自托管字体保证导出与预览一致；
       * file:// 下浏览器禁止 fetch 字体，跳过内联回退系统字体 */
      return await htmlToImage.toPng(card, {
        pixelRatio: state.scale,
        cacheBust: true,
        skipFonts: location.protocol === "file:"
      });
    } finally {
      card.style.zoom = prevZoom;
      setStatus("渲染完成");
    }
  }

  /* 统一处理按钮加载态，避免重复样板 */
  async function withLoading(btn, fn) {
    var original = btn.innerHTML;
    btn.disabled = true;
    try {
      return await fn();
    } finally {
      btn.innerHTML = original;
      btn.disabled = false;
    }
  }

  async function downloadPng() {
    var btn = $("#btn-download");
    await withLoading(btn, async function () {
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
      }
    });
  }

  async function copyPng() {
    var btn = $("#btn-copy");
    await withLoading(btn, async function () {
      try {
        var dataUrl = await renderCardPng();
        var blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast("已复制到剪贴板", "success");
      } catch (err) {
        console.error(err);
        toast("复制失败，请使用「下载 PNG」（部分浏览器限制剪贴板权限）", "error");
      }
    });
  }

  /* ---------- 深浅主题切换 ---------- */

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function bindThemeToggle() {
    $("#btn-theme").addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      if (next === "light") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = "dark";
      try { localStorage.setItem("md2card:theme", next); } catch (e) { /* 忽略 */ }
    });
  }

  /* ---------- 事件绑定 ---------- */

  function bindEvents() {
    bindEditor();

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
    $("#zoom-in").addEventListener("click", function () { stepZoom(1); });
    $("#zoom-out").addEventListener("click", function () { stepZoom(-1); });
    $("#zoom-label").addEventListener("click", function () {
      if (state.zoom === 1) return;
      state.zoom = 1;
      saveState(); applyZoom();
    });

    $("#btn-demo").addEventListener("click", function () {
      editor.value = DEMO_MD;
      state.markdown = DEMO_MD;
      saveState(); render();
      updateLineNumbers();
      updateCounts();
      toast("已载入示例文档", "success");
    });
    $("#btn-clear").addEventListener("click", function () {
      editor.value = "";
      state.markdown = "";
      saveState(); render();
      updateLineNumbers();
      updateCounts();
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
  bindThemeToggle();
  render();
  updateLineNumbers();
  updateCounts();
  setStatus("就绪 · 卡片高度随内容自适应");
  requestAnimationFrame(animateCardSwap);  /* 首屏入场 */
})();
