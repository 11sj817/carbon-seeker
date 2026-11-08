# 部署与回滚

站点是纯静态单文件，`docs/index.html` 由 `python build.py` 生成，GitHub Pages 直接发布这个目录。

- 公开地址：https://11sj817.github.io/carbon-seeker/
- 仓库：https://github.com/11sj817/carbon-seeker
- Pages 构建源：`main` 分支 `/docs` 目录（legacy 模式，不需要 Actions 权限）

## 发布流程

```bash
node --test tests/calc.test.js     # 计算内核
python build.py                    # 生成 dist/ 与 docs/
python build.py --check            # 产物与源码一致性
git add -A
git commit -m "feat: ..."
git push origin main
```

推送后 Pages 约 1 分钟生效。**不要**直接手改 `docs/index.html`：下次构建会覆盖，且 `--check` 会失败。

## 凭据约定

- 账号固定 `11sj817`；token 只从本机凭据管理器取：

```powershell
$token = (("protocol=https`nhost=github.com`n`n" | git credential fill) -split "`n" |
          Where-Object { $_ -like 'password=*' }) -replace '^password=',''
$b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$token"))
git -c http.extraheader="Authorization: Basic $b64" push origin main
```

- token 不写进远程 URL、不写进脚本、不落盘；推送后 `git remote -v` 必须是干净的 https 地址。
- 如果弹出 GitHub 账号选择框，选 `11sj817`，不要选 `x-access-token`（那是 token 拼进 URL 的伪账号）。

## 首次启用 Pages（已执行一次，留档）

```powershell
# 1) 建仓库
$body = '{"name":"carbon-seeker","description":"碳寻 · 企业碳减排管理的碳应用平台（交互式展示站）","private":false,"has_issues":true}'
Invoke-RestMethod -Method Post -Uri https://api.github.com/user/repos -Headers @{ Authorization = "token $token"; "User-Agent" = "carbon-seeker" } -Body $body -ContentType 'application/json'

# 2) 推送
git push origin main

# 3) 开启 Pages（main / docs）
$src = '{"source":{"branch":"main","path":"/docs"}}'
Invoke-RestMethod -Method Post -Uri https://api.github.com/repos/11sj817/carbon-seeker/pages -Headers @{ Authorization = "token $token"; "User-Agent" = "carbon-seeker" } -Body $src -ContentType 'application/json'
```

若返回 409（Pages 已存在），改用 `-Method Put` 更新 `source`。

## 核验

1. `Invoke-WebRequest https://11sj817.github.io/carbon-seeker/` 返回 200；
2. 下载线上 `index.html` 与本地 `docs/index.html` 比对 SHA-256（`window.__BUILD__` 行除外）；
3. 对下载产物跑一次 `qa/cdp-check.mjs`，确认 8 个视图都渲染、交互正常。

## 回滚

```bash
git revert <发布提交>
git push origin main
```

回滚后重新检查 Pages 与线上文件指纹。历史截图与旧构建摘要不能当作当前状态证据。
