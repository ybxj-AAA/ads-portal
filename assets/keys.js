/* 投放密钥名单
 *
 * 这里只存密钥的 SHA-256 哈希，明文不落库，别人翻源码也拿不到能用的密钥。
 * 签发新密钥：在仓库根目录执行
 *   powershell -ExecutionPolicy Bypass -File tools/gen-key.ps1 -Plan "3 个月" -Days 90 -Count 1
 * 把输出的那一行 { h: "...", plan: "...", days: N, issued: "YYYY-MM-DD" }, 贴到下面 items 里，
 * 明文密钥单独发给客户，别写回这个文件。
 *
 * days 从 issued 那天开始算，到期后自动失效。长期 = 36500 天（约永久）。
 */
window.ADS_KEYS = {
  algo: 'SHA-256',
  items: [
    { h: '2c0169b019948f3ce1bf32889e7f7e75f2663520634c7b028db0b642d36776b8', plan: '短期 7 天', days: 7, issued: '2026-10-24' },
    { h: '65664dfc2929fe8da7751681f04eddd39348bde844d54857113cada6af62b8f0', plan: '短期 7 天', days: 7, issued: '2026-10-24' },
    { h: 'e7ec3f1f846a01d3e36595796bdbf1825e96676248ffcbd7383f31e38eee593c', plan: '1 个月', days: 30, issued: '2026-10-24' },
    { h: '361dc042b8d114395c1b11dd10d0adb7e0292324d9ebb34dc73630b8b9eb9e2e', plan: '1 个月', days: 30, issued: '2026-10-24' },
    { h: '8ee745ae5f764c19f2ce76676ac7fc57187a4bfdea3ae5549e260f5412c176a0', plan: '1 个月', days: 30, issued: '2026-10-24' },
    { h: 'ec03b80d70272cf0fe84ba1feddb0aa409fc72ff19982a1f687e5c0a82442836', plan: '3 个月', days: 90, issued: '2026-10-24' },
    { h: '62f8e97e4d60345a92c05758202fc836f0ddaae99865d7fc85e23f432d4f95bb', plan: '3 个月', days: 90, issued: '2026-10-24' },
    { h: '80697780ed87684a05fe4597dc7d9ec732f344711ee0106f3f66e11e1ac3759a', plan: '3 个月', days: 90, issued: '2026-10-24' },
    { h: 'a2d8dc4913f4925f62ecb5472759bae1c123ee00cdff7a443e3ee0dfcee122b6', plan: '6 个月', days: 180, issued: '2026-10-24' },
    { h: '8af40897e1f5b0c613de65019fe96439832fd2ca83fae5cc3a25c98d083b3d81', plan: '6 个月', days: 180, issued: '2026-10-24' },
    { h: 'a4e870d3f0fbd4f10ce1c0ac7d95c0e066e47bba7d139a63182c9e8eda9cc0fa', plan: '1 年', days: 365, issued: '2026-10-24' },
    { h: '8a565071716a22ab29eb2ec20f4b3e596c9be3901105b1f4562444710533a947', plan: '1 年', days: 365, issued: '2026-10-24' },
    { h: '74585e6636f890016901539177127acb3588896e10ec8ea99e14aa905913c8c4', plan: '长期', days: 36500, issued: '2026-10-24' },
    { h: 'dc503958cb9782cccef1e5919ae91fc2a53a9568b7e50530fbefbd4d7a6ee6aa', plan: '长期', days: 36500, issued: '2026-10-24' },
    { h: '72d6877282bddf7bef194e50d99e6a70f0e31ee2b96b5d3327a718652ca09ebc', plan: '无限', days: 36500, issued: '2026-10-24' }
  ]
};
