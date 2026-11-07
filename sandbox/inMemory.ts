import type { Sandbox } from './sandbox';
import { Sandbox as JbSandbox } from 'just-bash';

export class InMemorySandbox implements Sandbox {
  public readonly type: string = 'just-bash';
  public workingDirectory: string;
  private readonly jb: JbSandbox;
  private readonly MOUNT: string = '/home/user/project';

  private constructor(cwd: string, jb: JbSandbox) {
    this.workingDirectory = cwd;
    this.jb = jb;
  }

  static async make(cwd: string): Promise<Sandbox> {
    const jb = await JbSandbox.create({ overlayRoot: cwd });
    return new InMemorySandbox(cwd, jb);
  }

  async readFile(path: string) {
    const virtualPath = `${this.MOUNT}/${path}`;
    return this.jb.readFile(virtualPath);
  }

  async exec(command: string) {
    const cmd = await this.jb.runCommand(command, { cwd: this.MOUNT });
    const finished = await cmd.wait();
    return {
      stdout: await cmd.output(),
      exitCode: finished.exitCode,
    };
  }

  async stop() {
    return;
  }
}
