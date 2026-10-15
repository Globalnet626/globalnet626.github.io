# Host gallery photos on Cloudflare R2

The gallery folder reads `_data/gallery.yml`. Each entry is a path, alt text, and caption, plus optional tags and a taken time. The site joins the path to `gallery_base_url` in `_config.yml`.

The live bucket is named `gallery`. Its custom domain is `https://gallery.gleebsal.net`. Leave `gallery_base_url` blank and the same paths load from `assets/img/gallery/`. Do not commit API tokens, secret keys, or rclone config.

## 1. Create the bucket

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/) and go to **R2 Object Storage**.
2. Choose **Create bucket**.
3. Name it `gallery` and create it.

The bucket can stay private to the S3 API. Visitors read objects through the public custom domain in the next step.

## 2. Connect a custom domain

The site’s domain (`gleebsal.net`) is already on Cloudflare, so the DNS record can be created for you.

1. Open the bucket, then **Settings**.
2. Under **Public access** / **Custom Domains**, choose **Connect Domain**.
3. Enter `gallery.gleebsal.net` (or another hostname on a zone in this account).
4. Let Cloudflare add the DNS record. Wait until the domain shows as active.

A photo uploaded as `mecha/red-zaku-sniper.webp` is then available at `https://gallery.gleebsal.net/mecha/red-zaku-sniper.webp`.

For a quick test before DNS is ready, the bucket’s **R2.dev subdomain** can be enabled and used as `gallery_base_url`. Switch to the custom domain when it is active. That hostname is public, not a secret, but the custom domain is the one to keep.

## 3. Upload photos

Object keys should match the `file` values in `_data/gallery.yml`. A file named `mecha/red-zaku-sniper.webp` matches `file: mecha/red-zaku-sniper.webp`. Thumbnails for the folder listing live beside them, for example `mecha/thumbs/red-zaku-sniper.webp` (320×320).

### Dashboard

Open the bucket and use **Upload**. This is enough for a handful of photos.

### rclone

Create an [R2 API token](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) with permission to edit this bucket. Put the access key and secret in rclone’s config on your machine (`rclone config`), not in the git repo.

```
rclone copy ./photos r2:gallery --progress
```

The config uses provider Cloudflare and an endpoint of `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

### wrangler

From a shell that already has the API token, with the token only in the environment:

```
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-token"
npx wrangler r2 object put gallery/mecha/red-zaku-sniper.webp --file ./red-zaku-sniper.webp --remote
```

Do not write the token into a file that gets committed. `.gitignore` ignores `.env` and `rclone.conf`.

## 4. CORS

A normal `<img>` tag does not need CORS. Skip this step unless some other script will `fetch` the image or draw it to a canvas.

If you do need it, open the bucket **Settings**, edit the **CORS policy**, and allow `GET` from the site:

```json
[
  {
    "AllowedOrigins": ["https://gleebsal.net", "https://globalnet626.github.io"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## 5. Point the site at the bucket

In `_config.yml`:

```yaml
gallery_base_url: https://gallery.gleebsal.net
```

No trailing slash is required. Leave `gallery_thumb_base_url` blank unless thumbnails live on a different host.

## 6. Add entries

In `_data/gallery.yml`:

```yaml
- file: mecha/zeta-starburst.webp
  thumb: mecha/thumbs/zeta-starburst.webp
  alt: Zeta Gundam model aiming a rifle against a bright starburst over a planet's horizon
  caption: Zeta starburst
  tags: [mecha]
  taken: "2023-08-17T23:54:46"
  camera: Pixel 7
  slug: zeta-starburst
```

A date with no clock time stays a date in the window:

```yaml
- file: mecha/red-zaku-sniper.webp
  caption: Red Zaku sniper
  alt: Red Zaku model aiming a long sniper rifle from a dark mobile armor base lit in red
  tags: [mecha]
  taken: "2018-12-20"
  camera: Samsung Galaxy S8
```

- `url` is a full address for that one picture. It overrides `file` and `gallery_base_url`.
- `thumb` is a smaller image used in the folder listing. A filename or path is joined to `gallery_thumb_base_url`, or to `gallery_base_url` when that is blank. A value starting with `http://` or `https://` is used as-is. If `thumb` is omitted, the listing uses the full image. If that image fails to load, the picture icon is shown instead.
- `tags` is a list. Each tag is shown under the thumbnail and in the opened photo, in the style of file properties (`Tags: mecha`).
- `taken` is a date (`2018-12-20`) or an ISO datetime (`2023-08-17T23:54:46`). Quote it so a date-only value is not given a midnight time. The folder and the opened photo sort newest first. A date with no time is shown as a date only. Leave `taken` blank when there is no date: the photo still appears, after the dated ones, and the window omits the Taken line.
- `camera` is an optional name, shown in the opened photo (`Camera: Pixel 7`).
- `slug` is the link id (`/gallery/#zeta-starburst`). It defaults to the filename without the extension.

Commit `_config.yml` and `_data/gallery.yml`, then push. GitHub Pages rebuilds the folder. You do not commit the photos themselves.

Remove a picture by deleting its entry. With `gallery_base_url` set, a `file` value is requested from R2, not from `assets/img/gallery/`.
