/// Perler Bead Engine — Command Line Interface v1.2.2
///
/// Enhanced with preprocessing, batch mode, and progress feedback.

#include "perler_engine.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <iostream>
#include <fstream>
#include <sstream>
#include <chrono>
#include <iomanip>
#include <algorithm>
#include <filesystem>

// ============================================================================
// Argument parser
// ============================================================================
struct Args {
    std::string input_image;
    std::string input_dir;        // --batch mode: process all images in dir
    std::string output_path = "output.png";
    std::string output_dir = "."; // --batch output dir
    std::string format = "png";
    std::string palette_id = "mard_all";
    std::string palettes_dir = "engine/palettes/";
    int grid_w = 50;
    int grid_h = 50;
    int dither = 0;
    int dpi = 300;
    bool merge_similar = false;
    float merge_threshold = 6.0f;
    bool remove_background = false;
    int bg_threshold = 28;

    // Preprocessing
    float brightness = 0.0f;
    float contrast = 1.0f;
    float blur_sigma = 0.0f;
    int crop_x = 0, crop_y = 0, crop_w = 0, crop_h = 0;

    bool diagnose = false;
    bool help = false;
    bool version = false;
    bool quiet = false;
    bool batch = false;
    std::string png_mode = "both";  // "main", "sub", "both"
};

static void print_help() {
    std::cout << R"(Perler Bead Engine CLI v1.2.2
Usage: perler_cli <input_image> [options]
       perler_cli --batch <directory> [options]

Required (single mode):
  <input_image>              Path to input image (PNG, JPG, BMP)

Options:
  -o, --output <path>        Output file path (default: ./output.png)
  -f, --format <fmt>         Export format: png, pdf, csv, json (default: png)
  -p, --palette <id>         Palette: mard_all, universal_24, hama_midi, perler_standard
      --palettes-dir <path>  Palettes directory (default: engine/palettes/)
  -g, --grid <WxH>           Target bead grid, e.g. "50x50" (default: 50x50)
  -d, --dither <mode>        Dither mode: none, floyd, bayer (default: none)
      --dpi <n>              Output DPI for PNG (default: 300)
      --png-mode <mode>       PNG mode: main(主图), sub(副图), both (default)
      --merge-similar [t]     Merge similar colors (CIELAB ΔE threshold, default 6)
      --remove-background [t] Remove edge-connected background (threshold, default 28)

Preprocessing:
      --brightness <val>     Adjust brightness [-1.0 .. 1.0] (default: 0)
      --contrast <val>       Adjust contrast [0.0 .. 3.0] (default: 1.0)
      --blur <sigma>         Gaussian blur sigma [0 .. 10] (default: 0)
      --crop <X,Y,W,H>       Crop image, e.g. "10,10,200,200"

Batch mode:
      --batch <dir>          Process all images in a directory
      --output-dir <dir>     Output directory for batch (default: ./)

Other:
      --diagnose             Run diagnostic suite on palettes
  -q, --quiet                Suppress progress output
  -v, --version              Print version
  -h, --help                 Print this help

Examples:
  perler_cli photo.jpg -p hama_midi -g 50x50 -d floyd
  perler_cli photo.png -f pdf -o design.pdf
  perler_cli photo.jpg --brightness 0.1 --contrast 1.2 --blur 0.5
  perler_cli --batch ./photos/ -p perler_standard -g 58x58 -f png
  perler_cli --diagnose
)";
}

static void print_version() {
    std::cout << "perler_cli v1.2.2\n"
              << "Perler Bead Engine — Cross-platform bead blueprint generator\n";
}

static bool parse_grid(const std::string& spec, int& w, int& h) {
    size_t x_pos = spec.find('x');
    if (x_pos == std::string::npos) x_pos = spec.find('X');
    if (x_pos == std::string::npos) return false;
    try {
        w = std::stoi(spec.substr(0, x_pos));
        h = std::stoi(spec.substr(x_pos + 1));
        return w > 0 && h > 0 && w <= 500 && h <= 500;
    } catch (...) { return false; }
}

