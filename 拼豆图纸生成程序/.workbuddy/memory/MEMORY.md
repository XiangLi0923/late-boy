# 项目长期记忆 — 阿莉的图

## 产品概况
- 程序名「阿莉的图」，图片→拼豆图纸转换工具，v1.2.2
- 四端：网页（React+Vite）/ Electron 桌面 / 微信小程序 / CLI
- C++17 引擎：CIELAB ΔE 匹配、Floyd-Steinberg/Bayer 抖动、Mard 291 色卡

## 色卡数据（2026-08-20 修正至 v4.1）
- mard_all.json 曾与官方不符（274/291 色偏差，22 个严重错误）→ 已按三方互证参照全量修正
- 参照：pindou.online / pd.anqstar.com（A–M）+ bitbead.pomodiary.com（P–ZG）
- 改色卡须同步 5 处：web/public/palettes、engine/palettes/mard_all + mard_{24,48,96}、重跑 scripts/build_miniapp_palette.js（注意 engine JSON 带 BOM，脚本已兼容）
- 桌面版安装包发版前必须确认内嵌色卡为最新

## 部署与推广（2026-08-20 建立）
- 网页版公网地址（CloudStudio）：`https://42aba744ece84a7d8d49f750ce783a27.app.workbuddy.link`
- 推广物料在 `推广物料/`：二维码 PNG ×2、海报 PNG、生成脚本 ×2（改 URL/Logo 重跑即可）
- 品牌色：主 #1d3557（深蓝）、强调 #e76f51（暖橙）

## 微信导出守卫（2026-08-20 上线）
- 微信 WebView 拦截 blob: 下载 → `engine/wechatEnv.ts` 检测 MicroMessenger → `WeChatGuard.tsx` 全屏引导「··· → 浏览器打开」
- `saveBlueprint()` 单点拦截所有导出，埋点 `export_blocked_in_wechat`
- 问卷星（`v.wjx.cn/vm/OUyUtdG.aspx`）只在导出真正成功后弹出（`openSurveyOnce`，每设备每日一次）
- 用户期望的完整链路：扫码→引导浏览器→导出图纸→问卷反馈

## 构建注意
- Vite build 清 dist 会被沙箱 safe-delete 拦 → 先 `mv dist dist_old` 再 build
- Python 环境用 managed venv：`C:\Users\lenovo\.workbuddy\binaries\python\envs\default\Scripts\python.exe`（已装 qrcode、pillow、rembg[cpu]）

## 用户偏好
- 要实际工具不要话术（"我需要的不是话术"）
- 沟通用中文
