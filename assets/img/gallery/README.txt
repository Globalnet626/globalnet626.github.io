Local fallback only
==================

Live photos are on Cloudflare R2 at https://gallery.gleebsal.net
(bucket name: gallery). Paths and captions are in _data/gallery.yml.

This folder is used only when gallery_base_url in _config.yml is
blank. Put a file here at the same relative path as `file` in that
catalog if you need the site to work without the bucket.

Setup steps are in docs/gallery-r2.md.
