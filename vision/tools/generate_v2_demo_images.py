"""Generates demo images for the V2 'Free Position / Continuous Rotation'
engine: a canonical reference panel plus GOOD and BAD inspection variants
placed off-center at a continuous (non-fixed-step) rotation angle and a
slightly different scale - the scenario V1's fixed-reference comparison
can't handle but V2's locate/align/score pipeline is built for.

Written to data/test_images_v2_demo/, a folder that is NOT part of
data/test_images/ (the directory TestImageCamera cycles through for the
live feed) - V1's bundled sample set and its smoke-test behavior stay
completely unaffected. Run directly to (re)generate the files:

    python tools/generate_v2_demo_images.py
"""
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import config

OUTPUT_DIR = config.DATA_DIR / "test_images_v2_demo"
CANVAS_SIZE = (1920, 1080)  # width, height - matches the bundled V1 samples
PANEL_SIZE = (340, 240)     # canonical (unrotated) panel width, height


def _gradient_background(width: int, height: int) -> np.ndarray:
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    for y in range(height):
        shade = 190 + int(40 * y / height)
        frame[y, :] = (shade, shade, shade)
    return frame


def _draw_panel(canvas_size: tuple[int, int], defect: bool) -> np.ndarray:
    """Draws the panel (rounded rect + 4 corner screw holes + center ring +
    a printed serial label + a fixed texture-dot grid) on its own canonical-
    size transparent-ish canvas (BGR + alpha), centered and axis-aligned, so
    it can be warped as a whole afterwards.

    The label text and dot grid exist specifically to break the rectangle's
    near-180-degree rotational symmetry: with only the rectangle + 4 (mostly
    identical) corner holes + a center ring, ORB/AKAZE have almost as much
    evidence for the correct pose as for its 180-degree-rotated twin, which
    showed up as confidently-wrong rotation estimates on continuously-
    rotated demo images. Real photographed products have this kind of
    asymmetric texture (labels, screws, wear) for free; this synthetic panel
    needs it added explicitly.
    """
    w, h = canvas_size
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    alpha = np.zeros((h, w), dtype=np.uint8)

    margin = 20
    cv2.rectangle(rgb, (margin, margin), (w - margin, h - margin), (60, 58, 56), -1, cv2.LINE_AA)
    cv2.rectangle(alpha, (margin, margin), (w - margin, h - margin), 255, -1, cv2.LINE_AA)
    cv2.rectangle(rgb, (margin, margin), (w - margin, h - margin), (140, 138, 135), 2, cv2.LINE_AA)

    hole_offset = 36
    corners = [
        (margin + hole_offset, margin + hole_offset),
        (w - margin - hole_offset, margin + hole_offset),
        (margin + hole_offset, h - margin - hole_offset),
        (w - margin - hole_offset, h - margin - hole_offset),
    ]
    skip_corner = 1 if defect else None  # missing top-right hole, like sample_3_panel_defect
    for i, (cx, cy) in enumerate(corners):
        if i == skip_corner:
            continue
        cv2.circle(rgb, (cx, cy), 12, (15, 15, 15), -1, cv2.LINE_AA)

    center = (w // 2, h // 2)
    cv2.circle(rgb, center, 38, (90, 88, 85), -1, cv2.LINE_AA)
    cv2.circle(rgb, center, 38, (170, 168, 165), 2, cv2.LINE_AA)
    cv2.circle(rgb, center, 16, (60, 58, 56), -1, cv2.LINE_AA)

    # Printed serial label, deliberately off-center (lower-left quadrant
    # only) - high-frequency text corners give ORB/AKAZE many strong,
    # uniquely-positioned keypoints with no 180-degree-symmetric twin.
    cv2.putText(rgb, "QC-PANEL-A1", (margin + 14, h - margin - 16),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (210, 208, 205), 1, cv2.LINE_AA)

    # Fixed (non-random, so reference and inspection shots show the exact
    # same "physical" surface) texture-dot grid, offset so it is denser
    # toward the top-right than the bottom-left - more asymmetric anchors
    # for feature matching, on top of the label.
    rng = np.random.default_rng(seed=20240601)
    for _ in range(70):
        dx = int(rng.uniform(margin + 60, w - margin - 60))
        dy = int(rng.uniform(margin + 60, h - margin - 60))
        if (dx - center[0]) ** 2 + (dy - center[1]) ** 2 < 50 ** 2:
            continue  # keep the center ring clear
        shade = int(rng.uniform(70, 110))
        cv2.circle(rgb, (dx, dy), 2, (shade, shade, shade), -1, cv2.LINE_AA)

    if defect:
        cv2.line(rgb, (margin + 10, margin + 10), (w - margin - 10, h - margin - 10),
                  (225, 225, 225), 2, cv2.LINE_AA)

    return np.dstack([rgb, alpha])


def _composite_rotated_panel(
    background: np.ndarray, panel_layer: np.ndarray, center_xy: tuple[int, int],
    rotation_deg: float, scale: float,
) -> np.ndarray:
    """Rotates/scales/translates the panel layer (with alpha) and alpha-blends
    it onto the background - this is what produces the continuous, non-fixed-
    step pose V1's pixel-diff comparison can't align but V2's locate/align
    step is designed for."""
    ph, pw = panel_layer.shape[:2]
    matrix = cv2.getRotationMatrix2D((pw / 2, ph / 2), rotation_deg, scale)
    matrix[0, 2] += center_xy[0] - pw / 2
    matrix[1, 2] += center_xy[1] - ph / 2

    bh, bw = background.shape[:2]
    warped = cv2.warpAffine(
        panel_layer, matrix, (bw, bh), flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0),
    )

    alpha = warped[:, :, 3:4].astype(np.float32) / 255.0
    result = background.astype(np.float32) * (1 - alpha) + warped[:, :, :3].astype(np.float32) * alpha
    return result.astype(np.uint8)


