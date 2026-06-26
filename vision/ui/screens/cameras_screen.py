from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QAbstractItemView, QFrame, QGridLayout, QHBoxLayout, QLabel, QMessageBox,
    QPushButton, QScrollArea, QSlider, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget,
)

from core import config
from core.app import QCApp

from ..dialogs import AddEditCameraDialog
from ..widgets import ImagePreviewPanel
from .camera_detail_screen import CameraDetailScreen

_ID_ROLE = Qt.ItemDataRole.UserRole

GRID_COLUMNS = 4

_TILE_SIZE_MIN = 200
_TILE_SIZE_MAX = 460
_TILE_SIZE_DEFAULT = 300

_LIST_COLUMNS = ["Station", "Status", "Result", "Score", "Counters"]

_STATUS_DOT_STYLE = {
    config.CAMERA_STATUS_LIVE: "statusDotGood",
    config.CAMERA_STATUS_STARTING: "statusDotWarn",
    config.CAMERA_STATUS_ERROR: "statusDotBad",
    config.CAMERA_STATUS_OFFLINE: "statusDotBad",
    config.CAMERA_STATUS_STOPPED: "statusDotWarn",
}

_RESULT_STYLE = {
    "GOOD": "counterValueGood",
    "BAD": "counterValueBad",
}


class _StationCard(QFrame):
    """One Multi Camera Overview tile: station name, status dot, a low-FPS
    thumbnail (ImagePreviewPanel, refreshed by the screen's overview timer -
    never the full-resolution/full-FPS feed), last result/score/time, and
    per-station counters. Start/Stop/Inspect Now act on this one station."""

    def __init__(self, parent=None, preview_size: tuple[int, int] = (300, 200)):
        super().__init__(parent)
        self.setObjectName("panelCard")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 12, 14, 12)
        layout.setSpacing(8)

        header = QHBoxLayout()
        self.name_label = QLabel("")
        self.name_label.setObjectName("infoValue")
        header.addWidget(self.name_label)
        header.addStretch()
        self.status_dot = QLabel("●")
        self.status_text = QLabel("")
        self.status_text.setObjectName("topBarStatus")
        header.addWidget(self.status_dot)
        header.addWidget(self.status_text)
        layout.addLayout(header)

        self.preview = ImagePreviewPanel("Preview", large=False, live=True, preview_size=preview_size)
        layout.addWidget(self.preview)

        self.result_label = QLabel("—")
        self.result_label.setObjectName("counterValue")
        layout.addWidget(self.result_label)

        info_row = QHBoxLayout()
        self.score_label = QLabel("Score: —")
        self.score_label.setObjectName("infoLabel")
        self.time_label = QLabel("—")
        self.time_label.setObjectName("infoLabel")
        info_row.addWidget(self.score_label)
        info_row.addStretch()
        info_row.addWidget(self.time_label)
        layout.addLayout(info_row)

        self.counters_label = QLabel("")
        self.counters_label.setObjectName("infoLabel")
        self.counters_label.setWordWrap(True)
        layout.addWidget(self.counters_label)

        button_row = QHBoxLayout()
        button_row.setSpacing(6)
        self.start_button = QPushButton("Start")
        self.stop_button = QPushButton("Stop")
        button_row.addWidget(self.start_button)
        button_row.addWidget(self.stop_button)
        layout.addLayout(button_row)

        self.inspect_button = QPushButton("Inspect Now")
        layout.addWidget(self.inspect_button)

        self.open_full_view_button = QPushButton("Open Full View")
        self.open_full_view_button.setObjectName("secondaryActionButton")
        layout.addWidget(self.open_full_view_button)


