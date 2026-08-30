#!/bin/bash
# .claude/scripts/reduce-prompts.sh
# Generate settings to reduce permission prompts for frequent read-only operations

# Create or update .claude/settings.json with allowlist for common read-only tasks
mkdir -p .claude
cat > .claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": [
      {
        "description": "Read package and configuration files",
        "matcher": "Read",
        "tools": [
          "package.json",
          "package-lock.json",
          "tsconfig.json",
          "next.config.ts",
          "next.config.js",
          "vitest.config.js",
          ".eslintrc.*",
          "eslint.config.*",
          "postcss.config.*",
          "tailwind.config.*",
          "next-env.d.ts"
        ],
        "enabled": true
      },
      {
        "description": "Read source files for inspection",
        "matcher": "Read",
        "tools": [
          "lib/**/*",
          "app/**/*",
          "pages/**/*",
          "types/**/*",
          "*.md",
          "*.txt",
          "*.mdx"
        ],
        "enabled": true
      },
      {
        "description": "Run read-only git commands",
        "matcher": "Bash",
        "command": "git (status|diff|log|show|ls-files|remote|branch|rev-parse|show-ref)",
        "enabled": true
      },
      {
        "description": "Run test commands",
        "matcher": "Bash",
        "command": "(npm|yarn|pnpm) (test|test:.*|vitest)( --|$)",
        "enabled": true
      },
      {
        "description": "Run lint commands",
        "matcher": "Bash",
        "command": "(npm|yarn|pnpm) (lint|lint:.*|eslint)( --|$)",
        "enabled": true
      },
      {
        "description": "Run build commands (for verification)",
        "matcher": "Bash",
        "command": "(npm|yarn|pnpm) (build|dev|start)( --|$)",
        "enabled": true
      },
      {
        "description": "Read environment example files",
        "matcher": "Read",
        "tools": [".env.example", ".env.*"],
        "enabled": true
      }
    ]
  }
}
EOF

echo "Permission settings updated to reduce prompts for frequent read-only operations."
echo "Updated file: .claude/settings.json"