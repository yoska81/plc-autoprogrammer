# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the VISION SYSTEM - QC desktop app (Windows release build).
# Build with: pyinstaller vision_qc.spec --noconfirm --clean
# Produces a onedir build under dist/VISION_SYSTEM_QC/ containing
# VISION_SYSTEM_QC.exe plus all bundled data, importable by core/config.py's
# frozen-aware VISION_ROOT (Path(sys.executable).resolve().parent).
from pathlib import Path

ROOT = Path(SPECPATH)

a = Analysis(
    [str(ROOT / "ui_main.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        (str(ROOT / "data" / "test_images"), "data/test_images"),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="VISION_SYSTEM_QC",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    # Kept visible for this initial release so the user (and us, during early
    # field testing) can see camera/troubleshooting print() output; revisit
    # once the UI surfaces all of that information itself.
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="VISION_SYSTEM_QC",
)
