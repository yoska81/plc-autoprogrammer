VISION SYSTEM - QC
====================

What this is
-------------
A Windows desktop app that uses your PC and a USB camera (tested with an
SVPRO USB UVC camera, 1080p/60fps, manual-zoom lens) to take snapshots,
compare them against saved "GOOD" reference photos, decide GOOD or BAD,
and keep a log of every result. Everything runs on this PC - there is no
PLC, no cloud service, and no extra hardware required to use it. A future
version may exchange a simple trigger/result signal with a PLC, but the PC
stays in charge of the camera, the database, and every decision either way.

How to start it
-----------------
1. Unzip this whole folder somewhere on your PC (e.g. your Desktop).
2. Double-click VISION_SYSTEM_QC.exe.
3. Go to the "Camera Setup" tab, set the camera index/resolution/FPS, and
   click "Start Preview" to confirm you can see the camera image.
4. Go to the "Inspection" tab and click "Start Camera" to begin working.

That's it - no Python, no installers, no typing commands.

The black console window
--------------------------
A plain black text window opens behind the app. This is normal - it shows
status and error messages (for example, if a camera can't be found) that
are useful for troubleshooting. Leave it open while you use the app; it
closes automatically when you close the main app window.

If the camera shows an error
-------------------------------
- Make sure the USB camera is plugged in and powered on.
- Close other apps that might be using the camera (Zoom, Teams, Skype, a
  browser tab with camera access, or another copy of this app).
- Go to the "Camera Setup" tab and click "Detect Cameras" to see which
  device index responds, then set that index and click "Apply".
- Check Windows Settings > Privacy & security > Camera > make sure
  "Let desktop apps access your camera" is turned on.
- If you don't have a camera handy yet, double-click RUN_TEST_MODE.bat
  instead - it runs the app with bundled sample images so you can try
  everything else (saving a reference, comparing, reports) first.

Once the camera is framed and working, lock its physical mount, lock the
lens's zoom/focus/aperture rings by hand, and keep the lighting stable -
the app has no automatic re-alignment, so moving the camera or relighting
the scene means old GOOD references no longer match.

Optional helper files in this folder
---------------------------------------
You do not need these to use the app - double-clicking VISION_SYSTEM_QC.exe
directly is enough. They're shortcuts for specific situations:

  RUN_TEST_MODE.bat    Opens the app using bundled sample images instead
                        of a real camera. Useful with no camera attached.
  RUN_REAL_CAMERA.bat   Opens the app with a real camera at device index 0.
                        Edit the DEVICE_INDEX line near the top of the file
                        if your camera is not at index 0.
  PROBE_CAMERAS.bat     Checks device indexes 0, 1, 2 and reports which one
                        is AVAILABLE, saving the result to
                        camera_probe.txt. The app's Camera Setup > Detect
                        Cameras button does the same thing.

Basic day-to-day use
-----------------------
1. Inspection tab: Start Camera.
2. Add Product (type a product name and an angle, e.g. "Widget A" /
   "Front") or Select Product if it already exists.
3. Save GOOD Reference once, with a known-good part in view (or use the
   References tab to manage multiple reference shots and pick which one
   is primary).
4. For each part you inspect: Take Inspection Picture, then Compare.
5. Save Result to log it and (if BAD) archive the image for review.
6. Open Bad Products Folder any time, or go to the Reports tab to filter
   history and export it to CSV or Excel.

Where things are saved
-------------------------
All data is saved inside this same folder:

  data\products\<product>\<angle>\reference\   GOOD reference images
  data\products\<product>\<angle>\inspection\  captured inspection images
  data\difference_images\<product>\<angle>\    diff images from comparisons
  data\bad_products\<product>\<angle>\         archived BAD images
  data\reports\                                exported CSV/Excel reports
  database\vision.db                           the inspection database

Moving or deleting this folder removes that history, so back it up if you
want to keep it.
