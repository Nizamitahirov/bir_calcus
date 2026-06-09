/* ============================================================
   BirCalc — Calculation logic
   ALL formulas, tax tables and bulk handlers (untouched).
   UI helpers (switchTab, setSystem, setCompany, selectBenefit)
   are kept here because the existing handlers reference them.
============================================================ */

let currentSystem = 'general';
let currentCompany = 'Birbank';
let alertSkipped = false;

function setSystem(sys, el) {
    currentSystem = sys;
    document.querySelectorAll('#swGeneral, #swRecruitment').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    alertSkipped = false;
    calc();
}

function switchTab(id, el) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.ctx-tab').forEach(l => l.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (el) el.classList.add('active');
    else {
        const tabBtn = document.querySelector(`.ctx-tab[data-tab="${id}"]`);
        if (tabBtn) tabBtn.classList.add('active');
    }
    // Update page title
    const titles = {
        individual: 'Fərdi hesablama',
        bulk: 'Toplu hesablama',
        transfer: 'Transfer & Promotion',
        massgrowth: 'Kütləvi artımlar',
        texnopar: 'Texnopar'
    };
    const pt = document.getElementById('pageTitle');
    if (pt && titles[id]) pt.innerText = titles[id];
    // Mirror to mega-menu chips
    document.querySelectorAll('.chip[data-tab]').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-tab') === id);
    });
}

function setCompany(name, el) {
    currentCompany = name;
    document.querySelectorAll('#ctxCompany .seg-btn').forEach(b => {
        b.classList.remove('active', 'company-birbank');
    });
    el.classList.add('active');
    if (name === 'Birbank') el.classList.add('company-birbank');
    document.getElementById('union').value = (name === 'Birbank') ? "1" : "0";
    alertSkipped = false;
    calc();
    tpCalc();
    mgCalc();
    mgBulkRecalc();
    txCalc();
    txBulkRecalc();
}

function handleManualInput() { alertSkipped = false; calc(); }
function toggleMode() { alertSkipped = false; calc(); }
function selectBenefit(id) {
    document.getElementById(id).checked = true;
    calc(); tpCalc(); mgCalc(); mgBulkRecalc(); txCalc(); txBulkRecalc();
}

function getBaseRef(workplace) {
    const isMain = workplace === 'main';
    if (currentCompany === 'Birbank') return isMain ? 354 : 348;
    return isMain ? 358 : 352;
}

function applyFix(type) {
    const workplace = document.getElementById('workplace').value;
    const base = getBaseRef(workplace);
    document.getElementById('salaryInput').value = (type === 1) ? base : base + 10;
    alertSkipped = true;
    calc();
}

function getDeductions(gross, benefit, unionPct, workplace, sector, year) {
    let tax = 0, dsmf = 0, unemp = 0, med = 0, union = 0;
    let taxable = Math.max(0, gross - benefit);

    if (sector === 'private' && year === '2026') {
        if (workplace === 'main') {
            if (taxable <= 200) tax = 0;
            else if (taxable <= 2500) tax = (taxable - 200) * 0.03;
            else if (taxable <= 8000) tax = 75 + (taxable - 2500) * 0.10;
            else tax = 625 + (taxable - 8000) * 0.14;
        } else {
            if (taxable <= 2500) tax = taxable * 0.03;
            else if (taxable <= 8000) tax = 75 + (taxable - 2500) * 0.10;
            else tax = 625 + (taxable - 8000) * 0.14;
        }
        dsmf = (gross <= 200) ? gross * 0.03 : (6 + (gross - 200) * 0.10);
        unemp = gross * 0.005;
        med = (gross <= 2500) ? gross * 0.02 : (50 + (gross - 2500) * 0.005);
    } else if (sector === 'private') {
        tax = (taxable > 8000) ? (taxable - 8000) * 0.14 : 0;
        dsmf = (gross <= 200) ? gross * 0.03 : (6 + (gross - 200) * 0.10);
        unemp = gross * 0.005;
        med = (gross <= 8000) ? gross * 0.02 : (160 + (gross - 8000) * 0.005);
    } else {
        let bt = (workplace === 'main') ? Math.max(0, taxable - 200) : taxable;
        if (bt <= 2500) tax = bt * 0.14;
        else tax = 350 + (bt - 2500) * 0.25;

        if (year === '2026') {
            dsmf = gross * 0.03;
            med = (gross <= 2500) ? gross * 0.02 : (50 + (gross - 2500) * 0.005);
        } else {
            dsmf = (gross <= 200) ? gross * 0.03 : (6 + (gross - 200) * 0.10);
            med = (gross <= 8000) ? gross * 0.02 : (160 + (gross - 8000) * 0.005);
        }
        unemp = gross * 0.005;
    }
    union = gross * (unionPct / 100);
    return { tax, dsmf, unemp, med, union, taxable, total: tax + dsmf + unemp + med + union };
}

function solveGross(targetNett, b, u, w, s, y) {
    let low = targetNett, high = targetNett * 3, iter = 0;
    while (iter < 38) {
        let mid = (low + high) / 2;
        let res = getDeductions(mid, b, u, w, s, y);
        if (mid - res.total < targetNett) low = mid;
        else high = mid;
        iter++;
    }
    return high;
}

