import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AppLogger } from "@/base/logger/app-logger.service";
import { CrawlerClientService } from "@/modules/crawler-client/crawler-client.service";

@WebSocketGateway({
  namespace: "/live",
  cors: { origin: "*" },
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private latestVideos: unknown[] = [];

  constructor(
    private readonly logger: AppLogger,
    private readonly crawler: CrawlerClientService,
  ) {}

  handleConnection() {
    this.logger.log("Frontend WS client connected", "LiveGateway");
  }

  handleDisconnect() {
    this.logger.log("Frontend WS client disconnected", "LiveGateway");
  }

  @SubscribeMessage("live:subscribe")
  async handleSubscribe(client: Socket) {
    if (this.latestVideos.length > 0) {
      client.emit("live:update", this.latestVideos);
      return;
    }

    try {
      const videos = await this.crawler.getLiveVideos("", 1, 50);
      this.latestVideos = videos;
      this.logger.log(
        `Seeded live cache from crawler: ${videos.length} videos`,
        "LiveGateway",
      );
    } catch (err) {
      this.logger.warn(
        `Failed to seed live cache: ${String(err)}`,
        "LiveGateway",
      );
    }

    client.emit("live:update", this.latestVideos);
  }

  broadcastUpdate(videos: unknown[]) {
    this.latestVideos = videos;
    this.server.emit("live:update", videos);
  }
}
