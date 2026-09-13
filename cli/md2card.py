#!/usr/bin/env python3
"""
md2card CLI · 将 Markdown 渲染为精美分享卡片 PNG

与 Web 版共用同一套主题与渲染模板，输出完全一致。

用法:
    python cli/md2card.py README.md
    python cli/md2card.py examples/demo.md -o card.png --theme midnight --scale 3
    python cli/md2card.py notes/            # 批量转换目录下所有 .md
    python cli/md2card.py --list-themes

首次使用:
    pip install playwright
    playwright install chromium
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date
from pathlib import Path

# 项目根目录（cli/ 的上一级）
ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = ROOT / "templates" / "card.html"

THEMES = [
    "serenity",   # 静谧 Serenity（明亮极简）
    "midnight",   # 深空夜航 Midnight（暗色科技）
    "sunset",     # 落日 Sunset（暖色渐变）
    "sakura",     # 樱粉 Sakura（柔粉浪漫）
    "matcha",     # 抹茶 Matcha（清新草木）
    "inkpaper",   # 纸墨 InkPaper（黑白印刷）
]

THEME_ALIASES = {t[0]: t for t in THEMES}  # 支持首字母缩写


def resolve_theme(name: str) -> str:
    name = name.strip().lower()
    if name in THEMES:
        return name
    if name in THEME_ALIASES:
        return THEME_ALIASES[name]
    valid = ", ".join(THEMES)
    raise SystemExit(f"[md2card] 未知主题: {name!r}（可选: {valid}）")


def build_init_script(config: dict) -> str:
    """把配置包装成初始化脚本，在页面所有脚本执行前注入 window.MD2CARD_CONFIG。"""
    payload = json.dumps(config, ensure_ascii=False)
    # 防止 markdown 内容中出现 </script> 提前闭合标签（\/ 是合法 JSON 转义）
    payload = payload.replace("</", "<\\/")
    return f"window.MD2CARD_CONFIG = {payload};"


async def render_png(md_text: str, args: argparse.Namespace, out_path: Path) -> None:
    from playwright.async_api import async_playwright

    config = {
        "markdown": md_text,
        "theme": resolve_theme(args.theme),
        "width": args.width,
        "showHeader": not args.no_header,
        "title": args.title,
        "date": args.date or f"{date.today().year} 年 {date.today().month} 月 {date.today().day} 日",
        "showFooter": not args.no_footer,
        "watermark": args.watermark,
        "showBrand": not args.no_brand,
    }

    init_js = build_init_script(config)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(
            viewport={"width": args.width + 120, "height": 900},
            device_scale_factor=args.scale,
        )
        # 先注入配置再打开模板（file:// 页面才允许加载本地子资源）
        await page.add_init_script(init_js)
        await page.goto(TEMPLATE_PATH.as_uri(), wait_until="load")

        # 等待模板就绪信号（字体、图片、高亮全部完成）
        try:
            await page.wait_for_selector('body[data-ready="1"]', timeout=10_000)
        except Exception:
            print("[md2card] 警告：渲染就绪信号超时，按当前状态导出", file=sys.stderr)

        card = page.locator(".mdc-card")
        await card.screenshot(path=str(out_path))
        await browser.close()

    print(f"[md2card] 已生成 {out_path}  (theme={config['theme']}, scale={args.scale}x)")


def collect_inputs(target: Path) -> list[Path]:
    """输入可以是单个 .md 文件，也可以是目录（批量转换其中所有 .md）。"""
    if target.is_dir():
        files = sorted(target.glob("*.md"))
        if not files:
            raise SystemExit(f"[md2card] 目录中没有找到 .md 文件: {target}")
        return files
    if not target.is_file():
        raise SystemExit(f"[md2card] 文件不存在: {target}")
    return [target]


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="md2card",
        description="Markdown 一键转精美分享卡片（PNG）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("用法:")[1] if __doc__ else None,
    )
    parser.add_argument("input", nargs="?", type=Path,
                        help="Markdown 文件或目录（目录则批量转换）；留空则 --list-themes")
    parser.add_argument("-o", "--output", type=Path,
                        help="输出 PNG 路径（默认与输入同名）；批量模式时为输出目录")
    parser.add_argument("--theme", default="serenity", help="主题（默认 serenity）")
    parser.add_argument("--width", type=int, default=420, help="卡片宽度 px（默认 420）")
    parser.add_argument("--scale", type=int, default=2, choices=[1, 2, 3, 4],
                        help="导出倍率（默认 2x）")
    parser.add_argument("--title", default=None, help="覆盖卡片标题（默认取首个 h1）")
    parser.add_argument("--date", default=None, help="日期文本（默认今天）")
    parser.add_argument("--watermark", default="@md2card", help="水印署名（默认 @md2card）")
    parser.add_argument("--no-header", action="store_true", help="不渲染标题栏")
    parser.add_argument("--no-footer", action="store_true", help="不渲染水印栏")
    parser.add_argument("--no-brand", action="store_true", help="水印栏不显示 md2card 品牌")
    parser.add_argument("--list-themes", action="store_true", help="列出全部主题并退出")
    args = parser.parse_args()

    if args.list_themes or not args.input:
        print("md2card 可用主题:")
        for i, t in enumerate(THEMES, 1):
            print(f"  {i}. {t}")
        return

    inputs = collect_inputs(args.input)
    batch = len(inputs) > 1

    out_dir: Path | None = None
    if args.output:
        out_dir = args.output if batch or args.output.suffix.lower() != ".png" else None
        if batch:
            out_dir.mkdir(parents=True, exist_ok=True)

    try:
        from playwright.async_api import async_playwright  # noqa: F401
    except ImportError:
        raise SystemExit(
            "[md2card] 缺少依赖，请先执行:\n"
            "  pip install playwright\n"
            "  playwright install chromium"
        )

    async def run_all() -> None:
        for src in inputs:
            md_text = src.read_text(encoding="utf-8")
            if batch:
                dest = (out_dir / (src.stem + ".png")) if out_dir else src.with_suffix(".png")
            else:
                dest = args.output or src.with_suffix(".png")
            dest.parent.mkdir(parents=True, exist_ok=True)
            await render_png(md_text, args, dest)

    asyncio.run(run_all())


if __name__ == "__main__":
    main()
