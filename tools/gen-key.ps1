param(
  [string]$Plan = '1 个月',
  [int]$Days = 30,
  [string]$Issued = (Get-Date -Format 'yyyy-MM-dd'),
  [int]$Count = 1
)

# 生成本站投放密钥。密钥只在生成时出现一次，站点里只存 SHA-256 哈希。
# 用法： powershell -ExecutionPolicy Bypass -File tools/gen-key.ps1 -Plan "3 个月" -Days 90 -Count 1

$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # 去掉 I O 0 1，避免看错

function New-Key {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $groups = @()
    for ($g = 0; $g -lt 4; $g++) {
      $buf = New-Object byte[] 4
      $rng.GetBytes($buf)
      $block = ''
      foreach ($b in $buf) { $block += $alphabet[[int]($b % $alphabet.Length)] }
      $groups += $block
    }
    return 'ADS-' + ($groups -join '-')
  } finally {
    $rng.Dispose()
  }
}

function Get-KeyHash([string]$text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text.ToUpperInvariant())
    return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

$out = @()
for ($i = 0; $i -lt $Count; $i++) {
  $key = New-Key
  $out += [pscustomobject]@{
    Key    = $key
    Plan   = $Plan
    Days   = $Days
    Issued = $Issued
    Hash   = (Get-KeyHash $key)
  }
}

$out | Format-List

Write-Output '--- 贴进 assets/keys.js 的行（只贴哈希，明文给客户） ---'
foreach ($o in $out) {
  '  {{ h: "{0}", plan: "{1}", days: {2}, issued: "{3}" }},' -f $o.Hash, $o.Plan, $o.Days, $o.Issued
}
