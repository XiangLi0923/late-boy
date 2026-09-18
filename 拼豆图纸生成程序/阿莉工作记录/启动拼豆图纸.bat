@echo off
chcp 65001 >nul
title 阿莉的图

echo ============================================
echo         阿莉的图 v1.2
echo ============================================
echo.

cd /d "%~dp0frontends\web"

echo [1/2] 启动开发服务器...
start "" "%~dp0frontends\web\阿莉的图.htm"

echo [2/2] 打开浏览器...
start http://localhost:5173
echo.
echo ✅ 浏览器应该已打开 http://localhost:5173
echo.
echo 按任意键启动服务器...
pause >nul

call npx vite --host 0.0.0.0
