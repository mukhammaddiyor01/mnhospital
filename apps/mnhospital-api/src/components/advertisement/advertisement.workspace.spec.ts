import { AdvertisementService } from './advertisement.service';
import { AdvertisementStatus } from './enums/advertisement.enum';

describe('Advertisement workspace', () => {
 it('keeps public lists published while allowing admin draft and archive inspection', async () => {
  const aggregate = jest.fn((_pipeline: any) => ({ exec: jest.fn().mockResolvedValue([{ list: [], metaCounter: [] }]) }));
  const service = new AdvertisementService({ aggregate } as any);
  await service.getAdvertisements({ page: 1, limit: 10 });
  expect(aggregate.mock.calls[0][0][0]).toEqual({ $match: { advertisementStatus: AdvertisementStatus.PUBLISHED } });
  await service.getAdvertisementsByAdmin({ page: 1, limit: 10 });
  expect(aggregate.mock.calls[1][0][0]).toEqual({ $match: {} });
 });
});