function calc() {
    const year = document.getElementById('year').value;
    const sector = document.getElementById('sector').value;
    const workplace = document.getElementById('workplace').value;
    const mode = document.getElementById('mode').value;
    const val = parseFloat(document.getElementById('salaryInput').value) || 0;
    const benefit = parseFloat(document.querySelector('input[name="benefit"]:checked').value);
    const unionPct = parseFloat(document.getElementById('union').value);

    const isN2G = mode === 'n2g';
    const isRecruitmentN2G = isN2G && currentSystem === 'recruitment';

    let finalGross, finalNett, res, meal = 0, baseNet = 0;

    if (isRecruitmentN2G) {
        const minRef = getBaseRef(workplace);
        const maxRef = minRef + 10;
        if (val > minRef && val < maxRef && !alertSkipped) {
            document.getElementById('salaryAlert').style.display = 'flex';
            document.getElementById('alertText').innerText = `Məbləğ ${minRef}-${maxRef} aralığında ola bilməz.`;
            document.getElementById('btn1').innerText = `${minRef} tətbiq et`;
            document.getElementById('btn2').innerText = `${maxRef} tətbiq et`;
        } else { document.getElementById('salaryAlert').style.display = 'none'; }

        meal = Math.max(0, val - minRef);
        if (meal > 0 && meal < 10) meal = 10;
        if (meal > 100) meal = 100;
        baseNet = val - meal;

        finalGross = solveGross(baseNet, benefit, unionPct, workplace, sector, year);
        res = getDeductions(finalGross, benefit, unionPct, workplace, sector, year);
        finalNett = val;

        document.getElementById('mealNotice').style.display = 'flex';
    } else {
        document.getElementById('salaryAlert').style.display = 'none';
        document.getElementById('mealNotice').style.display = 'none';
        if (isN2G) {
            finalGross = solveGross(val, benefit, unionPct, workplace, sector, year);
            res = getDeductions(finalGross, benefit, unionPct, workplace, sector, year);
            finalNett = val;
        } else {
            finalGross = val;
            res = getDeductions(finalGross, benefit, unionPct, workplace, sector, year);
            finalNett = finalGross - res.total;
        }
    }

    document.getElementById('k-nett').innerText = finalNett.toFixed(2);
    document.getElementById('k-gross').innerText = finalGross.toFixed(2);
    document.getElementById('label-gross').innerText = isRecruitmentN2G ? "GROSS (Baza)" : "GROSS";

    if (isRecruitmentN2G) {
        document.getElementById('label-k1').innerText = "Yemək Pulu";
        document.getElementById('val-k1').innerText = meal.toFixed(2);
        document.getElementById('val-k1').style.color = "#ed8936";
        document.getElementById('label-k2').innerText = "Baza Net";
        document.getElementById('val-k2').innerText = baseNet.toFixed(2);
        document.getElementById('val-k2').style.color = "#16a34a";
    } else {
        document.getElementById('label-k1').innerText = "Cəmi Tutulmalar";
        document.getElementById('val-k1').innerText = res.total.toFixed(2);
        document.getElementById('val-k1').style.color = "";
        document.getElementById('label-k2').innerText = "Vergiyə cəlb olunan";
        document.getElementById('val-k2').innerText = res.taxable.toFixed(2);
        document.getElementById('val-k2').style.color = "";
    }

    const table = document.getElementById('reportTable');
    let html = `<tr><td class="lbl">GROSS ${isRecruitmentN2G ? '(Baza)' : ''}</td><td class="val">${finalGross.toFixed(2)}</td></tr>`;
    html += `<tr><td class="lbl">Gəlir Vergisi</td><td class="val">${res.tax.toFixed(2)}</td></tr>`;
    html += `<tr><td class="lbl">Sosial (DSMF)</td><td class="val">${res.dsmf.toFixed(2)}</td></tr>`;
    html += `<tr><td class="lbl">İşsizlik (0.5%)</td><td class="val">${res.unemp.toFixed(2)}</td></tr>`;
    html += `<tr><td class="lbl">İTS</td><td class="val">${res.med.toFixed(2)}</td></tr>`;
    html += `<tr><td class="lbl">Həmkar İttifaqı</td><td class="val">${res.union.toFixed(2)}</td></tr>`;
    if (isRecruitmentN2G) {
        html += `<tr class="subtotal-row"><td class="lbl">BAZA NET</td><td class="val">${baseNet.toFixed(2)}</td></tr>`;
        html += `<tr><td class="lbl">+ Yemək Pulu</td><td class="val">${meal.toFixed(2)}</td></tr>`;
        html += `<tr class="total-row"><td class="lbl">NETT (Cəm)</td><td class="val">${finalNett.toFixed(2)}</td></tr>`;
    } else {
        html += `<tr class="total-row"><td class="lbl">NETT</td><td class="val">${finalNett.toFixed(2)}</td></tr>`;
    }
    table.innerHTML = html;

    document.querySelectorAll('.benefit-item').forEach(i => i.classList.remove('active'));
    document.querySelector('input[name="benefit"]:checked').closest('.benefit-item').classList.add('active');

    if (typeof mgCalc === 'function') mgCalc();
    if (typeof mgBulkRecalc === 'function') mgBulkRecalc();
    if (typeof txCalc === 'function') txCalc();
    if (typeof txBulkRecalc === 'function') txBulkRecalc();
}

