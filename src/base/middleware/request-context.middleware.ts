import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

type RequestWithContext = Request & { requestId?: string };

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction) {
    const rid =
      (req.headers["x-request-id"] as string | undefined) || randomUUID();
    req.requestId = rid;
    res.setHeader("x-request-id", rid);
    next();
  }
}
