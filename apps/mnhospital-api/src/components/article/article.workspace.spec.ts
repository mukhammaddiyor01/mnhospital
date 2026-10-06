import 'reflect-metadata';
import { Types } from 'mongoose';
import { ArticleService } from './article.service';
import { ArticleResolver } from './article.resolver';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { ArticleStatus } from './enums/article.enum';

describe('Doctor article workspace', () => {
 it('scopes all statuses to the verified doctor and ignores supplied owner filters', async () => {
  const owner = new Types.ObjectId();
  const aggregate = jest.fn((_pipeline: any) => ({ exec: jest.fn().mockResolvedValue([{ list: [], metaCounter: [] }]) }));
  const service = new ArticleService({ aggregate } as any, {} as any, {} as any, {} as any);
  await service.getMyArticles(owner, { page: 2, limit: 10, search: { memberId: new Types.ObjectId(), articleStatus: ArticleStatus.DRAFT } });
  expect(aggregate.mock.calls[0][0][0]).toEqual({ $match: { memberId: owner, articleStatus: ArticleStatus.DRAFT } });
  expect(aggregate.mock.calls[0][0][2].$facet.list).toEqual([{ $skip: 10 }, { $limit: 10 }]);
 });
 it('keeps the owner condition in update and archive mutations', async () => {
  const owner = new Types.ObjectId(); const id = new Types.ObjectId();
  const update = jest.fn((_filter: any, _update?: any, _options?: any) => ({ exec: jest.fn().mockResolvedValue(null) }));
  const service = new ArticleService({ findOneAndUpdate: update } as any, {} as any, {} as any, {} as any);
  await expect(service.updateArticle(owner, { _id: id, articleStatus: ArticleStatus.ARCHIVED })).rejects.toThrow();
  expect(update.mock.calls[0][0]).toMatchObject({ _id: id, memberId: owner });
 });
 it('requires the doctor role for creation, editing and owner listing', () => {
  for (const method of ['createArticle', 'updateArticle', 'getMyArticles']) {
   expect(Reflect.getMetadata('__guards__', ArticleResolver.prototype[method])).toContain(RolesGuard);
   expect(Reflect.getMetadata('roles', ArticleResolver.prototype[method])).toEqual([MemberType.DOCTOR]);
  }
 });
});
