/* ============================================================
 * md2card · 共享渲染器（Web 与 CLI 共用）
 * 依赖：marked.min.js, highlight.min.js, card.css
 * 用法：
 *   md2card.init({ libBase: 'lib/' });            // hljs 配色目录
 *   md2card.render(cardEl, markdown, options);    // 渲染整张卡片
 * ============================================================ */

window.md2card = (function () {
  "use strict";

  var THEMES = [
    { id: "serenity", name: "静谧 Serenity", dark: false },
    { id: "midnight", name: "深空夜航 Midnight", dark: true },
    { id: "sunset",   name: "落日 Sunset",    dark: false },
    { id: "sakura",   name: "樱粉 Sakura",    dark: false },
    { id: "matcha",   name: "抹茶 Matcha",    dark: false },
    { id: "inkpaper", name: "纸墨 InkPaper",  dark: false }
  ];

  var libBase = "lib/";
  var hljsLinkId = "mdc-hljs-theme";

  function init(opts) {
    if (opts && opts.libBase) libBase = opts.libBase;
  }

  function ensureHljsTheme(dark) {
    var href = libBase + (dark ? "hljs-github-dark.min.css" : "hljs-github.min.css");
    var link = document.getElementById(hljsLinkId);
    if (!link) {
      link = document.createElement("link");
      link.id = hljsLinkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /**
   * 渲染一张完整卡片。
   * options: { theme, width, showHeader, title, date,
   *            showFooter, watermark, showBrand }
   */
  function render(cardEl, markdown, options) {
    var opts = options || {};
    var themeId = opts.theme || "serenity";
    var theme = THEMES.find(function (t) { return t.id === themeId; }) || THEMES[0];

    cardEl.className = "mdc-card mdc-theme-" + theme.id;
    if (opts.width) cardEl.style.setProperty("--mdc-width", parseInt(opts.width, 10) + "px");
    ensureHljsTheme(theme.dark);

    var body = cardEl.querySelector(".mdc-body");
    body.innerHTML = marked.parse(markdown || "", { gfm: true, breaks: false });

    if (window.hljs) {
      body.querySelectorAll("pre code").forEach(function (el) {
        try { hljs.highlightElement(el); } catch (e) { /* 忽略高亮失败 */ }
      });
    }

    /* 头部：优先用自定义标题，否则提取正文首个 h1（并从正文移除，避免重复） */
    var header = cardEl.querySelector(".mdc-header");
    if (opts.showHeader) {
      var title = opts.title;
      if (!title) {
        var firstH1 = body.querySelector(":scope > h1");
        if (firstH1) {
          title = firstH1.textContent.trim();
          firstH1.remove();
        }
      }
      header.hidden = false;
      header.querySelector(".mdc-title").textContent = title || "";
      header.querySelector(".mdc-title").parentElement.hidden = !title;
      var dateEl = header.querySelector(".mdc-date");
      dateEl.textContent = opts.date || "";
      dateEl.hidden = !opts.date;
    } else {
      header.hidden = true;
    }

    /* 底部：水印 + 品牌 */
    var footer = cardEl.querySelector(".mdc-footer");
    if (opts.showFooter) {
      footer.hidden = false;
      footer.querySelector(".mdc-watermark").textContent = opts.watermark || "";
      footer.querySelector(".mdc-watermark").hidden = !opts.watermark;
      footer.querySelector(".mdc-brand").hidden = !opts.showBrand;
    } else {
      footer.hidden = true;
    }

    return { theme: theme };
  }

  /* 把正文里的远程图片预取为 dataURL，保证导出时不因跨域污染画布。
   * 返回 Promise；任何失败都静默跳过（Playwright 导出不受影响）。 */
  function inlineRemoteImages(scopeEl) {
    var imgs = Array.prototype.slice.call(scopeEl.querySelectorAll("img[src]"))
      .filter(function (img) { return /^https?:/i.test(img.src); });
    if (!imgs.length) return Promise.resolve();

    function toDataURL(img) {
      return fetch(img.src, { mode: "cors" })
        .then(function (r) { return r.ok ? r.blob() : null; })
        .then(function (blob) {
          return new Promise(function (resolve) {
            if (!blob) return resolve();
            var fr = new FileReader();
            fr.onload = function () { img.src = fr.result; resolve(); };
            fr.onerror = function () { resolve(); };
            fr.readAsDataURL(blob);
          });
        })
        .catch(function () { /* 静默 */ });
    }
    return Promise.all(imgs.map(toDataURL));
  }

  return { THEMES: THEMES, init: init, render: render, inlineRemoteImages: inlineRemoteImages };
})();
