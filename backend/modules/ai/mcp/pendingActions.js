// Human-in-the-loop for WRITE actions.
//  1. The AI asks for a write tool        -> proposeAction() saves a "pending action"
//  2. The UI shows a Confirm button        -> the human decides
//  3. POST /api/ai/confirm                 -> confirmAction() runs the tool
// The model can never confirm by itself: the confirm step is a separate HTTP call
// that needs the user's own login token.
const AiPendingAction = require('../models/AiPendingAction');
const config = require('../config/ai.config');
const { getTool } = require('./tools');
const { ToolError } = require('./tools/toolError');
const { canUseTool } = require('../guardrails/rbacPolicy');

async function proposeAction(tool, args, ctx) {
  const prepared = await tool.prepare(args, ctx); // validates and builds the summary
  const action = await AiPendingAction.create({
    userId: ctx.userId,
    tool: tool.name,
    args: prepared.args,
    summary: prepared.summary,
    expiresAt: new Date(Date.now() + config.guardrails.pendingActionMinutes * 60000),
  });
  return {
    status: 'awaiting_user_confirmation',
    actionId: String(action._id),
    summary: prepared.summary,
    instruction: 'Nothing has happened yet. Tell the user what you prepared and ask them to press the Confirm button in the chat.',
  };
}

// ctx = { userId, role } taken from the logged-in user making THIS request.
async function confirmAction(actionId, decision, ctx) {
  const action = await AiPendingAction.findOne({ _id: actionId, userId: ctx.userId }); // must be your own action
  if (!action) throw new ToolError('This action was not found.');
  if (action.status !== 'pending') throw new ToolError(`This action was already ${action.status}.`);
  if (action.expiresAt < new Date()) throw new ToolError('This action has expired. Please ask again.');

  if (decision === 'cancel') {
    action.status = 'cancelled';
    await action.save();
    return { status: 'cancelled', message: 'Okay, I cancelled that. Nothing was changed.', tool: action.tool };
  }

  const tool = getTool(action.tool);
  if (!tool || tool.kind !== 'write') throw new ToolError('Unknown action.');
  if (!canUseTool(ctx.role, tool)) throw new ToolError('Your role is not allowed to do this.'); // role may have changed

  // mark as executed first: pressing Confirm twice can never run it twice
  const claimed = await AiPendingAction.findOneAndUpdate({ _id: action._id, status: 'pending' }, { status: 'executed' });
  if (!claimed) throw new ToolError('This action was already handled.');

  try {
    const message = await tool.execute(action.args, { ...ctx, pendingId: String(action._id) });
    action.status = 'executed';
    action.resultMessage = message;
    await action.save();
    return { status: 'executed', message, tool: action.tool };
  } catch (err) {
    action.status = 'failed';
    action.resultMessage = err instanceof ToolError ? err.message : 'Unexpected error';
    await action.save();
    if (err instanceof ToolError) throw err;
    console.error('[AI] confirmed action failed:', err);
    throw new ToolError('Something went wrong while performing the action.');
  }
}

module.exports = { proposeAction, confirmAction };
