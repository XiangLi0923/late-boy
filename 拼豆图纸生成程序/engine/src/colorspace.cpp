#include "colorspace.h"
#include <cmath>
#include <algorithm>

namespace perler {
namespace colorspace {

// ============================================================================
// sRGB ↔ Linear RGB
// ============================================================================

double srgb_to_linear(uint8_t c) {
    double normalized = c / 255.0;
    if (normalized <= 0.04045) {
        return normalized / 12.92;
    }
    return std::pow((normalized + 0.055) / 1.055, 2.4);
}

uint8_t linear_to_srgb(double c) {
    double result;
    if (c <= 0.0031308) {
        result = 12.92 * c;
    } else {
        result = 1.055 * std::pow(c, 1.0 / 2.4) - 0.055;
    }
    // Clamp to [0, 1] then scale to [0, 255]
    result = std::max(0.0, std::min(1.0, result));
    return static_cast<uint8_t>(std::round(result * 255.0));
}

LinearRGB rgb_to_linear_rgb(const RGB& rgb) {
    return LinearRGB(
        srgb_to_linear(rgb.r),
        srgb_to_linear(rgb.g),
        srgb_to_linear(rgb.b)
    );
}

RGB linear_rgb_to_rgb(const LinearRGB& lrgb) {
    return RGB(
        linear_to_srgb(lrgb.r),
        linear_to_srgb(lrgb.g),
        linear_to_srgb(lrgb.b)
    );
}

// ============================================================================
// Linear RGB ↔ CIE XYZ (D65, 2° observer)
// ============================================================================

// sRGB → XYZ D65 matrix (IEC 61966-2-1:1999)
// |X|   |0.4124564  0.3575761  0.1804375|   |R_linear|
// |Y| = |0.2126729  0.7151522  0.0721750| × |G_linear|
// |Z|   |0.0193339  0.1191920  0.9503041|   |B_linear|
XYZ linear_rgb_to_xyz(const LinearRGB& lrgb) {
    return XYZ(
        0.4124564 * lrgb.r + 0.3575761 * lrgb.g + 0.1804375 * lrgb.b,
        0.2126729 * lrgb.r + 0.7151522 * lrgb.g + 0.0721750 * lrgb.b,
        0.0193339 * lrgb.r + 0.1191920 * lrgb.g + 0.9503041 * lrgb.b
    );
}

// Inverse sRGB → XYZ D65 matrix
// |R_linear|   | 3.2404542  -1.5371385  -0.4985314|   |X|
// |G_linear| = |-0.9692660   1.8760108   0.0415560| × |Y|
// |B_linear|   | 0.0556434  -0.2040259   1.0572252|   |Z|
LinearRGB xyz_to_linear_rgb(const XYZ& xyz) {
    return LinearRGB(
         3.2404542 * xyz.x - 1.5371385 * xyz.y - 0.4985314 * xyz.z,
        -0.9692660 * xyz.x + 1.8760108 * xyz.y + 0.0415560 * xyz.z,
         0.0556434 * xyz.x - 0.2040259 * xyz.y + 1.0572252 * xyz.z
    );
}

// ============================================================================
// CIE XYZ ↔ CIELAB (D65, 2° observer)
// ============================================================================

// D65 reference white (normalized to Yn=1.0, matching the 0–1 XYZ range
// produced by the sRGB → XYZ matrix)
static constexpr double XN = 0.95047;
static constexpr double YN = 1.00000;
static constexpr double ZN = 1.08883;

// CIE standard f(t) function for the nonlinear LAB mapping
static inline double lab_f(double t) {
    constexpr double delta = 6.0 / 29.0;
    constexpr double delta2 = delta * delta;
    constexpr double delta3 = delta2 * delta;
    constexpr double inv_3delta2 = 1.0 / (3.0 * delta2);

    if (t > delta3) {
        return std::cbrt(t);
    }
    return inv_3delta2 * t + (4.0 / 29.0);
}

// Inverse CIE f(t) for LAB → XYZ
static inline double lab_f_inv(double t) {
    constexpr double delta = 6.0 / 29.0;
    constexpr double delta2 = delta * delta;

    if (t > delta) {
        return t * t * t;
    }
    return 3.0 * delta2 * (t - (4.0 / 29.0));
}

LAB xyz_to_lab(const XYZ& xyz) {
    double fx = lab_f(xyz.x / XN);
    double fy = lab_f(xyz.y / YN);
    double fz = lab_f(xyz.z / ZN);

    return LAB(
        116.0 * fy - 16.0,        // L*
        500.0 * (fx - fy),         // a*
        200.0 * (fy - fz)          // b*
    );
}

XYZ lab_to_xyz(const LAB& lab) {
    double l_plus_16_over_116 = (lab.l + 16.0) / 116.0;

    double fy = l_plus_16_over_116;
    double fx = lab.a / 500.0 + fy;
    double fz = fy - lab.b / 200.0;

    return XYZ(
        lab_f_inv(fx) * XN,
        lab_f_inv(fy) * YN,
        lab_f_inv(fz) * ZN
    );
}

// ============================================================================
// Convenience chains
// ============================================================================

LAB rgb_to_lab(const RGB& rgb) {
    LinearRGB lrgb = rgb_to_linear_rgb(rgb);
    XYZ xyz = linear_rgb_to_xyz(lrgb);
    return xyz_to_lab(xyz);
}

RGB lab_to_rgb(const LAB& lab) {
    XYZ xyz = lab_to_xyz(lab);
    LinearRGB lrgb = xyz_to_linear_rgb(xyz);
    return linear_rgb_to_rgb(lrgb);
}

void precompute_palette_lab(std::vector<BeadColor>& colors) {
    for (auto& color : colors) {
        color.lab = rgb_to_lab(color.rgb);
    }
}

} // namespace colorspace
} // namespace perler
