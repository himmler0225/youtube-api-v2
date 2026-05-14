import { Injectable, OnModuleInit } from "@nestjs/common";
import { Client } from "@elastic/elasticsearch";

@Injectable()
export class ElasticService implements OnModuleInit {
  private client!: Client;

  onModuleInit() {
    this.client = new Client({
      node: process.env.ELASTIC_URL || "http://localhost:9200",
    });
  }

  getClient(): Client {
    return this.client;
  }
}
