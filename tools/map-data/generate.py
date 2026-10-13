#!/usr/bin/env python3
"""Generuje dane mapy: linię brzegową, kurs po wodzie i położenie postojów na mapie.

Wejście:
  - tools/map-data/config.json   kadr mapy, odcinki trasy, etykiety geograficzne
  - shared/data/stops.json       postoje z nazwami i współrzędnymi (lat, lon)
  - linia brzegowa Norwegii (Norge-L.geojson z repozytorium robhop/fylker-og-kommuner,
    pobierana automatycznie do tools/map-data/cache/)

Wyjście:
  - features/map/data/coastline.json  ląd jako ścieżka SVG i etykiety
  - features/map/data/route.json      kurs z podziałem na tydzień 1, tydzień 2 i wypad
  - shared/data/stops.json            uzupełnione współrzędne x, y na mapie

Kurs jest liczony algorytmem A* na siatce ok. 280 m, z karą za bliskość brzegu,
więc omija ląd i trzyma się szerszych przejść. Długości odcinków są wypisywane na końcu.

Użycie:
  pip install -r tools/map-data/requirements.txt
  python3 tools/map-data/generate.py
"""
import heapq
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
import shapely
from scipy import ndimage
from shapely.geometry import LineString, Point, box, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
COAST_URL = "https://raw.githubusercontent.com/robhop/fylker-og-kommuner/main/Norge-L.geojson"
CACHE = HERE / "cache" / "Norge-L.geojson"


def load_norway():
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        print(f"Pobieram linię brzegową: {COAST_URL}")
        urllib.request.urlretrieve(COAST_URL, CACHE)
    data = json.loads(CACHE.read_text(encoding="utf-8"))
    return shape(data["features"][0]["geometry"])


# ---------- wyznaczanie kursu po wodzie ----------

def routing_land(norway, bbox):
    b = box(*bbox)
    parts = [p for p in norway.geoms if p.intersects(b)]
    return unary_union([make_valid(p).intersection(b) for p in parts])


