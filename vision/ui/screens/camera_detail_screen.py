from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QDialog, QHBoxLayout, QLabel, QMessageBox, QPushButton, QVBoxLayout

from core import config
from core.app import QCApp

from ..widgets import CountersPanel, ImagePreviewPanel, RegionPlanList, ResultPanel

DETAIL_PREVIEW_INTERVAL_MS = 200


class CameraDetailScreen(QDialog):
    """Non-modal 'Open Full View' window for one station: a large live
    preview (polled the same low-cost way _StationCard already does, via
    CameraManager.get_latest_frame() - never a second camera handle), the
    station's full status/configuration, its Inspection Plan (named regions,
    if the assigned product/angle has any), and an Inspect Now button. Used
    by CamerasScreen so an operator can look closely at one station out of
    many without losing the multi-camera overview."""

    def __init__(self, engine: QCApp, camera_id: int, on_change, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.camera_id = camera_id
        self.on_change = on_change
        self.setModal(False)
        self._build_ui()

        self.timer = QTimer(self)
        self.timer.setInterval(DETAIL_PREVIEW_INTERVAL_MS)
        self.timer.timeout.connect(self._update_preview)
        self.timer.start()

        self.refresh()

    def _build_ui(self) -> None:
        root = QHBoxLayout(self)
        root.setContentsMargins(20, 20, 20, 20)
        root.setSpacing(18)

        left = QVBoxLayout()
        left.setSpacing(12)
        self.preview = ImagePreviewPanel("Live Feed", large=True, live=True, zoomable=True)
        left.addWidget(self.preview, stretch=1)

        status_row = QHBoxLayout()
        self.result_panel = ResultPanel(compact=True)
        status_row.addWidget(self.result_panel, stretch=1)
        self.counters_panel = CountersPanel()
        status_row.addWidget(self.counters_panel)
        left.addLayout(status_row)

        self.inspect_button = QPushButton("Inspect Now")
        self.inspect_button.setObjectName("primaryActionButton")
        self.inspect_button.clicked.connect(self._on_inspect)
        left.addWidget(self.inspect_button)
        root.addLayout(left, stretch=2)

        right = QVBoxLayout()
        right.setSpacing(6)
        self._info_labels: dict[str, QLabel] = {}
        for caption in (
            "Station", "Status", "Connection", "Resolution", "Preview FPS",
            "Inspection Resolution", "Trigger Mode", "Assigned Product",
            "Last Result", "Last Time", "Uptime",
        ):
            row = QHBoxLayout()
            cap = QLabel(caption.upper())
            cap.setObjectName("statusCaption")
            value = QLabel("—")
            value.setObjectName("infoLabel")
            value.setWordWrap(True)
            row.addWidget(cap)
            row.addStretch()
            row.addWidget(value)
            right.addLayout(row)
            self._info_labels[caption] = value

        self.region_plan_panel = RegionPlanList()
        right.addWidget(self.region_plan_panel, stretch=1)
        root.addLayout(right, stretch=1)

    def _on_inspect(self) -> None:
        result = self.engine.camera_manager.run_inspection(self.camera_id, trigger_source=config.TRIGGER_SOURCE_MANUAL)
        if result.get("error"):
            QMessageBox.warning(self, "Inspect Now", result["error"])
        self.refresh()
        self.on_change()

    def _update_preview(self) -> None:
        frame = None
        try:
            frame = self.engine.camera_manager.get_latest_frame(self.camera_id)
        except Exception:
            frame = None
        if frame is not None:
            self.preview.set_frame(frame)

    def refresh(self) -> None:
        camera = self.engine.db.get_camera(self.camera_id)
        if camera is None:
            self.close()
            return
        self.setWindowTitle(f"Full View — {camera['station_name']}")

        status = self.engine.camera_manager.get_camera_status(self.camera_id)
        state = status["status"]
        self.preview.set_live(state == config.CAMERA_STATUS_LIVE)

        product = self.engine.db.get_product(camera["product_id"]) if camera["product_id"] else None
        angle = self.engine.db.get_angle(camera["angle_id"]) if camera["angle_id"] else None
        mode_label = "V2 Free Pose" if camera["inspection_mode"] == config.INSPECTION_MODE_FREE_POSE else "V1 Fixed"

        self._info_labels["Station"].setText(camera["station_name"])
        self._info_labels["Status"].setText(state.upper())
        self._info_labels["Connection"].setText(
            f"{camera['camera_type'].upper()} (index {camera['device_index']})"
            if camera["camera_type"] != "ip" else f"IP: {camera.get('ip_address') or '—'}"
        )
        self._info_labels["Resolution"].setText(f"{camera['width']}x{camera['height']} @ {camera['fps']}fps")
        self._info_labels["Preview FPS"].setText(str(camera.get("preview_fps") or camera["fps"]))
        insp_w, insp_h = camera.get("inspection_width"), camera.get("inspection_height")
        self._info_labels["Inspection Resolution"].setText(
            f"{insp_w}x{insp_h}" if insp_w and insp_h else "Native"
        )
        self._info_labels["Trigger Mode"].setText(f"{camera['trigger_source'].title()} / {mode_label}")
        self._info_labels["Assigned Product"].setText(
            f"{product['name']} / {angle['angle_name']}" if product and angle else "(none)"
        )

        last_rows = self.engine.db.list_inspections(camera_id=self.camera_id, limit=1)
        if last_rows:
            last = last_rows[0]
            self.result_panel.set_result(last["result"], last.get("score"))
            self._info_labels["Last Result"].setText(last["result"])
            self._info_labels["Last Time"].setText(last.get("created_at") or "—")
            if product and angle:
                region_results = self.engine.db.list_region_results(last["id"])
                self.region_plan_panel.set_regions(
                    region_results or self.engine.db.list_regions(product["id"], angle["id"])
                )
            else:
                self.region_plan_panel.clear()
        else:
            self.result_panel.set_result(None, None)
            self._info_labels["Last Result"].setText("—")
            self._info_labels["Last Time"].setText("—")
            if product and angle:
                self.region_plan_panel.set_regions(self.engine.db.list_regions(product["id"], angle["id"]))
            else:
                self.region_plan_panel.clear()

        self._info_labels["Uptime"].setText("Live" if state == config.CAMERA_STATUS_LIVE else "—")

        counters = self.engine.camera_manager.get_counters(self.camera_id)
        self.counters_panel.set_counts(counters)
        self.inspect_button.setEnabled(bool(camera["enabled"]))

    def closeEvent(self, event) -> None:
        self.timer.stop()
        super().closeEvent(event)
