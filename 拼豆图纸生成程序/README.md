# 阿莉的图

将图片转换为拼豆图纸的跨平台工具。核心能力包括 CIELAB ΔE 色彩匹配、
Floyd-Steinberg/Bayer 抖动、Mard 291 色卡、PNG/PDF/CSV/JSON 导出，
以及网页版、Electron 桌面版和微信小程序三个前端。

## 目录

- `engine/`：C++17 核心引擎
- `frontends/web/`：React + Vite 网页版
- `frontends/desktop/`：Electron 桌面版
- `frontends/miniapp/`：微信小程序
- `frontends/desktop/dist/`：当前正式发布产物（Windows 安装包和免安装目录）
- `程序运行/perler-bead-desktop/`：当前可用的免安装版运行目录
- `阿莉工作记录/`：项目说明、工作记录和原始需求
- `build-native/`：C++ 编译产物
- `_废弃_可删除_20260820/`：已确认废弃的旧版本/旧副本，确认无误后可删除

## 打开程序

安装版推荐运行：

```text
frontends\desktop\dist\阿莉的图 Setup 1.2.2.exe
```

安装后会生成桌面和开始菜单快捷方式。

免安装版可直接运行：

```text
程序运行\perler-bead-desktop\阿莉的图.exe
```

## 当前状态

当前版本：v1.2.2。

详细的项目状态、清理记录和后续计划见 `项目状态_20260820.md`。

## 开发命令

```powershell
# 运行网页版
cd frontends\web
npm run dev

# 运行桌面版
cd frontends\desktop
npm start

# 编译 C++ 引擎和 CLI
cmake --build build-native --config Release

# 测试
& build-native\tests\perler_tests.exe

# 生成小程序色卡
node scripts\build_miniapp_palette.js
```

详细说明见 `阿莉工作记录/README.md`。
