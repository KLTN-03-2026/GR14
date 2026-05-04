import { BadRequestException } from '@nestjs/common';
import { AppointmentService } from './appointment.service';

/**
 * Unit tests for AppointmentService — tests core scheduling logic.
 * Focus: SLA computation, booking date limit.
 */
describe('AppointmentService', () => {
  let service: AppointmentService;

  beforeEach(() => {
    const prisma = {
      appointment: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 1 }),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      house: { findUnique: jest.fn() },
      land: { findUnique: jest.fn() },
    };
    const mailService = {
      getAppointmentCreatedEmailHtml: jest.fn().mockReturnValue('<p></p>'),
    };
    const mailProducer = { sendMail: jest.fn() };
    const autoAssignProducer = { publishAutoAssign: jest.fn() };
    const notificationService = { create: jest.fn() };

    service = new AppointmentService(
      prisma as any,
      mailService as any,
      mailProducer as any,
      autoAssignProducer as any,
      notificationService as any,
    );
  });

  describe('assertBookingDateWithinLimit', () => {
    it('should reject appointments more than 10 days ahead', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 15);
      // Set to 9:00 AM Vietnam = 02:00 UTC
      farFuture.setUTCHours(2, 0, 0, 0);

      await expect(
        service.create(
          {
            houseId: 1,
            appointmentDate: farFuture.toISOString(),
            durationMinutes: 60,
          } as any,
          1,
        ),
      ).rejects.toThrow(/10 ngày/);
    });
  });

  describe('computeSlaStatus', () => {
    // Access private method via bracket notation for testing
    it('should return ON_TRACK when within deadline', () => {
      const now = new Date();
      const deadline = new Date(now.getTime() + 60 * 60_000); // 1 hour

      const status = (service as any).computeSlaStatus({
        now,
        employeeId: null,
        slaAssignDeadlineAt: deadline,
      });

      expect(status).toBe(0); // ON_TRACK
    });

    it('should return BREACHED when past deadline without assignment', () => {
      const now = new Date();
      const deadline = new Date(now.getTime() - 60_000); // 1 min ago

      const status = (service as any).computeSlaStatus({
        now,
        employeeId: null,
        slaAssignDeadlineAt: deadline,
      });

      expect(status).toBe(2); // BREACHED
    });

    it('should return AT_RISK when near deadline (< 10 min)', () => {
      const now = new Date();
      const deadline = new Date(now.getTime() + 5 * 60_000); // 5 min

      const status = (service as any).computeSlaStatus({
        now,
        employeeId: null,
        slaAssignDeadlineAt: deadline,
      });

      expect(status).toBe(1); // AT_RISK
    });

    it('should return ON_TRACK when employee assigned and first contact within deadline', () => {
      const now = new Date();
      const deadline = new Date(now.getTime() + 12 * 60 * 60_000); // 12h

      const status = (service as any).computeSlaStatus({
        now,
        employeeId: 1,
        firstContactAt: null,
        slaFirstContactDeadlineAt: deadline,
      });

      expect(status).toBe(0); // ON_TRACK
    });
  });
});
