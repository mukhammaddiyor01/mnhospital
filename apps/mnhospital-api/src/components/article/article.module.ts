import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ArticleSchema from './schema/Article.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Article', schema: ArticleSchema }])],
	exports: [MongooseModule],
})
export class ArticleModule {}