static bool parse_crop(const std::string& spec, int& x, int& y, int& w, int& h) {
    std::stringstream ss(spec);
    std::string item;
    std::vector<int> vals;
    while (std::getline(ss, item, ',')) {
        try { vals.push_back(std::stoi(item)); } catch (...) { return false; }
    }
    if (vals.size() != 4) return false;
    x = vals[0]; y = vals[1]; w = vals[2]; h = vals[3];
    return w > 0 && h > 0;
}

static int parse_int_arg(const std::string& value, int fallback) {
    try { return std::stoi(value); } catch (...) { return fallback; }
}

static float parse_float_arg(const std::string& value, float fallback) {
    try { return std::stof(value); } catch (...) { return fallback; }
}

static Args parse_args(int argc, char* argv[]) {
    Args args;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        auto next = [&]() -> std::string {
            return (i + 1 < argc) ? argv[++i] : "";
        };

        if (arg == "--help" || arg == "-h") args.help = true;
        else if (arg == "--version" || arg == "-v") args.version = true;
        else if (arg == "--quiet" || arg == "-q") args.quiet = true;
        else if (arg == "--diagnose") args.diagnose = true;
        else if (arg == "--output" || arg == "-o") args.output_path = next();
        else if (arg == "--format" || arg == "-f") args.format = next();
        else if (arg == "--palette" || arg == "-p") args.palette_id = next();
        else if (arg == "--palettes-dir") args.palettes_dir = next();
        else if (arg == "--grid" || arg == "-g") {
            if (!parse_grid(next(), args.grid_w, args.grid_h))
                std::cerr << "Warning: invalid grid spec, using default 50x50\n";
        }
        else if (arg == "--dither" || arg == "-d") {
            std::string mode = next();
            if (mode == "floyd" || mode == "floydsteinberg") args.dither = 1;
            else if (mode == "bayer" || mode == "bayer8x8") args.dither = 2;
            else args.dither = 0;
        }
        else if (arg == "--dpi") args.dpi = std::max(72, std::min(1200, parse_int_arg(next(), 300)));
        else if (arg == "--png-mode") args.png_mode = next();
        else if (arg == "--merge-similar") {
            args.merge_similar = true;
            if (i + 1 < argc && argv[i + 1][0] != '-') {
                float t = parse_float_arg(argv[i + 1], 6.0f);
                if (t > 0.0f) {
                    args.merge_threshold = t;
                    ++i;
                }
            }
        }
        else if (arg == "--remove-background") {
            args.remove_background = true;
            if (i + 1 < argc && argv[i + 1][0] != '-') {
                int t = parse_int_arg(argv[i + 1], 28);
                if (t > 0) {
                    args.bg_threshold = t;
                    ++i;
                }
            }
        }
        else if (arg == "--brightness") args.brightness = std::max(-1.0f, std::min(1.0f, parse_float_arg(next(), 0.0f)));
        else if (arg == "--contrast") args.contrast = std::max(0.0f, std::min(3.0f, parse_float_arg(next(), 1.0f)));
        else if (arg == "--blur") args.blur_sigma = std::max(0.0f, std::min(10.0f, parse_float_arg(next(), 0.0f)));
        else if (arg == "--crop") {
            if (!parse_crop(next(), args.crop_x, args.crop_y, args.crop_w, args.crop_h))
                std::cerr << "Warning: invalid crop spec, use X,Y,W,H format\n";
        }
        else if (arg == "--batch") { args.batch = true; args.input_dir = next(); }
        else if (arg == "--output-dir") args.output_dir = next();
        else if (!arg.empty() && arg[0] != '-') args.input_image = arg;
    }
    return args;
}

// ============================================================================
// Helpers
// ============================================================================

static std::string timestamp() {
    auto now = std::chrono::system_clock::now();
    auto t = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&t), "%Y-%m-%d %H:%M:%S");
    return ss.str();
}

static void ensure_dir(const std::string& path) {
    size_t pos = path.find_last_of("/\\");
    if (pos == std::string::npos) return;
    std::string dir = path.substr(0, pos);
    if (dir.empty()) return;
    std::error_code ec;
    std::filesystem::create_directories(dir, ec);
}

