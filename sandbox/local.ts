import { readFileSync } from 'node:fs';
import type { Sandbox } from './sandbox';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

export class LocalSandbox implements Sandbox {
  public readonly type: string = 'local';
  public workingDirectory: string;

  constructor(cwd: string) {
    this.workingDirectory = cwd;
  }

  public async readFile(path: string): Promise<string> {
    return readFileSync(resolve(this.workingDirectory, path), 'utf-8');
  }

  public async exec(command: string) {
    try {
      const stdout = execSync(command, { timeout: 30 * 1000, shell: 'powershell', encoding: 'utf-8' });
      return { stdout, exitCode: 0 };
    } catch (error: any) {
      return { stdout: error.stdout || error.stderr || error.messages || '', exitCode: error.status || 1 };
    }
  }

  public async stop() {
    return;
  }
}
