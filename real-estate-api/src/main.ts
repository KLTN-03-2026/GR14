import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // ── Hybrid App: HTTP server + RabbitMQ consumer ──
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // Compression for responses
  app.use(compression());

  const rmqUrl = configService.get('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672?heartbeat=30';
  const rmqReconnectSeconds = Number(configService.get('RABBITMQ_RECONNECT_SECONDS') || 5);
  const rmqConnectionTimeoutMs = Number(configService.get('RABBITMQ_CONNECTION_TIMEOUT_MS') || 30000);

  // Kết nối đến RabbitMQ
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rmqUrl],
      queue: 'mail_queue',
      queueOptions: {
        durable: true,
      },
      socketOptions: {
        heartbeat: 30,
        connectionTimeout: rmqConnectionTimeoutMs,
      },
      reconnectTimeInSeconds: rmqReconnectSeconds,
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rmqUrl],
      queue: 'appointment_auto_assign_queue',
      queueOptions: {
        durable: true,
      },
      socketOptions: {
        heartbeat: 30,
        connectionTimeout: rmqConnectionTimeoutMs,
      },
      reconnectTimeInSeconds: rmqReconnectSeconds,
    },
  });

  // CORS configuration
  const frontendUrl = configService.get('FRONTEND_URL') || 'http://localhost:3000';
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? [frontendUrl]
      : ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Validation pipe with optimization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api');

  // Graceful shutdown
  app.enableShutdownHooks();

  // Khởi động microservice trước HTTP server
  await app.startAllMicroservices();
  logger.log('RabbitMQ consumer: listening on queue [mail_queue]');
  logger.log('RabbitMQ consumer: listening on queue [appointment_auto_assign_queue]');

  const port = configService.get('PORT') || 5000;
  await app.listen(port);
  logger.log(`Server running at http://localhost:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();

