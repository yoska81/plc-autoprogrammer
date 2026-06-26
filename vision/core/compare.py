from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass
class ComparisonResult:
    result: str  # "GOOD" or "BAD"
    score_percent: float
    diff_image_path: Path


def compare_images(
    reference_path: Path,
    inspection_path: Path,
    diff_output_path: Path,
    threshold_percent: float,
) -> ComparisonResult:
    """Compare an inspection image against a GOOD reference image.

    Resizes the inspection frame to the reference size if they differ, then
    compares grayscale pixel intensities. The similarity score is
    100 minus the mean absolute pixel difference (as a percentage); GOOD if
    it meets threshold_percent, otherwise BAD.
    """
    reference = cv2.imread(str(reference_path))
    inspection = cv2.imread(str(inspection_path))
    if reference is None:
        raise FileNotFoundError(f"Reference image not found or unreadable: {reference_path}")
    if inspection is None:
        raise FileNotFoundError(f"Inspection image not found or unreadable: {inspection_path}")

    if inspection.shape[:2] != reference.shape[:2]:
        inspection = cv2.resize(inspection, (reference.shape[1], reference.shape[0]))

    reference_gray = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)
    inspection_gray = cv2.cvtColor(inspection, cv2.COLOR_BGR2GRAY)

    diff = cv2.absdiff(reference_gray, inspection_gray)
    score_percent = 100.0 - (float(np.mean(diff)) / 255.0 * 100.0)

    diff_output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(diff_output_path), cv2.applyColorMap(diff, cv2.COLORMAP_JET))

    result = "GOOD" if score_percent >= threshold_percent else "BAD"
    return ComparisonResult(result=result, score_percent=round(score_percent, 2), diff_image_path=diff_output_path)
