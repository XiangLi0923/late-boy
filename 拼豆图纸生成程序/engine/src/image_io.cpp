#include "image_io.h"

// stb_image implementation - define STB_IMAGE_IMPLEMENTATION in exactly one .cpp
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

// stb_image_write implementation
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

#include <cstring>

namespace perler {
namespace image_io {

static std::string g_last_error;

std::string last_error() {
    return g_last_error;
}

ImageData load_from_file(const std::string& path) {
    int w = 0, h = 0, channels = 0;

    // stbi_load forces RGBA (4 channels)
    unsigned char* data = stbi_load(path.c_str(), &w, &h, &channels, 4);

    if (!data) {
        g_last_error = std::string("Failed to load image: ") + stbi_failure_reason();
        return ImageData();
    }

    ImageData img(w, h);
    size_t total_bytes = static_cast<size_t>(w) * h * 4;
    std::memcpy(img.pixels.data(), data, total_bytes);
    stbi_image_free(data);

    return img;
}

ImageData load_from_memory(const uint8_t* data, size_t len) {
    int w = 0, h = 0, channels = 0;

    unsigned char* pixels = stbi_load_from_memory(
        data, static_cast<int>(len), &w, &h, &channels, 4);

    if (!pixels) {
        g_last_error = std::string("Failed to load image from memory: ") + stbi_failure_reason();
        return ImageData();
    }

    ImageData img(w, h);
    size_t total_bytes = static_cast<size_t>(w) * h * 4;
    std::memcpy(img.pixels.data(), pixels, total_bytes);
    stbi_image_free(pixels);

    return img;
}

bool save_png(const std::string& path, const ImageData& img) {
    return save_png(path, img.width, img.height, img.pixels.data());
}

bool save_png(const std::string& path, int width, int height, const uint8_t* pixels) {
    // stbi_write_png: stride_in_bytes = width * 4 (tightly packed RGBA)
    int result = stbi_write_png(path.c_str(), width, height, 4, pixels, width * 4);

    if (!result) {
        g_last_error = "Failed to write PNG: " + path;
        return false;
    }

    return true;
}

} // namespace image_io
} // namespace perler
