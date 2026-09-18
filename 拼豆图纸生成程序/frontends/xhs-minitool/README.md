# 阿莉的图 · 小红书小工具

这是面向小红书小工具容器的离线 H5 版本。入口为一个可上传的 `.zip`，不依赖网络、WASM、Worker 或外部 CDN。

## 已恢复功能

- 色卡：Mard 221、Mard 291、Universal 24、Hama Midi、Perler Standard
- 色板：当前色卡品牌、颜色总数和前 12 个色块预览
- 抖动模式：无抖动、Floyd-Steinberg、Bayer 8x8
- 图像调整：亮度、对比度、高斯模糊、边缘增强、自动对比度、相似色合并
- 主体分割：纯 JS 边缘背景连通算法，支持置信阈值、边缘羽化、蒙版膨胀/收缩
- 网格尺寸：29x29、50x50、58x58、100x100，以及手动宽高
- 图纸预览：缩放、色号显示、水平镜像、颜色用量
- 保存：通过 `window.xhs.miniTool` 保存到系统相册

## 平台限制

小红书小工具是纯本地离线 H5 容器，明确禁用网络请求、WebAssembly 和 Web Worker。因此网页版和桌面版的 ONNX / WASM 高性能 AI 抠图不能原样运行。本版本使用项目原有的纯 JS 主体分割兜底算法，界面和操作流程保留，复杂背景下的分割精度会低于桌面版 AI 模型。

`index.html` 中的脚本使用经典 `<script src>` 加载，JavaScript 保持在 ES2017 范围，CSS 以 Chrome 61 可用布局为基线。

## 构建

在项目根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\frontends\xhs-minitool\scripts\build.ps1
```

构建脚本会：

1. 从 `frontends/miniapp/pages/index/paletteData.js` 生成小工具专用色卡脚本；
2. 把 `src/` 复制到 `dist/`；
3. 校验 `index.html` 位于 `dist` 根目录；
4. 通过 `Compress-Archive` 创建 `release/perler-xhs-minitool-1.0.0-20260918.zip`；
5. 若目标压缩包已存在则停止，不覆盖已有产物。

## 自检

构建后使用小红书官方 Skill 的审计脚本：

```powershell
node .\.codex\skills\minitool-zip-builder\scripts\audit_artifact.mjs .\frontends\xhs-minitool\dist
node .\.codex\skills\minitool-zip-builder\scripts\audit_artifact.mjs .\frontends\xhs-minitool\release\perler-xhs-minitool-1.0.0-20260918.zip
```

审计结果与人工核对结论见 `release/校验摘要.md`。
