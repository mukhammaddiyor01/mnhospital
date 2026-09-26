import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArticleService } from './article.service';
import { ArticleResolver } from './article.resolver';
import ArticleSchema from './schema/Article.model';
import { AuthModule } from '../auth/auth.module';
import { DoctorModule } from '../doctor/doctor.module';
import { ViewModule } from '../view/view.module';

@Module({
	imports: [
		MongooseModule.forFeature([{ name: 'Article', schema: ArticleSchema }]),
		AuthModule,
		DoctorModule,
		ViewModule,
	],
	exports: [MongooseModule],
	providers: [ArticleService, ArticleResolver],
})
export class ArticleModule {}
