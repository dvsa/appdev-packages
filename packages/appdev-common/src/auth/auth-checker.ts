import type { Request } from "express";
import type { Action } from "routing-controllers";
import type { APIGatewayModel } from "../api/api-gateway-model";
import { HttpStatus } from "../api/http-status-codes";
import { AuthError } from "./auth-errors";
import { JwtAuthoriser } from "./verify-jwt";

export type RoutingControllersRequest = Request & {
	apiGateway: APIGatewayModel;
};

// biome-ignore lint/complexity/noStaticOnlyClass: this class will be extended in the future
export class JWTAuthChecker {
	/**
	 * Perform a JWT token verification and role check
	 * @param {RoutingControllersRequest} request
	 * @param roles
	 */
	static async execute(
		{ request }: Action,
		roles: string | string[] = [],
	): Promise<boolean> {
		// if running locally, skip the token auth and role check
		if (
			process.env.IS_OFFLINE === "true" &&
			process.env.FORCE_LOCAL_AUTH !== "true"
		)
			return true;

		// extract the token from the request headers
		const headers = (request as RoutingControllersRequest)?.apiGateway.event
			.headers;
		const token = headers?.Authorization || headers?.authorization;

		// if no token is found, then deny access to resource
		if (!token || token.trim()?.length === 0) {
			throw new AuthError(
				HttpStatus.UNAUTHORIZED,
				"Missing Authorization header",
			);
		}

		// create an instance of the JwtAuthoriser class
		const authoriser = new JwtAuthoriser();

		// Validate the token and extract the roles from it
		const { roles: tokenRoles } = await authoriser.verify(token);

		// check if a singular or list of roles were passed into the @Authorized decorator & remove nullish values
		const requiredRoles = (Array.isArray(roles) ? roles : [roles]).filter(
			(role) => !!role,
		);

		// if there are no requiredRoles, then any valid token can access the resource, so return true
		if (requiredRoles.length === 0) return true;

		// if there are no roles in JWT token but roles are required, then deny access
		if (!tokenRoles || !Array.isArray(tokenRoles) || tokenRoles.length === 0) {
			throw new AuthError(
				HttpStatus.UNAUTHORIZED,
				"No roles found in token",
				"MISSING_ROLES",
			);
		}

		// check if one of the required roles is present in JWT token
		const success = requiredRoles.some((role) => tokenRoles.includes(role));

		if (!success) {
			throw new AuthError(
				HttpStatus.UNAUTHORIZED,
				"Insufficient permissions",
				"UNAUTHORIZED",
				{
					required: requiredRoles,
					actual: tokenRoles,
				},
			);
		}

		return true;
	}
}
