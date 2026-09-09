import { Test, TestingModule } from '@nestjs/testing';
import { MnhospitalBatchController } from './mnhospital-batch.controller';
import { MnhospitalBatchService } from './mnhospital-batch.service';

describe('MnhospitalBatchController', () => {
  let mnhospitalBatchController: MnhospitalBatchController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MnhospitalBatchController],
      providers: [MnhospitalBatchService],
    }).compile();

    mnhospitalBatchController = app.get<MnhospitalBatchController>(MnhospitalBatchController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(mnhospitalBatchController.getHello()).toBe('Hello World!');
    });
  });
});
