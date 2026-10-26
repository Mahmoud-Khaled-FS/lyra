import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { deepSeek } from "@ai-sdk/deepseek"
import { z } from 'zod';
import path, { resolve } from "node:path";
import { readFileSync } from 'node:fs';
import { isBindingPattern } from 'typescript/unstable/ast';
import { execSync } from 'node:child_process';

// TODO: split code to multiple files
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

const grepTool = tool({
  description: `Search file contents using regex. Returns matching lines with fire paths.
WHEN TO USE: finding patterns across multiple files, locations functions definitions, search for imports, finding TODOs or error messages.
WHEN NOT TO USE: reading a known file (use read instead).
DO NOT USE FOR: running commands, listing directories.
EXAMPLES:
  - Find all TODO comments: pattern "TODO" glop "*.ts"
  - Find function definitions: pattern "function \\\\w+" glob "*.ts"`,
  inputSchema: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().optional().describe("Directory to search (default: working dir)"),
    glob: z.string().optional().describe("File glob filter, e.g. '*.ts'"),
  }
  ),
  execute: async (payload) => {
    const dir = resolve(cwd, payload.path || '.');
    const escapedPattern = payload.pattern.replace(/'/g, `'\\''`);
    const escapedGlob = (payload.glob || '*').replace(/'/g, `'\\''`);
    // const cmd = `grep -rn --exclude-dir=node_module --exclude-dir=.git --include='${escapedGlob}' -E ${escapedPattern} '${dir}' 2>/dev/null`;
    const psQuote = (value: string) => `'${value.replace(/'/g, "''")}'`;

    const cmd = `Get-ChildItem -LiteralPath ${psQuote(dir)} -Recurse -File |
      Where-Object {
        $_.FullName -notmatch '[\\\\/](node_modules|\\.git)[\\\\/]' -and
        $_.Name -like ${psQuote((payload.glob || '*').replace(/\*\*/g, '*'))}
      } |
      Select-String -Pattern ${psQuote(payload.pattern)} |
      ForEach-Object {
        "$($_.Path):$($_.LineNumber):$($_.Line.Trim())"
      }`;

    try {
      const stdout = execSync(cmd, { encoding: "utf-8", timeout: 10 * 1000, shell: "powershell.exe" })
      const lines = stdout.trim().split("\\n").filter(Boolean);

      const MAX_MATCHES = 50;
      const shouldTruncate = lines.length > MAX_MATCHES;
      const result = shouldTruncate ? lines.slice(0, MAX_MATCHES) : lines;
      return shouldTruncate ? result.join("\\n") + `\\n... (${lines.length}) total, showing first ${MAX_MATCHES}` : result.join("\\n")
      
    } catch(err: any) {
      const stdout = String(err.stdout || "").trim();
      if (stdout) {
        const lines = stdout.split("\\n").filter(Boolean);
        const MAX_MATCHES = 50;
        const shouldTruncate = lines.length > MAX_MATCHES;
        const result = shouldTruncate ? lines.slice(0, MAX_MATCHES) : lines;
        return shouldTruncate ? result.join("\\n") + `\\n... (${lines.length}) total, showing first ${MAX_MATCHES}` : result.join("\\n")
      }
    }
  }
})

const agent = new ToolLoopAgent({
  model: deepSeek('deepseek-flash'),
  instructions: `You are a helpful assistant.\nYour name is ${AiModelName}`,
  stopWhen: stepCountIs(10),
  tools: {
    read: readTool,
    grep: grepTool
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