@echo off
setlocal
cd /d "%~dp0"

rem To use a different camera, change the number after --device-index below.
rem Double-click PROBE_CAMERAS.bat first to see which index says AVAILABLE.
set DEVICE_INDEX=0

echo ============================================
echo  VISION SYSTEM - QC  -  Real camera mode
echo ============================================
echo.

rem --- Locate Python ----------------------------------------------------
where python >nul 2>nul
if %errorlevel%==0 (
    set "PYEXE=python"
) else (
    where py >nul 2>nul
    if %errorlevel%==0 (
        set "PYEXE=py -3"
    ) else (
        echo ERROR: Python was not found on this PC.
        echo.
        echo Install Python 3.10 or newer from https://www.python.org/downloads/
        echo During setup, check the box "Add python.exe to PATH", then
        echo double-click this file again.
        echo.
        pause
        exit /b 1
    )
)

rem --- Create the virtual environment if missing -------------------------
if not exist ".venv\Scripts\activate.bat" (
    echo Creating Python environment in .venv ...
    %PYEXE% -m venv .venv
    if errorlevel 1 (
        echo ERROR: Failed to create the virtual environment.
        pause
        exit /b 1
    )
)

rem --- Activate it and install requirements --------------------------------
call ".venv\Scripts\activate.bat"
if errorlevel 1 (
    echo ERROR: Failed to activate the virtual environment.
    pause
    exit /b 1
)

python -m pip install --quiet --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install requirements.
    echo Check your internet connection, then double-click this file again.
    pause
    exit /b 1
)

rem --- Run the app with a real USB camera -----------------------------------
echo.
echo Starting VISION SYSTEM - QC in REAL CAMERA mode, device index %DEVICE_INDEX%.
echo.
echo If this is not your camera, or the app does not start:
echo   1. Double-click PROBE_CAMERAS.bat to see which index is AVAILABLE.
echo   2. Right-click this file, choose Edit, change the number after
echo      "set DEVICE_INDEX=" near the top, save, and double-click again.
echo.
python ui_main.py --mode real --device-index %DEVICE_INDEX%
if errorlevel 1 (
    echo.
    echo ERROR: Could not start the real camera. Common causes:
    echo   - No USB camera is plugged in / powered on.
    echo   - Another app ^(Zoom, Teams, Skype, a browser tab^) is using it.
    echo   - Wrong device index - run PROBE_CAMERAS.bat to check.
    echo   - Windows camera privacy setting is blocking desktop apps:
    echo     Settings - Privacy and security - Camera - allow desktop apps.
    echo.
)

echo.
echo The app window has closed.
pause
