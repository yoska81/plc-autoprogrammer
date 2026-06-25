"""Focused regression test for the V2 "Free Position / Continuous Rotation"
engine, using the demo images from tools/generate_v2_demo_images.py.

Covers exactly the scenarios V2 exists for:
  - GOOD, rotated/translated/rescaled product  -> result GOOD
  - BAD (missing corner hole + scratch), rotated/translated/rescaled -> BAD
  - Empty frame (no product at all)            -> NO_PRODUCT_FOUND
  - V1's fixed-reference pixel-diff mode still runs and still passes a
    reference compared against itself, confirming V2 work hasn't touched it.

Every check fails loudly (assert with a message dumping the actual values)
rather than silently passing or adjusting expectations - if this test ever
needs to change, the engine's behavior changed, not the demo images.

Run directly:
    python3 tools/test_v2_pose_engine.py
"""
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import compare as compare_v1
from core import compare_v2, config

DEMO_DIR = config.DATA_DIR / "test_images_v2_demo"
DEBUG_DIR = config.DATA_DIR / "debug_v2"
V1_SAMPLE_DIR = config.DATA_DIR / "test_images"

SCORE_WEIGHTS = (
    config.DEFAULT_FEATURE_SCORE_WEIGHT, config.DEFAULT_SHAPE_SCORE_WEIGHT,
    config.DEFAULT_PIXEL_SCORE_WEIGHT, config.DEFAULT_EDGE_SCORE_WEIGHT,
)

# The demo generator's cv2.getRotationMatrix2D(angle, ...) and the engine's
# recovered atan2-based rotation_deg use opposite handedness, so a generated
# angle of theta is expected back as (360 - theta) % 360. Tolerances are
# generous (engine output is sub-pixel/sub-degree accurate in practice) but
# loose enough to not be brittle to minor future tuning.
ANGLE_TOLERANCE_DEG = 10.0
CENTER_TOLERANCE_PX = 15.0
SCALE_TOLERANCE = 0.1
MIN_ALIGNMENT_QUALITY = 90.0


def _expected_recovered_angle(generated_deg: float) -> float:
    return (360.0 - generated_deg) % 360.0


def _angle_delta(a: float, b: float) -> float:
    return min(abs(a - b), 360.0 - abs(a - b))


def _dump(name: str, image: np.ndarray) -> None:
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(DEBUG_DIR / name), image)


def _draw_overlay(image: np.ndarray, alignment) -> np.ndarray:
    overlay = image.copy()
    center = (int(round(alignment.center_x)), int(round(alignment.center_y)))
    cv2.drawMarker(overlay, center, (0, 0, 255), cv2.MARKER_CROSS, 40, 3)
    cv2.putText(
        overlay, f"rot={alignment.rotation_deg:.1f} scale={alignment.scale:.3f}",
        (center[0] + 30, center[1]), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA,
    )
    return overlay


