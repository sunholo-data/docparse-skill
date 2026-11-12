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
# Review metadata (the 5 positive + 3 negative test cases, commerce: false)
# goes only into the ZIP's plugin.json, at extensions["com.openai"].review: the
# installable plugin.json stays free of submission-only fields. The demo video
# is required for MCP review; pass its reviewer-accessible URL as
# DEMO_RECORDING_URL to include it (otherwise enter it in the portal).
# Test credentials and reviewer instructions are refused in the ZIP: they go
# in the portal's Review details form.
python3 -I - "$STAGE/plugin.json" openai-submission/review.json "${DEMO_RECORDING_URL:-}" <<'PY'
import json, sys
plugin_path, review_path, demo = sys.argv[1], sys.argv[2], sys.argv[3]
plugin = json.load(open(plugin_path))
review = json.load(open(review_path))
if demo:
    if not demo.startswith("https://"):
        sys.exit("DEMO_RECORDING_URL must be an https:// URL")
    review["demo_recording_url"] = demo
plugin["extensions"]["com.openai"]["review"] = review
open(plugin_path, "w").write(json.dumps(plugin, indent=2, ensure_ascii=False) + "\n")
PY
rm -f "$OUT"
(cd "$STAGE" && zip -qr -X "$OUT" . -x '.DS_Store' -x '*/.DS_Store')
echo "$OUT"
unzip -l "$OUT" | tail -n +4 | awk '{print $4}' | grep -E '^(plugin|mcp)\.json$'
