// HTTP handlers for the AI layer. This file is the "conductor": it calls each guardrail
// and the agent in the right order. Read it top to bottom to understand the whole flow.
const config = require('../config/ai.config');
const AiConversation = require('../models/AiConversation');
const AiChunk = require('../models/AiChunk');
const { runInputGuards } = require('../guardrails/inputPipeline');
const { restorePII } = require('../guardrails/piiMasker');
const { filterOutput } = require('../guardrails/outputFilter');
const { hit } = require('../guardrails/rateLimiter');
const { SYSTEM_PROMPT } = require('../agent/prompts');
const { getApiKey } = require('../agent/llmClient');
const { runAgent } = require('../agent/agent');
const { confirmAction } = require('../mcp/pendingActions');
const { ToolError } = require('../mcp/tools/toolError');
const { ingestDocuments } = require('../rag/ingest');
const audit = require('../services/auditService');

const userCtx = (req) => ({ userId: String(req.user._id), role: req.user.role, name: req.user.name });

// ---------- helpers for normal JSON replies and for streamed (SSE) replies ----------
function makeResponder(req, res) {
  const stream = req.query.stream === '1';
  if (stream) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  }
  return {
    emit: (event, data) => { if (stream) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); },
    send: (status, payload) => {
      if (stream) { res.write(`event: final\ndata: ${JSON.stringify(payload)}\n\n`); res.end(); } else res.status(status).json(payload);
    },
  };
}

function friendlyError(err) {
  if (err.code === 'AI_NOT_CONFIGURED') return { status: 503, message: 'The AI assistant is not set up yet. Ask an administrator to add LLM_API_KEY.' };
  if (err.status === 401 || err.status === 403) return { status: 503, message: 'The AI service rejected our credentials. Please contact an administrator.' };
  if (err.status === 429) return { status: 429, message: 'The AI service is busy right now. Please try again in a moment.' };
  if (err.status >= 500 || err.name === 'APIConnectionError') return { status: 503, message: 'The AI service is temporarily unavailable. Please try again.' };
  return { status: 500, message: 'Something went wrong while answering. Please try again.' };
}

// ---------- POST /api/ai/chat ----------
exports.chat = async (req, res) => {
  const started = Date.now();
  const ctx = userCtx(req);
  const out = makeResponder(req, res);

  if (!config.enabled) return out.send(503, { message: 'The AI assistant is turned off.' });

  const auditBase = { userId: req.user._id, role: ctx.role, kind: 'chat' };
  const block = async (stage, reason, reply, extra = {}, status = 403) => {
    await audit.record({ ...auditBase, outcome: 'blocked', blockStage: stage, blockReason: reason, latencyMs: Date.now() - started, ...extra });
    out.send(status, { blocked: true, stage, reply });
  };

  try {
    // 0. rate limit
    const rate = await hit(ctx.userId);
    if (!rate.allowed) return block('rate_limit', `more than ${rate.limit} messages per minute`, 'You are sending messages too fast. Please wait a minute.', {}, 429);

    // 1-4. input guardrails
    const guard = await runInputGuards(req.body.message);
    if (!guard.ok) {
      return block(guard.stage, guard.reason, guard.reply,
        { inputMasked: guard.text || '', piiFindings: guard.piiFindings, injectionScore: guard.injectionScore },
        guard.stage === 'input_filter' ? 400 : 403);
    }
    out.emit('status', { message: 'Checked your message' });

    // conversation history lives on the server, never trusted from the browser
    let conversation = null;
    if (req.body.conversationId) conversation = await AiConversation.findOne({ _id: req.body.conversationId, userId: ctx.userId });
    if (!conversation) conversation = new AiConversation({ userId: ctx.userId, messages: [] });

    // 5. the agent (language model + MCP tools)
    const result = await runAgent(
      { ctx, history: conversation.messages, userMessage: guard.text, onEvent: (e) => out.emit(e.type, e) },
    );

    // 6. output guardrails
    const checked = filterOutput({ reply: result.reply, systemPrompt: SYSTEM_PROMPT, retrievedSources: result.sources });
    const maskedReply = checked.text;
    const finalReply = restorePII(maskedReply, guard.piiMap); // put harmless values (email/phone) back for display

    // save history (masked) + audit
    conversation.messages.push({ role: 'user', text: guard.text }, { role: 'assistant', text: maskedReply });
    conversation.messages = conversation.messages.slice(-40);
    conversation.updatedAt = new Date();
    await conversation.save();

    await audit.record({
      ...auditBase, inputMasked: guard.text, piiFindings: guard.piiFindings, injectionScore: guard.injectionScore,
      outcome: checked.ok ? 'allowed' : 'blocked', blockStage: checked.ok ? undefined : 'output_filter',
      blockReason: checked.issues.join(', ') || undefined,
      toolCalls: result.toolCalls, usage: result.usage, model: result.model, latencyMs: Date.now() - started,
    });

    return out.send(200, {
      reply: finalReply,
      conversationId: String(conversation._id),
      pendingActions: result.pendingActions,
      sources: result.sources,
      usage: result.usage,
      guardrails: { piiMasked: guard.piiFindings, outputIssues: checked.issues },
    });
  } catch (err) {
    console.error('[AI] chat error:', err.message);
    const { status, message } = friendlyError(err);
    await audit.record({ ...auditBase, outcome: 'blocked', blockStage: 'error', blockReason: err.message.slice(0, 200), latencyMs: Date.now() - started });
    return out.send(status, { error: true, reply: message });
  }
};

// ---------- POST /api/ai/confirm  { actionId, decision: "confirm" | "cancel" } ----------
exports.confirm = async (req, res) => {
  const { actionId, decision } = req.body;
  if (!actionId || !['confirm', 'cancel'].includes(decision)) return res.status(400).json({ message: 'actionId and decision (confirm or cancel) are required.' });
  const ctx = userCtx(req);
  try {
    const result = await confirmAction(actionId, decision, ctx);
    await audit.record({ userId: req.user._id, role: ctx.role, kind: 'confirm', inputMasked: `${decision} ${result.tool}`, toolCalls: [{ name: result.tool, ok: true, kind: 'write' }] });
    res.json(result);
  } catch (err) {
    if (err instanceof ToolError) return res.status(400).json({ message: err.message });
    console.error('[AI] confirm error:', err);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};

// ---------- GET /api/ai/conversations/:id (reload a chat) ----------
exports.getConversation = async (req, res) => {
  try {
    const c = await AiConversation.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!c) return res.status(404).json({ message: 'Conversation not found.' });
    res.json({ id: c._id, messages: c.messages });
  } catch (e) { res.status(400).json({ message: 'Invalid conversation id.' }); }
};

// ---------- GET /api/ai/status ----------
exports.status = async (req, res) => {
  res.json({
    enabled: config.enabled,
    configured: Boolean(getApiKey()),
    knowledgeChunks: await AiChunk.countDocuments(),
    model: config.models.agent,
    role: req.user.role,
  });
};

// ---------- GET /api/ai/audit?days=7  (root_admin) ----------
exports.auditSummary = async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
  res.json(await audit.summary(days));
};

// ---------- POST /api/ai/ingest  (root_admin) ----------
exports.ingest = async (req, res) => {
  try {
    const result = await ingestDocuments();
    await audit.record({ userId: req.user._id, role: req.user.role, kind: 'ingest', inputMasked: JSON.stringify(result) });
    res.json(result);
  } catch (err) {
    console.error('[AI] ingest error:', err);
    res.status(500).json({ message: 'Ingestion failed: ' + err.message });
  }
};
