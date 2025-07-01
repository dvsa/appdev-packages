import { performance } from "node:perf_hooks";
import type { Logger } from "@aws-lambda-powertools/logger";

/**
 * Decorator to log the duration of a method execution by passing in an accessor function to retrieve the logger.
 * @param getLogger - A function that takes the class instance and returns the logger instance.
 * @param {string} label - Optional label for the log message.
 *
 * Note: If you are already using a logger as a class property, you can use the `Timed` decorator instead.
 *
 * @constructor
 *
 * Example usage:
 * class MyClass {
 *  @TimedWithAccessor(() => Container.get(LOGGER))
 * 	async findAll() {} // The log name here will be [findAll]
 * }
 */
export function TimedWithAccessor<T extends { logger: Logger }>(
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
							logger.debug(`[${labelToUse}] took ${duration}ms`);
							return res;
						})
						.catch((err) => {
							const duration = (performance.now() - start).toFixed(2);
							logger.debug(`[${labelToUse}] failed after ${duration}ms`);
							throw err;
						});
				}

				// Otherwise, sync method: log and return
				const duration = (performance.now() - start).toFixed(2);
				logger.debug(`[${labelToUse}] took ${duration}ms`);
				return result;
			} catch (err) {
				const duration = (performance.now() - start).toFixed(2);
				logger.debug(`[${labelToUse}] failed after ${duration}ms`);
				throw err;
			}
		};

		return descriptor;
	};
}

/**
 * Decorator to log the duration of a method execution.
 * @param {string} label - Optional label for the log message.
 *
 * Note: This decorator can be used on any class method that has a `logger` property.
 * This method will throw an error if the `logger` property is not found on the class instance.
 * If you are not using logger as a class property, you can use `LogDurationWithAccessor` instead.
 * @constructor
 *
 * Example usage:
 * class MyClass {
 * 	private readonly logger = Container.get(Logger);
 *
 * 	@Timed()
 * 	myMethod() {} // The log name here will be [myMethod]
 *
 * 	@Timed('MyClass.myMethod')
 * 	myMethodWithOptName() {} // The log name here will be [MyClass.myMethod]
 * }
 */
export function Timed<T extends { logger: Logger }>(label?: string) {
	return TimedWithAccessor((cls: T) => {
		if (!cls.logger) {
			throw new Error(`[${label}] Logger not found on decorated class.`);
		}
		return cls.logger;
	}, label);
}
