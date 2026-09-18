#!/bin/bash
# Build standard WASM target for Web and Electron
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build/wasm"
OUTPUT_DIR="$PROJECT_ROOT/frontends/web/public"

echo "=== Building perler_engine_wasm (standard WASM) ==="

# Ensure Emscripten SDK is available
if ! command -v emcc &> /dev/null; then
    echo "Emscripten not found. Please run setup-emsdk.sh first."
    echo "  source ./build-scripts/setup-emsdk.sh"
    exit 1
fi

# Configure with Emscripten CMake toolchain
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

emcmake cmake "$PROJECT_ROOT/engine" \
    -DCMAKE_BUILD_TYPE=Release \
    -DPERLER_BUILD_WASM=ON \
    -DPERLER_BUILD_MINI=OFF \
    -DPERLER_BUILD_CLI=OFF \
    -DPERLER_BUILD_TESTS=OFF \
    -DPERLER_USE_FETCHCONTENT=OFF

# Build
cmake --build . --target perler_engine_wasm -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

# Copy output
mkdir -p "$OUTPUT_DIR"
cp wasm_output/perler_engine.js "$OUTPUT_DIR/" 2>/dev/null || true
cp wasm_output/perler_engine.wasm "$OUTPUT_DIR/" 2>/dev/null || true
cp wasm_output/perler_engine.d.ts "$OUTPUT_DIR/" 2>/dev/null || true

# Report sizes
echo ""
echo "=== Build Complete ==="
echo "Output files:"
ls -lh "$OUTPUT_DIR"/perler_engine.* 2>/dev/null || echo "  (files in build/wasm/wasm_output/)"
if [ -f "$OUTPUT_DIR/perler_engine.wasm" ]; then
    WASM_SIZE=$(wc -c < "$OUTPUT_DIR/perler_engine.wasm")
    echo "WASM size: $WASM_SIZE bytes ($(( WASM_SIZE / 1024 )) KB)"
    GZIP_SIZE=$(gzip -c "$OUTPUT_DIR/perler_engine.wasm" | wc -c)
    echo "WASM gzipped: $GZIP_SIZE bytes ($(( GZIP_SIZE / 1024 )) KB)"
fi
