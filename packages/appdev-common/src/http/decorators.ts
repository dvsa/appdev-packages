import { performance } from "node:perf_hooks";
import type { Logger } from "@aws-lambda-powertools/logger";

export function LogDurationWithAccessor<T extends { logger: Logger }>(
	getLogger: (self: T) => Logger,
	label?: string,
) {
	return (
		_target: unknown,
		propertyKey: string,
		descriptor: PropertyDescriptor,
	) => {
		const originalMethod = descriptor.value;

		// biome-ignore lint/suspicious/noExplicitAny: "any" is correct for this context
		descriptor.value = function (...args: any[]) {
			const logger = getLogger(this as T);
			const labelToUse = label || propertyKey;

			const start = performance.now();

			try {
				const result = originalMethod.apply(this, args);

				// async route, if it's a Promise.
				if (result instanceof Promise) {
					return result
						.then((res) => {
							const duration = (performance.now() - start).toFixed(2);
							logger.info(`[${labelToUse}] took ${duration}ms`);
							return res;
						})
						.catch((err) => {
							const duration = (performance.now() - start).toFixed(2);
							logger.error(`[${labelToUse}] failed after ${duration}ms`);
							throw err;
						});
				}

				// Otherwise, sync method: log and return
				const duration = (performance.now() - start).toFixed(2);
				logger.info(`[${labelToUse}] took ${duration}ms`);
				return result;
			} catch (err) {
				const duration = (performance.now() - start).toFixed(2);
				logger.error(`[${labelToUse}] failed after ${duration}ms`);
				throw err;
			}
		};

		return descriptor;
	};
}

export function Timed<T extends { logger: Logger }>(label?: string) {
	return LogDurationWithAccessor((cls: T) => {
		if (!cls.logger) {
			throw new Error(`[${label}] Logger not found on decorated class.`);
		}
		return cls.logger;
	}, label);
}
