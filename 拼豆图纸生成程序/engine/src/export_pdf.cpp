#include "types.h"
#include "internal/string_utils.h"
#include <string>
#include <vector>
#include <fstream>
#include <sstream>
#include <cstring>
#include <cstdio>
#include <cmath>
#include <algorithm>

namespace perler {
namespace {

/// Parse hex color to RGB uint8_t. Returns black on failure.
RGB hex_to_rgb(const std::string& hex) {
    uint8_t r = 0, g = 0, b = 0;
    if (internal::parse_hex_to_rgb(hex, r, g, b)) {
        return RGB(r, g, b);
    }
    return RGB(0, 0, 0);
}

// ============================================================================
// PDF text helpers
// ============================================================================

/// Escape a string for use inside a PDF literal string (parentheses).
/// Non-ASCII bytes are replaced with '?' — the embedded Helvetica font uses
/// WinAnsiEncoding and cannot render UTF-8 sequences.
std::string pdf_escape(const std::string& s) {
    std::string o;
    o.reserve(s.size());
    for (unsigned char c : s) {
        if (c == '(' || c == ')' || c == '\\') {
            o += '\\';
            o += static_cast<char>(c);
        } else if (c >= 32 && c < 127) {
            o += static_cast<char>(c);
        } else if (c >= 128) {
            o += '?';
        } else {
            o += ' ';
        }
    }
    return o;
}

/// Format a double compactly for the PDF content stream (trailing zeros trimmed).
std::string fmt(double v) {
    char buf[48];
    std::snprintf(buf, sizeof(buf), "%.2f", v);
    std::string s = buf;
    size_t dot = s.find('.');
    if (dot != std::string::npos) {
        while (!s.empty() && s.back() == '0') s.pop_back();
        if (!s.empty() && s.back() == '.') s.pop_back();
    }
    return s.empty() ? "0" : s;
}

/// Approximate rendered text width (Helvetica, proportional). Good enough for centering.
double text_width(double font_size, const std::string& s) {
    return font_size * 0.55 * static_cast<double>(s.size());
}

/// Choose contrasting text color (black or white) based on background luminance.
bool should_use_white_text(const RGB& bg) {
    double lum = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;
    return lum < 140;
}

// ============================================================================
// Content stream builder
// ============================================================================

struct ContentStream {
    std::ostringstream s;

    void set_fill(uint8_t r, uint8_t g, uint8_t b) {
        s << fmt(r / 255.0) << ' ' << fmt(g / 255.0) << ' ' << fmt(b / 255.0) << " rg\n";
    }
    void set_stroke(uint8_t r, uint8_t g, uint8_t b, double w) {
        s << fmt(r / 255.0) << ' ' << fmt(g / 255.0) << ' ' << fmt(b / 255.0)
          << " RG " << fmt(w) << " w\n";
    }

    void rect_fill(double x, double y, double w, double h, uint8_t r, uint8_t g, uint8_t b) {
        set_fill(r, g, b);
        s << fmt(x) << ' ' << fmt(y) << ' ' << fmt(w) << ' ' << fmt(h) << " re f\n";
    }
    void rect_stroke(double x, double y, double w, double h, uint8_t r, uint8_t g, uint8_t b, double lw) {
        set_stroke(r, g, b, lw);
        s << fmt(x) << ' ' << fmt(y) << ' ' << fmt(w) << ' ' << fmt(h) << " re S\n";
    }
    void line(double x1, double y1, double x2, double y2) {
        s << fmt(x1) << ' ' << fmt(y1) << " m " << fmt(x2) << ' ' << fmt(y2) << " l S\n";
    }

