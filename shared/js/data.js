// Wczytywanie danych JSON.
// W wersji modułowej (GitHub Pages) pliki są pobierane przez fetch.
// W wersji sklejonej przez bundler dane są osadzone w window.__BUNDLE_DATA__.
export async function loadJSON(path) {
  const bundled = window.__BUNDLE_DATA__;
  if (bundled && Object.prototype.hasOwnProperty.call(bundled, path)) return bundled[path];
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Nie udało się wczytać ${path} (HTTP ${res.status})`);
  return res.json();
}
