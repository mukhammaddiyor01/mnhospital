import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ConversationType, MemberType } from '../member/enums/member.enum';
import { MessagingService } from './messaging.service';

const profileQuery = (value: Record<string, unknown> | null) => ({ select: () => ({ lean: () => ({ exec: async () => value }) }) });
const conversationQuery = (value: unknown) => ({ exec: async () => value });

describe('Messaging ownership', () => {
	const patientId = new Types.ObjectId();
	const doctorId = new Types.ObjectId();
	const outsiderId = new Types.ObjectId();
	const conversationId = new Types.ObjectId();
	const actor = { _id: patientId, memberType: MemberType.PATIENT };

	const models = () => {
		const conversationModel = { findOneAndUpdate: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() };
		const memberModel = { findOne: jest.fn().mockReturnValue(profileQuery({ memberNick: 'patient' })) };
		const doctorModel = { findOne: jest.fn().mockReturnValue(profileQuery({ docNick: 'doctor' })) };
		const receptionistModel = { findOne: jest.fn() };
		const adminModel = { findById: jest.fn() };
		const service = new MessagingService(
			conversationModel as any,
			memberModel as any,
			doctorModel as any,
			receptionistModel as any,
			adminModel as any,
		);
		return { service, conversationModel, memberModel, doctorModel };
	};

	it('uses one canonical key for a patient and doctor regardless of who starts the chat', async () => {
		const { service, conversationModel } = models();
		conversationModel.findOneAndUpdate.mockReturnValue(conversationQuery({ _id: conversationId }));
		await service.startDirectConversation(actor, { targetType: MemberType.DOCTOR, targetId: doctorId.toString() });
		const update = conversationModel.findOneAndUpdate.mock.calls[0];
		expect(update[0]).toEqual({
			conversationType: ConversationType.DIRECT,
			directKey: [`DOCTOR:${doctorId}`, `PATIENT:${patientId}`].sort().join('|'),
		});
		expect(update[1].$setOnInsert.participantKeys).toEqual([`DOCTOR:${doctorId}`, `PATIENT:${patientId}`].sort());
	});

	it('does not allow patient-to-patient direct messaging', async () => {
		const { service, conversationModel } = models();
		await expect(service.startDirectConversation(actor, { targetType: MemberType.PATIENT, targetId: outsiderId.toString() }))
			.rejects.toBeInstanceOf(BadRequestException);
		expect(conversationModel.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it('scopes a conversation lookup to the authenticated participant', async () => {
		const { service, conversationModel } = models();
		conversationModel.findOne.mockReturnValue(conversationQuery(null));
		await expect(service.getMyConversation(actor, conversationId)).rejects.toBeInstanceOf(NotFoundException);
		expect(conversationModel.findOne).toHaveBeenCalledWith({
			_id: conversationId,
			conversationType: ConversationType.DIRECT,
			participantKeys: `PATIENT:${patientId}`,
		});
	});

});
