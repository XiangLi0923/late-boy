@echo off
chcp 65001 >nul
title 阿莉的图 - 桌面版
cd /d "%~dp0frontends\desktop"

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron 未安装。请先运行：
  echo   set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
  echo   npm install --registry=https://registry.npmmirror.com
  pause
  exit /b 1
)

start "" "node_modules\electron\dist\electron.exe" .
exit /b 0
