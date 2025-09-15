import type { Context } from 'aws-lambda';

type Meta = Record<string, any>;

interface SimpleLogger {
  debug(message: string, meta?: Meta): void;

  info(message: string, meta?: Meta): void;

  warn(message: string, meta?: Meta): void;

  error(message: string, errorOrMeta?: Error | any, meta?: Meta): void;

  addContext(context: Context): void;

  appendKeys(keys: string[]): void;

  appendPersistentKeys(keys: Meta): void;

  removeKeys(keys: string[]): void;

  removePersistentKeys(keys: string[]): void;

  resetKeys(): void;

  createChild(options?: any): SimpleLogger;

  getLevelName(): string;

  setLogLevel(level: string): void;

  getPersistentLogAttributes(): Meta;

  logEventIfEnabled(event: Meta): void;
}

/**
 * Log helper to for local development with pretty-printed logs.
 * It also filters out AWS-specific fields that only have relevance when running in AWS Lambda.
 * @return A SimpleLogger instance.
 */
export const createPrettyLogger: () => SimpleLogger = (): SimpleLogger => {
  let persistentKeys: Meta = {};
  let temporaryKeys: Meta = {};
  let logLevel = 'DEBUG';

  const formatLog = (level: string, message: string, data?: Meta) => {
    const log: any = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    // Add persistent keys (but filter out AWS-specific ones in local dev)
    const filteredPersistentKeys = { ...persistentKeys };
    const filteredTemporaryKeys = { ...temporaryKeys };

    if (process.env.IS_OFFLINE === 'true') {
      const awsFields = [
        'awsRequestId',
        'callbackWaitsForEmptyEventLoop',
        'clientContext',
        'functionName',
        'functionVersion',
        'invokedFunctionArn',
        'logGroupName',
        'logStreamName',
        'memoryLimitInMB',
      ];

      awsFields.forEach((field) => {
        delete filteredPersistentKeys[field];
        delete filteredTemporaryKeys[field];
      });
    }

    Object.assign(log, filteredPersistentKeys, filteredTemporaryKeys);

    if (data) {
      if (data instanceof Error) {
        log.error = {
          name: data.name,
          message: data.message,
          stack: data.stack?.split('\n').map((line: string) => line.trim()),
          // @ts-ignore
          ...(data.cause && { cause: data.cause }),
        };
      } else {
        const processedData = { ...data };

        Object.keys(processedData).forEach((key) => {
          if (processedData[key] instanceof Error) {
            processedData[key] = {
              name: processedData[key].name,
              message: processedData[key].message,
              stack: processedData[key].stack?.split('\n').map((line: string) => line.trim()),
              // @ts-ignore
              ...(processedData[key].cause && { cause: processedData[key].cause }),
            };
          }
        });

        Object.assign(log, processedData);

        console.log(JSON.stringify(log, null, 2));
        return;
      }
    }

    console.log(JSON.stringify(log));
  };

  return {
    debug: (message: string, meta?: Meta) => formatLog('DEBUG', message, meta),
    info: (message: string, meta?: Meta) => formatLog('INFO', message, meta),
    warn: (message: string, meta?: Meta) => formatLog('WARN', message, meta),
    error: (message: string, errorOrMeta?: Error | any, meta?: Meta) => {
      if (errorOrMeta instanceof Error) {
        const combinedMeta = meta ? { ...meta, error: errorOrMeta } : errorOrMeta;
        formatLog('ERROR', message, combinedMeta);
      } else {
        formatLog('ERROR', message, errorOrMeta);
      }
    },
    addContext: (context: Meta) => {
      if (context) {
        temporaryKeys = { ...temporaryKeys, ...context };
      }
    },
    appendKeys: (keys: string[]) => {
      temporaryKeys = { ...temporaryKeys, ...keys };
    },
    appendPersistentKeys: (keys: string[]) => {
      persistentKeys = { ...persistentKeys, ...keys };
    },
    removeKeys: (keys: string[]) => {
      keys.forEach((key) => delete temporaryKeys[key]);
    },
    removePersistentKeys: (keys: string[]) => {
      keys.forEach((key) => delete persistentKeys[key]);
    },
    resetKeys: () => {
      temporaryKeys = {};
    },
    createChild: (_options?: any) => {
      const child = createPrettyLogger();
      child.appendPersistentKeys(persistentKeys);
      return child;
    },
    getLevelName: () => logLevel,
    setLogLevel: (level: string) => {
      logLevel = level;
    },
    getPersistentLogAttributes: () => ({ ...persistentKeys }),
    logEventIfEnabled: (event: Meta) => {
      if (logLevel === 'DEBUG') {
        formatLog('DEBUG', 'Lambda invocation event', { event });
      }
    },
  };
};
