import { FengshuiService } from './fengshui.service';
import { CalendarType, Gender } from './dto/fengshui.dto';

/**
 * Unit tests for FengshuiService — tests core feng shui calculation logic.
 */
describe('FengshuiService', () => {
  let service: FengshuiService;

  beforeEach(() => {
    const prisma = {
      vipSubscription: { findFirst: jest.fn().mockResolvedValue(null) },
      house: { findMany: jest.fn().mockResolvedValue([]) },
      land: { findMany: jest.fn().mockResolvedValue([]) },
    };

    service = new FengshuiService(prisma as any);
  });

  describe('analyze', () => {
    it('should return valid feng shui analysis for a male born in 1990', async () => {
      const result = await service.analyze({
        name: 'Nguyễn Văn A',
        birthDate: '15/06/1990',
        calendarType: CalendarType.SOLAR,
        gender: Gender.MALE,
        location: '',
      });

      expect(result).toBeDefined();
      expect(result.thongTinCaNhan.ten).toBe('Nguyễn Văn A');
      expect(result.thongTinCaNhan.canChi).toBeDefined();
      expect(result.menhCung.menh).toBeDefined();
      expect(['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ']).toContain(
        result.menhCung.menh,
      );
      expect(result.menhCung.cungSo).toBeGreaterThanOrEqual(1);
      expect(result.menhCung.cungSo).toBeLessThanOrEqual(9);
    });

    it('should return bat trach with 4 cat and 4 hung directions', async () => {
      const result = await service.analyze({
        name: 'Test',
        birthDate: '01/01/1995',
        calendarType: CalendarType.SOLAR,
        gender: Gender.FEMALE,
        location: '',
      });

      expect(result.batTrach.cat).toHaveLength(4);
      expect(result.batTrach.hung).toHaveLength(4);
      result.batTrach.cat.forEach((h: any) => {
        expect(h.loai).toBe('Cát');
        expect(h.huong).toBeDefined();
        expect(h.moTa).toBeDefined();
      });
    });

    it('should handle lunar calendar type', async () => {
      const result = await service.analyze({
        name: 'Test',
        birthDate: '20/10/1988',
        calendarType: CalendarType.LUNAR,
        gender: Gender.MALE,
        location: '',
      });

      expect(result.thongTinCaNhan.loaiLich).toBe('Âm lịch');
      expect(result.thongTinCaNhan.namAmLich).toBe(1988);
    });

    it('should include nap am and van menh', async () => {
      const result = await service.analyze({
        name: 'Test',
        birthDate: '15/03/1992',
        calendarType: CalendarType.SOLAR,
        gender: Gender.MALE,
        location: '',
      });

      const batMi = result.thongTinCaNhan.batMiBanMenh;
      expect(batMi.napAm).toBeDefined();
      expect(batMi.yNghiaNapAm).toBeDefined();
      expect(batMi.vanMenh).toBeDefined();
      expect(batMi.tamHop).toBeDefined();
    });

    it('should not include vipData for non-VIP user', async () => {
      const result = await service.analyze(
        {
          name: 'Test',
          birthDate: '01/01/2000',
          calendarType: CalendarType.SOLAR,
          gender: Gender.FEMALE,
          location: '',
        },
        { id: 999 },
      );

      expect(result.isVip).toBe(false);
      expect(result.vipData).toBeNull();
    });

    it('should throw for invalid birthDate format', async () => {
      await expect(
        service.analyze({
          name: 'Test',
          birthDate: 'invalid',
          calendarType: CalendarType.SOLAR,
          gender: Gender.MALE,
          location: '',
        }),
      ).rejects.toThrow();
    });
  });
});
