import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { UserPreference } from './dto/preference';
import { UpdateMyPreferencesInput } from './dto/preference.input';
import { PreferenceActor, PreferenceService } from './preference.service';

const preferenceRoles = [MemberType.PATIENT, MemberType.DOCTOR, MemberType.RECEPTIONIST, MemberType.ADMIN];

@Resolver()
export class PreferenceResolver {
	constructor(private readonly preferenceService: PreferenceService) {}

	@Roles(...preferenceRoles)
	@UseGuards(RolesGuard)
	@Query(() => UserPreference)
	public async getMyPreferences(@AuthMember() actor: PreferenceActor): Promise<UserPreference> {
		return this.preferenceService.getMyPreferences(actor);
	}

	@Roles(...preferenceRoles)
	@UseGuards(RolesGuard)
	@Mutation(() => UserPreference)
	public async updateMyPreferences(
		@Args('input') input: UpdateMyPreferencesInput,
		@AuthMember() actor: PreferenceActor,
	): Promise<UserPreference> {
		return this.preferenceService.updateMyPreferences(actor, input);
	}
}
