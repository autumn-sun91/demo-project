#!/bin/bash
# .claude/scripts/test-generator.sh
# Usage: ./test-generator.sh <source-file-path>

SOURCE_FILE="$1"
if [ -z "$SOURCE_FILE" ]; then
    echo "Usage: $0 <source-file>"
    exit 1
fi

# Convert source path to test path
DIR=$(dirname "$SOURCE_FILE")
BASENAME=$(basename "$SOURCE_FILE" | sed -E 's/\.(ts|tsx|js|jsx)$//')
TEST_FILE="${DIR}/${BASENAME}.test.ts"

if [ -f "$TEST_FILE" ]; then
    echo "Test file already exists: $TEST_FILE"
    exit 0
fi

# Extract function names from source file
FUNCTIONS=$(grep -oE 'export\s+(function\s+|const\s+[A-Za-z_][A-Za-z0-9_]*\s*=)' "$SOURCE_FILE" |
           sed -E 's/export\s+(function\s+|const\s+[A-Za-z_][A-Za-z0-9_]*\s*=)//' |
           sort -u)

# Create test file
cat > "$TEST_FILE" << TEST_EOF
import { ${FUNCTIONS:-} } from './${BASENAME}';

describe('${BASENAME}', () => {
${FUNCTIONS//$'\n'/$'\n'  test('should be implemented', () => {
      // TODO: implement test cases
      expect(true).toBe(true);
    });}
});
TEST_EOF

echo "Test stub created: $TEST_FILE"
echo "Functions found: $FUNCTIONS"