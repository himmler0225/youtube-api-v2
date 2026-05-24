import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AppLogger } from "@/base/logger/app-logger.service";

@WebSocketGateway({
  namespace: "/live",
  cors: { origin: "*" },
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private latestVideos: unknown[] = [];

  constructor(private readonly logger: AppLogger) {}

  handleConnection() {
    this.logger.log("Frontend WS client connected", "LiveGateway");
  }

  handleDisconnect() {
    this.logger.log("Frontend WS client disconnected", "LiveGateway");
  }

  @SubscribeMessage("live:subscribe")
  handleSubscribe(client: Socket) {
    client.emit("live:update", this.latestVideos);
  }

  broadcastUpdate(videos: unknown[]) {
    this.latestVideos = videos;
    this.server.emit("live:update", videos);
  }
}
