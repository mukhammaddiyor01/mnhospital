import { NestFactory } from '@nestjs/core';
import { MnhospitalBatchModule } from './mnhospital-batch.module';

async function bootstrap() {
  const app = await NestFactory.create(MnhospitalBatchModule);
  await app.listen(process.env.PORT_BATCH ?? 3012);
}
bootstrap();
