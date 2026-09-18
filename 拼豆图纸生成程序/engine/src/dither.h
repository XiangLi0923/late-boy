#ifndef PERLER_DITHER_H
#define PERLER_DITHER_H

#include "types.h"
#include <vector>

namespace perler {

/// Apply no dithering — simple nearest-neighbor quantization.
/// Each cell's average RGB is matched to the closest palette color via CIE76.
void apply_no_dither(const std::vector<CellSample>& cells, int grid_w, int grid_h,
                     const Palette& palette, BeadGrid& grid);

/// Apply Floyd-Steinberg error diffusion dithering.
/// Errors are distributed to neighboring cells with weights:
///   right: 7/16, bottom-left: 3/16, bottom: 5/16, bottom-right: 1/16
/// Uses an internal floating-point/int buffer for error accumulation.
void apply_floyd_steinberg(const std::vector<CellSample>& cells, int grid_w, int grid_h,
                            const Palette& palette, BeadGrid& grid);

/// Apply 8×8 Bayer ordered dithering.
/// Each channel is dithered independently using the Bayer threshold matrix.
void apply_bayer_8x8(const std::vector<CellSample>& cells, int grid_w, int grid_h,
                      const Palette& palette, BeadGrid& grid);

} // namespace perler

#endif // PERLER_DITHER_H
