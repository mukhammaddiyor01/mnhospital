import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DoctorModule } from '../doctor/doctor.module';
import { ServiceModule } from '../service/service.module';
import { AiChatProvider } from './ai-chat.provider';
import { AiChatService } from './ai-chat.service';
import { AiChatResolver } from './ai-chat.resolver';

@Module({
	imports: [ConfigModule, HttpModule, DoctorModule, ServiceModule],
	providers: [AiChatProvider, AiChatService, AiChatResolver],
})
export class AiChatModule {}
