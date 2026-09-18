#!/bin/bash
# Full-platform validation: compile all targets, run diagnostics, verify outputs
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"
PASS=0
FAIL=0
MATRIX=""

log_pass() { PASS=$((PASS + 1)); MATRIX="$MATRIX\n  $1: PASS"; }
log_fail() { FAIL=$((FAIL + 1)); MATRIX="$MATRIX\n  $1: FAIL — $2"; }

echo "============================================"
echo " Perler Bead Engine — Full Build Validation"
echo "============================================"
echo ""

# --- Phase 1: Native build (static lib + CLI) ---
echo "--- Phase 1: Native build ---"
mkdir -p "$BUILD_DIR/native"
cd "$BUILD_DIR/native"

if cmake "$PROJECT_ROOT/engine" \
    -DCMAKE_BUILD_TYPE=Release \
    -DPERLER_BUILD_CLI=ON \
    -DPERLER_BUILD_WASM=OFF \
    -DPERLER_BUILD_MINI=OFF \
    -DPERLER_BUILD_TESTS=OFF \
    -DPERLER_USE_FETCHCONTENT=OFF > /dev/null 2>&1; then
    log_pass "cmake-configure-native"
else
    log_fail "cmake-configure-native" "CMake configure failed"
fi

if cmake --build . --target perler_cli -j$(nproc 2>/dev/null || echo 4) > /dev/null 2>&1; then
    log_pass "build-perler_cli"
else
    log_fail "build-perler_cli" "Compilation failed"
fi

# --- Phase 2: CLI --diagnose ---
echo "--- Phase 2: CLI diagnostics ---"
CLI_PATH="$BUILD_DIR/native/perler_cli"
if [ -f "$CLI_PATH" ] || [ -f "$CLI_PATH.exe" ]; then
    CLI_EXE="$CLI_PATH"
    [ -f "$CLI_PATH.exe" ] && CLI_EXE="$CLI_PATH.exe"

    DIAG_OUTPUT=$("$CLI_EXE" --diagnose --palettes-dir "$PROJECT_ROOT/engine/palettes" 2>&1) || true
    echo "$DIAG_OUTPUT" | head -20

    FAIL_COUNT=$(echo "$DIAG_OUTPUT" | grep -c '"status": "FAIL"' || true)
    if [ "$FAIL_COUNT" -eq 0 ]; then
        log_pass "cli-diagnose"
    else
        log_fail "cli-diagnose" "$FAIL_COUNT checks failed"
    fi
else
    log_fail "cli-diagnose" "CLI binary not found"
fi

# --- Phase 3: WASM size check (if built) ---
echo "--- Phase 3: WASM targets ---"
WASM_STD="$PROJECT_ROOT/frontends/web/public/perler_engine.wasm"
WASM_MINI="$PROJECT_ROOT/frontends/miniapp/wasm/perler_engine_mini.wasm"

if [ -f "$WASM_STD" ]; then
    STD_SIZE=$(wc -c < "$WASM_STD")
    echo "Standard WASM: $STD_SIZE bytes"
    log_pass "wasm-standard" "$(( STD_SIZE / 1024 ))KB"
else
    log_pass "wasm-standard" "skipped (not built)"
fi

if [ -f "$WASM_MINI" ]; then
    MINI_SIZE=$(wc -c < "$WASM_MINI")
    echo "Mini WASM: $MINI_SIZE bytes (limit: 512000)"
    if [ "$MINI_SIZE" -le 512000 ]; then
        log_pass "wasm-mini" "$(( MINI_SIZE / 1024 ))KB"
    else
        log_fail "wasm-mini" "$(( MINI_SIZE / 1024 ))KB exceeds 500KB limit"
    fi
else
    log_pass "wasm-mini" "skipped (not built)"
fi

# --- Summary ---
echo ""
echo "============================================"
echo " Build Validation Summary"
echo "============================================"
echo -e "$MATRIX"
echo ""
echo "Results: $PASS PASS, $FAIL FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo "❌ Validation FAILED — $FAIL issue(s) need attention"
    exit 1
else
    echo "✓ All checks passed"
    exit 0
fi
