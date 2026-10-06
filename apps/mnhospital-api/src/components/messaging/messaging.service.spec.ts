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
		const messageModel = { create: jest.fn(), exists: jest.fn(), updateMany: jest.fn() };
		const memberModel = { findOne: jest.fn().mockReturnValue(profileQuery({ memberNick: 'patient' })) };
		const doctorModel = { findOne: jest.fn().mockReturnValue(profileQuery({ docNick: 'doctor' })) };
		const receptionistModel = { findOne: jest.fn() };
		const adminModel = { findById: jest.fn() };
		const notificationEvents = { toRecipient: jest.fn().mockResolvedValue(undefined) };
		const messagingEvents = { publishMessageCreated: jest.fn() };
		const service = new MessagingService(
			conversationModel as any,
			messageModel as any,
			memberModel as any,
			doctorModel as any,
			receptionistModel as any,
			adminModel as any,
			notificationEvents as any,
			messagingEvents as any,
		);
		return { service, conversationModel, messageModel, memberModel, doctorModel, notificationEvents, messagingEvents };
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

	it('rejects a reply to a message outside the conversation', async () => {
		const { service, conversationModel, messageModel } = models();
		conversationModel.findOne.mockReturnValue(conversationQuery({ _id: conversationId }));
		messageModel.exists.mockResolvedValue(null);
		await expect(service.sendDirectMessage(actor, conversationId, {
			messageContent: 'Hello',
			replyToMessageId: outsiderId.toString(),
		})).rejects.toBeInstanceOf(BadRequestException);
		expect(messageModel.exists).toHaveBeenCalledWith(expect.objectContaining({ conversationId }));
		expect(messageModel.create).not.toHaveBeenCalled();
	});

	it('writes the verified sender identity and updates the conversation timestamp', async () => {
		const { service, conversationModel, messageModel, notificationEvents, messagingEvents } = models();
		const createdAt = new Date();
		conversationModel.findOne.mockReturnValue(conversationQuery({
			_id: conversationId,
			participants: [
				{ participantId: patientId, participantType: MemberType.PATIENT },
				{ participantId: doctorId, participantType: MemberType.DOCTOR },
			],
		}));
		conversationModel.updateOne.mockReturnValue(conversationQuery({ modifiedCount: 1 }));
		messageModel.create.mockResolvedValue({ _id: new Types.ObjectId(), createdAt });
		await service.sendDirectMessage(actor, conversationId, { messageContent: '  Hello doctor  ' });
		expect(messageModel.create).toHaveBeenCalledWith(expect.objectContaining({
			conversationId,
			senderId: patientId,
			senderType: MemberType.PATIENT,
			messageContent: 'Hello doctor',
		}));
		expect(conversationModel.updateOne).toHaveBeenCalledWith({ _id: conversationId }, { $set: { lastMessageAt: createdAt } });
		expect(messagingEvents.publishMessageCreated).toHaveBeenCalledWith(expect.objectContaining({
			conversationId,
			participants: expect.arrayContaining([expect.objectContaining({ participantId: doctorId })]),
		}));
		expect(notificationEvents.toRecipient).toHaveBeenCalledWith(
			doctorId,
			MemberType.DOCTOR,
			expect.objectContaining({ refId: conversationId, authorId: patientId, authorType: MemberType.PATIENT }),
		);
	});

	it('marks only the other participant’s messages as read', async () => {
		const { service, conversationModel, messageModel } = models();
		conversationModel.findOne.mockReturnValue(conversationQuery({
			_id: conversationId,
			participants: [
				{ participantId: patientId, participantType: MemberType.PATIENT },
				{ participantId: doctorId, participantType: MemberType.DOCTOR },
			],
		}));
		messageModel.updateMany.mockReturnValue(conversationQuery({ modifiedCount: 2 }));
		expect(await service.markMyMessagesRead(actor, conversationId)).toBe(2);
		expect(messageModel.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({ senderId: doctorId, senderType: MemberType.DOCTOR }),
			expect.objectContaining({ $set: { readAt: expect.any(Date) } }),
		);
	});
});
