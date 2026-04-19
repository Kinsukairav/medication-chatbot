"""Medication Chatbot – Single-file server.

Run:
    conda activate ai
    python server.py
"""

from flask import Flask, render_template, request, jsonify, send_file
from io import BytesIO
import base64
import importlib
import re
from xml.sax.saxutils import escape as xml_escape
import sqlite3
import os
import urllib.request
import json

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv:
    load_dotenv()


app = Flask(__name__)

# Vercel serverless functions have a writable /tmp only.
if os.environ.get('VERCEL'):
    DB_PATH = '/tmp/chatbot.db'
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'chatbot.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL DEFAULT 'New Chat',
            is_favorite INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            image_data TEXT,
            provider_mode TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
        );
    ''')
    # Safe migration: add is_favorite if missing (existing DBs)
    try:
        conn.execute('SELECT is_favorite FROM chats LIMIT 1')
    except sqlite3.OperationalError:
        conn.execute('ALTER TABLE chats ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0')
    try:
        conn.execute('SELECT provider_mode FROM messages LIMIT 1')
    except sqlite3.OperationalError:
        conn.execute('ALTER TABLE messages ADD COLUMN provider_mode TEXT')
    conn.commit()
    conn.close()


# ── Routes ──────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/runtime-config.js')
def runtime_config_js():
    gemini_key = json.dumps(os.getenv('GEMINI_API_KEY', ''))
    openrouter_key = json.dumps(os.getenv('OPENROUTER_API_KEY', ''))
    script = (
        'window.APP_CONFIG = {'
        f'GEMINI_API_KEY: {gemini_key}, '
        f'OPENROUTER_API_KEY: {openrouter_key}'
        '};'
    )
    return app.response_class(script, mimetype='application/javascript')


# ── Session CRUD ────────────────────────────────────────

@app.route('/api/sessions', methods=['GET'])
def list_sessions():
    conn = get_db()
    rows = conn.execute(
        'SELECT id, title, is_favorite, created_at FROM chats ORDER BY is_favorite DESC, created_at DESC'
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/sessions', methods=['POST'])
def create_session():
    conn = get_db()
    cur = conn.execute("INSERT INTO chats (title) VALUES ('New Chat')")
    sid = cur.lastrowid
    conn.commit()
    row = conn.execute(
        'SELECT id, title, is_favorite, created_at FROM chats WHERE id = ?', (sid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.route('/api/sessions/<int:sid>', methods=['PATCH'])
def update_session(sid):
    data = request.get_json(force=True)
    conn = get_db()
    if 'title' in data:
        conn.execute('UPDATE chats SET title = ? WHERE id = ?', (data['title'], sid))
    if 'is_favorite' in data:
        conn.execute('UPDATE chats SET is_favorite = ? WHERE id = ?', (int(data['is_favorite']), sid))
    conn.commit()
    row = conn.execute(
        'SELECT id, title, is_favorite, created_at FROM chats WHERE id = ?', (sid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(row))


@app.route('/api/sessions/<int:sid>', methods=['DELETE'])
def delete_session(sid):
    conn = get_db()
    conn.execute('DELETE FROM messages WHERE chat_id = ?', (sid,))
    conn.execute('DELETE FROM chats WHERE id = ?', (sid,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'deleted'})


# ── Smart Title Generation ──────────────────────────────

@app.route('/api/sessions/<int:sid>/generate-title', methods=['POST'])
def generate_title(sid):
    """Use Gemini to create a 2-3 word topic title from the first user message."""
    data = request.get_json(force=True)
    user_message = data.get('message', '')
    api_key = data.get('api_key', '')

    if not user_message or not api_key:
        # Fallback: truncate the message
        title = user_message[:40] + ('…' if len(user_message) > 40 else '')
        conn = get_db()
        conn.execute('UPDATE chats SET title = ? WHERE id = ?', (title, sid))
        conn.commit()
        conn.close()
        return jsonify({'title': title})

    try:
        endpoint = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
        payload = json.dumps({
            'contents': [{
                'role': 'user',
                'parts': [{'text': f'Summarize this user request in exactly 2-3 words for a short chat title. Return ONLY the title, nothing else. No quotes, no punctuation, no explanation.\n\nUser message: "{user_message}"'}]
            }]
        }).encode('utf-8')

        req = urllib.request.Request(endpoint, data=payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            title = result['candidates'][0]['content']['parts'][0]['text'].strip()
            # Clean up: remove quotes, limit length
            title = title.strip('"\'').strip()
            if len(title) > 50:
                title = title[:50]
    except Exception:
        # Fallback on any error
        title = user_message[:40] + ('…' if len(user_message) > 40 else '')

    conn = get_db()
    conn.execute('UPDATE chats SET title = ? WHERE id = ?', (title, sid))
    conn.commit()
    conn.close()
    return jsonify({'title': title})


# ── Message CRUD ────────────────────────────────────────

@app.route('/api/sessions/<int:sid>/messages', methods=['GET'])
def get_messages(sid):
    conn = get_db()
    rows = conn.execute(
        'SELECT id, chat_id, role, content, image_data, provider_mode, created_at '
        'FROM messages WHERE chat_id = ? ORDER BY created_at ASC', (sid,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/sessions/<int:sid>/messages', methods=['POST'])
def save_message(sid):
    data = request.get_json(force=True)
    role = data.get('role', 'user')
    content = data.get('content', '')
    image_data = data.get('image_data')          # full data-URL or None
    provider_mode = data.get('provider_mode')

    conn = get_db()
    conn.execute(
        'INSERT INTO messages (chat_id, role, content, image_data, provider_mode) VALUES (?, ?, ?, ?, ?)',
        (sid, role, content, image_data, provider_mode)
    )
    conn.commit()
    conn.close()
    return jsonify({'status': 'saved'}), 201


def _sanitize_filename(name):
    cleaned = re.sub(r'[^A-Za-z0-9 _-]+', '', name or 'Medication_Chat').strip()
    cleaned = re.sub(r'\s+', '_', cleaned)
    return cleaned or 'Medication_Chat'


def _format_time(date_str):
    if not date_str:
        return ''
    return date_str


def _inline_markup(text):
    safe = xml_escape(text or '')
    safe = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', safe)
    safe = re.sub(r'(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)', r'<i>\1</i>', safe)
    safe = re.sub(r'`([^`]+)`', r'<font face="Courier">\1</font>', safe)
    safe = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', r'<link href="\2">\1</link>', safe)
    return safe


def _message_blocks(text):
    lines = (text or '').replace('\r\n', '\n').split('\n')
    blocks = []
    paragraph = []
    code_lines = []
    in_code = False

    def flush_paragraph():
        nonlocal paragraph
        if paragraph:
            blocks.append(('paragraph', ' '.join(paragraph).strip()))
            paragraph = []

    def flush_code():
        nonlocal code_lines
        if code_lines:
            blocks.append(('code', '\n'.join(code_lines).rstrip()))
            code_lines = []

    for raw_line in lines:
        line = raw_line.rstrip()
        if line.startswith('```'):
            if in_code:
                flush_code()
                in_code = False
            else:
                flush_paragraph()
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if not line.strip():
            flush_paragraph()
            continue

        heading = re.match(r'^(#{1,3})\s+(.+)$', line)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            blocks.append((f'h{level}', heading.group(2).strip()))
            continue

        bullet = re.match(r'^([-•*]|\d+\.)\s+(.+)$', line)
        if bullet:
            flush_paragraph()
            blocks.append(('bullet', bullet.group(2).strip(), bullet.group(1)))
            continue

        paragraph.append(line.strip())

    flush_paragraph()
    flush_code()
    return blocks


@app.route('/api/sessions/<int:sid>/export', methods=['GET'])
def export_session_pdf(sid):
    colors = importlib.import_module('reportlab.lib.colors')
    pagesizes = importlib.import_module('reportlab.lib.pagesizes')
    styles_module = importlib.import_module('reportlab.lib.styles')
    units_module = importlib.import_module('reportlab.lib.units')
    platypus_module = importlib.import_module('reportlab.platypus')

    A4 = pagesizes.A4
    getSampleStyleSheet = styles_module.getSampleStyleSheet
    ParagraphStyle = styles_module.ParagraphStyle
    inch = units_module.inch
    Paragraph = platypus_module.Paragraph
    Spacer = platypus_module.Spacer
    Preformatted = platypus_module.Preformatted
    SimpleDocTemplate = platypus_module.SimpleDocTemplate
    Image = platypus_module.Image

    conn = get_db()
    session = conn.execute(
        'SELECT id, title, created_at FROM chats WHERE id = ?', (sid,)
    ).fetchone()
    if not session:
        conn.close()
        return jsonify({'error': 'Session not found'}), 404

    messages = conn.execute(
        'SELECT role, content, image_data, provider_mode, created_at FROM messages WHERE chat_id = ? ORDER BY created_at ASC, id ASC',
        (sid,)
    ).fetchall()
    conn.close()

    if not messages:
        return jsonify({'error': 'No messages to export'}), 400

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=42,
        bottomMargin=36,
        title=session['title'] or 'Medication Chat'
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='ChatTitle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1A1A1A'),
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name='ChatMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#666666'),
        spaceAfter=14,
    ))
    styles.add(ParagraphStyle(
        name='UserText',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.white,
        backColor=colors.HexColor('#111111'),
        borderPadding=8,
        leftIndent=0,
        rightIndent=0,
        spaceAfter=5,
    ))
    styles.add(ParagraphStyle(
        name='AssistantText',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1A1A1A'),
        backColor=colors.HexColor('#F0F0F0'),
        borderPadding=8,
        leftIndent=0,
        rightIndent=0,
        spaceAfter=5,
    ))
    styles.add(ParagraphStyle(
        name='Heading1Small',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1A1A1A'),
        spaceBefore=2,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name='Heading2Small',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1A1A1A'),
        spaceBefore=2,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name='Heading3Small',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#555555'),
        spaceBefore=2,
        spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        name='BulletSmall',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        leftIndent=10,
        bulletIndent=0,
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        name='CodeSmall',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=9,
        leading=12,
        backColor=colors.HexColor('#F3F3F3'),
        borderPadding=6,
        leftIndent=0,
        rightIndent=0,
    ))

    story = [
        Paragraph(xml_escape(session['title'] or 'Medication Chat'), styles['ChatTitle']),
        Paragraph(f"Exported from Medication Assistant on {_format_time(session['created_at'])}", styles['ChatMeta']),
        Spacer(1, 6),
    ]

    for msg in messages:
        is_user = msg['role'] == 'user'
        text_color = colors.white if is_user else colors.HexColor('#1A1A1A')
        role_label = 'User' if is_user else (msg['provider_mode'] or 'AI')
        header_style = ParagraphStyle(
            name='MsgHeader',
            parent=styles['ChatMeta'],
            textColor=colors.HexColor('#FFFFFF') if is_user else colors.HexColor('#666666'),
            spaceAfter=4,
        )

        story.append(Paragraph(f"<b>{xml_escape(role_label)}</b> · {xml_escape(_format_time(msg['created_at']))}", header_style))

        if msg['image_data']:
            try:
                image_data = msg['image_data']
                if image_data.startswith('data:') and ',' in image_data:
                    image_data = image_data.split(',', 1)[1]
                image_bytes = base64.b64decode(image_data)
                image = Image(BytesIO(image_bytes))
                image._restrictSize(4.8 * inch, 3.6 * inch)
                story.append(image)
                story.append(Spacer(1, 6))
            except Exception:
                fallback_style = ParagraphStyle(
                    name='ImageFallback',
                    parent=styles['ChatMeta'],
                    textColor=text_color,
                    spaceAfter=6,
                    backColor=colors.HexColor('#111111') if is_user else colors.HexColor('#F0F0F0'),
                    borderPadding=6,
                )
                story.append(Paragraph('<i>Image attached with this message.</i>', fallback_style))

        for block in _message_blocks(msg['content'] or ''):
            kind = block[0]
            if kind == 'paragraph':
                story.append(Paragraph(_inline_markup(block[1]), ParagraphStyle(
                    name='MessageParagraph',
                    parent=styles['UserText'] if is_user else styles['AssistantText'],
                    textColor=text_color,
                )))
            elif kind == 'bullet':
                bullet_text = f"{block[2]}" if len(block) > 2 else '•'
                story.append(Paragraph(_inline_markup(block[1]), ParagraphStyle(
                    name='MessageBullet',
                    parent=styles['BulletSmall'],
                    textColor=text_color,
                    leftIndent=12,
                ), bulletText=bullet_text))
            elif kind.startswith('h'):
                heading_style = styles['Heading1Small'] if kind == 'h1' else styles['Heading2Small'] if kind == 'h2' else styles['Heading3Small']
                story.append(Paragraph(_inline_markup(block[1]), ParagraphStyle(
                    name='MessageHeading',
                    parent=heading_style,
                    textColor=text_color,
                )))
            elif kind == 'code':
                story.append(Preformatted(xml_escape(block[1] or ''), ParagraphStyle(
                    name='MessageCode',
                    parent=styles['CodeSmall'],
                    textColor=text_color,
                )))

        story.append(Spacer(1, 10))

    doc.build(story)
    buffer.seek(0)
    filename = _sanitize_filename(session['title']) + '.pdf'
    return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name=filename)


# ── Boot ────────────────────────────────────────────────

# Initialize database at import time so serverless cold starts work.
init_db()


if __name__ == '__main__':
    port = int(os.getenv('PORT', '8000'))
    print(f"\n  Medication Assistant running at http://localhost:{port}\n")
    app.run(host='0.0.0.0', port=port, debug=True)