def generate_random_pose_demo_images(output_dir: Path = OUTPUT_DIR, seed: int = 20240915) -> list[dict]:
    """Additive demo set for the "random positions/random continuous
    rotations...including GOOD/BAD/no-product examples" requirement.

    Writes new files under new names only - main()'s 3 fixed-geometry files
    (and the angle/center/scale values tools/test_v2_pose_engine.py asserts
    against) are untouched. Rotation angles are the exact examples from the
    spec (11.36, 48.72, 137.4, 219.8 degrees); position/scale per angle are
    drawn from a seeded RNG so the set is reproducible across runs. Returns a
    manifest list (one dict per generated file) for callers that want the
    exact ground-truth pose/result without re-parsing filenames.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    width, height = CANVAS_SIZE
    rng = np.random.default_rng(seed)
    manifest: list[dict] = []

    angles = [11.36, 48.72, 137.4, 219.8]
    for i, rotation_deg in enumerate(angles):
        defect = i % 2 == 1  # alternate GOOD/BAD across the 4 examples
        center = (
            width // 2 + int(rng.uniform(-350, 350)),
            height // 2 + int(rng.uniform(-200, 200)),
        )
        scale = float(rng.uniform(0.85, 1.15))
        frame = _composite_rotated_panel(
            _gradient_background(width, height), _draw_panel(PANEL_SIZE, defect=defect),
            center_xy=center, rotation_deg=rotation_deg, scale=scale,
        )
        label = "bad" if defect else "good"
        angle_tag = f"{rotation_deg:.2f}".replace(".", "p")
        path = output_dir / f"v2_demo_random_{i + 1:02d}_{label}_{angle_tag}deg.png"
        cv2.imwrite(str(path), frame)
        manifest.append({
            "path": path, "result": config.RESULT_BAD if defect else config.RESULT_GOOD,
            "rotation_deg": rotation_deg, "center": center, "scale": scale,
        })
        print(f"[generate_v2_demo_images] wrote {path}")

    # No-product examples: the background alone, no panel composited at all -
    # simulates an empty station / nothing in front of the camera.
    for i in range(2):
        frame = _gradient_background(width, height)
        path = output_dir / f"v2_demo_random_no_product_{i + 1:02d}.png"
        cv2.imwrite(str(path), frame)
        manifest.append({"path": path, "result": config.RESULT_NO_PRODUCT_FOUND, "rotation_deg": None,
                          "center": None, "scale": None})
        print(f"[generate_v2_demo_images] wrote {path}")

    return manifest


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    width, height = CANVAS_SIZE

    # Canonical GOOD reference: centered, axis-aligned, scale 1.0 - this is
    # what gets saved as the product's primary GOOD reference image.
    reference = _composite_rotated_panel(
        _gradient_background(width, height), _draw_panel(PANEL_SIZE, defect=False),
        center_xy=(width // 2, height // 2), rotation_deg=0.0, scale=1.0,
    )
    reference_path = OUTPUT_DIR / "v2_demo_reference.png"
    cv2.imwrite(str(reference_path), reference)

    # GOOD inspection: same panel, continuous (non-fixed-step) rotation,
    # off-center, slightly scaled - V2 should locate, align, and pass it.
    good = _composite_rotated_panel(
        _gradient_background(width, height), _draw_panel(PANEL_SIZE, defect=False),
        center_xy=(width // 2 + 260, height // 2 - 140), rotation_deg=37.5, scale=0.92,
    )
    good_path = OUTPUT_DIR / "v2_demo_good_rotated.png"
    cv2.imwrite(str(good_path), good)

    # BAD inspection: defect panel (missing corner hole + scratch), placed at
    # a different continuous rotation/position/scale than the GOOD demo.
    bad = _composite_rotated_panel(
        _gradient_background(width, height), _draw_panel(PANEL_SIZE, defect=True),
        center_xy=(width // 2 - 300, height // 2 + 120), rotation_deg=142.0, scale=1.05,
    )
    bad_path = OUTPUT_DIR / "v2_demo_bad_rotated.png"
    cv2.imwrite(str(bad_path), bad)

    print(f"[generate_v2_demo_images] wrote {reference_path}")
    print(f"[generate_v2_demo_images] wrote {good_path}")
    print(f"[generate_v2_demo_images] wrote {bad_path}")

    generate_random_pose_demo_images()


if __name__ == "__main__":
    main()
