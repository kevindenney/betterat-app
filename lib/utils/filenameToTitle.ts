/**
 * Clean a filename into a readable display title: drop the extension, turn
 * separators into spaces, collapse whitespace, and title-case each word.
 * Shared by the library capture flow (upload + file-like links) and the
 * upload service so a captured PDF never lands titled "report_v2.pdf".
 */
export function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, '') // strip extension
    .replace(/[-_]+/g, ' ') // separators → spaces
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case
}
