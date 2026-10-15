# Host gallery photos on Cloudflare R2

The gallery folder reads `_data/gallery.yml`. Each entry is a filename, alt text, and caption. The site joins the filename to `gallery_base_url` in `_config.yml`.

Leave `gallery_base_url` blank and the same filenames load from `assets/img/gallery/`. The placeholder drawings work until the bucket is ready. Do not commit API tokens, secret keys, or rclone config.

## 1. Create the bucket

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/) and go to **R2 Object Storage**.
2. Choose **Create bucket**.
3. Name it something like `gleebsal-gallery` and create it.

The bucket can stay private to the S3 API. Visitors read objects through the public custom domain in the next step.

## 2. Connect a custom domain

The site’s domain (`gleebsal.net`) is already on Cloudflare, so the DNS record can be created for you.

1. Open the bucket, then **Settings**.
2. Under **Public access** / **Custom Domains**, choose **Connect Domain**.
3. Enter `photos.gleebsal.net` (or another hostname on a zone in this account).
4. Let Cloudflare add the DNS record. Wait until the domain shows as active.

A photo uploaded as `harbor.jpg` is then available at `https://photos.gleebsal.net/harbor.jpg`.

For a quick test before DNS is ready, the bucket’s **R2.dev subdomain** can be enabled and used as `gallery_base_url`. Switch to the custom domain when it is active. That hostname is public, not a secret, but the custom domain is the one to keep.

## 3. Upload photos

Object keys should match the `file` values in `_data/gallery.yml`. A file named `harbor.jpg` at the bucket root matches `file: harbor.jpg`. Keys can include folders (`trips/harbor.jpg`).

### Dashboard

Open the bucket and use **Upload**. This is enough for a handful of photos.

### rclone

Create an [R2 API token](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) with permission to edit this bucket. Put the access key and secret in rclone’s config on your machine (`rclone config`), not in the git repo.

```
rclone copy ./photos r2:gleebsal-gallery --progress
```

The config uses provider Cloudflare and an endpoint of `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

### wrangler

From a shell that already has the API token, with the token only in the environment:

```
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-token"
npx wrangler r2 object put gleebsal-gallery/harbor.jpg --file ./harbor.jpg --remote
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
gallery_base_url: https://photos.gleebsal.net
```

No trailing slash is required. Leave `gallery_thumb_base_url` blank unless thumbnails live on a different host.

## 6. Add entries

In `_data/gallery.yml`:

```yaml
- file: harbor.jpg
  alt: Small boats moored in a harbor under an orange dusk sky
  caption: Harbor at dusk
```

Optional fields:

```yaml
- file: harbor.jpg
  url: https://photos.gleebsal.net/edited/harbor.jpg
  thumb: thumbs/harbor.jpg
  alt: Small boats moored in a harbor under an orange dusk sky
  caption: Harbor at dusk
  slug: harbor
```

- `url` is a full address for that one picture. It overrides `file` and `gallery_base_url`.
- `thumb` is a smaller image used only in the folder listing, so the listing does not download the full photo. A filename or path is joined to `gallery_thumb_base_url`, or to `gallery_base_url` when that is blank. A value starting with `http://` or `https://` is used as-is. If `thumb` is omitted, the listing shows the usual file icon.
- `slug` is the link id (`/gallery/#harbor`). It defaults to the filename without the extension.

Commit `_config.yml` and `_data/gallery.yml`, then push. GitHub Pages rebuilds the folder. You do not commit the photos themselves.

Remove a picture by deleting its entry. The placeholders at the bottom of `_data/gallery.yml` can be deleted once real photos are listed. With `gallery_base_url` set, a `file` value is requested from R2, not from `assets/img/gallery/`.
