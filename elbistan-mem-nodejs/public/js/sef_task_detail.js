      'use strict';

      const messagesMap = JSON.parse(document.getElementById('messagesMapData').textContent || '{}');
      const assignmentsArr = JSON.parse(document.getElementById('assignmentsData').textContent || '[]');

      const responsesMap = {};
      assignmentsArr.forEach(a => {
        if (a.fieldResponses && a.fieldResponses.length) responsesMap[a.id] = a.fieldResponses;
      });

      const ME = String(window.ME || '');
      const TASK_ID = window.TASK_ID || '';
      const BASE = '/sef'; // Şef paneli için base path

      const $ = id => document.getElementById(id);
      const show = id => { const el = $(id); if (el) el.classList.add('active'); };
      const hide = id => { const el = $(id); if (el) el.classList.remove('active'); };

      /* ── Sıralama ── */
      const sortDir = { name: 1, status: 1 };
      const statusRank = row => {
        const s = row.dataset.status;
        const r = row.dataset.read === '1';
        if (s === 'rejected') return 1;
        if ((s === 'pending' || !s) && !r) return 2;
        if ((s === 'pending' || !s) && r) return 3;
        if (s === 'in_progress') return 4;
        if (s === 'pending_approval') return 5;
        if (s === 'completed') return 6;
        return 7;
      };

      function sortRows(type, header) {
        const tbody = $('tableBody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        document.querySelectorAll('th.sortable').forEach(th => th.classList.remove('active'));
        header.classList.add('active');
        sortDir[type] *= -1;
        const dir = sortDir[type];
        header.querySelector('.sort-icon').className =
          'fas sort-icon ' + (dir === 1 ? 'fa-sort-up' : 'fa-sort-down');
        rows.sort((a, b) =>
          type === 'name'
            ? a.dataset.name.toLocaleLowerCase('tr-TR')
              .localeCompare(b.dataset.name.toLocaleLowerCase('tr-TR'), 'tr-TR') * dir
            : (statusRank(a) - statusRank(b)) * dir
        ).forEach(r => tbody.appendChild(r));
      }

      /* ── Event delegation ── */
      document.addEventListener('click', e => {
        try {
          const el = e.target.closest('[data-close],[data-sort],button,a');
          if (!el) return;
          
          if (el.dataset.close) { 
            e.preventDefault();
            hide(el.dataset.close); 
            return; 
          }

          const { id, name } = el.dataset;
          
          if (el.classList.contains('js-open-reject')) { e.preventDefault(); openReject(id, name); return; }
          if (el.classList.contains('js-open-approve')) { e.preventDefault(); openApprove(id, name); return; }
          if (el.classList.contains('js-open-message')) { e.preventDefault(); openMessage(id, name); return; }
          if (el.classList.contains('js-open-answers')) { e.preventDefault(); openAnswers(id, name); return; }
          
          if (el.dataset.sort) { e.preventDefault(); sortRows(el.dataset.sort, el); return; }
        } catch (err) {
          console.error('Click error:', err);
        }
      });

      window.addEventListener('click', e => {
        if (e.target.classList.contains('tp-modal')) hide(e.target.id);
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          ['rejectModal', 'approveModal', 'messageModal', 'answersModal'].forEach(hide);
        }
      });

      /* ── Modal openers ── */
      function openReject(id, name) {
        $('rejectSchoolName').textContent = name;
        $('rejectForm').action = `${BASE}/tasks/${TASK_ID}/assignments/${id}/reject`;
        $('rejectForm').reset();
        show('rejectModal');
        setTimeout(() => {
          const ta = $('rejectForm').querySelector('textarea');
          if (ta) ta.focus();
        }, 120);
      }

      function openApprove(id, name) {
        $('approveSchoolName').textContent = name;
        $('approveForm').action = `${BASE}/tasks/${TASK_ID}/assignments/${id}/approve`;
        show('approveModal');
      }

      function openMessage(id, name) {
        $('msgSchoolName').textContent = name;
        $('messageForm').action = `${BASE}/tasks/assignments/${id}/message`;
        $('messageForm').reset();

        const list = $('msgList');
        list.innerHTML = '';
        const msgs = messagesMap[id] || [];

        if (!msgs.length) {
          list.innerHTML = `
                <div style="text-align:center;color:var(--text-4);padding:30px;font-size:13px;">
                    <i class="fas fa-inbox" style="font-size:32px;display:block;margin-bottom:10px;opacity:.5;"></i>
                    Henüz mesaj yok.
                </div>`;
        } else {
          msgs.forEach(m => {
            const isMe = String(m.sender_id) === ME;
            const wrap = document.createElement('div');
            wrap.style.cssText = [
              'max-width:80%', 'padding:9px 13px', 'border-radius:12px',
              'font-size:13px',
              `align-self:${isMe ? 'flex-end' : 'flex-start'}`,
              `background:${isMe ? 'var(--blue-muted)' : '#fff'}`,
              `color:${isMe ? '#1e3a8a' : 'var(--text-2)'}`,
              `border:${isMe ? 'none' : '1px solid var(--border)'}`
            ].join(';');

            const sender = document.createElement('div');
            sender.style.cssText = 'font-weight:700;font-size:10px;opacity:.7;margin-bottom:2px;';
            sender.textContent = isMe ? 'Siz' : m.full_name;

            const text = document.createElement('div');
            text.textContent = m.message;

            const time = document.createElement('div');
            time.style.cssText = 'font-size:10px;opacity:.5;text-align:right;margin-top:3px;';
            time.textContent = new Date(m.created_at).toLocaleTimeString('tr-TR', {
              hour: '2-digit', minute: '2-digit'
            });

            wrap.append(sender, text, time);
            list.appendChild(wrap);
          });
          setTimeout(() => list.scrollTop = list.scrollHeight, 50);
        }
        show('messageModal');
      }

      function openAnswers(id, name) {
        $('ansSchoolName').textContent = name;
        const list = $('ansList');
        list.innerHTML = '';
        const items = responsesMap[id] || [];

        if (!items.length) {
          list.innerHTML = `
                <div style="text-align:center;color:var(--text-4);padding:30px;font-size:13px;">
                    Form cevabı bulunamadı.
                </div>`;
        } else {
          items.forEach(r => {
            const card = document.createElement('div');
            card.style.cssText = 'background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px 14px;';

            const label = document.createElement('div');
            label.style.cssText = 'font-weight:700;font-size:12px;color:var(--text-1);margin-bottom:5px;';
            label.textContent = r.field_label;

            const val = document.createElement('div');
            val.style.cssText = 'font-size:13px;color:var(--text-2);';
            val.textContent = (r.response_value != null && r.response_value !== '') ? r.response_value : '—';

            card.append(label, val);
            list.appendChild(card);
          });
        }
        show('answersModal');
      }

      /* ── Default sort on load ── */
      document.addEventListener("DOMContentLoaded", () => {
      // ── Select All Logic ──
      const selectAllCb = document.getElementById("selectAllItems");
      if(selectAllCb) {
        selectAllCb.addEventListener("change", function() {
          const checkboxes = document.querySelectorAll(".bulk-cb");
          checkboxes.forEach(cb => {
            const row = cb.closest('tr');
            if(row && row.style.display !== 'none') {
              cb.checked = this.checked;
            }
          });
        });
      }

      // ── Modal Logic ──
      const statusTh = document.querySelector('th.sortable[data-sort="status"]');
        if (statusTh) { sortDir.status = -1; sortRows('status', statusTh); }
      });

// End of sef_task_detail.js
