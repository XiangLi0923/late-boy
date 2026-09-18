#ifndef PERLER_COLORSPACE_H
#define PERLER_COLORSPACE_H

#include "types.h"

namespace perler {
namespace colorspace {

// ============================================================================
// sRGB ↔ Linear RGB
// ============================================================================

/// Convert sRGB component (0-255) to linear RGB (0.0-1.0)
/// Uses the sRGB piecewise transfer function (IEC 61966-2-1:1999)
double srgb_to_linear(uint8_t c);

/// Convert linear RGB component (0.0-1.0) to sRGB (0-255)
/// Uses the sRGB piecewise transfer function, clamps output to [0,255]
uint8_t linear_to_srgb(double c);

/// Convert 8-bit sRGB pixel to linear RGB
LinearRGB rgb_to_linear_rgb(const RGB& rgb);

/// Convert linear RGB to 8-bit sRGB
RGB linear_rgb_to_rgb(const LinearRGB& lrgb);

// ============================================================================
// Linear RGB ↔ CIE XYZ (D65 reference white, 2° standard observer)
// ============================================================================

/// Linear sRGB → CIE XYZ D65
/// Matrix from IEC 61966-2-1:1999 / sRGB standard
XYZ linear_rgb_to_xyz(const LinearRGB& lrgb);

/// CIE XYZ D65 → Linear sRGB
LinearRGB xyz_to_linear_rgb(const XYZ& xyz);

// ============================================================================
// CIE XYZ ↔ CIELAB (D65, 2° observer)
// ============================================================================

/// CIE XYZ D65 → CIELAB L*a*b*
/// Reference white: D65 illuminant (Xn=95.047, Yn=100.000, Zn=108.883)
LAB xyz_to_lab(const XYZ& xyz);

/// CIELAB L*a*b* → CIE XYZ D65
XYZ lab_to_xyz(const LAB& lab);

// ============================================================================
// Convenience: Full conversion chains
// ============================================================================

/// 8-bit sRGB → CIELAB D65 (single call)
LAB rgb_to_lab(const RGB& rgb);

/// CIELAB D65 → 8-bit sRGB (single call, clamps gamut)
RGB lab_to_rgb(const LAB& lab);

/// 8-bit sRGB → CIELAB D65 for an entire palette (precompute for fast matching)
void precompute_palette_lab(std::vector<BeadColor>& colors);

} // namespace colorspace
} // namespace perler

#endif // PERLER_COLORSPACE_H
