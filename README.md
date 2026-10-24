# 广告投放中心

一个纯静态的广告位展示页，托管在 GitHub Pages。没有后端，没有数据库，加一条广告就是改一个 HTML 文件再 push。

线上地址：https://ybxj-aaa.github.io/ads-portal/

## 页面

```
index.html     首页：广告墙 + 常见问题
guide.html     投放指南：广告位类型、计费方式、落地页的坑
publish.html   填表生成广告卡片 HTML（noindex，不参与收录）
go.html        跳转中转页，只放行 http/https（noindex）
404.html       找不到页面时显示
assets/        样式和脚本
```

## 加一条广告

1. 打开 `https://ybxj-aaa.github.io/ads-portal/publish.html`
2. 填广告 ID、角标、标题、描述、落地页链接，点“生成代码”
3. 打开 `index.html`，找到 `<div class="grid" id="adGrid">`，把生成的 `<article>` 粘在最后一张卡后面
4. 提交。GitHub Actions 自动构建，一分钟左右生效

广告点击只记在浏览器 localStorage 里，用来自己看效果，不上报任何服务器。

## 收录相关

- `robots.txt` 放行全站，禁掉 `go.html`（中转页没有收录价值）
- `sitemap.xml` 里是首页和指南页
- 首页带 WebSite 和 FAQPage 结构化数据，指南页带 Article
- `7f3c9a2e5b814d6f9c0a3e7d2b4f8c15.txt` 是 IndexNow 的验证文件，删掉会导致 Bing 重新校验失败

## 本地预览

直接双击 `index.html` 能看页面；`go.html` 的跳转要在 http 下测，可以用 `python -m http.server` 起一个。

## 换域名时改这几处

`index.html`、`guide.html` 里的 canonical 和 og:url，`sitemap.xml` 里的 loc，`404.html` 里写死的 `/ads-portal/`。
