            const container = document.getElementById('adminCalendar');
            if (!container) return;

            let events = {};
            try {
                const raw = container.getAttribute('data-events');
                if (raw) events = JSON.parse(raw);
            } catch (e) { events = {}; }

            const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
            const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

            const now = new Date();
            let dM = now.getMonth();
            let dY = now.getFullYear();

            function render() {
                const title = document.getElementById('calMonthYear');
                if (title) title.innerText = monthNames[dM] + ' ' + dY;

                container.innerHTML = '';
                container.style.opacity = '0';
                container.style.transition = 'opacity 0.2s';

                dayNames.forEach(d => {
                    const el = document.createElement('div');
                    el.className = 'cal-day-name';
                    el.innerText = d;
                    container.appendChild(el);
                });

                const first = new Date(dY, dM, 1).getDay();
                const days = new Date(dY, dM + 1, 0).getDate();
                let start = first === 0 ? 6 : first - 1;
                const prevDays = new Date(dY, dM, 0).getDate();

                for (let i = start - 1; i >= 0; i--) {
                    const el = document.createElement('div');
                    el.className = 'cal-day ghost';
                    el.innerText = prevDays - i;
                    container.appendChild(el);
                }

                for (let i = 1; i <= days; i++) {
                    const el = document.createElement('div');
                    el.className = 'cal-day';
                    el.innerText = i;

                    const isToday = (i === now.getDate() && dM === now.getMonth() && dY === now.getFullYear());
                    const dateStr = `${dY}-${String(dM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

                    if (events && events[dateStr]) {
                        el.classList.add('event');
                        if (isToday) el.classList.add('today');

                        // Dot
                        const dot = document.createElement('div');
                        dot.style.cssText = 'width:4px;height:4px;background:rgba(255,255,255,0.7);border-radius:50%;position:absolute;bottom:2px;left:50%;transform:translateX(-50%);';
                        el.appendChild(dot);

                        // Tooltip
                        const tt = document.createElement('div');
                        tt.className = 'cal-tooltip';
                        const tasks = Array.isArray(events[dateStr]) ? events[dateStr] : [events[dateStr]];
                        tt.innerHTML = `<div class="tt-head"><i class="fas fa-calendar-check"></i> ${i} ${monthNames[dM]}</div>` +
                            tasks.map(t => `<div class="tt-item">${t}</div>`).join('');
                        el.appendChild(tt);
                    } else if (isToday) {
                        el.classList.add('today');
                    } else {
                        const d = new Date(dY, dM, i);
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        if (d < todayStart) el.classList.add('past');
                    }

                    container.appendChild(el);
                }

                const total = start + days;
                const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
                for (let i = 1; i <= rem; i++) {
                    const el = document.createElement('div');
                    el.className = 'cal-day ghost';
                    el.innerText = i;
                    container.appendChild(el);
                }

                setTimeout(() => { container.style.opacity = '1'; }, 50);
                renderUpcoming();
            }

            function renderUpcoming() {
                const list = document.getElementById('upcomingList');
                if (!list) return;
                list.innerHTML = '';

                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const upcoming = [];

                if (events) {
                    Object.keys(events).sort().forEach(date => {
                        if (date >= todayStr) {
                            const tasks = Array.isArray(events[date]) ? events[date] : [events[date]];
                            tasks.forEach(task => upcoming.push({ date, task }));
                        }
                    });
                }

                if (upcoming.length === 0) {
                    list.innerHTML = '<div style="text-align:center; padding:14px; color:#94a3b8; font-size:11px;"><i class="fas fa-check-circle" style="display:block; font-size:20px; margin-bottom:6px; opacity:0.3;"></i>Yaklaşan görev yok</div>';
                    return;
                }

                upcoming.slice(0, 4).forEach((item, idx) => {
                    const p = item.date.split('-');
                    const day = parseInt(p[2]), month = parseInt(p[1]) - 1;
                    const diff = Math.ceil((new Date(parseInt(p[0]), month, day) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);

                    let c = '#059669', bg = '#ecfdf5', bd = '#a7f3d0', label = diff + ' gün';
                    if (diff === 0) { c = '#E31E24'; bg = '#fef2f2'; bd = '#fecaca'; label = 'Bugün!'; }
                    else if (diff === 1) { c = '#ea580c'; bg = '#fff7ed'; bd = '#fed7aa'; label = 'Yarın'; }
                    else if (diff <= 3) { c = '#d97706'; bg = '#fefce8'; bd = '#fde68a'; }

                    const el = document.createElement('div');
                    el.className = 'upcoming-item';
                    el.style.cssText = `background:${bg}; border:1px solid ${bd}; animation: slideUp 0.3s ease ${idx * 0.05}s both;`;
                    el.innerHTML = `
                        <div style="min-width:34px; text-align:center;">
                            <div style="font-size:16px; font-weight:800; color:${c}; line-height:1;">${day}</div>
                            <div style="font-size:8px; color:${c}; opacity:0.7; font-weight:600;">${monthNames[month].substring(0, 3)}</div>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:11px; font-weight:600; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.task}</div>
                        </div>
                        <div style="font-size:9px; font-weight:700; color:${c}; background:white; padding:2px 7px; border-radius:5px; white-space:nowrap;">${label}</div>
                    `;
                    list.appendChild(el);
                });
            }

            window.changeMonth = function (d) {
                dM += d;
                if (dM > 11) { dM = 0; dY++; }
                if (dM < 0) { dM = 11; dY--; }
                render();
            };

            window.goToToday = function () {
                dM = now.getMonth();
                dY = now.getFullYear();
                render();
            };

            render();
        })();
    </script>
