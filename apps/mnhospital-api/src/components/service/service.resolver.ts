import { Resolver } from '@nestjs/graphql';
import { ServiceService } from './service.service';

@Resolver()
export class ServiceResolver {
	constructor(private readonly serviceService: ServiceService) {}
}
