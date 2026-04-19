// config.js — Paste your API keys here for permanent storage.
// These take priority over keys saved via the Settings modal.
window.APP_CONFIG = Object.assign(
    {
        GEMINI_API_KEY: "",
        OPENROUTER_API_KEY: ""
    },
    window.APP_CONFIG || {}
);