static std::string basename_noext(const std::string& path) {
    size_t slash = path.find_last_of("/\\");
    size_t dot = path.find_last_of('.');
    if (slash == std::string::npos) slash = 0; else slash++;
    if (dot == std::string::npos || dot < slash) dot = path.size();
    return path.substr(slash, dot - slash);
}

// ============================================================================
// Core pipeline
// ============================================================================

struct PipelineResult {
    bool ok = false;
    double elapsed_sec = 0;
    int bead_count = 0;
    int used_colors = 0;
};

static PipelineResult run_pipeline(const std::string& input_image,
                                    const std::string& output_path,
                                    const Args& args,
                                    PerlerPalette* pal,
                                    bool quiet) {
    PipelineResult result;
    auto t0 = std::chrono::steady_clock::now();

    // Load image
    if (!quiet) std::cout << "  Loading: " << input_image << std::endl;
    PerlerImage* img = perler_image_load_from_file(input_image.c_str());
    if (!img) {
        std::cerr << "  Error: Cannot load image\n";
        return result;
    }
    int iw = perler_image_width(img), ih = perler_image_height(img);
    if (!quiet) std::cout << "  Source: " << iw << "×" << ih << std::endl;

    // Preprocessing
    PerlerImage* working = img;
    bool owns_working = false;

    if (args.crop_w > 0 && args.crop_h > 0) {
        if (!quiet) std::cout << "  Crop: " << args.crop_x << "," << args.crop_y
                              << " " << args.crop_w << "×" << args.crop_h << std::endl;
        PerlerImage* cropped = perler_image_crop(img, args.crop_x, args.crop_y,
                                                  args.crop_w, args.crop_h);
        if (cropped) { perler_image_free(img); working = cropped; img = nullptr; owns_working = true; }
        else std::cerr << "  Warning: crop failed, using full image\n";
    }

    if (args.brightness != 0.0f || args.contrast != 1.0f) {
        if (!quiet) std::cout << "  Adjust: brightness=" << args.brightness
                              << " contrast=" << args.contrast << std::endl;
        PerlerImage* adjusted = perler_image_adjust(working, args.brightness, args.contrast);
        if (adjusted) {
            if (owns_working) perler_image_free(working);
            else if (img) { perler_image_free(img); img = nullptr; }
            working = adjusted; owns_working = true;
        }
    }

    if (args.blur_sigma > 0.0f) {
        if (!quiet) std::cout << "  Blur: sigma=" << args.blur_sigma << std::endl;
        PerlerImage* blurred = perler_image_blur(working, args.blur_sigma);
        if (blurred) {
            if (owns_working) perler_image_free(working);
            else if (img) { perler_image_free(img); img = nullptr; }
            working = blurred; owns_working = true;
        }
    }

    // Quantize
    if (!quiet) std::cout << "  Quantizing: " << args.grid_w << "×" << args.grid_h
                          << " dither=" << args.dither << std::endl;
    PerlerBeadGrid* grid = perler_quantize(working, pal, args.grid_w, args.grid_h, args.dither);
    if (!grid) {
        std::cerr << "  Error: Quantization failed\n";
        if (owns_working) perler_image_free(working);
        else if (img) perler_image_free(img);
        return result;
    }

    if (args.remove_background) {
        if (!quiet) std::cout << "  Remove background: threshold="
                              << args.bg_threshold << std::endl;
        perler_apply_background_removal(grid, working, args.bg_threshold);
    }

    if (args.merge_similar) {
        if (!quiet) std::cout << "  Merge similar colors: ΔE < "
                              << args.merge_threshold << std::endl;
        perler_merge_similar_colors(grid, pal, args.merge_threshold);
    }

    result.bead_count = perler_grid_width(grid) * perler_grid_height(grid);

    // Export
    if (!quiet) std::cout << "  Exporting: " << output_path << std::endl;
    ensure_dir(output_path);

    int rc = -1;
    if (args.format == "png") {
        if (args.png_mode == "main") {
            rc = perler_export_png_main(grid, output_path.c_str(), args.dpi);
        } else if (args.png_mode == "sub") {
            rc = perler_export_png_sub(grid, output_path.c_str(), args.dpi);
        } else {
            // "both" — generates _主图 and _副图
            rc = perler_export_png(grid, output_path.c_str(), args.dpi);
        }
    } else if (args.format == "pdf") {
        rc = perler_export_pdf(grid, output_path.c_str());
    } else if (args.format == "csv") {
        rc = perler_export_csv(grid, output_path.c_str());
    } else if (args.format == "json") {
        char* json = perler_export_project_json(grid);
        if (json) {
            std::ofstream out(output_path);
            if (out) {
                out << json;
                out.close();
                rc = out.good() ? 0 : -1;
            }
            perler_string_free(json);
        }
    }

    if (rc != 0) {
        std::cerr << "  Error: Export failed\n";
        perler_grid_free(grid);
        if (owns_working) perler_image_free(working);
        else if (img) perler_image_free(img);
        return result;
    }

    // Color usage
    int count_len = 0;
    const int32_t* counts = perler_grid_color_counts(grid, &count_len);
    for (int i = 0; i < count_len; ++i) if (counts[i] > 0) result.used_colors++;

    if (!quiet) {
        std::cout << "  Colors used: " << result.used_colors << "/" << count_len << "\n";
        for (int i = 0; i < count_len; ++i) {
            if (counts[i] > 0) {
                std::cout << "    " << perler_palette_color_name(pal, i)
                          << " (" << perler_palette_color_code(pal, i)
                          << "): " << counts[i] << "\n";
            }
        }
    }

    // Cleanup
    perler_grid_free(grid);
    if (owns_working) perler_image_free(working);
    else if (img) perler_image_free(img);

    auto t1 = std::chrono::steady_clock::now();
    result.elapsed_sec = std::chrono::duration<double>(t1 - t0).count();
    result.ok = true;
    return result;
}

