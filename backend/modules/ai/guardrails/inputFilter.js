// First guardrail: basic cleaning and limits on what the user typed.
const config = require('../config/ai.config');

// Control characters and invisible characters are removed, because attackers hide text in them.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g;

function filterInput(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'Message must be text.' };

  const text = raw.normalize('NFKC').replace(INVISIBLE, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  if (!text) return { ok: false, reason: 'Message is empty.' };
  if (text.length > config.guardrails.maxInputChars) {
    return { ok: false, reason: `Message is too long (max ${config.guardrails.maxInputChars} characters).` };
  }
  return { ok: true, text };
}

module.exports = { filterInput };
