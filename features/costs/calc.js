// Obliczenia kosztorysu. Każda pozycja daje kwotę w złotych jako przedział {min, max}
// oraz informację, czy to szacunek (approx). Sumy liczone są wyłącznie z pozycji w costs.json.

export function itemTotal(cost, { rates, people }) {
  const rate = (currency) => (currency === 'PLN' ? 1 : rates[currency]);
  switch (cost.type) {
    case 'total':     // kwota za całą grupę
      return exact(cost.amount * rate(cost.currency));
    case 'perPerson': // kwota na osobę
      return exact(cost.amount * rate(cost.currency) * people);
    case 'range':     // przedział za całą grupę
      return { min: cost.min * rate(cost.currency), max: cost.max * rate(cost.currency), approx: false };
    case 'fuel': {    // paliwo liczone z dystansu, spalania i ceny baku
      const tanks = fuelTanks(cost);
      const value = tanks * cost.pricePerTank * rate(cost.currency);
      return { min: value, max: value, approx: true };
    }
    default:
      throw new Error(`Nieznany typ kosztu: ${cost.type}`);
  }
}

export function fuelTanks(cost) {
  const km = cost.oneWayKm * cost.trips;
  return Math.round((km * cost.litresPer700Km) / 700 / cost.tankLitres);
}

export function sum(values) {
  return values.reduce((acc, v) => ({ min: acc.min + v.min, max: acc.max + v.max, approx: acc.approx || v.approx }),
    { min: 0, max: 0, approx: false });
}

export function perPerson(value, people) {
  return { min: value.min / people, max: value.max / people, approx: value.approx };
}

function exact(v) { return { min: v, max: v, approx: false }; }
