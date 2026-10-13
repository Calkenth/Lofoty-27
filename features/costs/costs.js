// Zakładka Kosztorys: wycena rejsu, opcje transportu i podsumowanie.
import { h } from '../../shared/js/dom.js';
import { itemTotal, fuelTanks, sum, perPerson } from './calc.js';
import { money, number, decimal } from './format.js';

export function renderCosts(data) {
  const root = document.getElementById('costs');
  const ctx = { rates: data.rates, people: data.people };

  const priced = (items) => items.map((item) => ({ ...item, value: itemTotal(item.cost, ctx) }));
  const cruise = priced(data.cruise.items);
  const cruiseTotal = sum(cruise.map((i) => i.value));
  const options = data.transport.options.map((o) => {
    const items = priced(o.items);
    return { ...o, items, total: sum(items.map((i) => i.value)) };
  });

  // Wycena rejsu
  const deposit = data.cruise.deposit;
  root.append(
    h('h2', { id: data.cruise.id, text: data.cruise.title }),
    h('p', { class: 'sub', text: data.cruise.subtitle }),
    table({ head: ['Pozycja', 'Za całość', 'Na osobę'], items: cruise, total: cruiseTotal, totalLabel: data.cruise.totalLabel, people: data.people }),
    h('p', { class: 'cn', text: `Kaucja za jacht wynosi ${number(deposit.amount)} € (ok. ${number(deposit.amount * data.rates[deposit.currency])} zł). ${deposit.text}` }),
  );

  // Transport: karty z opcjami
  root.append(
    h('h2', { id: data.transport.id, text: data.transport.title }),
    h('p', { class: 'sub', text: data.transport.subtitle }),
    h('div', { class: 'opts' }, options.map((o) => h('article', { class: 'opt', id: o.id }, [
      h('h3', { text: o.title }),
      h('p', { class: 'od', text: o.route }),
      table({ head: ['Koszt', o.totalColumn, 'Na osobę'], items: o.items, total: o.total, totalLabel: 'Razem', people: data.people, mini: true }),
      h('p', { class: 'tm' }, [h('b', { text: 'Czas:' }), ` ${o.time}`]),
    ]))),
  );

  // Podsumowanie wariantów
  const sm = data.summary;
  const grand = options.map((o) => sum([cruiseTotal, o.total]));
  root.append(
    h('h2', { id: sm.id, text: sm.title }),
    h('div', { class: 'tw' }, [h('table', { class: 'cost' }, [
      h('thead', {}, [h('tr', {}, [h('th'), ...options.map((o) => h('th', { text: sm.columns[o.id] }))])]),
      h('tbody', {}, [
        row(sm.rows.cruise, options.map(() => money(cruiseTotal))),
        row(sm.rows.transport, options.map((o) => money(o.total))),
        row(sm.rows.total, grand.map((g) => money(g))),
      ]),
      h('tfoot', {}, [h('tr', {}, [h('th', { text: sm.rows.perPerson }), ...grand.map((g) => h('td', { text: money(perPerson(g, data.people), 'perPerson') }))])]),
    ])]),
    ...data.notes.map((n) => h('p', { class: 'cn', text: n })),
    h('p', { class: 'cn', text: `${data.sourcesNote} Przeliczenia po ${decimal(data.rates.EUR)} zł za euro i ${decimal(data.rates.NOK)} zł za koronę.` }),
  );
}

function table({ head, items, total, totalLabel, people, mini = false }) {
  const t = h('table', { class: mini ? 'cost mini' : 'cost' }, [
    h('thead', {}, [h('tr', {}, head.map((c) => h('th', { text: c })))]),
    h('tbody', {}, items.map((i) => h('tr', {}, [
      h('td', {}, [i.label, i.note ? h('span', { class: 'n', text: noteText(i) }) : null]),
      h('td', { text: money(i.value) }),
      h('td', { text: money(perPerson(i.value, people), 'perPerson') }),
    ]))),
    h('tfoot', {}, [h('tr', {}, [
      h('th', { text: totalLabel }),
      h('td', { text: money(total) }),
      h('td', { text: money(perPerson(total, people), 'perPerson') }),
    ])]),
  ]);
  return mini ? t : h('div', { class: 'tw' }, [t]);
}

// W notatce paliwa liczby wstawiane są z danych, żeby opis zawsze zgadzał się z wyliczeniem.
function noteText(item) {
  if (item.cost.type !== 'fuel') return item.note;
  return item.note
    .replace('{trips}', item.cost.trips)
    .replace('{oneWayKm}', number(item.cost.oneWayKm))
    .replace('{tanks}', fuelTanks(item.cost))
    .replace('{pricePerTank}', number(item.cost.pricePerTank));
}

function row(label, cells) {
  return h('tr', {}, [h('td', { text: label }), ...cells.map((c) => h('td', { text: c }))]);
}
