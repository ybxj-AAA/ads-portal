/* 投放页：填链接/图片/位置，直接发布到 GitHub */
(function () {
  'use strict';

  var REPO = 'ybxj-AAA/ads-portal';
  var FILE = 'index.html';
  var API = 'https://api.github.com/repos/' + REPO + '/contents/' + FILE;
  var START = '<!-- ADS:START -->';
  var END = '<!-- ADS:END -->';
  var TOKEN_KEY = 'ads.gh.token';
  var MAX_SLOTS = 3;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  /* ---------- 编码 ---------- */

  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function b64encode(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function unesc(s) {
    return String(s || '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  }

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /* ---------- token ---------- */

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(v) { try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  /* ---------- GitHub ---------- */

  function ghRequest(method, url, body) {
    var token = getToken();
    if (!token) return Promise.reject(new Error('NO_TOKEN'));

    return fetch(url, {
      method: method,
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var err = new Error((data && data.message) || ('HTTP ' + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function loadPage() {
    return ghRequest('GET', API + '?ref=main&_=' + Date.now()).then(function (json) {
      return { html: b64decode(json.content), sha: json.sha };
    });
  }

  function savePage(html, sha, message) {
    return ghRequest('PUT', API, {
      message: message,
      content: b64encode(html),
      sha: sha,
      branch: 'main'
    });
  }

  /* ---------- 卡片模型 ---------- */

  function parseBlocks(html) {
    var re = /<article class="ad-card" data-ad-id="([^"]*)">[\s\S]*?<\/article>/g;
    var out = [];
    var m;
    while ((m = re.exec(html))) {
      out.push({ id: unesc(m[1]), raw: m[0] });
    }
    return out;
  }

  function parseMeta(raw) {
    var t = /<h3>([\s\S]*?)<\/h3>/.exec(raw);
    var tag = /<span class="ad-tag">([\s\S]*?)<\/span>/.exec(raw);
    var href = /<a class="ad-link" href="([^"]*)"/.exec(raw);
    var img = /<img src="([^"]*)"/.exec(raw);
    var url = '';
    if (href) {
      var q = /[?&]u=([^&"]*)/.exec(unesc(href[1]));
      if (q) { try { url = decodeURIComponent(q[1]); } catch (e) { url = ''; } }
    }
    return {
      id: '',
      title: t ? unesc(t[1]) : '',
      tag: tag ? unesc(tag[1]) : '',
      image: img ? unesc(img[1]) : '',
      url: url
    };
  }

  function indent(raw) {
    return raw.split('\n').map(function (line) { return '        ' + line.replace(/^\s+/, ''); }).join('\n');
  }

  function buildCard(ad) {
    var cover = /^cover-(blue|violet|green)$/.test(ad.cover) ? ad.cover : 'cover-blue';
    var href = 'go.html?u=' + encodeURIComponent(ad.url) + '&id=' + encodeURIComponent(ad.id);
    var title = ad.title || hostOf(ad.url) || '广告位';
    var mark = String(ad.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'AD';
    var d = new Date();
    var mmdd = ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);

    var coverHtml = ad.image
      ? '            <img src="' + esc(ad.image) + '" alt="' + esc(title) + '" loading="lazy" />'
      : '            <span class="mark">' + esc(mark) + '</span>';

    var lines = [
      '<article class="ad-card" data-ad-id="' + esc(ad.id) + '">',
      '  <div class="ad-cover ' + cover + '">',
      '    <span class="ad-tag">' + esc(ad.tag) + '</span>',
      coverHtml,
      '  </div>',
      '  <div class="ad-body">',
      '    <h3>' + esc(title) + '</h3>',
      ad.desc ? '    <p>' + esc(ad.desc) + '</p>' : '    <p>' + esc(hostOf(ad.url)) + '</p>',
      '    <div class="ad-meta"><span>' + esc(ad.id) + '</span><span>·</span><span>更新 ' + mmdd + '</span></div>',
      '    <a class="ad-link" href="' + esc(href) + '" target="_blank" rel="noopener">打开落地页 <span>↗</span></a>',
      '  </div>',
      '</article>'
    ];
    return lines.join('\n');
  }

  function replaceRegion(html, blocks) {
    var body = blocks.map(function (b) { return indent(b.raw); }).join('\n\n');
    var region = START + '\n' + body + '\n        ' + END;
    var re = new RegExp(escapeRe(START) + '[\\s\\S]*?' + escapeRe(END));
    if (!re.test(html)) throw new Error('首页缺少广告墙标记，先找维护的人处理。');
    return html.replace(re, region);
  }

  function nextId(blocks) {
    var n = 1;
    var ids = blocks.map(function (b) { return b.id; });
    while (ids.indexOf('ad-' + n) >= 0) n++;
    return 'ad-' + n;
  }

  /* ---------- 表单 ---------- */

  var els = {};

  function status(kind, html) {
    if (!els.status) return;
    els.status.className = 'publish-status' + (kind ? ' is-' + kind : '');
    els.status.innerHTML = html || '';
  }

  function errText(err) {
    if (!err) return '出错了，再试一次。';
    if (err.message === 'NO_TOKEN') return '还没绑定 GitHub token。';
    if (err.status === 401) return 'token 无效（可能复制不完整或已过期）。点下面「清除」，去 GitHub 重新生成一个 classic token，勾上 <b>repo</b>，再粘进来。';
    if (err.status === 403) return 'token 没有写权限。生成 token 时要勾 <b>repo</b>（classic），或者 fine-grained 里给 Contents 读写。';
    if (err.status === 404) return '找不到仓库 ybxj-AAA/ads-portal。检查 token 是不是限定了别的仓库，或仓库被改名了。';
    if (err.status === 409) return '文件刚被改过，刷新页面再发一次。';
    return '发布失败：' + err.message;
  }

  function handleError(err) {
    status('err', errText(err));
    if (err && (err.status === 401 || err.status === 404)) {
      els.pendingRetry = true;
    }
  }

  /* ---------- 发布流程 ---------- */

  function readForm() {
    return {
      url: $('#adUrl').value.trim(),
      image: $('#adImage').value.trim(),
      slot: $('#adSlot').value,
      title: $('#adTitle').value.trim(),
      desc: $('#adDesc').value.trim(),
      tag: $('#adTag').value.trim(),
      cover: $('#adCover').value
    };
  }

  function validate(f) {
    if (!f.url) return '先填落地页链接。';
    if (!/^https?:\/\//i.test(f.url)) return '落地页链接要以 http:// 或 https:// 开头。';
    if (f.image && !/^https?:\/\//i.test(f.image)) return '展示图链接也要以 http:// 或 https:// 开头。';
    if (f.image && !/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(f.image)) return '展示图看起来不是图片地址，要 .png / .jpg / .webp 结尾。';
    if (f.desc.length > 120) return '描述太长，压到 120 字以内。';
    return '';
  }

  function publish(f) {
    status('busy', '正在提交…');
    els.publishBtn.disabled = true;

    loadPage().then(function (page) {
      var blocks = parseBlocks(page.html);
      var id;
      var replaceIndex = -1;

      if (f.slot === 'last') {
        if (blocks.length >= MAX_SLOTS) {
          throw new Error('最多只放 ' + MAX_SLOTS + ' 条，先把不要的「下线」。');
        }
      } else {
        replaceIndex = parseInt(f.slot, 10) - 1;
        if (blocks[replaceIndex]) id = blocks[replaceIndex].id;
      }

      if (!id) id = 'ad-' + (blocks.length + 1) + '-' + Date.now().toString(36).slice(-4);

      var ad = {
        id: id,
        url: f.url,
        image: f.image,
        title: f.title,
        desc: f.desc,
        tag: f.tag || ('位置 0' + (f.slot === 'last' ? blocks.length + 1 : f.slot)),
        cover: f.cover
      };
      var card = { id: id, raw: buildCard(ad) };

      if (replaceIndex >= 0) blocks[replaceIndex] = card;
      else blocks.push(card);

      var next = replaceRegion(page.html, blocks);
      return savePage(next, page.sha, '发布广告：' + (ad.title || hostOf(ad.url) || id));
    }).then(function () {
      status('ok', '已提交，GitHub Pages 一两分钟更新。<a href="./" target="_blank" rel="noopener">打开首页看看</a>');
      return refreshList();
    }).catch(function (err) {
      handleError(err);
    }).then(function () {
      els.publishBtn.disabled = false;
    });
  }

  function remove(id) {
    if (!window.confirm('确定下线 ' + id + '？')) return;
    status('busy', '正在下线…');
    loadPage().then(function (page) {
      var blocks = parseBlocks(page.html).filter(function (b) { return b.id !== id; });
      return savePage(replaceRegion(page.html, blocks), page.sha, '下线广告：' + id);
    }).then(function () {
      status('ok', '已下线，一两分钟后生效。');
      return refreshList();
    }).catch(handleError);
  }

  /* ---------- 列表 ---------- */

  function renderList(blocks) {
    if (!els.list) return;
    if (els.count) els.count.textContent = String(blocks.length);
    els.list.innerHTML = '';
    if (!blocks.length) {
      els.list.innerHTML = '<li class="empty">还没有在投的广告。</li>';
      return;
    }
    blocks.forEach(function (b, i) {
      var meta = parseMeta(b.raw);
      var li = document.createElement('li');
      li.innerHTML = '<span class="slot-no">' + (i + 1) + '</span>' +
        '<span class="ad-title">' + esc(meta.title || hostOf(meta.url) || b.id) + '</span>' +
        '<button class="link-btn" type="button" data-del="' + esc(b.id) + '">下线</button>';
      els.list.appendChild(li);
    });
  }

  function refreshList() {
    if (!getToken()) {
      if (els.list) els.list.innerHTML = '<li class="empty">绑定 token 后显示当前在投的广告。</li>';
      if (els.count) els.count.textContent = '—';
      return Promise.resolve();
    }
    return loadPage().then(function (page) {
      renderList(parseBlocks(page.html));
    }).catch(function (err) {
      if (els.list) els.list.innerHTML = '<li class="empty">读取失败：' + esc(errText(err)).replace(/<[^>]+>/g, '') + '</li>';
      if (els.count) els.count.textContent = '—';
    });
  }

  /* ---------- 绑定 ---------- */

  function tokenUI() {
    var has = !!getToken();
    if (els.tokenState) {
      els.tokenState.textContent = has
        ? '已绑定。发布时会用这个 token 提交到仓库。'
        : '还没绑定，点「保存」前先把 token 粘进来。';
    }
    if (els.tokenClear) els.tokenClear.style.display = has ? '' : 'none';
  }

  function bindAll() {
    els.status = $('[data-status]');
    els.list = $('[data-ad-list]');
    els.count = $('[data-ad-count]');
    els.tokenInput = $('[data-token-input]');
    els.tokenState = $('[data-token-state]');
    els.tokenClear = $('[data-token-clear]');
    els.publishBtn = $('[data-publish]');
    els.output = $('#output');

    tokenUI();

    var save = $('[data-token-save]');
    save && save.addEventListener('click', function () {
      var v = (els.tokenInput.value || '').trim();
      if (!/^(gh[pousr]_|github_pat_)/.test(v)) {
        status('err', '这不像 GitHub token，通常以 ghp_ 或 github_pat_ 开头。去 <a href="https://github.com/settings/tokens/new?scopes=repo&amp;description=ads-portal" target="_blank" rel="noopener">这里</a> 生成，勾上 repo。');
        return;
      }
      setToken(v);
      tokenUI();
      status('busy', '验证中…');
      loadPage().then(function (page) {
        var blocks = parseBlocks(page.html);
        renderList(blocks);
        status('ok', 'token 可用，已保存。当前在投 ' + blocks.length + ' 条。');
      }).catch(function (err) {
        clearToken();
        tokenUI();
        handleError(err);
      });
    });

    els.tokenClear && els.tokenClear.addEventListener('click', function () {
      clearToken();
      tokenUI();
      refreshList();
      status('', '');
    });

    els.publishBtn && els.publishBtn.addEventListener('click', function () {
      var f = readForm();
      var bad = validate(f);
      if (bad) { status('err', bad); return; }
      if (!getToken()) {
        var msg = '广告投放\n落地页：' + f.url + '\n展示图：' + (f.image || '无') + '\n位置：' + (f.slot === 'last' ? '最后' : ('第 ' + f.slot + ' 位'));
        status('err', '还没绑定 token。要么粘一个 classic token（勾 repo）点保存自己发，要么<a href="https://t.me/tg7879?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">把这条广告发给 @tg7879 代发</a>。');
        return;
      }
      publish(f);
    });

    var preview = $('[data-preview]');
    preview && preview.addEventListener('click', function () {
      var f = readForm();
      var bad = validate(f);
      if (bad) { status('err', bad); return; }
      var id = 'preview';
      els.output.textContent = buildCard({
        id: id, url: f.url, image: f.image,
        title: f.title, desc: f.desc,
        tag: f.tag || '广告位', cover: f.cover
      });
      status('busy', '代码已生成，可复制交给维护的人。');
    });

    els.list && els.list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del]');
      if (!btn) return;
      remove(btn.getAttribute('data-del'));
    });

    var copyBtn = $('#copyBtn');
    copyBtn && copyBtn.addEventListener('click', function () {
      var text = els.output.textContent;
      if (!text) return;
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = '已复制';
        setTimeout(function () { copyBtn.textContent = '复制代码'; }, 1500);
      }).catch(function () {
        copyBtn.textContent = '复制失败，手动选中';
        setTimeout(function () { copyBtn.textContent = '复制代码'; }, 2000);
      });
    });

    var form = $('#adForm');
    form && form.addEventListener('submit', function (e) { e.preventDefault(); });

    refreshList();
  }

  document.addEventListener('DOMContentLoaded', bindAll);
})();
