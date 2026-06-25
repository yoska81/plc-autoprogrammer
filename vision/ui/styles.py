TESLA_STYLE = """
QWidget {
    background-color: #000000;
    color: #f0f0f0;
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
}

QMainWindow {
    background-color: #000000;
}

/* ------------------------------------------------------------- top bar */

QFrame#topBar {
    background-color: #050505;
    border-bottom: 1px solid #2a2a2a;
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
    background-color: #0a0a0a;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
}

QFrame#panelCardAccent {
    background-color: #0a0a0a;
    border: 1px solid #3a3a3a;
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

/* --------------------------------------------------------------- buttons */

QPushButton {
    background-color: #0a0a0a;
    color: #f0f0f0;
    border: 1px solid #3a3a3a;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
}

QPushButton:hover {
    background-color: #1a1a1a;
    border: 1px solid #5a5a5a;
}

QPushButton:pressed {
    background-color: #050505;
}

QPushButton:disabled {
    color: #4a4a4a;
    border-color: #2a2a2a;
}

QPushButton#primaryActionButton {
    background-color: #111111;
    border: 1px solid #4a4a4a;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    padding: 18px 10px;
    min-height: 28px;
}

QPushButton#primaryActionButton:hover {
    background-color: #1c1c1c;
    border: 1px solid #6a6a6a;
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
    background-color: #1a1a1a;
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
    background-color: #161616;
    color: #ffffff;
    border-radius: 8px;
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

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}
"""
