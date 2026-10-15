#!/bin/sh
# N64Recomp-browser's web support (README.md, "The web page") on top of this game's own patches in recomp/, which
# must be in already: ./tools/web_patch.sh, from the clone's folder. build.sh runs it. Every change is behind
# __EMSCRIPTEN__ or __wasm__, so the game builds as before natively. Applied a project at a time, each left alone
# if it is patched already, with two files left out where recomp/'s patches change the same lines:
# - N64Recomp's src/analysis.cpp in tools/N64Recomp, the recompiler build.sh builds, whose change finds a jump table
#   in another section: recomp/n64recomp.patch does that its own way (the runtime's N64Recomp, whose recomp.h the
#   game's code includes, takes the whole patch).
# - rt64's src/hle/rt64_game_frame.h, whose one change (buildCallHashMap takes a sorted vector, as the web's
#   rt64_game_frame.cpp defines it) sits beside lines recomp/rt64.patch changes: tools/web_rt64_game_frame.patch
#   makes it on top of those.
set -e
cd "$(dirname "$0")/.."
APPLY=tools/N64Recomp-browser/patches/apply.cmake
cmake -P $APPLY rt64 tools/rt64 src/hle/rt64_game_frame.h
git -C tools/rt64 apply --reverse --check "$PWD/tools/web_rt64_game_frame.patch" 2>/dev/null ||
    git -C tools/rt64 apply "$PWD/tools/web_rt64_game_frame.patch"
cmake -P $APPLY plume tools/rt64/src/contrib/plume
cmake -P $APPLY hlslpp tools/rt64/src/contrib/hlslpp
cmake -P $APPLY N64ModernRuntime tools/N64ModernRuntime
cmake -P $APPLY N64Recomp tools/N64ModernRuntime/N64Recomp
cmake -P $APPLY RecompFrontend tools/RecompFrontend
cmake -P $APPLY N64Recomp tools/N64Recomp src/analysis.cpp
