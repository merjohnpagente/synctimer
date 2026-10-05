/**
 * Pull a room code out of scanned text. Accepts our full invite links
 * (https://host/#/watch/ABC123), plain /watch/ABC123 paths, or a raw code.
 */
export function extractCodeFromScan(text) {
  const t = String(text || '').trim()
  let m = t.match(/#\/watch\/([A-Za-z0-9]{2,12})/)
  if (m) return m[1].toUpperCase()
  m = t.match(/\/watch\/([A-Za-z0-9]{2,12})/)
  if (m) return m[1].toUpperCase()
  return t
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}
