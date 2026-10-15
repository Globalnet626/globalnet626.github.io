Placeholder images
==================

These drawings ship with the site so the gallery folder works before
Cloudflare R2 is set up.

While gallery_base_url in _config.yml is blank, entries in
_data/gallery.yml load the matching filename from this folder.
Harbor at dusk uses harbor.svg, and the other captions match the
other filenames.

After you set gallery_base_url, those filenames are loaded from the
bucket instead. Upload the real photos there and edit
_data/gallery.yml. You can leave these files in the repo; they are
only used when the base URL is blank.

The full steps (bucket, custom domain, upload, CORS, data file) are
in docs/gallery-r2.md.
