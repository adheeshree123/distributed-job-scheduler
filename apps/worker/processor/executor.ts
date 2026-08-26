export interface JobExecutionInput {
  jobId: string;
  attemptNumber: number;
  type: string;
  payload: Record<string, unknown>;
}

export interface JobExecutionOutput {
  success: boolean;
  result?: Record<string, unknown>;
  errorMessage?: string;
}

export type JobHandler = (
  input: JobExecutionInput
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export class JobExecutor {
  private static handlers = new Map<string, JobHandler>();

  static {
    // Register standard deterministic demo job handlers
    this.registerHandler('echo', async (input) => {
      return {
        echoed: input.payload,
        executedAt: new Date().toISOString(),
        attempt: input.attemptNumber,
      };
    });

    this.registerHandler('sleep', async (input) => {
      const durationMs = Number(input.payload.durationMs || 100);
      await new Promise((resolve) => setTimeout(resolve, durationMs));
      return {
        sleptMs: durationMs,
        completedAt: new Date().toISOString(),
      };
    });

    this.registerHandler('success', async (input) => {
      return {
        success: true,
        message: (input.payload.message as string) || 'Job executed successfully',
        timestamp: Date.now(),
      };
    });

    this.registerHandler('fail', async (input) => {
      const message = (input.payload.message as string) || (input.payload.error as string) || 'Intentional job failure';
      throw new Error(message);
    });

    this.registerHandler('fail-once', async (input) => {
      if (input.attemptNumber <= 1) {
        throw new Error('Intentional failure on attempt 1 (fail-once)');
      }
      return {
        success: true,
        succeededOnAttempt: input.attemptNumber,
        message: 'Recovered on attempt 2',
      };
    });

    this.registerHandler('fail-n-times', async (input) => {
      const failuresBeforeSuccess = Number(input.payload.failuresBeforeSuccess ?? 2);
      if (input.attemptNumber <= failuresBeforeSuccess) {
        throw new Error(
          `Intentional failure on attempt ${input.attemptNumber}/${failuresBeforeSuccess} (fail-n-times)`
        );
      }
      return {
        success: true,
        succeededOnAttempt: input.attemptNumber,
        failuresBeforeSuccess,
      };
    });
  }

  public static registerHandler(name: string, handler: JobHandler): void {
    this.handlers.set(name.toLowerCase(), handler);
  }

  public static async execute(input: JobExecutionInput): Promise<JobExecutionOutput> {
    try {
      // Look up handler by payload.type, payload.action, or fallback to input.type / default
      const handlerKey = (
        (input.payload.type as string) ||
        (input.payload.action as string) ||
        input.type ||
        'echo'
      ).toLowerCase();

      const handler = this.handlers.get(handlerKey) || this.handlers.get('echo')!;

      const result = await handler(input);
      return {
        success: true,
        result: result || { success: true },
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        errorMessage,
      };
    }
  }
}
