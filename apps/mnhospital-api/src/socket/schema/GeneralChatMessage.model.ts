import { randomUUID } from 'crypto';
import { Schema } from 'mongoose';
import { MemberType } from '../../components/member/enums/member.enum';
import { MAX_GENERAL_MESSAGE_LENGTH } from '../general-chat.service';

const GeneralChatMessageSchema = new Schema({
	messageId: { type: String, default: randomUUID, required: true, unique: true },
	text: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_GENERAL_MESSAGE_LENGTH },
	name: { type: String, required: true, maxlength: 100 },
	role: { type: String, enum: [...Object.values(MemberType), 'GUEST'], required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'generalChatMessages' });

GeneralChatMessageSchema.index({ createdAt: -1, messageId: -1 });

export default GeneralChatMessageSchema;
