import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtUser } from '../../../common/interfaces/jwt-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

    constructor(
        configService: ConfigService,
    ) {

        super({

            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

            ignoreExpiration: false,

            secretOrKey: configService.get<string>('jwt.secret')!,

        });

    }

    async validate(payload: JwtUser): Promise<JwtUser> {

        if (!payload) {
            throw new UnauthorizedException();
        }

        return payload;
    }

}