import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ConfigService } from "@nestjs/config";
import { AppLogger } from "@/base/logger/app-logger.service";
import { LiveGateway } from "./live.gateway";

@WebSocketGateway({
  namespace: "/crawler",
  cors: { origin: "*" },
})
export class CrawlerGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly liveGateway: LiveGateway,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  afterInit(server: Server) {
    const wsKey = this.config.get<string>("CRAWLER_WS_KEY") ?? "";
    server.use((socket: Socket, next: (err?: Error) => void) => {
      const token = (socket.handshake.auth as Record<string, string>)?.token;
      if (!wsKey || token !== wsKey) {
        this.logger.warn("Crawler WS auth failed", "CrawlerGateway");
        next(new Error("Unauthorized"));
        return;
      }
      next();
    });
  }

  @SubscribeMessage("crawler:live:push")
  handleLivePush(_client: Socket, payload: { videos: unknown[] }) {
    const count = payload?.videos?.length ?? 0;
    this.logger.log(`Received live push: ${count} videos`, "CrawlerGateway");
    this.liveGateway.broadcastUpdate(payload.videos ?? []);
  }
}
