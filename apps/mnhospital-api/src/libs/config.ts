// IMAGE CONFIGURATION (config.js)
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { Types } from 'mongoose';
import ObjectId = Types.ObjectId;

export const availabeDoctorSorts = ['createdAt', 'updatedAt', 'memberLikes', 'memberViews', 'memberRank'];

export const validMimeTypes = ['image/png', 'image/jpg', 'image/jpeg'];
export const getSerialForImage = (filename: string) => {
	const ext = path.parse(filename).ext;
	return uuidv4() + ext;
};

export const shapeIntoMongoObjectId = (target: string | ObjectId): ObjectId => {
	return typeof target === 'string' ? new ObjectId(target) : target;
};
