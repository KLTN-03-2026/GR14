import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';
import { MailModule } from '../../common/mail/mail.module';
import { AppointmentAutoAssignProducerService } from './appointment-auto-assign.producer';
import { AppointmentAutoAssignConsumerController } from './appointment-auto-assign.consumer';

@Module({
    imports: [
        MailModule,
        ClientsModule.registerAsync([
            {
                name: 'APPOINTMENT_ASSIGN_SERVICE',
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.RMQ,
                    options: {
                        urls: [configService.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672'],
                        queue: 'appointment_auto_assign_queue',
                        queueOptions: {
                            durable: true,
                        },
                    },
                }),
            },
        ]),
    ],
    controllers: [AppointmentController, AppointmentAutoAssignConsumerController],
    providers: [AppointmentService, AppointmentAutoAssignProducerService],
    exports: [AppointmentService],
})
export class AppointmentModule { }
