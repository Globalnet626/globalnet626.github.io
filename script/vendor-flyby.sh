#!/bin/sh
# Copy a static build of Globalnet626/FLYBY2-web into this site.
#
# The player page is flyby/player/index.html. Its scripts and meshes are
# absolute /assets/... URLs, so the build's dist/assets tree is copied into
# assets/. Sourcemaps are left out. flyby/player/VENDOR.txt lists the copied
# paths so the next run can remove them.
#
# From GitHub (after the speed API branch is pushed):
#   script/vendor-flyby.sh cursor/flyby-speed-f72b
#   script/vendor-flyby.sh web-port
#
# From a build you already have (no clone, no npm):
#   FLYBY_DIST=/path/to/FLYBY2-web/web/dist \
#   FLYBY_SHA=<commit> \
#   script/vendor-flyby.sh
#
# Needs Node 22.12 or newer when it clones and builds. The web package
# script is: npm ci && npm run build
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
REF=${1:-cursor/flyby-speed-f72b}
PLAYER="$ROOT/flyby/player"
LIST="$PLAYER/VENDOR.txt"
TMP=

cleanup() {
	if [ -n "$TMP" ]; then
		rm -rf "$TMP"
	fi
}
trap cleanup EXIT

if [ -n "${FLYBY_DIST:-}" ]; then
	DIST=$FLYBY_DIST
	SHA=${FLYBY_SHA:-unknown}
else
	TMP=$(mktemp -d)
	git clone --depth 1 --branch "$REF" https://github.com/Globalnet626/FLYBY2-web.git "$TMP/src"
	SHA=$(git -C "$TMP/src" rev-parse HEAD)
	cd "$TMP/src/web"
	npm ci
	npm run build
	DIST=$TMP/src/web/dist
fi

if [ ! -f "$DIST/index.html" ]; then
	echo "No dist/index.html in $DIST" >&2
	exit 1
fi

mkdir -p "$PLAYER"
if [ -f "$LIST" ]; then
	while IFS= read -r rel; do
		[ -n "$rel" ] || continue
		rm -f "$ROOT/$rel"
	done < "$LIST"
fi

: > "$LIST"
cp "$DIST/index.html" "$PLAYER/index.html"
printf '%s\n' "flyby/player/index.html" >> "$LIST"

cd "$DIST/assets"
find . -type f ! -name '*.map' | sort | while IFS= read -r file; do
	rel="assets/${file#./}"
	mkdir -p "$ROOT/$(dirname "$rel")"
	cp "$file" "$ROOT/$rel"
	printf '%s\n' "$rel" >> "$LIST"
done

{
	printf '%s\n' "$SHA"
	printf '%s\n' "$REF"
} > "$PLAYER/SOURCE.txt"

echo "Vendored FLYBY2 $SHA ($REF) into flyby/player"
