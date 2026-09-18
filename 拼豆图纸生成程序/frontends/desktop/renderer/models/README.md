# Local Segmentation Models

Put the offline WASM segmentation model files in this directory.

Expected entry module:

```text
models/segmentation_model.js
models/segmentation_model.wasm
```

The `segmentation_model.js` module must export:

```ts
{
  initialize(): Promise<void>;
  segment(input: SegmentationInput): Promise<SegmentationOutput>;
}
```

Until a model is placed here, the application falls back to a border-connected
background removal path so the UI remains testable.
