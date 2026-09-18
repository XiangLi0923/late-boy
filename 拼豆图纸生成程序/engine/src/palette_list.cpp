#include "types.h"
#include "json.hpp"
#include <filesystem>
#include <fstream>
#include <sstream>

namespace perler {

// This function is already defined in palette.cpp.
// palette_list.cpp provides additional list/scan utilities.

std::vector<std::string> scan_palette_directory(const std::string& dir) {
    std::vector<std::string> result;
    try {
        for (const auto& entry : std::filesystem::directory_iterator(dir)) {
            if (entry.path().extension() == ".json") {
                // Verify it's a valid palette
                std::ifstream file(entry.path());
                if (!file.is_open()) continue;

                std::stringstream buffer;
                buffer << file.rdbuf();

                try {
                    auto j = nlohmann::json::parse(buffer.str());
                    if (j.contains("brand") && j.contains("colors") &&
                        j["colors"].is_array() && j["colors"].size() >= 10) {
                        result.push_back(entry.path().stem().string());
                    }
                } catch (...) {
                    continue;
                }
            }
        }
    } catch (...) {}

    return result;
}

} // namespace perler