def _run_case(
    label: str, insp_path: Path, reference_path: Path, reference_features,
    expected_generated_angle: float, expected_center: tuple[float, float], expected_scale: float,
    file_prefix: str,
) -> compare_v2.V2ComparisonResult:
    print(f"\n=== {label} ===")
    insp_image = cv2.imread(str(insp_path))
    assert insp_image is not None, f"{label}: could not read input image {insp_path}"
    _dump(f"{file_prefix}_01_input.png", insp_image)

    candidates = [{"id": 1, "image_path": str(reference_path), "feature_path": None}]
    # find_best_match() needs a real feature_path on disk; reuse compare_one_reference directly instead.
    alignment, scores = compare_v2.compare_one_reference(
        insp_image, reference_path, reference_features,
        config.DEFAULT_ALIGNMENT_METHOD, config.DEFAULT_MIN_FEATURE_MATCHES,
        config.DEFAULT_MATCHING_METHOD, SCORE_WEIGHTS,
    )

    if alignment is None:
        print(f"{label}: product_detected=False (locate_and_align returned None)")
        result = compare_v2.V2ComparisonResult(
            result=config.RESULT_NO_PRODUCT_FOUND, product_detected=False,
            final_score=0.0, feature_score=None, shape_score=None, pixel_score=None, edge_score=None,
            recognition_confidence=0.0, alignment_quality=0.0, alignment_method="none",
            detected_center_x=None, detected_center_y=None, detected_rotation_deg=None, detected_scale=None,
            best_reference_image_id=None, best_reference_image_path=None, best_angle_id=None, best_angle_name=None,
            normalized_image=None, diff_image=None, no_product_found=True,
        )
        return result

    final_score = scores["combined_score"]
    result_str = config.RESULT_GOOD if final_score >= config.DEFAULT_MATCH_THRESHOLD_PERCENT else config.RESULT_BAD
    result = compare_v2.V2ComparisonResult(
        result=result_str, product_detected=True,
        final_score=final_score, feature_score=scores["feature_score"], shape_score=scores["shape_score"],
        pixel_score=scores["pixel_score"], edge_score=scores["edge_score"],
        recognition_confidence=round(alignment.confidence, 2), alignment_quality=scores["alignment_quality"],
        alignment_method=alignment.method, detected_center_x=round(alignment.center_x, 2),
        detected_center_y=round(alignment.center_y, 2), detected_rotation_deg=alignment.rotation_deg,
        detected_scale=alignment.scale,
        best_reference_image_id=1, best_reference_image_path=reference_path,
        best_angle_id=None, best_angle_name=None,
        normalized_image=scores["normalized_image"], diff_image=scores["diff_image"], no_product_found=False,
    )

    print(f"product_detected:        {result.product_detected}")
    print(f"detected_center_x/y:     {result.detected_center_x}, {result.detected_center_y}")
    print(f"detected_rotation_deg:   {result.detected_rotation_deg}")
    print(f"detected_scale:          {result.detected_scale}")
    print(f"recognition_confidence:  {result.recognition_confidence}")
    print(f"alignment_quality:       {result.alignment_quality}")
    print(f"feature_score:           {result.feature_score}")
    print(f"shape_score:             {result.shape_score}")
    print(f"pixel_score:             {result.pixel_score}")
    print(f"edge_score:              {result.edge_score}")
    print(f"final_score:             {result.final_score}")
    print(f"result:                  {result.result}")

    overlay = _draw_overlay(insp_image, alignment)
    _dump(f"{file_prefix}_02_detected_overlay.png", overlay)
    if result.normalized_image is not None:
        _dump(f"{file_prefix}_03_normalized.png", result.normalized_image)
    if result.diff_image is not None:
        _dump(f"{file_prefix}_04_diff.png", result.diff_image)
    reference_image = cv2.imread(str(reference_path))
    _dump(f"{file_prefix}_05_reference_used.png", reference_image)

    assert result.product_detected, (
        f"{label}: product was NOT detected at all. The engine could not locate/align "
        f"the product in {insp_path}."
    )

    expected_angle = _expected_recovered_angle(expected_generated_angle)
    angle_delta = _angle_delta(result.detected_rotation_deg, expected_angle)
    assert angle_delta <= ANGLE_TOLERANCE_DEG, (
        f"{label}: detected rotation is unreasonable. Generated angle was "
        f"{expected_generated_angle} deg (expected recovered ~{expected_angle:.1f} deg under the "
        f"engine's sign convention), but the engine reported {result.detected_rotation_deg:.1f} deg "
        f"(delta {angle_delta:.1f} deg, tolerance {ANGLE_TOLERANCE_DEG} deg)."
    )

    cx_delta = abs(result.detected_center_x - expected_center[0])
    cy_delta = abs(result.detected_center_y - expected_center[1])
    assert cx_delta <= CENTER_TOLERANCE_PX and cy_delta <= CENTER_TOLERANCE_PX, (
        f"{label}: detected center {result.detected_center_x, result.detected_center_y} is too far "
        f"from the expected {expected_center} (delta {cx_delta:.1f}, {cy_delta:.1f} px, "
        f"tolerance {CENTER_TOLERANCE_PX} px)."
    )

    scale_delta = abs(result.detected_scale - expected_scale)
    assert scale_delta <= SCALE_TOLERANCE, (
        f"{label}: detected scale {result.detected_scale} is too far from the expected "
        f"{expected_scale} (delta {scale_delta:.3f}, tolerance {SCALE_TOLERANCE})."
    )

    assert result.alignment_quality >= MIN_ALIGNMENT_QUALITY, (
        f"{label}: alignment_quality {result.alignment_quality} is below the minimum "
        f"{MIN_ALIGNMENT_QUALITY} - the normalized inspection image is not properly aligned to the "
        f"reference, so any pixel/edge defect score computed from it is meaningless. Check "
        f"{DEBUG_DIR / (file_prefix + '_03_normalized.png')} against "
        f"{DEBUG_DIR / (file_prefix + '_05_reference_used.png')}."
    )

    return result


def test_good_rotated() -> None:
    reference_path = DEMO_DIR / "v2_demo_reference.png"
    reference_image = cv2.imread(str(reference_path))
    assert reference_image is not None, f"could not read reference image {reference_path}"
    reference_features = compare_v2.build_reference_features(reference_image)

    result = _run_case(
        "GOOD rotated/translated/rescaled", DEMO_DIR / "v2_demo_good_rotated.png", reference_path,
        reference_features, expected_generated_angle=37.5, expected_center=(1220.0, 400.0),
        expected_scale=0.92, file_prefix="good",
    )
    assert result.result == config.RESULT_GOOD, (
        f"GOOD demo image was classified as {result.result}, not GOOD. final_score="
        f"{result.final_score} vs threshold {config.DEFAULT_MATCH_THRESHOLD_PERCENT}. Sub-scores: "
        f"feature={result.feature_score} shape={result.shape_score} pixel={result.pixel_score} "
        f"edge={result.edge_score}. See {DEBUG_DIR / 'good_04_diff.png'}."
    )