    /// Draw text at (x, y) baseline. font is a resource name like "/F1" or "/F2".
    void text(const char* font, double size, double x, double y, const std::string& str,
              uint8_t r, uint8_t g, uint8_t b) {
        s << "BT " << font << ' ' << fmt(size) << " Tf "
          << fmt(r / 255.0) << ' ' << fmt(g / 255.0) << ' ' << fmt(b / 255.0) << " rg "
          << "1 0 0 1 " << fmt(x) << ' ' << fmt(y) << " Tm ("
          << pdf_escape(str) << ") Tj ET\n";
    }
    /// Horizontally centered text at baseline y, centered on x = cx.
    void text_center(const char* font, double size, double cx, double y, const std::string& str,
                     uint8_t r, uint8_t g, uint8_t b) {
        text(font, size, cx - text_width(size, str) / 2.0, y, str, r, g, b);
    }
};

// ============================================================================
// Legend (color key)
// ============================================================================

struct LegendEntry {
    int palette_idx = 0;
    int symbol = 0;        // 1-based symbol number printed on the beads
    std::string code;      // manufacturer part number, e.g. "A1"
    std::string name;      // e.g. "Pale Yellow"
    std::string hex;
    int count = 0;
};

/// Build the sorted color legend and assign each used color a 1-based symbol.
static std::vector<LegendEntry> build_legend(const BeadGrid& grid) {
    std::vector<LegendEntry> entries;
    size_t n = std::min({grid.palette_hex.size(), grid.palette_names.size(),
                         grid.color_counts.size()});
    for (size_t i = 0; i < n; ++i) {
        if (grid.color_counts[i] > 0) {
            LegendEntry e;
            e.palette_idx = static_cast<int>(i);
            e.hex = grid.palette_hex[i];
            e.count = grid.color_counts[i];
            e.name = (i < grid.palette_names.size()) ? grid.palette_names[i] : "";
            e.code = (i < grid.palette_codes.size()) ? grid.palette_codes[i]
                                                     : ("#" + std::to_string(i + 1));
            entries.push_back(e);
        }
    }
    // Sort by the numeric part of the code (standard bead blueprint convention).
    std::sort(entries.begin(), entries.end(),
              [](const LegendEntry& a, const LegendEntry& b) {
                  auto num = [](const std::string& code) -> int {
                      std::string d;
                      for (char c : code) { if (c >= '0' && c <= '9') d += c; }
                      return d.empty() ? 0 : std::stoi(d);
                  };
                  int na = num(a.code), nb = num(b.code);
                  if (na != nb) return na < nb;
                  return a.code < b.code;
              });
    for (size_t k = 0; k < entries.size(); ++k) entries[k].symbol = static_cast<int>(k) + 1;
    return entries;
}

/// Map palette index → legend symbol (1-based), or -1 if unused.
static std::vector<int> build_symbol_map(const BeadGrid& grid,
                                         const std::vector<LegendEntry>& legend) {
    std::vector<int> map(grid.palette_hex.size(), -1);
    for (const auto& e : legend) map[e.palette_idx] = e.symbol;
    return map;
}

// ============================================================================
// Layout / tiling
// ============================================================================

struct Tile {
    int col0 = 0, row0 = 0;   // absolute top-left cell of this tile
    int cols = 0, rows = 0;   // tile size in cells
};

/// Decide how to lay the grid out across pages.
/// Fits on one page when the natural bead size is >= min_bead; otherwise splits
/// into tiles of at most (max_cols × max_rows) cells so every bead stays readable.
static std::vector<Tile> compute_tiles(int gw, int gh, double avail_w, double avail_h,
                                       double min_bead, double max_bead, double& bead_pt) {
    double fit_w = avail_w / gw;
    double fit_h = avail_h / gh;
    double bead = std::min(fit_w, fit_h);

    std::vector<Tile> tiles;
    if (bead >= min_bead) {
        bead_pt = std::min(bead, max_bead);
        tiles.push_back({0, 0, gw, gh});
        return tiles;
    }

    int max_cols = std::max(1, static_cast<int>(std::floor(avail_w / min_bead)));
    int max_rows = std::max(1, static_cast<int>(std::floor(avail_h / min_bead)));
    bead_pt = std::min(avail_w / max_cols, avail_h / max_rows);
    bead_pt = std::min(bead_pt, max_bead);

    for (int ty = 0; ty * max_rows < gh; ++ty) {
        for (int tx = 0; tx * max_cols < gw; ++tx) {
            int cols = std::min(max_cols, gw - tx * max_cols);
            int rows = std::min(max_rows, gh - ty * max_rows);
            tiles.push_back({tx * max_cols, ty * max_rows, cols, rows});
        }
    }
    return tiles;
}

/// Excel-style column label: 0→A, 25→Z, 26→AA, ...
static std::string column_label(int n) {
    std::string label;
    do {
        label = static_cast<char>('A' + (n % 26)) + label;
        n = n / 26 - 1;
    } while (n >= 0);
    return label;
}

// ============================================================================
// Page layout constants (points; A4 portrait)
// ============================================================================

static const double PAGE_W = 595.28;
static const double PAGE_H = 841.89;
static const double MARGIN = 36.0;
static const double LEFT_LABEL_W = 24.0;   // room for row numbers
static const double TOP_LABEL_H = 14.0;    // room for column letters
static const double FOOTER_H = 16.0;       // room for footer text
static const double MIN_BEAD = 4.0;        // smallest still-readable bead
static const double MAX_BEAD = 14.17;      // 5mm bead in points

// ============================================================================
// Page content builders
// ============================================================================

/// Cover page: title, project metadata, and the full color legend.
static std::string build_cover_content(const BeadGrid& grid,
                                       const std::vector<LegendEntry>& legend,
                                       int total_pages, int total_beads) {
    ContentStream cs;
    double cx = PAGE_W / 2.0;
    double y = PAGE_H - MARGIN - 24.0;

    cs.text_center("/F2", 22, cx, y, "Perler Bead Blueprint", 40, 40, 40);
    y -= 26.0;
    cs.text_center("/F1", 13, cx, y, grid.palette_brand, 90, 90, 90);

    // Metadata block
    y -= 34.0;
    cs.text_center("/F1", 10.5, cx, y,
                   std::to_string(grid.grid_w) + " x " + std::to_string(grid.grid_h) + " beads",
                   60, 60, 60);
    y -= 16.0;
    cs.text_center("/F1", 10.5, cx, y, "Total: " + std::to_string(total_beads) + " beads",
                   60, 60, 60);
    y -= 16.0;
    cs.text_center("/F1", 10.5, cx, y,
                   "Colors used: " + std::to_string(legend.size()), 60, 60, 60);

    // Legend header
    y -= 30.0;
    cs.text("/F2", 12, MARGIN, y, "Color Legend", 40, 40, 40);
    y -= 18.0;

    if (!legend.empty()) {
        double fs = (legend.size() > 80) ? 7.5 : 9.0;
        double row_h = fs + 4.0;
        double swatch = fs + 1.0;
        double legend_bottom = MARGIN + FOOTER_H + 6.0;
        double top = y;
        int rows_per_col = std::max(1, static_cast<int>((top - legend_bottom) / row_h));
        int ncols = (static_cast<int>(legend.size()) + rows_per_col - 1) / rows_per_col;
        double avail = PAGE_W - 2.0 * MARGIN;
        double col_w = std::min(175.0, avail / std::max(1, ncols));

        for (size_t i = 0; i < legend.size(); ++i) {
            const LegendEntry& e = legend[i];
            int r = static_cast<int>(i) % rows_per_col;
            int c = static_cast<int>(i) / rows_per_col;
            double lx = MARGIN + c * col_w;
            double ly = top - r * row_h;

            // Swatch (filled square + black border)
            RGB rgb = hex_to_rgb(e.hex);
            cs.rect_fill(lx, ly - swatch, swatch, swatch, rgb.r, rgb.g, rgb.b);
            cs.rect_stroke(lx, ly - swatch, swatch, swatch, 120, 120, 120, 0.4);

            // Code, name, count
            cs.text("/F1", fs, lx + swatch + 6, ly, e.code, 40, 40, 40);

            std::string name = e.name;
            if (name.size() > 16) name = name.substr(0, 15) + ".";
            cs.text("/F1", fs, lx + swatch + 24, ly, name, 80, 80, 80);

            cs.text("/F1", fs, lx + col_w - 30, ly, "x" + std::to_string(e.count), 80, 80, 80);
        }
    }

    // Footer page number
    cs.text_center("/F1", 8, cx, MARGIN - 10.0,
                   "Page 1 / " + std::to_string(total_pages), 130, 130, 130);
    return cs.s.str();
}

/// One grid page: the bead grid (tile) with coordinates, symbols, grid lines and footer.
static std::string build_grid_content(const BeadGrid& grid, const Tile& tile, double bead,
                                      const std::vector<int>& symbol_of,
                                      int page_number, int total_pages) {
    ContentStream cs;

    double x0 = MARGIN + LEFT_LABEL_W;
    double y_top = PAGE_H - MARGIN - TOP_LABEL_H;
    double grid_w = tile.cols * bead;
    double grid_h = tile.rows * bead;

    // Pre-parse palette colors
    std::vector<RGB> prgb(grid.palette_hex.size());
    for (size_t i = 0; i < prgb.size(); ++i) prgb[i] = hex_to_rgb(grid.palette_hex[i]);

    // --- Bead fills ---
    double inset = bead * 0.07;
    for (int ly = 0; ly < tile.rows; ++ly) {
        for (int lx = 0; lx < tile.cols; ++lx) {
            int gx = tile.col0 + lx;
            int gy = tile.row0 + ly;
            int32_t ci = grid.at(gx, gy);
            if (ci < 0 || static_cast<size_t>(ci) >= prgb.size()) continue;
            const RGB& c = prgb[ci];
            double x = x0 + lx * bead + inset;
            double y = y_top - (ly + 1) * bead + inset;
            double w = bead - 2.0 * inset;
            double h = bead - 2.0 * inset;
            cs.rect_fill(x, y, w, h, c.r, c.g, c.b);
        }
    }

    // --- Minor grid lines (every bead) ---
    cs.set_stroke(200, 200, 200, 0.4);
    for (int lx = 0; lx <= tile.cols; ++lx) {
        double x = x0 + lx * bead;
        cs.line(x, y_top - grid_h, x, y_top);
    }
    for (int ly = 0; ly <= tile.rows; ++ly) {
        double y = y_top - ly * bead;
        cs.line(x0, y, x0 + grid_w, y);
    }

    // --- Major grid lines (every 10 cells, absolute) ---
    cs.set_stroke(110, 110, 110, 0.7);
    for (int gx = tile.col0; gx <= tile.col0 + tile.cols; ++gx) {
        if (gx % 10 == 0) {
            double x = x0 + (gx - tile.col0) * bead;
            cs.line(x, y_top - grid_h, x, y_top);
        }
    }
    for (int gy = tile.row0; gy <= tile.row0 + tile.rows; ++gy) {
        if (gy % 10 == 0) {
            double y = y_top - (gy - tile.row0) * bead;
            cs.line(x0, y, x0 + grid_w, y);
        }
    }

    // --- Official color codes on beads (only when large enough to read) ---
    if (bead >= 9.0) {
        for (int ly = 0; ly < tile.rows; ++ly) {
            for (int lx = 0; lx < tile.cols; ++lx) {
                int gx = tile.col0 + lx;
                int gy = tile.row0 + ly;
                int32_t ci = grid.at(gx, gy);
                if (ci < 0 || static_cast<size_t>(ci) >= symbol_of.size()) continue;
                int sym = symbol_of[ci];
                if (sym < 0) continue;

                std::string label =
                    (static_cast<size_t>(ci) < grid.palette_codes.size() &&
                     !grid.palette_codes[ci].empty())
                        ? grid.palette_codes[ci]
                        : "#" + std::to_string(ci + 1);
                double fs = std::min(bead * 0.42, 6.5);
                while (fs > 2.5 && text_width(fs, label) > bead * 0.9) fs -= 0.25;
                double cx = x0 + lx * bead + bead / 2.0;
                double cy = y_top - (ly + 1) * bead + bead / 2.0 - fs * 0.35;

                const RGB& c = prgb[ci];
                uint8_t tr = should_use_white_text(c) ? 255 : 0;
                uint8_t tg = tr, tb = tr;
                if (fs > 2.5) {
                    cs.text_center("/F1", fs, cx, cy, label, tr, tg, tb);
                }
            }
        }
    }

    // --- Column letters (top) ---
    double lf = 6.0;
    for (int lx = 0; lx < tile.cols; ++lx) {
        int gx = tile.col0 + lx;
        double x = x0 + lx * bead + bead / 2.0;
        cs.text_center("/F1", lf, x, y_top + 4.0, column_label(gx), 70, 70, 70);
    }

    // --- Row numbers (left) ---
    for (int ly = 0; ly < tile.rows; ++ly) {
        int gy = tile.row0 + ly;
        std::string label = std::to_string(gy + 1);
        double y = y_top - (ly + 1) * bead + bead / 2.0 - lf * 0.35;
        cs.text("/F1", lf, x0 - 5.0 - text_width(lf, label), y, label, 70, 70, 70);
    }

    // --- Footer ---
    double fy = MARGIN - 10.0;
    cs.text("/F1", 8, MARGIN, fy, grid.palette_brand, 130, 130, 130);
    cs.text_center("/F1", 8, PAGE_W / 2.0, fy,
                   "Page " + std::to_string(page_number) + " / " + std::to_string(total_pages),
                   130, 130, 130);

    return cs.s.str();
}

} // anonymous namespace

#ifdef PERLER_MINI_BUILD
// Mini build: PDF export not available
bool do_export_pdf(const BeadGrid& grid, const std::string& path) {
    (void)grid;
    (void)path;
    return false;
}
#else
// Full build: generate a professional multi-page PDF with cover page, legend,
// coordinates, bead symbols and page numbers. Hand-crafted PDF (no libharu).
bool do_export_pdf(const BeadGrid& grid, const std::string& path) {
    if (!grid.valid() || path.empty()) return false;

    // --- Layout ---
    auto legend = build_legend(grid);
    auto symbol_of = build_symbol_map(grid, legend);

    int total_beads = 0;
    for (const auto& e : legend) total_beads += e.count;

    double avail_w = PAGE_W - 2.0 * MARGIN - LEFT_LABEL_W;
    double avail_h = PAGE_H - 2.0 * MARGIN - TOP_LABEL_H - FOOTER_H;
    double bead = 0.0;
    std::vector<Tile> tiles =
        compute_tiles(grid.grid_w, grid.grid_h, avail_w, avail_h, MIN_BEAD, MAX_BEAD, bead);

    int total_pages = 1 + static_cast<int>(tiles.size());

    // --- Build every page's content stream first ---
    std::vector<std::string> contents(static_cast<size_t>(total_pages));
    contents[0] = build_cover_content(grid, legend, total_pages, total_beads);
    for (size_t t = 0; t < tiles.size(); ++t) {
        contents[t + 1] = build_grid_content(grid, tiles[t], bead, symbol_of,
                                             static_cast<int>(t) + 2, total_pages);
    }

    // --- Assemble the PDF document ---
    // Object numbering:
    //   1 Catalog, 2 Pages, 3 Font F1 (Helvetica), 4 Font F2 (Helvetica-Bold)
    //   5..(4+N)       Page objects
    //   (5+N)..(4+2N)  Content stream objects
    int n = total_pages;
    int obj_count = 4 + 2 * n;
    std::vector<long> xref(static_cast<size_t>(obj_count) + 1, 0);  // 1-based indexing

    std::ostringstream pdf;
    pdf << "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";

    auto obj_start = [&](int num) {
        xref[num] = static_cast<long>(pdf.tellp());
        pdf << num << " 0 obj\n";
    };

    obj_start(1);
    pdf << "<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

    obj_start(2);
    pdf << "<< /Type /Pages /Kids [";
    for (int i = 0; i < n; ++i) pdf << (5 + i) << " 0 R ";
    pdf << "] /Count " << n << " >>\nendobj\n";

    obj_start(3);
    pdf << "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica "
           "/Encoding /WinAnsiEncoding >>\nendobj\n";

    obj_start(4);
    pdf << "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold "
           "/Encoding /WinAnsiEncoding >>\nendobj\n";

    for (int i = 0; i < n; ++i) {
        obj_start(5 + i);
        pdf << "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " << fmt(PAGE_W) << ' ' << fmt(PAGE_H)
            << "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
            << "/Contents " << (5 + n + i) << " 0 R >>\nendobj\n";
    }

    for (int i = 0; i < n; ++i) {
        obj_start(5 + n + i);
        pdf << "<< /Length " << contents[static_cast<size_t>(i)].size() << " >>\nstream\n"
            << contents[static_cast<size_t>(i)] << "\nendstream\nendobj\n";
    }

    // --- Cross-reference table ---
    long xref_offset = static_cast<long>(pdf.tellp());
    pdf << "xref\n0 " << (obj_count + 1) << "\n";
    pdf << "0000000000 65535 f \n";
    for (int i = 1; i <= obj_count; ++i) {
        char buf[32];
        std::snprintf(buf, sizeof(buf), "%010ld 00000 n \n", xref[static_cast<size_t>(i)]);
        pdf << buf;
    }

    pdf << "trailer\n<< /Size " << (obj_count + 1) << " /Root 1 0 R >>\n"
        << "startxref\n" << xref_offset << "\n%%EOF\n";

    // --- Write to file ---
    std::ofstream out(path, std::ios::binary);
    if (!out.is_open()) return false;
    out << pdf.str();
    out.close();
    return out.good();
}
#endif

} // namespace perler
