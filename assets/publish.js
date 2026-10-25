/* 投放页：填链接、上传展示图、选位置，直接发布到 GitHub */
(function () {
  'use strict';

  var REPO = 'ybxj-AAA/ads-portal';
  var FILE = 'index.html';
  var CONTENTS = 'https://api.github.com/repos/' + REPO + '/contents/' + FILE;
  var GIT = 'https://api.github.com/repos/' + REPO + '/git';
  var START = '<!-- ADS:START -->';
  var END = '<!-- ADS:END -->';
  var FSTART = '<!-- FLOATS:START -->';
  var FEND = '<!-- FLOATS:END -->';
  var PSTART = '<!-- POPUP:START -->';
  var PEND = '<!-- POPUP:END -->';
  var TOKEN_KEY = 'ads.gh.token';
  var MAX_SLOTS = 12;

  var imgState = { data: '' };

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

  function normalizeImage(u) {
    if (!u) return '';
    var m = /[?&]mediaurl=([^&]+)/i.exec(u);
    if (m) {
      try { u = decodeURIComponent(m[1]); } catch (e) { /* ignore */ }
      if (/[?&]mediaurl=/i.test(u)) {
        try { u = decodeURIComponent(u); } catch (e2) { /* ignore */ }
      }
    }
    return u;
  }

  function probeImage(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; resolve(false); }
      }, 8000);
      img.onload = function () { if (!done) { done = true; clearTimeout(timer); resolve(true); } };
      img.onerror = function () { if (!done) { done = true; clearTimeout(timer); resolve(false); } };
      img.src = url;
    });
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /* ---------- token ---------- */

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(v) { try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  /* ---------- GitHub ---------- */

  function gh(method, url, body) {
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
    return gh('GET', CONTENTS + '?ref=main&_=' + Date.now()).then(function (json) {
      return { html: b64decode(json.content), sha: json.sha };
    });
  }

  function commitFiles(files, message) {
    var head;
    return gh('GET', GIT + '/ref/heads/main').then(function (ref) {
      head = ref.object.sha;
      return gh('GET', GIT + '/commits/' + head);
    }).then(function (commit) {
      var chain = Promise.resolve([]);
      files.forEach(function (f) {
        chain = chain.then(function (tree) {
          return gh('POST', GIT + '/blobs', { content: f.content, encoding: 'base64' }).then(function (blob) {
            tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
            return tree;
          });
        });
      });
      return chain.then(function (tree) {
        return gh('POST', GIT + '/trees', { base_tree: commit.tree.sha, tree: tree });
      });
    }).then(function (tree) {
      return gh('POST', GIT + '/commits', { message: message, tree: tree.sha, parents: [head] });
    }).then(function (commit) {
      return gh('PATCH', GIT + '/refs/heads/main', { sha: commit.sha });
    });
  }

  /* ---------- 卡片 ---------- */

  function parseBlocks(html) {
    var re = /<article class="ad-card" data-ad-id="([^"]*)">[\s\S]*?<\/article>/g;
    var out = [];
    var m;
    while ((m = re.exec(html))) out.push({ id: unesc(m[1]), raw: m[0] });
    return out;
  }

  function parseMeta(raw) {
    var t = /<h3>([\s\S]*?)<\/h3>/.exec(raw);
    var href = /<a class="ad-link" href="([^"]*)"/.exec(raw);
    var url = '';
    if (href) {
      var q = /[?&]u=([^&"]*)/.exec(unesc(href[1]));
      if (q) { try { url = decodeURIComponent(q[1]); } catch (e) { url = ''; } }
    }
    return { title: t ? unesc(t[1]) : '', url: url };
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

    return [
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
    ].join('\n');
  }

  function parseFloats(html) {
    var re = /<a class="floater"[\s\S]*?<\/a>/g;
    var out = [];
    var m;
    while ((m = re.exec(html))) out.push(m[0]);
    return out;
  }

  function buildFloater(label, url, idx) {
    var href = 'go.html?u=' + encodeURIComponent(url) + '&id=float-' + idx;
    return [
      '        <a class="floater" href="' + esc(href) + '" target="_blank" rel="noopener" data-float-id="float-' + idx + '">',
      '          <span class="floater-dot" aria-hidden="true"></span>',
      '          <span class="floater-text">' + esc(label) + '</span>',
      '        </a>'
    ].join('\n');
  }

  function buildPopup(ad) {
    var href = 'go.html?u=' + encodeURIComponent(ad.url) + '&id=' + encodeURIComponent(ad.id);
    var media = [
      '          <div class="pop-ad-media">',
      ad.image ? '            <img src="' + esc(ad.image) + '" alt="' + esc(ad.title) + '" />' : '',
      '            <span class="pop-ad-badge">广告</span>',
      '          </div>'
    ].filter(Boolean).join('\n');
    return [
      '        <a class="pop-ad-link" href="' + esc(href) + '" target="_blank" rel="noopener">',
      media,
      '          <div class="pop-ad-body">',
      '            <span class="pop-ad-title">' + esc(ad.title) + '</span>',
      ad.desc ? '            <span class="pop-ad-desc">' + esc(ad.desc) + '</span>' : '',
      '            <span class="pop-ad-cta">立即前往 <span>↗</span></span>',
      '          </div>',
      '        </a>'
    ].filter(Boolean).join('\n');
  }

  function replacePopup(html, inner) {
    var re = new RegExp(escapeRe(PSTART) + '[\\s\\S]*?' + escapeRe(PEND));
    if (!re.test(html)) return html;
    return html.replace(re, PSTART + '\n' + inner + '\n        ' + PEND);
  }
  function replaceFloats(html, floats) {
    var region = FSTART + '\n' + floats.join('\n\n') + '\n        ' + FEND;
    var re = new RegExp(escapeRe(FSTART) + '[\\s\\S]*?' + escapeRe(FEND));
    if (!re.test(html)) return html;
    return html.replace(re, region);
  }
  function replaceRegion(html, blocks) {
    var body = blocks.map(function (b) { return indent(b.raw); }).join('\n\n');
    var region = START + '\n' + body + '\n        ' + END;
    var re = new RegExp(escapeRe(START) + '[\\s\\S]*?' + escapeRe(END));
    if (!re.test(html)) throw new Error('首页缺少广告墙标记，先找维护的人处理。');
    return html.replace(re, region);
  }

  /* ---------- 界面 ---------- */

  var els = {};

  function status(kind, html) {
    if (!els.status) return;
    els.status.className = 'publish-status' + (kind ? ' is-' + kind : '');
    els.status.innerHTML = html || '';
  }

  function errText(err) {
    if (!err) return '出错了，再试一次。';
    if (err.message === 'NO_TOKEN') return '还没绑定 GitHub token。';
    if (err.status === 401) return 'token 无效（复制不完整或已过期）。点「清除」，重新生成一个 classic token（勾 <b>repo</b>），再粘进来。';
    if (err.status === 403) return 'token 没有写权限。生成时勾 <b>repo</b>（classic），fine-grained 则给 Contents 读写。';
    if (err.status === 404) return '找不到仓库 ybxj-AAA/ads-portal。检查 token 是不是限定了别的仓库。';
    if (err.status === 409) return '文件刚被改过，刷新页面再发一次。';
    if (err.status === 422) return '提交被拒绝，可能是图片太大或格式不对，换张小图。';
    return '发布失败：' + err.message;
  }

  function readForm() {
    return {
      url: $('#adUrl').value.trim(),
      image: imgState.data || normalizeImage($('#adImage').value.trim()),
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
    if (f.image && !/^(https?:\/\/|data:image\/)/i.test(f.image)) return '展示图要么从电脑选，要么粘 http(s) 开头的图片地址。';
    if (f.desc.length > 120) return '描述太长，压到 120 字以内。';
    return '';
  }

  /* ---------- 发布 ---------- */

  function publish(f) {
    status('busy', '正在提交…');
    if (els.publishBtn) els.publishBtn.disabled = true;

    var id;
    var imagePath = f.image;
    var files = [];

    loadPage().then(function (page) {
      if (f.slot === 'popup') {
        var popAd = {
          id: 'popup-1',
          url: f.url,
          image: /^data:image\//i.test(f.image) ? f.image : f.image,
          title: f.title || hostOf(f.url) || '推广',
          desc: f.desc || ''
        };
        if (/^data:image\//i.test(f.image)) {
          var pm = /^data:(image\/[a-z0-9+.-]+);base64,(.*)$/i.exec(f.image);
          if (pm) {
            var pext = pm[1].split('/')[1].replace('jpeg', 'jpg');
            popAd.image = 'assets/ads/popup-1.' + pext;
            files.push({ path: popAd.image, content: pm[2] });
          }
        }
        var nh2 = replacePopup(page.html, buildPopup(popAd));
        files.push({ path: FILE, content: b64encode(nh2) });
        return commitFiles(files, '发布弹窗广告：' + popAd.title);
      }

      if (String(f.slot).indexOf('float-') === 0) {
        var idxNum = parseInt(String(f.slot).split('-')[1], 10) || 1;
        var floats = parseFloats(page.html);
        var label = f.title || '去看看';
        var fl = buildFloater(label, f.url, idxNum);
        if (floats[idxNum - 1]) floats[idxNum - 1] = fl;
        else floats.push(fl);
        floats = floats.slice(0, 3);
        var nh = replaceFloats(page.html, floats);
        return commitFiles([{ path: FILE, content: b64encode(nh) }], '发布悬浮按钮：' + label);
      }

      var blocks = parseBlocks(page.html);
      var replaceIndex = -1;

      if (f.slot === 'last') {
        if (blocks.length >= MAX_SLOTS) throw new Error('最多 ' + MAX_SLOTS + ' 条，先下线一条。');
      } else {
        replaceIndex = parseInt(f.slot, 10) - 1;
        if (blocks[replaceIndex]) id = blocks[replaceIndex].id;
      }
      if (!id) id = 'ad-' + (blocks.length + 1) + '-' + Date.now().toString(36).slice(-4);

      // 本地上传的图存成仓库文件，不塞进 HTML
      if (/^data:image\//i.test(f.image)) {
        var m = /^data:(image\/[a-z0-9+.-]+);base64,(.*)$/i.exec(f.image);
        if (!m) throw new Error('图片解析失败，换一张试试。');
        var ext = m[1].split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
        imagePath = 'assets/ads/' + id + '.' + ext;
        files.push({ path: imagePath, content: m[2] });
      }

      var ad = {
        id: id,
        url: f.url,
        image: imagePath,
        title: f.title,
        desc: f.desc,
        tag: f.tag || ('位置 0' + (f.slot === 'last' ? blocks.length + 1 : f.slot)),
        cover: f.cover
      };

      var card = { id: id, raw: buildCard(ad) };
      if (replaceIndex >= 0) blocks[replaceIndex] = card;
      else blocks.push(card);

      var next = replaceRegion(page.html, blocks);
      files.push({ path: FILE, content: b64encode(next) });

      return commitFiles(files, '发布广告：' + (ad.title || hostOf(ad.url) || id));
    }).then(function () {
      status('ok', '已提交，一两分钟更新。<a href="./" target="_blank" rel="noopener">打开首页看看</a>');
      return refreshList();
    }).catch(function (err) {
      status('err', errText(err));
    }).then(function () {
      if (els.publishBtn) els.publishBtn.disabled = false;
    });
  }

  function remove(id) {
    if (!window.confirm('确定下线 ' + id + '？')) return;
    status('busy', '正在下线…');
    loadPage().then(function (page) {
      var blocks = parseBlocks(page.html).filter(function (b) { return b.id !== id; });
      var next = replaceRegion(page.html, blocks);
      return commitFiles([{ path: FILE, content: b64encode(next) }], '下线广告：' + id);
    }).then(function () {
      status('ok', '已下线，一两分钟后生效。');
      return refreshList();
    }).catch(function (err) {
      status('err', errText(err));
    });
  }

  function removeFloat(idx) {
    if (!window.confirm('确定下线这个悬浮按钮？')) return;
    status('busy', '正在下线…');
    loadPage().then(function (page) {
      var floats = parseFloats(page.html);
      floats.splice(idx - 1, 1);
      var nh = replaceFloats(page.html, floats);
      return commitFiles([{ path: FILE, content: b64encode(nh) }], '下线悬浮按钮');
    }).then(function () {
      status('ok', '已下线。');
      return refreshList();
    }).catch(function (err) {
      status('err', errText(err));
    });
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

  function renderFloats(floats) {
    if (!els.list || !floats.length) return;
    floats.forEach(function (raw, i) {
      var m = /<span class="floater-text">([\s\S]*?)<\/span>/.exec(raw);
      var label = m ? unesc(m[1]) : ('悬浮按钮 ' + (i + 1));
      var li = document.createElement('li');
      li.innerHTML = '<span class="slot-no">浮</span>' +
        '<span class="ad-title">' + esc(label) + '</span>' +
        '<button class="link-btn" type="button" data-del-float="' + (i + 1) + '">下线</button>';
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
      renderFloats(parseFloats(page.html));
    }).catch(function () {
      if (els.list) els.list.innerHTML = '<li class="empty">读取失败，检查 token。</li>';
      if (els.count) els.count.textContent = '—';
    });
  }

  /* ---------- 绑定 ---------- */

  function tokenUI() {
    var has = !!getToken();
    if (els.tokenState) {
      els.tokenState.textContent = has ? '已绑定，发布时会用它提交。' : '还没绑定，点「保存」前先把 token 粘进来。';
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
        status('err', '这不像 GitHub token，通常以 ghp_ 或 github_pat_ 开头。去 <a href="https://github.com/settings/tokens/new?scopes=repo&amp;description=ads-portal" target="_blank" rel="noopener">这里</a> 生成，勾 repo。');
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
        status('err', errText(err));
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
        var msg = '广告投放\n落地页：' + f.url + '\n展示图：' + (f.image ? (imgState.data ? '本地上传（我发图给你）' : f.image) : '无') + '\n位置：' + (f.slot === 'last' ? '最后' : ('第 ' + f.slot + ' 位'));
        status('err', '还没绑定 token。要么粘一个 classic token（勾 repo）保存自己发，要么<a href="https://t.me/tg7879?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">把这条广告发给 @tg7879 代发</a>。');
        return;
      }
      publish(f);
    });

    var previewBtn = $('[data-preview]');
    previewBtn && previewBtn.addEventListener('click', function () {
      var f = readForm();
      var bad = validate(f);
      if (bad) { status('err', bad); return; }
      els.output.textContent = buildCard({
        id: 'preview', url: f.url, image: f.image,
        title: f.title, desc: f.desc,
        tag: f.tag || '广告位', cover: f.cover
      });
      status('busy', '代码已生成，可复制交给维护的人。');
    });

    els.list && els.list.addEventListener('click', function (e) {
      var delFloat = e.target.closest('[data-del-float]');
      if (delFloat) { removeFloat(parseInt(delFloat.getAttribute('data-del-float'), 10)); return; }
      var btn = e.target.closest('[data-del]');
      if (!btn) return;
      remove(btn.getAttribute('data-del'));
    });

    /* 展示图 */

    var fileInput = $('#adImageFile');
    var imgPreview = $('[data-image-preview]');
    var imgStateEl = $('[data-image-state]');
    var imgClear = $('[data-image-clear]');
    var imgUrl = $('#adImage');
    var dropZone = $('[data-drop-zone]');

    var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    function showImage(src, note) {
      imgState.data = src || '';
      if (imgPreview) {
        if (src) { imgPreview.src = src; imgPreview.hidden = false; }
        else { imgPreview.hidden = true; imgPreview.src = BLANK_IMG; }
      }
      if (imgClear) imgClear.hidden = !src;
      if (imgStateEl) imgStateEl.textContent = note || (src ? '已选图' : '没选图片就用色块占位');
    }

    function useFile(file) {
      if (!file) return;
      if (!/^image\//.test(file.type)) { status('err', '这个文件不是图片。'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var maxW = 960;
          var scale = Math.min(1, maxW / img.width);
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#f6f4ef';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          var data = canvas.toDataURL('image/jpeg', 0.8);
          var kb = Math.round(data.length * 0.75 / 1024);
          showImage(data, '已选图 ' + w + '×' + h + '，约 ' + kb + ' KB');
          if (imgUrl) imgUrl.value = '';
          status('', '');
        };
        img.onerror = function () { status('err', '这张图读不出来，换一张试试。'); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

    fileInput && fileInput.addEventListener('change', function () {
      useFile(fileInput.files && fileInput.files[0]);
    });

    // 拖拽图片
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        dropZone.addEventListener(ev, function (e) {
          e.preventDefault();
          dropZone.classList.add('is-drag');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dropZone.addEventListener(ev, function (e) {
          e.preventDefault();
          dropZone.classList.remove('is-drag');
        });
      });
      dropZone.addEventListener('drop', function (e) {
        var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) useFile(file);
      });
    }

    // 直接 Ctrl+V 粘图片
    document.addEventListener('paste', function (e) {
      if (!document.querySelector('[data-publish]')) return;
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var k = 0; k < items.length; k++) {
        if (items[k].type && items[k].type.indexOf('image/') === 0) {
          useFile(items[k].getAsFile());
          e.preventDefault();
          return;
        }
      }
    });

    imgClear && imgClear.addEventListener('click', function () {
      if (fileInput) fileInput.value = '';
      if (imgUrl) imgUrl.value = '';
      showImage('');
    });

    // 粘图片地址后先试加载，能加载才算数
    var probeTimer = null;
    imgUrl && imgUrl.addEventListener('input', function () {
      if (imgState.data) showImage('');
      var raw = imgUrl.value.trim();
      if (probeTimer) clearTimeout(probeTimer);
      if (!raw) { if (imgStateEl) imgStateEl.textContent = '没选图片就用色块占位'; return; }
      var url = normalizeImage(raw);
      if (!/^https?:\/\//i.test(url)) { if (imgStateEl) imgStateEl.textContent = '这个地址不是 http(s) 图片。'; return; }
      if (imgStateEl) imgStateEl.textContent = '正在检查图片…';
      probeTimer = setTimeout(function () {
        probeImage(url).then(function (ok) {
          if (ok) {
            showImage('', '图片可以加载，发布时会直接用这个地址');
            if (imgPreview) { imgPreview.src = url; imgPreview.hidden = false; }
            if (imgStateEl) imgStateEl.textContent = '图片可以加载，发布时直接用这个地址';
          } else {
            if (imgStateEl) imgStateEl.textContent = '这个地址打不开或者不是图片，建议「从电脑选图」';
            if (imgPreview) { imgPreview.hidden = true; }
          }
        });
      }, 500);
    });

    // 初始化时给预览图一个占位 src，避免隐藏的空 src 图片
    showImage('');

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
    form && form.addEventListener('reset', function () {
      window.setTimeout(function () {
        if (fileInput) fileInput.value = '';
        if (imgUrl) imgUrl.value = '';
        showImage('');
      }, 0);
    });

    refreshList();
  }

  document.addEventListener('DOMContentLoaded', bindAll);
})();
