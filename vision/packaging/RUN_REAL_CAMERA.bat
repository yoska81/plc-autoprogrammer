@echo off
setlocal
cd /d "%~dp0"

rem To use a different camera, change the number after --device-index below.
rem Double-click PROBE_CAMERAS.bat first, or use Settings - Detect Cameras
rem inside the app, to see which index is available.
set DEVICE_INDEX=0

echo ============================================
echo  VISION SYSTEM - QC  -  Real camera mode
echo ============================================
echo.
echo Starting with device index %DEVICE_INDEX%.
echo.

VISION_SYSTEM_QC.exe --mode real --device-index %DEVICE_INDEX%
if errorlevel 1 (
    echo.
    echo ERROR: Could not start the real camera. Common causes:
    echo   - No USB/web camera is plugged in / powered on.
    echo   - Another app ^(Zoom, Teams, Skype, a browser tab^) is using it.
    echo   - Wrong device index - try editing DEVICE_INDEX above, or use
    echo     Settings - Detect Cameras inside the app.
    echo   - Windows camera privacy setting is blocking desktop apps:
    echo     Settings - Privacy and security - Camera - allow desktop apps.
    echo.
)

echo.
echo The app window has closed.
pause
