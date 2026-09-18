#ifndef PERLER_IMAGE_IO_H
#define PERLER_IMAGE_IO_H

#include "types.h"
#include <cstdint>
#include <string>

namespace perler {
namespace image_io {

/// Load an image from a file path using stb_image.
/// Supported formats: PNG, JPEG, BMP, GIF, TGA, PSD, HDR, PIC, PNM.
/// @param path File path to load
/// @return ImageData with RGBA pixels, or ImageData{0,0} on failure
ImageData load_from_file(const std::string& path);

/// Load an image from in-memory buffer using stb_image.
/// @param data Pointer to raw image file bytes
/// @param len Length of data in bytes
/// @return ImageData with RGBA pixels, or ImageData{0,0} on failure
ImageData load_from_memory(const uint8_t* data, size_t len);

/// Save an RGBA image as PNG. Uses stb_image_write.
/// @param path Output file path
/// @param img Image data to save
/// @return true on success
bool save_png(const std::string& path, const ImageData& img);

/// Save raw RGBA pixel array as PNG.
/// @param path Output file path
/// @param width Image width
/// @param height Image height
/// @param pixels RGBA pixel data (row-major)
/// @return true on success
bool save_png(const std::string& path, int width, int height, const uint8_t* pixels);

/// Get last error message from image I/O operations
std::string last_error();

} // namespace image_io
} // namespace perler

#endif // PERLER_IMAGE_IO_H
