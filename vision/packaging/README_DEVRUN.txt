VISION SYSTEM - QC - Developer Run (source) package
=======================================================

What this is
-------------
A fallback way to run VISION SYSTEM - QC without the prebuilt
VISION_SYSTEM_QC.exe. Use this if Windows Smart App Control (or another
security tool) blocks the EXE because it isn't digitally signed yet.

This runs the exact same app - same screens, same camera handling, same
database - just launched through Python source code instead of a
compiled .exe. There is no unsigned EXE here, so Smart App Control has
nothing to block.

Requirements
-------------
Python 3.10 or newer, installed from https://www.python.org/downloads/
During setup, check the box "Add python.exe to PATH".

You do not need to know any Python - the BAT files below do everything
for you (create a private environment, install the few required
packages, and launch the app).

How to start it
-----------------
1. Unzip this whole folder somewhere on your PC (e.g. your Desktop).
2. Double-click SETUP_AND_RUN_WINDOWS.bat the first time. It will:
     - check that Python is installed (and tell you where to get it if not)
     - create a private ".venv" folder with the required packages
     - check camera indexes 0, 1, 2 for a connected USB camera
     - launch the app (real camera if one was found, test images otherwise)

After that first run, these are quicker / more specific ways to start it:

  INSTALL_REQUIREMENTS.bat   Re-run setup only (no app launch). Useful if
                              you just want to update the installed packages.
  RUN_TEST_MODE.bat          Launch with bundled sample images - no camera
                              needed.
  RUN_REAL_CAMERA.bat        Launch with a real camera at device index 0.
                              Edit the DEVICE_INDEX line near the top of the
                              file if your camera is not at index 0.
  PROBE_CAMERAS.bat          Check device indexes 0, 1, 2 for a connected
                              USB camera and report which one is AVAILABLE.

Day-to-day use and where files are saved
-------------------------------------------
Identical to the EXE package - see README_FOR_WINDOWS_USER.txt for the full
walkthrough (Start Camera, Add/Select Product, Save GOOD Reference, Take
Inspection Picture, Compare, Save Result) and the list of data\... folders
where images, reports, and the database are saved. Everything is saved
inside this same folder, exactly like the EXE package.