class WaterGrid:
    NEIGHBOURS = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1),
                  (-2, 1), (-2, -1), (2, 1), (2, -1), (1, 2), (1, -2), (-1, 2), (-1, -2)]

    def __init__(self, land, grid):
        self.lats = np.arange(*grid["lat"])
        self.lons = np.arange(*grid["lon"])
        lo, la = np.meshgrid(self.lons, self.lats)
        self.water = ~shapely.contains_xy(land, lo, la)
        dist = ndimage.distance_transform_edt(self.water)       # odległość od brzegu w komórkach
        self.cost = 1 + 3.0 / np.maximum(dist, 0.5) ** 1.5       # kara za bliskość brzegu

    def cell(self, lat, lon):
        """Najbliższa komórka wody do punktu (porty leżą przy samym brzegu)."""
        r = int(round((lat - self.lats[0]) / (self.lats[1] - self.lats[0])))
        c = int(round((lon - self.lons[0]) / (self.lons[1] - self.lons[0])))
        rows, cols = self.water.shape
        for radius in range(15):
            best = None
            for dr in range(-radius, radius + 1):
                for dc in range(-radius, radius + 1):
                    rr, cc = r + dr, c + dc
                    if 0 <= rr < rows and 0 <= cc < cols and self.water[rr, cc]:
                        d = dr * dr + dc * dc
                        if best is None or d < best[0]:
                            best = (d, rr, cc)
            if best:
                return best[1], best[2]
        raise ValueError(f"Brak wody w pobliżu punktu {lat}, {lon}")

    def route(self, a, b):
        start, goal = self.cell(*a), self.cell(*b)
        rows, cols = self.water.shape
        queue, g_score, came = [(0, start)], {start: 0}, {}
        while queue:
            _, u = heapq.heappop(queue)
            if u == goal:
                break
            for dr, dc in self.NEIGHBOURS:
                v = (u[0] + dr, u[1] + dc)
                if not (0 <= v[0] < rows and 0 <= v[1] < cols) or not self.water[v]:
                    continue
                if abs(dr) == 2 or abs(dc) == 2:   # skok o dwie komórki: środek też musi być wodą
                    mid = (u[0] + (dr // 2 if abs(dr) == 2 else 0), u[1] + (dc // 2 if abs(dc) == 2 else 0))
                    if not self.water[mid]:
                        continue
                step = math.hypot(dr, dc) * (self.cost[u] + self.cost[v]) / 2
                score = g_score[u] + step
                if score < g_score.get(v, float("inf")):
                    g_score[v], came[v] = score, u
                    heapq.heappush(queue, (score + math.hypot(v[0] - goal[0], v[1] - goal[1]), v))
        if goal not in came and goal != start:
            raise ValueError(f"Nie znaleziono drogi po wodzie z {a} do {b}")
        path = [goal]
        while path[-1] != start:
            path.append(came[path[-1]])
        return [(float(self.lats[r]), float(self.lons[c])) for r, c in reversed(path)]


def simplify_on_water(points, land, tol):
    """Upraszcza linię, dopóki żaden odcinek nie przecina lądu."""
    line = LineString([(lon, lat) for lat, lon in points])
    t = tol
    while t > 0.0002:
        coords = list(line.simplify(t, preserve_topology=False).coords)
        crosses = False
        for p, q in zip(coords, coords[1:]):
            seg = LineString([p, q])
            n = max(2, int(seg.length / 0.0008))
            if any(land.contains(seg.interpolate(j / n, normalized=True)) for j in range(1, n)):
                crosses = True
                break
        if not crosses:
            return [(c[1], c[0]) for c in coords]
        t /= 1.6
    return points


def nautical_miles(points):
    return sum(math.hypot((b[0] - a[0]) * 60, (b[1] - a[1]) * 60 * math.cos(math.radians(a[0])))
               for a, b in zip(points, points[1:]))


# ---------- rysunek mapy ----------

class Projection:
    def __init__(self, d):
        self.lon0, self.lon1 = d["lon"]
        self.lat0, self.lat1 = d["lat"]
        self.cs = d["width"] / (self.lon1 - self.lon0)
        self.s = self.cs / math.cos(math.radians(d["refLat"]))
        self.width = d["width"]
        self.height = (self.lat1 - self.lat0) * self.s

    def __call__(self, lat, lon):
        return ((lon - self.lon0) * self.cs, (self.lat1 - lat) * self.s)


def display_land(norway, d, excl):
    b = box(d["lon"][0] - 0.02, d["lat"][0] - 0.02, d["lon"][1] + 0.02, d["lat"][1] + 0.02)
    polys = []
    for p in norway.geoms:
        if not p.intersects(b):
            continue
        clipped = make_valid(p).intersection(b)
        for part in getattr(clipped, "geoms", [clipped]):
            if part.geom_type != "Polygon" or part.is_empty:
                continue
            rp = part.representative_point()
            if rp.y < excl["maxLat"] and rp.x > excl["minLon"]:
                continue
            polys.append(part)
    return polys


def land_path(polys, proj, d):
    parts = []
    for p in polys:
        if p.area < d["minArea"]:
            continue
        simple = p.simplify(d["simplify"], preserve_topology=True)
        for poly in getattr(simple, "geoms", [simple]):
            if poly.geom_type != "Polygon":
                continue
            pts = [tuple(round(v, 1) for v in proj(y, x)) for x, y in poly.exterior.coords][:-1]
            out, (px, py), seg = "M%g %g" % pts[0], pts[0], []
            for a, b in pts[1:]:
                dx, dy = round(a - px, 1), round(b - py, 1)
                if dx == 0 and dy == 0:
                    continue
                seg.append("%g %g" % (dx, dy))
                px, py = a, b
            if len(seg) >= 2:
                parts.append(out + "l" + " ".join(seg).replace(" -", "-") + "z")
    return "".join(parts)


def place_labels(cfg_labels, land, proj):
    labels = []
    for item in cfg_labels:
        for lat, lon in item["candidates"]:
            on_land = land.contains(Point(lon, lat))
            if (item["kind"] == "land") == on_land:
                x, y = proj(lat, lon)
                near_edge = x > proj.width - 70
                labels.append({"kind": item["kind"], "name": item["name"],
                               "x": round(min(x, proj.width - 6) if near_edge else x, 1), "y": round(y, 1),
                               "anchor": "end" if near_edge else "middle"})
                break
        else:
            print(f"Uwaga: nie znalazłem miejsca na etykietę {item['name']}")
    return labels


def main():
    cfg = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
    stops_path = ROOT / "shared" / "data" / "stops.json"
    stops = json.loads(stops_path.read_text(encoding="utf-8"))
    points = {s["name"]: (s["lat"], s["lon"]) for s in stops}
    points.update({k: tuple(v) for k, v in cfg["points"].items()})

    norway = load_norway()
    land = routing_land(norway, cfg["routing"]["bbox"])
    grid = WaterGrid(land, cfg["routing"]["grid"])
    proj = Projection(cfg["display"])

    routes = {"week1": [], "week2": [], "excursion": []}
    total = 0.0
    print(f"{'Odcinek':45s} Mm")
    for leg in cfg["legs"]:
        if "manual" in leg:
            pts, name, simplify_px = [tuple(p) for p in leg["manual"]], "(kurs ręczny)", None
        else:
            raw = grid.route(points[leg["from"]], points[leg["to"]])
            pts = simplify_on_water(raw, land, cfg["routing"]["simplify"])
            name, simplify_px = f"{leg['from']} → {leg['to']}", cfg["display"]["routeSimplifyPx"]
            total += nautical_miles(raw)
            print(f"{name:45s} {nautical_miles(raw):5.1f}")
        line = LineString([proj(a, b) for a, b in pts])
        if simplify_px:
            line = line.simplify(simplify_px)
        key = "excursion" if leg["week"] == "excursion" else f"week{leg['week']}"
        routes[key].append("M" + " ".join("%.1f %.1f" % c for c in line.coords))
    print(f"{'Razem (bez kursu ręcznego)':45s} {total:5.1f}")

    polys = display_land(norway, cfg["display"], cfg["mainlandExclusion"])
    coastline = {
        "width": proj.width, "height": round(proj.height, 1), "unitsPerNm": round(proj.s / 60, 3),
        "land": land_path(polys, proj, cfg["display"]),
        "labels": place_labels(cfg["labels"], unary_union(polys), proj),
    }
    data_dir = ROOT / "features" / "map" / "data"
    (data_dir / "coastline.json").write_text(json.dumps(coastline, ensure_ascii=False), encoding="utf-8")
    (data_dir / "route.json").write_text(json.dumps({k: "".join(v) for k, v in routes.items()}, ensure_ascii=False, indent=1), encoding="utf-8")
    for s in stops:
        s["x"], s["y"] = (round(v, 1) for v in proj(s["lat"], s["lon"]))
    stops_path.write_text(json.dumps(stops, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Zapisano coastline.json, route.json i współrzędne w stops.json")


if __name__ == "__main__":
    main()
