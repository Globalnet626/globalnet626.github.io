# Homepage for Miguel Silvino


Based on [Windows 95](https://h01000110.github.io/20170917/windows-95) by [h01000110](https://h01000110.github.io)

License: [MIT](https://github.com/h01000110/windows-95/blob/master/LICENSE)

## Gallery

Pictures are the **gallery** folder in the file list, beside the category folders. Gallery expands with the +/- box; each tag in the catalog is a folder under it. Opening a tag folder lists only those photos. Filenames, alt text, captions, tags, taken dates, and an optional camera live in `_data/gallery.yml`. Photos are served from `gallery_base_url` in `_config.yml` (`https://gallery.gleebsal.net`, the R2 bucket `gallery`). The folder and the opened photo list the newest `taken` date first. A date with no time is shown as a date only. A blank `taken` is skipped in the window and sorted after the dated photos. Leave the base URL blank only to serve matching files from `assets/img/gallery/`.

Do not commit API tokens or rclone config. Setup steps: [docs/gallery-r2.md](docs/gallery-r2.md).

## Disk Defragmenter

`defrag.exe` in the home file list opens `/defrag/`. It is a cosmetic Windows 95 Disk Defragmenter: the cluster map, progress bar, and dialogs are drawn in the browser and nothing is read from or written to a disk. Settings has an ASMR tick, generated with the Web Audio API and off unless the checkbox is on. That choice is stored in `localStorage` under `gleebsal-defrag-asmr`. The 1× / 2× speed applies only to the current run.

### Photos in a post

In a file under `_posts`, embed a catalog photo by its gallery key (the `file` path without `.webp`):

```liquid
{% include photo.html key="nightwalk/untitled_nightwalk-3" %}
{% include photo.html key="mecha/red-zaku-sniper" caption="Optional caption" %}
```

Caption, alt text, and the date and camera fields come from `_data/gallery.yml`. The picture is the thumb when the entry has one, otherwise the full `.webp` on `gallery_base_url`, and it loads lazily. Clicking it opens that photo in the gallery viewer (`/gallery/#…`). A key that is in neither catalog still shows an image from the same host and opens that file directly.

A post-only photo is the same include, with a key from `_data/post_photos.yml` (for example `posts/why-photography/untitled_post-1`). Those objects live under `posts/<post-slug>/` on the same host: `<name>.webp` is the full image and `<name>-1200.webp` is what the post shows. `taken`, `camera`, `lens`, `fstop`, `iso`, `shutter`, and `focal` use the same names as `_data/gallery.yml` and render the same way. They are not listed in the gallery, its tag folders, or the object counts. Clicking one opens the full image in a viewer on the post page, not in `/gallery/`.

```liquid
{% include photo.html key="posts/why-photography/untitled_post-1" %}
```

A row that wraps on a narrow screen. Keys may mix both catalogs:

```liquid
{% include photos.html keys="dog/untitled_dog-1, figures/smart-falcon, nightwalk/untitled_nightwalk-1" %}
```
