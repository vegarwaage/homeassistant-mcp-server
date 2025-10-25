#!/bin/bash
# Test script for verifying MCP server functionality

echo "=== Home Assistant MCP Server Test ==="
echo ""

# Test 1: Build
echo "Test 1: Building project..."
npm run build
if [ $? -eq 0 ]; then
  echo "✓ Build successful"
else
  echo "✗ Build failed"
  exit 1
fi
echo ""

# Test 2: Check all files exist
echo "Test 2: Verifying output files..."
files=(
  "dist/index.js"
  "dist/types.js"
  "dist/ha-client.js"
  "dist/backup.js"
  "dist/tools/states.js"
  "dist/tools/config.js"
  "dist/tools/automation.js"
  "dist/tools/system.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file exists"
  else
    echo "✗ $file missing"
    exit 1
  fi
done
echo ""

# Test 3: Verify addon files
echo "Test 3: Verifying addon files..."
addon_files=(
  "config.yaml"
  "Dockerfile"
  "run.sh"
)

for file in "${addon_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file exists"
  else
    echo "✗ $file missing"
    exit 1
  fi
done
echo ""

echo "=== All tests passed ==="
echo ""
echo "Next steps:"
echo "1. Copy this directory to /addons/ on Home Assistant"
echo "2. Install addon via Home Assistant UI"
echo "3. Configure Claude Code/Desktop with SSH connection"
echo "4. Test by asking Claude to list your entities"
