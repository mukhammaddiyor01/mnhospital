import { NotificationService } from '../notification/notification.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConversationType, MemberStatus, MemberType } from '../member/enums/member.enum';
import { ChatConversation, ChatConversations, ChatMessage, ChatMessages, ChatParticipant } from './dto/messaging';
import { ChatInquiry, SendDirectMessageInput, StartDirectConversationInput } from './dto/messaging.input';
import { NotificationEventService } from '../notification/notification-event.service';
import { NotificationGroup, NotificationType } from '../notification/enums/notification.enum';
import { MessagingEventsService } from './messaging-events.service';

export interface MessageActor {
	_id: Types.ObjectId;
	memberType: MemberType;
}

const participantKey = (type: MemberType, id: Types.ObjectId): string => `${type}:${id.toString()}`;
const parseId = (value: string): Types.ObjectId => {
	if (!/^[0-9a-f]{24}$/i.test(value)) throw new BadRequestException('Invalid profile ID');
	return new Types.ObjectId(value);
};

@Injectable()
export class MessagingService {
	constructor(
		@InjectModel('Conversation') private readonly conversationModel: Model<ChatConversation>,
		@InjectModel('Message') private readonly messageModel: Model<ChatMessage>,
		@InjectModel('Member') private readonly memberModel: Model<any>,
		@InjectModel('Doctor') private readonly doctorModel: Model<any>,
		@InjectModel('Receptionist') private readonly receptionistModel: Model<any>,
		@InjectModel('Admin') private readonly adminModel: Model<any>,
		private readonly notificationEvents: NotificationEventService,
		private readonly messagingEvents: MessagingEventsService,
		private readonly notifications: NotificationService,
	) {}

	public async startDirectConversation(
		actor: MessageActor,
		input: StartDirectConversationInput,
	): Promise<ChatConversation> {
		const targetId = parseId(input.targetId);
		if (actor.memberType === input.targetType && actor._id.equals(targetId)) {
			throw new BadRequestException('Cannot start a conversation with yourself');
		}
		if (actor.memberType === MemberType.PATIENT && input.targetType === MemberType.PATIENT) {
			throw new BadRequestException('Patient-to-patient messaging is unavailable');
		}
		const [sender, receiver] = await Promise.all([
			this.getActiveParticipant(actor.memberType, actor._id),
			this.getActiveParticipant(input.targetType, targetId),
		]);
		if (!sender || !receiver) throw new NotFoundException('Active messaging participant not found');

		const keys = [participantKey(actor.memberType, actor._id), participantKey(input.targetType, targetId)].sort();
		const directKey = keys.join('|');
		try {
			return await this.conversationModel
				.findOneAndUpdate(
					{ conversationType: ConversationType.DIRECT, directKey },
					{
						$setOnInsert: {
							conversationType: ConversationType.DIRECT,
							directKey,
							participantKeys: keys,
							participants: [sender, receiver],
						},
					},
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				)
				.exec();
		} catch (error) {
			if ((error as { code?: number }).code !== 11000) throw error;
			return this.conversationModel.findOne({ conversationType: ConversationType.DIRECT, directKey }).exec();
		}
	}

	public async getUnreadCount(actor: MessageActor): Promise<number> {
		await this.requireActiveActor(actor);
		const ids = await this.conversationModel
			.distinct('_id', {
				conversationType: ConversationType.DIRECT,
				participantKeys: participantKey(actor.memberType, actor._id),
			})
			.exec();
		if (!ids.length) return 0;
		return this.messageModel
			.countDocuments({
				conversationId: { $in: ids },
				readAt: { $exists: false },
				deletedAt: { $exists: false },
				$or: [{ senderId: { $ne: actor._id } }, { senderType: { $ne: actor.memberType } }],
			})
			.exec();
	}

	public async getMyConversations(actor: MessageActor, input: ChatInquiry): Promise<ChatConversations> {
		await this.requireActiveActor(actor);
		const filter = {
			conversationType: ConversationType.DIRECT,
			participantKeys: participantKey(actor.memberType, actor._id),
		};
		const [list, total] = await Promise.all([
			this.conversationModel
				.find(filter)
				.sort({ lastMessageAt: -1, createdAt: -1 })
				.skip((input.page - 1) * input.limit)
				.limit(input.limit)
				.exec(),
			this.conversationModel.countDocuments(filter).exec(),
		]);
		return { list, total };
	}

	public async getMyConversation(actor: MessageActor, conversationId: Types.ObjectId): Promise<ChatConversation> {
		await this.requireActiveActor(actor);
		const conversation = await this.conversationModel
			.findOne({
			_id: conversationId,
			conversationType: ConversationType.DIRECT,
			participantKeys: participantKey(actor.memberType, actor._id),
		})
			.exec();
		if (!conversation) throw new NotFoundException('Conversation not found');
		return conversation;
	}

