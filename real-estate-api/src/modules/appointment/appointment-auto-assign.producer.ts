import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AppointmentAutoAssignProducerService {
    constructor(
        @Inject('APPOINTMENT_ASSIGN_SERVICE')
        private readonly client: ClientProxy,
    ) { }

    publishAutoAssign(appointmentId: number): void {
        this.client.emit<void>('appointment.auto_assign', { appointmentId });
    }
}
