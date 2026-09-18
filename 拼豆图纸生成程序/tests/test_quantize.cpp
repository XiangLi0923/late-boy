#include "test_utils.h"
#include "types.h"
#include "colorspace.h"

namespace perler {
BeadGrid quantize_grid(const std::vector<CellSample>& cells, int grid_w, int grid_h,
                       const Palette& palette, DitherMode dither_mode);
}

TEST(floyd_dither_keeps_indices_in_range) {
    perler::Palette pal;
    pal.brand = "Test";
    pal.colors.push_back(perler::BeadColor("Black", "K01", "#000000"));
    pal.colors.push_back(perler::BeadColor("White", "W01", "#FFFFFF"));
    for (auto& c : pal.colors) {
        c.rgb = c.code == "K01" ? perler::RGB(0, 0, 0) : perler::RGB(255, 255, 255);
        c.lab = perler::colorspace::rgb_to_lab(c.rgb);
    }

    std::vector<perler::CellSample> cells(100, perler::CellSample(perler::RGB(255, 255, 255), 1.0f));
    for (size_t i = 0; i < cells.size(); i += 2) cells[i] = perler::CellSample(perler::RGB(0, 0, 0), 1.0f);

    auto grid = perler::quantize_grid(cells, 10, 10, pal, perler::DitherMode::FloydSteinberg);
    ASSERT_TRUE(grid.valid());
    ASSERT_EQ(grid.indices.size(), static_cast<size_t>(100));
    for (const auto idx : grid.indices) {
        ASSERT_TRUE(idx == 0 || idx == 1);
    }
}
