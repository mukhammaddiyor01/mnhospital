import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createInputValidationPipe } from './libs/input-validation';
import { WsAdapter } from '@nestjs/platform-ws';
import { LoggingInterceptor } from './libs/interceptor/Logging.interceptor';
import { graphqlUploadExpress } from 'graphql-upload';
import * as express from 'express';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.useWebSocketAdapter(new WsAdapter(app));
	app.useGlobalPipes(createInputValidationPipe());
	app.useGlobalInterceptors(new LoggingInterceptor());
	app.enableCors({ origin: true, credentials: true });
	app.use(express.urlencoded({ extended: true }));
	app.use(graphqlUploadExpress({ maxfileSize: 150000000, maxFiles: 10 }));
	app.use('/uploads', express.static('./uploads'));
	await app.listen(process.env.PORT_API ?? 3011);
}
bootstrap();
