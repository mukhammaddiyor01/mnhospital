import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger(LoggingInterceptor.name);
	intercept(context: ExecutionContext, next: CallHandler) {
		if (context.getType<GqlContextType>() !== 'graphql') return next.handle();
		const field = GqlExecutionContext.create(context).getInfo().fieldName;
		const started = Date.now();
		// Log operation metadata only. Arguments/results include passwords, tokens and clinical data.
		this.logger.log(field, 'REQUEST');
		return next.handle().pipe(tap(() => this.logger.log(`${field} - ${Date.now() - started}ms`, 'RESPONSE')));
	}
}
