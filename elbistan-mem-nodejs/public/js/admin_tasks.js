            (function () {
                'use strict';

                let currentStep = 1;

                /* ── View switch ── */
                window.switchView = (mode) => {
                    document.getElementById('dashboardView').style.display = mode === 'wizard' ? 'none' : 'block';
                    document.getElementById('wizardView').style.display = mode === 'wizard' ? 'block' : 'none';
                    if (mode !== 'wizard') gotoStep(1);
                };

                /* ── Step navigation ── */
                const gotoStep = (n) => {
                    currentStep = n;
                    document.querySelectorAll('.step-pane').forEach((p, i) => p.classList.toggle('active', i + 1 === n));
                    document.querySelectorAll('.step-item').forEach((it, i) => {
                        it.classList.toggle('active', i + 1 === n);
                        it.classList.toggle('completed', i + 1 < n);
                    });
                    document.getElementById('btnPrev').style.visibility = n === 1 ? 'hidden' : 'visible';
                    document.getElementById('btnNext').style.display = n === 4 ? 'none' : 'inline-flex';
                    document.getElementById('btnSubmit').style.display = n === 4 ? 'inline-flex' : 'none';
                    document.getElementById('wizardView').scrollIntoView({ behavior: 'smooth' });
                };

                document.querySelectorAll('.step-item').forEach(item => {
                    item.addEventListener('click', () => { const s = parseInt(item.dataset.step); if (s) gotoStep(s); });
                });

                document.getElementById('btnNext').onclick = () => { if (currentStep < 4) gotoStep(currentStep + 1); };
                document.getElementById('btnPrev').onclick = () => { if (currentStep > 1) gotoStep(currentStep - 1); };
                document.getElementById('btnSubmit').onclick = () => {
                    if (!document.getElementById('mainTitle').value) { alert('Lütfen görev başlığını giriniz.'); gotoStep(1); return; }
                    if (!document.getElementById('deadlinePicker').value) { alert('Lütfen son teslim tarihini belirleyiniz.'); gotoStep(1); return; }
                    if (!document.querySelectorAll('input[name="school_ids"]:checked').length) { alert('Lütfen en az bir okul seçiniz.'); gotoStep(4); return; }
                    document.getElementById('taskForm').submit();
                };

                /* ── CKEditor ── */
                ClassicEditor.create(document.querySelector('#editor'), {
                    language: 'tr',
                    toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote', 'insertTable', 'undo', 'redo']
                }).catch(err => console.error(err));

                /* ── Flatpickr ── */
                flatpickr('#deadlinePicker', { enableTime: true, dateFormat: 'Y-m-d H:i', locale: 'tr', minDate: 'today', time_24hr: true });

                // File zone logic removed because it is handled by inline script in EJS for multiple files support.


                document.getElementById('requiresFileToggle').addEventListener('change', function () {
                    document.getElementById('mandatoryRow').style.opacity = this.checked ? '1' : '0.4';
                    document.getElementById('mandatoryRow').style.pointerEvents = this.checked ? 'auto' : 'none';
                    document.getElementById('fileCountRow').style.display = this.checked ? 'flex' : 'none';
                    if (!this.checked) document.getElementById('fileMandatoryToggle').checked = false;
                });

                window.changeFileCount = (delta) => {
                    const inp = document.getElementById('maxFileCountInput');
                    const disp = document.getElementById('fileCountDisplay');
                    let val = Math.min(20, Math.max(1, parseInt(inp.value) + delta));
                    inp.value = disp.textContent = val;
                };

                /* ── Field types ── */
                const FIELD_TYPES = {
                    text: { label: 'Kısa Yanıt', hasOptions: false },
                    textarea: { label: 'Paragraf', hasOptions: false },
                    number: { label: 'Sayı', hasOptions: false },
                    radio: { label: 'Çoktan Seçmeli', hasOptions: true },
                    checkbox: { label: 'Onay Kutuları', hasOptions: true },
                    select: { label: 'Açılır Menü', hasOptions: true },
                    date: { label: 'Tarih', hasOptions: false },
                    time: { label: 'Saat', hasOptions: false },
                    scale: { label: 'Doğrusal Ölçek', hasOptions: false }
                };

                const buildTypeOptions = (sel) =>
                    Object.entries(FIELD_TYPES).map(([v, i]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${i.label}</option>`).join('');

                const buildPreview = (type) => {
                    const map = { text: 'fa-minus Kısa metin yanıtı', textarea: 'fa-align-left Uzun metin yanıtı (paragraf)', number: 'fa-hashtag Sayısal değer girişi', date: 'fa-calendar-alt Tarih seçici alanı', time: 'fa-clock Saat seçici alanı' };
                    if (type === 'scale') return `<div class="gf-scale-preview">${[1, 2, 3, 4, 5].map(n => `<div class="gf-scale-dot">${n}</div>`).join('')}</div>`;
                    if (map[type]) { const [icon, label] = map[type].split(' '); return `<div class="gf-preview"><i class="fas ${icon}"></i> ${map[type].slice(icon.length + 1)}</div>`; }
                    return '';
                };

                const buildOptionsEditor = (type, opts = ['Seçenek 1']) => {
                    const iconClass = type === 'checkbox' ? 'gf-option-icon checkbox-icon' : 'gf-option-icon';
                    const rows = opts.map((opt, i) => `
      <div class="gf-option-row">
        <div class="${iconClass}"></div>
        <input type="text" class="gf-option-input" value="${opt}" placeholder="Seçenek ${i + 1}" oninput="window.syncOptionsToHidden(this.closest('.gf-question-card'))">
        <button type="button" class="gf-option-remove" onclick="removeOption(this)"><i class="fas fa-times"></i></button>
      </div>`).join('');
                    return `<div class="gf-options-editor" data-type="${type}">${rows}
      <button type="button" class="gf-add-option-btn" onclick="addOption(this)"><i class="fas fa-plus"></i> Seçenek Ekle</button>
    </div>`;
                };

                const updateNumbers = () =>
                    document.querySelectorAll('#dynamicFields .gf-question-card .gf-q-number').forEach((el, i) => { el.textContent = i + 1; });

                window.syncOptionsToHidden = (card) => {
                    const h = card.querySelector('.field-options-hidden');
                    if (!h) return;
                    h.value = Array.from(card.querySelectorAll('.gf-option-input')).map(i => i.value).filter(v => v.trim()).join(',');
                };

                window.updateCardPreview = (card) => {
                    const type = card.querySelector('.gf-type-select').value;
                    const body = card.querySelector('.gf-card-body');
                    const h = card.querySelector('.field-options-hidden');
                    if (FIELD_TYPES[type]?.hasOptions) { body.innerHTML = buildOptionsEditor(type); if (h) h.value = 'Seçenek 1'; }
                    else { body.innerHTML = buildPreview(type); if (h) h.value = ''; }
                };

                window.addField = () => {
                    document.getElementById('emptyState')?.style && (document.getElementById('emptyState').style.display = 'none');
                    const list = document.getElementById('dynamicFields');
                    const count = list.querySelectorAll('.gf-question-card').length + 1;
                    const card = document.createElement('div');
                    card.className = 'gf-question-card active-q';
                    card.innerHTML = `
      <div class="gf-card-header"><div class="gf-card-toprow">
        <span class="gf-drag-handle"><i class="fas fa-grip-vertical"></i></span>
        <div class="gf-q-number">${count}</div>
        <input type="hidden" name="field_ids" value="">
        <input type="hidden" name="field_options" class="field-options-hidden" value="">
        <input type="text" name="field_labels" class="gf-question-input" placeholder="Soru başlığını yazın..." required>
        <select name="field_types" class="gf-type-select" onchange="window.updateCardPreview(this.closest('.gf-question-card'))">
          ${buildTypeOptions('text')}
        </select>
      </div></div>
      <div class="gf-card-body">${buildPreview('text')}</div>
      <div class="gf-card-actions">
        <div class="gf-actions-left">
          <span class="gf-required-label">Zorunlu</span>
          <label class="gf-switch" style="transform:scale(.85);">
            <input type="checkbox" name="field_required" value="${count - 1}"><span class="gf-slider"></span>
          </label>
        </div>
        <div class="gf-actions-right">
          <button type="button" class="gf-action-btn" onclick="duplicateField(this)"><i class="fas fa-copy"></i></button>
          <div class="gf-divider"></div>
          <button type="button" class="gf-action-btn delete" onclick="removeField(this)"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
                    list.appendChild(card);
                    card.querySelector('.gf-question-input').focus();
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                };

                window.removeField = (btn) => {
                    btn.closest('.gf-question-card').remove();
                    updateNumbers();
                    const empty = document.getElementById('emptyState');
                    if (empty && !document.querySelectorAll('#dynamicFields .gf-question-card').length) empty.style.display = 'block';
                };

                window.duplicateField = (btn) => {
                    const card = btn.closest('.gf-question-card');
                    const clone = card.cloneNode(true);
                    clone.querySelector('input[name="field_ids"]').value = '';
                    card.after(clone);
                    updateNumbers();
                    clone.scrollIntoView({ behavior: 'smooth', block: 'center' });
                };

                window.addOption = (btn) => {
                    const editor = btn.closest('.gf-options-editor');
                    const card = btn.closest('.gf-question-card');
                    const type = editor.dataset.type;
                    const count = editor.querySelectorAll('.gf-option-row').length + 1;
                    const iconClass = type === 'checkbox' ? 'gf-option-icon checkbox-icon' : 'gf-option-icon';
                    const row = document.createElement('div');
                    row.className = 'gf-option-row';
                    row.innerHTML = `<div class="${iconClass}"></div>
      <input type="text" class="gf-option-input" placeholder="Seçenek ${count}" oninput="window.syncOptionsToHidden(this.closest('.gf-question-card'))">
      <button type="button" class="gf-option-remove" onclick="removeOption(this)"><i class="fas fa-times"></i></button>`;
                    btn.before(row);
                    row.querySelector('.gf-option-input').focus();
                    window.syncOptionsToHidden(card);
                };

                window.removeOption = (btn) => {
                    const editor = btn.closest('.gf-options-editor');
                    if (editor.querySelectorAll('.gf-option-row').length > 1) {
                        btn.closest('.gf-option-row').remove();
                        window.syncOptionsToHidden(btn.closest('.gf-question-card'));
                    }
                };

                /* ══════════════════════════════════════════
                   OKUL SEÇİCİ — GELİŞTİRİLMİŞ
                ══════════════════════════════════════════ */

                // Aktif özellik filtreleri (kantin / pansiyon)
                const activeFeatureFilters = new Set();

                /**
                 * Seçili okulları listenin en üstüne taşır.
                 * Kısa bir smooth animasyon efekti için seçili öğelere geçici class eklenir.
                 */
                const reorderSchools = () => {
                    const list = document.getElementById('schoolList');
                    const items = Array.from(list.querySelectorAll('.school-item'));
                    const selected = items.filter(i => i.querySelector('input').checked);
                    const unselected = items.filter(i => !i.querySelector('input').checked);
                    [...selected, ...unselected].forEach(item => list.appendChild(item));
                };

                /**
                 * Tüm görünürlük filtrelerini (arama metni + tip + özellik) birleştirerek uygular.
                 */
                const applyVisibility = () => {
                    const term = document.getElementById('schoolSearch').value.toLowerCase();
                    document.querySelectorAll('.school-item').forEach(item => {
                        const nameMatch = item.dataset.name.includes(term);
                        const canteenOk = !activeFeatureFilters.has('canteen') || item.dataset.canteen === '1';
                        const pensionOk = !activeFeatureFilters.has('pension') || item.dataset.pension === '1';
                        item.style.display = (nameMatch && canteenOk && pensionOk) ? 'flex' : 'none';
                    });
                };

                // Arama kutusu
                document.getElementById('schoolSearch').oninput = applyVisibility;

                // Seçili okul sayacını güncelle
                const updateSchoolCount = () => {
                    document.getElementById('selectedSchoolCount').textContent =
                        document.querySelectorAll('input[name="school_ids"]:checked').length;
                };

                // Tümünü seç / temizle
                window.toggleAllSchools = (status) => {
                    document.querySelectorAll('.school-item').forEach(item => {
                        if (item.style.display !== 'none') {
                            item.querySelector('input').checked = status;
                            item.classList.toggle('selected', status);
                        }
                    });
                    // Tip butonlarını sıfırla
                    document.querySelectorAll('.type-btn').forEach(btn => {
                        btn.classList.remove('active');
                        btn.style.background = '#fff';
                    });
                    updateSchoolCount();
                    reorderSchools();
                };

                // Okul türü filtresi (filtreler + toplu seçer)
                window.toggleTypeSelection = (type, btn) => {
                    const isActive = btn.classList.contains('active');
                    btn.classList.toggle('active', !isActive);
                    btn.style.background = isActive ? '#fff' : btn.style.color;
                    document.querySelectorAll(`.school-item[data-type="${type}"]`).forEach(item => {
                        item.querySelector('input').checked = !isActive;
                        item.classList.toggle('selected', !isActive);
                    });
                    updateSchoolCount();
                    reorderSchools();
                };

                /**
                 * Kantin / Pansiyon özellik filtresi.
                 * Sadece listeyi daraltır — toplu seçim YAPMAZ.
                 */
                window.toggleFeatureFilter = (feature, btn) => {
                    const isActive = activeFeatureFilters.has(feature);
                    if (isActive) {
                        activeFeatureFilters.delete(feature);
                        btn.classList.remove('active');
                        btn.style.background = '#fff';
                    } else {
                        activeFeatureFilters.add(feature);
                        btn.classList.add('active');
                        btn.style.background = btn.style.color;
                    }
                    applyVisibility();
                };

                // Tekil checkbox değişikliği
                document.getElementById('schoolList').addEventListener('change', (e) => {
                    if (e.target.tagName === 'INPUT') {
                        e.target.closest('.school-item').classList.toggle('selected', e.target.checked);
                        updateSchoolCount();
                        reorderSchools();
                    }
                });

                /* ── Task search/filter ── */
                window.searchTasks = (term) => {
                    const lower = term.toLowerCase();
                    document.querySelectorAll('.task-card').forEach(card => {
                        card.style.display = (card.dataset.title.includes(lower) || card.dataset.deadline.includes(lower)) ? '' : 'none';
                    });
                };

                window.filterTasks = (type) => {
                    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active-filter'));
                    const el = document.getElementById('filter' + type.charAt(0).toUpperCase() + type.slice(1));
                    if (el) el.classList.add('active-filter');
                    document.querySelectorAll('.task-card').forEach(card => {
                        const expired = card.dataset.expired === '1';
                        card.style.display = type === 'all' ? '' : (type === 'active' ? (expired ? 'none' : '') : (expired ? '' : 'none'));
                    });
                };

            })();