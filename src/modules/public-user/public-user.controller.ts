import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { PaginationQueryDto } from "@/base/dto/pagination.dto";
import { PublicUserService } from "./public-user.service";

@ApiTags("users")
@SkipThrottle()
@Controller("users")
export class PublicUserController {
  constructor(private readonly service: PublicUserService) {}

  @ApiOperation({ summary: "Get public user profile by username" })
  @Get(":username")
  getProfile(@Param("username") username: string) {
    return this.service.getProfile(username);
  }

  @ApiOperation({ summary: "Get comments made by a user" })
  @Get(":username/comments")
  getComments(
    @Param("username") username: string,
    @Query() pagination: PaginationQueryDto = new PaginationQueryDto(),
  ) {
    return this.service.getComments(
      username,
      pagination.page,
      pagination.limit,
    );
  }
}
