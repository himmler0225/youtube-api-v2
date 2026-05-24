import { Module } from "@nestjs/common";
import { AppLogger } from "@/base/logger/app-logger.service";
import { PublicUserController } from "./public-user.controller";
import { PublicUserService } from "./public-user.service";

@Module({
  controllers: [PublicUserController],
  providers: [PublicUserService, AppLogger],
})
export class PublicUserModule {}
