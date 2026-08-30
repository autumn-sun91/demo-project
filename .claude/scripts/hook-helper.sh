#!/bin/bash
# .claude/scripts/hook-helper.sh
# Utility functions for TDD guard hook and similar CLI hooks

# Check if a file path is a test file
is_test_file() {
    local file_path="$1"
    [[ "$file_path" =~ (test|spec|\.test\.|\.spec\.|__tests__) ]] && return 0 || return 1
}

# Check if testing should be skipped for a given file path
should_skip_testing() {
    local file_path="$1"

    # Configuration/type/style files don't need tests
    [[ "$file_path" =~ \.(json|css|scss|md|yml|yaml|env|config\.|tailwind|postcss|next\.config|tsconfig)($|/) ]] && return 0

    # types/ directory doesn't need tests
    [[ "$file_path" =~ /types/ ]] && return 0

    # Next.js framework files (layout, page, loading, error, not-found, global styles) are allowed without tests
    [[ "$file_path" =~ /(layout|page|loading|error|not-found)\.(tsx|ts|css)($|/) ]] && return 0

    # components/ directory is presentation layer (no business logic) - unit testing not required, allowed
    [[ "$file_path" =~ /components/ ]] && return 0

    return 1
}

# Check if a test file exists for the given source file
test_file_exists() {
    local source_path="$1"
    local dir=$(dirname "$source_path")
    local basename=$(basename "$source_path" | sed -E 's/\.(ts|tsx|js|jsx)$//')

    # Check same directory for .test or .spec files
    for ext in ts tsx js jsx; do
        [[ -f "${dir}/${basename}.test.${ext}" || -f "${dir}/${basename}.spec.${ext}" ]] && return 0
    done

    # Check __tests__ directory
    local parent=$(dirname "$dir")
    for ext in ts tsx js jsx; do
        [[ -f "${parent}/__tests__/${basename}.test.${ext}" || -f "${dir}/__tests__/${basename}.test.${ext}" ]] && return 0
    done

    # Check project root src/__tests__/ directory if it exists
    if [[ -d "src/__tests__" ]]; then
        for ext in ts tsx js jsx; do
            [[ -f "src/__tests__/${basename}.test.${ext}" ]] && return 0
        done
    fi

    return 1
}

# Generate a permission denial response for TDD guard
generate_tdd_denial() {
    local basename="$1"
    local suggested_test="${basename}.test.ts"

    cat << EOF
{
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "TDD GUARD: '${basename}'에 대한 테스트 파일이 존재하지 않습니다. 구현 코드를 작성하기 전에 테스트를 먼저 작성하세요. (테스트 파일 예: ${suggested_test})"
    }
}
EOF
}