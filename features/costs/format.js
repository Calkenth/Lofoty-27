// Formatowanie kwot. Kwoty dokładne do 1 zł; przedziały i szacunki zaokrąglane
// do 10 zł (za całość) albo do 5 zł (na osobę).

const group = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const roundTo = (n, step) => Math.round(n / step) * step;

export function money(value, scope = 'total') {
  const step = scope === 'perPerson' ? 5 : 10;
  if (value.min === value.max) {
    if (!value.approx) return `${group(value.min)} zł`;
    return `ok. ${group(roundTo(value.min, step))} zł`;
  }
  return `${group(roundTo(value.min, step))}–${group(roundTo(value.max, step))} zł`;
}

export function number(n) { return group(n); }

export function decimal(n, digits = 2) { return n.toFixed(digits).replace('.', ','); }
