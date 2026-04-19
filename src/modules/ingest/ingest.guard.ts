import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class IngestGuard implements CanActivate {
  private readonly serviceKey: string;

  constructor(private readonly config: ConfigService) {
    this.serviceKey = this.config.getOrThrow<string>('INTERNAL_SERVICE_KEY');
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-service-key'];

    if (!key || key !== this.serviceKey) {
      throw new UnauthorizedException('Invalid service key');
    }

    return true;
  }
}
