# Rejs po Lofotach 2027

Strona z planem rejsu: mapa trasy, plan dzień po dniu, pogoda i kosztorys.
Publikowana przez GitHub Pages: https://calkenth.github.io/Lofoty-27/

## Jak zmieniać treść

Treść jest w plikach JSON, więc większość zmian nie wymaga ruszania kodu.

| Co zmieniam | Plik |
|---|---|
| Harmonogram dnia, opis dnia | `features/itinerary/data/days.json` |
| Ceny, kursy walut, liczba osób | `features/costs/data/costs.json` |
| Pogoda | `features/weather/data/weather.json` |
| Postoje (nazwy, współrzędne, położenie etykiet) | `shared/data/stops.json` |
| Gotowe widoki mapy (przyciski nad mapą) | `features/map/data/views.json` |

Kosztorys liczy sumy sam. W `costs.json` są tylko pozycje, kursy walut i liczba osób;
sumy, kwoty na osobę i podsumowanie wariantów wylicza `features/costs/calc.js`.
Zaokrąglenia: kwoty dokładne do 1 zł, przedziały i szacunki do 10 zł (za całość) albo do 5 zł (na osobę).

## Struktura

```
index.html                 szkielet strony
main.js                    punkt wejścia: wczytuje dane i uruchamia moduły
assets/css/                kolory i motyw (tokens), układ (base), wspólne elementy (components)
features/<funkcja>/        każda funkcja ma swój kod, style i dane:
  tabs/                    zakładki i adresy z #
  map/                     mapa, przesuwanie i przybliżanie
  itinerary/               plan dzień po dniu i opisy dni
  weather/                 zakładka Pogoda
  costs/                   zakładka Kosztorys
shared/js/                 wczytywanie danych, tworzenie elementów DOM/SVG
shared/data/stops.json     postoje wspólne dla mapy i planu
tools/bundler/             sklejanie strony w jeden plik
tools/map-data/            generowanie linii brzegowej i kursu
dist/lofoty.html           wygenerowana wersja jednoplikowa (nie edytować ręcznie)
```

Bez frameworka i bez kroku budowania: przeglądarka wczytuje moduły ES bezpośrednio.

## Podgląd lokalny

Moduły i pliki JSON wymagają serwera (nie zadziałają z `file://`):

```
python3 -m http.server 8000
```

i otwórz http://localhost:8000.

## Wersja jednoplikowa

```
python3 tools/bundler/bundle.py
```

Tworzy `dist/lofoty.html`: jeden plik z wklejonymi stylami, danymi i skryptami.
Służy do publikacji jako artefakt w Claude i do wysyłania jako plik, który działa bez serwera.
Po każdej zmianie w treści trzeba go zbudować ponownie. Wersja online jest też pod adresem
https://calkenth.github.io/Lofoty-27/dist/lofoty.html

## Dane mapy

Linia brzegowa, kurs po wodzie i położenie postojów na mapie są generowane:

```
pip install -r tools/map-data/requirements.txt
python3 tools/map-data/generate.py
```

Kadr mapy, odcinki trasy i etykiety są w `tools/map-data/config.json`, a postoje w `shared/data/stops.json`.
Kurs jest liczony algorytmem A* po wodzie z karą za bliskość brzegu; skrypt wypisuje długości odcinków w milach morskich.
Linia brzegowa pochodzi z repozytorium robhop/fylker-og-kommuner i jest pobierana automatycznie.

Mapa jest poglądowa, nie do nawigacji.
