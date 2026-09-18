#ifndef PERLER_GAUSSIAN_KERNEL_H
#define PERLER_GAUSSIAN_KERNEL_H

#include <vector>
#include <cmath>
#include <algorithm>

namespace perler {
namespace internal {

/// Generate a 1D Gaussian kernel for separable blur operations.
///
/// @param sigma Standard deviation of the Gaussian (typically 0.5–10.0)
/// @return Normalized 1D kernel (sums to 1.0)
///
/// Kernel radius = ceil(3 * sigma), total size = 2 * radius + 1.
/// Values computed as: G(x) = exp(-x² / (2σ²)) / (σ * sqrt(2π))
/// Then normalized so sum = 1.0.
inline std::vector<double> generate_gaussian_kernel(double sigma) {
    if (sigma <= 0.0) {
        // Identity kernel (no blur)
        return { 1.0 };
    }

    int radius = static_cast<int>(std::ceil(3.0 * sigma));
    int size = 2 * radius + 1;

    std::vector<double> kernel(size);
    double sum = 0.0;
    double sigma2 = 2.0 * sigma * sigma;
    double norm = 1.0 / (sigma * std::sqrt(2.0 * 3.14159265358979323846));

    for (int i = 0; i < size; ++i) {
        int x = i - radius;
        kernel[i] = norm * std::exp(-(x * x) / sigma2);
        sum += kernel[i];
    }

    // Normalize so kernel sums to 1.0
    for (auto& v : kernel) {
        v /= sum;
    }

    return kernel;
}

} // namespace internal
} // namespace perler

#endif // PERLER_GAUSSIAN_KERNEL_H
