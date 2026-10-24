/* 投放页：生成卡片、发布到 GitHub、管理在投广告 */
(function () {
  'use strict';

  var REPO = 'ybxj-AAA/ads-portal';
  var FILE = 'index.html';
  var API = 'https://api.github.com/repos/' + REPO + '/contents/' + FILE;
  var START = '<!-- ADS:START -->';
  var END = '<!-- ADS:END -->';
  var TOKEN_KEY = 'ads.gh.token';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

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

  /* ---------- token ---------- */

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function setToken(v) {
    try { localStorage.setItem(TOKEN_KEY, v); } catch (e) { /* ignore */ }
  }

  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

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

  /* ---------- 卡片 ---------- */

  function mmdd() {
    var d = new Date();
    return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function buildCard(ad) {
    var cover = /^cover-(blue|violet|green)$/.test(ad.cover) ? ad.cover : 'cover-blue';
    var href = 'go.html?u=' + encodeURIComponent(ad.url) + '&id=' + encodeURIComponent(ad.id);
    var mark = String(ad.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'AD';

    return [
      '        <article class="ad-card" data-ad-id="' + esc(ad.id) + '">',
      '          <div class="ad-cover ' + cover + '">',
      '            <span class="ad-tag">' + esc(ad.tag) + '</span>',
      '            <span class="mark">' + esc(mark) + '</span>',
      '          </div>',
      '          <div class="ad-body">',
      '            <h3>' + esc(ad.title) + '</h3>',
      '            <p>' + esc(ad.desc) + '</p>',
      '            <div class="ad-meta"><span>' + esc(ad.id) + '</span><span>·</span><span>更新 ' + mmdd() + '</span></div>',
      '            <a class="ad-link" href="' + esc(href) + '" target="_blank" rel="noopener">打开落地页 <span>↗</span></a>',
      '          </div>',
      '        </article>'
    ].join('\n');
  }

  function parseCards(html) {
    var out = [];
    var re = /<article class="ad-card" data-ad-id="([^"]+)">([\s\S]*?)<\/article>/g;
    var m;
    while ((m = re.exec(html))) {
      var body = m[2];
      var title = /<h3>([\s\S]*?)<\/h3>/.exec(body);
      var tag = /<span class="ad-tag">([\s\S]*?)<\/span>/.exec(body);
      out.push({
        id: unesc(m[1]),
        title: title ? unesc(title[1]) : '',
        tag: tag ? unesc(tag[1]) : ''
      });
    }
    return out;
  }

  /* ---------- 界面 ---------- */

  var els = {};

  function status(kind, text) {
    if (!els.status) return;
    els.status.className = 'publish-status' + (kind ? ' is-' + kind : '');
    els.status.innerHTML = text || '';
  }

  function errText(err) {
    if (!err) return '出错了，再试一次。';
    if (err.message === 'NO_TOKEN') return '还没绑定 GitHub token，先在下面填一个。';
    if (err.status === 401) return 'token 无效或已过期，换一个新的。';
    if (err.status === 403) return 'token 权限不够，需要 contents 读写权限。';
    if (err.status === 404) return '找不到仓库或文件，检查 token 的仓库范围。';
    if (err.status === 409) return '文件刚好被别人改过，刷新页面再来一次。';
    return '发布失败：' + err.message;
  }

  function renderList(cards) {
    if (!els.list) return;
    if (els.count) els.count.textContent = String(cards.length);
    els.list.innerHTML = '';
    if (!cards.length) {
      els.list.innerHTML = '<li class="empty">还没有在投的广告。</li>';
      return;
    }
    cards.forEach(function (ad) {
      var li = document.createElement('li');
      li.innerHTML = '<code class="ad-id">' + esc(ad.id) + '</code>' +
        '<span class="ad-title">' + esc(ad.title || '(无标题)') + '</span>' +
        '<button class="link-btn" type="button" data-del="' + esc(ad.id) + '">下线</button>';
      els.list.appendChild(li);
    });
  }

  function refreshList() {
    if (!getToken()) {
      renderList([]);
      if (els.list) els.list.innerHTML = '<li class="empty">绑定 token 后显示当前在投的广告。</li>';
      return Promise.resolve();
    }
    return loadPage().then(function (page) {
      renderList(parseCards(page.html));
    }).catch(function (err) {
      if (els.list) els.list.innerHTML = '<li class="empty">读取失败：' + esc(errText(err)) + '</li>';
    });
  }

  function tokenUI() {
    var has = !!getToken();
    if (els.tokenInput) els.tokenInput.value = '';
    if (els.tokenBox) els.tokenBox.classList.toggle('has-token', has);
    if (els.tokenState) {
      els.tokenState.textContent = has ? '已绑定，发布时会用它提交到仓库。' : '未绑定，只能生成代码，不能直接发布。';
    }
  }

  /* ---------- 发布 ---------- */

  function currentAd() {
    return {
      id: $('#adId').value.trim(),
      tag: $('#adTag').value.trim() || '广告位',
      title: $('#adTitle').value.trim(),
      desc: $('#adDesc').value.trim(),
      url: $('#adUrl').value.trim(),
      cover: $('#adCover').value
    };
  }

  function validate(ad) {
    if (!ad.id || !ad.title || !ad.url) return '广告 ID、标题、落地页链接都要填。';
    if (!/^[a-zA-Z0-9_-]+$/.test(ad.id)) return '广告 ID 只能用英文、数字、下划线和短横线。';
    if (!/^https?:\/\//i.test(ad.url)) return '链接必须以 http:// 或 https:// 开头。';
    if (ad.desc.length > 120) return '描述太长了，压到 120 字以内。';
    return '';
  }

  function doPublish(ad) {
    status('busy', '正在提交到仓库…');
    if (els.publishBtn) els.publishBtn.disabled = true;

    loadPage().then(function (page) {
      if (page.html.indexOf(START) < 0 || page.html.indexOf(END) < 0) {
        throw new Error('首页缺少广告墙标记，先别发，找维护的人。');
      }
      if (new RegExp('data-ad-id="' + escapeRe(ad.id) + '"').test(page.html)) {
        throw new Error('广告 ID 已经存在，换一个。');
      }
      var next = page.html.replace(END, buildCard(ad) + '\n        ' + END);
      return savePage(next, page.sha, '发布广告：' + ad.title);
    }).then(function () {
      status('ok', '已提交，GitHub Pages 一两分钟内更新。<a href="' + location.origin + location.pathname.replace(/publish\.html$/, '') + '" target="_blank" rel="noopener">打开首页看看</a>');
      return refreshList();
    }).catch(function (err) {
      status('err', errText(err));
    }).then(function () {
      if (els.publishBtn) els.publishBtn.disabled = false;
    });
  }

  function doDelete(id) {
    if (!window.confirm('确定下线广告 ' + id + '？')) return;
    status('busy', '正在下线…');
    loadPage().then(function (page) {
      var re = new RegExp('\\n?\\s*<article class="ad-card" data-ad-id="' + escapeRe(id) + '">[\\s\\S]*?<\\/article>');
      if (!re.test(page.html)) throw new Error('页面上找不到这条广告。');
      var next = page.html.replace(re, '');
      return savePage(next, page.sha, '下线广告：' + id);
    }).then(function () {
      status('ok', '已下线，一两分钟后生效。');
      return refreshList();
    }).catch(function (err) {
      status('err', errText(err));
    });
  }

  /* ---------- 绑定 ---------- */

  function bindAll() {
    els.status = $('[data-status]');
    els.list = $('[data-ad-list]');
    els.count = $('[data-ad-count]');
    els.tokenInput = $('[data-token-input]');
    els.tokenBox = $('[data-token-box]');
    els.tokenState = $('[data-token-state]');
    els.publishBtn = $('[data-publish]');
    els.output = $('#output');
    els.form = $('#adForm');

    tokenUI();

    var save = $('[data-token-save]');
    save && save.addEventListener('click', function () {
      var v = (els.tokenInput.value || '').trim();
      if (!/^(gh[pousr]_|github_pat_)/.test(v)) {
        status('err', '这不像 GitHub token，通常以 ghp_ 或 github_pat_ 开头。');
        return;
      }
      setToken(v);
      tokenUI();
      status('busy', '验证 token…');
      loadPage().then(function (page) {
        status('ok', 'token 可用，已保存。当前在投 ' + parseCards(page.html).length + ' 条。');
        renderList(parseCards(page.html));
      }).catch(function (err) {
        clearToken();
        tokenUI();
        status('err', errText(err));
      });
    });

    var forget = $('[data-token-clear]');
    forget && forget.addEventListener('click', function () {
      clearToken();
      tokenUI();
      refreshList();
      status('', '');
    });

    var publishBtn = $('[data-publish]');
    publishBtn && publishBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var ad = currentAd();
      var bad = validate(ad);
      if (bad) { status('err', bad); return; }
      if (!getToken()) { status('err', '先绑定 GitHub token 才能直接发布。也可以先「生成代码」，再让人贴上去。'); return; }
      doPublish(ad);
    });

    var previewBtn = $('[data-preview]');
    previewBtn && previewBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var ad = currentAd();
      var bad = validate(ad);
      if (bad) { status('err', bad); return; }
      els.output.textContent = buildCard(ad);
      status('busy', '代码已生成，可复制交给维护的人贴到首页。');
    });

    els.list && els.list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del]');
      if (!btn) return;
      doDelete(btn.getAttribute('data-del'));
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

    // 表单按回车不提交，避免半截发布
    els.form && els.form.addEventListener('submit', function (e) { e.preventDefault(); });

    refreshList();
  }

  document.addEventListener('DOMContentLoaded', bindAll);
})();
