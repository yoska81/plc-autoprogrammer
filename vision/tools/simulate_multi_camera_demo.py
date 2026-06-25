"""Demo/simulation script: proves the multi-camera/multi-station architecture
works - independent status, results, and counters per station, with one
camera's failure never affecting the others - using no real camera hardware
at all.

Drives core/camera_manager.py's CameraManager directly (the same engine the
Cameras/Stations UI screen uses) against an isolated temporary database, so
running this script never touches the real vision.db. It registers 3
simulated CAMERA_TYPE_TEST stations (cycling the bundled test images) plus
one CAMERA_TYPE_USB station pointed at a device index with no real hardware
behind it - which goes to ERROR exactly like a real camera that isn't
plugged in - and shows the test stations keep running and producing
independent inspection results regardless.

Run directly:

    python tools/simulate_multi_camera_demo.py
"""
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import config
from core.camera_manager import CameraManager
from core.db import Database

STATION_COUNT = 3
SAMPLE_IMAGE = config.DATA_DIR / "test_images" / "sample_1_panel_good.png"


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="vision_multicam_demo_") as tmp:
        db = Database(Path(tmp) / "demo_multi_camera.db")

        product_id = db.create_product(name="Demo Multi-Cam Product", part_number="DEMO-MC-1")
        angle_id = db.create_angle(product_id, angle_name="Top")
        db.add_reference_image(product_id, angle_id, str(SAMPLE_IMAGE), make_primary=True)

        manager = CameraManager(db, primary_engine=None)

        camera_ids = []
        for i in range(1, STATION_COUNT + 1):
            camera_id = manager.add_camera(
                f"Demo Station {i}", camera_type=config.CAMERA_TYPE_TEST, device_index=i - 1,
                width=640, height=480, fps=10, product_id=product_id, angle_id=angle_id,
                inspection_mode=config.INSPECTION_MODE_FIXED, trigger_source=config.TRIGGER_SOURCE_MANUAL,
            )
            camera_ids.append(camera_id)

        failed_camera_id = manager.add_camera(
            "Demo Station (no hardware)", camera_type=config.CAMERA_TYPE_USB, device_index=97,
            width=640, height=480, fps=10, product_id=product_id, angle_id=angle_id,
            inspection_mode=config.INSPECTION_MODE_FIXED, trigger_source=config.TRIGGER_SOURCE_MANUAL,
        )

        print(f"[simulate_multi_camera_demo] starting {len(camera_ids) + 1} simulated stations "
              f"({len(camera_ids)} test cameras + 1 camera with no hardware behind it)...")
        manager.start_all()
        time.sleep(1.0)

        for camera_id in camera_ids:
            status = manager.get_camera_status(camera_id)
            result = manager.run_inspection(camera_id, trigger_source=config.TRIGGER_SOURCE_MANUAL)
            counters = manager.get_counters(camera_id)
            print(f"  camera {camera_id}: status={status['status']} inspection={result.get('result')} "
                  f"score={result.get('score')} counters={counters}")

        failed_status = manager.get_camera_status(failed_camera_id)
        print(f"  camera {failed_camera_id} (no hardware): status={failed_status['status']} "
              f"last_error={failed_status['last_error']!r}")

        still_live = [c for c in camera_ids if manager.get_camera_status(c)["status"] == config.CAMERA_STATUS_LIVE]
        print(f"[simulate_multi_camera_demo] {len(still_live)}/{len(camera_ids)} test stations remained LIVE "
              "despite the no-hardware station's failure.")
        assert failed_status["status"] == config.CAMERA_STATUS_ERROR, "expected the no-hardware station to error out"
        assert len(still_live) == len(camera_ids), "a sibling station's failure must not stop the others"

        manager.stop_all()
        print("[simulate_multi_camera_demo] OK - stations ran independently; "
              "one camera's failure did not stop the others.")


if __name__ == "__main__":
    main()
