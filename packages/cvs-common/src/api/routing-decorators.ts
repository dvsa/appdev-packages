import { Get, Post, Put } from 'routing-controllers';

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

export function POST(route: RegExp) {
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