	public async getMyMessages(
		actor: MessageActor,
		conversationId: Types.ObjectId,
		input: ChatInquiry,
	): Promise<ChatMessages> {
		await this.getMyConversation(actor, conversationId);
		const filter = { conversationId, deletedAt: { $exists: false } };
		const [list, total] = await Promise.all([
			this.messageModel
				.find(filter)
				.sort({ createdAt: -1, _id: -1 })
				.skip((input.page - 1) * input.limit)
				.limit(input.limit)
				.exec(),
			this.messageModel.countDocuments(filter).exec(),
		]);
		return { list, total };
	}

	public async sendDirectMessage(
		actor: MessageActor,
		conversationId: Types.ObjectId,
		input: SendDirectMessageInput,
	): Promise<ChatMessage> {
		const conversation = await this.getMyConversation(actor, conversationId);
		const content = input.messageContent.trim();
		if (!content) throw new BadRequestException('Message cannot be empty');

		let replyToMessageId: Types.ObjectId | undefined;
		if (input.replyToMessageId) {
			replyToMessageId = parseId(input.replyToMessageId);
			const reply = await this.messageModel.exists({
				_id: replyToMessageId,
				conversationId,
				deletedAt: { $exists: false },
			});
			if (!reply) throw new BadRequestException('Reply message is not in this conversation');
		}

		const message = await this.messageModel.create({
			conversationId,
			senderId: actor._id,
			senderType: actor.memberType,
			messageContent: content,
			replyToMessageId,
		});
		await this.conversationModel
			.updateOne({ _id: conversationId }, { $set: { lastMessageAt: message.createdAt } })
			.exec();

		const recipient = conversation.participants.find(
			(participant) =>
				participantKey(participant.participantType, participant.participantId) !==
				participantKey(actor.memberType, actor._id),
		);
		if (recipient) {
			await this.notificationEvents.toRecipient(recipient.participantId, recipient.participantType, {
				key: `message:${message._id}`,
				type: NotificationType.MESSAGE,
				group: NotificationGroup.CONVERSATION,
				title: 'New message',
				description: 'You have a new message in your inbox.',
				refId: conversationId,
				authorId: actor._id,
				authorType: actor.memberType,
			});
		}
		this.messagingEvents.publishMessageCreated({ conversationId, participants: conversation.participants, message });
		return message;
	}

	public async markMyMessagesRead(actor: MessageActor, conversationId: Types.ObjectId): Promise<number> {
		const conversation = await this.getMyConversation(actor, conversationId);
		const other = conversation.participants.find(
			(participant) =>
				participantKey(participant.participantType, participant.participantId) !==
				participantKey(actor.memberType, actor._id),
		);
		if (!other) throw new NotFoundException('Conversation recipient not found');
		const readAt = new Date();
		const result = await this.messageModel
			.updateMany(
				{
					conversationId,
					senderId: other.participantId,
					senderType: other.participantType,
					readAt: { $exists: false },
					deletedAt: { $exists: false },
					createdAt: { $lte: readAt },
				},
				{ $set: { readAt } },
			)
			.exec();
		await this.notifications.markConversationRead(actor._id, actor.memberType, conversationId, readAt);
		if (result.modifiedCount > 0)
			this.messagingEvents.publishMessagesRead({
				conversationId,
				participants: conversation.participants,
				readerId: actor._id,
				readerType: actor.memberType,
				readAt,
			});
		return result.modifiedCount;
	}

	private async requireActiveActor(actor: MessageActor): Promise<void> {
		if (!(await this.getActiveParticipant(actor.memberType, actor._id))) {
			throw new NotFoundException('Active messaging profile not found');
		}
	}

	private async getActiveParticipant(type: MemberType, id: Types.ObjectId): Promise<ChatParticipant | null> {
		const active = { _id: id, memberStatus: MemberStatus.ACTIVE };
		let profile: Record<string, any> | null;
		switch (type) {
			case MemberType.PATIENT:
				profile = await this.memberModel
					.findOne({ ...active, memberType: MemberType.PATIENT })
					.select('memberFullName memberNick memberImage')
					.lean()
					.exec();
				return profile
					? {
							participantId: id,
							participantType: type,
							displayName: profile.memberFullName || profile.memberNick,
							image: profile.memberImage,
						}
					: null;
			case MemberType.DOCTOR:
				profile = await this.doctorModel.findOne(active).select('docFullName docNick docImage').lean().exec();
				return profile
					? {
							participantId: id,
							participantType: type,
							displayName: profile.docFullName || profile.docNick,
							image: profile.docImage,
						}
					: null;
			case MemberType.RECEPTIONIST:
				profile = await this.receptionistModel
					.findOne(active)
					.select('receptionistFullName receptionistNick receptionistImage')
					.lean()
					.exec();
				return profile
					? {
							participantId: id,
							participantType: type,
							displayName: profile.receptionistFullName || profile.receptionistNick,
							image: profile.receptionistImage,
						}
					: null;
			case MemberType.ADMIN:
				profile = await this.adminModel.findById(id).select('adminNick adminImage').lean().exec();
				return profile
					? { participantId: id, participantType: type, displayName: profile.adminNick, image: profile.adminImage }
					: null;
			default:
				return null;
		}
	}
}
