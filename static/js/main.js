document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const sidebar        = $('sidebar');
    const sidebarOverlay = $('sidebar-overlay');
    const sidebarToggle  = $('sidebar-toggle');
    const newChatBtn     = $('new-chat-btn');
    const favoritesBtn   = $('sidebar-favorites-btn');
    const sessionList    = $('session-list');
    const starredList    = $('starred-list');
    const historyLabel   = $('history-label');
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

            const reply = await fn(chatHistory, _fileText, _imageB64, key);

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

    // ── Boot ────────────────────────────────────────────
    loadSessions();
});
