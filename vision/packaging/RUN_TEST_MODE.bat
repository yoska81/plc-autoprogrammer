@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  VISION SYSTEM - QC  -  Test-image mode
echo ============================================
echo.
echo No camera is needed - this uses the bundled sample images.
echo.

VISION_SYSTEM_QC.exe --mode test
if errorlevel 1 (
    echo.
    echo ERROR: VISION_SYSTEM_QC.exe did not start. Make sure this file is
    echo in the same folder as VISION_SYSTEM_QC.exe.
    echo.
)

echo.
echo The app window has closed.
pause
