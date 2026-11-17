// Writes audit records and builds the statistics shown on the admin AI page.
const AiAuditLog = require('../models/AiAuditLog');

// Logging must NEVER break a request, so errors are swallowed.
async function record(entry) {
  try {
    await AiAuditLog.create(entry);
  } catch (err) {
    console.error('[AI] audit log failed:', err.message);
  }
}

async function summary(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match = { createdAt: { $gte: since } };

  const [totals] = await AiAuditLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        requests: { $sum: 1 },
        blocked: { $sum: { $cond: [{ $eq: ['$outcome', 'blocked'] }, 1, 0] } },
        inputTokens: { $sum: '$usage.inputTokens' },
        outputTokens: { $sum: '$usage.outputTokens' },
        cacheCreationTokens: { $sum: '$usage.cacheCreationTokens' },
        cacheReadTokens: { $sum: '$usage.cacheReadTokens' },
        avgLatencyMs: { $avg: '$latencyMs' },
      },
    },
  ]);
  const t = totals || { requests: 0, blocked: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, avgLatencyMs: 0 };

  const byStage = await AiAuditLog.aggregate([
    { $match: { ...match, outcome: 'blocked' } },
    { $group: { _id: '$blockStage', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const byTool = await AiAuditLog.aggregate([
    { $match: match }, { $unwind: '$toolCalls' },
    { $group: { _id: '$toolCalls.name', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const piiTypes = await AiAuditLog.aggregate([
    { $match: match }, { $unwind: '$piiFindings' },
    { $group: { _id: '$piiFindings.type', count: { $sum: '$piiFindings.count' } } },
    { $sort: { count: -1 } },
  ]);

  // Share of all input tokens that were served from the prompt cache.
  const allInput = t.inputTokens + t.cacheCreationTokens + t.cacheReadTokens;
  const cacheHitRate = allInput ? Number((t.cacheReadTokens / allInput).toFixed(3)) : 0;

  const recent = await AiAuditLog.find(match).sort({ createdAt: -1 }).limit(25)
    .populate('userId', 'email role').lean();

  return {
    days,
    requests: t.requests,
    blocked: t.blocked,
    tokens: { input: t.inputTokens, output: t.outputTokens, cacheCreation: t.cacheCreationTokens, cacheRead: t.cacheReadTokens },
    cacheHitRate,
    avgLatencyMs: Math.round(t.avgLatencyMs || 0),
    blockedByStage: byStage.map((s) => ({ stage: s._id, count: s.count })),
    toolUsage: byTool.map((s) => ({ tool: s._id, count: s.count })),
    piiMasked: piiTypes.map((s) => ({ type: s._id, count: s.count })),
    recent: recent.map((r) => ({
      id: r._id, at: r.createdAt, user: r.userId ? r.userId.email : null, role: r.role, kind: r.kind,
      outcome: r.outcome, stage: r.blockStage, reason: r.blockReason, input: r.inputMasked,
      tools: (r.toolCalls || []).map((c) => c.name), latencyMs: r.latencyMs,
    })),
  };
}

module.exports = { record, summary };
