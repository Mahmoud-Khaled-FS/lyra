import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { deepSeek } from "@ai-sdk/deepseek"
import { z } from 'zod';
import path, { resolve } from "node:path";
import { readFileSync } from 'node:fs';

const AiModelName = 'lyra';

const cwd = resolve(process.cwd());

const readTool = tool({
  description: `Read a file from the filesystem. Returns numbered lines.
WHEN TO USE: viewing file contents, checking config, reading source code.
WHEN NOT TO USE: searching across files. (use grep instead).`,
  inputSchema: z.object({
    path: z.string().describe("File path relative to working directory"),
    offset: z.number().optional().describe("Start line (1-indexed)"),
    limit: z.number().optional().describe("Max lines to return (MAX: 500)")
  }),
  execute: async (payload) => {
    const abs = resolve(cwd, payload.path);
    const content = readFileSync(abs, "utf-8");
    let lines = content.split("\n");

    if (payload.offset) lines = lines.slice(payload.offset - 1);
    if (payload.limit) lines = lines.slice(0, payload.limit);

    const MAX_LINES = 500;
    const shouldTruncate = lines.length > MAX_LINES;
    if (shouldTruncate) lines = lines.slice(0, MAX_LINES);

    const numbered = lines.map((l, i) => `${(payload.offset || 1) + i}: ${l}`);
    return shouldTruncate ? numbered.join("\n") + `\n... (truncated) at ${MAX_LINES} lines` : numbered.join('\n');
  }
});

const agent = new ToolLoopAgent({
  model: deepSeek('deepseek-flash'),
  instructions: `You are a helpful assistant.\nYour name is ${AiModelName}`,
  stopWhen: stepCountIs(10),
  tools: {
    read: readTool
  }
});

if (process.argv.length <= 2) {
  console.error("Usage: bun run index.ts <prompt>");
  process.exit(1);
}

const prompt = process.argv[2] as string;

const response = await agent.generate({ prompt: prompt });

console.log(response.text);
console.log(`Steps (${response.steps.length})`);