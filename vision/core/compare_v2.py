"""V2 "Free Position / Continuous Rotation" (2D Pose Match) inspection engine.

The product is viewed from one fixed camera direction (no 3D tilt) but can
appear anywhere in the frame, rotated by any continuous angle 0-359.99 deg
(never snapped to a fixed set like 0/30/45/90), and slightly scaled. This
module locates the product, recovers that continuous 2D pose (center,
rotation, scale) via feature matching, aligns it back into the reference's
own frame, and only then compares pixels/shape/edges. V1's compare.py (fixed
pixel diff against one reference, no localization) is untouched by anything
here.

Pipeline: build_reference_features() at reference-save time -> persisted to
a sidecar .npz via save_reference_features()/load_reference_features() ->
compute_comparison_v2() at inspection time, which calls find_best_match()
across every candidate reference, each via locate_and_align() (ORB -> AKAZE
-> contour/minAreaRect fallback, optionally ECC-refined) then
compare_one_reference() for post-alignment scoring.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from . import config

_RATIO_TEST = 0.75  # Lowe's ratio test for ORB/AKAZE knn matches


@dataclass
class ReferenceFeatures:
    """Everything compute_comparison_v2() needs to align a future inspection
    to one reference image. Both ORB and AKAZE features are always built
    (cheap) so a later change to the Alignment Method setting never requires
    re-saving existing references."""
    orb_keypoints: np.ndarray       # (N, 2) float32 pixel positions
    orb_descriptors: np.ndarray | None
    akaze_keypoints: np.ndarray
    akaze_descriptors: np.ndarray | None
    contour: np.ndarray | None      # largest product contour, or None
    size: tuple[int, int]           # (width, height) of the reference image


@dataclass
class AlignmentResult:
    M: np.ndarray  # 2x3 similarity transform, maps reference-image coords -> inspection-image coords
    method: str    # "orb" | "akaze" | "contour"
    inlier_count: int
    total_matches: int
    center_x: float          # detected product center, inspection-frame pixel coords
    center_y: float
    rotation_deg: float       # continuous, [0, 360) - never snapped to a fixed step
    scale: float
    confidence: float         # 0-100, how much to trust this localization


@dataclass
class V2ComparisonResult:
    result: str  # "GOOD" | "BAD" | "NO_PRODUCT_FOUND" - never pre-resolved to BAD here;
                 # see core/app.py's no_product_action setting for that decision
    product_detected: bool
    final_score: float
    feature_score: float | None
    shape_score: float | None
    pixel_score: float | None
    edge_score: float | None
    recognition_confidence: float
    alignment_quality: float
    alignment_method: str
    detected_center_x: float | None
    detected_center_y: float | None
    detected_rotation_deg: float | None
    detected_scale: float | None
    best_reference_image_id: int | None
    best_reference_image_path: Path | None
    best_angle_id: int | None
    best_angle_name: str | None
    normalized_image: np.ndarray | None
    diff_image: np.ndarray | None
    no_product_found: bool


# --------------------------------------------------------------- utilities

def _to_gray(image: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image


def _detector(method: str):
    return cv2.AKAZE_create() if method == config.ALIGNMENT_METHOD_AKAZE else cv2.ORB_create(nfeatures=2000)


def _kp_positions(keypoints) -> np.ndarray:
    if not keypoints:
        return np.empty((0, 2), dtype=np.float32)
    return np.array([kp.pt for kp in keypoints], dtype=np.float32)


def _largest_contour(gray: np.ndarray) -> np.ndarray | None:
    """Largest plausible product silhouette, or None if nothing usable was found.

    The product may be darker or lighter than its background, so both
    threshold polarities are tried; whichever yields a contour covering a
    sane fraction of the frame wins (rules out grabbing the whole background
    under the wrong polarity).
    """
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    candidates = []
    for img in (thresh, cv2.bitwise_not(thresh)):
        contours, _ = cv2.findContours(img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        largest = max(contours, key=cv2.contourArea)
        area_ratio = cv2.contourArea(largest) / (gray.shape[0] * gray.shape[1])
        if 0.01 < area_ratio < 0.95:
            candidates.append((area_ratio, largest))
    if not candidates:
        return None
    candidates.sort(key=lambda c: c[0], reverse=True)
    return candidates[0][1]


# -------------------------------------------------------- reference features

def build_reference_features(image: np.ndarray) -> ReferenceFeatures:
    gray = _to_gray(image)
    height, width = gray.shape[:2]

    orb_kp, orb_desc = cv2.ORB_create(nfeatures=2000).detectAndCompute(gray, None)
    akaze_kp, akaze_desc = cv2.AKAZE_create().detectAndCompute(gray, None)

    return ReferenceFeatures(
        orb_keypoints=_kp_positions(orb_kp), orb_descriptors=orb_desc,
        akaze_keypoints=_kp_positions(akaze_kp), akaze_descriptors=akaze_desc,
        contour=_largest_contour(gray), size=(width, height),
    )


def has_usable_features(features: ReferenceFeatures) -> bool:
    return (
        features.orb_descriptors is not None
        or features.akaze_descriptors is not None
        or features.contour is not None
    )


def save_reference_features(features: ReferenceFeatures, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez(
        str(path),
        orb_keypoints=features.orb_keypoints,
        orb_descriptors=features.orb_descriptors if features.orb_descriptors is not None else np.empty((0, 0), dtype=np.uint8),
        akaze_keypoints=features.akaze_keypoints,
        akaze_descriptors=features.akaze_descriptors if features.akaze_descriptors is not None else np.empty((0, 0), dtype=np.uint8),
        contour=features.contour if features.contour is not None else np.empty((0, 1, 2), dtype=np.int32),
        size=np.array(features.size, dtype=np.int32),
    )


def load_reference_features(path: Path) -> ReferenceFeatures:
    data = np.load(str(path))
    orb_desc, akaze_desc, contour = data["orb_descriptors"], data["akaze_descriptors"], data["contour"]
    return ReferenceFeatures(
        orb_keypoints=data["orb_keypoints"], orb_descriptors=orb_desc if orb_desc.size else None,
        akaze_keypoints=data["akaze_keypoints"], akaze_descriptors=akaze_desc if akaze_desc.size else None,
        contour=contour if contour.size else None, size=tuple(int(v) for v in data["size"]),
    )


def build_and_save_reference_features(image: np.ndarray, output_path: Path) -> Path | None:
    """Build features for a freshly-saved GOOD reference and persist them.

    Returns None (and writes nothing) if neither keypoints nor a contour
    could be extracted - compute_comparison_v2() simply skips such
    references rather than failing.
    """
    features = build_reference_features(image)
    if not has_usable_features(features):
        return None
    save_reference_features(features, output_path)
    return output_path


# -------------------------------------------------------------- localization

def _match_and_estimate_affine(
    ref_positions: np.ndarray, ref_descriptors: np.ndarray | None,
    insp_gray: np.ndarray, method: str, min_feature_matches: int,
) -> tuple[np.ndarray | None, int, int]:
    """Detect features in insp_gray and estimate a similarity transform back
    to the reference. Returns (M, inlier_count, total_good_matches); M maps
    reference-image coords -> inspection-image coords. M is None if there
    were not enough good matches to trust an estimate."""
    if ref_descriptors is None or ref_positions.shape[0] == 0:
        return None, 0, 0
    insp_kp, insp_desc = _detector(method).detectAndCompute(insp_gray, None)
    if insp_desc is None or len(insp_kp) < 2:
        return None, 0, 0

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    raw_matches = matcher.knnMatch(ref_descriptors, insp_desc, k=2)
    good = [m for pair in raw_matches if len(pair) == 2 and pair[0].distance < _RATIO_TEST * pair[1].distance
            for m in (pair[0],)]
    if len(good) < min_feature_matches:
        return None, 0, len(good)

    ref_pts = np.array([ref_positions[m.queryIdx] for m in good], dtype=np.float32)
    insp_pts = np.array([insp_kp[m.trainIdx].pt for m in good], dtype=np.float32)
    M, inliers = cv2.estimateAffinePartial2D(ref_pts, insp_pts, method=cv2.RANSAC, ransacReprojThreshold=4.0)
    if M is None:
        return None, 0, len(good)
    return M, int(inliers.sum()) if inliers is not None else 0, len(good)


def _contour_fallback_pose(ref_contour: np.ndarray | None, insp_gray: np.ndarray) -> np.ndarray | None:
    """minAreaRect-based pose estimate, used when feature matching can't find
    enough good matches but the product has a clear silhouette.

    Rotation recovered this way is ambiguous modulo 180 deg (a rectangle
    looks identical rotated 180 deg) - a documented limitation of this
    fallback versus feature matching, which resolves the full 0-360 deg
    range unambiguously.
    """
    if ref_contour is None:
        return None
    insp_contour = _largest_contour(insp_gray)
    if insp_contour is None:
        return None
    (icx, icy), (iw, ih), iangle = cv2.minAreaRect(insp_contour)
    (rcx, rcy), (rw, rh), rangle = cv2.minAreaRect(ref_contour)
    if rw < 1.0 or rh < 1.0:
        return None
    scale = ((iw / rw) + (ih / rh)) / 2.0
    rotation_deg = (iangle - rangle) % 180.0
    rad = np.deg2rad(rotation_deg)
    cos_a, sin_a = np.cos(rad), np.sin(rad)
    return np.array([
        [scale * cos_a, -scale * sin_a, icx - scale * (cos_a * rcx - sin_a * rcy)],
        [scale * sin_a, scale * cos_a, icy - scale * (sin_a * rcx + cos_a * rcy)],
    ], dtype=np.float32)


def _ecc_refine(reference_gray: np.ndarray, insp_gray: np.ndarray, M: np.ndarray) -> np.ndarray:
    """Best-effort sub-pixel polish of an existing ref->insp estimate via ECC.

    ECC needs a reasonable initial guess and equal-sized inputs, so it is
    only used to refine a coarse feature/contour estimate, never to locate
    the product from scratch. Silently returns the un-refined M if ECC
    fails to converge (common when the coarse estimate is still far off).
    """
    try:
        inv_m = cv2.invertAffineTransform(M)
        warped_insp = cv2.warpAffine(insp_gray, inv_m, (reference_gray.shape[1], reference_gray.shape[0]))
        warp_matrix = np.eye(2, 3, dtype=np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 50, 1e-4)
        _, refine_m = cv2.findTransformECC(
            reference_gray.astype(np.float32), warped_insp.astype(np.float32),
            warp_matrix, cv2.MOTION_EUCLIDEAN, criteria,
        )
        refine_3x3 = np.vstack([refine_m, [0.0, 0.0, 1.0]])
        m_3x3 = np.vstack([M, [0.0, 0.0, 1.0]])
        return (m_3x3 @ refine_3x3)[:2, :].astype(np.float32)
    except cv2.error:
        return M


def locate_and_align(
    reference_image: np.ndarray, reference_features: ReferenceFeatures, insp_image: np.ndarray,
    alignment_method: str, min_feature_matches: int,
) -> AlignmentResult | None:
    insp_gray = _to_gray(insp_image)
    ref_gray = _to_gray(reference_image)

    feature_attempts = []
    if alignment_method in (config.ALIGNMENT_METHOD_ORB, config.ALIGNMENT_METHOD_HYBRID):
        feature_attempts.append((config.ALIGNMENT_METHOD_ORB, reference_features.orb_keypoints, reference_features.orb_descriptors))
    if alignment_method in (config.ALIGNMENT_METHOD_AKAZE, config.ALIGNMENT_METHOD_HYBRID):
        feature_attempts.append((config.ALIGNMENT_METHOD_AKAZE, reference_features.akaze_keypoints, reference_features.akaze_descriptors))

    M = used_method = None
    inlier_count = total_matches = 0
    for method, positions, descriptors in feature_attempts:
        M, inlier_count, total_matches = _match_and_estimate_affine(positions, descriptors, insp_gray, method, min_feature_matches)
        if M is not None:
            used_method = method
            break

    if M is None and alignment_method in (config.ALIGNMENT_METHOD_CONTOUR, config.ALIGNMENT_METHOD_HYBRID):
        M = _contour_fallback_pose(reference_features.contour, insp_gray)
        used_method = config.ALIGNMENT_METHOD_CONTOUR if M is not None else None

    if M is None:
        return None

    if alignment_method == config.ALIGNMENT_METHOD_HYBRID:
        M = _ecc_refine(ref_gray, insp_gray, M)

    ref_w, ref_h = reference_features.size
    ref_center = np.array([ref_w / 2.0, ref_h / 2.0, 1.0], dtype=np.float32)
    insp_center = M @ ref_center
    # Continuous angle in [0, 360) - intentionally never rounded to a fixed
    # step (e.g. 0/30/45/90); estimateAffinePartial2D/minAreaRect both
    # already return a free floating-point angle.
    rotation_deg = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])) % 360.0)
    scale = float(np.sqrt(M[0, 0] ** 2 + M[1, 0] ** 2))

    if used_method == config.ALIGNMENT_METHOD_CONTOUR:
        confidence = 45.0  # no point-correspondence statistic available for this fallback
    else:
        inlier_ratio = inlier_count / total_matches if total_matches else 0.0
        count_factor = min(1.0, inlier_count / max(min_feature_matches * 2, 1))
        confidence = round(100.0 * inlier_ratio * count_factor, 2)

    return AlignmentResult(
        M=M, method=used_method, inlier_count=inlier_count, total_matches=total_matches,
        center_x=float(insp_center[0]), center_y=float(insp_center[1]),
        rotation_deg=round(rotation_deg, 2), scale=round(scale, 4), confidence=confidence,
    )


# ---------------------------------------------------- normalization/scoring

def normalize_inspection(insp_image: np.ndarray, alignment: AlignmentResult, reference_size: tuple[int, int]) -> np.ndarray:
    """Warp the located product out of the inspection frame, undo its
    rotation/scale/position, and resize it to the canonical comparison
    size - this is the image every downstream score is computed on, never
    the raw inspection frame."""
    inv_m = cv2.invertAffineTransform(alignment.M)
    warped = cv2.warpAffine(insp_image, inv_m, reference_size)
    return cv2.resize(warped, config.CANONICAL_SIZE)


def _pixel_score(ref_gray: np.ndarray, norm_gray: np.ndarray) -> float:
    diff = cv2.absdiff(ref_gray, norm_gray)
    return round(100.0 - (float(np.mean(diff)) / 255.0 * 100.0), 2)


def _edge_score(ref_gray: np.ndarray, norm_gray: np.ndarray) -> float:
    diff = cv2.absdiff(cv2.Canny(ref_gray, 50, 150), cv2.Canny(norm_gray, 50, 150))
    return round(100.0 - (float(np.mean(diff)) / 255.0 * 100.0), 2)


def _shape_score(ref_contour: np.ndarray | None, norm_gray: np.ndarray) -> float | None:
    if ref_contour is None:
        return None
    norm_contour = _largest_contour(norm_gray)
    if norm_contour is None:
        return None
    # matchShapes (Hu-moment distance) is 0 for identical shapes and scale-
    # invariant by construction; mapped onto a 0-100 score for an
    # explainable, simple-math comparison alongside the other sub-scores.
    distance = cv2.matchShapes(ref_contour, norm_contour, cv2.CONTOURS_MATCH_I1, 0.0)
    return round(max(0.0, 100.0 - distance * 100.0), 2)


def _alignment_quality(ref_gray: np.ndarray, norm_gray: np.ndarray) -> float:
    # Normalized cross-correlation between two equal-sized images collapses
    # to a single coefficient in [-1, 1]; mapped to [0, 100] as an
    # independent "did the geometry line up" signal, separate from the
    # brightness-based pixel_score.
    ncc = float(cv2.matchTemplate(norm_gray, ref_gray, cv2.TM_CCOEFF_NORMED)[0, 0])
    return round(max(0.0, min(100.0, (ncc + 1.0) / 2.0 * 100.0)), 2)


def _combined_score(feature_score, shape_score, pixel_score, edge_score, weights) -> float:
    feature_w, shape_w, pixel_w, edge_w = weights
    weighted = [(s, w) for s, w in (
        (feature_score, feature_w), (shape_score, shape_w), (pixel_score, pixel_w), (edge_score, edge_w),
    ) if s is not None]
    total_weight = sum(w for _, w in weighted)
    if total_weight == 0:
        return 0.0
    return round(sum(s * w for s, w in weighted) / total_weight, 2)


def compare_one_reference(
    insp_image: np.ndarray, reference_image_path: Path, reference_features: ReferenceFeatures,
    alignment_method: str, min_feature_matches: int, matching_method: str,
    score_weights: tuple[float, float, float, float],
) -> tuple[AlignmentResult | None, dict]:
    """Align insp_image to one reference and score it.

    Returns (alignment, scores). alignment is None (scores {}) if the
    product could not be located against this particular reference at all.
    """
    reference_image = cv2.imread(str(reference_image_path))
    if reference_image is None:
        return None, {}

    alignment = locate_and_align(reference_image, reference_features, insp_image, alignment_method, min_feature_matches)
    if alignment is None:
        return None, {}

    normalized = normalize_inspection(insp_image, alignment, reference_features.size)
    canonical_reference = cv2.resize(reference_image, config.CANONICAL_SIZE)
    norm_gray = cv2.cvtColor(normalized, cv2.COLOR_BGR2GRAY)
    ref_gray = cv2.cvtColor(canonical_reference, cv2.COLOR_BGR2GRAY)

    feature_score = alignment.confidence if alignment.method in (config.ALIGNMENT_METHOD_ORB, config.ALIGNMENT_METHOD_AKAZE) else None
    shape_score = _shape_score(reference_features.contour, norm_gray)
    pixel_score = _pixel_score(ref_gray, norm_gray)
    edge_score = _edge_score(ref_gray, norm_gray)
    alignment_quality = _alignment_quality(ref_gray, norm_gray)

    if matching_method == config.MATCHING_METHOD_PIXEL:
        combined = pixel_score
    elif matching_method == config.MATCHING_METHOD_FEATURE:
        combined = feature_score if feature_score is not None else alignment.confidence
    else:
        combined = _combined_score(feature_score, shape_score, pixel_score, edge_score, score_weights)

    diff_image = cv2.applyColorMap(cv2.absdiff(ref_gray, norm_gray), cv2.COLORMAP_JET)

    return alignment, dict(
        feature_score=feature_score, shape_score=shape_score, pixel_score=pixel_score, edge_score=edge_score,
        alignment_quality=alignment_quality, combined_score=combined,
        normalized_image=normalized, diff_image=diff_image,
    )


def find_best_match(
    insp_image: np.ndarray, candidates: list[dict], alignment_method: str, min_feature_matches: int,
    matching_method: str, score_weights: tuple[float, float, float, float],
) -> tuple[dict | None, AlignmentResult | None, dict]:
    """Try every candidate reference, keep the one with the highest combined score.

    Each candidate dict needs "id", "image_path", "feature_path", and
    optionally "angle_id"/"angle_name". Returns (None, None, {}) if the
    product could not be located against ANY candidate.
    """
    best: tuple[dict | None, AlignmentResult | None, dict] = (None, None, {})
    best_score = -1.0
    for candidate in candidates:
        feature_path = candidate.get("feature_path")
        if not feature_path or not Path(feature_path).exists():
            continue
        reference_features = load_reference_features(Path(feature_path))
        alignment, scores = compare_one_reference(
            insp_image, Path(candidate["image_path"]), reference_features,
            alignment_method, min_feature_matches, matching_method, score_weights,
        )
        if alignment is None:
            continue
        if scores["combined_score"] > best_score:
            best_score = scores["combined_score"]
            best = (candidate, alignment, scores)
    return best


def compute_comparison_v2(
    insp_image: np.ndarray, candidates: list[dict], threshold_percent: float, alignment_method: str,
    min_feature_matches: int, min_recognition_confidence: float, matching_method: str,
    score_weights: tuple[float, float, float, float],
) -> V2ComparisonResult:
    """Locate, align, and score. Always reports NO_PRODUCT_FOUND (never BAD)
    when the product couldn't be reliably located - core/app.py's
    no_product_action setting decides what that becomes once saved."""
    candidate, alignment, scores = find_best_match(
        insp_image, candidates, alignment_method, min_feature_matches, matching_method, score_weights,
    )

    if candidate is None or alignment is None or alignment.confidence < min_recognition_confidence:
        return V2ComparisonResult(
            result=config.RESULT_NO_PRODUCT_FOUND, product_detected=False,
            final_score=0.0, feature_score=None, shape_score=None, pixel_score=None, edge_score=None,
            recognition_confidence=round(alignment.confidence, 2) if alignment else 0.0,
            alignment_quality=0.0, alignment_method=alignment.method if alignment else "none",
            detected_center_x=alignment.center_x if alignment else None,
            detected_center_y=alignment.center_y if alignment else None,
            detected_rotation_deg=alignment.rotation_deg if alignment else None,
            detected_scale=alignment.scale if alignment else None,
            best_reference_image_id=None, best_reference_image_path=None,
            best_angle_id=None, best_angle_name=None,
            normalized_image=None, diff_image=None, no_product_found=True,
        )

    final_score = scores["combined_score"]
    return V2ComparisonResult(
        result=config.RESULT_GOOD if final_score >= threshold_percent else config.RESULT_BAD,
        product_detected=True,
        final_score=final_score, feature_score=scores["feature_score"], shape_score=scores["shape_score"],
        pixel_score=scores["pixel_score"], edge_score=scores["edge_score"],
        recognition_confidence=round(alignment.confidence, 2), alignment_quality=scores["alignment_quality"],
        alignment_method=alignment.method, detected_center_x=round(alignment.center_x, 2),
        detected_center_y=round(alignment.center_y, 2), detected_rotation_deg=alignment.rotation_deg,
        detected_scale=alignment.scale,
        best_reference_image_id=candidate["id"], best_reference_image_path=Path(candidate["image_path"]),
        best_angle_id=candidate.get("angle_id"), best_angle_name=candidate.get("angle_name"),
        normalized_image=scores["normalized_image"], diff_image=scores["diff_image"], no_product_found=False,
    )
