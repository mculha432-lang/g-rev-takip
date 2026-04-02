                function downloadTaskReport() {
                    const taskId = document.getElementById('taskSelect').value;
                    if (!taskId) {
                        alert('Lütfen bir görev seçin!');
                        return;
                    }
                    window.location.href = '/admin/reports/task-detail/' + taskId + '/excel';
                }

                // === Giriş-Çıkış Raporu ===
                function downloadLoginReport() {
                    const startDate = document.getElementById('loginStartDate').value;
                    const endDate = document.getElementById('loginEndDate').value;
                    let url = '/admin/reports/login-activity/excel';
                    const params = [];
                    if (startDate) params.push('start_date=' + startDate);
                    if (endDate) params.push('end_date=' + endDate);
                    if (params.length > 0) url += '?' + params.join('&');
                    window.location.href = url;
                }

                // === Takvim Mantığı ===
                (function () {
                    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                    const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

                    const now = new Date();
                    let dispMonth = now.getMonth();
                    let dispYear = now.getFullYear();
                    let selectMode = 'start'; // 'start' veya 'end'
                    let startDate = null;
                    let endDate = null;

                    function pad(n) { return n < 10 ? '0' + n : '' + n; }

                    function formatDate(y, m, d) {
                        return y + '-' + pad(m + 1) + '-' + pad(d);
                    }

                    function formatDisplay(y, m, d) {
                        return d + ' ' + monthNames[m] + ' ' + y;
                    }

                    function updateDateBoxes() {
                        const startBox = document.getElementById('startDateBox');
                        const endBox = document.getElementById('endDateBox');
                        const startDisp = document.getElementById('startDateDisplay');
                        const endDisp = document.getElementById('endDateDisplay');
                        const startInput = document.getElementById('loginStartDate');
                        const endInput = document.getElementById('loginEndDate');

                        startBox.classList.toggle('active', selectMode === 'start');
                        endBox.classList.toggle('active', selectMode === 'end');

                        if (startDate) {
                            startDisp.className = 'date-box-value';
                            startDisp.innerText = formatDisplay(startDate.y, startDate.m, startDate.d);
                            startInput.value = formatDate(startDate.y, startDate.m, startDate.d);
                        } else {
                            startDisp.className = 'date-box-placeholder';
                            startDisp.innerText = 'Tarih seçin →';
                            startInput.value = '';
                        }

                        if (endDate) {
                            endDisp.className = 'date-box-value';
                            endDisp.innerText = formatDisplay(endDate.y, endDate.m, endDate.d);
                            endInput.value = formatDate(endDate.y, endDate.m, endDate.d);
                        } else {
                            endDisp.className = 'date-box-placeholder';
                            endDisp.innerText = 'Tarih seçin →';
                            endInput.value = '';
                        }
                    }

                    function renderCalendar() {
                        const grid = document.getElementById('lcCalendarGrid');
                        const title = document.getElementById('lcMonthYear');
                        if (!grid) return;

                        title.innerText = monthNames[dispMonth] + ' ' + dispYear;
                        grid.innerHTML = '';

                        // Gün başlıkları
                        dayNames.forEach(function (d) {
                            var el = document.createElement('div');
                            el.className = 'lc-day-name';
                            el.innerText = d;
                            grid.appendChild(el);
                        });

                        var firstDay = new Date(dispYear, dispMonth, 1).getDay();
                        var daysInMonth = new Date(dispYear, dispMonth + 1, 0).getDate();
                        var startSlot = firstDay === 0 ? 6 : firstDay - 1;

                        // Önceki ay
                        var prevDays = new Date(dispYear, dispMonth, 0).getDate();
                        for (var i = startSlot - 1; i >= 0; i--) {
                            var el = document.createElement('div');
                            el.className = 'lc-day lc-ghost';
                            el.innerText = prevDays - i;
                            grid.appendChild(el);
                        }

                        // Mevcut ay
                        for (var i = 1; i <= daysInMonth; i++) {
                            var el = document.createElement('div');
                            el.className = 'lc-day';
                            el.innerText = i;

                            var isToday = (i === now.getDate() && dispMonth === now.getMonth() && dispYear === now.getFullYear());
                            if (isToday) el.classList.add('lc-today');

                            var dateVal = formatDate(dispYear, dispMonth, i);

                            // Seçim vurgusu
                            if (startDate && formatDate(startDate.y, startDate.m, startDate.d) === dateVal) {
                                el.classList.add('lc-selected', 'lc-range-start');
                            }
                            if (endDate && formatDate(endDate.y, endDate.m, endDate.d) === dateVal) {
                                el.classList.add('lc-selected', 'lc-range-end');
                            }
                            if (startDate && endDate) {
                                var sStr = formatDate(startDate.y, startDate.m, startDate.d);
                                var eStr = formatDate(endDate.y, endDate.m, endDate.d);
                                if (dateVal > sStr && dateVal < eStr) {
                                    el.classList.add('lc-in-range');
                                }
                            }

                            // Tıklama
                            (function (day) {
                                el.addEventListener('click', function () {
                                    var clicked = { y: dispYear, m: dispMonth, d: day };
                                    if (selectMode === 'start') {
                                        startDate = clicked;
                                        if (endDate && formatDate(endDate.y, endDate.m, endDate.d) < formatDate(clicked.y, clicked.m, clicked.d)) {
                                            endDate = null;
                                        }
                                        selectMode = 'end';
                                    } else {
                                        var clickedStr = formatDate(clicked.y, clicked.m, clicked.d);
                                        var startStr = startDate ? formatDate(startDate.y, startDate.m, startDate.d) : '';
                                        if (startDate && clickedStr < startStr) {
                                            startDate = clicked;
                                            endDate = null;
                                        } else {
                                            endDate = clicked;
                                            selectMode = 'start';
                                        }
                                    }
                                    updateDateBoxes();
                                    renderCalendar();
                                });
                            })(i);

                            grid.appendChild(el);
                        }

                        // Sonraki ay
                        var totalCells = startSlot + daysInMonth;
                        var remain = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
                        for (var i = 1; i <= remain; i++) {
                            var el = document.createElement('div');
                            el.className = 'lc-day lc-ghost';
                            el.innerText = i;
                            grid.appendChild(el);
                        }
                    }

                    window.lcChangeMonth = function (d) {
                        dispMonth += d;
                        if (dispMonth > 11) { dispMonth = 0; dispYear++; }
                        if (dispMonth < 0) { dispMonth = 11; dispYear--; }
                        renderCalendar();
                    };

                    window.lcGoToday = function () {
                        dispMonth = now.getMonth();
                        dispYear = now.getFullYear();
                        renderCalendar();
                    };

                    window.setActiveDate = function (mode) {
                        selectMode = mode;
                        updateDateBoxes();
                    };

                    window.setQuickRange = function (type) {
                        var today = new Date();
                        var y = today.getFullYear(), m = today.getMonth(), d = today.getDate();

                        // Remove active from all
                        document.querySelectorAll('.lc-quick-btn').forEach(function (b) { b.classList.remove('active'); });

                        if (type === 'today') {
                            startDate = { y: y, m: m, d: d };
                            endDate = { y: y, m: m, d: d };
                        } else if (type === 'week') {
                            var day = today.getDay();
                            var diff = day === 0 ? 6 : day - 1;
                            var monday = new Date(today);
                            monday.setDate(d - diff);
                            var sunday = new Date(monday);
                            sunday.setDate(monday.getDate() + 6);
                            startDate = { y: monday.getFullYear(), m: monday.getMonth(), d: monday.getDate() };
                            endDate = { y: sunday.getFullYear(), m: sunday.getMonth(), d: sunday.getDate() };
                        } else if (type === 'month') {
                            startDate = { y: y, m: m, d: 1 };
                            var lastDay = new Date(y, m + 1, 0).getDate();
                            endDate = { y: y, m: m, d: lastDay };
                        } else if (type === 'last30') {
                            var past = new Date(today);
                            past.setDate(d - 30);
                            startDate = { y: past.getFullYear(), m: past.getMonth(), d: past.getDate() };
                            endDate = { y: y, m: m, d: d };
                        } else if (type === 'clear') {
                            startDate = null;
                            endDate = null;
                        }

                        if (type !== 'clear') {
                            event.target.classList.add('active');
                        }

                        selectMode = 'start';
                        updateDateBoxes();

                        // Takvimi start date'in ayına götür
                        if (startDate) {
                            dispMonth = startDate.m;
                            dispYear = startDate.y;
                        }
                        renderCalendar();
                    };

                    updateDateBoxes();
                    renderCalendar();
                })();
            </script>