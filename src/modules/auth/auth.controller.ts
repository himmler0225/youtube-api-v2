import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './services/auth.service';
import { RegisterDto, LoginDto, RefreshDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() payload: RegisterDto, @Req() req: Request) {
    return this.authService.create(payload, req);
  }

  @Post('login')
  login(@Body() payload: LoginDto, @Req() req: Request) {
    return this.authService.login(payload, req);
  }

  @Post('refresh')
  refresh(@Body() payload: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(payload, req);
  }

  // TODO: thêm @UseGuards(JwtGuard) sau khi implement JwtGuard
  @Post('logout')
  logout(@Req() req: Request) {
    const user = req.user as { userId: string; sessionId: string };
    return this.authService.logout(user.userId, user.sessionId, req);
  }
}
