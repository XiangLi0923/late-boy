#!/bin/bash
# Setup third-party dependencies for perler_engine
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$PROJECT_ROOT/engine/vendor"

echo "=== Setting up third-party dependencies ==="

# 1. stb_image.h + stb_image_write.h (public domain, header-only)
if [ ! -f "$VENDOR_DIR/stb_image.h" ]; then
    echo "Downloading stb_image.h..."
    curl -sL "https://raw.githubusercontent.com/nothings/stb/master/stb_image.h" -o "$VENDOR_DIR/stb_image.h"
fi
if [ ! -f "$VENDOR_DIR/stb_image_write.h" ]; then
    echo "Downloading stb_image_write.h..."
    curl -sL "https://raw.githubusercontent.com/nothings/stb/master/stb_image_write.h" -o "$VENDOR_DIR/stb_image_write.h"
fi

# 2. nlohmann/json.hpp (MIT, header-only, single-include version)
if [ ! -f "$VENDOR_DIR/json.hpp" ]; then
    echo "Downloading nlohmann/json.hpp..."
    curl -sL "https://github.com/nlohmann/json/releases/latest/download/json.hpp" -o "$VENDOR_DIR/json.hpp"
fi

echo "=== Dependencies ready ==="
echo "stb_image.h: $(wc -c < "$VENDOR_DIR/stb_image.h" 2>/dev/null || echo 'missing') bytes"
echo "stb_image_write.h: $(wc -c < "$VENDOR_DIR/stb_image_write.h" 2>/dev/null || echo 'missing') bytes"
echo "json.hpp: $(wc -c < "$VENDOR_DIR/json.hpp" 2>/dev/null || echo 'missing') bytes"
echo ""
echo "For offline builds: copy these files to engine/vendor/ before running cmake."
echo "For libharu and LuaJIT: cmake FetchContent will download them, or set -DFETCHCONTENT=OFF"
echo "and place sources in engine/vendor/libharu/ and engine/lua/ respectively."
