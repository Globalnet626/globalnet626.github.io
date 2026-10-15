How to add a photo
==================

The gallery page (/gallery/, linked as "Photos" in the top bar) reads
its list from _data/gallery.yml. Placeholder pictures in this folder
are here so the page works before you add your own.

1. Save an image in this folder:

     assets/img/gallery/

   JPG, PNG, GIF, and SVG all work. A wide photo around 1200 pixels
   across looks best in the detail view.

2. Add an entry to _data/gallery.yml, in the site root:

     - file: my-photo.jpg
       alt: Short description of what is in the photo
       caption: Title shown under the thumbnail

   file   Filename only, not a path. It must match the file you saved.
   alt    Required. Screen readers use it, and it is shown if the
          image cannot load.
   caption  Label under the thumbnail and in the detail view.

3. Commit the image and the _data/gallery.yml change, then push.
   GitHub Pages publishes the new photo on the next build.

To remove a photo, delete its entry from _data/gallery.yml. You can
delete the image file as well. Removing every entry leaves a short
empty-state note on the gallery page.
