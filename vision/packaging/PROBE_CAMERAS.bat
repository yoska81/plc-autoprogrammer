@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  VISION SYSTEM - QC  -  Probe cameras
echo ============================================
echo.
echo Checking camera indexes 0, 1, 2 for a connected USB/web camera...
echo (this can take a few seconds per index)
echo.

VISION_SYSTEM_QC.exe --probe-cameras > camera_probe.txt 2>&1
type camera_probe.txt
echo.
echo Result saved to: %cd%\camera_probe.txt
echo.
echo If none of the indexes say AVAILABLE:
echo   - Make sure the camera is plugged in and powered on.
echo   - Close any other app that might be using it ^(Zoom, Teams, Skype,
echo     a browser tab, or another copy of this app^).
echo   - Check Windows Settings - Privacy and security - Camera - make
echo     sure "Let desktop apps access your camera" is turned on.
echo.
pause
