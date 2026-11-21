# Minimal static file server (offline/solo play without Node.js).
# Usage: powershell -ExecutionPolicy Bypass -File tools\static-server.ps1 [-Port 8090]
param([int]$Port = 8090)
$root = Split-Path -Parent $PSScriptRoot
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.glb'='model/gltf-binary'; '.mp3'='audio/mpeg'; '.ogg'='audio/ogg'; '.wav'='audio/wav' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Static server: http://localhost:$Port/  (offline mode only - run 'npm start' for online play)"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq '/') { $path = '/index.html' }
    if ($path.StartsWith('/shared/')) { $file = Join-Path $root $path.TrimStart('/') } else { $file = Join-Path (Join-Path $root 'client') $path.TrimStart('/') }
    $full = [IO.Path]::GetFullPath($file)
    if ($full.StartsWith($root) -and (Test-Path $full -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($full)
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $ctx.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
      $ctx.Response.Headers.Add('Cache-Control', 'no-cache')
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { $ctx.Response.StatusCode = 500 }
  $ctx.Response.Close()
}
