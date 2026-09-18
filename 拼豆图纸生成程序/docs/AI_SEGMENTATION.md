# 本地 AI 智能抠图架构

当前已实现两套入口和完整数据流，真正的模型推理核心需要模型文件就位后接入。

## 方案 A：C++17 原生 addon

- 接口：`engine/ai_segmentation/segmentation_api.h`
- 骨架：`frontends/desktop/native/segmentation_addon.cpp`
- 构建：`frontends/desktop/native/binding.gyp`
- Electron IPC：`segment-image`

## 方案 B：TypeScript/WASM 模拟器

- 接口：`frontends/web/src/ai/segmentationTypes.ts`
- WASM 提供者：`wasmSegmentation.ts`
- 原生提供者：`nativeSegmentation.ts`
- 后端选择：`.env` 的 `VITE_SEGMENTATION_BACKEND=wasm|native|auto`

## 模型文件

放入：

```text
frontends/web/public/models/segmentation_model.js
frontends/web/public/models/segmentation_model.wasm
```

模型模块必须导出：

```ts
initialize(): Promise<void>;
segment(input: SegmentationInput): Promise<SegmentationOutput>;
```

## 当前状态

模型未放入时，WASM 提供者会使用边界连通背景去除作为可测试回退。
这不是最终语义分割效果，仅供 UI 联调。
