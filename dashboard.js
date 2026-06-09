/* ============================================================
   BirCalc — Dashboard interactions
   - Mega-menu open/close
   - Customize mode (drag & drop tiles with SortableJS)
   - localStorage tile-order persistence
   - Page title sync
============================================================ */

const DEFAULT_TILE_ORDER = ['nett', 'gross', 'deductions', 'taxable', 'details'];
const STORAGE_KEY = 'bircalc_tile_order_v1';

let sortableInstance = null;
let preCustomizeOrder = null; // snapshot for cancel

/* ---------- Mega menu ---------- */
function toggleMegaMenu(force) {
    const menu = document.getElementById('megaMenu');
    const backdrop = document.getElementById('megaBackdrop');
    const trigger = document.getElementById('menuTrigger');
    const willOpen = (force !== undefined) ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', willOpen);
    backdrop.classList.toggle('show', willOpen);
    trigger.classList.toggle('open', willOpen);
}

/* ---------- Tile order persistence ---------- */
function getSavedTileOrder() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return null;
        // Make sure the saved order references the same tile set we know about
        const known = new Set(DEFAULT_TILE_ORDER);
        const filtered = arr.filter(id => known.has(id));
        DEFAULT_TILE_ORDER.forEach(id => { if (!filtered.includes(id)) filtered.push(id); });
        return filtered;
    } catch (e) { return null; }
}

function applyTileOrder(order) {
    const grid = document.getElementById('tileGrid');
    if (!grid) return;
    const byId = {};
    Array.from(grid.children).forEach(child => {
        const id = child.getAttribute('data-tile');
        if (id) byId[id] = child;
    });
    order.forEach(id => {
        if (byId[id]) grid.appendChild(byId[id]);
    });
}

function readCurrentOrder() {
    const grid = document.getElementById('tileGrid');
    return Array.from(grid.children)
        .map(c => c.getAttribute('data-tile'))
        .filter(Boolean);
}

/* ---------- Customize mode ---------- */
function enterCustomize() {
    if (document.body.classList.contains('customizing')) return;
    // Force individual tab so the user actually sees the tiles
    if (!document.getElementById('individual').classList.contains('active')) {
        const indTab = document.querySelector('.ctx-tab[data-tab="individual"]');
        switchTab('individual', indTab);
    }
    preCustomizeOrder = readCurrentOrder();
    document.body.classList.add('customizing');
    document.getElementById('customizeBtn').classList.add('active');
    document.getElementById('editBar').classList.add('show');

    const grid = document.getElementById('tileGrid');
    sortableInstance = new Sortable(grid, {
        animation: 180,
        handle: '.tile-grip',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
    });
}

function exitCustomize() {
    document.body.classList.remove('customizing');
    document.getElementById('customizeBtn').classList.remove('active');
    document.getElementById('editBar').classList.remove('show');
    if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
    preCustomizeOrder = null;
}

function saveCustomize() {
    const order = readCurrentOrder();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch (e) {}
    exitCustomize();
}

function cancelCustomize() {
    if (preCustomizeOrder) applyTileOrder(preCustomizeOrder);
    exitCustomize();
}

function resetTiles() {
    applyTileOrder(DEFAULT_TILE_ORDER);
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved tile order
    const saved = getSavedTileOrder();
    if (saved) applyTileOrder(saved);

    // Mega menu trigger
    const trigger = document.getElementById('menuTrigger');
    if (trigger) trigger.addEventListener('click', e => { e.stopPropagation(); toggleMegaMenu(); });

    const backdrop = document.getElementById('megaBackdrop');
    if (backdrop) backdrop.addEventListener('click', () => toggleMegaMenu(false));

    // Mega-menu chips → switchTab + close menu
    document.querySelectorAll('.chip[data-tab]').forEach(c => {
        c.addEventListener('click', () => {
            const id = c.getAttribute('data-tab');
            const tabBtn = document.querySelector(`.ctx-tab[data-tab="${id}"]`);
            switchTab(id, tabBtn);
            toggleMegaMenu(false);
        });
    });

    // Customize button
    const cbtn = document.getElementById('customizeBtn');
    if (cbtn) cbtn.addEventListener('click', () => {
        if (document.body.classList.contains('customizing')) cancelCustomize();
        else enterCustomize();
    });

    // Esc closes mega-menu / cancels customize
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('megaMenu').classList.contains('open')) toggleMegaMenu(false);
        else if (document.body.classList.contains('customizing')) cancelCustomize();
    });

    // Lucide icons
    if (window.lucide) lucide.createIcons();

    // Kick first calc
    if (typeof calc === 'function') calc();
});
