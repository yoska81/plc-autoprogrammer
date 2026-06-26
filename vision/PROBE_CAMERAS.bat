@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  VISION SYSTEM - QC  -  Probe cameras
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

rem --- Probe camera indexes 0, 1, 2 -----------------------------------------
echo.
echo Checking camera indexes 0, 1, 2 for a connected USB camera...
echo (this can take a few seconds per index)
echo.
python main.py --probe-cameras > camera_probe.txt 2>&1
type camera_probe.txt
echo.
echo Result saved to: %cd%\camera_probe.txt
echo.
echo If none of the indexes say AVAILABLE:
echo   - Make sure the USB camera is plugged in and powered on.
echo   - Close any other app that might be using it ^(Zoom, Teams, Skype,
echo     a browser tab, or another copy of this app^).
echo   - Check Windows Settings - Privacy and security - Camera - make
echo     sure "Let desktop apps access your camera" is turned on.
echo.
pause
