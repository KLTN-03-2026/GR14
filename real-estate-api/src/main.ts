import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  // ── Hybrid App: vừa là HTTP server, vừa là RabbitMQ consumer ──
  const app = await NestFactory.create(AppModule);

  // Kết nối đến RabbitMQ và lắng nghe queue 'mail_queue'
  // MailConsumerController sẽ handle các message từ queue này
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
      queue: 'mail_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes( 
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion:true, 
      }
    }),
  );

  app.setGlobalPrefix('api');

  // Khởi động microservice (RabbitMQ consumer) TRƯỚC khi bắt đầu HTTP server
  await app.startAllMicroservices();
  console.log('RabbitMQ consumer: listening on queue [mail_queue]');

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`Server running at http://localhost:${port}`);
}
bootstrap();

