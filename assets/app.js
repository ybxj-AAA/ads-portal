(function () {
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // 广告点击计数（本地统计，不上报，仅作演示）
  var grid = document.getElementById('adGrid');
  if (grid) {
    grid.addEventListener('click', function (e) {
      var a = e.target.closest('a[href*="go.html"]');
      if (!a) return;
      var card = a.closest('[data-ad-id]');
      if (!card) return;
      try {
        var key = 'adclick:' + card.getAttribute('data-ad-id');
        var n = parseInt(localStorage.getItem(key) || '0', 10) + 1;
        localStorage.setItem(key, String(n));
      } catch (err) { /* 隐私模式下忽略 */ }
    });
  }
})();
