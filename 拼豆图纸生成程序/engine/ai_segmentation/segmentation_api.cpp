#include "segmentation_api.h"

SegmentationStatus run_segmentation(
    const uint8_t* rgba,
    int width,
    int height,
    float foreground_confidence_threshold,
    int edge_feather_radius,
    int mask_expand_offset,
    SegmentationResult& result) {
    (void)rgba;
    (void)width;
    (void)height;
    (void)foreground_confidence_threshold;
    (void)edge_feather_radius;
    (void)mask_expand_offset;
    result = {};

    // The native provider is intentionally a clean boundary. The actual
    // ONNX/rembg/SAM-tiny model runner should be linked here by the platform
    // build when a local model is available.
    return SegmentationStatus::MODEL_NOT_READY;
}

void free_segmentation_result(SegmentationResult* result) {
    if (!result) return;
    // Ownership policy matches the model runner that produced the buffers.
    result->rgba = nullptr;
    result->mask = nullptr;
}
