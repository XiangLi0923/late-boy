/// Tests for delta_e — CIE76 color distance and nearest-color matching

#include "test_utils.h"
#include "delta_e.h"
#include "colorspace.h"
#include "types.h"

using namespace perler;
using namespace perler::delta_e;
using namespace perler::colorspace;

TEST(cie76_same_color_zero) {
    LAB white{100.0, 0.0, 0.0};
    double d = cie76(white, white);
    ASSERT_NEAR(d, 0.0, 0.0001);
}

TEST(cie76_black_white_large) {
    LAB black{0.0, 0.0, 0.0};
    LAB white{100.0, 0.0, 0.0};
    double d = cie76(black, white);
    ASSERT_NEAR(d, 100.0, 0.01);
}

TEST(cie76_symmetric) {
    LAB a{54.3, 80.8, 69.9};
    LAB b{87.7, -86.2, 83.2};
    double d1 = cie76(a, b);
    double d2 = cie76(b, a);
    ASSERT_NEAR(d1, d2, 0.0001);
}

TEST(find_nearest_color_exact_match) {
    std::vector<BeadColor> colors;
    BeadColor red("Red", "R01", "#FF0000");
    BeadColor green("Green", "G01", "#00FF00");
    BeadColor blue("Blue", "B01", "#0000FF");

    red.lab = rgb_to_lab(RGB(255, 0, 0));
    green.lab = rgb_to_lab(RGB(0, 255, 0));
    blue.lab = rgb_to_lab(RGB(0, 0, 255));

    colors.push_back(red);
    colors.push_back(green);
    colors.push_back(blue);

    LAB query = rgb_to_lab(RGB(255, 0, 0));
    int idx = find_nearest_color(query, colors);
    ASSERT_EQ(idx, 0);
}

TEST(find_nearest_color_near_white) {
    std::vector<BeadColor> colors;
    BeadColor white("White", "W01", "#FFFFFF");
    BeadColor black("Black", "K01", "#000000");

    white.lab = rgb_to_lab(RGB(255, 255, 255));
    black.lab = rgb_to_lab(RGB(0, 0, 0));

    colors.push_back(white);
    colors.push_back(black);

    LAB query = rgb_to_lab(RGB(250, 250, 250));
    int idx = find_nearest_color(query, colors);
    ASSERT_EQ(idx, 0);
}

TEST(find_nearest_color_with_distance_returns_distance) {
    std::vector<BeadColor> colors;
    BeadColor red("Red", "R01", "#FF0000");
    BeadColor green("Green", "G01", "#00FF00");

    red.lab = rgb_to_lab(RGB(255, 0, 0));
    green.lab = rgb_to_lab(RGB(0, 255, 0));

    colors.push_back(red);
    colors.push_back(green);

    LAB query = rgb_to_lab(RGB(250, 10, 10));
    MatchResult result = find_nearest_color_with_distance(query, colors);

    ASSERT_EQ(result.index, 0);  // Should match red
    ASSERT_TRUE(result.delta_e >= 0.0);
    ASSERT_TRUE(result.delta_e < 10.0);  // Very close to red
}
