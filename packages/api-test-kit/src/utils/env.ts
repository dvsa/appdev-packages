export function requiredEnv(name: string): string {
	const value = process.env[name];

	if (!value) {
		throw new Error(`${name} is required for integration tests`);
	}

	return value;
}

export function optionalEnv(name: string): string {
	return process.env[name] ?? '';
}

export function stripTrailingSlash(value: string): string {
	return value.replace(/\/$/, '');
}
