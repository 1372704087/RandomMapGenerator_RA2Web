# 启动 cncmaps-ts 的 Web 渲染服务（供主后端 /api/cncmaps-preview 调用）
#
# 为什么要在脚本里设堆：500×500 这种图的全尺寸画布是 29760×14805 ≈ 4.4 亿像素，
# 默认 V8 堆不够，子进程会直接 abort（exit 134 / SIGABRT），前端只看到 502。
# 子进程继承本进程的 NODE_OPTIONS，所以在这里抬到 8G 即可覆盖大图。

param(
  [string]$Port     = '5174',
  [string]$GameDir  = 'F:\Red-Alert-2-Yuris-Revenge',
  [string]$HeapMB   = '8192',
  [string]$RepoRoot = 'G:\cncmaps-ts'
)

$env:CNCMAPS_WEB_PORT = $Port
$env:CNCMAPS_GAME_DIR = $GameDir
$env:NODE_OPTIONS     = "--max-old-space-size=$HeapMB"

Set-Location $RepoRoot
Write-Host "cncmaps Web: port=$Port mix=$GameDir heap=${HeapMB}MB"
node src\web\server.mjs