def test_bad_rotated() -> None:
    reference_path = DEMO_DIR / "v2_demo_reference.png"
    reference_image = cv2.imread(str(reference_path))
    assert reference_image is not None, f"could not read reference image {reference_path}"
    reference_features = compare_v2.build_reference_features(reference_image)

    result = _run_case(
        "BAD rotated/translated/rescaled (missing hole + scratch)", DEMO_DIR / "v2_demo_bad_rotated.png",
        reference_path, reference_features, expected_generated_angle=142.0, expected_center=(660.0, 660.0),
        expected_scale=1.05, file_prefix="bad",
    )
    assert result.result == config.RESULT_BAD, (
        f"BAD demo image (missing corner hole + scratch) was classified as {result.result}, not BAD. "
        f"final_score={result.final_score} vs threshold {config.DEFAULT_MATCH_THRESHOLD_PERCENT}. "
        f"Sub-scores: feature={result.feature_score} shape={result.shape_score} "
        f"pixel={result.pixel_score} edge={result.edge_score}. The defect should show up as a "
        f"low pixel_score/edge_score - check {DEBUG_DIR / 'bad_04_diff.png'}."
    )


def test_empty_frame_no_product_found() -> None:
    print("\n=== Empty frame (no product) ===")
    reference_path = DEMO_DIR / "v2_demo_reference.png"
    reference_image = cv2.imread(str(reference_path))
    reference_features = compare_v2.build_reference_features(reference_image)

    empty = np.full((1080, 1920, 3), 200, dtype=np.uint8)
    _dump("empty_01_input.png", empty)

    candidates_dir = DEMO_DIR
    feature_path = candidates_dir / "_tmp_test_reference.npz"
    compare_v2.save_reference_features(reference_features, feature_path)
    try:
        candidates = [{"id": 1, "image_path": str(reference_path), "feature_path": str(feature_path)}]
        result = compare_v2.compute_comparison_v2(
            empty, candidates, threshold_percent=config.DEFAULT_MATCH_THRESHOLD_PERCENT,
            alignment_method=config.DEFAULT_ALIGNMENT_METHOD, min_feature_matches=config.DEFAULT_MIN_FEATURE_MATCHES,
            min_recognition_confidence=config.DEFAULT_MIN_RECOGNITION_CONFIDENCE,
            matching_method=config.DEFAULT_MATCHING_METHOD, score_weights=SCORE_WEIGHTS,
        )
    finally:
        feature_path.unlink(missing_ok=True)

    print(f"product_detected: {result.product_detected}")
    print(f"result:           {result.result}")
    assert not result.product_detected, (
        f"Empty/no-product frame reported product_detected=True (recognition_confidence="
        f"{result.recognition_confidence}). The engine should not find a product where there is none."
    )
    assert result.result == config.RESULT_NO_PRODUCT_FOUND, (
        f"Empty/no-product frame was classified as {result.result}, expected "
        f"{config.RESULT_NO_PRODUCT_FOUND}."
    )


def test_v1_fixed_reference_still_works() -> None:
    print("\n=== V1 fixed-reference mode (regression sanity) ===")
    reference_path = V1_SAMPLE_DIR / "sample_1_panel_good.png"
    assert reference_path.exists(), f"V1 sample reference missing: {reference_path}"
    diff_output = DEBUG_DIR / "v1_self_diff.png"

    result = compare_v1.compare_images(
        reference_path, reference_path, diff_output, config.DEFAULT_MATCH_THRESHOLD_PERCENT,
    )
    print(f"V1 self-comparison score: {result.score_percent}, result: {result.result}")
    assert result.result == config.RESULT_GOOD, (
        f"V1's own bundled GOOD reference compared against itself was classified as "
        f"{result.result} (score {result.score_percent}). V1's fixed-reference pixel-diff mode "
        f"must still work after V2 engine changes - it is a completely separate code path "
        f"(core/compare.py) and should be unaffected."
    )


def main() -> None:
    failures = []
    for test_fn in (
        test_good_rotated, test_bad_rotated, test_empty_frame_no_product_found,
        test_v1_fixed_reference_still_works,
    ):
        try:
            test_fn()
            print(f"[PASS] {test_fn.__name__}")
        except AssertionError as exc:
            print(f"[FAIL] {test_fn.__name__}: {exc}")
            failures.append(test_fn.__name__)

    print(f"\nDebug images written to {DEBUG_DIR}")
    if failures:
        print(f"\n{len(failures)} test(s) FAILED: {', '.join(failures)}")
        sys.exit(1)
    print("\nAll V2 pose engine tests passed.")


if __name__ == "__main__":
    main()
