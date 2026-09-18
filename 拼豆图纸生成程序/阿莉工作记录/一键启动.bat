@echo off
chcp 65001 >nul
title 阿莉的图 — 一键启动
cd /d "%~dp0"

echo.
echo   ╔══════════════════════════════════╗
echo   ║     🧩 阿莉的图 v1.2     ║
echo   ╚══════════════════════════════════╝
echo.

:: Check if Node.js is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 Node.js，请先安装 Node.js
    echo    下载地址: https://nodejs.org
    pause
    exit /b 1
)

:: Check if server already running
echo 🔍 检测服务状态...
curl -s -o nul http://localhost:5173/ 2>nul
if %errorlevel% equ 0 (
    echo ✅ 服务已在运行！
    start http://localhost:5173
    echo 📱 浏览器已打开 http://localhost:5173
    pause
    exit /b 0
)

:: Install dependencies if needed
if not exist "frontends\web\node_modules" (
    echo 📦 首次运行，安装依赖中...
    cd frontends\web
    call npm install
    cd ..\..
)

:: Start server + open browser
echo 🚀 启动开发服务器...
echo 📱 即将打开浏览器...
echo.
echo ⚠ 关闭此窗口将停止服务
echo ⚠ 局域网设备可访问: http://192.168.1.7:5173
echo.

:: Open browser after short delay
start "" "frontends\web\阿莉的图.htm"
timeout /t 2 /nobreak >nul
start http://localhost:5173

:: Start vite
cd frontends\web
npx vite --host 0.0.0.0

pause
