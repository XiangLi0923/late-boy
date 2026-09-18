#include "types.h"
#include "colorspace.h"
#include "delta_e.h"
#include "dither.h"

namespace perler {

BeadGrid quantize_grid(const std::vector<CellSample>& cells, int grid_w, int grid_h,
                       const Palette& palette, DitherMode dither_mode) {

    BeadGrid grid(grid_w, grid_h);
    grid.palette_brand = palette.brand;
    grid.dither_mode = dither_mode;
    grid.color_counts.assign(palette.size(), 0);

    // Store palette colors, names, codes for rendering/export
    grid.palette_hex.reserve(palette.size());
    grid.palette_names.reserve(palette.size());
    grid.palette_codes.reserve(palette.size());
    for (size_t i = 0; i < palette.size(); ++i) {
        grid.palette_hex.push_back(palette[i].hex);
        grid.palette_names.push_back(palette[i].name);
        grid.palette_codes.push_back(palette[i].code);
    }

    size_t cell_count = static_cast<size_t>(grid_w) * grid_h;
    if (cells.size() != cell_count) return grid;

    switch (dither_mode) {
        case DitherMode::FloydSteinberg: {
            apply_floyd_steinberg(cells, grid_w, grid_h, palette, grid);
            break;
        }
        case DitherMode::Bayer8x8:
            apply_bayer_8x8(cells, grid_w, grid_h, palette, grid);
            break;
        case DitherMode::None:
        default:
            apply_no_dither(cells, grid_w, grid_h, palette, grid);
            break;
    }

    return grid;
}

} // namespace perler