class CamerasScreen(QWidget):
    """Cameras / Stations screen: configure up to config.MAX_CAMERAS stations
    (left, "STATIONS") and monitor all of them at once (right, "MULTI CAMERA
    OVERVIEW"). Station 1 - the existing single-camera Inspection tab
    workflow - is listed and monitored here exactly like any other station,
    but core/camera_manager.py delegates all of its start/stop/capture calls
    straight back to the QCApp engine, so this screen never opens a second
    handle to that camera or duplicates its configuration."""

    def __init__(self, engine: QCApp, on_change, parent=None):
        super().__init__(parent)
        self.engine = engine
        self.on_change = on_change
        self._cards: dict[int, _StationCard] = {}
        self._list_rows: dict[int, int] = {}
        self._detail_windows: dict[int, CameraDetailScreen] = {}
        self._view_mode = "tile"
        self._tile_size = (_TILE_SIZE_DEFAULT, int(_TILE_SIZE_DEFAULT * 2 / 3))
        self._build_ui()

        self.overview_timer = QTimer(self)
        self.overview_timer.setInterval(config.OVERVIEW_THUMBNAIL_REFRESH_MS)
        self.overview_timer.timeout.connect(self._update_overview)
        self.overview_timer.start()

        self.refresh()

    def _build_ui(self) -> None:
        root = QHBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 20)
        root.setSpacing(18)

        left_card = QFrame()
        left_card.setObjectName("panelCard")
        left = QVBoxLayout(left_card)
        left.setContentsMargins(20, 20, 20, 20)
        left.setSpacing(12)
        title = QLabel("STATIONS")
        title.setObjectName("panelTitle")
        left.addWidget(title)

        self.station_table = QTableWidget(0, 5)
        self.station_table.setHorizontalHeaderLabels(["Station", "Type", "Product", "Mode", "Enabled"])
        self.station_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.station_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.station_table.verticalHeader().setVisible(False)
        self.station_table.verticalHeader().setDefaultSectionSize(38)
        self.station_table.horizontalHeader().setStretchLastSection(True)
        left.addWidget(self.station_table)

        button_row = QHBoxLayout()
        button_row.setSpacing(8)
        add_button = QPushButton("Add Station")
        add_button.clicked.connect(self._on_add)
        edit_button = QPushButton("Edit Station")
        edit_button.clicked.connect(self._on_edit)
        toggle_button = QPushButton("Enable/Disable")
        toggle_button.clicked.connect(self._on_toggle_enabled)
        delete_button = QPushButton("Delete Station")
        delete_button.setObjectName("dangerButton")
        delete_button.clicked.connect(self._on_delete)
        for button in (add_button, edit_button, toggle_button, delete_button):
            button_row.addWidget(button)
        left.addLayout(button_row)

        selected_row = QHBoxLayout()
        selected_row.setSpacing(8)
        start_selected_button = QPushButton("Start Selected")
        start_selected_button.clicked.connect(self._on_start_selected)
        stop_selected_button = QPushButton("Stop Selected")
        stop_selected_button.clicked.connect(self._on_stop_selected)
        test_selected_button = QPushButton("Test Selected")
        test_selected_button.clicked.connect(self._on_test_selected)
        open_full_view_button = QPushButton("Open Full View")
        open_full_view_button.clicked.connect(self._on_open_full_view_selected)
        for button in (start_selected_button, stop_selected_button, test_selected_button, open_full_view_button):
            selected_row.addWidget(button)
        left.addLayout(selected_row)

        all_row = QHBoxLayout()
        all_row.setSpacing(8)
        start_all_button = QPushButton("Start All")
        start_all_button.clicked.connect(self._on_start_all)
        stop_all_button = QPushButton("Stop All")
        stop_all_button.clicked.connect(self._on_stop_all)
        all_row.addWidget(start_all_button)
        all_row.addWidget(stop_all_button)
        left.addLayout(all_row)

        root.addWidget(left_card, stretch=2)

        right_card = QFrame()
        right_card.setObjectName("panelCard")
        right = QVBoxLayout(right_card)
        right.setContentsMargins(20, 20, 20, 20)
        right.setSpacing(12)
        toolbar = QHBoxLayout()
        overview_title = QLabel("MULTI CAMERA OVERVIEW")
        overview_title.setObjectName("panelTitle")
        toolbar.addWidget(overview_title)
        toolbar.addStretch()

        self.tile_view_button = QPushButton("Tile")
        self.tile_view_button.setCheckable(True)
        self.tile_view_button.setChecked(True)
        self.tile_view_button.clicked.connect(lambda: self._set_view_mode("tile"))
        self.list_view_button = QPushButton("List")
        self.list_view_button.setCheckable(True)
        self.list_view_button.clicked.connect(lambda: self._set_view_mode("list"))
        toolbar.addWidget(self.tile_view_button)
        toolbar.addWidget(self.list_view_button)

        toolbar.addSpacing(12)
        size_caption = QLabel("Tile Size")
        size_caption.setObjectName("infoLabel")
        toolbar.addWidget(size_caption)
        self.tile_size_slider = QSlider(Qt.Orientation.Horizontal)
        self.tile_size_slider.setMinimum(_TILE_SIZE_MIN)
        self.tile_size_slider.setMaximum(_TILE_SIZE_MAX)
        self.tile_size_slider.setValue(_TILE_SIZE_DEFAULT)
        self.tile_size_slider.setFixedWidth(120)
        self.tile_size_slider.valueChanged.connect(self._on_tile_size_changed)
        toolbar.addWidget(self.tile_size_slider)
        right.addLayout(toolbar)

        self.warning_label = QLabel("")
        self.warning_label.setObjectName("counterValueWarn")
        self.warning_label.setWordWrap(True)
        self.warning_label.setVisible(False)
        right.addWidget(self.warning_label)

        self.tile_scroll = QScrollArea()
        self.tile_scroll.setWidgetResizable(True)
        self.tile_scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.grid_container = QWidget()
        self.grid_layout = QGridLayout(self.grid_container)
        self.grid_layout.setSpacing(14)
        self.tile_scroll.setWidget(self.grid_container)
        right.addWidget(self.tile_scroll, stretch=1)

        self.list_table = QTableWidget(0, len(_LIST_COLUMNS) + 1)
        self.list_table.setHorizontalHeaderLabels(_LIST_COLUMNS + ["Actions"])
        self.list_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.list_table.verticalHeader().setVisible(False)
        self.list_table.verticalHeader().setDefaultSectionSize(40)
        self.list_table.horizontalHeader().setStretchLastSection(True)
        self.list_table.setVisible(False)
        right.addWidget(self.list_table, stretch=1)

        root.addWidget(right_card, stretch=3)

    # ------------------------------------------------------------- helpers

    def _selected_camera_id(self) -> int | None:
        row = self.station_table.currentRow()
        if row < 0:
            return None
        item = self.station_table.item(row, 0)
        return item.data(_ID_ROLE) if item else None

    # ------------------------------------------------------------- actions

    def _on_add(self) -> None:
        if len(self.engine.db.list_cameras()) >= config.MAX_CAMERAS:
            QMessageBox.warning(self, "Add Station", f"Maximum of {config.MAX_CAMERAS} cameras/stations reached.")
            return
        dialog = AddEditCameraDialog(self.engine.db, self)
        if dialog.exec() != AddEditCameraDialog.DialogCode.Accepted:
            return
        self.engine.camera_manager.add_camera(**dialog.values())
        self.refresh()
        self.on_change()

    def _on_edit(self) -> None:
        camera_id = self._selected_camera_id()
        if camera_id is None:
            QMessageBox.warning(self, "Edit Station", "Select a station first.")
            return
        camera = self.engine.db.get_camera(camera_id)
        if camera["is_primary_station"]:
            QMessageBox.information(
                self, "Edit Station",
                "Station 1 is the main Inspection tab camera - configure it from the "
                "Camera Setup and Inspection tabs instead.")
            return
        dialog = AddEditCameraDialog(self.engine.db, self, camera=camera)
        if dialog.exec() != AddEditCameraDialog.DialogCode.Accepted:
            return
        self.engine.db.update_camera(camera_id, **dialog.values())
        self.refresh()
        self.on_change()

    def _on_toggle_enabled(self) -> None:
        camera_id = self._selected_camera_id()
        if camera_id is None:
            QMessageBox.warning(self, "Enable/Disable", "Select a station first.")
            return
        camera = self.engine.db.get_camera(camera_id)
        self.engine.db.set_camera_enabled(camera_id, not camera["enabled"])
        self.refresh()
        self.on_change()

    def _on_delete(self) -> None:
        camera_id = self._selected_camera_id()
        if camera_id is None:
            QMessageBox.warning(self, "Delete Station", "Select a station first.")
            return
        camera = self.engine.db.get_camera(camera_id)
        if camera["is_primary_station"]:
            QMessageBox.warning(self, "Delete Station", "Station 1 (the main Inspection tab camera) cannot be deleted.")
            return
        reply = QMessageBox.question(
            self, "Delete Station",
            f"Delete station '{camera['station_name']}'? This cannot be undone.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return
        self.engine.camera_manager.remove_camera(camera_id)
        self.refresh()
        self.on_change()

    def _on_start_selected(self) -> None:
        camera_id = self._selected_camera_id()
        if camera_id is None:
            QMessageBox.warning(self, "Start Station", "Select a station first.")
            return
        self._on_start(camera_id)

    def _on_stop_selected(self) -> None:
        camera_id = self._selected_camera_id()
        if camera_id is None:
            QMessageBox.warning(self, "Stop Station", "Select a station first.")
            return
        self._on_stop(camera_id)

    def _on_test_selected(self) -> None:
        camera_id = self._selected_camera_id()
        if camera_id is None:
            QMessageBox.warning(self, "Test Station", "Select a station first.")
            return
        self._on_inspect(camera_id)

    def _on_start_all(self) -> None:
        self.engine.camera_manager.start_all()
        self.refresh()
        self.on_change()

    def _on_stop_all(self) -> None:
        self.engine.camera_manager.stop_all()
        self.refresh()
        self.on_change()

    def _on_start(self, camera_id: int) -> None:
        try:
            self.engine.camera_manager.start_camera(camera_id)
        except Exception as exc:
            QMessageBox.warning(self, "Start Station", str(exc))
        self.refresh()
        self.on_change()

    def _on_stop(self, camera_id: int) -> None:
        self.engine.camera_manager.stop_camera(camera_id)
        self.refresh()
        self.on_change()

    def _on_inspect(self, camera_id: int) -> None:
        result = self.engine.camera_manager.run_inspection(camera_id, trigger_source=config.TRIGGER_SOURCE_MANUAL)
        if result.get("error"):
            QMessageBox.warning(self, "Inspect Now", result["error"])
        self._update_overview()
        self.on_change()

    def _on_open_full_view_selected(self) -> None:
        camera_id = self._selected_camera_id()
        if camera_id is None:
            QMessageBox.warning(self, "Open Full View", "Select a station first.")
            return
        self._on_open_full_view(camera_id)

    def _on_open_full_view(self, camera_id: int) -> None:
        window = self._detail_windows.get(camera_id)
        if window is not None:
            window.refresh()
            window.show()
            window.raise_()
            window.activateWindow()
            return
        window = CameraDetailScreen(self.engine, camera_id, self.on_change, parent=self)
        window.finished.connect(lambda _result, cid=camera_id: self._detail_windows.pop(cid, None))
        self._detail_windows[camera_id] = window
        window.show()

    def _set_view_mode(self, mode: str) -> None:
        self._view_mode = mode
        self.tile_view_button.setChecked(mode == "tile")
        self.list_view_button.setChecked(mode == "list")
        self.tile_scroll.setVisible(mode == "tile")
        self.list_table.setVisible(mode == "list")

    def _on_tile_size_changed(self, value: int) -> None:
        self._tile_size = (value, int(value * 2 / 3))
        for card in self._cards.values():
            card.preview.set_preview_size(self._tile_size)

    # ------------------------------------------------------------ refresh

    def refresh(self) -> None:
        self._refresh_table()
        self._rebuild_overview()
        self._update_overview()

    def _refresh_table(self) -> None:
        selected_id = self._selected_camera_id()
        cameras = self.engine.db.list_cameras()
        self.station_table.setRowCount(len(cameras))
        matched_row = None
        for r, camera in enumerate(cameras):
            product = self.engine.db.get_product(camera["product_id"]) if camera["product_id"] else None
            mode_label = "V2 Free Pose" if camera["inspection_mode"] == config.INSPECTION_MODE_FREE_POSE else "V1 Fixed"
            station_label = camera["station_name"] + (" (Station 1)" if camera["is_primary_station"] else "")
            values = [
                station_label, camera["camera_type"].upper(),
                product["name"] if product else "(none)", mode_label,
                "Yes" if camera["enabled"] else "No",
            ]
            for c, value in enumerate(values):
                item = QTableWidgetItem(value)
                if c == 0:
                    item.setData(_ID_ROLE, camera["id"])
                self.station_table.setItem(r, c, item)
            if selected_id == camera["id"]:
                matched_row = r
        if matched_row is not None:
            self.station_table.selectRow(matched_row)
        elif cameras:
            self.station_table.selectRow(0)

    def _rebuild_overview(self) -> None:
        """Adds/removes cards to match the current station list. Card
        contents are filled in separately by _update_overview() so the 1Hz
        timer tick never has to tear down and rebuild the grid layout."""
        cameras = self.engine.db.list_cameras()
        current_ids = {camera["id"] for camera in cameras}
        for camera_id in list(self._cards):
            if camera_id not in current_ids:
                card = self._cards.pop(camera_id)
                self.grid_layout.removeWidget(card)
                card.deleteLater()

        for index, camera in enumerate(cameras):
            card = self._cards.get(camera["id"])
            if card is None:
                card = _StationCard(preview_size=self._tile_size)
                card.start_button.clicked.connect(lambda _checked=False, cid=camera["id"]: self._on_start(cid))
                card.stop_button.clicked.connect(lambda _checked=False, cid=camera["id"]: self._on_stop(cid))
                card.inspect_button.clicked.connect(lambda _checked=False, cid=camera["id"]: self._on_inspect(cid))
                card.open_full_view_button.clicked.connect(
                    lambda _checked=False, cid=camera["id"]: self._on_open_full_view(cid))
                self._cards[camera["id"]] = card
            row, col = divmod(index, GRID_COLUMNS)
            self.grid_layout.addWidget(card, row, col)

        self._rebuild_list_rows(cameras)

        # Many-cameras safeguard: warn rather than silently degrade if a lot
        # of stations are configured for high resolution/FPS at once - see
        # README.md / SPECIFICATION.md hardware planning notes.
        enabled = [camera for camera in cameras if camera["enabled"]]
        high_load = [
            camera for camera in enabled
            if (camera["width"] or 0) * (camera["height"] or 0) >= 1920 * 1080 or (camera["fps"] or 0) > 15
        ]
        if len(enabled) >= config.MANY_CAMERAS_WARNING_THRESHOLD and high_load:
            self.warning_label.setText(
                f"⚠ {len(enabled)} stations are enabled, {len(high_load)} of them at high "
                "resolution/FPS. Running that many full-resolution cameras on one PC over USB can "
                "overload CPU/USB bandwidth - prefer GigE/PoE industrial cameras, lower per-station "
                "resolution/FPS, or split stations across multiple PCs (see the hardware planning "
                "notes in README.md / SPECIFICATION.md)."
            )
            self.warning_label.setVisible(True)
        else:
            self.warning_label.setVisible(False)

    def _rebuild_list_rows(self, cameras: list[dict]) -> None:
        """Full rebuild of the List-mode table (Station/Status/Result/Score/
        Counters/Actions). Cheap and only runs from _rebuild_overview() (on
        refresh(), not the 1Hz overview timer), unlike _update_overview()
        which just edits existing cells/widgets in place every tick."""
        self.list_table.setRowCount(len(cameras))
        self._list_rows = {}
        for row, camera in enumerate(cameras):
            self._list_rows[camera["id"]] = row
            station_item = QTableWidgetItem(camera["station_name"])
            station_item.setData(_ID_ROLE, camera["id"])
            self.list_table.setItem(row, 0, station_item)
            for col in range(1, len(_LIST_COLUMNS)):
                self.list_table.setItem(row, col, QTableWidgetItem("—"))

            actions = QWidget()
            actions_row = QHBoxLayout(actions)
            actions_row.setContentsMargins(2, 2, 2, 2)
            actions_row.setSpacing(4)
            start_button = QPushButton("Start")
            start_button.clicked.connect(lambda _checked=False, cid=camera["id"]: self._on_start(cid))
            stop_button = QPushButton("Stop")
            stop_button.clicked.connect(lambda _checked=False, cid=camera["id"]: self._on_stop(cid))
            inspect_button = QPushButton("Inspect")
            inspect_button.clicked.connect(lambda _checked=False, cid=camera["id"]: self._on_inspect(cid))
            open_button = QPushButton("Open")
            open_button.clicked.connect(lambda _checked=False, cid=camera["id"]: self._on_open_full_view(cid))
            for button in (start_button, stop_button, inspect_button, open_button):
                button.setObjectName("secondaryActionButton")
                actions_row.addWidget(button)
            self.list_table.setCellWidget(row, len(_LIST_COLUMNS), actions)

    def _update_overview(self) -> None:
        for camera_id, card in self._cards.items():
            camera = self.engine.db.get_camera(camera_id)
            if camera is None:
                continue
            status = self.engine.camera_manager.get_camera_status(camera_id)
            state = status["status"]

            card.name_label.setText(camera["station_name"])
            card.status_text.setText(state.upper())
            dot_name = _STATUS_DOT_STYLE.get(state, "statusDotWarn")
            card.status_dot.setObjectName(dot_name)
            card.status_dot.style().unpolish(card.status_dot)
            card.status_dot.style().polish(card.status_dot)
            card.preview.set_live(state == config.CAMERA_STATUS_LIVE)

            frame = None
            try:
                frame = self.engine.camera_manager.get_latest_frame(camera_id)
            except Exception:
                frame = None
            if frame is not None:
                card.preview.set_frame(frame)
            else:
                card.preview.clear()

            counters = self.engine.camera_manager.get_counters(camera_id)
            card.counters_label.setText(
                f"Total {counters.get('TOTAL', 0)} · Good {counters.get('GOOD', 0)} · "
                f"Bad {counters.get('BAD', 0)} · No-Prod {counters.get('NO_PRODUCT_FOUND', 0)} · "
                f"Skip {counters.get('SKIPPED', 0)} · Err {counters.get('ERROR', 0)}"
            )

            last_rows = self.engine.db.list_inspections(camera_id=camera_id, limit=1)
            if last_rows:
                last = last_rows[0]
                card.result_label.setText(last["result"])
                card.result_label.setObjectName(_RESULT_STYLE.get(last["result"], "counterValueWarn"))
                card.result_label.style().unpolish(card.result_label)
                card.result_label.style().polish(card.result_label)
                score = last.get("score")
                card.score_label.setText(f"Score: {score:.2f}%" if score is not None else "Score: —")
                card.time_label.setText(last.get("created_at") or "—")
            else:
                card.result_label.setText("—")
                card.result_label.setObjectName("counterValue")
                card.score_label.setText("Score: —")
                card.time_label.setText("—")

            card.start_button.setEnabled(camera["enabled"] and state != config.CAMERA_STATUS_LIVE)
            card.stop_button.setEnabled(state in (config.CAMERA_STATUS_LIVE, config.CAMERA_STATUS_STARTING))
            card.inspect_button.setEnabled(bool(camera["enabled"]))

            row = self._list_rows.get(camera_id)
            if row is None:
                continue
            self.list_table.item(row, 0).setText(camera["station_name"])
            self.list_table.item(row, 1).setText(state.upper())
            last_rows = self.engine.db.list_inspections(camera_id=camera_id, limit=1)
            if last_rows:
                last = last_rows[0]
                score = last.get("score")
                self.list_table.item(row, 2).setText(last["result"])
                self.list_table.item(row, 3).setText(f"{score:.2f}%" if score is not None else "—")
            else:
                self.list_table.item(row, 2).setText("—")
                self.list_table.item(row, 3).setText("—")
            self.list_table.item(row, 4).setText(
                f"Total {counters.get('TOTAL', 0)} · Good {counters.get('GOOD', 0)} · "
                f"Bad {counters.get('BAD', 0)} · No-Prod {counters.get('NO_PRODUCT_FOUND', 0)}"
            )

    def shutdown(self) -> None:
        self.overview_timer.stop()
