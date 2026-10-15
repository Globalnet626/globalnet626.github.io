How to add a photo
==================

The gallery is a folder in the file list, next to the category folders
such as bio. Open that folder to see each picture as a file. Open a
file to view the picture in a window.

Placeholder pictures in this folder are here so the gallery works
before you add your own.

1. Save an image in this folder:

     assets/img/gallery/

   JPG, PNG, GIF, and SVG all work. A wide photo around 1200 pixels
   across fits the window well.

2. Add a markdown file in _gallery/ (next to the other photo files).
   The filename becomes the address, so my-photo.md opens at
   /gallery/my-photo/.

     ---
     title: Title shown on the file and in the window
     image: my-photo.jpg
     alt: Short description of what is in the photo
     ---

   title  Label under the file icon, the window title, and the caption
          under the picture.
   image  Filename only, not a path. It must match the file you saved
          in this folder.
   alt    Required. Screen readers use it, and it is shown if the
          image cannot load.

3. Commit the image and the markdown file, then push. GitHub Pages
   publishes the new photo on the next build.

To remove a photo, delete its file in _gallery/. You can delete the
image from this folder as well.
