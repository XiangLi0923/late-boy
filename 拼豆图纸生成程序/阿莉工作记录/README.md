# 阿莉的图 (Perler Bead Blueprint Generator)

跨平台拼豆图纸生成系统——将任意图片转换为拼豆/拼豆图纸。

## 架构

三层架构：
- **底层**：纯 C++17 引擎库，零 UI 依赖，编译为静态库 / WASM / 精简 WASM / CLI 四目标
- **胶水层**：Emscripten JS 绑定（Web/小程序）、Node.js 原生模块（Electron）、静态链接（CLI）
- **前端**：React Web（Vite+PWA）、微信小程序、Electron 桌面、命令行

## 快速开始

### 依赖安装

```bash
# 下载第三方头文件
bash build-scripts/setup-deps.sh

# 或手动放置：
# - engine/vendor/stb_image.h (from https://github.com/nothings/stb)
# - engine/vendor/stb_image_write.h
# - engine/vendor/json.hpp (from https://github.com/nlohmann/json/releases)
```

### 编译 CLI

```bash
mkdir build && cd build
cmake ../engine -DPERLER_BUILD_CLI=ON
cmake --build . --target perler_cli

# 运行
./perler_cli photo.jpg --palette hama_midi --grid 50x50 --dither floyd --format png
```

### 运行诊断

```bash
./perler_cli --diagnose --palettes-dir ../engine/palettes/
```

### 构建 WASM（需 Emscripten）

```bash
bash build-scripts/build-wasm.sh        # 标准 WASM（Web/Electron）
bash build-scripts/build-miniapp-wasm.sh # 精简 WASM（小程序，<500KB）
```

### 构建 Web 前端

```bash
cd frontends/web
npm install
npm run dev    # 开发模式
npm run build  # 生产构建
```

### 构建 Electron 桌面

```bash
cd frontends/desktop
npm install
npm start      # 开发模式
npm run build  # 打包安装包
```

### 同步小程序色卡

小程序色卡由 `engine/palettes/*.json` 生成，改了色卡后运行：

```bash
node scripts/build_miniapp_palette.js
```

### 全平台验证

```bash
bash build-scripts/validate-build.sh
```

## 项目结构

```
├── engine/                  # C++17 核心引擎
│   ├── src/                 # 引擎源码
│   │   ├── types.h          # 核心数据类型
│   │   ├── colorspace.*     # sRGB↔CIELAB D65 色彩空间转换
│   │   ├── delta_e.*        # CIE76 ΔE 色差计算
│   │   ├── preprocessing.*  # 裁剪/亮度-对比度/高斯模糊
│   │   ├── pixelation.*     # 盒采样降采样像素化
│   │   ├── quantization.*   # 颜色量化引擎
│   │   ├── dither.*         # 抖动算法（无/Floyd-Steinberg/Bayer 8×8）
│   │   ├── palette.*        # 调色板 JSON 加载管理
│   │   ├── export_*.*       # 多格式导出（PNG/PDF/CSV/JSON）
│   │   ├── diagnostics.*    # 10 项自检诊断
│   │   ├── auto_repair.*    # 自动修复机制
│   │   ├── plugin_loader.*  # JSON Manifest + LuaJIT 插件热加载
│   │   ├── bindings.cpp     # Emscripten JS 绑定
│   │   └── perler_engine.h  # 公共 C API
│   ├── palettes/            # 内置调色板 JSON
│   ├── vendor/              # 第三方头文件（stb_image, nlohmann/json）
│   └── CMakeLists.txt       # 主构建文件（4 目标）
├── frontends/               # 前端应用
│   ├── web/                 # React + Vite + PWA
│   ├── miniapp/             # 微信小程序（游客模式）
│   ├── desktop/             # Electron 桌面
│   └── cli/                 # 命令行入口
├── shared/                  # 共享 TypeScript 类型定义
├── build-scripts/           # 构建自动化脚本
└── tests/                   # 测试套件
```

## 内置调色板

| 品牌 | 文件 | 颜色数 |
|------|------|--------|
| Mard 291 | `mard_all.json` | 291 |
| Mard 221（零售常用） | `mard_221.json` | 221 |
| Universal 24 | `universal_24.json` | 24 |
| Hama Midi | `hama_midi.json` | 57 |
| Perler Standard | `perler_standard.json` | 55 |

## 插件系统

在 `engine/plugins/` 目录下创建文件夹，包含 `manifest.json`：

```json
{
  "name": "my-palette",
  "version": "1.0.0",
  "type": "palette_source",
  "description": "自定义色板",
  "author": "your-name"
}
```

支持的插件类型：`palette_source`, `board_shape`, `dither_algo`, `export_format`, `image_filter`

## 诊断系统

运行 `--diagnose` 执行以下检查：
1. 调色板 JSON 可解析
2. Hex 颜色码格式合法
3. 无重复颜色名称/编号
4. 最少 10 色
5. ΔE 色彩覆盖度（10000 随机采样）
6. 预设测试图片管线验证
7. PNG 导出完整性（真实导出并校验 magic bytes）
8. PDF 导出完整性（真实导出并校验 %PDF header）
9. CSV 往返一致性（真实导出并校验文件结构）

> ΔE 覆盖度是质量指标而非阻断项：小色卡（24 色）或过渡色不足的色卡
> 可能报 FAIL，这是正常现象。

自动修复：JSON 语法、hex 格式、重复名字、导出路径权限

## 线上分享

- **分享码/二维码**：二维码直接编码压缩后的完整图纸数据，扫码后可还原项目；
  数据过大时会提示改用分享链接或离线查看器。
- **深链接**：网页版支持 `?share=<code>` 和 `#share=<code>`，打开链接自动导入图纸。
- **项目导入**：顶部「导入项目」可读取网页版或 CLI 导出的 JSON
  （支持 `width/height/grid/color_table` 规格格式及旧版 `grid_width/grid_height/grid_indices`）。
- **离线查看器**：保存为单个 HTML，无服务器即可打开；
  中文色名、HTML 特殊字符均已安全处理。

## 微信小程序发布清单

1. 在 `frontends/miniapp/project.config.json` 中把 `appid` 从
   `touristappid` 替换为正式小程序 AppID。
2. 在微信公众平台补充「用户隐私保护指引」：图片读取、相册写入用途。
3. 如需使用 `wx.saveImageToPhotosAlbum`，发布前确认隐私弹窗与授权文案。
4. `frontends/miniapp/sitemap.json` 已允许首页收录；如不希望被搜索可改为 `disallow`。
5. 小程序色卡已内置 Mard 291 色，算法与网页/桌面/C++ 引擎统一为 CIELAB ΔE。
6. 使用微信开发者工具「上传」前先跑一遍预览和真机测试。

## 技术栈

- **引擎**: C++17, stb_image, nlohmann/json, libharu (PDF), LuaJIT (插件)
- **Web**: React 18, TypeScript, Vite, Zustand, Service Worker, Comlink
- **桌面**: Electron, contextBridge, native file dialogs
- **小程序**: WeChat Mini Program, WXML/WXSS, Canvas 2D, subcontract WASM
- **构建**: CMake, Emscripten, Shell scripts

## License

MIT
