TESLA_STYLE = """
QWidget {
    background-color: #060708;
    color: #f0f0f0;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
}

QMainWindow {
    background-color: #060708;
}

/* ------------------------------------------------------------- top bar */

QFrame#topBar {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #0e1015, stop:1 #07080a);
    border-bottom: 1px solid #2a2f3a;
}

QLabel#appLogoMark {
    padding-right: 2px;
}

QLabel#appTitle {
    color: #ffffff;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 3px;
}

QLabel#topBarStatus {
    color: #c5c5c5;
    font-size: 13px;
    font-weight: 500;
}

QLabel#clockLabel {
    color: #c5c5c5;
    font-size: 14px;
    font-weight: 500;
}

QLabel#statusDotGood {
    color: #00d97e;
    font-size: 16px;
}

QLabel#statusDotBad {
    color: #ff4d4f;
    font-size: 16px;
}

QLabel#statusDotWarn {
    color: #ffb020;
    font-size: 16px;
}

/* ------------------------------------------------------------ panel/card */

QFrame#panelCard {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #0d0e11, stop:1 #090a0c);
    border: 1px solid #2a2a2a;
    border-top: 1px solid #343b46;
    border-radius: 12px;
}

QFrame#panelCardAccent {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #0d0f14, stop:1 #090a0c);
    border: 1px solid #3a4150;
    border-top: 1px solid #5b9dff;
    border-radius: 12px;
}

QLabel#panelTitle {
    color: #9a9a9a;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 2px;
}

QLabel#sectionTitle {
    color: #8a8a8a;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 2px;
}

QLabel#infoLabel {
    color: #d8d8d8;
    font-size: 14px;
    padding: 3px 0;
}

QLabel#infoValue {
    color: #ffffff;
    font-size: 17px;
    font-weight: 700;
    padding: 1px 0;
}

QLabel#statusCaption {
    color: #707070;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1px;
    padding-top: 6px;
}

QFrame#headerBar {
    border-bottom: 1px solid #2a2a2a;
    padding-bottom: 8px;
}

/* ----------------------------------------------------------------- counters */

QLabel#counterValue {
    color: #ffffff;
    font-size: 22px;
    font-weight: 700;
}

QLabel#counterValueGood {
    color: #00d97e;
    font-size: 22px;
    font-weight: 700;
}

QLabel#counterValueBad {
    color: #ff4d4f;
    font-size: 22px;
    font-weight: 700;
}

QLabel#counterValueWarn {
    color: #ffb020;
    font-size: 22px;
    font-weight: 700;
}

QLabel#counterCaption {
    color: #707070;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1px;
}

/* --------------------------------------------------------- image preview */

QLabel#imagePreview {
    background-color: #050505;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    color: #555555;
    font-size: 13px;
}

QLabel#imagePreviewLive {
    background-color: #050505;
    border: 2px solid #3a3a3a;
    border-radius: 12px;
    color: #555555;
    font-size: 15px;
}

QLabel#liveDot {
    color: #00d97e;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
}

/* ------------------------------------------------------------ result card */

QFrame#resultCardGood {
    background-color: #061a10;
    border: 2px solid #00d97e;
    border-radius: 18px;
}

QFrame#resultCardBad {
    background-color: #1f0808;
    border: 2px solid #ff4d4f;
    border-radius: 18px;
}

QFrame#resultCardNone {
    background-color: #0a0a0a;
    border: 2px solid #3a3a3a;
    border-radius: 18px;
}

QFrame#resultCardWarn {
    background-color: #211705;
    border: 2px solid #ffb020;
    border-radius: 18px;
}

QFrame#resultCardSkipped {
    background-color: #0a0a0a;
    border: 2px dashed #5a5a5a;
    border-radius: 18px;
}

QLabel#resultBadgeGood {
    color: #00d97e;
    font-size: 92px;
    font-weight: 800;
    letter-spacing: 8px;
}

QLabel#resultBadgeBad {
    color: #ff4d4f;
    font-size: 92px;
    font-weight: 800;
    letter-spacing: 8px;
}

QLabel#resultBadgeNone {
    color: #5a5a5a;
    font-size: 92px;
    font-weight: 800;
    letter-spacing: 8px;
}

QLabel#resultBadgeWarn {
    color: #ffb020;
    font-size: 56px;
    font-weight: 800;
    letter-spacing: 3px;
}

QLabel#resultBadgeSkipped {
    color: #8a8a8a;
    font-size: 56px;
    font-weight: 800;
    letter-spacing: 3px;
}

QLabel#scoreLabel {
    color: #ffffff;
    font-size: 30px;
    font-weight: 500;
}

/* Compact single-line variant of the result card, used on the redesigned
   Inspection screen where the live camera feed - not the result badge - is
   the dominant element. Same color/state mapping, just smaller. */
QLabel#resultBadgeGood[compact="true"],
QLabel#resultBadgeBad[compact="true"],
QLabel#resultBadgeNone[compact="true"],
QLabel#resultBadgeWarn[compact="true"],
QLabel#resultBadgeSkipped[compact="true"] {
    font-size: 22px;
    letter-spacing: 2px;
}

QLabel#scoreLabel[compact="true"] {
    font-size: 16px;
    font-weight: 600;
}

QFrame#resultCardGood[compact="true"],
QFrame#resultCardBad[compact="true"],
QFrame#resultCardNone[compact="true"],
QFrame#resultCardWarn[compact="true"],
QFrame#resultCardSkipped[compact="true"] {
    border-radius: 10px;
}

QPushButton#zoomButton {
    padding: 4px 10px;
    font-size: 12px;
    border-radius: 6px;
}

QPushButton#zoomButton:checked {
    border: 1px solid #00d97e;
    color: #00d97e;
}

/* --------------------------------------------------------------- buttons */

QPushButton {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #121316, stop:1 #0a0a0c);
    color: #f0f0f0;
    border: 1px solid #3a3a3a;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
}

QPushButton:hover {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #1d1f24, stop:1 #131418);
    border: 1px solid #5b9dff;
}

QPushButton:pressed {
    background-color: #050505;
}

QPushButton:disabled {
    color: #4a4a4a;
    border-color: #2a2a2a;
}

QPushButton#primaryActionButton {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #161922, stop:1 #0d0e12);
    border: 1px solid #4a5568;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    padding: 18px 10px;
    min-height: 28px;
}

QPushButton#primaryActionButton:hover {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #1b2030, stop:1 #11141c);
    border: 1px solid #5b9dff;
}

QPushButton#secondaryActionButton {
    background-color: #0a0a0a;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    font-size: 13px;
    padding: 8px 12px;
    text-align: left;
}

QPushButton#dangerButton {
    background-color: #1a0a0a;
    border: 1px solid #6a2a2a;
    color: #ff9494;
}

QPushButton#dangerButton:hover {
    background-color: #2a0d0d;
    border: 1px solid #ff4d4f;
}

/* ---------------------------------------------------------------- tables */

QTableWidget {
    background-color: #050505;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    gridline-color: #1a1a1a;
    color: #e5e5e5;
    font-size: 13px;
}

QTableWidget::item {
    padding: 6px 4px;
}

QHeaderView::section {
    background-color: #0e0e0e;
    color: #9a9a9a;
    border: none;
    border-bottom: 1px solid #2a2a2a;
    padding: 8px 6px;
    font-size: 12px;
    font-weight: 600;
}

QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox {
    background-color: #0a0a0a;
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    color: #f5f5f5;
    padding: 6px 8px;
    font-size: 14px;
}

QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus {
    border: 1px solid #5b9dff;
    background-color: #0d1117;
}

QListWidget {
    background-color: #050505;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    color: #e5e5e5;
    font-size: 14px;
}

QListWidget::item {
    padding: 8px 6px;
    border-radius: 4px;
}

QListWidget::item:selected {
    background-color: #14202e;
    color: #ffffff;
    border: 1px solid #5b9dff;
}

QTableWidget::item:selected {
    background-color: #14202e;
    color: #ffffff;
}

/* ------------------------------------------------------------------ tabs */

QTabWidget::pane {
    border: none;
    top: 0px;
}

QTabBar::tab {
    background-color: transparent;
    color: #8a8a8a;
    border: none;
    padding: 10px 24px;
    margin-right: 4px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 1px;
}

QTabBar::tab:hover {
    color: #ffffff;
}

QTabBar::tab:selected {
    background-color: #161a20;
    color: #ffffff;
    border-radius: 8px;
    border-bottom: 2px solid #5b9dff;
}

QCheckBox {
    color: #f0f0f0;
    spacing: 8px;
    font-size: 14px;
}

QGroupBox {
    background-color: #0a0a0a;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    margin-top: 12px;
    padding-top: 18px;
    color: #9a9a9a;
    font-size: 13px;
    font-weight: 600;
}

QGroupBox::title {
    subcontrol-origin: margin;
    left: 10px;
    padding: 0 6px;
    letter-spacing: 1px;
}

QLabel#statusValue {
    color: #ffffff;
    font-weight: 600;
}

QLabel#instructionsText {
    color: #8a8a8a;
    font-size: 12px;
}

QScrollBar:vertical {
    background-color: #050505;
    width: 10px;
    border-radius: 5px;
}

QScrollBar::handle:vertical {
    background-color: #3a3a3a;
    border-radius: 5px;
    min-height: 24px;
}

QScrollBar::handle:vertical:hover {
    background-color: #5b9dff;
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}
"""
