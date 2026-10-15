# Homepage for Miguel Silvino


Based on [Windows 95](https://h01000110.github.io/20170917/windows-95) by [h01000110](https://h01000110.github.io)

License: [MIT](https://github.com/h01000110/windows-95/blob/master/LICENSE)

## Gallery

Pictures are the **gallery** folder in the file list, beside the category folders. Gallery expands with the +/- box; each tag in the catalog is a folder under it. Opening a tag folder lists only those photos. Filenames, alt text, captions, tags, taken dates, and an optional camera live in `_data/gallery.yml`. Photos are served from `gallery_base_url` in `_config.yml` (`https://gallery.gleebsal.net`, the R2 bucket `gallery`). The folder and the opened photo list the newest `taken` date first. A date with no time is shown as a date only. A blank `taken` is skipped in the window and sorted after the dated photos. Leave the base URL blank only to serve matching files from `assets/img/gallery/`.

Do not commit API tokens or rclone config. Setup steps: [docs/gallery-r2.md](docs/gallery-r2.md).
