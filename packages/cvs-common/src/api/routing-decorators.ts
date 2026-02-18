import { Get, Patch, Post, Put } from 'routing-controllers';

/**
 * Decorator to apply a GET route to a controller method
 * @param {string} route
 * @constructor
 */
export function GET(route: string) {
	return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
		// Apply the route
		Get(route)(target, propertyKey, descriptor);

		// Additionally, apply the route with the branch name
		if (process.env.BRANCH) {
			Get(`/${process.env.BRANCH}${route}`)(target, propertyKey, descriptor);
		}

		return descriptor;
	};
}

/**
 * Decorator to apply a POST route to a controller method
 * @param {string} route
 * @constructor
 */
export function POST(route: string) {
	return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
		// Apply the route
		Post(route)(target, propertyKey, descriptor);

		// Additionally, apply the route with the branch name
		if (process.env.BRANCH) {
			Post(`/${process.env.BRANCH}${route}`)(target, propertyKey, descriptor);
		}

		return descriptor;
	};
}

/**
 * Decorator to apply a PUT route to a controller method
 * @param {string} route
 * @constructor
 */
export function PUT(route: string) {
	return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
		// Apply the route
		Put(route)(target, propertyKey, descriptor);

		// Additionally, apply the route with the branch name
		if (process.env.BRANCH) {
			Put(`/${process.env.BRANCH}${route}`)(target, propertyKey, descriptor);
		}

		return descriptor;
	};
}

/**
 * Decorator to apply a PATCH route to a controller method
 * @param {string} route
 * @constructor
 */
export function PATCH(route: string) {
	return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
		// Apply the route
		Patch(route)(target, propertyKey, descriptor);

		// Additionally, apply the route with the branch name
		if (process.env.BRANCH) {
			Patch(`/${process.env.BRANCH}${route}`)(target, propertyKey, descriptor);
		}

		return descriptor;
	};
}
