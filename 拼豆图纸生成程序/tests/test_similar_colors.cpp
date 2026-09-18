#include "test_utils.h"
#include "types.h"
#include "colorspace.h"
#include "similar_colors.h"
#include "background_removal.h"

namespace perler {

TEST(merge_similar_colors_replaces_close_color) {
    Palette pal;
    pal.brand = "Test";
    BeadColor c1("Gray", "G01", "#646464");
    BeadColor c2("Light Gray", "G02", "#686868");
    c1.rgb = RGB(100, 100, 100);
    c2.rgb = RGB(104, 104, 104);
    c1.lab = colorspace::rgb_to_lab(c1.rgb);
    c2.lab = colorspace::rgb_to_lab(c2.rgb);
    pal.colors = {c1, c2};

    BeadGrid grid(2, 1);
    grid.indices = {0, 1};
    grid.color_counts = {1, 1};
    grid.palette_hex = {"#646464", "#686868"};
    grid.palette_names = {"Gray", "Light Gray"};
    grid.palette_codes = {"G01", "G02"};

    merge_similar_grid_colors(grid, pal, 6.0);
    ASSERT_EQ(grid.indices[1], 0);
    ASSERT_EQ(grid.color_counts[0], 2);
    ASSERT_EQ(grid.color_counts[1], 0);
}

TEST(remove_background_clears_border_cells) {
    ImageData img(3, 3);
    for (int y = 0; y < 3; ++y) {
        for (int x = 0; x < 3; ++x) {
            uint8_t* p = img.at(x, y);
            if (x == 1 && y == 1) {
                p[0] = 220; p[1] = 30; p[2] = 30; p[3] = 255;
            } else {
                p[0] = 200; p[1] = 200; p[2] = 200; p[3] = 255;
            }
        }
    }

    BeadGrid grid(3, 3);
    grid.indices = {0, 1, 0, 1, 1, 1, 0, 1, 0};
    grid.color_counts = {4, 5};
    grid.palette_hex = {"#C8C8C8", "#DC1E1E"};
    grid.palette_names = {"Gray", "Red"};
    grid.palette_codes = {"G01", "R01"};

    apply_background_mask(grid, img, 28);
    ASSERT_EQ(grid.at(1, 1), 1);
    ASSERT_EQ(grid.at(0, 0), -1);
    ASSERT_EQ(grid.at(2, 2), -1);
}

} // namespace perler
