// Plan dzień po dniu (harmonogram godzinowy) i szczegółowe opisy dni.
import { h } from '../../shared/js/dom.js';

export function renderItinerary({ days, stops, onFocus }) {
  const list = document.getElementById('days');
  const descriptions = document.getElementById('descriptions');
  const weekOf = (n) => stops.find((st) => st.n === n).week;

  for (const day of days) {
    const uniqueStops = day.stops.filter((n, i, all) => all.indexOf(n) === i);
    const pins = h('span', { class: 'pins' }, uniqueStops.map((n) => h('span', { class: `pin w${weekOf(n)}`, text: String(n) })));
    const head = h('div', { class: 'dh', tabindex: '0', role: 'button' }, [
      h('span', { class: 'd', text: day.date }),
      h('span', { class: 't' }, [day.title, pins]),
      h('span', { class: 'm', text: day.nm ? `${day.nm} Mm` : 'bez przelotu' }),
    ]);
    const schedule = h('ul', { class: 'sch' }, [
      ...day.schedule.map((item) => h('li', { class: item.kind }, [
        h('span', { class: 'h', text: item.time }),
        h('i', { class: `dot ${item.kind}` }),
        h('span', { class: 'x', text: item.text }),
      ])),
      h('li', { class: 'more' }, [h('span'), h('span'), h('a', { href: `#opis-${day.id}`, text: 'Szczegółowy opis dnia ↓' })]),
    ]);
    const item = h('li', { class: 'dayb', id: `dzien-${day.id}` }, [head, schedule]);

    const focus = () => {
      onFocus(day.stops);
      document.querySelectorAll('.dayb.on').forEach((n) => n.classList.remove('on'));
      item.classList.add('on');
      const bar = document.querySelector('.bar');
      const top = bar.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    head.addEventListener('click', focus);
    head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focus(); } });
    list.appendChild(item);

    descriptions.appendChild(h('article', { class: 'ds', id: `opis-${day.id}` }, [
      h('h3', {}, [h('span', { class: 'dd', text: day.date }), ` ${day.description.title}`]),
      ...day.description.paragraphs.map((p) => h('p', { text: p })),
      h('p', { class: 'back' }, [h('a', { href: `#dzien-${day.id}`, text: '↑ wróć do planu dnia' })]),
    ]));
  }
}
