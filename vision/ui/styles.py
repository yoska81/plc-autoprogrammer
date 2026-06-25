TESLA_STYLE = """
QWidget {
    background-color: #000000;
    color: #f5f5f5;
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
}

QMainWindow {
    background-color: #000000;
}

QLabel#sectionTitle {
    color: #8a8a8a;
    font-size: 11px;
    letter-spacing: 2px;
}

QLabel#appTitle {
    color: #ffffff;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 3px;
}

QLabel#infoLabel {
    color: #d0d0d0;
    font-size: 13px;
    padding: 2px 0;
}

QFrame#headerBar {
    border-bottom: 1px solid #2a2a2a;
    padding-bottom: 8px;
}

QLabel#imagePreview {
    background-color: #0a0a0a;
    border: 1px solid #2a2a2a;
    color: #555555;
}

QLabel#resultBadgeGood {
    color: #00d97e;
    font-size: 40px;
    font-weight: 700;
    letter-spacing: 4px;
}

QLabel#resultBadgeBad {
    color: #ff4d4f;
    font-size: 40px;
    font-weight: 700;
    letter-spacing: 4px;
}

QLabel#resultBadgeNone {
    color: #555555;
    font-size: 40px;
    font-weight: 700;
    letter-spacing: 4px;
}

QLabel#scoreLabel {
    color: #ffffff;
    font-size: 20px;
    font-weight: 500;
}

QPushButton {
    background-color: #0a0a0a;
    color: #f5f5f5;
    border: 1px solid #3a3a3a;
    padding: 9px 12px;
    border-radius: 3px;
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

QTableWidget {
    background-color: #050505;
    border: 1px solid #2a2a2a;
    gridline-color: #1a1a1a;
    color: #e5e5e5;
}

QHeaderView::section {
    background-color: #0a0a0a;
    color: #8a8a8a;
    border: none;
    border-bottom: 1px solid #2a2a2a;
    padding: 4px;
}

QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox {
    background-color: #0a0a0a;
    border: 1px solid #3a3a3a;
    color: #f5f5f5;
    padding: 4px;
}

QListWidget {
    background-color: #050505;
    border: 1px solid #2a2a2a;
    color: #e5e5e5;
}

QListWidget::item:selected {
    background-color: #1a1a1a;
    color: #ffffff;
}
"""
