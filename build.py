# -*- coding: utf-8 -*-
"""把 src/ 合成单文件站点。

产物：
  dist/index.html   便携单文件（双击即可用，file:// 也能跑）
  docs/index.html   GitHub Pages 发布目录

规则：
  · 顺序即依赖：factors → calc → charts → store → project → views → app
  · 构建摘要注入 window.__BUILD__（正文 SHA-256 前 12 位），与 DAC Workbench 同法
  · --check 只校验产物是否与源码一致，不写文件（CI / 发布前用）
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT_DIST = ROOT / "dist" / "index.html"
OUT_DOCS = ROOT / "docs" / "index.html"

SCRIPTS = [
    "core/factors.js",
    "core/calc.js",
    "core/charts.js",
    "core/store.js",
    "data/project.js",
    "ui/views.js",
    "ui/app.js",
]


def read(rel: str) -> str:
    return (SRC / rel).read_text(encoding="utf-8")


def git(*args: str):
    try:
        r = subprocess.run(["git", *args], cwd=str(ROOT), capture_output=True, text=True, timeout=10)
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:
        return None


def build_markup() -> str:
    html = read("index.html")
    css = read("styles.css")
    html = html.replace("/*__CSS__*/", css.strip())

    blocks = []
    for rel in SCRIPTS:
        code = read(rel)
        if "</script" in code.lower():
            raise SystemExit(f"{rel} 含有 </script 字面量，会截断内联脚本")
        blocks.append(f"<!-- {rel} -->\n<script>\n{code}\n</script>")
    html = html.replace("<!--__SCRIPTS__-->", "\n".join(blocks))
    return html


def build() -> tuple[str, dict]:
    markup = build_markup()
    digest = hashlib.sha256(markup.encode("utf-8")).hexdigest()[:12]

    dirty = bool((git("status", "--porcelain", "--", "src", "build.py") or "").strip())
    info = {
        "app": "carbon-seeker",
        "version": "1.0.0",
        "digest": digest,
        "time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sourceCommit": git("rev-parse", "HEAD"),
        "sourceDirty": dirty,
        "note": "digest 为注入脚本后的正文 SHA-256 前 12 位；sourceCommit 是构建时本地 HEAD。",
    }
    payload = json.dumps(info, ensure_ascii=False).replace("</", "<\\/")
    final = markup.replace(
        "<body>",
        "<body>\n<script>window.__BUILD__ = " + payload + ";</script>",
        1,
    )
    return final, info


def main() -> int:
    final, info = build()
    check = "--check" in sys.argv

    if check:
        if not OUT_DOCS.exists():
            print("CHECK FAIL: docs/index.html 不存在")
            return 1
        current = OUT_DOCS.read_text(encoding="utf-8")
        # 比较时忽略 __BUILD__ 行（时间戳会变）
        def strip_build(s: str) -> str:
            return "\n".join(l for l in s.splitlines() if not l.startswith("<script>window.__BUILD__"))

        if strip_build(current) != strip_build(final):
            print("CHECK FAIL: docs/index.html 与 src/ 不一致，请重新运行 python build.py")
            return 1
        print(f"CHECK OK: 产物与源码一致（digest {info['digest']}）")
        return 0

    for path in (OUT_DIST, OUT_DOCS):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(final, encoding="utf-8")

    size = len(final.encode("utf-8"))
    print(f"BUILD OK  digest={info['digest']}  size={size/1024:.1f} KiB")
    print(f"  -> {OUT_DIST}")
    print(f"  -> {OUT_DOCS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
