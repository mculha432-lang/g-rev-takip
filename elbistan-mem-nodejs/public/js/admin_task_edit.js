                'use strict';

                /* ── Step navigation ── */
                let currentStep = 1;

                const gotoStep = (n) => {
                    currentStep = n;
                    document.querySelectorAll('.step-pane').forEach((p, i) => p.classList.toggle('active', i + 1 === n));
                    document.querySelectorAll('.step-item').forEach((it, i) => it.classList.toggle('active', i + 1 === n));
                    document.getElementById('btnPrev').style.visibility = n === 1 ? 'hidden' : 'visible';
                    document.getElementById('btnNext').style.display = n === 4 ? 'none' : 'inline-flex';
                    document.getElementById('btnSubmit').style.display = n === 4 ? 'inline-flex' : 'none';
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };

                document.querySelectorAll('.step-item').forEach(item => {
                    item.addEventListener('click', () => { const s = parseInt(item.dataset.step); if (s) gotoStep(s); });
                });
                document.getElementById('btnNext').onclick = () => { if (currentStep < 4) gotoStep(currentStep + 1); };
                document.getElementById('btnPrev').onclick = () => { if (currentStep > 1) gotoStep(currentStep - 1); };
                document.getElementById('btnSubmit').onclick = () => document.getElementById('editForm').submit();

                /* ── CKEditor ── */
                ClassicEditor.create(document.querySelector('#editor'), {
                    language: 'tr',
                    toolbar: { items: ['heading', '|', 'bold', 'italic', 'link', '|', 'bulletedList', 'numberedList', 'blockQuote', '|', 'insertTable', 'undo', 'redo'], shouldNotGroupWhenFull: true }
                }).catch(err => console.error(err));

                /* ── Flatpickr ── */
                flatpickr('#deadlinePicker', { enableTime: true, dateFormat: 'Y-m-d H:i', locale: 'tr', time_24hr: true });

                /* ── File zone ── */
                document.getElementById('taskFileInput').addEventListener('change', function () {
                    const name = this.files[0]?.name || '';
                    document.getElementById('fileChosenName').textContent = name;
                    document.getElementById('fileChosen').style.display = name ? 'flex' : 'none';
                });

                document.getElementById('requiresFileToggle').addEventListener('change', function () {
                    document.getElementById('mandatoryRow').style.opacity = this.checked ? '1' : '0.4';
                    document.getElementById('mandatoryRow').style.pointerEvents = this.checked ? 'auto' : 'none';
                    document.getElementById('fileCountRow').style.display = this.checked ? 'flex' : 'none';
                    if (!this.checked) document.getElementById('fileMandatoryToggle').checked = false;
                });

                window.changeFileCount = (delta) => {
                    const inp = document.getElementById('maxFileCountInput');
                    const disp = document.getElementById('fileCountDisplay');
                    const val = Math.min(20, Math.max(1, parseInt(inp.value) + delta));
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
                    if (map[type]) { const parts = map[type].split(' '); return `<div class="gf-preview"><i class="fas ${parts[0]}"></i> ${parts.slice(1).join(' ')}</div>`; }
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

                /* Initialize existing cards with saved options */
                document.querySelectorAll('#dynamicFields .gf-question-card').forEach(card => {
                    const type = card.querySelector('.gf-type-select').value;
                    const body = card.querySelector('.gf-card-body');
                    const saved = card.dataset.savedOptions || '';
                    if (FIELD_TYPES[type]?.hasOptions) {
                        const opts = saved ? saved.split(',').map(o => o.trim()).filter(Boolean) : ['Seçenek 1'];
                        body.innerHTML = buildOptionsEditor(type, opts);
                    } else {
                        body.innerHTML = buildPreview(type);
                    }
                });

                window.addField = () => {
                    const empty = document.getElementById('emptyState');
                    if (empty) empty.style.display = 'none';
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
          <label class="gf-switch" style="transform:scale(.85);"><input type="checkbox" name="field_required" value="1"><span class="gf-slider"></span></label>
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

                /* ── Schools ── */
                const updateNewSchoolCount = () => {
                    const el = document.getElementById('newSchoolCount');
                    if (el) el.textContent = document.querySelectorAll('#schoolList input[name="school_ids"]:checked').length;
                };

                window.removeAssignedSchool = (id) => {
                    const chip = document.getElementById('assigned-' + id);
                    const input = document.getElementById('remove-input-' + id);
                    if (!chip || !input) return;
                    chip.style.opacity = '0.4'; chip.style.backgroundColor = '#fee2e2'; input.value = id;
                    chip.querySelector('button').innerHTML = '<i class="fas fa-undo"></i>';
                    chip.querySelector('button').onclick = () => window.undoRemove(id);
                };

                window.undoRemove = (id) => {
                    const chip = document.getElementById('assigned-' + id);
                    const input = document.getElementById('remove-input-' + id);
                    if (!chip || !input) return;
                    chip.style.opacity = '1'; chip.style.backgroundColor = '#fff'; input.value = '';
                    chip.querySelector('button').innerHTML = '<i class="fas fa-times"></i>';
                    chip.querySelector('button').onclick = () => window.removeAssignedSchool(id);
                };

                window.toggleAllNewSchools = (status) => {
                    document.querySelectorAll('#schoolList .school-item').forEach(item => {
                        if (item.style.display !== 'none') {
                            item.querySelector('input').checked = status;
                            item.classList.toggle('selected', status);
                        }
                    });
                    document.querySelectorAll('.type-btn').forEach(btn => { btn.classList.remove('active'); btn.style.background = '#fff'; });
                    updateNewSchoolCount();
                };

                window.toggleTypeSelection = (type, btn) => {
                    const isActive = btn.classList.contains('active');
                    btn.classList.toggle('active', !isActive);
                    btn.style.background = isActive ? '#fff' : btn.style.color;
                    document.querySelectorAll(`#schoolList .school-item[data-type="${type}"]`).forEach(item => {
                        item.querySelector('input').checked = !isActive;
                        item.classList.toggle('selected', !isActive);
                    });
                    updateNewSchoolCount();
                };

                document.getElementById('schoolSearch').oninput = (e) => {
                    const term = e.target.value.toLowerCase();
                    document.querySelectorAll('.school-item').forEach(item => {
                        item.style.display = item.dataset.name.includes(term) ? 'flex' : 'none';
                    });
                };

                document.getElementById('schoolList').addEventListener('change', (e) => {
                    if (e.target.tagName === 'INPUT') {
                        e.target.closest('.school-item').classList.toggle('selected', e.target.checked);
                        updateNewSchoolCount();
                    }
                });

// End of admin_task_edit.js