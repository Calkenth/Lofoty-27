// Zakładka Pogoda: tabela średnich i karty warunków.
import { h } from '../../shared/js/dom.js';

export function renderWeather(data) {
  const root = document.getElementById('weather');
  const { columns, rows } = data.climate;
  root.append(
    h('h2', { id: 'pogoda', text: data.title }),
    h('p', { class: 'sub', text: data.intro }),
    h('div', { class: 'tw' }, [h('table', { class: 'cost wxt' }, [
      h('thead', {}, [h('tr', {}, [h('th'), ...columns.map((c) => h('th', { text: c }))])]),
      h('tbody', {}, rows.map((row) => h('tr', {}, row.map((cell) => h('td', { text: cell }))))),
    ])]),
    h('p', { class: 'cn', text: data.daylight }),
    h('div', { class: 'wx' }, data.cards.map((card) => h('article', { class: 'wxc' }, [
      h('p', { class: 'wxk', text: card.place }),
      h('h3', { text: card.time }),
      h('p', { class: 'wxv', text: card.summary }),
      h('ul', {}, card.items.map((i) => h('li', { text: i }))),
      h('p', { class: 'wxu' }, [h('b', { text: 'Ubiór:' }), ` ${card.wear}`]),
    ]))),
    h('p', { class: 'cn', text: data.sources }),
  );
}
