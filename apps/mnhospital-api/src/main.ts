import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createInputValidationPipe } from './libs/input-validation';
import { WsAdapter } from '@nestjs/platform-ws';
import { LoggingInterceptor } from './libs/interceptor/Logging.interceptor';
import { graphqlUploadExpress } from 'graphql-upload';
import * as express from 'express';
import { isAllowedBrowserOrigin } from './libs/security/allowed-origins';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.useWebSocketAdapter(new WsAdapter(app));
	app.useGlobalPipes(createInputValidationPipe());
	app.useGlobalInterceptors(new LoggingInterceptor());
	app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
		res.setHeader('X-Content-Type-Options', 'nosniff');
		if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
		next();
	});
	app.enableCors({
		origin: (origin, callback) => callback(null, isAllowedBrowserOrigin(origin)),
		credentials: true,
	});
	app.use(express.urlencoded({ extended: true }));
	app.use(graphqlUploadExpress({ maxfileSize: 5 * 1024 * 1024, maxFiles: 10 }));
	app.use('/uploads', express.static('./uploads'));
	await app.listen(process.env.PORT_API ?? 3011);
}
bootstrap();
