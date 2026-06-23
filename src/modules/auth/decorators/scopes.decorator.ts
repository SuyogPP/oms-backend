import { SetMetadata } from '@nestjs/common';
import { SCOPES_KEY } from '../constants/auth.constants';

export const Scopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);
