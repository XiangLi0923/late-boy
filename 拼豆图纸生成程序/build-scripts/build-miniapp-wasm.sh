#!/bin/bash
# Build mini WASM target (<500KB) for WeChat Mini Program
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build/mini"
OUTPUT_DIR="$PROJECT_ROOT/frontends/miniapp/wasm"

echo "=== Building perler_engine_mini (slim WASM, target <500KB) ==="

if ! command -v emcc &> /dev/null; then
    echo "Emscripten not found. Run setup-emsdk.sh first."
    exit 1
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

emcmake cmake "$PROJECT_ROOT/engine" \
    -DCMAKE_BUILD_TYPE=MinSizeRel \
    -DPERLER_BUILD_WASM=OFF \
    -DPERLER_BUILD_MINI=ON \
    -DPERLER_BUILD_CLI=OFF \
    -DPERLER_BUILD_TESTS=OFF \
    -DPERLER_MINI_BUILD=ON \
    -DPERLER_USE_FETCHCONTENT=OFF \
    -DCMAKE_CXX_FLAGS="-Os -flto -fno-exceptions -fno-rtti"

cmake --build . --target perler_engine_mini -j$(nproc 2>/dev/null || echo 4)

# Copy output
mkdir -p "$OUTPUT_DIR"
cp mini_output/perler_engine_mini.js "$OUTPUT_DIR/" 2>/dev/null || true
cp mini_output/perler_engine_mini.wasm "$OUTPUT_DIR/" 2>/dev/null || true

# Report size
echo ""
echo "=== Mini WASM Build Complete ==="
if [ -f "$OUTPUT_DIR/perler_engine_mini.wasm" ]; then
    WASM_SIZE=$(wc -c < "$OUTPUT_DIR/perler_engine_mini.wasm")
    echo "WASM size: $WASM_SIZE bytes ($(( WASM_SIZE / 1024 )) KB)"
    if [ "$WASM_SIZE" -gt 512000 ]; then
        echo "⚠ WARNING: Mini WASM exceeds 500KB target!"
        echo "  Consider further optimization: --closure 1, wasm-opt -Oz, strip debug info"
    else
        echo "✓ Within 500KB target"
    fi
fi

echo "Output: $OUTPUT_DIR/perler_engine_mini.{js,wasm}"
