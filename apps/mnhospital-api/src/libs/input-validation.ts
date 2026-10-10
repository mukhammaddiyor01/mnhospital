import { ValidationPipe } from '@nestjs/common';

/** Keep production and persistence verification on the same DTO transformations. */
export const createInputValidationPipe = () => new ValidationPipe({ transform: true });
