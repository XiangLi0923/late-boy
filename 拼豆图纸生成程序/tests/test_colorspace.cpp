/// Tests for colorspace — sRGB ↔ Linear ↔ XYZ ↔ CIELAB conversions

#include "test_utils.h"
#include "colorspace.h"
#include "types.h"

using namespace perler;
using namespace perler::colorspace;

TEST(srgb_to_linear_component_black) {
    double lin = srgb_to_linear(0);
    ASSERT_NEAR(lin, 0.0, 0.001);
}

TEST(srgb_to_linear_component_white) {
    double lin = srgb_to_linear(255);
    ASSERT_NEAR(lin, 1.0, 0.001);
}

TEST(srgb_to_linear_component_mid_gray) {
    double lin = srgb_to_linear(128);
    ASSERT_TRUE(lin > 0.1 && lin < 0.3);  // ~0.216
}

TEST(linear_to_srgb_component_black) {
    uint8_t srgb = linear_to_srgb(0.0);
    ASSERT_EQ(srgb, 0);
}

TEST(linear_to_srgb_component_white) {
    uint8_t srgb = linear_to_srgb(1.0);
    ASSERT_EQ(srgb, 255);
}

TEST(rgb_to_linear_rgb_roundtrip) {
    RGB original(128, 128, 128);
    LinearRGB lin = rgb_to_linear_rgb(original);
    RGB result = linear_rgb_to_rgb(lin);
    ASSERT_TRUE(std::abs(static_cast<int>(result.r) - 128) <= 1);
    ASSERT_TRUE(std::abs(static_cast<int>(result.g) - 128) <= 1);
    ASSERT_TRUE(std::abs(static_cast<int>(result.b) - 128) <= 1);
}

TEST(xyz_to_lab_white) {
    XYZ d65_white{0.95047, 1.00000, 1.08883};
    LAB result = xyz_to_lab(d65_white);
    ASSERT_NEAR(result.l, 100.0, 0.1);
    ASSERT_NEAR(result.a, 0.0, 0.1);
    ASSERT_NEAR(result.b, 0.0, 0.1);
}

TEST(xyz_to_lab_black) {
    XYZ black(0.0, 0.0, 0.0);
    LAB result = xyz_to_lab(black);
    ASSERT_NEAR(result.l, 0.0, 0.1);
}

TEST(lab_to_xyz_roundtrip) {
    LAB original(50.0, 10.0, -10.0);
    XYZ xyz = lab_to_xyz(original);
    LAB result = xyz_to_lab(xyz);
    ASSERT_NEAR(result.l, original.l, 0.01);
    ASSERT_NEAR(result.a, original.a, 0.01);
    ASSERT_NEAR(result.b, original.b, 0.01);
}

TEST(rgb_to_lab_red) {
    RGB red(255, 0, 0);
    LAB result = rgb_to_lab(red);
    ASSERT_TRUE(result.l > 20.0 && result.l < 80.0);
    ASSERT_TRUE(result.a > 40.0);
}

TEST(rgb_to_lab_green) {
    RGB green(0, 255, 0);
    LAB result = rgb_to_lab(green);
    ASSERT_TRUE(result.a < -40.0);
}

TEST(rgb_to_lab_blue) {
    RGB blue(0, 0, 255);
    LAB result = rgb_to_lab(blue);
    ASSERT_TRUE(result.b < -40.0);
}

TEST(precompute_palette_lab_populates_lab) {
    std::vector<BeadColor> colors;
    BeadColor red("Red", "R01", "#FF0000");
    BeadColor green("Green", "G01", "#00FF00");

    // Parse hex to RGB first (normally done by palette loader)
    red.rgb = RGB(255, 0, 0);
    green.rgb = RGB(0, 255, 0);
    colors.push_back(red);
    colors.push_back(green);

    precompute_palette_lab(colors);

    // Both colors should have non-zero LAB values computed
    ASSERT_TRUE(colors[0].lab.l > 0.0 || colors[0].lab.a != 0.0);
    ASSERT_TRUE(colors[1].lab.l > 0.0 || colors[1].lab.a != 0.0);
}
