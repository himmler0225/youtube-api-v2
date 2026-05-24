import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AppLogger, AllExceptionsFilter, ResponseInterceptor } from "./base";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { json } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : false,
    credentials: true,
  });

  // BigInt serialization: Express's json replacer — dùng thay BigInt.prototype.toJSON
  // vì JSON.stringify throw trước khi gọi toJSON cho BigInt primitives.
  // viewCount YouTube tối đa ~10B < Number.MAX_SAFE_INTEGER (9×10¹⁵) nên Number an toàn.
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };
  expressApp.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? Number(value) : value,
  );

  app.use(json({ limit: "10mb" }));
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle("YouTube API")
    .setDescription(
      "Enterprise-grade authentication API with refresh token rotation, device binding, and reuse detection",
    )
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT access token",
        in: "header",
      },
      "JWT-auth",
    )
    .addTag("auth", "Authentication endpoints")
    .addTag("users", "User management endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
    customSiteTitle: "YouTube API Documentation",
  });

  await app.listen(3000);
  logger.info(`Application is running on: http://localhost:3000`);
  logger.info(`Swagger documentation: http://localhost:3000/api`);
}

bootstrap().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
