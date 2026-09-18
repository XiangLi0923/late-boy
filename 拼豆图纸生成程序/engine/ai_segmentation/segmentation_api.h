#ifndef PERLER_AI_SEGMENTATION_API_H
#define PERLER_AI_SEGMENTATION_API_H

#include <cstdint>

enum class SegmentationStatus : int {
  OK = 0,
  MODEL_NOT_READY = 1,
  INVALID_INPUT = 2,
  OOM = 3,
  INTERNAL_ERROR = 4,
};

struct SegmentationResult {
  uint8_t* rgba = nullptr;
  uint8_t* mask = nullptr;
  int width = 0;
  int height = 0;
  float confidence = 0.0f;
  int crop_x = 0;
  int crop_y = 0;
  int crop_width = 0;
  int crop_height = 0;
};

/// Run local semantic segmentation. The real model runner is injected by the
/// platform build; without a bundled model this returns MODEL_NOT_READY.
SegmentationStatus run_segmentation(
    const uint8_t* rgba,
    int width,
    int height,
    float foreground_confidence_threshold,
    int edge_feather_radius,
    int mask_expand_offset,
    SegmentationResult& result);

void free_segmentation_result(SegmentationResult* result);

#endif // PERLER_AI_SEGMENTATION_API_H
