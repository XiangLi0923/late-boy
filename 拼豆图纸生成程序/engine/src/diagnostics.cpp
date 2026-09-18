#include "types.h"
#include "json.hpp"
#include "internal/string_utils.h"
#include "internal/json_utils.h"
#include "colorspace.h"
#include "delta_e.h"
#include <fstream>
#include <sstream>
#include <random>
#include <chrono>
#include <iomanip>
#include <filesystem>
#include <cstring>

namespace perler {

bool do_export_png_main(const BeadGrid& grid, const std::string& path, int dpi);
bool do_export_pdf(const BeadGrid& grid, const std::string& path);
bool do_export_csv(const BeadGrid& grid, const std::string& path);

namespace {

// Get current timestamp in ISO8601 format
std::string now_iso8601() {
    auto now = std::chrono::system_clock::now();
    auto time_t_now = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::gmtime(&time_t_now), "%Y-%m-%dT%H:%M:%SZ");
    return ss.str();
}

// Write a diagnostic entry to diagnostics.log
void write_log(const std::string& module, const std::string& status,
               const std::string& detail) {
    std::ofstream log("diagnostics.log", std::ios::app);
    if (log.is_open()) {
        log << "[" << now_iso8601() << "] " << module << ": "
            << status << " — " << detail << "\n";
    }
}

bool load_json_file_safe(const std::string& path, nlohmann::json& out,
                         std::string& error_msg) {
    std::ifstream file(path);
    if (!file.is_open()) {
        error_msg = "Cannot open file: " + path;
        return false;
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    return internal::parse_json_safe(buffer.str(), out, error_msg);
}

BeadGrid make_test_grid() {
    BeadGrid grid(8, 6);
    grid.palette_brand = "Diagnostic Test";
    grid.palette_hex = {"#FF0000", "#00FF00", "#0000FF", "#FFFFFF"};
    grid.palette_names = {"Red", "Green", "Blue", "White"};
    grid.palette_codes = {"R01", "G01", "B01", "W01"};
    grid.color_counts.assign(4, 0);
    for (size_t i = 0; i < grid.indices.size(); ++i) {
        grid.indices[i] = static_cast<int32_t>(i % 4);
        grid.color_counts[grid.indices[i]]++;
    }
    return grid;
}

// Check 1: Palette JSON parsable
nlohmann::json check_palette_json(const std::string& path) {
    nlohmann::json result;
    result["check"] = "palette_json_parsable";
    result["module"] = "PALETTE_CHECK";

    std::ifstream file(path);
    if (!file.is_open()) {
        result["status"] = "FAIL";
        result["detail"] = "Cannot open file: " + path;
        write_log("PALETTE_CHECK", "FAIL", "Cannot open: " + path);
        return result;
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    std::string content = buffer.str();

    nlohmann::json j;
    std::string error_msg;
    if (internal::parse_json_safe(content, j, error_msg)) {
        result["status"] = "PASS";
        result["detail"] = "JSON parsed successfully";
        write_log("PALETTE_CHECK", "PASS", path + ": JSON valid");
    } else {
        // Try repair
        std::string repaired = internal::repair_json_syntax(content);
        if (!repaired.empty() && internal::parse_json_safe(repaired, j, error_msg)) {
            result["status"] = "REPAIRED";
            result["detail"] = "JSON repaired: " + error_msg;
            write_log("PALETTE_CHECK", "REPAIRED", path + ": JSON syntax fixed");
        } else {
            result["status"] = "FAIL";
            result["detail"] = "JSON unrepairable: " + error_msg;
            write_log("PALETTE_CHECK", "FAIL", path + ": " + error_msg);
        }
    }

    return result;
}

// Check 2: Hex regex valid
nlohmann::json check_hex_valid(const std::string& path) {
    nlohmann::json result;
    result["check"] = "hex_regex_valid";
    result["module"] = "PALETTE_CHECK";

    nlohmann::json j;
    std::string parse_err;
    if (!load_json_file_safe(path, j, parse_err)) {
        result["status"] = "FAIL";
        result["detail"] = "JSON parse failed: " + parse_err;
        write_log("PALETTE_CHECK", "FAIL", path + ": " + parse_err);
        return result;
    }
    if (!j.contains("colors") || !j["colors"].is_array()) {
        result["status"] = "FAIL";
        result["detail"] = "Missing colors array";
        return result;
    }

    int bad_count = 0;
    for (const auto& c : j["colors"]) {
        std::string hex = c.value("hex", "");
        if (!internal::is_valid_hex_color(internal::normalize_hex(hex))) {
            bad_count++;
        }
    }

    if (bad_count == 0) {
        result["status"] = "PASS";
        result["detail"] = "All hex colors valid";
        write_log("PALETTE_CHECK", "PASS", path + ": all hex valid");
    } else {
        result["status"] = "FAIL";
        result["detail"] = std::to_string(bad_count) + " invalid hex colors";
        write_log("PALETTE_CHECK", "FAIL", path + ": " + std::to_string(bad_count) + " invalid");
    }

    return result;
}

// Check 3: No duplicate codes (codes are the identifier; descriptive names may repeat)
nlohmann::json check_duplicates(const std::string& path) {
    nlohmann::json result;
    result["check"] = "no_duplicates";
    result["module"] = "PALETTE_CHECK";

    nlohmann::json j;
    std::string parse_err;
    if (!load_json_file_safe(path, j, parse_err)) {
        result["status"] = "FAIL";
        result["detail"] = "JSON parse failed: " + parse_err;
        write_log("PALETTE_CHECK", "FAIL", path + ": " + parse_err);
        return result;
    }
    if (!j.contains("colors") || !j["colors"].is_array()) {
        result["status"] = "FAIL";
        result["detail"] = "Missing colors array";
        return result;
    }

    std::vector<std::string> codes;
    int dup_codes = 0;

    for (const auto& c : j["colors"]) {
        std::string code = c.value("code", "");
        if (!code.empty() && std::find(codes.begin(), codes.end(), code) != codes.end()) dup_codes++;
        if (!code.empty()) codes.push_back(code);
    }

    if (dup_codes == 0) {
        result["status"] = "PASS";
        result["detail"] = "No duplicate codes";
        write_log("PALETTE_CHECK", "PASS", path + ": no duplicate codes");
    } else {
        result["status"] = "FAIL";
        result["detail"] = std::to_string(dup_codes) + " duplicate codes";
        write_log("PALETTE_CHECK", "FAIL", path + ": duplicates found");
    }

    return result;
}

// Check 4: Min 10 colors
nlohmann::json check_min_colors(const std::string& path) {
    nlohmann::json result;
    result["check"] = "min_colors";
    result["module"] = "PALETTE_CHECK";

    nlohmann::json j;
    std::string parse_err;
    if (!load_json_file_safe(path, j, parse_err)) {
        result["status"] = "FAIL";
        result["detail"] = "JSON parse failed: " + parse_err;
        write_log("PALETTE_CHECK", "FAIL", path + ": " + parse_err);
        return result;
    }
    if (!j.contains("colors") || !j["colors"].is_array()) {
        result["status"] = "FAIL";
        result["detail"] = "Missing colors array";
        return result;
    }

    int count = j["colors"].size();
    if (count >= 10) {
        result["status"] = "PASS";
        result["detail"] = std::to_string(count) + " colors (≥ 10)";
        write_log("PALETTE_CHECK", "PASS", path + ": " + std::to_string(count) + " colors");
    } else {
        result["status"] = "FAIL";
        result["detail"] = "Only " + std::to_string(count) + " colors (< 10 minimum)";
        write_log("PALETTE_CHECK", "FAIL", path + ": only " + std::to_string(count) + " colors");
    }

    return result;
}

// Check 5: Delta-E coverage with 10000 random sRGB samples
nlohmann::json check_delta_e_coverage(const std::string& path) {
    nlohmann::json result;
    result["check"] = "delta_e_coverage";
    result["module"] = "COLOR_COVERAGE";

    // Load palette
    nlohmann::json j;
    std::string parse_err;
    if (!load_json_file_safe(path, j, parse_err)) {
        result["status"] = "FAIL";
        result["detail"] = "JSON parse failed: " + parse_err;
        write_log("COLOR_COVERAGE", "FAIL", path + ": " + parse_err);
        return result;
    }
    if (!j.contains("colors") || !j["colors"].is_array()) {
        result["status"] = "FAIL";
        result["detail"] = "Missing colors array";
        return result;
    }

    std::vector<BeadColor> colors;
    for (const auto& c : j["colors"]) {
        BeadColor bc;
        bc.name = c.value("name", "");
        bc.hex = c.value("hex", "");
        internal::parse_hex_to_rgb(internal::normalize_hex(bc.hex), bc.rgb.r, bc.rgb.g, bc.rgb.b);
        bc.lab = colorspace::rgb_to_lab(bc.rgb);
        colors.push_back(bc);
    }

    if (colors.empty()) {
        result["status"] = "FAIL";
        result["detail"] = "No colors in palette";
        return result;
    }

    // Generate 10000 random sRGB colors and compute Delta-E
    std::mt19937 rng(42);  // Fixed seed for reproducibility
    std::uniform_int_distribution<int> dist(0, 255);

    double sum_de = 0.0, max_de = 0.0;

    for (int i = 0; i < 10000; ++i) {
        RGB random_rgb(static_cast<uint8_t>(dist(rng)),
                       static_cast<uint8_t>(dist(rng)),
                       static_cast<uint8_t>(dist(rng)));
        LAB random_lab = colorspace::rgb_to_lab(random_rgb);

        auto match = delta_e::find_nearest_color_with_distance(random_lab, colors);
        sum_de += match.delta_e;
        max_de = std::max(max_de, match.delta_e);
    }

    double avg_de = sum_de / 10000.0;
    result["avg_delta_e"] = avg_de;
    result["max_delta_e"] = max_de;

    if (avg_de < 25.0 && max_de < 80.0) {
        result["status"] = "PASS";
        result["detail"] = "Coverage adequate: avg ΔE=" + std::to_string(avg_de) +
                           ", max ΔE=" + std::to_string(max_de);
    } else {
        result["status"] = "FAIL";
        result["detail"] = "Coverage poor: avg ΔE=" + std::to_string(avg_de) +
                           ", max ΔE=" + std::to_string(max_de);
    }

    write_log("COLOR_COVERAGE", result["status"], result["detail"]);
    return result;
}

// Check: PNG export integrity
nlohmann::json check_png_integrity(const std::string& test_dir) {
    (void)test_dir;
    nlohmann::json result;
    result["check"] = "png_export_integrity";
    result["module"] = "EXPORT_CHECK";

    auto path = (std::filesystem::temp_directory_path() / "perler_diag_test.png").string();
    bool ok = do_export_png_main(make_test_grid(), path, 150);
    if (ok) {
        std::ifstream f(path, std::ios::binary);
        char magic[8] = {};
        f.read(magic, 8);
        ok = f.gcount() == 8 && std::memcmp(magic, "\x89PNG\r\n\x1a\n", 8) == 0;
        std::error_code ec;
        std::filesystem::remove(path, ec);
    }

    result["status"] = ok ? "PASS" : "FAIL";
    result["detail"] = ok ? "PNG export produced a valid \\x89PNG header"
                          : "PNG export failed or produced an invalid header";
    write_log("EXPORT_CHECK", result["status"], result["detail"]);
    return result;
}

// Check: PDF export integrity
nlohmann::json check_pdf_integrity(const std::string& test_dir) {
    (void)test_dir;
    nlohmann::json result;
    result["check"] = "pdf_export_integrity";
    result["module"] = "EXPORT_CHECK";

#ifdef PERLER_MINI_BUILD
    result["status"] = "SKIPPED";
    result["detail"] = "PDF export not available in mini build";
#else
    auto path = (std::filesystem::temp_directory_path() / "perler_diag_test.pdf").string();
    bool ok = do_export_pdf(make_test_grid(), path);
    if (ok) {
        std::ifstream f(path, std::ios::binary);
        char magic[8] = {};
        f.read(magic, 8);
        ok = f.gcount() >= 5 && std::memcmp(magic, "%PDF-", 5) == 0;
        std::error_code ec;
        std::filesystem::remove(path, ec);
    }

    result["status"] = ok ? "PASS" : "FAIL";
    result["detail"] = ok ? "PDF export produced a valid %PDF- header"
                          : "PDF export failed or produced an invalid header";
    write_log("EXPORT_CHECK", result["status"], result["detail"]);
#endif

    return result;
}

// Check: CSV round-trip
nlohmann::json check_csv_roundtrip(const std::string& test_dir) {
    (void)test_dir;
    nlohmann::json result;
    result["check"] = "csv_roundtrip";
    result["module"] = "EXPORT_CHECK";

    auto path = (std::filesystem::temp_directory_path() / "perler_diag_test.csv").string();
    bool ok = do_export_csv(make_test_grid(), path);
    if (ok) {
        std::ifstream f(path);
        std::stringstream ss;
        ss << f.rdbuf();
        std::string content = ss.str();
        ok = content.find("width,height,palette_brand") != std::string::npos &&
             content.find("row,col,color_index") != std::string::npos &&
             content.find("color_index,count") != std::string::npos;
        std::error_code ec;
        std::filesystem::remove(path, ec);
    }

    result["status"] = ok ? "PASS" : "FAIL";
    result["detail"] = ok ? "CSV export produced parseable headers and data"
                          : "CSV export failed or produced an invalid file";
    write_log("EXPORT_CHECK", result["status"], result["detail"]);
    return result;
}

} // anonymous namespace

// ============================================================================
// Public API
// ============================================================================

std::string run_all_diagnostics(const std::string& palettes_dir) {
    nlohmann::json results = nlohmann::json::array();

    std::string dir = palettes_dir.empty() ? "engine/palettes/" : palettes_dir;

    // Find palette JSON files
    std::vector<std::string> palette_files;
    try {
        for (const auto& entry : std::filesystem::directory_iterator(dir)) {
            if (entry.path().extension() == ".json") {
                palette_files.push_back(entry.path().string());
            }
        }
    } catch (...) {
        // Directory not found, skip file-based checks
    }

    // Run checks on each palette
    for (const auto& pf : palette_files) {
        results.push_back(check_palette_json(pf));
        results.push_back(check_hex_valid(pf));
        results.push_back(check_duplicates(pf));
        results.push_back(check_min_colors(pf));
        results.push_back(check_delta_e_coverage(pf));
    }

    // Export integrity checks
    results.push_back(check_png_integrity(dir));
    results.push_back(check_pdf_integrity(dir));
    results.push_back(check_csv_roundtrip(dir));

    return results.dump(2);
}

std::string run_named_check(const std::string& name, const std::string& palettes_dir) {
    std::string dir = palettes_dir.empty() ? "engine/palettes/" : palettes_dir;

    // Find first palette file
    std::string first_palette;
    try {
        for (const auto& entry : std::filesystem::directory_iterator(dir)) {
            if (entry.path().extension() == ".json") {
                first_palette = entry.path().string();
                break;
            }
        }
    } catch (...) {}

    if (name == "palette_json_parsable" && !first_palette.empty())
        return check_palette_json(first_palette).dump();
    if (name == "hex_regex_valid" && !first_palette.empty())
        return check_hex_valid(first_palette).dump();
    if (name == "no_duplicates" && !first_palette.empty())
        return check_duplicates(first_palette).dump();
    if (name == "min_colors" && !first_palette.empty())
        return check_min_colors(first_palette).dump();
    if (name == "delta_e_coverage" && !first_palette.empty())
        return check_delta_e_coverage(first_palette).dump();
    if (name == "png_export_integrity")
        return check_png_integrity(dir).dump();
    if (name == "pdf_export_integrity")
        return check_pdf_integrity(dir).dump();
    if (name == "csv_roundtrip")
        return check_csv_roundtrip(dir).dump();

    nlohmann::json result;
    result["check"] = name;
    result["status"] = "FAIL";
    result["detail"] = "Unknown check name";
    return result.dump();
}

} // namespace perler
