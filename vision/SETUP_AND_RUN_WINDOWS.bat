@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  VISION SYSTEM - QC  -  Windows setup + run
echo ============================================
echo.
echo This will:
echo   1. Check that Python is installed
echo   2. Create a private Python environment in .venv (first time only)
echo   3. Install the required packages
echo   4. Check for a USB camera on indexes 0, 1, 2
echo   5. Launch the VISION SYSTEM - QC app
echo.

rem --- 1. Locate Python -----------------------------------------------
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

rem --- 2. Create the virtual environment if missing --------------------
if not exist ".venv\Scripts\activate.bat" (
    echo Creating Python environment in .venv ...
    %PYEXE% -m venv .venv
    if errorlevel 1 (
        echo ERROR: Failed to create the virtual environment.
        echo Make sure Python was installed with the "venv" component
        echo ^(included by default with python.org installers^).
        pause
        exit /b 1
    )
)

rem --- 3. Activate it and install requirements --------------------------
call ".venv\Scripts\activate.bat"
if errorlevel 1 (
    echo ERROR: Failed to activate the virtual environment.
    pause
    exit /b 1
)

echo.
echo Installing requirements - this can take a minute the first time...
python -m pip install --quiet --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install requirements.
    echo Check your internet connection, then double-click this file again.
    pause
    exit /b 1
)
echo Requirements installed.

rem --- 4. Probe for a real camera ---------------------------------------
echo.
echo Checking camera indexes 0, 1, 2 for a connected USB camera...
python main.py --probe-cameras > camera_probe.txt 2>&1
type camera_probe.txt
echo.
echo (Full result saved to camera_probe.txt in this folder.)

rem --- 5. Launch the app -------------------------------------------------
echo.
echo Launching the VISION SYSTEM - QC app...
echo If no camera was found above, it will start in test-image mode
echo automatically, so the app will still open either way.
echo.
python ui_main.py --mode auto

echo.
echo The app window has closed.
pause
