@echo off
title Elysmar Online Server
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
if not exist node_modules (
  echo Installing dependencies...
  call npm install --no-audit --no-fund
)
echo.
echo  Elysmar Online - close this window to stop the server
echo.
node server\server.js
echo.
echo Server stopped.
pause
