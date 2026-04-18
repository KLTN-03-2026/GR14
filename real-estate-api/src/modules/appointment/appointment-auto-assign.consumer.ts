import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AppointmentService } from './appointment.service';

interface AutoAssignPayload {
  appointmentId: number;
}

@Controller()
export class AppointmentAutoAssignConsumerController {
  private readonly logger = new Logger(
    AppointmentAutoAssignConsumerController.name,
  );

  constructor(private readonly appointmentService: AppointmentService) {}

  @EventPattern('appointment.auto_assign')
  async handleAutoAssign(@Payload() payload: AutoAssignPayload): Promise<void> {
    if (!payload?.appointmentId) {
      return;
    }

    this.logger.log(
      `[RabbitMQ] Nhận job auto-assign cho appointment #${payload.appointmentId}`,
    );
    try {
      await this.appointmentService.autoAssign(payload.appointmentId);
      this.logger.log(
        `[RabbitMQ] Auto-assign hoàn tất cho appointment #${payload.appointmentId}`,
      );
    } catch (error) {
      this.logger.error(
        `[RabbitMQ] Auto-assign thất bại cho appointment #${payload.appointmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
