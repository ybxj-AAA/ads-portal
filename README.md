# 广告投放中心

纯静态的广告位展示站，托管在 GitHub Pages。没有后端、没有数据库。

线上地址：https://ybxj-aaa.github.io/ads-portal/
密钥购买 / 续期：Telegram [@tg7879](https://t.me/tg7879)

## 页面

```
index.html     首页：广告墙放最前，点“我要投放”弹密钥框
publish.html   投放页：验证密钥 → 填表 → 发布上线（noindex）
guide.html     投放指南
go.html        跳转中转页，只放行 http/https（noindex）
404.html       找不到页面
assets/        样式、脚本、密钥名单、发布逻辑
tools/         密钥生成脚本
```

## 加一条广告（网页上直接发）

1. 打开投放页，输入密钥。密钥存在浏览器 localStorage 里，到期前不用重输。
2. 首次发布前绑定一次 GitHub token（`ghp_...`），只存在本机浏览器。
3. 填广告 ID、角标、标题、描述、落地页链接，点「发布上线」。
4. 页面调用 GitHub API，把卡片写进 `index.html` 的 `<!-- ADS:START --> … <!-- ADS:END -->` 之间；Actions 构建后约一两分钟上线。
5. 撤下广告：右侧「当前在投」里点「下线」。

没有 token 时可以点「只生成代码」，拿到 HTML 手动贴。

token 需要 classic `repo` 权限。页面里的密钥校验是客户端的，真正拦住乱写的是 GitHub 权限，token 不要外借；换电脑要重新绑定。

## 投放密钥

`assets/keys.js` 只存密钥的 SHA-256 哈希，不存明文。签发新密钥：

```powershell
powershell -ExecutionPolicy Bypass -File tools/gen-key.ps1 -Plan "3 个月" -Days 90 -Count 1
```

脚本打印明文（发给客户）和一行 `{ h: "...", ... },`（贴进 `keys.js`）。有效期从 `issued` 起算，长期用 36500 天。

## 收录相关

- `robots.txt` 放行全站，禁掉 `go.html`
- `sitemap.xml`：首页 + 指南页
- 首页带 WebSite / FAQPage 结构化数据，指南页带 Article
- `7f3c9a2e5b814d6f9c0a3e7d2b4f8c15.txt` 是 IndexNow 验证文件，删了会导致 Bing 校验失败

## 本地预览

```powershell
python -m http.server 8765
```

打开 http://127.0.0.1:8765/ 。`go.html` 的跳转也必须在 http 下测。

## 换域名时改这几处

`index.html`、`guide.html` 里的 canonical 与 og:url；`sitemap.xml` 的 loc；`404.html` 里写死的 `/ads-portal/` 前缀。
