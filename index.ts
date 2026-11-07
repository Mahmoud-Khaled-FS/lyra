import { ToolLoopAgent, pruneMessages, stepCountIs } from 'ai';
import { deepSeek } from '@ai-sdk/deepseek';
import { join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { buildSystemPrompt, type PromptContext } from './system';
import { createGrubTool, createReadTool, createShellTool } from './tools';
import { InMemorySandbox, LocalSandbox, type Sandbox } from './sandbox';

// TODO: Create better description (type and description builder) for each tool see (https://vercel.com/academy/build-ai-agent-harness/descriptions-that-work#hands-on-exercise-21)
const agentName = 'lyra';

const cwd = resolve(process.cwd());

const sandbox: Sandbox = await LocalSandbox.make(cwd);
console.log(`Sand box: ${sandbox.type}`);

const agentsPath = join(cwd, 'AGENT.md');
const projectContext = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf-8') : undefined;

const tools = {
  read: createReadTool(sandbox),
  shell: createShellTool(sandbox),
  grub: createGrubTool(sandbox),
};

const systemPromptContext: PromptContext = {
  agentName,
  sandboxType: 'local',
  toolNames: Object.keys(tools),
  workingDirectory: cwd,
  projectContext,
};

const agent = new ToolLoopAgent({
  model: deepSeek('deepseek-flash'),
  instructions: buildSystemPrompt(systemPromptContext),
  stopWhen: stepCountIs(15),
  tools,
  onStepEnd: (data) => {
    console.log(`Step (${data.stepNumber}) ${data.usage.inputTokens} input, ${data.usage.outputTokens} output`);
  },
  prepareStep: (data) => {
    return {
      messages: pruneMessages({ messages: data.messages, toolCalls: 'before-last-3-messages' }),
    };
  },
});

if (process.argv.length <= 2) {
  console.error('Usage: bun run index.ts <prompt>');
  process.exit(1);
}

const prompt = process.argv[2] as string;

const response = await agent.generate({ prompt: prompt });

console.log(response.text);
console.log(`Steps (${response.steps.length})`);
