import { resolve } from "node:path";

import { createOpencode } from "@opencode-ai/sdk/v2";
import {
  createOpencodeClient,
  type OpencodeClient,
  type OpencodeClientConfig,
} from "@opencode-ai/sdk/v2/client";

type RuntimeServer = {
  url: string;
  close(): void;
};

type RuntimeInstance = {
  client: OpencodeClient;
  server: RuntimeServer;
};

type CreateOpencodeArgs = Parameters<typeof createOpencode>[0];

type RuntimeDependencies = {
  createOpencode: (options?: CreateOpencodeArgs) => Promise<RuntimeInstance>;
  createOpencodeClient: (config?: OpencodeClientConfig & { directory?: string }) => OpencodeClient;
};

export type OpenCodeRuntimeOptions = {
  hostname?: string;
  port?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  config?: CreateOpencodeArgs extends { config?: infer TConfig } ? TConfig : never;
};

const defaultDependencies: RuntimeDependencies = {
  createOpencode,
  createOpencodeClient,
};

export class OpenCodeRuntime {
  private readonly options: OpenCodeRuntimeOptions;
  private readonly dependencies: RuntimeDependencies;
  private runtime?: RuntimeInstance;
  private startPromise?: Promise<RuntimeInstance>;
  private readonly clientsByDirectory = new Map<string, OpencodeClient>();

  constructor(
    options: OpenCodeRuntimeOptions = {},
    dependencies: Partial<RuntimeDependencies> = {},
  ) {
    this.options = options;
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies,
    };
  }

  async start(): Promise<RuntimeInstance> {
    if (this.runtime) {
      return this.runtime;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.dependencies
      .createOpencode({
        hostname: this.options.hostname,
        port: this.options.port,
        signal: this.options.signal,
        timeout: this.options.timeoutMs,
        config: this.options.config,
      })
      .then((runtime) => {
        this.runtime = runtime;
        return runtime;
      })
      .finally(() => {
        this.startPromise = undefined;
      });

    return this.startPromise;
  }

  async stop(): Promise<void> {
    const runtime = this.runtime ?? (this.startPromise ? await this.startPromise : undefined);

    if (!runtime) {
      return;
    }

    runtime.server.close();
    this.runtime = undefined;
    this.clientsByDirectory.clear();
  }

  async restart(): Promise<RuntimeInstance> {
    await this.stop();
    return this.start();
  }

  isRunning(): boolean {
    return this.runtime !== undefined;
  }

  async getRootClient(): Promise<OpencodeClient> {
    const runtime = await this.start();
    return runtime.client;
  }

  async getServerUrl(): Promise<string> {
    const runtime = await this.start();
    return runtime.server.url;
  }

  async getClient(directory: string): Promise<OpencodeClient> {
    const normalizedDirectory = this.normalizeDirectory(directory);
    const cachedClient = this.clientsByDirectory.get(normalizedDirectory);

    if (cachedClient) {
      return cachedClient;
    }

    const runtime = await this.start();
    const client = this.dependencies.createOpencodeClient({
      baseUrl: runtime.server.url,
      directory: normalizedDirectory,
    });

    this.clientsByDirectory.set(normalizedDirectory, client);

    return client;
  }

  private normalizeDirectory(directory: string): string {
    const trimmedDirectory = directory.trim();

    if (!trimmedDirectory) {
      throw new Error("Directory is required to create a scoped OpenCode client.");
    }

    return resolve(trimmedDirectory);
  }
}
