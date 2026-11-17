// The agent: the "brain" loop.
//
//   user question
//      -> ask the model (with the tools this user's role may use)
//      -> model says "call tool X"  -> we run it through MCP -> send the result back
//      -> repeat until the model gives a final answer (or we hit the safety limit)
//
// PROMPT CACHING: providers cache the START of a prompt, so each request is ordered
// most-stable-first:
//     tools  ->  system prompt (never changes)  ->  user context  ->  conversation
// OpenAI models cache this prefix automatically (prompts over 1024 tokens). Anthropic models
// on OpenRouter need an explicit marker, which we add below.
const config = require('../config/ai.config');
const { SYSTEM_PROMPT, buildUserContext } = require('./prompts');
const { openMcpSession } = require('../mcp/client');

const emptyUsage = () => ({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 });

// Normalise the provider's usage numbers into our four counters.
function addUsage(total, u = {}) {
  const details = u.prompt_tokens_details || {};
  const cachedRead = details.cached_tokens || 0;
  const cachedWrite = details.cache_write_tokens || 0;
  total.inputTokens += Math.max(0, (u.prompt_tokens || 0) - cachedRead - cachedWrite);
  total.outputTokens += u.completion_tokens || 0;
  total.cacheReadTokens += cachedRead;
  total.cacheCreationTokens += cachedWrite;
}

function usesExplicitCacheMarker(model) {
  return config.caching.explicitMarkerPrefixes.some((p) => model.startsWith(p));
}

// The two system messages: the static rules first (cacheable), then per-user details.
function buildSystemMessages(ctx, model) {
  const staticPart = usesExplicitCacheMarker(model)
    ? { role: 'system', content: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] }
    : { role: 'system', content: SYSTEM_PROMPT };
  return [staticPart, { role: 'system', content: buildUserContext(ctx) }];
}

function parseArguments(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) { return null; }
}

// `deps` lets tests replace the model client and the MCP session with fakes.
async function runAgent({ ctx, history = [], userMessage, onEvent = () => {} }, deps = {}) {
  const client = deps.client || require('./llmClient').getLlmClient();
  const session = await (deps.openSession || openMcpSession)(ctx);
  const model = config.models.agent;

  const usage = emptyUsage();
  const toolCalls = [];
  const sources = new Set();
  const pendingActions = [];
  let reply = '';
  let stopReason = null;

  try {
    const tools = await session.listTools();
    const messages = [
      ...buildSystemMessages(ctx, model),
      ...history.slice(-config.agent.historyMessages).map((m) => ({ role: m.role, content: m.text })),
      { role: 'user', content: userMessage },
    ];

    for (let round = 0; round <= config.agent.maxToolRounds; round++) {
      onEvent({ type: 'status', message: round === 0 ? 'Thinking...' : 'Working on it...' });

      const response = await client.chat.completions.create({
        model,
        max_tokens: config.agent.maxTokens,
        temperature: config.agent.temperature,
        messages,
        ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
      });
      addUsage(usage, response.usage);

      const choice = response.choices && response.choices[0];
      if (!choice) throw new Error('The model returned no answer.');
      const message = choice.message;
      stopReason = choice.finish_reason;

      if (stopReason === 'content_filter') {
        reply = "I'm not able to help with that request.";
        break;
      }

      const requested = message.tool_calls || [];
      if (requested.length === 0) {
        reply = (message.content || '').trim();
        if (stopReason === 'length') reply += '\n\n(My answer was cut short. Ask me to continue if you need more.)';
        break;
      }

      if (round === config.agent.maxToolRounds) {
        reply = 'I used too many steps on this request. Please try a simpler question.';
        break;
      }

      // Keep the assistant turn (with its tool calls), then answer every call with a "tool" message.
      messages.push({ role: 'assistant', content: message.content || null, tool_calls: requested });

      const results = await Promise.all(requested.map(async (call) => {
        const name = call.function.name;
        onEvent({ type: 'tool', name });
        const args = parseArguments(call.function.arguments);
        if (!args) {
          toolCalls.push({ name, ok: false, kind: 'read' });
          return { role: 'tool', tool_call_id: call.id, content: 'The tool arguments were not valid JSON. Try again.' };
        }
        const result = await session.callTool(name, args);
        toolCalls.push({ name, ok: !result.isError, kind: result.pendingAction ? 'write' : 'read' });
        result.sources.forEach((s) => sources.add(s));
        if (result.pendingAction) pendingActions.push(result.pendingAction);
        return { role: 'tool', tool_call_id: call.id, content: result.text };
      }));
      messages.push(...results);
    }
  } finally {
    await session.close();
  }

  return { reply, pendingActions, toolCalls, usage, stopReason, sources: [...sources], model };
}

module.exports = { runAgent, buildSystemMessages, addUsage };
