document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const sidebar        = $('sidebar');
    const sidebarOverlay = $('sidebar-overlay');
    const sidebarToggle  = $('sidebar-toggle');
    const newChatBtn     = $('new-chat-btn');
    const favoritesBtn   = $('sidebar-favorites-btn');
    const calendarModeBtn = $('sidebar-calendar-btn');
    const sessionList    = $('session-list');
    const starredList    = $('starred-list');
    const historyLabel   = $('history-label');
    const clearHistoryBtn = $('clear-history-btn');
    const chatMessages   = $('chat-messages');
    const chatScroll     = $('chat-scroll');
    const welcomeScreen  = $('welcome-screen');
    const chatInput      = $('chat-input');
    const sendBtn        = $('send-btn');
    const micBtn         = $('mic-btn');
    const attachBtn      = $('attach-btn');
    const fileUpload     = $('file-upload');
    const attachPreview  = $('attachment-preview');
    const previewImg     = $('preview-img');
    const fileInfo       = $('file-info');
    const fileInfoName   = $('file-info-name');
    const removeAttach   = $('remove-attachment');
    const apiSelector    = $('api-selector');
    const settingsModal  = $('settings-modal');
    const geminiKeyIn    = $('gemini-key');
    const openrouterKeyIn= $('openrouter-key');
    const themeToggle    = $('theme-toggle');
    const exportPdfBtn   = $('export-pdf-btn');
    const modelSwitchBtn = $('model-switch-btn');
    const modelIcon      = $('model-icon');
    const modelLabel     = $('model-label');
    const resizeHandle   = $('sidebar-resize-handle');
    const sidebarCalendar = $('sidebar-calendar');
    const reminderForm = $('reminder-form');
    const reminderName = $('reminder-name');
    const reminderDosage = $('reminder-dosage');
    const reminderDate = $('reminder-date');
    const reminderTime = $('reminder-time');
    const reminderRepeat = $('reminder-repeat');
    const reminderColor = $('reminder-color');
    const reminderNotes = $('reminder-notes');
    const calendarPrev = $('calendar-prev');
    const calendarNext = $('calendar-next');
    const calendarMonthLabel = $('calendar-month-label');
    const calendarWeekdays = $('calendar-weekdays');
    const calendarDays = $('calendar-days');
    const selectedDayLabel = $('selected-day-label');
    const calDayCount = $('cal-day-count');
    const todayReminders = $('today-reminders');
    const notificationStack = $('notification-stack');
    const reminderDashboard = $('reminder-dashboard');
    const chatArea = $('chat-area');
    const inputArea = document.querySelector('.input-area');
    const aboutView = $('about-view');
    const sidebarAboutBtn = $('sidebar-about-btn');
    const calClockTime = $('cal-clock-time');
    const calClockDate = $('cal-clock-date');
    const statTotalNum = $('stat-total-num');
    const statTakenNum = $('stat-taken-num');
    const statNextLabel = $('stat-next-label');
    const calWeeklyStrip = $('cal-weekly-strip');
    const notifBellBtn = $('notif-bell-btn');
    const notifBellBadge = $('notif-bell-badge');
    const notifDropdown = $('notif-dropdown');
    const notifDropdownList = $('notif-dropdown-list');
    const notifClearBtn = $('notif-clear-btn');
    const datePickerBtn = $('date-picker-btn');
    const timePickerBtn = $('time-picker-btn');

    // ── State ───────────────────────────────────────────
    let activeSessionId = null;
    let chatHistory     = [];   // [{role, content}]
    let currentFileText = null;
    let currentImageB64 = null; // full data-URL
    let isRecording     = false;
    let stopRecordingByUser = false;
    let speechBaseText   = '';
    let speechFinalText  = '';
    let speechInterimText = '';
    let stopSpeechRecognition = () => {};
    let isFirstMessage  = false; // track if next send is first in session
    let savedChatsCollapsed = false;
    const blobUrlCache  = new Map(); // dataURL → blobURL for click-to-view
    const savedToggleIcon = $('saved-toggle-icon');
    let reminders = [];
    let selectedDate = new Date();
    let calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const notifiedKeys = new Set();
    const REMINDER_STORAGE_KEY = 'medication_reminders_v1';
    let currentView = 'chat';
    let notifHistory = JSON.parse(localStorage.getItem('notif_history') || '[]');

    // ── API keys (config.js → localStorage fallback) ───
    let geminiKey     = window.APP_CONFIG?.GEMINI_API_KEY   || localStorage.getItem('geminiKey') || '';
    let openrouterKey = window.APP_CONFIG?.OPENROUTER_API_KEY || localStorage.getItem('openrouterKey') || '';
    geminiKeyIn.value     = geminiKey;
    openrouterKeyIn.value = openrouterKey;

    // ── Theme Toggle ────────────────────────────────────
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
    });

    function updateThemeIcon(theme) {
        const icon = themeToggle.querySelector('.material-symbols-outlined');
        icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }

    // ── Inline Model Switcher ───────────────────────────
    const savedModel = localStorage.getItem('apiModel') || 'openrouter';
    apiSelector.value = savedModel;

    function setModelPresentation(mode) {
        modelLabel.textContent = mode === 'gemini' ? 'Gemini' : 'OpenRouter';
        modelSwitchBtn.classList.toggle('provider-openrouter', mode === 'openrouter');
        modelSwitchBtn.classList.toggle('provider-gemini', mode === 'gemini');
        modelSwitchBtn.title = mode === 'gemini' ? 'Switch to OpenRouter' : 'Switch to Gemini';
    }

    setModelPresentation(savedModel);

    modelSwitchBtn.addEventListener('click', () => {
        const current = apiSelector.value;
        const next = current === 'gemini' ? 'openrouter' : 'gemini';
        apiSelector.value = next;
        setModelPresentation(next);
        localStorage.setItem('apiModel', next);
    });

    // ── Settings modal ──────────────────────────────────
    function openSettings() { settingsModal.style.display = 'flex'; }
    function closeSettings() { settingsModal.style.display = 'none'; }

    $('sidebar-settings-btn').addEventListener('click', openSettings);
    $('close-modal-btn').addEventListener('click', closeSettings);
    $('close-modal-x').addEventListener('click', closeSettings);
    settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettings(); });

    $('save-keys-btn').addEventListener('click', () => {
        geminiKey = geminiKeyIn.value.trim();
        openrouterKey = openrouterKeyIn.value.trim();
        localStorage.setItem('geminiKey', geminiKey);
        localStorage.setItem('openrouterKey', openrouterKey);
        closeSettings();
    });

    // ── Sidebar toggle ──────────────────────────────────
    sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('open');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });
    sidebarOverlay.addEventListener('click', () => sidebar.classList.remove('open'));

    // ── Resizable Sidebar ───────────────────────────────
    let isResizing = false;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizeHandle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = Math.min(Math.max(e.clientX, 200), 450);
        sidebar.style.width = newWidth + 'px';
        sidebar.style.minWidth = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizeHandle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // ── Session helpers ─────────────────────────────────
    async function loadSessions() {
        const res = await fetch('/api/sessions');
        const sessions = await res.json();

        sessionList.innerHTML = '';
        starredList.innerHTML = '';

        const starred = sessions.filter(s => s.is_favorite);
        const recent  = sessions.filter(s => !s.is_favorite);

        // Show/hide starred section
        starredList.style.display = starred.length && !savedChatsCollapsed ? 'block' : 'none';
        historyLabel.style.display = sessions.length ? 'flex' : 'none';
        sessionList.style.display = sessions.length ? 'block' : 'none';

        starred.forEach(s => starredList.appendChild(createSessionItem(s)));
        recent.forEach(s => sessionList.appendChild(createSessionItem(s)));
    }

    function createSessionItem(s) {
        const btn = document.createElement('button');
        btn.className = 'session-item' + (s.id === activeSessionId ? ' active' : '');
        btn.innerHTML = `
            <span class="session-title">${escapeHtml(s.title)}</span>
            <span class="session-actions">
                <span class="star-btn ${s.is_favorite ? 'starred' : ''}" data-id="${s.id}" title="${s.is_favorite ? 'Unstar' : 'Star'}">
                    <span class="material-symbols-outlined">${s.is_favorite ? 'star' : 'star_border'}</span>
                </span>
                <span class="delete-btn" data-id="${s.id}" title="Delete">
                    <span class="material-symbols-outlined">delete</span>
                </span>
            </span>
        `;

        btn.addEventListener('click', e => {
            if (e.target.closest('.delete-btn') || e.target.closest('.star-btn')) return;
            loadSession(s.id);
            sidebar.classList.remove('open');
        });

        btn.querySelector('.delete-btn').addEventListener('click', async e => {
            e.stopPropagation();
            await fetch(`/api/sessions/${s.id}`, { method: 'DELETE' });
            if (activeSessionId === s.id) resetChat();
            loadSessions();
        });

        btn.querySelector('.star-btn').addEventListener('click', async e => {
            e.stopPropagation();
            await fetch(`/api/sessions/${s.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_favorite: s.is_favorite ? 0 : 1 })
            });
            loadSessions();
        });

        return btn;
    }

    async function loadSession(sid) {
        setMainView('chat');
        activeSessionId = sid;
        chatHistory = [];
        chatMessages.innerHTML = '';

        const res = await fetch(`/api/sessions/${sid}/messages`);
        const msgs = await res.json();

        msgs.forEach(m => {
            chatHistory.push({ role: m.role, content: m.content });
            appendBubble(m.role, m.content, m.image_data, m.created_at, m.provider_mode);
        });

        isFirstMessage = msgs.length === 0;

        if (!msgs.length) {
            chatMessages.appendChild(welcomeScreen);
            welcomeScreen.style.display = 'flex';
        } else {
            welcomeScreen.style.display = 'none';
        }

        scrollToBottom();
        loadSessions();
    }

    function resetChat() {
        stopSpeechRecognition();
        activeSessionId = null;
        chatHistory = [];
        isFirstMessage = false;
        chatMessages.innerHTML = '';
        chatMessages.appendChild(welcomeScreen);
        welcomeScreen.style.display = 'flex';
        clearAttachment();
        loadSessions();
    }

    newChatBtn.addEventListener('click', () => {
        setMainView('chat');
        resetChat();
        sidebar.classList.remove('open');
    });

    if (favoritesBtn) {
        favoritesBtn.addEventListener('click', () => {
            savedChatsCollapsed = !savedChatsCollapsed;
            starredList.style.display = savedChatsCollapsed || !starredList.children.length ? 'none' : 'block';
            favoritesBtn.classList.toggle('active', !savedChatsCollapsed && !!starredList.children.length);
            if (savedToggleIcon) {
                savedToggleIcon.textContent = savedChatsCollapsed ? 'expand_more' : 'expand_less';
            }
        });
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', async () => {
            const ok = window.confirm('Clear all chat history? This removes all chats from Supabase and this device view.');
            if (!ok) return;

            clearHistoryBtn.disabled = true;
            try {
                const res = await fetch('/api/sessions', { method: 'DELETE' });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(errText || 'Failed to clear history');
                }

                // Reset local in-memory chat state and UI.
                resetChat();
                chatHistory = [];
                activeSessionId = null;

                // Clear any known local-only chat cache keys if present.
                localStorage.removeItem('chatHistory');
                localStorage.removeItem('activeSessionId');

                await loadSessions();
                pushInAppNotification('Chat history cleared', 'All chats were removed from Supabase and local view.');
            } catch (e) {
                console.error('Clear history failed:', e);
                pushInAppNotification('Clear failed', 'Unable to clear chat history. Please try again.');
            } finally {
                clearHistoryBtn.disabled = false;
            }
        });
    }

    function setMainView(view) {
        currentView = view;
        const showCalendar = view === 'calendar';
        const showAbout = view === 'about';
        const showChat = view === 'chat';

        reminderDashboard.classList.toggle('hidden-view', !showCalendar);
        if (aboutView) aboutView.style.display = showAbout ? 'block' : 'none';
        chatArea.classList.toggle('hidden-view', !showChat);
        inputArea.classList.toggle('hidden-view', !showChat);
        exportPdfBtn.classList.toggle('hidden-view', !showChat);
        
        calendarModeBtn.classList.toggle('active', showCalendar);
        if (sidebarAboutBtn) sidebarAboutBtn.classList.toggle('active', showAbout);
    }

    if (calendarModeBtn) {
        calendarModeBtn.addEventListener('click', () => {
            setMainView('calendar');
            sidebar.classList.remove('open');
        });
    }

    if (sidebarAboutBtn) {
        sidebarAboutBtn.addEventListener('click', () => {
            setMainView('about');
            sidebar.classList.remove('open');
        });
    }

    // ── Reminder calendar + notification system ───────
    function toDateKey(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function parseDateKey(dateKey) {
        const [y, m, d] = dateKey.split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
    }

    function timeToMinutes(t) {
        const [h, m] = (t || '00:00').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    }

    function formatReminderTime(t) {
        if (!t) return '--:--';
        const [hh, mm] = t.split(':').map(Number);
        const d = new Date();
        d.setHours(hh || 0, mm || 0, 0, 0);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function loadReminders() {
        try {
            reminders = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || '[]');
            if (!Array.isArray(reminders)) reminders = [];
        } catch (_) {
            reminders = [];
        }
    }

    function saveReminders() {
        localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
    }

    function colorForReminder(seedText) {
        const palette = [
            '#c8710f', '#2563eb', '#059669', '#9333ea', '#dc2626',
            '#0f766e', '#be185d', '#ca8a04', '#6366f1', '#0ea5e9',
            '#d946ef', '#f97316'
        ];
        const key = (seedText || '').toLowerCase();
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash |= 0;
        }
        return palette[Math.abs(hash) % palette.length];
    }

    function normalizeTimeToken(token) {
        if (!token) return null;
        const t = token.trim().toLowerCase();
        if (/^\d{1,2}:\d{2}$/.test(t)) return t;
        const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
        if (!m) return null;
        let h = Number(m[1]);
        const min = Number(m[2] || 0);
        const ap = m[3];
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }

    function detectDateFromText(text) {
        const lower = (text || '').toLowerCase();
        const today = new Date();
        if (lower.includes('tomorrow')) {
            const d = new Date(today);
            d.setDate(d.getDate() + 1);
            return toDateKey(d);
        }
        return toDateKey(today);
    }

    function parseReminderCandidates(rawText) {
        const text = (rawText || '').slice(0, 7000);
        if (!text.trim()) return [];
        const sentences = text.split(/\n|(?<=\w)\.\s|;/).map(s => s.trim()).filter(Boolean);
        const results = [];

        const knownDrugs = /paracetamol|ibuprofen|amoxicillin|aspirin|metformin|omeprazole|atorvastatin|cetirizine|azithromycin|ciprofloxacin|pantoprazole|crocin|dolo|combiflam|augmentin|calpol|disprin|ecosprin|glycomet|montair|montelukast|levocetirizine|ranitidine|domperidone|ondansetron|diclofenac|aceclofenac|losartan|amlodipine|telmisartan/i;

        for (const sentence of sentences) {
            const timeMatches = sentence.match(/\b\d{1,2}:\d{2}\b|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi) || [];
            if (!timeMatches.length) continue;

            let repeat = 'once';
            if (/daily|every day|everyday|each day|once daily|twice daily|twice a day/i.test(sentence)) repeat = 'daily';
            else if (/weekly|every week|once a week/i.test(sentence)) repeat = 'weekly';

            const dosageMatch = sentence.match(/\b\d+\s?(mg|ml|mcg|g|tablet(?:s)?|capsule(?:s)?|drops?)\b/i);
            const dosage = dosageMatch ? dosageMatch[0] : '';

            // Try extracting medicine name from **bold** markdown
            let medName = '';
            const boldMatch = sentence.match(/\*\*([^*]+)\*\*/);
            if (boldMatch) {
                medName = boldMatch[1].trim();
            }

            // Try matching known drug names
            if (!medName) {
                const drugMatch = sentence.match(knownDrugs);
                if (drugMatch) {
                    medName = drugMatch[0].charAt(0).toUpperCase() + drugMatch[0].slice(1).toLowerCase();
                }
            }

            for (const tm of timeMatches) {
                const normTime = normalizeTimeToken(tm);
                if (!normTime) continue;
                const date = detectDateFromText(sentence);

                // Fallback name extraction if no bold or known drug found
                let name = medName;
                if (!name) {
                    const beforeTime = sentence.split(tm)[0] || sentence;
                    const cleaned = beforeTime
                        .replace(/\*\*/g, '')
                        .replace(/\b(take|set|add|medicine|medication|reminder|at|for|please|timing|time|and|the|your|should|can|you|i|my)\b/gi, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    name = cleaned.split(' ').slice(-3).join(' ').trim();
                    if (!name || name.length < 2) name = 'Medication';
                }

                // Clean up name — remove leading digits, markdown
                name = name.replace(/^\d+[.)]\s*/, '').replace(/\*\*/g, '').trim();
                if (!name) name = 'Medication';

                results.push({
                    name,
                    dosage,
                    date,
                    time: normTime,
                    repeat,
                    notes: sentence.replace(/\*\*/g, ''),
                    color: colorForReminder(name)
                });
            }
        }

        const unique = [];
        const seen = new Set();
        results.forEach(r => {
            const key = `${r.name.toLowerCase()}|${r.date}|${r.time}|${r.repeat}`;
            if (seen.has(key)) return;
            seen.add(key);
            unique.push(r);
        });
        return unique;
    }

    function shouldAutoExtractReminders(text) {
        const value = (text || '').toLowerCase();
        const hasTime = /\b\d{1,2}:\d{2}\b|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i.test(value);
        const hasMedicationContext = /medicine|medication|tablet|capsule|syrup|dose|dosage|prescription|reminder|take|mg|ml|mcg|paracetamol|ibuprofen|amoxicillin|aspirin|metformin|omeprazole|atorvastatin|cetirizine|azithromycin|ciprofloxacin|pantoprazole|before food|after food|before meal|after meal|twice a day|three times|thrice|once daily|every \d+ hours|morning|evening|night|bedtime/.test(value);
        return hasTime && hasMedicationContext;
    }

    function addRemindersFromParsed(parsed, sourceLabel) {
        if (!parsed.length) return 0;
        let added = 0;
        parsed.forEach(item => {
            const exists = reminders.some(r => (
                r.name.toLowerCase() === item.name.toLowerCase()
                && r.date === item.date
                && r.time === item.time
                && r.repeat === item.repeat
            ));
            if (exists) return;

            reminders.push({
                id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random()),
                name: item.name,
                dosage: item.dosage,
                date: item.date,
                time: item.time,
                repeat: item.repeat,
                notes: item.notes || sourceLabel || '',
                color: item.color || colorForReminder(item.name),
                taken_on: []
            });
            added += 1;
        });
        if (added) saveReminders();
        return added;
    }

    function reminderOccursOnDate(reminder, dateObj) {
        const dateKey = toDateKey(dateObj);
        const start = parseDateKey(reminder.date);
        const current = parseDateKey(dateKey);
        if (current < start) return false;
        if (reminder.repeat === 'daily') return true;
        if (reminder.repeat === 'weekly') {
            const diffDays = Math.round((current - start) / (1000 * 60 * 60 * 24));
            return diffDays % 7 === 0;
        }
        return reminder.date === dateKey;
    }

    function remindersForDate(dateObj) {
        return reminders
            .filter(r => reminderOccursOnDate(r, dateObj))
            .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    }

    function isTakenOnDate(reminder, dateObj) {
        const dateKey = toDateKey(dateObj);
        return Array.isArray(reminder.taken_on) && reminder.taken_on.includes(dateKey);
    }

    function toggleTaken(reminderId, dateObj) {
        const dateKey = toDateKey(dateObj);
        reminders = reminders.map(r => {
            if (r.id !== reminderId) return r;
            const taken = Array.isArray(r.taken_on) ? [...r.taken_on] : [];
            const idx = taken.indexOf(dateKey);
            if (idx >= 0) {
                taken.splice(idx, 1);
            } else {
                taken.push(dateKey);
            }
            return { ...r, taken_on: taken };
        });
        saveReminders();
        renderReminderViews();
    }

    function deleteReminder(reminderId) {
        reminders = reminders.filter(r => r.id !== reminderId);
        saveReminders();
        renderReminderViews();
    }

    function renderSidebarMiniCalendar() {
        const monthStart = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
        const firstWeekday = monthStart.getDay();
        const gridStart = new Date(monthStart);
        gridStart.setDate(monthStart.getDate() - firstWeekday);

        const head = `${monthStart.toLocaleString('default', { month: 'short' })} ${monthStart.getFullYear()}`;
        const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
            .map(d => `<div class="mini-calendar-cell dim">${d}</div>`)
            .join('');

        let days = '';
        for (let i = 0; i < 42; i++) {
            const current = new Date(gridStart);
            current.setDate(gridStart.getDate() + i);
            const inMonth = current.getMonth() === monthStart.getMonth();
            const dateKey = toDateKey(current);
            const dateReminders = remindersForDate(current);
            const hasReminder = dateReminders.length > 0;
            const isToday = dateKey === toDateKey(new Date());
            const classes = [
                'mini-calendar-cell',
                inMonth ? '' : 'dim',
                isToday ? 'today' : '',
                hasReminder ? 'has-reminder' : ''
            ].filter(Boolean).join(' ');
            const dotColor = hasReminder ? (dateReminders[0].color || colorForReminder(dateReminders[0].name)) : '#c8710f';
            days += `<button class="${classes}" data-date="${dateKey}" type="button" style="--dot-color:${dotColor};">${current.getDate()}</button>`;
        }

        sidebarCalendar.innerHTML = `
            <div class="mini-calendar-head">${head}</div>
            <div class="mini-calendar-grid">${weekdays}${days}</div>
        `;

        sidebarCalendar.querySelectorAll('[data-date]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedDate = parseDateKey(btn.dataset.date);
                calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                setMainView('calendar');
                renderReminderViews();
            });
        });
    }

    function renderMainCalendarWeekdays() {
        const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        calendarWeekdays.innerHTML = labels.map(l => `<div class="weekday-label">${l}</div>`).join('');
    }

    function renderMainCalendarDays() {
        const monthStart = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
        const firstWeekday = monthStart.getDay();
        const gridStart = new Date(monthStart);
        gridStart.setDate(monthStart.getDate() - firstWeekday);
        const todayKey = toDateKey(new Date());
        const selectedKey = toDateKey(selectedDate);

        calendarMonthLabel.textContent = monthStart.toLocaleString('default', { month: 'long', year: 'numeric' });

        const cells = [];
        for (let i = 0; i < 42; i++) {
            const current = new Date(gridStart);
            current.setDate(gridStart.getDate() + i);
            const dateKey = toDateKey(current);
            const inMonth = current.getMonth() === monthStart.getMonth();
            const dateReminders = remindersForDate(current);
            const hasReminder = dateReminders.length > 0;
            const classes = [
                'calendar-day',
                inMonth ? '' : 'dim',
                dateKey === todayKey ? 'today' : '',
                dateKey === selectedKey ? 'selected' : ''
            ].filter(Boolean).join(' ');

            const dotsMarkup = hasReminder
                ? `<span class="calendar-day-dots">${dateReminders.slice(0, 3).map(r => `<span class="dot" style="--dot-color:${r.color || colorForReminder(r.name)};"></span>`).join('')}</span>`
                : '<span></span>';

            cells.push(`
                <button type="button" class="${classes}" data-date="${dateKey}">
                    <span>${current.getDate()}</span>
                    ${dotsMarkup}
                </button>
            `);
        }

        calendarDays.innerHTML = cells.join('');
        calendarDays.querySelectorAll('[data-date]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedDate = parseDateKey(btn.dataset.date);
                renderReminderViews();
            });
        });
    }

    function renderSelectedDayReminders() {
        const dateKey = toDateKey(selectedDate);
        if (reminderDate) reminderDate.value = dateKey;
        selectedDayLabel.textContent = `Schedule for ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}`;
        const dayItems = remindersForDate(selectedDate);

        if (calDayCount) {
            calDayCount.textContent = `${dayItems.length} med${dayItems.length !== 1 ? 's' : ''}`;
        }

        if (!dayItems.length) {
            todayReminders.innerHTML = `
                <div class="reminder-empty-state">
                    <span class="material-symbols-outlined">event_available</span>
                    <p>No medications scheduled for this day.</p>
                </div>`;
            return;
        }

        todayReminders.innerHTML = '';
        dayItems.forEach(item => {
            const taken = isTakenOnDate(item, selectedDate);
            const repeatLabel = item.repeat === 'daily' ? 'Daily' : item.repeat === 'weekly' ? 'Weekly' : 'One-time';
            const div = document.createElement('div');
            div.className = 'reminder-item';
            div.style.setProperty('--reminder-color', item.color || colorForReminder(item.name));
            div.innerHTML = `
                <div class="reminder-item-head">
                    <span class="reminder-item-title">${escapeHtml(item.name)}</span>
                    <span class="reminder-item-time-badge" style="background:${(item.color || colorForReminder(item.name)) + '18'};color:${item.color || colorForReminder(item.name)};">${formatReminderTime(item.time)}</span>
                </div>
                <div class="reminder-item-meta">${escapeHtml(item.dosage || 'No dosage specified')} • ${repeatLabel}</div>
                ${item.notes ? `<div class="reminder-item-meta" style="margin-top:2px;font-style:italic;">${escapeHtml(item.notes)}</div>` : ''}
                <div class="reminder-item-actions">
                    <button type="button" class="mini-btn ${taken ? 'taken' : ''}" data-action="taken" data-id="${item.id}">
                        ${taken ? '✅ Taken' : 'Mark Taken'}
                    </button>
                    <button type="button" class="mini-btn" data-action="delete" data-id="${item.id}">🗑 Delete</button>
                </div>
            `;
            todayReminders.appendChild(div);
        });

        todayReminders.querySelectorAll('[data-action="taken"]').forEach(btn => {
            btn.addEventListener('click', () => toggleTaken(btn.dataset.id, selectedDate));
        });
        todayReminders.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => deleteReminder(btn.dataset.id));
        });
    }

    function pushInAppNotification(title, body, color) {
        const n = document.createElement('div');
        n.className = 'inapp-notification';
        if (color) n.style.borderLeftColor = color;
        n.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="reminder-item-meta" style="margin-top:4px;">${escapeHtml(body)}</div>`;
        notificationStack.appendChild(n);
        setTimeout(() => n.remove(), 8000);

        // Store in history
        notifHistory.unshift({ title, body, color: color || '#c8710f', time: new Date().toISOString() });
        if (notifHistory.length > 30) notifHistory = notifHistory.slice(0, 30);
        localStorage.setItem('notif_history', JSON.stringify(notifHistory));
        updateNotifBell();
    }

    function playReminderTone() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const notes = [660, 880, 1100];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
                gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.18 + 0.04);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.18 + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.18);
                osc.stop(ctx.currentTime + i * 0.18 + 0.25);
            });
        } catch (_) {
            // No audio support - ignore.
        }
    }

    function runReminderChecks() {
        const now = new Date();
        const nowDateKey = toDateKey(now);
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        reminders.forEach(item => {
            if (!reminderOccursOnDate(item, now)) return;
            if (isTakenOnDate(item, now)) return;
            if (timeToMinutes(item.time) !== nowMinutes) return;

            const uniqueKey = `${item.id}_${nowDateKey}_${item.time}`;
            if (notifiedKeys.has(uniqueKey)) return;
            notifiedKeys.add(uniqueKey);

            const title = `Medication reminder: ${item.name}`;
            const body = `${formatReminderTime(item.time)} • ${item.dosage || 'Take your medication now'}`;

            pushInAppNotification(title, body);
            playReminderTone();

            if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification(title, { body });
                } else if (Notification.permission === 'default') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            new Notification(title, { body });
                        }
                    });
                }
            }
        });
    }

    // ── Live clock ─────────────────────────────────────
    function updateLiveClock() {
        const now = new Date();
        if (calClockTime) {
            calClockTime.textContent = now.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            });
        }
        if (calClockDate) {
            calClockDate.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
            });
        }
    }

    // ── Stats computation ─────────────────────────────
    function updateCalendarStats() {
        const now = new Date();
        const todayItems = remindersForDate(now);
        const takenCount = todayItems.filter(r => isTakenOnDate(r, now)).length;

        if (statTotalNum) statTotalNum.textContent = todayItems.length;
        if (statTakenNum) statTakenNum.textContent = takenCount;

        // Find next upcoming dose
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const upcoming = todayItems
            .filter(r => !isTakenOnDate(r, now) && timeToMinutes(r.time) > nowMinutes)
            .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

        if (statNextLabel) {
            if (upcoming.length > 0) {
                statNextLabel.textContent = formatReminderTime(upcoming[0].time);
            } else {
                statNextLabel.textContent = 'Done ✓';
            }
        }
    }

    // ── Weekly overview strip ─────────────────────────
    function renderWeeklyStrip() {
        if (!calWeeklyStrip) return;
        const today = new Date();
        const todayKey = toDateKey(today);
        const selectedKey = toDateKey(selectedDate);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let html = '';
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dk = toDateKey(d);
            const dayReminders = remindersForDate(d);
            const isToday = dk === todayKey;
            const isSel = dk === selectedKey;
            const cls = ['cal-week-day', isToday ? 'is-today' : '', isSel ? 'is-selected' : ''].filter(Boolean).join(' ');

            const dots = dayReminders.slice(0, 4).map(r =>
                `<span class="cal-week-dot" style="--dot-color:${r.color || colorForReminder(r.name)};"></span>`
            ).join('');

            html += `
                <button type="button" class="${cls}" data-date="${dk}">
                    <span class="cal-week-day-name">${dayNames[d.getDay()]}</span>
                    <span class="cal-week-day-num">${d.getDate()}</span>
                    <span class="cal-week-day-dots">${dots}</span>
                </button>
            `;
        }

        calWeeklyStrip.innerHTML = html;
        calWeeklyStrip.querySelectorAll('[data-date]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedDate = parseDateKey(btn.dataset.date);
                calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                renderReminderViews();
            });
        });
    }

    function renderReminderViews() {
        renderSidebarMiniCalendar();
        renderMainCalendarWeekdays();
        renderMainCalendarDays();
        renderSelectedDayReminders();
        renderWeeklyStrip();
        updateCalendarStats();
    }

    function initReminderSystem() {
        loadReminders();

        const todayKey = toDateKey(new Date());
        reminderDate.value = todayKey;
        reminderTime.value = '08:00';

        reminderForm.addEventListener('submit', e => {
            e.preventDefault();
            const name = reminderName.value.trim();
            const dosage = reminderDosage.value.trim();
            const date = reminderDate.value;
            const time = reminderTime.value;
            const repeat = reminderRepeat.value;
            const manualColor = reminderColor ? reminderColor.value : '';
            const notes = reminderNotes.value.trim();

            if (!name || !date || !time) return;

            reminders.push({
                id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
                name,
                dosage,
                date,
                time,
                repeat,
                notes,
                color: manualColor || colorForReminder(name),
                taken_on: []
            });
            saveReminders();

            selectedDate = parseDateKey(date);
            calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            reminderForm.reset();
            reminderDate.value = toDateKey(selectedDate);
            reminderTime.value = '08:00';

            renderReminderViews();
            pushInAppNotification('Reminder saved', `${name} at ${formatReminderTime(time)}.`);

            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        });

        calendarPrev.addEventListener('click', () => {
            calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
            renderReminderViews();
        });

        calendarNext.addEventListener('click', () => {
            calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
            renderReminderViews();
        });

        // Live clock
        updateLiveClock();
        setInterval(updateLiveClock, 1000);

        // Date/time picker icon handlers
        if (datePickerBtn && reminderDate) {
            datePickerBtn.addEventListener('click', () => {
                reminderDate.showPicker ? reminderDate.showPicker() : reminderDate.focus();
            });
        }
        if (timePickerBtn && reminderTime) {
            timePickerBtn.addEventListener('click', () => {
                reminderTime.showPicker ? reminderTime.showPicker() : reminderTime.focus();
            });
        }

        // Notification bell toggle
        if (notifBellBtn) {
            notifBellBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notifDropdown.classList.toggle('open');
                renderNotifDropdown();
            });
            document.addEventListener('click', (e) => {
                if (!notifDropdown.contains(e.target) && e.target !== notifBellBtn) {
                    notifDropdown.classList.remove('open');
                }
            });
        }
        if (notifClearBtn) {
            notifClearBtn.addEventListener('click', () => {
                notifHistory = [];
                localStorage.setItem('notif_history', '[]');
                renderNotifDropdown();
                updateNotifBell();
            });
        }
        updateNotifBell();

        renderReminderViews();
        runReminderChecks();
        setInterval(runReminderChecks, 30000);
    }

    // ── Notification bell helpers ─────────────────────
    function updateNotifBell() {
        if (!notifBellBadge) return;
        const now = new Date();
        const todayItems = remindersForDate(now);
        const upcoming = todayItems.filter(r => !isTakenOnDate(r, now) && timeToMinutes(r.time) > (now.getHours()*60 + now.getMinutes()));
        if (upcoming.length > 0 || notifHistory.length > 0) {
            notifBellBadge.classList.add('has-notifs');
        } else {
            notifBellBadge.classList.remove('has-notifs');
        }
    }

    function renderNotifDropdown() {
        if (!notifDropdownList) return;
        const now = new Date();
        const todayItems = remindersForDate(now);
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const upcoming = todayItems
            .filter(r => !isTakenOnDate(r, now) && timeToMinutes(r.time) > nowMin)
            .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

        let html = '';

        // Upcoming today
        if (upcoming.length > 0) {
            html += '<div style="font-size:0.68rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:6px;">Upcoming Today</div>';
            upcoming.forEach(r => {
                const col = r.color || colorForReminder(r.name);
                html += `<div class="notif-dropdown-item" style="--notif-color:${col};">
                    <div class="notif-dropdown-item-title">${escapeHtml(r.name)}</div>
                    <div class="notif-dropdown-item-meta">${formatReminderTime(r.time)} • ${escapeHtml(r.dosage || 'No dosage')}</div>
                </div>`;
            });
        }

        // Past notifications
        if (notifHistory.length > 0) {
            html += '<div style="font-size:0.68rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin:8px 0 6px;">Recent Activity</div>';
            notifHistory.slice(0, 10).forEach(n => {
                const timeAgo = getTimeAgo(n.time);
                html += `<div class="notif-dropdown-item" style="--notif-color:${n.color || '#c8710f'};">
                    <div class="notif-dropdown-item-title">${escapeHtml(n.title)}</div>
                    <div class="notif-dropdown-item-meta">${escapeHtml(n.body)} • ${timeAgo}</div>
                </div>`;
            });
        }

        if (!html) {
            html = '<div class="notif-dropdown-empty"><span class="material-symbols-outlined">notifications_off</span>No notifications yet</div>';
        }

        notifDropdownList.innerHTML = html;
    }

    function getTimeAgo(isoStr) {
        const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
        return `${Math.floor(diff/86400)}d ago`;
    }

    // ── Chat UI helpers ─────────────────────────────────
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function formatMarkdown(text) {
        const safeText = escapeHtml((text || '').replace(/\r\n/g, '\n').trim());
        if (!safeText) return '';

        const codeBlocks = [];
        const textWithTokens = safeText.replace(/```(?:[a-zA-Z]+)?\n?([\s\S]*?)```/g, (_, code) => {
            const token = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(code.trim());
            return token;
        });

        const formatInline = (value) => value
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(?!\*)([^*]+?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\[BTN: SHOW_REMINDER\]/g, '<button class="show-reminder-btn"><span class="material-symbols-outlined">calendar_month</span> Show Reminder</button>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        const lines = textWithTokens.split('\n');
        const blocks = [];
        let paragraph = [];
        let listType = null;
        let listItems = [];
        let quoteLines = [];

        const flushParagraph = () => {
            if (!paragraph.length) return;
            blocks.push(`<p>${formatInline(paragraph.join(' ').trim())}</p>`);
            paragraph = [];
        };

        const flushList = () => {
            if (!listItems.length) return;
            const tag = listType === 'ol' ? 'ol' : 'ul';
            blocks.push(`<${tag} class="md-list">${listItems.map(item => `<li>${formatInline(item)}</li>`).join('')}</${tag}>`);
            listItems = [];
            listType = null;
        };

        const flushQuote = () => {
            if (!quoteLines.length) return;
            blocks.push(`<blockquote>${quoteLines.map(line => formatInline(line)).join('<br>')}</blockquote>`);
            quoteLines = [];
        };

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            const tokenMatch = line.match(/^__CODE_BLOCK_(\d+)__$/);
            if (tokenMatch) {
                flushParagraph();
                flushList();
                flushQuote();
                const code = codeBlocks[Number(tokenMatch[1])] || '';
                blocks.push(`<pre><code>${code}</code></pre>`);
                continue;
            }

            if (!line.trim()) {
                flushParagraph();
                flushList();
                flushQuote();
                continue;
            }

            const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
            if (headingMatch) {
                flushParagraph();
                flushList();
                flushQuote();
                const level = headingMatch[1].length;
                blocks.push(`<h${level}>${formatInline(headingMatch[2].trim())}</h${level}>`);
                continue;
            }

            const quoteMatch = line.match(/^>\s?(.*)$/);
            if (quoteMatch) {
                flushParagraph();
                flushList();
                quoteLines.push(quoteMatch[1]);
                continue;
            }

            const unorderedMatch = line.match(/^[-•*]\s+(.+)$/);
            const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
            if (unorderedMatch || orderedMatch) {
                flushParagraph();
                flushQuote();
                const nextType = unorderedMatch ? 'ul' : 'ol';
                if (listType && listType !== nextType) {
                    flushList();
                }
                listType = nextType;
                listItems.push((unorderedMatch || orderedMatch)[1]);
                continue;
            }

            flushList();
            flushQuote();
            paragraph.push(line);
        }

        flushParagraph();
        flushList();
        flushQuote();

        return blocks.join('');
    }

    function formatTimestamp(dateStr) {
        if (!dateStr) {
            return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
        // dateStr comes from SQLite as UTC, parse and display local
        const d = new Date(dateStr + 'Z');
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Convert a data-URL to a blob URL (cached)
    function dataUrlToBlobUrl(dataUrl) {
        if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
        if (blobUrlCache.has(dataUrl)) return blobUrlCache.get(dataUrl);
        try {
            const [header, b64data] = dataUrl.split(',');
            const mime = header.match(/data:(.*?);/)?.[1] || 'image/png';
            const binary = atob(b64data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            blobUrlCache.set(dataUrl, blobUrl);
            return blobUrl;
        } catch (e) {
            console.warn('Failed to create blob URL:', e);
            return dataUrl;
        }
    }

    function getProviderLabel(mode) {
        return mode === 'gemini' ? 'Gemini' : 'OpenRouter';
    }

    function appendBubble(role, text, imageSrc, timestamp, providerMode = null) {
        welcomeScreen.style.display = 'none';
        const msg = document.createElement('div');
        msg.className = `message ${role}`;

        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        // Image thumbnail (above text) — use blob URL for click-to-view
        if (imageSrc) {
            const blobUrl = dataUrlToBlobUrl(imageSrc);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            const img = document.createElement('img');
            img.src = blobUrl;
            img.className = 'chat-image';
            img.alt = 'attachment';
            link.appendChild(img);
            bubble.appendChild(link);
        }

        // Text content
        const textDiv = document.createElement('div');
        if (role === 'assistant') {
            textDiv.className = 'assistant-output';
            textDiv.innerHTML = formatMarkdown(text || '');
        } else {
            textDiv.className = 'user-output';
            textDiv.textContent = text || '';
        }
        bubble.appendChild(textDiv);

        if (role === 'assistant') {
            const meta = document.createElement('div');
            meta.className = 'msg-timestamp ai-meta';
            const mode = providerMode || apiSelector.value || 'openrouter';
            meta.innerHTML = `
                <span class="ai-meta-provider">
                    <span class="ai-meta-name">${getProviderLabel(mode)}</span>
                </span>
                <span class="ai-meta-time">${formatTimestamp(timestamp)}</span>
            `;
            bubble.appendChild(meta);
        }

        msg.appendChild(bubble);

        // Timestamp (shown for user messages)
        if (role === 'user') {
            const ts = document.createElement('div');
            ts.className = 'msg-timestamp';
            ts.textContent = formatTimestamp(timestamp);
            msg.appendChild(ts);
        }

        chatMessages.appendChild(msg);
        scrollToBottom();
    }

    function addTypingIndicator() {
        const msg = document.createElement('div');
        msg.className = 'message assistant';
        msg.id = 'typing-indicator';
        msg.innerHTML = `<div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
        chatMessages.appendChild(msg);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const el = document.getElementById('typing-indicator');
        if (el) el.remove();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => { chatScroll.scrollTop = chatScroll.scrollHeight; });
    }

    // ── Textarea auto-resize ────────────────────────────
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
        updateSendBtn();
    });

    function updateSendBtn() {
        sendBtn.disabled = !(chatInput.value.trim() || currentFileText || currentImageB64);
    }

    chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    sendBtn.addEventListener('click', handleSend);

    // ── File / Image attachment ─────────────────────────
    attachBtn.addEventListener('click', () => fileUpload.click());

    fileUpload.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;

        const isImage = file.type.startsWith('image/');

        if (isImage) {
            currentImageB64 = await fileToBase64(file);
            previewImg.src = URL.createObjectURL(file);
            previewImg.style.display = 'block';
            fileInfo.style.display = 'none';
        } else if (file.name.endsWith('.pdf')) {
            currentFileText = await extractPdf(file);
            fileInfoName.textContent = file.name;
            fileInfo.style.display = 'flex';
            previewImg.style.display = 'none';
        } else {
            currentFileText = await file.text();
            fileInfoName.textContent = file.name;
            fileInfo.style.display = 'flex';
            previewImg.style.display = 'none';
        }

        attachPreview.style.display = 'flex';
        updateSendBtn();
        fileUpload.value = '';
    });

    removeAttach.addEventListener('click', clearAttachment);

    function clearAttachment() {
        currentFileText = null;
        currentImageB64 = null;
        attachPreview.style.display = 'none';
        previewImg.style.display = 'none';
        fileInfo.style.display = 'none';
        updateSendBtn();
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function extractPdf(file) {
        if (!window.pdfjsLib) return "[PDF.js not loaded]";
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const tc = await page.getTextContent();
            text += tc.items.map(x => x.str).join(' ') + '\n';
        }
        return text;
    }

    // ── Voice input (Web Speech API) ────────────────────
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.continuous = true;
        recognition.interimResults = true;

        const syncSpeechText = () => {
            const combined = [speechBaseText, speechFinalText, speechInterimText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
            chatInput.value = combined;
            chatInput.dispatchEvent(new Event('input'));
            chatInput.scrollTop = chatInput.scrollHeight;
        };

        const startRecognition = () => {
            if (isRecording) return;
            stopRecordingByUser = false;
            speechBaseText = chatInput.value.trim();
            speechFinalText = '';
            speechInterimText = '';
            try {
                recognition.start();
            } catch (_) {
                // Ignore start errors caused by rapid toggles or unsupported states.
            }
        };

        const stopRecognition = () => {
            stopRecordingByUser = true;
            try {
                recognition.stop();
            } catch (_) {
                // Ignore stop errors if recognition is already idle.
            }
        };

        stopSpeechRecognition = stopRecognition;

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
            micBtn.title = 'Stop voice input';
        };

        recognition.onresult = (e) => {
            let interim = '';
            let finalChunk = '';

            for (let i = e.resultIndex; i < e.results.length; i++) {
                const transcript = e.results[i][0]?.transcript || '';
                if (e.results[i].isFinal) {
                    finalChunk += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }

            if (finalChunk) {
                speechFinalText = [speechFinalText, finalChunk.trim()].filter(Boolean).join(' ').trim();
            }
            speechInterimText = interim.trim();
            syncSpeechText();
        };

        recognition.onend = () => {
            isRecording = false;
            micBtn.classList.remove('recording');
            micBtn.title = 'Voice input';

            if (!stopRecordingByUser) {
                window.setTimeout(() => {
                    if (!stopRecordingByUser && !isRecording) {
                        try {
                            recognition.start();
                        } catch (_) {
                            // Ignore restart errors and keep the control idle.
                        }
                    }
                }, 250);
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'aborted') {
                return;
            }
            isRecording = false;
            micBtn.classList.remove('recording');
            micBtn.title = 'Voice input';
            if (!stopRecordingByUser) {
                window.setTimeout(() => {
                    if (!stopRecordingByUser && !isRecording) {
                        try {
                            recognition.start();
                        } catch (_) {
                            // Ignore restart errors and keep the control idle.
                        }
                    }
                }, 350);
            }
        };

        micBtn.addEventListener('click', () => {
            if (isRecording) {
                stopRecognition();
            } else {
                startRecognition();
            }
        });
    } else {
        micBtn.style.opacity = '0.35';
        micBtn.style.cursor  = 'not-allowed';
        micBtn.title = 'Voice input not supported';
    }

    // ── Welcome chips ───────────────────────────────────
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.prompt;
            chatInput.dispatchEvent(new Event('input'));
            handleSend();
        });
    });

    // ── PDF Export ───────────────────────────────────────
    exportPdfBtn.addEventListener('click', async () => {
        if (!activeSessionId) return;

        exportPdfBtn.disabled = true;
        exportPdfBtn.classList.add('loading');

        try {
            const res = await fetch(`/api/sessions/${activeSessionId}/export`);
            if (!res.ok) {
                throw new Error(await res.text());
            }

            const pdfBlob = await res.blob();
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Medication_Chat.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            console.error('PDF export failed:', e);
        } finally {
            exportPdfBtn.disabled = false;
            exportPdfBtn.classList.remove('loading');
        }
    });

    // ── Smart Title Generation ──────────────────────────
    async function generateSmartTitle(sessionId, message) {
        try {
            const res = await fetch(`/api/sessions/${sessionId}/generate-title`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    api_key: geminiKey
                })
            });
            if (res.ok) {
                await loadSessions();
            }
        } catch (e) {
            console.warn('Smart title generation failed:', e);
        }
    }

    // ── Core send logic ─────────────────────────────────
    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text && !currentFileText && !currentImageB64) return;

        stopSpeechRecognition();

        // Ensure we have a session
        let justCreated = false;
        if (!activeSessionId) {
            const res = await fetch('/api/sessions', { method: 'POST' });
            const session = await res.json();
            activeSessionId = session.id;
            isFirstMessage = true;
            justCreated = true;
        }

        // Grab current attachments before clearing
        const _fileText = currentFileText;
        const _imageB64 = currentImageB64;

        // Display user bubble immediately (with image thumbnail if present)
        appendBubble('user', text, _imageB64, null);

        // Save user message to backend
        await fetch(`/api/sessions/${activeSessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'user', content: text, image_data: _imageB64 })
        });

        chatHistory.push({ role: 'user', content: text });

        // Clear input state
        chatInput.value = '';
        chatInput.style.height = 'auto';
        clearAttachment();
        sendBtn.disabled = true;
        chatInput.disabled = true;

        addTypingIndicator();

        // Smart title on first message
        if (isFirstMessage && text) {
            isFirstMessage = false;
            generateSmartTitle(activeSessionId, text);
        } else {
            loadSessions();
        }

        try {
            const apiMode = apiSelector.value;
            const key = apiMode === 'gemini' ? geminiKey : openrouterKey;
            const fn  = apiMode === 'gemini'
                ? window.fetchGeminiResponse
                : window.fetchOpenRouterResponse;

            let reply = await fn(chatHistory, _fileText, _imageB64, key);

            // Handle hidden calendar actions
            if (reply.includes('[ACTION: CLEAR_CALENDAR]')) {
                reply = reply.replace('[ACTION: CLEAR_CALENDAR]', '').trim();
                const existing = JSON.parse(localStorage.getItem('medication_reminders_v1') || '[]');
                if (existing.length > 0) {
                    localStorage.setItem('medication_reminders_v1', '[]');
                    reminders = []; // Fix real-time sync by clearing memory array
                    renderReminderViews();
                    pushInAppNotification('Calendar Cleared', `Successfully removed ${existing.length} reminder${existing.length > 1 ? 's' : ''}.`);
                }
            }

            // Auto-create reminders from user message, uploaded prescription text, and AI schedule reply.
            let autoAdded = 0;
            let totalParsed = 0;
            const extractionSources = [
                { content: text, label: 'chat instruction' },
                { content: (_fileText || '').slice(0, 7000), label: 'uploaded prescription' },
                { content: reply, label: 'ai recommendation' }
            ];

            extractionSources.forEach(src => {
                if (!shouldAutoExtractReminders(src.content)) return;
                const parsed = parseReminderCandidates(src.content);
                totalParsed += parsed.length;
                autoAdded += addRemindersFromParsed(parsed, src.label);
            });

            if (autoAdded > 0) {
                renderReminderViews();
                pushInAppNotification('Calendar updated', `${autoAdded} medication reminder${autoAdded > 1 ? 's' : ''} added.`);
            }

            // Show "Show Reminder" button if any schedule content was detected
            if (totalParsed > 0) {
                reply += '\n\n[BTN: SHOW_REMINDER]';
            }

            removeTypingIndicator();
            appendBubble('assistant', reply, null, null, apiMode);
            chatHistory.push({ role: 'assistant', content: reply });

            // Persist assistant reply
            await fetch(`/api/sessions/${activeSessionId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'assistant', content: reply, provider_mode: apiMode })
            });

        } catch (err) {
            console.error(err);
            removeTypingIndicator();
            appendBubble('assistant', `**Error:** ${err.message}`, null, null);
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
            updateSendBtn();
        }
    }

    // Event delegation for dynamically rendered inline UI components
    chatMessages.addEventListener('click', (e) => {
        const btn = e.target.closest('.show-reminder-btn');
        if (btn) {
            setMainView('calendar');
            sidebar.classList.remove('open');
        }
    });

    // ── Boot ────────────────────────────────────────────
    setMainView('chat');
    initReminderSystem();
    loadSessions();
});
