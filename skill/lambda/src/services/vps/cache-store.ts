import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

export interface Cached {
  savedAt: number;
  value: unknown;
}

/** Dónde guarda la skill la última respuesta buena del VPS. */
export interface CacheStore {
  get(key: string): Promise<Cached | undefined>;
  set(key: string, value: unknown, savedAt: number): Promise<void>;
}

export class MemoryCacheStore implements CacheStore {
  readonly items = new Map<string, Cached>();

  get(key: string): Promise<Cached | undefined> {
    return Promise.resolve(this.items.get(key));
  }

  set(key: string, value: unknown, savedAt: number): Promise<void> {
    this.items.set(key, { savedAt, value });
    return Promise.resolve();
  }
}

/** Mínimo que se usa del cliente de DynamoDB (permite simularlo en los tests). */
export interface DocumentClient {
  send(command: GetCommand | PutCommand): Promise<{ Item?: Record<string, unknown> }>;
}

/** Tabla DynamoDB de Alexa-hosted (clave de partición `id`). Es una sola persona: una entrada por pantalla. */
export class DynamoCacheStore implements CacheStore {
  constructor(
    private readonly table: string,
    private readonly client: DocumentClient,
  ) {}

  /** Con tiempos cortos y un solo reintento: la caché no puede hacer que Alexa corte la respuesta. */
  static create(table: string, region?: string): DynamoCacheStore {
    const client = new DynamoDBClient({
      ...(region ? { region } : {}),
      maxAttempts: 2,
      requestHandler: { requestTimeout: 800, connectionTimeout: 500 },
    });
    return new DynamoCacheStore(table, DynamoDBDocumentClient.from(client));
  }

  async get(key: string): Promise<Cached | undefined> {
    const { Item } = await this.client.send(new GetCommand({ TableName: this.table, Key: { id: `vistapp-cache#${key}` } }));
    const attributes = Item?.attributes as Cached | undefined;
    return typeof attributes?.savedAt === 'number' ? attributes : undefined;
  }

  async set(key: string, value: unknown, savedAt: number): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.table, Item: { id: `vistapp-cache#${key}`, attributes: { savedAt, value } } }));
  }
}
