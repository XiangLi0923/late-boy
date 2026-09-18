#ifndef PERLER_BAYER_MATRIX_H
#define PERLER_BAYER_MATRIX_H

#include <cstdint>

namespace perler {
namespace internal {

/// Precomputed 8×8 Bayer ordered dithering threshold matrix.
///
/// Values are 0–63 (representing the position in the sequence).
/// During dithering, these are normalized to [0, 1] by dividing by 64.
///
/// The Bayer matrix is recursively defined:
///   M_2n = [ 4*M_n + 0,  4*M_n + 2 ]
///          [ 4*M_n + 3,  4*M_n + 1 ]
///
/// This is the 8×8 instance, computed from the 2×2 base:
///   M_2 = [ 0, 2 ]
///         [ 3, 1 ]
constexpr int BAYER_SIZE = 8;

// Threshold values 0..63, to be normalized to 0..1 by dividing by 64.0
constexpr uint8_t BAYER_8X8[BAYER_SIZE][BAYER_SIZE] = {
    {  0, 32,  8, 40,  2, 34, 10, 42 },
    { 48, 16, 56, 24, 50, 18, 58, 26 },
    { 12, 44,  4, 36, 14, 46,  6, 38 },
    { 60, 28, 52, 20, 62, 30, 54, 22 },
    {  3, 35, 11, 43,  1, 33,  9, 41 },
    { 51, 19, 59, 27, 49, 17, 57, 25 },
    { 15, 47,  7, 39, 13, 45,  5, 37 },
    { 63, 31, 55, 23, 61, 29, 53, 21 }
};

/// Get normalized Bayer threshold for cell (x, y) in range [0, 1)
inline double bayer_threshold(int x, int y) {
    return static_cast<double>(BAYER_8X8[y % BAYER_SIZE][x % BAYER_SIZE]) / 64.0;
}

} // namespace internal
} // namespace perler

#endif // PERLER_BAYER_MATRIX_H
