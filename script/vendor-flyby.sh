#!/usr/bin/env bash
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
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
REF=${1:-cursor/flyby-speed-f72b}
PLAYER="$ROOT/flyby/player"
LIST="$PLAYER/VENDOR.txt"
TMP=
STAGE=

cleanup() {
	if [ -n "$TMP" ]; then
		rm -rf "$TMP"
	fi
	if [ -n "$STAGE" ]; then
		rm -rf "$STAGE"
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
	(
		cd "$TMP/src/web"
		npm ci
		npm run build
	)
	DIST=$TMP/src/web/dist
fi

if [ ! -f "$DIST/index.html" ]; then
	echo "No dist/index.html in $DIST" >&2
	exit 1
fi
if [ ! -d "$DIST/assets" ]; then
	echo "No dist/assets in $DIST" >&2
	exit 1
fi

STAGE=$(mktemp -d)
mkdir -p "$STAGE/flyby/player" "$STAGE/assets"
FILELIST=$STAGE/files.txt
find "$DIST/assets" -type f ! -name '*.map' | sort > "$FILELIST"
if [ ! -s "$FILELIST" ]; then
	echo "dist/assets has no files to copy in $DIST" >&2
	exit 1
fi

cp "$DIST/index.html" "$STAGE/flyby/player/index.html"
while IFS= read -r file; do
	[ -n "$file" ] || continue
	rel="assets/${file#"$DIST/assets"/}"
	mkdir -p "$STAGE/$(dirname "$rel")"
	cp "$file" "$STAGE/$rel"
	if [ ! -f "$STAGE/$rel" ]; then
		echo "Failed to stage $rel" >&2
		exit 1
	fi
done < "$FILELIST"

{
	printf '%s\n' "flyby/player/index.html"
	while IFS= read -r file; do
		[ -n "$file" ] || continue
		printf '%s\n' "assets/${file#"$DIST/assets"/}"
	done < "$FILELIST"
} > "$STAGE/flyby/player/VENDOR.txt"

while IFS= read -r rel; do
	[ -n "$rel" ] || continue
	if [ ! -f "$STAGE/$rel" ]; then
		echo "Staged copy missing $rel" >&2
		exit 1
	fi
done < "$STAGE/flyby/player/VENDOR.txt"

{
	printf '%s\n' "$SHA"
	printf '%s\n' "$REF"
} > "$STAGE/flyby/player/SOURCE.txt"

mkdir -p "$PLAYER"
while IFS= read -r rel; do
	[ -n "$rel" ] || continue
	mkdir -p "$ROOT/$(dirname "$rel")"
	cp "$STAGE/$rel" "$ROOT/$rel"
done < "$STAGE/flyby/player/VENDOR.txt"
cp "$STAGE/flyby/player/SOURCE.txt" "$PLAYER/SOURCE.txt"

if [ -f "$LIST" ]; then
	while IFS= read -r old; do
		[ -n "$old" ] || continue
		if ! grep -Fxq "$old" "$STAGE/flyby/player/VENDOR.txt"; then
			rm -f "$ROOT/$old"
		fi
	done < "$LIST"
fi
cp "$STAGE/flyby/player/VENDOR.txt" "$LIST"

echo "Vendored FLYBY2 $SHA ($REF) into flyby/player"
