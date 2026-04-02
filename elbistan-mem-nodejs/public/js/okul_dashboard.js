        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('headerDate').innerText = new Date().toLocaleDateString('tr-TR', dateOptions);

        // Calendar Logic
        (function () {
            const container = document.getElementById('schoolCalendar');
            if (!container) return;

            let events = {};
            try {
                const rawEvents = container.getAttribute('data-events');
                if (rawEvents) {
                    events = JSON.parse(rawEvents);
                }
            } catch (e) {
                console.error("Takvim verisi işlenemedi", e);
            }

            const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
            const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

            const now = new Date();
            let displayMonth = now.getMonth();
            let displayYear = now.getFullYear();

            // Tooltip element
            let tooltip = document.querySelector('.cal-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.className = 'cal-tooltip';
                document.body.appendChild(tooltip);
            }

            function renderCalendar() {
                const title = document.getElementById('calMonthYear');
                if (title) {
                    title.innerText = monthNames[displayMonth] + " " + displayYear;
                }

                container.innerHTML = '';
                container.style.transition = 'opacity 0.2s ease';
                container.style.opacity = '0';

                // Gün başlıkları
                dayNames.forEach(function (day) {
                    const div = document.createElement('div');
                    div.className = 'cal-day-name';
                    div.innerText = day;
                    container.appendChild(div);
                });

                const firstDay = new Date(displayYear, displayMonth, 1).getDay();
                const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
                let startSlot = firstDay === 0 ? 6 : firstDay - 1;

                // Önceki ayın günleri (soluk)
                const prevMonthDays = new Date(displayYear, displayMonth, 0).getDate();
                for (let i = startSlot - 1; i >= 0; i--) {
                    const div = document.createElement('div');
                    div.className = 'cal-day';
                    div.style.color = '#d1d5db';
                    div.style.fontSize = '10px';
                    div.innerText = prevMonthDays - i;
                    container.appendChild(div);
                }

                // Günleri oluştur
                for (let i = 1; i <= daysInMonth; i++) {
                    const div = document.createElement('div');
                    div.className = 'cal-day';
                    div.innerText = i;
                    div.style.position = 'relative';

                    const isToday = (i === now.getDate() && displayMonth === now.getMonth() && displayYear === now.getFullYear());

                    if (isToday) {
                        div.classList.add('cal-today');
                    }

                    const checkDate = displayYear + "-" + String(displayMonth + 1).padStart(2, '0') + "-" + String(i).padStart(2, '0');

                    if (events && events[checkDate]) {
                        div.classList.add('has-event');
                        if (isToday) {
                            div.style.background = 'linear-gradient(135deg, #E31E24, #b91c1c)';
                            div.style.boxShadow = '0 2px 8px rgba(227, 30, 36, 0.4)';
                        }

                        // Küçük nokta göstergesi
                        const dot = document.createElement('div');
                        dot.style.cssText = 'width:4px;height:4px;background:white;border-radius:50%;position:absolute;bottom:3px;left:50%;transform:translateX(-50%);';
                        div.appendChild(dot);

                        div.dataset.tasks = events[checkDate].join("|||");
                        div.dataset.date = i + " " + monthNames[displayMonth];

                        div.addEventListener('mouseenter', function (e) {
                            const tasks = this.dataset.tasks.split("|||");
                            const dateStr = this.dataset.date;
                            tooltip.innerHTML = '<div class="tooltip-title"><i class="fas fa-calendar-check"></i> ' + dateStr + '</div><div class="tooltip-tasks">' + tasks.map(function (t) { return '• ' + t; }).join('<br>') + '</div>';
                            const rect = this.getBoundingClientRect();
                            tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
                            tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';
                            tooltip.classList.add('visible');
                        });

                        div.addEventListener('mouseleave', function () {
                            tooltip.classList.remove('visible');
                        });
                    } else if (!isToday) {
                        const checkD = new Date(displayYear, displayMonth, i);
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        if (checkD < todayStart) {
                            div.style.color = '#cbd5e1';
                        }
                    }

                    container.appendChild(div);
                }

                // Sonraki ayın günleri (soluk)
                const totalCells = startSlot + daysInMonth;
                const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
                for (let i = 1; i <= remaining; i++) {
                    const div = document.createElement('div');
                    div.className = 'cal-day';
                    div.style.color = '#d1d5db';
                    div.style.fontSize = '10px';
                    div.innerText = i;
                    container.appendChild(div);
                }

                setTimeout(function () { container.style.opacity = '1'; }, 50);

                // Yaklaşan görevleri güncelle
                renderUpcoming();
            }

            function renderUpcoming() {
                const listEl = document.getElementById('schoolUpcomingList');
                if (!listEl) return;
                listEl.innerHTML = '';

                const upcoming = [];
                const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

                if (events) {
                    Object.keys(events).sort().forEach(function (date) {
                        if (date >= todayStr) {
                            const tasks = Array.isArray(events[date]) ? events[date] : [events[date]];
                            tasks.forEach(function (task) {
                                upcoming.push({ date: date, task: task });
                            });
                        }
                    });
                }

                if (upcoming.length === 0) {
                    listEl.innerHTML = '<div style="text-align: center; padding: 12px; color: #94a3b8; font-size: 12px;"><i class="fas fa-check-circle" style="font-size: 18px; display: block; margin-bottom: 6px; opacity: 0.4;"></i>Yaklaşan görev yok</div>';
                    return;
                }

                upcoming.slice(0, 4).forEach(function (item, index) {
                    const parts = item.date.split('-');
                    const day = parseInt(parts[2]);
                    const month = parseInt(parts[1]) - 1;
                    const dateObj = new Date(parseInt(parts[0]), month, day);
                    const diffDays = Math.ceil((dateObj - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / (1000 * 60 * 60 * 24));

                    var uc = '#059669', ubg = '#ecfdf5', ub = '#a7f3d0', ul = diffDays + ' gün';
                    if (diffDays === 0) { uc = '#E31E24'; ubg = '#fef2f2'; ub = '#fecaca'; ul = 'Bugün!'; }
                    else if (diffDays === 1) { uc = '#ea580c'; ubg = '#fff7ed'; ub = '#fed7aa'; ul = 'Yarın'; }
                    else if (diffDays <= 3) { uc = '#d97706'; ubg = '#fefce8'; ub = '#fde68a'; }

                    var el = document.createElement('div');
                    el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;margin-bottom:5px;background:' + ubg + ';border:1px solid ' + ub + ';transition:all 0.2s;cursor:default;animation:slideIn 0.3s ease ' + (index * 0.05) + 's both;';
                    el.innerHTML = '<div style="min-width:36px;text-align:center;"><div style="font-size:16px;font-weight:800;color:' + uc + ';line-height:1;">' + day + '</div><div style="font-size:9px;color:' + uc + ';opacity:0.7;font-weight:600;">' + monthNames[month].substring(0, 3) + '</div></div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.task + '</div></div><div style="font-size:10px;font-weight:700;color:' + uc + ';background:white;padding:2px 8px;border-radius:6px;white-space:nowrap;">' + ul + '</div>';
                    listEl.appendChild(el);
                });

                if (!document.getElementById('calAnimStyle')) {
                    var style = document.createElement('style');
                    style.id = 'calAnimStyle';
                    style.textContent = '@keyframes slideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }';
                    document.head.appendChild(style);
                }
            }

            window.calChangeMonth = function (delta) {
                displayMonth += delta;
                if (displayMonth > 11) { displayMonth = 0; displayYear++; }
                if (displayMonth < 0) { displayMonth = 11; displayYear--; }
                renderCalendar();
            };

            window.calGoToday = function () {
                displayMonth = now.getMonth();
                displayYear = now.getFullYear();
                renderCalendar();
            };

            renderCalendar();
        })();
    </script>
