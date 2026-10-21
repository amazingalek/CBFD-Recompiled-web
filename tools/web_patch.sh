#!/bin/sh
# N64Recomp-browser's web support (README.md, "The web page") on top of this game's own patches in recomp/, which
# must be in already: ./tools/web_patch.sh, from the clone's folder. build.sh runs it. Every change is behind
# __EMSCRIPTEN__ or __wasm__, so the game builds as before natively. Applied a project at a time, each left alone
# if it is patched already, with three files left out where recomp/'s patches change the same lines:
# - N64Recomp's src/analysis.cpp in tools/N64Recomp, the recompiler build.sh builds, whose change finds a jump table
#   in another section: recomp/n64recomp.patch does that its own way (the runtime's N64Recomp, whose recomp.h the
#   game's code includes, takes the whole patch).
# - rt64's src/hle/rt64_game_frame.h, whose one change (buildCallHashMap takes a sorted vector, as the web's
#   rt64_game_frame.cpp defines it) sits beside lines recomp/rt64.patch changes: tools/web_rt64_game_frame.patch
#   makes it on top of those.
# - the runtime's ultramodern/src/timer.cpp, which recomp/n64modernruntime.patch rewrites (its timers in a list under a
#   lock): tools/web_timer.patch makes the web's change there, a timer less than 2 ms away polled for, since the page's
#   timed waits can end late (Firefox on Windows ends them on the system timer's 15.6 ms tick).
# Those three make the web's change as N64Recomp-browser's commit MERGED_FROM has it; what the web has changed in them
# since is merged in (apply.cmake --since), so a later web change reaches the page by itself. One that meets recomp/'s
# lines stops, the file left with conflict markers: merge it into tools/web_*.patch (analysis.cpp: into
# recomp/n64recomp.patch) by hand and move MERGED_FROM to the commit merged from.
# And one for a file recomp/'s patches add: tools/web_save_states.patch, the runtime's save states built for wasm,
# which has no native call stack to sign a thread's wait with (the page takes no save states: host/src/frontend.cpp).
set -e
cd "$(dirname "$0")/.."
APPLY=tools/N64Recomp-browser/patches/apply.cmake
MERGED_FROM=494cc8110de23edbc394d977224d7a498fee04b7 # v0.82.0
# web_since <name> <tool> <file>: the web's change to a file left out, since MERGED_FROM.
web_since() {
    cmake -P $APPLY "$1" "$2" --since $MERGED_FROM "$3"
}
# web_apply <tool> <patch>: unless it is in already.
web_apply() {
    git -C "$1" apply --reverse --check "$PWD/$2" 2>/dev/null || git -C "$1" apply "$PWD/$2"
}
# Before rt64's patch: apply.cmake knows a checkout it patched with a three-way merge by its changes, rt64's own
# and its submodules' (plume and hlslpp patched show as dirty), so nothing may change them after.
web_apply tools/rt64 tools/web_rt64_game_frame.patch
web_since rt64 tools/rt64 src/hle/rt64_game_frame.h
cmake -P $APPLY plume tools/rt64/src/contrib/plume
cmake -P $APPLY hlslpp tools/rt64/src/contrib/hlslpp
cmake -P $APPLY rt64 tools/rt64 src/hle/rt64_game_frame.h
web_apply tools/N64ModernRuntime tools/web_save_states.patch
web_apply tools/N64ModernRuntime tools/web_timer.patch
web_since N64ModernRuntime tools/N64ModernRuntime ultramodern/src/timer.cpp
cmake -P $APPLY N64ModernRuntime tools/N64ModernRuntime ultramodern/src/timer.cpp
cmake -P $APPLY N64Recomp tools/N64ModernRuntime/N64Recomp
cmake -P $APPLY RecompFrontend tools/RecompFrontend
web_since N64Recomp tools/N64Recomp src/analysis.cpp
cmake -P $APPLY N64Recomp tools/N64Recomp src/analysis.cpp