/* ============================================================
   TRANSFER & PROMOTION
============================================================ */
function tpGetParams() {
    return {
        year: document.getElementById('year').value,
        sector: document.getElementById('sector').value,
        workplace: document.getElementById('workplace').value,
        benefit: parseFloat(document.querySelector('input[name="benefit"]:checked').value),
        unionPct: parseFloat(document.getElementById('union').value),
    };
}
function tpNetFromGross(gross, p) {
    const res = getDeductions(gross, p.benefit, p.unionPct, p.workplace, p.sector, p.year);
    return gross - res.total;
}
function tpSwitchMode() {
    const isNet = document.getElementById('rb-net').checked;
    document.getElementById('tp-net-fields').style.display = isNet ? 'grid' : 'none';
    document.getElementById('tp-gross-fields').style.display = isNet ? 'none' : 'grid';
    document.getElementById('rb-net-label').classList.toggle('selected', isNet);
    document.getElementById('rb-gross-label').classList.toggle('selected', !isNet);
    tpCalc();
}
function tpSetVal(id, val) {
    document.getElementById(id).value = (val !== null && !isNaN(val)) ? val.toFixed(2) : '';
}
function tpBadge(newVal, curVal) {
    if (Math.abs(newVal - curVal) < 0.005) return `<span class="tp-badge same">= Dəyişiklik yoxdur</span>`;
    if (newVal > curVal) return `<span class="tp-badge increase">▲ +${(newVal - curVal).toFixed(2)}</span>`;
    return `<span class="tp-badge decrease">▼ ${(newVal - curVal).toFixed(2)}</span>`;
}
function tpCalc() {
    const p = tpGetParams();
    const curGross = parseFloat(document.getElementById('tp-cur-gross').value) || 0;
    const curMeal  = parseFloat(document.getElementById('tp-cur-meal').value)  || 0;
    const curNet   = curGross > 0 ? tpNetFromGross(curGross, p) : 0;
    const curTotal = curNet + curMeal;

    tpSetVal('tp-cur-net', curNet);
    tpSetVal('tp-cur-total-net', curTotal);

    const isNetMode = document.getElementById('rb-net').checked;
    if (isNetMode) {
        const propNet = parseFloat(document.getElementById('tp-prop-net').value);
        if (isNaN(propNet) || propNet <= 0 || curGross <= 0) {
            tpSetVal('tp-prop-gross-from-net', null);
            tpSetVal('tp-prop-meal-from-net', null);
            document.getElementById('tp-result-bar').style.display = 'none';
            return;
        }
        let newGross, newMeal;
        if (Math.abs(propNet - curTotal) < 0.005) {
            newGross = curGross; newMeal = curMeal;
        } else if (propNet > curTotal) {
            const mealCeiling = Math.floor((propNet - curNet) * 100) / 100;
            newMeal = Math.min(100, Math.max(0, mealCeiling));
            const baseNet = propNet - newMeal;
            newGross = baseNet > 0 ? solveGross(baseNet, p.benefit, p.unionPct, p.workplace, p.sector, p.year) : 0;
        } else {
            newMeal = curMeal;
            const targetBaseNet = propNet - curMeal;
            newGross = targetBaseNet > 0 ? solveGross(targetBaseNet, p.benefit, p.unionPct, p.workplace, p.sector, p.year) : 0;
        }
        tpSetVal('tp-prop-gross-from-net', newGross);
        tpSetVal('tp-prop-meal-from-net', newMeal);
        document.getElementById('tp-result-bar').style.display = 'grid';
        document.getElementById('tr-cur-gross-disp').innerText = curGross.toFixed(2);
        document.getElementById('tr-new-gross-disp').innerText = newGross.toFixed(2);
        document.getElementById('tr-cur-total-disp').innerText = curTotal.toFixed(2);
        document.getElementById('tr-new-total-disp').innerText = propNet.toFixed(2);
        document.getElementById('tr-gross-badge').innerHTML = tpBadge(newGross, curGross);
        document.getElementById('tr-net-badge').innerHTML   = tpBadge(propNet, curTotal);
    } else {
        const propGross = parseFloat(document.getElementById('tp-prop-gross').value);
        if (isNaN(propGross) || propGross <= 0 || curGross <= 0) {
            tpSetVal('tp-prop-total-net-from-gross', null);
            tpSetVal('tp-prop-base-net', null);
            tpSetVal('tp-prop-meal-from-gross', null);
            tpSetVal('tp-prop-gross-from-base-net', null);
            document.getElementById('tp-result-bar').style.display = 'none';
            return;
        }
        const totalNetFromPropGross = tpNetFromGross(propGross, p);
        let newBaseNet, newMeal, newGrossFromBaseNet;
        if (Math.abs(propGross - curGross) < 0.005) {
            newMeal = curMeal; newBaseNet = curNet; newGrossFromBaseNet = curGross;
        } else if (propGross > curGross) {
            const minBaseNet = curNet;
            const maxPossibleMeal = Math.min(100, Math.max(0, totalNetFromPropGross - minBaseNet));
            newMeal = maxPossibleMeal;
            newBaseNet = totalNetFromPropGross - newMeal;
            newGrossFromBaseNet = solveGross(newBaseNet, p.benefit, p.unionPct, p.workplace, p.sector, p.year);
        } else {
            newMeal = curMeal;
            newBaseNet = totalNetFromPropGross - newMeal;
            if (newBaseNet < 0) newBaseNet = 0;
            newGrossFromBaseNet = newBaseNet > 0 ? solveGross(newBaseNet, p.benefit, p.unionPct, p.workplace, p.sector, p.year) : 0;
        }
        const newTotalNet = newBaseNet + newMeal;
        tpSetVal('tp-prop-total-net-from-gross', totalNetFromPropGross);
        tpSetVal('tp-prop-base-net', newBaseNet);
        tpSetVal('tp-prop-meal-from-gross', newMeal);
        tpSetVal('tp-prop-gross-from-base-net', newGrossFromBaseNet);
        document.getElementById('tp-result-bar').style.display = 'grid';
        document.getElementById('tr-cur-gross-disp').innerText = curGross.toFixed(2);
        document.getElementById('tr-new-gross-disp').innerText = newGrossFromBaseNet.toFixed(2);
        document.getElementById('tr-cur-total-disp').innerText = curTotal.toFixed(2);
        document.getElementById('tr-new-total-disp').innerText = newTotalNet.toFixed(2);
        document.getElementById('tr-gross-badge').innerHTML = tpBadge(newGrossFromBaseNet, curGross);
        document.getElementById('tr-net-badge').innerHTML   = tpBadge(newTotalNet, curTotal);
    }
}

