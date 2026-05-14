import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "./services/auth.service";
import { RegisterDto, LoginDto, RefreshDto, ChangePasswordDto } from "./dto";
import {
  AuthResponseDto,
  RefreshResponseDto,
  SessionDto,
  SuccessResponseDto,
  UserResponseDto,
} from "./dto/auth-response.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtUser } from "./strategies/jwt.strategy";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: "Register a new account" })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post("register")
  register(@Body() payload: RegisterDto, @Req() req: Request) {
    return this.authService.create(payload, req);
  }

  @ApiOperation({ summary: "Login with credentials" })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  login(@Body() payload: LoginDto, @Req() req: Request) {
    return this.authService.login(payload, req);
  }

  @ApiOperation({ summary: "Rotate access token using refresh token" })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("refresh")
  refresh(@Body() payload: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(payload, req);
  }

  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: Request) {
    const jwtUser = req.user as JwtUser;
    return this.authService.getMe(jwtUser.userId);
  }

  @ApiOperation({ summary: "List active sessions for current user" })
  @ApiResponse({ status: 200, type: [SessionDto] })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Get("sessions")
  sessions(@Req() req: Request) {
    const jwtUser = req.user as JwtUser;
    return this.authService.getSessions(jwtUser.userId, jwtUser.sessionId);
  }

  @ApiOperation({ summary: "Logout and revoke current session" })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  logout(@Req() req: Request) {
    const jwtUser = req.user as JwtUser;
    return this.authService.logout(
      jwtUser.userId,
      jwtUser.sessionId,
      jwtUser.jti,
      jwtUser.exp,
      req,
    );
  }

  @ApiOperation({ summary: "Revoke a specific session by ID" })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Delete("sessions/:id")
  revokeSession(@Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    const jwtUser = req.user as JwtUser;
    return this.authService.revokeSession(
      jwtUser.userId,
      jwtUser.sessionId,
      id,
      req,
    );
  }

  @ApiOperation({ summary: "Revoke all sessions and invalidate all tokens" })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Post("logout-all")
  logoutAll(@Req() req: Request) {
    const jwtUser = req.user as JwtUser;
    return this.authService.logoutAll(jwtUser.userId, jwtUser.sessionId, req);
  }

  @ApiOperation({ summary: "Change password and revoke all existing sessions" })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post("change-password")
  changePassword(@Body() payload: ChangePasswordDto, @Req() req: Request) {
    const jwtUser = req.user as JwtUser;
    return this.authService.changePassword(
      jwtUser.userId,
      jwtUser.sessionId,
      payload.currentPassword,
      payload.newPassword,
      req,
    );
  }
}
