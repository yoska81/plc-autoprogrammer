/**
 * The HMI screens as images, one at a time: a screen that fails to draw is left out and reported (the
 * deliverables ZIP and the engineering package still come out, with a note), never the whole download.
 */
export interface HmiImage {
  /** Index of the screen in the design (the PDF page and the engineering package use its name). */
  screen: number;
  /** File name in the ZIP, e.g. 03_Manual.png. */
  name: string;
  dataUrl: string;
}
export interface HmiImageFailure { screen: string; error: string }

export const hmiImageName = (i: number, screenName: string) => `${String(i + 1).padStart(2, '0')}_${screenName.replace(/[^\w-]+/g, '_')}.png`;

export async function drawEachScreen<S extends { name: string }>(screens: S[], draw: (screen: S) => Promise<string>): Promise<{ images: HmiImage[]; failed: HmiImageFailure[] }> {
  const images: HmiImage[] = [];
  const failed: HmiImageFailure[] = [];
  for (const [i, screen] of screens.entries()) {
    try {
      images.push({ screen: i, name: hmiImageName(i, screen.name), dataUrl: await draw(screen) });
    } catch (err) {
      failed.push({ screen: screen.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { images, failed };
}

/** The note put next to the images when screens could not be drawn. */
export function hmiImagesNote(failed: HmiImageFailure[]): string {
  return [
    `${failed.length} HMI screen${failed.length === 1 ? '' : 's'} could not be drawn as an image (not in this folder; a note in its place in the HMI screens PDF):`,
    ...failed.map((f) => `- ${f.screen}: ${f.error}`),
    '',
    'The screens themselves are in the project. Download the ZIP again; if a screen still fails, open it in the HMI editor.',
  ].join('\n');
}

/** One line for the page after a download: which screens are missing from it. */
export function hmiMissingLine(failed: HmiImageFailure[], file: string): string {
  return `Downloaded, but ${failed.length} HMI screen${failed.length === 1 ? '' : 's'} could not be drawn and ${failed.length === 1 ? 'is' : 'are'} not in it: ${failed.map((f) => f.screen).join(', ')}. See ${file} in the ZIP.`;
}
