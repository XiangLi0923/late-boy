#include "types.h"
#include "internal/gaussian_kernel.h"
#include <algorithm>
#include <cmath>
#include <cstring>

namespace perler {

// ============================================================================
// Crop
// ============================================================================

ImageData preprocess_crop(const ImageData& src, int x, int y, int w, int h) {
    // Clamp crop rectangle to image bounds
    int x0 = std::max(0, x);
    int y0 = std::max(0, y);
    int x1 = std::min(src.width, x + w);
    int y1 = std::min(src.height, y + h);

    int crop_w = x1 - x0;
    int crop_h = y1 - y0;

    if (crop_w <= 0 || crop_h <= 0) {
        // Return empty image if invalid crop
        return ImageData();
    }

    ImageData result(crop_w, crop_h);

    for (int row = 0; row < crop_h; ++row) {
        const uint8_t* src_row = src.at(x0, y0 + row);
        uint8_t* dst_row = result.at(0, row);
        std::memcpy(dst_row, src_row, static_cast<size_t>(crop_w) * 4);
    }

    return result;
}

// ============================================================================
// Brightness / Contrast
// ============================================================================

// Brightness: [-1.0, 1.0] mapped to [-128, 128] additive offset
// Contrast:   [0.0, 3.0] where 1.0 = no change
// Formula: new_value = clamp((old - 128) * contrast + 128 + brightness * 128, 0, 255)
// (系数 128 与 JS 模拟器 frontends/web/src/engine/simulator.ts 保持一致)
ImageData preprocess_adjust(const ImageData& src, float brightness, float contrast) {
    ImageData result = src;  // Copy

    // Clamp parameters to valid ranges
    float br = std::max(-1.0f, std::min(1.0f, brightness));
    float ct = std::max(0.0f, std::min(3.0f, contrast));

    float br_offset = br * 128.0f;

    for (int y = 0; y < result.height; ++y) {
        uint8_t* row = result.at(0, y);
        for (int x = 0; x < result.width; ++x) {
            size_t idx = static_cast<size_t>(x) * 4;
            for (int c = 0; c < 3; ++c) {  // RGB only, skip alpha
                float val = (static_cast<float>(row[idx + c]) - 128.0f) * ct
                            + 128.0f + br_offset;
                val = std::max(0.0f, std::min(255.0f, val));
                row[idx + c] = static_cast<uint8_t>(std::round(val));
            }
            // Alpha channel preserved as-is
        }
    }

    return result;
}

// ============================================================================
// Gaussian Blur (separable, mirror-edge padding)
// ============================================================================

ImageData preprocess_blur(const ImageData& src, float sigma) {
    if (sigma <= 0.0f || src.width <= 1 || src.height <= 1) {
        return src;  // No blur needed
    }

    auto kernel = internal::generate_gaussian_kernel(sigma);
    int radius = static_cast<int>(kernel.size()) / 2;

    ImageData temp(src.width, src.height);  // Intermediate buffer
    ImageData result(src.width, src.height);

    // --- Horizontal pass (src → temp) ---
    for (int y = 0; y < src.height; ++y) {
        for (int x = 0; x < src.width; ++x) {
            double sum[3] = {0.0, 0.0, 0.0};

            for (int k = 0; k < static_cast<int>(kernel.size()); ++k) {
                int sx = x + k - radius;
                // Clamp-edge padding (matches JS simulator)
                sx = std::max(0, std::min(src.width - 1, sx));

                const uint8_t* pixel = src.at(sx, y);
                double wk = kernel[k];
                for (int c = 0; c < 3; ++c) {
                    sum[c] += pixel[c] * wk;
                }
            }

            uint8_t* dst = temp.at(x, y);
            for (int c = 0; c < 3; ++c) {
                dst[c] = static_cast<uint8_t>(std::max(0.0, std::min(255.0, std::round(sum[c]))));
            }
            dst[3] = src.at(x, y)[3];  // 只模糊 RGB，alpha 原样保留
        }
    }

    // --- Vertical pass (temp → result) ---
    for (int y = 0; y < src.height; ++y) {
        for (int x = 0; x < src.width; ++x) {
            double sum[3] = {0.0, 0.0, 0.0};

            for (int k = 0; k < static_cast<int>(kernel.size()); ++k) {
                int sy = y + k - radius;
                // Clamp-edge padding (matches JS simulator)
                sy = std::max(0, std::min(src.height - 1, sy));

                const uint8_t* pixel = temp.at(x, sy);
                double wk = kernel[k];
                for (int c = 0; c < 3; ++c) {
                    sum[c] += pixel[c] * wk;
                }
            }

            uint8_t* dst = result.at(x, y);
            for (int c = 0; c < 3; ++c) {
                dst[c] = static_cast<uint8_t>(std::max(0.0, std::min(255.0, std::round(sum[c]))));
            }
            dst[3] = temp.at(x, y)[3];  // 只模糊 RGB，alpha 原样保留
        }
    }

    return result;
}

} // namespace perler
