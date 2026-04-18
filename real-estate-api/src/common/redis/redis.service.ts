import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = new Redis(url, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 5) {
          this.logger.error('Redis connection failed after 5 retries');
          return null; // stop retrying
        }
        return Math.min(times * 500, 2000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Redis connected');
      this.isConnected = true;
    });
    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
      this.isConnected = false;
    });
    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client
      .connect()
      .catch((err) =>
        this.logger.error(`Redis initial connect error: ${err.message}`),
      );
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping get');
      return null;
    }
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Redis get error for key ${key}: ${error}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping set');
      return;
    }
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Redis set error for key ${key}: ${error}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Redis del error for key ${key}: ${error}`);
    }
  }

  /**
   * Xóa tất cả keys khớp với pattern (dùng SCAN để an toàn cho production)
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.error(
        `Redis delByPattern error for pattern ${pattern}: ${error}`,
      );
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected) return -2;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Redis ttl error for key ${key}: ${error}`);
      return -2;
    }
  }
}
