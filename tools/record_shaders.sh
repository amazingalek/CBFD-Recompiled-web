#!/usr/bin/env bash
# Records host/rt64_shaders.txt, the shaders the page builds before the game and as each chapter or multiplayer level
# starts, by code rather than by playing: N64Recomp-browser's tools/record_shaders.mjs serves the page built in
# <build dir> (host/build-web), drives it in headless Chrome through tools/shader_plan.json, a page load a section, in
# which tools/shader_survey.js starts each chapter's places and each multiplayer level, and writes the list. Needs
# node 22 or later and Chrome, and takes about 55 minutes. The list's descriptions that the recording doesn't print
# again are kept in its last section ("earlier"): add them back after a new recording. Then build the page again, so
# that it prebuilds the new list.
#
#   bash tools/record_shaders.sh <build dir> <ROM> [--profile <dir>] [--port <n>] [--only <section>,...]
set -euo pipefail
[ $# -ge 2 ] || { sed -n '10p' "$0"; exit 1; }
cd "$(dirname "$0")/.."
build="$1" rom="$2"
shift 2
exec node tools/N64Recomp-browser/tools/record_shaders.mjs tools/shader_plan.json "$build" "$rom" host/rt64_shaders.txt "$@"
