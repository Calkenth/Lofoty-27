// Zakładki: przełączanie paneli, obsługa klawiatury i adresów z #.
// Każdy panel ma atrybut data-hash, np. data-hash="kosztorys" -> adres .../#kosztorys.
export function initTabs() {
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

  function show(panelId, updateUrl) {
    for (const tab of tabs) {
      const on = tab.getAttribute('aria-controls') === panelId;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      panelOf(tab).hidden = !on;
    }
    // Mapa liczy rozmiary z wymiarów elementu, więc po pokazaniu panelu trzeba je odświeżyć.
    window.dispatchEvent(new Event('resize'));
    if (updateUrl) {
      const hash = document.getElementById(panelId).dataset.hash;
      history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => show(tab.getAttribute('aria-controls'), true));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });
  });

  function fromHash() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) return;
    const panels = tabs.map(panelOf);
    const byHash = panels.find((p) => p.dataset.hash === hash);
    if (byHash) return show(byHash.id, false);
    const target = document.getElementById(hash);
    const owner = target && panels.find((p) => p.contains(target));
    if (owner) show(owner.id, false);
  }

  window.addEventListener('hashchange', fromHash);
  fromHash();
}
