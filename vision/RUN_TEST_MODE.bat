@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  VISION SYSTEM - QC  -  Test-image mode
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

rem --- Run the app in test-image mode --------------------------------------
echo.
echo Starting VISION SYSTEM - QC in TEST-IMAGE mode.
echo No camera is needed - this uses the bundled sample/synthetic images.
echo.
python ui_main.py --mode test

echo.
echo The app window has closed.
pause
