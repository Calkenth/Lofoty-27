// Punkt wejścia strony: wczytuje dane i uruchamia moduły.
import { loadJSON } from './shared/js/data.js';
import { initTabs } from './features/tabs/tabs.js';
import { initMap, focusStops } from './features/map/map.js';
import { renderItinerary } from './features/itinerary/itinerary.js';
import { renderWeather } from './features/weather/weather.js';
import { renderCosts } from './features/costs/costs.js';

export const DATA_FILES = {
  stops: 'shared/data/stops.json',
  coastline: 'features/map/data/coastline.json',
  route: 'features/map/data/route.json',
  views: 'features/map/data/views.json',
  days: 'features/itinerary/data/days.json',
  weather: 'features/weather/data/weather.json',
  costs: 'features/costs/data/costs.json',
};

async function start() {
  const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, path]) => [key, await loadJSON(path)]));
  const d = Object.fromEntries(entries);
  initMap({ coastline: d.coastline, route: d.route, views: d.views, stops: d.stops });
  renderItinerary({ days: d.days, stops: d.stops, onFocus: focusStops });
  renderWeather(d.weather);
  renderCosts(d.costs);
  initTabs();
}

start().catch((err) => {
  console.error(err);
  const box = document.getElementById('load-error');
  if (box) { box.hidden = false; box.textContent = `Nie udało się wczytać strony: ${err.message}`; }
});
