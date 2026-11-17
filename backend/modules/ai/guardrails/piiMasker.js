// ============================================================
// PII masking: find personal data and replace it with placeholders
//   "mail me at jo@x.com"  ->  "mail me at [EMAIL_1]"
// Runs BEFORE text reaches the model or the logs.
// ============================================================

// Order matters: specific patterns first, loose ones (phone) last.
const PATTERNS = [
  { type: 'SECRET', regex: /\b(?:sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g },
  { type: 'SECRET', regex: /\b(?:password|passwd|pwd|api[\s_-]?key|secret|token)\s*(?:is|:|=)\s*\S+/gi },
  { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'CARD', regex: /(?<![\d-])(?:\d[ -]?){13,19}(?![\d-])/g, validate: luhnValid },
  { type: 'SSN', regex: /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g },
  { type: 'AADHAAR', regex: /(?<!\d)\d{4}[ -]\d{4}[ -]\d{4}(?!\d)/g },
  { type: 'PAN', regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { type: 'PHONE', regex: /(?<![\w])\+?\d[\d\s().-]{8,16}\d(?![\w])/g, validate: (m) => { const n = m.replace(/\D/g, '').length; return n >= 10 && n <= 13; } },
];

// Types that must NEVER be written back into a reply.
const NEVER_RESTORE = new Set(['SECRET', 'CARD', 'SSN', 'AADHAAR', 'PAN']);

// Luhn check: real card numbers pass this checksum, random digit strings usually do not.
function luhnValid(candidate) {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function maskPII(text) {
  const counters = {};
  const map = {}; // placeholder -> original value (kept in memory only, never logged)
  let masked = text;

  for (const { type, regex, validate } of PATTERNS) {
    masked = masked.replace(regex, (match) => {
      if (validate && !validate(match)) return match;
      counters[type] = (counters[type] || 0) + 1;
      const placeholder = `[${type}_${counters[type]}]`;
      map[placeholder] = match.trim();
      return placeholder;
    });
  }

  const findings = Object.entries(counters).map(([type, count]) => ({ type, count }));
  return { text: masked, findings, map };
}

// Put harmless values (email, phone) back into the reply so it reads naturally.
function restorePII(text, map) {
  let out = text;
  for (const [placeholder, original] of Object.entries(map || {})) {
    const type = placeholder.slice(1, placeholder.indexOf('_'));
    if (!NEVER_RESTORE.has(type)) out = out.split(placeholder).join(original);
  }
  return out;
}

// Used by the OUTPUT filter: sensitive values must never appear in a reply at all.
function scrubSensitive(text) {
  const { text: scrubbed, findings } = maskPII(text);
  const bad = findings.filter((f) => NEVER_RESTORE.has(f.type));
  // only keep the scrub if something truly sensitive was found
  return bad.length ? { text: scrubbed, findings: bad } : { text, findings: [] };
}

module.exports = { maskPII, restorePII, scrubSensitive, luhnValid };
