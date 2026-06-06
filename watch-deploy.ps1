$src = "C:\Users\fring\fm-docker\src"
$root = "C:\Users\fring\fm-docker"

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $src
$watcher.IncludeSubdirectories = $true
$watcher.Filter = "*.js"
$watcher.EnableRaisingEvents = $true

$watcher2 = New-Object System.IO.FileSystemWatcher
$watcher2.Path = $root
$watcher2.Filter = "Dockerfile"
$watcher2.EnableRaisingEvents = $true

$global:lastBuild = 0

$handler = {
    $now = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    if ($now - $global:lastBuild -lt 3000) { return }
    $global:lastBuild = $now
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] Change detected, rebuilding..."
    Set-Location "C:\Users\fring\fm-docker"
    docker compose up -d --build 2>&1 | Write-Host
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] Done."
}

Register-ObjectEvent $watcher "Changed" -Action $handler | Out-Null
Register-ObjectEvent $watcher "Created" -Action $handler | Out-Null
Register-ObjectEvent $watcher "Deleted" -Action $handler | Out-Null
Register-ObjectEvent $watcher "Renamed" -Action $handler | Out-Null
Register-ObjectEvent $watcher2 "Changed" -Action $handler | Out-Null

Write-Host "Watching for changes in src/ and Dockerfile... (Ctrl+C to stop)"
while ($true) { Start-Sleep -Seconds 1 }