// ============================================================================
// Batch processing
// ============================================================================

#ifdef _WIN32
#include <windows.h>
static std::vector<std::string> list_images_in_dir(const std::string& dir) {
    std::vector<std::string> files;
    std::string pattern = dir + "\\*";
    WIN32_FIND_DATAA fd;
    HANDLE h = FindFirstFileA(pattern.c_str(), &fd);
    if (h == INVALID_HANDLE_VALUE) return files;
    do {
        std::string name = fd.cFileName;
        if (name == "." || name == "..") continue;
        std::string lower = name;
        std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
        if (lower.size() >= 4 && (lower.substr(lower.size()-4) == ".png" ||
            lower.substr(lower.size()-4) == ".jpg" || lower.substr(lower.size()-4) == ".bmp") ||
            (lower.size() >= 5 && (lower.substr(lower.size()-5) == ".jpeg" ||
            lower.substr(lower.size()-5) == ".webp"))) {
            files.push_back(dir + "\\" + name);
        }
    } while (FindNextFileA(h, &fd));
    FindClose(h);
    std::sort(files.begin(), files.end());
    return files;
}
#else
#include <dirent.h>
static std::vector<std::string> list_images_in_dir(const std::string& dir) {
    std::vector<std::string> files;
    DIR* d = opendir(dir.c_str());
    if (!d) return files;
    struct dirent* ent;
    while ((ent = readdir(d)) != nullptr) {
        std::string name = ent->d_name;
        if (name == "." || name == "..") continue;
        std::string lower = name;
        std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
        if (lower.size() >= 4 && (lower.substr(lower.size()-4) == ".png" ||
            lower.substr(lower.size()-4) == ".jpg" || lower.substr(lower.size()-4) == ".bmp") ||
            (lower.size() >= 5 && (lower.substr(lower.size()-5) == ".jpeg" ||
            lower.substr(lower.size()-5) == ".webp"))) {
            files.push_back(dir + "/" + name);
        }
    }
    closedir(d);
    std::sort(files.begin(), files.end());
    return files;
}
#endif

// ============================================================================
// Main
// ============================================================================

