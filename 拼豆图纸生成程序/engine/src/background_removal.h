#pragma once

#include "types.h"

namespace perler {

/// Remove edge-connected background by flood fill from the image border.
ImageData remove_background(const ImageData& src, int threshold = 28);

/// Clear grid cells whose source area is mostly background (transparent).
void apply_background_mask(BeadGrid& grid, const ImageData& src, int threshold = 28);

} // namespace perler
