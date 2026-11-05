#!/bin/bash
# Builds the plugin ZIP for the OpenAI plugin portal (platform.openai.com/plugins).
#
# The portal "reads advanced authentication settings from your package's
# mcp.json" (developers.openai.com/plugins/deploy/submission), declared under
# each server's extensions["com.openai"].auth (…/plugins/build/plugins,
# "Configure MCP authentication"). The Codex CLI, however, parses the same
# portable mcp.json with deny_unknown_fields (openai/codex
# codex-rs/codex-mcp/src/agent_plugin_config.rs) and silently drops a server
# that carries `extensions`. So the installable plugin keeps a plain mcp.json,
# and only this ZIP gets openai-submission/mcp.json in its place.
#
# Usage: scripts/build-openai-submission.sh [out.zip]   (default: dist/ailang-parse-<version>-openai.zip)
set -euo pipefail
cd "$(dirname "$0")/.."
PLUGIN=plugins/ailang-parse
VERSION=$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$PLUGIN/plugin.json")
OUT=${1:-dist/ailang-parse-$VERSION-openai.zip}
case "$OUT" in /*) ;; *) OUT="$PWD/$OUT" ;; esac
mkdir -p "$(dirname "$OUT")"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
# The Agent Plugins package: plugin.json, mcp.json, skills/, assets/. The Claude
# (.claude-plugin/) and Codex (.mcp.json) manifests are left out of the ZIP.
cp -R "$PLUGIN"/plugin.json "$PLUGIN"/skills "$PLUGIN"/assets "$STAGE"/
cp openai-submission/mcp.json "$STAGE"/mcp.json
rm -f "$OUT"
(cd "$STAGE" && zip -qr -X "$OUT" . -x '.DS_Store' -x '*/.DS_Store')
echo "$OUT"
unzip -l "$OUT" | tail -n +4 | awk '{print $4}' | grep -E '^(plugin|mcp)\.json$'
