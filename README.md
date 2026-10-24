# 广告投放中心

一个纯静态的广告投放展示站，托管在 GitHub Pages。

## 功能

- 广告墙：卡片式展示广告位，每张卡带“立即前往”按钮
- 链接跳转：点击经 `go.html` 中转，只放行 http/https，带 `u` 参数跳转
- 投放工具：`publish.html` 填表生成卡片代码，复制粘贴到 `index.html` 即可上线
- SEO：title/description/keywords、canonical、Open Graph、JSON-LD、`robots.txt`、`sitemap.xml`、404 页

## 目录

```
index.html     广告墙首页
publish.html   生成广告卡片
assets/        样式与脚本
go.html        跳转中转页
robots.txt /sitemap.xml /404.html
```

## 怎么加一条广告

1. 打开 `https://ybxj-aaa.github.io/ads-portal/publish.html`
2. 填标题、描述、落地页链接，点“生成代码”，复制
3. 编辑 `index.html`，把代码粘进 `<div class="grid" id="adGrid">` 里面
4. 提交，等 Pages 自动发布

## 本地预览

直接双击 `index.html` 即可（`go.html` 跳转需要放到 http 服务下测试）。
