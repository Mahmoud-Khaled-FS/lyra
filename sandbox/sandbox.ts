export interface Sandbox {
  type: string,
  workingDirectory: string,
  expiresAt?: number;

  readFile(path: string): Promise<string>;
  exec(command: string): Promise<{stdout: string, exitCode: number}>;
  stop(): Promise<void>;
  snapshot?(): Promise<{snapshotId: string}>;
}