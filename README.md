# 广告投放中心

纯静态的广告位展示站，托管在 GitHub Pages。没有后端、没有数据库，加一条广告就是改一个 HTML 再 push。

线上地址：https://ybxj-aaa.github.io/ads-portal/
密钥购买 / 续期：Telegram [@tg7879](https://t.me/tg7879)

## 页面

```
index.html     首页：广告墙、密钥有效期、流程、常见问题
guide.html     投放指南
publish.html   投放页：先验证密钥，再生成广告卡片（noindex）
go.html        跳转中转页，只放行 http/https（noindex）
404.html       找不到页面
assets/        样式、脚本、密钥名单
tools/         密钥生成脚本
```

## 投放密钥

投放页是锁着的，输入密钥才能生成卡片。有效期分 7 天、1 个月、3 个月、6 个月、1 年、长期，从签发日算，到期自动失效。

`assets/keys.js` 里**只存密钥的 SHA-256 哈希**，不存明文，所以别人翻源码也拿不到能用的密钥。签发新密钥：

```powershell
powershell -ExecutionPolicy Bypass -File tools/gen-key.ps1 -Plan "3 个月" -Days 90 -Count 1
```

脚本会打印明文密钥（发给客户）和一行 `{ h: "...", ... },`（贴进 `assets/keys.js` 的 `items`）。

注意：这是纯静态站，校验在浏览器里做。挡不住会改 JS 的人，只能挡住普通用户随手翻到生成器。

## 加一条广告

1. 打开投放页，输入密钥
2. 填广告 ID、角标、标题、描述、落地页链接，点“生成代码”
3. 打开 `index.html`，找到 `<div class="ad-grid" data-ad-grid>`，把生成的 `<article>` 粘在最后
4. 提交，等 Actions 构建（约 1 分钟）

点击只记在访问者的 localStorage 里，不上报。

## 收录相关

- `robots.txt` 放行全站，禁掉 `go.html`
- `sitemap.xml`：首页 + 指南页
- 首页带 WebSite / FAQPage 结构化数据，指南页带 Article
- `7f3c9a2e5b814d6f9c0a3e7d2b4f8c15.txt` 是 IndexNow 验证文件，删了会导致 Bing 校验失败

## 本地预览

```powershell
python -m http.server 8765
```

然后打开 http://127.0.0.1:8765/ 。`go.html` 的跳转也必须在 http 下测，双击文件不行。

## 换域名时改这几处

`index.html`、`guide.html` 里的 canonical 与 og:url；`sitemap.xml` 的 loc；`404.html` 里写死的 `/ads-portal/` 前缀。