/* ============================================================
   BULK
============================================================ */
let bulkData = [];
function handleFile(e) {
    const reader = new FileReader();
    reader.onload = evt => {
        const workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet);
        const year = document.getElementById('year').value;
        const sector = document.getElementById('sector').value;
        const workplace = document.getElementById('workplace').value;
        const mode = document.getElementById('mode').value;
        const benefit = parseFloat(document.querySelector('input[name="benefit"]:checked').value);
        const unionPct = parseFloat(document.getElementById('union').value);
        const useBulkRec = document.getElementById('bulkRecruitmentMode').checked;
        const body = document.getElementById('bulk-body');
        const head = document.getElementById('bulk-head');
        body.innerHTML = ''; bulkData = [];
        if (useBulkRec && mode === 'n2g') {
            head.innerHTML = `<th>Badge</th><th>Gross (Baza)</th><th>Baza Net</th><th>Yemək</th><th>Nett (Cəm)</th><th>DSMF</th><th>İTS</th><th>Vergi</th>`;
        } else {
            head.innerHTML = `<th>Badge</th><th>Gross</th><th>Nett</th><th>DSMF</th><th>İTS</th><th>Vergi</th>`;
        }
        json.forEach(row => {
            const badge = row['Employee badge'] || 'N/A';
            const val = parseFloat(row['Salary']) || 0;
            if (val === 0) return;
            let g, n, res, meal = 0, baseNet = 0;
            if (useBulkRec && mode === 'n2g') {
                const minRef = getBaseRef(workplace);
                meal = Math.max(0, val - minRef);
                if (meal > 0 && meal < 10) meal = 10;
                if (meal > 100) meal = 100;
                baseNet = val - meal;
                g = solveGross(baseNet, benefit, unionPct, workplace, sector, year);
                res = getDeductions(g, benefit, unionPct, workplace, sector, year);
                n = val;
                body.innerHTML += `<tr><td>${badge}</td><td>${g.toFixed(2)}</td><td>${baseNet.toFixed(2)}</td><td>${meal.toFixed(2)}</td><td>${n.toFixed(2)}</td><td>${res.dsmf.toFixed(2)}</td><td>${res.med.toFixed(2)}</td><td>${res.tax.toFixed(2)}</td></tr>`;
                bulkData.push({ Badge: badge, Gross_Baza: g.toFixed(2), Baza_Net: baseNet.toFixed(2), Yemek_Pulu: meal.toFixed(2), Nett_Cem: n.toFixed(2) });
            } else {
                if (mode === 'n2g') {
                    g = solveGross(val, benefit, unionPct, workplace, sector, year);
                    res = getDeductions(g, benefit, unionPct, workplace, sector, year);
                    n = val;
                } else {
                    g = val; res = getDeductions(g, benefit, unionPct, workplace, sector, year); n = g - res.total;
                }
                body.innerHTML += `<tr><td>${badge}</td><td>${g.toFixed(2)}</td><td>${n.toFixed(2)}</td><td>${res.dsmf.toFixed(2)}</td><td>${res.med.toFixed(2)}</td><td>${res.tax.toFixed(2)}</td></tr>`;
                bulkData.push({ Badge: badge, Gross: g.toFixed(2), Nett: n.toFixed(2) });
            }
        });
        document.getElementById('bk-count').innerText = json.length;
        document.getElementById('bulk-results').style.display = 'block';
    };
    reader.readAsArrayBuffer(e.target.files[0]);
}
function exportResults() {
    if (bulkData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(bulkData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Maaşlar");
    XLSX.writeFile(wb, "BirCalc_Bulk.xlsx");
}

/* ============================================================
   MASS GROWTH
============================================================ */
function mgGetParams() {
    return {
        year: document.getElementById('year').value,
        sector: document.getElementById('sector').value,
        workplace: document.getElementById('workplace').value,
        benefit: parseFloat(document.querySelector('input[name="benefit"]:checked').value),
        unionPct: parseFloat(document.getElementById('union').value),
    };
}
function mgComputeOne(curGross, curMeal, incNet, isHead, p) {
    if (curGross <= 0) {
        return { newGross: 0, newMeal: 0, curNet: 0, newTotalNet: 0, status: 'Cari gross daxil edilməyib' };
    }
    if (incNet < 0) incNet = 0;
    if (curMeal < 0) curMeal = 0;

    const minGrossInc = isHead ? 50 : 20;
    const curNet = tpNetFromGross(curGross, p);
    const newTotalNet = curNet + curMeal + incNet;
    const solve = (bn) => bn > 0
        ? solveGross(bn, p.benefit, p.unionPct, p.workplace, p.sector, p.year)
        : 0;

    let newGross, newMeal, status;
    if (incNet === 0) {
        newMeal = Math.round(curMeal);
        newGross = solve(newTotalNet - newMeal);
        status = 'Artım yoxdur';
    } else if (curMeal + incNet <= 100) {
        newMeal = Math.round(curMeal + incNet);
        newGross = solve(newTotalNet - newMeal);
        status = 'Gross dəyişmir';
    } else {
        newMeal = 100;
        newGross = solve(newTotalNet - newMeal);
        if (newGross - curGross < minGrossInc) {
            const minNewGross = curGross + minGrossInc;
            const minNewBaseNet = tpNetFromGross(minNewGross, p);
            newMeal = Math.max(0, Math.min(100, Math.floor(newTotalNet - minNewBaseNet)));
            newGross = solve(newTotalNet - newMeal);
            status = `Gross minimumu (${minGrossInc} AZN) tətbiq edildi`;
        } else {
            status = 'Yemək 100-ə çatdırıldı';
        }
    }
    return { newGross, newMeal, curNet, newTotalNet, status };
}
function mgCalc() {
    const p = mgGetParams();
    const curGross = parseFloat(document.getElementById('mg-cur-gross').value) || 0;
    const curMeal  = parseFloat(document.getElementById('mg-cur-meal').value)  || 0;
    const incNet   = parseFloat(document.getElementById('mg-inc-net').value)   || 0;
    const isHead   = document.getElementById('mg-office').value === 'head';

    const curNet = curGross > 0 ? tpNetFromGross(curGross, p) : 0;
    document.getElementById('mg-cur-net').value = curGross > 0 ? curNet.toFixed(2) : '';
    document.getElementById('mg-cur-total').value = curGross > 0 ? (curNet + curMeal).toFixed(2) : '';

    if (curGross <= 0 || incNet <= 0) {
        document.getElementById('mg-new-total').value = '';
        document.getElementById('mg-new-gross').value = '';
        document.getElementById('mg-new-meal').value = '';
        document.getElementById('mg-result-bar').style.display = 'none';
        return;
    }
    const r = mgComputeOne(curGross, curMeal, incNet, isHead, p);
    document.getElementById('mg-new-total').value = r.newTotalNet.toFixed(2);
    document.getElementById('mg-new-gross').value = r.newGross.toFixed(2);
    document.getElementById('mg-new-meal').value  = r.newMeal.toString();
    document.getElementById('mg-result-bar').style.display = 'grid';
    document.getElementById('mg-r-cur-gross').innerText = curGross.toFixed(2);
    document.getElementById('mg-r-new-gross').innerText = r.newGross.toFixed(2);
    document.getElementById('mg-r-cur-meal').innerText  = Math.round(curMeal).toString();
    document.getElementById('mg-r-new-meal').innerText  = r.newMeal.toString();
    document.getElementById('mg-r-gross-badge').innerHTML = tpBadge(r.newGross, curGross);
    document.getElementById('mg-r-meal-badge').innerHTML  = tpBadge(r.newMeal, Math.round(curMeal));
}

let mgBulkData = [];
let mgBulkInput = [];
function mgNorm(s) {
    return String(s ?? '')
        .toLowerCase()
        .replace(/ə/g, 'e')
        .replace(/ı/g, 'i')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
}
function mgPickCol(row, names) {
    const targets = names.map(mgNorm);
    for (const k of Object.keys(row)) {
        if (targets.includes(mgNorm(k))) return row[k];
    }
    for (const k of Object.keys(row)) {
        const norm = mgNorm(k);
        for (const t of targets) {
            if (t && norm.includes(t)) return row[k];
        }
    }
    return undefined;
}
function mgParseWorkplace(v) {
    if (v === undefined || v === null || v === '') return null;
    const s = mgNorm(v);
    if (!s) return null;
    if (s.includes('elave') || s.includes('secondary') || s === 'extra') return 'secondary';
    if (s.includes('esas') || s.includes('main') || s === 'primary') return 'main';
    return null;
}
function mgParseUnion(v) {
    if (v === undefined || v === null || v === '') return null;
    const s = String(v).trim().replace('%', '').replace(',', '.');
    if (!s) return null;
    let n = parseFloat(s);
    if (isNaN(n)) return null;
    if (n > 0 && n < 1) n = n * 100;
    return n;
}
function mgParseOffice(v) {
    if (v === undefined || v === null || v === '') return null;
    const s = mgNorm(v);
    if (!s) return null;
    if (s.includes('bas ofis') || s.includes('head') || s === 'hq') return true;
    if (s.includes('filial') || s.includes('branch')) return false;
    return null;
}
function mgParseYear(v) {
    if (v === undefined || v === null || v === '') return null;
    const s = String(v).trim().replace(/\.0$/, '');
    if (!/^\d{4}$/.test(s)) return null;
    return s;
}
function mgHandleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        mgBulkInput = rows.map(row => ({
            badge: mgPickCol(row, ['employee badge', 'badge']) || 'N/A',
            curGross: parseFloat(mgPickCol(row, ['cari gross', 'current gross', 'gross'])) || 0,
            curMeal: parseFloat(mgPickCol(row, ['cari yemek pulu', 'cari yemək pulu', 'cari net yemek pulu', 'cari net yemək pulu', 'meal', 'yemek pulu', 'yemək pulu'])) || 0,
            incNet: parseFloat(mgPickCol(row, ['net artim', 'net artım', 'net artim mebleği', 'net artım məbləği', 'artim', 'artım', 'increase'])) || 0,
            year: mgParseYear(mgPickCol(row, ['il', 'year'])),
            workplace: mgParseWorkplace(mgPickCol(row, ['is novu', 'iş növü', 'is novu (esas/elave)', 'workplace'])),
            unionPct: mgParseUnion(mgPickCol(row, ['hik', 'həmkar', 'hemkar', 'union'])),
            isHead: mgParseOffice(mgPickCol(row, ['is yeri', 'iş yeri', 'yerlesme', 'yerləşmə', 'office', 'location'])),
        }));
        mgBulkRecalc();
    };
    reader.readAsArrayBuffer(file);
}
function mgBulkRecalc() {
    const body = document.getElementById('mg-bulk-body');
    if (!body) return;
    if (mgBulkInput.length === 0) {
        document.getElementById('mg-bulk-results').style.display = 'none';
        return;
    }
    const fb = mgGetParams();
    const fbIsHead = document.getElementById('mg-office').value === 'head';
    body.innerHTML = '';
    mgBulkData = [];
    mgBulkInput.forEach(item => {
        const p = {
            year: item.year || fb.year,
            sector: fb.sector,
            workplace: item.workplace || fb.workplace,
            unionPct: item.unionPct !== null ? item.unionPct : fb.unionPct,
            benefit: fb.benefit,
        };
        const isHead = item.isHead !== null ? item.isHead : fbIsHead;
        const r = mgComputeOne(item.curGross, item.curMeal, item.incNet, isHead, p);
        const grossDelta = r.newGross - item.curGross;
        const curMealInt = Math.round(item.curMeal);
        const wpLabel = p.workplace === 'main' ? 'Əsas' : 'Əlavə';
        const officeLabel = isHead ? 'Baş ofis' : 'Filial';
        body.innerHTML += `<tr>
            <td>${item.badge}</td>
            <td>${p.year}</td>
            <td>${wpLabel}</td>
            <td>${p.unionPct}%</td>
            <td>${officeLabel}</td>
            <td>${item.curGross.toFixed(2)}</td>
            <td>${curMealInt}</td>
            <td>${item.incNet.toFixed(2)}</td>
            <td><b style="color:#16a34a;">${r.newGross.toFixed(2)}</b></td>
            <td><b style="color:#2563eb;">${r.newMeal}</b></td>
            <td>${grossDelta.toFixed(2)}</td>
            <td style="font-size:0.68rem; color:#64748b;">${r.status}</td>
        </tr>`;
        mgBulkData.push({
            'Employee Badge': item.badge,
            'İl': p.year,
            'İş Növü': wpLabel,
            'HİK': p.unionPct,
            'İş Yeri': officeLabel,
            'Cari Gross': item.curGross.toFixed(2),
            'Cari Yemek Pulu': curMealInt,
            'Net Artim': item.incNet.toFixed(2),
            'Yeni Gross': r.newGross.toFixed(2),
            'Yeni Yemek Pulu': r.newMeal,
            'Gross Delta': grossDelta.toFixed(2),
            'Status': r.status,
        });
    });
    document.getElementById('mg-bk-count').innerText = mgBulkInput.length;
    document.getElementById('mg-bulk-results').style.display = 'block';
}
function mgExportResults() {
    if (mgBulkData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(mgBulkData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kütləvi Artımlar");
    XLSX.writeFile(wb, "BirCalc_MassGrowth.xlsx");
}

/* ============================================================
   TEXNOPAR
============================================================ */
function getDeductionsTexnopar(gross, type, unionPct) {
    let tax, dsmf, unemp, med, union;
    if (gross <= 2500) {
        tax = Math.max(0, gross - 200) * 0.05;
    } else {
        tax = gross * 0.05;
    }
    dsmf = (type === 'expat')
        ? 0
        : ((gross <= 200) ? gross * 0.03 : (6 + (gross - 200) * 0.10));
    unemp = gross * 0.005;
    med = (gross <= 2500) ? gross * 0.02 : (50 + (gross - 2500) * 0.005);
    union = gross * (unionPct / 100);
    return { tax, dsmf, unemp, med, union, total: tax + dsmf + unemp + med + union };
}
function txNetFromGross(gross, type, unionPct) {
    const r = getDeductionsTexnopar(gross, type, unionPct);
    return gross - r.total;
}
function solveGrossTexnopar(targetNet, type, unionPct) {
    let low = targetNet, high = Math.max(targetNet * 3, targetNet + 100), iter = 0;
    while (iter < 38) {
        const mid = (low + high) / 2;
        const res = getDeductionsTexnopar(mid, type, unionPct);
        if (mid - res.total < targetNet) low = mid;
        else high = mid;
        iter++;
    }
    return high;
}
function txComputeOne(curGross, curMeal, incNet, isHead, type, unionPct) {
    if (curGross <= 0) {
        return { newGross: 0, newMeal: 0, curNet: 0, newTotalNet: 0, status: 'Cari gross daxil edilməyib' };
    }
    if (incNet < 0) incNet = 0;
    if (curMeal < 0) curMeal = 0;
    const minGrossInc = isHead ? 50 : 20;
    const curNet = txNetFromGross(curGross, type, unionPct);
    const newTotalNet = curNet + curMeal + incNet;
    const solve = (bn) => bn > 0 ? solveGrossTexnopar(bn, type, unionPct) : 0;
    let newGross, newMeal, status;
    if (incNet === 0) {
        newMeal = Math.round(curMeal);
        newGross = solve(newTotalNet - newMeal);
        status = 'Artım yoxdur';
    } else if (curMeal + incNet <= 100) {
        newMeal = Math.round(curMeal + incNet);
        newGross = solve(newTotalNet - newMeal);
        status = 'Gross dəyişmir';
    } else {
        newMeal = 100;
        newGross = solve(newTotalNet - newMeal);
        if (newGross - curGross < minGrossInc) {
            const minNewGross = curGross + minGrossInc;
            const minNewBaseNet = txNetFromGross(minNewGross, type, unionPct);
            newMeal = Math.max(0, Math.min(100, Math.floor(newTotalNet - minNewBaseNet)));
            newGross = solve(newTotalNet - newMeal);
            status = `Gross minimumu (${minGrossInc} AZN) tətbiq edildi`;
        } else {
            status = 'Yemək 100-ə çatdırıldı';
        }
    }
    return { newGross, newMeal, curNet, newTotalNet, status };
}
function txCalc() {
    const type = document.getElementById('tx-type').value;
    const isHead = document.getElementById('tx-office').value === 'head';
    const unionPct = parseFloat(document.getElementById('union').value);
    const curGross = parseFloat(document.getElementById('tx-cur-gross').value) || 0;
    const curMeal  = parseFloat(document.getElementById('tx-cur-meal').value)  || 0;
    const incNet   = parseFloat(document.getElementById('tx-inc-net').value)   || 0;
    const curNet = curGross > 0 ? txNetFromGross(curGross, type, unionPct) : 0;
    document.getElementById('tx-cur-net').value = curGross > 0 ? curNet.toFixed(2) : '';
    document.getElementById('tx-cur-total').value = curGross > 0 ? (curNet + curMeal).toFixed(2) : '';
    if (curGross <= 0 || incNet <= 0) {
        document.getElementById('tx-new-total').value = '';
        document.getElementById('tx-new-gross').value = '';
        document.getElementById('tx-new-meal').value = '';
        document.getElementById('tx-result-bar').style.display = 'none';
        return;
    }
    const r = txComputeOne(curGross, curMeal, incNet, isHead, type, unionPct);
    document.getElementById('tx-new-total').value = r.newTotalNet.toFixed(2);
    document.getElementById('tx-new-gross').value = r.newGross.toFixed(2);
    document.getElementById('tx-new-meal').value  = r.newMeal.toString();
    document.getElementById('tx-result-bar').style.display = 'grid';
    document.getElementById('tx-r-cur-gross').innerText = curGross.toFixed(2);
    document.getElementById('tx-r-new-gross').innerText = r.newGross.toFixed(2);
    document.getElementById('tx-r-cur-meal').innerText  = Math.round(curMeal).toString();
    document.getElementById('tx-r-new-meal').innerText  = r.newMeal.toString();
    document.getElementById('tx-r-gross-badge').innerHTML = tpBadge(r.newGross, curGross);
    document.getElementById('tx-r-meal-badge').innerHTML  = tpBadge(r.newMeal, Math.round(curMeal));
}
let txBulkData = [];
let txBulkInput = [];
function txParseType(v) {
    if (v === undefined || v === null || v === '') return null;
    const s = mgNorm(v);
    if (!s) return null;
    if (s.includes('expat') || s.includes('xarici') || s === 'e') return 'expat';
    if (s.includes('local') || s.includes('yerli') || s === 'l') return 'local';
    return null;
}
function txHandleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        txBulkInput = rows.map(row => ({
            badge: mgPickCol(row, ['employee badge', 'badge']) || 'N/A',
            curGross: parseFloat(mgPickCol(row, ['cari gross', 'current gross', 'gross'])) || 0,
            curMeal: parseFloat(mgPickCol(row, ['cari yemek pulu', 'cari yemək pulu', 'meal', 'yemek pulu', 'yemək pulu'])) || 0,
            incNet: parseFloat(mgPickCol(row, ['net artim', 'net artım', 'artim', 'artım', 'increase'])) || 0,
            type: txParseType(mgPickCol(row, ['type', 'tip', 'category'])),
            unionPct: mgParseUnion(mgPickCol(row, ['hik', 'həmkar', 'hemkar', 'union'])),
            isHead: mgParseOffice(mgPickCol(row, ['is yeri', 'iş yeri', 'yerlesme', 'yerləşmə', 'office', 'location'])),
        }));
        txBulkRecalc();
    };
    reader.readAsArrayBuffer(file);
}
function txBulkRecalc() {
    const body = document.getElementById('tx-bulk-body');
    if (!body) return;
    if (txBulkInput.length === 0) {
        document.getElementById('tx-bulk-results').style.display = 'none';
        return;
    }
    const fbType = document.getElementById('tx-type').value;
    const fbIsHead = document.getElementById('tx-office').value === 'head';
    const fbUnion = parseFloat(document.getElementById('union').value);
    body.innerHTML = '';
    txBulkData = [];
    txBulkInput.forEach(item => {
        const type = item.type || fbType;
        const unionPct = item.unionPct !== null ? item.unionPct : fbUnion;
        const isHead = item.isHead !== null ? item.isHead : fbIsHead;
        const r = txComputeOne(item.curGross, item.curMeal, item.incNet, isHead, type, unionPct);
        const grossDelta = r.newGross - item.curGross;
        const curMealInt = Math.round(item.curMeal);
        const typeLabel = type === 'expat' ? 'Expat' : 'Local';
        const officeLabel = isHead ? 'Baş ofis' : 'Filial';
        body.innerHTML += `<tr>
            <td>${item.badge}</td>
            <td>${typeLabel}</td>
            <td>${unionPct}%</td>
            <td>${officeLabel}</td>
            <td>${item.curGross.toFixed(2)}</td>
            <td>${curMealInt}</td>
            <td>${item.incNet.toFixed(2)}</td>
            <td><b style="color:#16a34a;">${r.newGross.toFixed(2)}</b></td>
            <td><b style="color:#2563eb;">${r.newMeal}</b></td>
            <td>${grossDelta.toFixed(2)}</td>
            <td style="font-size:0.68rem; color:#64748b;">${r.status}</td>
        </tr>`;
        txBulkData.push({
            'Employee Badge': item.badge,
            'Type': typeLabel,
            'HİK': unionPct,
            'İş Yeri': officeLabel,
            'Cari Gross': item.curGross.toFixed(2),
            'Cari Yemek Pulu': curMealInt,
            'Net Artim': item.incNet.toFixed(2),
            'Yeni Gross': r.newGross.toFixed(2),
            'Yeni Yemek Pulu': r.newMeal,
            'Gross Delta': grossDelta.toFixed(2),
            'Status': r.status,
        });
    });
    document.getElementById('tx-bk-count').innerText = txBulkInput.length;
    document.getElementById('tx-bulk-results').style.display = 'block';
}
function txExportResults() {
    if (txBulkData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(txBulkData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Texnopar");
    XLSX.writeFile(wb, "BirCalc_Texnopar.xlsx");
}
function txDownloadTemplate() {
    const sample = [
        { 'Employee Badge': 'B2001', 'Type': 'Local', 'HİK': 1, 'İş Yeri': 'Filial',   'Cari Gross': 2000, 'Cari Yemek Pulu': 50,  'Net Artim': 80  },
        { 'Employee Badge': 'B2002', 'Type': 'Expat', 'HİK': 0, 'İş Yeri': 'Baş ofis', 'Cari Gross': 3000, 'Cari Yemek Pulu': 100, 'Net Artim': 200 },
        { 'Employee Badge': 'B2003', 'Type': 'Local', 'HİK': 1, 'İş Yeri': 'Filial',   'Cari Gross': 1500, 'Cari Yemek Pulu': 80,  'Net Artim': 50  },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Şablon");
    XLSX.writeFile(wb, "BirCalc_Texnopar_Template.xlsx");
}
function mgDownloadTemplate() {
    const sample = [
        { 'Employee Badge': 'B1001', 'İl': 2026, 'İş Növü': 'Əsas',  'HİK': 1, 'İş Yeri': 'Filial',   'Cari Gross': 1000, 'Cari Yemek Pulu': 50,  'Net Artim': 80  },
        { 'Employee Badge': 'B1002', 'İl': 2026, 'İş Növü': 'Əsas',  'HİK': 1, 'İş Yeri': 'Baş ofis', 'Cari Gross': 1500, 'Cari Yemek Pulu': 100, 'Net Artim': 120 },
        { 'Employee Badge': 'B1003', 'İl': 2026, 'İş Növü': 'Əlavə', 'HİK': 0, 'İş Yeri': 'Filial',   'Cari Gross': 800,  'Cari Yemek Pulu': 0,   'Net Artim': 60  },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Şablon");
    XLSX.writeFile(wb, "BirCalc_MassGrowth_Template.xlsx");
}