int main(int argc, char* argv[]) {
    Args args = parse_args(argc, argv);

    if (args.help) { print_help(); return 0; }
    if (args.version) { print_version(); return 0; }

    perler_init();

    // Diagnostics mode
    if (args.diagnose) {
        std::cout << "[" << timestamp() << "] Running diagnostics...\n\n";
        char* json = perler_diagnose_full(args.palettes_dir.c_str());
        std::cout << json << "\n";

        std::string s(json);
        int pass = 0, fail = 0, repaired = 0;
        size_t pos = 0;
        while ((pos = s.find("\"status\": \"PASS\"", pos)) != std::string::npos) { pass++; pos++; }
        pos = 0;
        while ((pos = s.find("\"status\": \"FAIL\"", pos)) != std::string::npos) { fail++; pos++; }
        pos = 0;
        while ((pos = s.find("\"status\": \"REPAIRED\"", pos)) != std::string::npos) { repaired++; pos++; }
        std::cout << "\nSummary: " << pass << " PASS";
        if (fail > 0) std::cout << ", " << fail << " FAIL";
        if (repaired > 0) std::cout << ", " << repaired << " REPAIRED";
        std::cout << "\n";

        perler_string_free(json);
        perler_shutdown();
        return fail > 0 ? 1 : 0;
    }

    // Load palette once (shared across batch)
    std::string palette_path = args.palettes_dir + "/" + args.palette_id + ".json";
    if (!args.quiet) std::cout << "[" << timestamp() << "] Loading palette: "
                               << palette_path << std::endl;
    PerlerPalette* pal = perler_palette_load_from_file(palette_path.c_str());
    if (!pal) {
        std::cerr << "Error: Cannot load palette: " << palette_path << "\n";
        perler_shutdown();
        return 3;
    }
    if (!args.quiet) std::cout << "  " << perler_palette_brand_name(pal)
                               << " (" << perler_palette_color_count(pal) << " colors)\n\n";

    // Batch mode
    if (args.batch && !args.input_dir.empty()) {
        auto files = list_images_in_dir(args.input_dir);
        if (files.empty()) {
            std::cerr << "Error: No images found in " << args.input_dir << "\n";
            perler_palette_free(pal);
            perler_shutdown();
            return 1;
        }

        if (!args.quiet) std::cout << "Batch mode: " << files.size() << " images\n\n";

        int ok = 0, fail = 0;
        double total_sec = 0;
        for (size_t i = 0; i < files.size(); ++i) {
            if (!args.quiet) std::cout << "[" << (i+1) << "/" << files.size() << "] ";

            std::string name = basename_noext(files[i]);
            std::string out = args.output_dir + "/" + name;
            if (args.format == "png") out += ".png";
            else if (args.format == "pdf") out += ".pdf";
            else if (args.format == "csv") out += ".csv";
            else if (args.format == "json") out += ".json";

            auto r = run_pipeline(files[i], out, args, pal, args.quiet);
            if (r.ok) {
                ok++;
                total_sec += r.elapsed_sec;
                if (!args.quiet) std::cout << "  ✓ " << out
                                          << " (" << r.elapsed_sec << "s)\n\n";
            } else {
                fail++;
                if (!args.quiet) std::cout << "  ✗ Failed\n\n";
            }
        }
        std::cout << "\nBatch complete: " << ok << " ok, " << fail << " failed"
                  << " in " << total_sec << "s\n";
        perler_palette_free(pal);
        perler_shutdown();
        return fail > 0 ? 1 : 0;
    }

    // Single-image mode
    if (args.input_image.empty()) {
        std::cerr << "Error: No input image. Use <image> or --batch <dir>\n";
        perler_palette_free(pal);
        perler_shutdown();
        return 1;
    }

    auto r = run_pipeline(args.input_image, args.output_path, args, pal, args.quiet);
    if (r.ok) {
        std::cout << "\n✓ " << args.output_path << " (" << r.bead_count << " beads, "
                  << r.used_colors << " colors, " << r.elapsed_sec << "s)\n";
    }

    perler_palette_free(pal);
    perler_shutdown();
    return r.ok ? 0 : 2;
}
