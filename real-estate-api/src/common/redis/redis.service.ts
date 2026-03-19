import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client: Redis;
    private readonly logger = new Logger(RedisService.name);

    constructor(private configService: ConfigService) {}

    onModuleInit() {
        const url = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        this.client = new Redis(url, {
            lazyConnect: true,
            retryStrategy: (times) => {
                if (times > 5) {
                    this.logger.error('Redis connection failed after 5 retries');
                    return null; // stop retrying
                }
                return Math.min(times * 500, 2000);
            },
        });

        this.client.on('connect', () => this.logger.log('✅ Redis connected'));
        this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));

        this.client.connect().catch((err) => this.logger.error(`Redis initial connect error: ${err.message}`));
    }

    onModuleDestroy() {
        this.client?.disconnect();
    }

    async get<T>(key: string): Promise<T | null> {
        const value = await this.client.get(key);
        if (!value) return null;
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }

    async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
            await this.client.set(key, serialized, 'EX', ttlSeconds);
        } else {
            await this.client.set(key, serialized);
        }
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    /**
     * Xóa tất cả keys khớp với pattern (dùng SCAN để an toàn cho production)
     */
    async delByPattern(pattern: string): Promise<void> {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
        } while (cursor !== '0');
    }

    async ttl(key: string): Promise<number> {
        return this.client.ttl(key);
    }
}
