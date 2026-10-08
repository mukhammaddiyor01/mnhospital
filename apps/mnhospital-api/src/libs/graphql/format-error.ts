import { GraphQLFormattedError } from 'graphql';

export function formatGraphQLError(error: GraphQLFormattedError): { code: unknown; message: string } {
	const extensions = error.extensions;
	const exception = extensions?.exception as { response?: { message?: unknown } } | undefined;
	const response = extensions?.response as { message?: unknown } | undefined;
	const originalError = extensions?.originalError as { message?: unknown } | undefined;
	const detail = originalError?.message ?? exception?.response?.message ?? response?.message;
	const messages = Array.isArray(detail) ? detail.filter((value): value is string => typeof value === 'string') : [];
	const message = typeof detail === 'string' ? detail : messages.length ? messages.join('; ') : error.message;
	return { code: extensions?.code, message };
}
