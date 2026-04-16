import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FengshuiAnalyzeDto, CalendarType, Gender } from './dto/fengshui.dto';

const CAN = [
  'Canh',
  'Tân',
  'Nhâm',
  'Quý',
  'Giáp',
  'Ất',
  'Bính',
  'Đinh',
  'Mậu',
  'Kỷ',
];
const CHI = [
  'Thân',
  'Dậu',
  'Tuất',
  'Hợi',
  'Tý',
  'Sửu',
  'Dần',
  'Mão',
  'Thìn',
  'Tỵ',
  'Ngọ',
  'Mùi',
];

const CON_GIAP: Record<
  string,
  { ten: string; emoji: string; tinhCach: string }
> = {
  Tý: {
    ten: 'Chuột',
    emoji: '🐭',
    tinhCach: 'Thông minh, nhanh nhẹn, khéo léo và có khiếu kinh doanh.',
  },
  Sửu: {
    ten: 'Trâu',
    emoji: '🐂',
    tinhCach: 'Chăm chỉ, kiên nhẫn, đáng tin cậy và có trách nhiệm.',
  },
  Dần: {
    ten: 'Hổ',
    emoji: '🐯',
    tinhCach: 'Dũng cảm, tự tin, nhiệt tình và có tinh thần lãnh đạo.',
  },
  Mão: {
    ten: 'Mèo',
    emoji: '🐰',
    tinhCach: 'Tinh tế, nhẹ nhàng, khéo léo và có óc thẩm mỹ cao.',
  },
  Thìn: {
    ten: 'Rồng',
    emoji: '🐲',
    tinhCach: 'Tự tự, tham vọng, may mắn và có sức hút tự nhiên.',
  },
  Tỵ: {
    ten: 'Rắn',
    emoji: '🐍',
    tinhCach: 'Khôn ngoan, trực giác tốt, bí ẩn và sâu sắc.',
  },
  Ngọ: {
    ten: 'Ngựa',
    emoji: '🐴',
    tinhCach: 'Năng động, tự do, nhiệt huyết và thích phiêu lưu.',
  },
  Mùi: {
    ten: 'Dê',
    emoji: '🐑',
    tinhCach: 'Hiền lành, sáng tạo, nhạy cảm và yêu nghệ thuật.',
  },
  Thân: {
    ten: 'Khỉ',
    emoji: '🐒',
    tinhCach: 'Thông minh, hài hước, linh hoạt và tháo vát.',
  },
  Dậu: {
    ten: 'Gà',
    emoji: '🐓',
    tinhCach: 'Cần cù, chính xác, tự tin và có óc quan sát.',
  },
  Tuất: {
    ten: 'Chó',
    emoji: '🐕',
    tinhCach: 'Trung thành, chân thật, dũng cảm và đáng tin cậy.',
  },
  Hợi: {
    ten: 'Lợn',
    emoji: '🐷',
    tinhCach: 'Hào phóng, chân thành, vui vẻ và có lòng tốt.',
  },
};

// --- DATA: BÁT TRẠCH CHI TIẾT ---
const SAO_BAT_TRACH = {
  SinhKhi: {
    ten: 'Sinh Khí',
    loai: 'Cát',
    moTa: 'Thu hút tài lộc, danh tiếng và thăng quan phát tài. Phù hợp nhất làm hướng cửa chính hoặc phòng làm việc để kích hoạt năng lượng tích cực nhất.',
  },
  ThienY: {
    ten: 'Thiên Y',
    loai: 'Cát',
    moTa: 'Cải thiện sức khỏe, trường thọ. Mang lại tinh thần minh mẫn, gặp may mắn có quý nhân phù trợ. Đặc biệt tốt cho không gian phòng ngủ của gia chủ.',
  },
  DienNien: {
    ten: 'Diên Niên',
    loai: 'Cát',
    moTa: 'Củng cố các mối quan hệ trong gia đình và tình yêu. Xây dựng sự hòa thuận, gắn kết giữa các thành viên. Lý tưởng cho không gian sinh hoạt chung.',
  },
  PhucVi: {
    ten: 'Phục Vị',
    loai: 'Cát',
    moTa: 'Củng cố sức mạnh tinh thần, mang lại tiến bộ của bản thân và may mắn trong thi cử. Hướng này mang lại sự bình yên, phù hợp làm nơi thờ tự hoặc đọc sách.',
  },
  TuyetMenh: {
    ten: 'Tuyệt Mệnh',
    loai: 'Hung',
    moTa: 'Hướng xấu nhất, có thể gây phá sản, bệnh tật chết người. Tuyệt đối không đặt cửa chính hoặc đầu giường theo hướng này.',
  },
  NguQuy: {
    ten: 'Ngũ Quỷ',
    loai: 'Hung',
    moTa: 'Mất nguồn thu nhập, mất việc làm, cãi lộn. Dễ gặp phải những rủi ro về hỏa hoạn hoặc trộm cắp, tốn hao năng lượng và tiền bạc.',
  },
  LucSat: {
    ten: 'Lục Sát',
    loai: 'Hung',
    moTa: 'Xáo trộn trong quan hệ tình cảm, thù hận, kiện tụng và tai nạn. Gây ra sự bất an về tinh thần và những rắc rối thị phi không đáng có.',
  },
  HoaHai: {
    ten: 'Họa Hại',
    loai: 'Hung',
    moTa: 'Không may mắn, thị phi, thất bại. Gây ra những trở ngại nhỏ nhưng liên tục, làm tiêu hao nghị lực và sự kiên trì trong công việc.',
  },
};

const BATTRACH_MAP: Record<
  number,
  Record<string, { ten: string; loai: string; moTa: string; huong: string }>
> = {
  1: {
    'Đông Nam': { ...SAO_BAT_TRACH.SinhKhi, huong: 'Đông Nam' },
    Đông: { ...SAO_BAT_TRACH.ThienY, huong: 'Đông' },
    Nam: { ...SAO_BAT_TRACH.DienNien, huong: 'Nam' },
    Bắc: { ...SAO_BAT_TRACH.PhucVi, huong: 'Bắc' },
    'Tây Nam': { ...SAO_BAT_TRACH.TuyetMenh, huong: 'Tây Nam' },
    'Đông Bắc': { ...SAO_BAT_TRACH.NguQuy, huong: 'Đông Bắc' },
    'Tây Bắc': { ...SAO_BAT_TRACH.LucSat, huong: 'Tây Bắc' },
    Tây: { ...SAO_BAT_TRACH.HoaHai, huong: 'Tây' },
  }, // Khảm
  2: {
    'Đông Bắc': { ...SAO_BAT_TRACH.SinhKhi, huong: 'Đông Bắc' },
    Tây: { ...SAO_BAT_TRACH.ThienY, huong: 'Tây' },
    'Tây Bắc': { ...SAO_BAT_TRACH.DienNien, huong: 'Tây Bắc' },
    'Tây Nam': { ...SAO_BAT_TRACH.PhucVi, huong: 'Tây Nam' },
    Bắc: { ...SAO_BAT_TRACH.TuyetMenh, huong: 'Bắc' },
    'Đông Nam': { ...SAO_BAT_TRACH.NguQuy, huong: 'Đông Nam' },
    Nam: { ...SAO_BAT_TRACH.LucSat, huong: 'Nam' },
    Đông: { ...SAO_BAT_TRACH.HoaHai, huong: 'Đông' },
  }, // Khôn
  3: {
    Nam: { ...SAO_BAT_TRACH.SinhKhi, huong: 'Nam' },
    Bắc: { ...SAO_BAT_TRACH.ThienY, huong: 'Bắc' },
    'Đông Nam': { ...SAO_BAT_TRACH.DienNien, huong: 'Đông Nam' },
    Đông: { ...SAO_BAT_TRACH.PhucVi, huong: 'Đông' },
    Tây: { ...SAO_BAT_TRACH.TuyetMenh, huong: 'Tây' },
    'Tây Bắc': { ...SAO_BAT_TRACH.NguQuy, huong: 'Tây Bắc' },
    'Đông Bắc': { ...SAO_BAT_TRACH.LucSat, huong: 'Đông Bắc' },
    'Tây Nam': { ...SAO_BAT_TRACH.HoaHai, huong: 'Tây Nam' },
  }, // Chấn
  4: {
    Bắc: { ...SAO_BAT_TRACH.SinhKhi, huong: 'Bắc' },
    Nam: { ...SAO_BAT_TRACH.ThienY, huong: 'Nam' },
    Đông: { ...SAO_BAT_TRACH.DienNien, huong: 'Đông' },
    'Đông Nam': { ...SAO_BAT_TRACH.PhucVi, huong: 'Đông Nam' },
    'Đông Bắc': { ...SAO_BAT_TRACH.TuyetMenh, huong: 'Đông Bắc' },
    'Tây Nam': { ...SAO_BAT_TRACH.NguQuy, huong: 'Tây Nam' },
    Tây: { ...SAO_BAT_TRACH.LucSat, huong: 'Tây' },
    'Tây Bắc': { ...SAO_BAT_TRACH.HoaHai, huong: 'Tây Bắc' },
  }, // Tốn
  6: {
    Tây: { ...SAO_BAT_TRACH.SinhKhi, huong: 'Tây' },
    'Đông Bắc': { ...SAO_BAT_TRACH.ThienY, huong: 'Đông Bắc' },
    'Tây Nam': { ...SAO_BAT_TRACH.DienNien, huong: 'Tây Nam' },
    'Tây Bắc': { ...SAO_BAT_TRACH.PhucVi, huong: 'Tây Bắc' },
    Nam: { ...SAO_BAT_TRACH.TuyetMenh, huong: 'Nam' },
    Đông: { ...SAO_BAT_TRACH.NguQuy, huong: 'Đông' },
    Bắc: { ...SAO_BAT_TRACH.LucSat, huong: 'Bắc' },
    'Đông Nam': { ...SAO_BAT_TRACH.HoaHai, huong: 'Đông Nam' },
  }, // Càn
  7: {
    'Tây Bắc': { ...SAO_BAT_TRACH.SinhKhi, huong: 'Tây Bắc' },
    'Tây Nam': { ...SAO_BAT_TRACH.ThienY, huong: 'Tây Nam' },
    'Đông Bắc': { ...SAO_BAT_TRACH.DienNien, huong: 'Đông Bắc' },
    Tây: { ...SAO_BAT_TRACH.PhucVi, huong: 'Tây' },
    Đông: { ...SAO_BAT_TRACH.TuyetMenh, huong: 'Đông' },
    Nam: { ...SAO_BAT_TRACH.NguQuy, huong: 'Nam' },
    'Đông Nam': { ...SAO_BAT_TRACH.LucSat, huong: 'Đông Nam' },
    Bắc: { ...SAO_BAT_TRACH.HoaHai, huong: 'Bắc' },
  }, // Đoài
  8: {
    'Tây Nam': { ...SAO_BAT_TRACH.SinhKhi, huong: 'Tây Nam' },
    'Tây Bắc': { ...SAO_BAT_TRACH.ThienY, huong: 'Tây Bắc' },
    Tây: { ...SAO_BAT_TRACH.DienNien, huong: 'Tây' },
    'Đông Bắc': { ...SAO_BAT_TRACH.PhucVi, huong: 'Đông Bắc' },
    'Đông Nam': { ...SAO_BAT_TRACH.TuyetMenh, huong: 'Đông Nam' },
    Bắc: { ...SAO_BAT_TRACH.NguQuy, huong: 'Bắc' },
    Đông: { ...SAO_BAT_TRACH.LucSat, huong: 'Đông' },
    Nam: { ...SAO_BAT_TRACH.HoaHai, huong: 'Nam' },
  }, // Cấn
  9: {
    Đông: { ...SAO_BAT_TRACH.SinhKhi, huong: 'Đông' },
    'Đông Nam': { ...SAO_BAT_TRACH.ThienY, huong: 'Đông Nam' },
    Bắc: { ...SAO_BAT_TRACH.DienNien, huong: 'Bắc' },
    Nam: { ...SAO_BAT_TRACH.PhucVi, huong: 'Nam' },
    'Tây Bắc': { ...SAO_BAT_TRACH.TuyetMenh, huong: 'Tây Bắc' },
    Tây: { ...SAO_BAT_TRACH.NguQuy, huong: 'Tây' },
    'Tây Nam': { ...SAO_BAT_TRACH.LucSat, huong: 'Tây Nam' },
    'Đông Bắc': { ...SAO_BAT_TRACH.HoaHai, huong: 'Đông Bắc' },
  }, // Ly
};

// --- BẢNG CUNG SỐ ---
const CUNG_SO_INFO: Record<
  number,
  {
    ten: string;
    menh: string;
    huongTot: string[];
    huongXau: string[];
    mauSac: string[];
    vatLieu: string[];
    moTa: string;
    soMayMan: string;
  }
> = {
  1: {
    ten: 'Cung Khảm',
    menh: 'Thủy',
    huongTot: ['Đông Nam', 'Đông', 'Nam', 'Bắc'],
    huongXau: ['Tây Nam', 'Đông Bắc', 'Tây Bắc', 'Tây'],
    mauSac: ['Xanh lam', 'Đen', 'Trắng'],
    vatLieu: ['Kính', 'Kim loại', 'Thủy tinh'],
    moTa: 'Cung Khảm thuộc Thủy, chủ về trí tuệ và sự nghiệp.',
    soMayMan: '1, 4, 6, 7',
  },
  2: {
    ten: 'Cung Khôn',
    menh: 'Thổ',
    huongTot: ['Đông Bắc', 'Tây', 'Tây Bắc', 'Tây Nam'],
    huongXau: ['Bắc', 'Đông Nam', 'Nam', 'Đông'],
    mauSac: ['Vàng', 'Nâu', 'Đỏ'],
    vatLieu: ['Đất nung', 'Gạch', 'Gốm sứ'],
    moTa: 'Cung Khôn thuộc Thổ, chủ về sức khỏe và gia đình.',
    soMayMan: '2, 5, 8, 9',
  },
  3: {
    ten: 'Cung Chấn',
    menh: 'Mộc',
    huongTot: ['Nam', 'Bắc', 'Đông Nam', 'Đông'],
    huongXau: ['Tây', 'Tây Bắc', 'Đông Bắc', 'Tây Nam'],
    mauSac: ['Xanh lá', 'Xanh lam', 'Đen'],
    vatLieu: ['Gỗ tự nhiên', 'Tre', 'Mây'],
    moTa: 'Cung Chấn thuộc Mộc, chủ về phát triển và sinh lực.',
    soMayMan: '1, 3, 4',
  },
  4: {
    ten: 'Cung Tốn',
    menh: 'Mộc',
    huongTot: ['Bắc', 'Nam', 'Đông', 'Đông Nam'],
    huongXau: ['Đông Bắc', 'Tây Nam', 'Tây', 'Tây Bắc'],
    mauSac: ['Xanh lá', 'Xanh lam', 'Đen'],
    vatLieu: ['Gỗ', 'Vải lụa', 'Tre'],
    moTa: 'Cung Tốn thuộc Mộc, chủ về tài lộc và may mắn.',
    soMayMan: '1, 3, 4',
  },
  5: {
    ten: 'Cung Trung Cung',
    menh: 'Thổ',
    huongTot: [],
    huongXau: [],
    mauSac: ['Vàng', 'Nâu', 'Be'],
    vatLieu: ['Đá', 'Gạch', 'Đất sét'],
    moTa: 'Cung Trung Cung thuộc Thổ, là trung tâm của bát quái.',
    soMayMan: '2, 5, 8',
  },
  6: {
    ten: 'Cung Càn',
    menh: 'Kim',
    huongTot: ['Tây', 'Đông Bắc', 'Tây Nam', 'Tây Bắc'],
    huongXau: ['Nam', 'Đông', 'Bắc', 'Đông Nam'],
    mauSac: ['Trắng', 'Vàng kim', 'Bạc'],
    vatLieu: ['Kim loại', 'Inox', 'Nhôm'],
    moTa: 'Cung Càn thuộc Kim, chủ về quyền lực và lãnh đạo.',
    soMayMan: '2, 5, 6, 7, 8',
  },
  7: {
    ten: 'Cung Đoài',
    menh: 'Kim',
    huongTot: ['Tây Bắc', 'Tây Nam', 'Đông Bắc', 'Tây'],
    huongXau: ['Đông', 'Nam', 'Đông Nam', 'Bắc'],
    mauSac: ['Trắng', 'Bạc', 'Vàng nhạt'],
    vatLieu: ['Kim loại', 'Kính', 'Gốm sứ trắng'],
    moTa: 'Cung Đoài thuộc Kim, chủ về niềm vui và giao tiếp.',
    soMayMan: '2, 5, 6, 7, 8',
  },
  8: {
    ten: 'Cung Cấn',
    menh: 'Thổ',
    huongTot: ['Tây Nam', 'Tây Bắc', 'Tây', 'Đông Bắc'],
    huongXau: ['Đông Nam', 'Bắc', 'Đông', 'Nam'],
    mauSac: ['Vàng', 'Nâu đất', 'Đỏ'],
    vatLieu: ['Đá', 'Gạch thô', 'Đất nung'],
    moTa: 'Cung Cấn thuộc Thổ, chủ về sự ổn định và tích lũy.',
    soMayMan: '2, 5, 8, 9',
  },
  9: {
    ten: 'Cung Ly',
    menh: 'Hỏa',
    huongTot: ['Đông', 'Đông Nam', 'Bắc', 'Nam'],
    huongXau: ['Tây Bắc', 'Tây', 'Tây Nam', 'Đông Bắc'],
    mauSac: ['Đỏ', 'Cam', 'Xanh lá'],
    vatLieu: ['Gỗ sơn', 'Vật liệu nhân tạo'],
    moTa: 'Cung Ly thuộc Hỏa, chủ về danh tiếng và trí tuệ.',
    soMayMan: '3, 4, 9',
  },
};

const NGU_HANH_TUONG_SINH: Record<string, string> = {
  Kim: 'Thổ',
  Thủy: 'Kim',
  Mộc: 'Thủy',
  Hỏa: 'Mộc',
  Thổ: 'Hỏa',
};
const NGU_HANH_TUONG_KHAC: Record<string, string> = {
  Kim: 'Hỏa',
  Mộc: 'Kim',
  Thổ: 'Mộc',
  Thủy: 'Thổ',
  Hỏa: 'Thủy',
};

@Injectable()
export class FengshuiService {
  constructor(private readonly prisma: PrismaService) { }

  private lunarYearFromSolar(day: number, month: number, year: number): number {
    if (month < 2 || (month === 2 && day < 5)) return year - 1;
    return year;
  }

  private tinhCungSo(lunarYear: number, gender: Gender): number {
    const base = (lunarYear - 1900) % 9;
    const cung = gender === Gender.MALE ? (10 - base) % 9 : (base + 5) % 9;
    return cung === 0 ? 9 : cung;
  }

  private tinhCanChi(year: number): string {
    return `${CAN[year % 10]} ${CHI[year % 12]}`;
  }

  private tinhConGiap(year: number): {
    chi: string;
    ten: string;
    emoji: string;
    tinhCach: string;
  } {
    const chi = CHI[year % 12];
    return {
      chi,
      ...(CON_GIAP[chi] ?? { ten: 'Không rõ', emoji: '❓', tinhCach: '' }),
    };
  }

  // ĐÃ FIX: Kiểu trả về khai báo chính xác { n, y, v } và đảm bảo đủ dấu ngoặc {}
  private tinhNapAmVaVan(canChiStr: string): {
    n: string;
    y: string;
    v: string;
  } {
    // 1. Kho dữ liệu phân tích sâu cho 30 Ngũ Hành Nạp Âm
    const NAP_AM_CHI_TIET: Record<string, { y: string; v: string }> = {
      'Hải Trung Kim': {
        y: 'Vàng trong biển',
        v: 'Mang bản mệnh Hải Trung Kim, người này thường có tài năng tiềm ẩn, tính cách trầm tĩnh, sâu sắc và khó đoán.\n\n• Tiền vận (Tuổi trẻ): Thường sống nội tâm, tài năng chưa có đất dụng võ, phải tự lực cánh sinh nhiều.\n• Trung vận: Bắt đầu tỏa sáng khi gặp đúng thời cơ hoặc có quý nhân phù trợ. Công danh sự nghiệp vững chắc dần.\n• Hậu vận: Cuộc sống an nhàn, sung túc, có của ăn của để nếu biết nắm bắt cơ hội ở tuổi trung niên.',
      },
      'Lư Trung Hỏa': {
        y: 'Lửa trong lò',
        v: 'Bản mệnh Lư Trung Hỏa đại diện cho sức sống mãnh liệt, nhiệt huyết và có ý chí vươn lên mạnh mẽ.\n\n• Tiền vận: Thường vất vả lập nghiệp sớm, nhiều tham vọng nhưng đôi khi nóng vội nên dễ vấp ngã.\n• Trung vận: Công danh rực rỡ, phát đạt nhanh chóng nhờ bản lĩnh vững vàng. Lập được nhiều thành tựu lớn.\n• Hậu vận: Cần chú ý kiềm chế sự nóng nảy để giữ vững tài lộc, tận hưởng cuộc sống gia đạo viên mãn.',
      },
      'Đại Lâm Mộc': {
        y: 'Gỗ rừng già',
        v: 'Người mang mệnh Đại Lâm Mộc có tấm lòng bao dung, hay che chở và thích làm việc thiện.\n\n• Tiền vận: Là giai đoạn không ngừng học hỏi, rèn luyện bản thân trong môi trường kỷ luật.\n• Trung vận: Đứng vững giữa phong ba như cây cổ thụ. Thường giữ vị trí lãnh đạo, được nhiều người nể trọng.\n• Hậu vận: Phúc lộc dồi dào, để lại nhiều phước đức và nền tảng vững chắc cho con cháu.',
      },
      'Lộ Bàng Thổ': {
        y: 'Đất ven đường',
        v: 'Bản mệnh Lộ Bàng Thổ mang nét tính cách ôn hòa, rộng lượng, dễ gần và có sức chịu đựng cao.\n\n• Tiền vận: Cuộc sống trôi qua bình lặng, đôi khi sự nghiệp đến chậm hơn so với bạn bè đồng trang lứa.\n• Trung vận: Mở rộng được nhiều mối quan hệ tốt. Nhờ sự kiên nhẫn, công danh bắt đầu ổn định và thăng tiến.\n• Hậu vận: Cuộc sống bình an, viên mãn, không phải lo nghĩ nhiều về vật chất.',
      },
      'Kiếm Phong Kim': {
        y: 'Vàng mũi kiếm',
        v: 'Kiếm Phong Kim là kim loại được tôi luyện sắc bén, tượng trưng cho sự quyết đoán, cương trực và mạnh mẽ.\n\n• Tiền vận: Phải trải qua nhiều thử thách, rèn giũa khắt khe để tạo nên bản lĩnh sắt đá.\n• Trung vận: Vượt qua mọi trở ngại, dễ đạt đỉnh cao quyền lực hoặc thành công rực rỡ trong kinh doanh.\n• Hậu vận: Quyền uy hiển hách, tuy nhiên cần tu tâm dưỡng tính để bớt phần sắc sảo, gia đạo thêm êm ấm.',
      },
      'Sơn Đầu Hỏa': {
        y: 'Lửa trên núi',
        v: 'Mang bản mệnh Sơn Đầu Hỏa, người này có nội tâm nhiệt huyết, rực rỡ nhưng bề ngoài lại khá kín đáo.\n\n• Tiền vận: Âm thầm phấn đấu, ít phô trương, thường tự mình gánh vác nhiều trách nhiệm.\n• Trung vận: Tỏa sáng rực rỡ, thành công vang dội khiến nhiều người bất ngờ. Tài vận hanh thông.\n• Hậu vận: Sung túc, giàu sang. Tuy nhiên cần biết điểm dừng, tránh phô trương để giữ vẹn toàn lộc trời.',
      },
      'Giản Hạ Thủy': {
        y: 'Nước dưới khe',
        v: 'Bản mệnh Giản Hạ Thủy mang đến sự khéo léo, linh hoạt, khi thì êm ả, lúc lại dữ dội khó lường.\n\n• Tiền vận: Hay do dự, chưa định hướng rõ ràng con đường đi, thường phải thử sức ở nhiều lĩnh vực.\n• Trung vận: Biết nhu biết cương đúng lúc, ngoại giao xuất sắc. Đạt được nhiều thành tựu và tài lộc bất ngờ.\n• Hậu vận: Thanh nhàn, thích cuộc sống tĩnh lặng, tự do tự tại bên gia đình.',
      },
      'Thành Đầu Thổ': {
        y: 'Đất trên thành',
        v: 'Thành Đầu Thổ là bờ cõi vững chắc. Người mệnh này kiên định, sống có nguyên tắc và rất đáng tin cậy.\n\n• Tiền vận: Trải qua nhiều gian nan để tự xây dựng nền móng kiến thức và sự nghiệp.\n• Trung vận: Sự nghiệp kiên cố, khó ai lay chuyển được. Trở thành chỗ dựa vững chắc cho cả gia đình và công ty.\n• Hậu vận: An cư lạc nghiệp, điền sản dồi dào, thảnh thơi hưởng phước.',
      },
      'Bạch Lạp Kim': {
        y: 'Vàng chân đèn',
        v: 'Là kim loại đang trong quá trình luyện nung, người mệnh này luôn khát khao học hỏi và tiến bộ.\n\n• Tiền vận: Phải chịu sự rèn giũa khắc nghiệt, đôi lúc cảm thấy mông lung giữa nhiều ngã rẽ.\n• Trung vận: Loại bỏ được tạp niệm, tỏa sáng rực rỡ và phát huy tối đa năng lực xuất chúng.\n• Hậu vận: Giàu sang phú quý, được người đời kính nể nhờ trí tuệ sáng suốt.',
      },
      'Dương Liễu Mộc': {
        y: 'Gỗ cây liễu',
        v: 'Người mệnh Dương Liễu Mộc có dáng vẻ mềm mỏng, ôn hòa nhưng bên trong lại dẻo dai vô cùng.\n\n• Tiền vận: Gió dập sóng dồi nhưng không bao giờ gục ngã, luôn biết cách thích nghi với hoàn cảnh.\n• Trung vận: Uyển chuyển trong ngoại giao, được lòng nhiều người nên tài lộc sinh sôi nảy nở.\n• Hậu vận: Được mọi người yêu quý, gia đạo hòa thuận, sống đời an nhàn.',
      },
      'Tuyền Trung Thủy': {
        y: 'Nước trong suối',
        v: 'Mang bản mệnh Tuyền Trung Thủy róc rách không ngừng, có nội tâm phong phú, linh hoạt và thông minh.\n\n• Tiền vận: Thích tự do khám phá, phải trải qua bôn ba vất vả để tự rèn giũa bản lĩnh. Tài lộc tụ tán thất thường.\n• Trung vận: Từ sau 30 tuổi, nhờ sự nhạy bén, công danh bắt đầu phất lên vững chắc, tài lộc dồi dào.\n• Hậu vận: Hưởng phú quý an nhàn, gia đạo bình yên êm ấm nếu biết giữ tâm thế bình hòa.',
      },
      'Ốc Thượng Thổ': {
        y: 'Đất trên mái',
        v: 'Ốc Thượng Thổ tượng trưng cho sự che chở. Người mệnh này sống rất bao dung, có tinh thần hy sinh.\n\n• Tiền vận: Phải tự lập sớm, thường lo toan cho người khác nhiều hơn cho bản thân mình.\n• Trung vận: Trở thành trụ cột không thể thiếu của gia đình hoặc tổ chức. Vận trình công danh ổn định, chắc chắn.\n• Hậu vận: Cơ ngơi vững vàng, con cháu hiếu thuận, hưởng phúc lộc về già.',
      },
      'Tích Lịch Hỏa': {
        y: 'Lửa sấm sét',
        v: 'Tích Lịch Hỏa là ngọn lửa mạnh mẽ, chớp nhoáng. Người mệnh này cực kỳ nhanh nhẹn và quyết đoán.\n\n• Tiền vận: Cuộc sống thăng trầm nhanh chóng, có những thành công sớm nhưng cũng dễ gặp thất bại.\n• Trung vận: Nắm bắt thời cơ xuất thần, bạo phát bạo lợi. Sự nghiệp phất lên như diều gặp gió.\n• Hậu vận: Tiền tài viên mãn. Tuy nhiên cần biết điểm dừng và kiềm chế bản tính nóng nảy để giữ thành quả.',
      },
      'Tùng Bách Mộc': {
        y: 'Gỗ tùng bách',
        v: 'Đại diện cho sức sống mãnh liệt giữa mùa đông, người Tùng Bách Mộc vô cùng kiên cường và có chí khí.\n\n• Tiền vận: Chịu nhiều sương gió, thử thách, nhưng ý chí không bao giờ bị dập tắt.\n• Trung vận: Vươn lên mạnh mẽ khỏi nghịch cảnh, đạt được uy danh lẫy lừng và vị thế cao trong xã hội.\n• Hậu vận: Sống cuộc đời cao sang, phúc thọ trường tồn, viên mãn mọi đường.',
      },
      'Trường Lưu Thủy': {
        y: 'Nước sông dài',
        v: 'Mệnh Trường Lưu Thủy có tầm nhìn xa trông rộng, chí hướng lớn và không thích sự gò bó.\n\n• Tiền vận: Thường hay di chuyển, nay đây mai đó để tìm kiếm lý tưởng và đam mê thực sự.\n• Trung vận: Mọi việc bắt đầu trôi chảy, tích tiểu thành đại, mở rộng quy mô làm ăn rất tốt.\n• Hậu vận: Tài lộc cuồn cuộn như dòng sông dài, cơ ngơi đồ sộ, cuộc sống vương giả.',
      },
      'Sa Trung Kim': {
        y: 'Vàng trong cát',
        v: 'Người mệnh Sa Trung Kim sống khiêm nhường, âm thầm bồi đắp giá trị bản thân, làm việc rất cẩn trọng.\n\n• Tiền vận: Vất vả như đãi cát tìm vàng, thường bị che lấp tài năng, ít người thấu hiểu.\n• Trung vận: Bất ngờ phát quang rực rỡ khi tìm được đúng môi trường phát triển. Tài lộc hội tụ.\n• Hậu vận: Của cải dư dả, hưởng thụ thành quả mỹ mãn do chính sự kiên nhẫn của mình tạo ra.',
      },
      'Sơn Hạ Hỏa': {
        y: 'Lửa dưới núi',
        v: 'Bản mệnh Sơn Hạ Hỏa sống rất thực tế, không phô trương, luôn mang lại cảm giác ấm áp cho người xung quanh.\n\n• Tiền vận: Cuộc sống bình dị, đôi khi thiếu đi sự bứt phá do tính cách cẩn toàn.\n• Trung vận: Nhờ nỗ lực không ngừng nghỉ, ánh sáng thành công bắt đầu lan tỏa. Sự nghiệp thăng tiến vững vàng.\n• Hậu vận: Gia đạo ấm no, hạnh phúc. Vật chất đủ đầy không phải lo nghĩ.',
      },
      'Bình Địa Mộc': {
        y: 'Gỗ đồng bằng',
        v: 'Người mang mệnh Bình Địa Mộc vô cùng hiền lành, dễ gần, thích cuộc sống bình yên, ít bon chen.\n\n• Tiền vận: Cuộc sống trôi qua êm ả, dễ chịu, thường nhận được sự giúp đỡ từ người thân.\n• Trung vận: Phát triển công danh ở mức bình ổn, không thích tranh giành nhưng lộc lá vẫn tự tìm đến.\n• Hậu vận: Thanh thản, vô lo vô nghĩ, có duyên với điền sản và đất đai.',
      },
      'Bích Thượng Thổ': {
        y: 'Đất trên vách',
        v: 'Mệnh Bích Thượng Thổ tượng trưng cho sự che chắn. Đây là mẫu người sống có trách nhiệm, đáng tin cậy.\n\n• Tiền vận: Phải nỗ lực cá nhân rất nhiều, ít có chỗ dựa dẫm, tự mình vượt khó.\n• Trung vận: Trở thành cánh tay đắc lực của cấp trên hoặc có đối tác tin cậy. Công danh hanh thông rực rỡ.\n• Hậu vận: Phúc đức sâu dày, gia đình đầm ấm, hậu vận vô cùng sung sướng.',
      },
      'Kim Bạch Kim': {
        y: 'Vàng pha bạc',
        v: 'Người mệnh Kim Bạch Kim có tâm hồn thuần khiết, cương trực, nói là làm, không thích sự giả tạo.\n\n• Tiền vận: Vì tính quá thẳng thắn nên đôi khi chịu thiệt thòi trong các mối quan hệ xã giao.\n• Trung vận: Được cấp trên và đối tác tín nhiệm tuyệt đối, giao phó nhiều trọng trách lớn sinh tài lộc.\n• Hậu vận: Nắm giữ quyền uy, tài chính giàu mạnh, được xã hội nể trọng.',
      },
      'Phú Đăng Hỏa': {
        y: 'Lửa ngọn đèn',
        v: 'Phú Đăng Hỏa là ngọn lửa xua tan đêm tối. Người mệnh này cực kỳ thông minh sáng láng và hay giúp đời.\n\n• Tiền vận: Thích làm việc thiện, nhiệt tình nhưng đôi khi bị người khác lợi dụng lòng tốt.\n• Trung vận: Tỏa sáng rực rỡ nhất trong những hoàn cảnh khó khăn. Sự nghiệp phát triển rực rỡ, danh tiếng vang xa.\n• Hậu vận: Trở thành bậc tiền bối uy tín, cuộc sống cao sang quyền quý.',
      },
      'Thiên Hà Thủy': {
        y: 'Nước trên trời',
        v: 'Bản mệnh Thiên Hà Thủy có trí tuệ cao siêu, mang lại sự mát mẻ, tốt lành cho vạn vật xung quanh.\n\n• Tiền vận: Suy nghĩ bay bổng, tâm hồn nghệ sĩ, đôi khi thiếu đi tính thực tế trong công việc.\n• Trung vận: Thấm nhuần nhân sinh quan, tạo ra những giá trị lớn mạnh cho cộng đồng, tài lộc dồi dào.\n• Hậu vận: Cảnh giới tinh thần thanh cao, vừa có tiền tài vừa có sự kính trọng của xã hội.',
      },
      'Đại Trạch Thổ': {
        y: 'Đất cồn bãi',
        v: 'Người mệnh Đại Trạch Thổ rất linh hoạt, phóng khoáng, dễ thích nghi với mọi sự thay đổi của thời cuộc.\n\n• Tiền vận: Vận trình trôi nổi, thăng trầm, thường phải đi làm ăn xa quê hương mới dễ lập nghiệp.\n• Trung vận: Tích lũy được tài sản lớn, quy tụ được lòng người. Rất có duyên vượng phát về điền sản (nhà đất).\n• Hậu vận: Tiền tài viên mãn, vinh hoa phú quý gõ cửa.',
      },
      'Thoa Xuyến Kim': {
        y: 'Vàng trang sức',
        v: 'Thoa Xuyến Kim là đồ trang sức quý giá. Người mệnh này toát lên vẻ cao quý, thanh tao và tinh tế.\n\n• Tiền vận: Sớm bộc lộ nét tài hoa và gu thẩm mỹ hơn người, thích sự hoàn hảo.\n• Trung vận: Được nhiều người nâng đỡ, trọng vọng. Thường giữ các vị thế cao hoặc thành danh trong nghệ thuật.\n• Hậu vận: An hưởng vinh hoa, tiền bạc không bao giờ là nỗi lo.',
      },
      'Tang Đố Mộc': {
        y: 'Gỗ cây dâu',
        v: 'Người mang mệnh Tang Đố Mộc sống vô cùng chịu thương chịu khó, giàu lòng vị tha và hay nhường nhịn.\n\n• Tiền vận: Thường hy sinh niềm vui cá nhân để chăm lo cho gia đình hoặc anh em.\n• Trung vận: Nhờ sự cần mẫn và nhẫn nại, công danh sự nghiệp bắt đầu có những thành quả vững chắc.\n• Hậu vận: Quả ngọt đơm bông, con cháu thành đạt làm rạng rỡ gia môn.',
      },
      'Đại Khê Thủy': {
        y: 'Nước khe lớn',
        v: 'Mệnh Đại Khê Thủy mang trong mình khát vọng vươn ra biển lớn. Tính cách năng động, sục sôi ý chí.\n\n• Tiền vận: Chứa đựng tham vọng lớn mạnh, luôn làm việc với 200% sức lực để khẳng định mình.\n• Trung vận: Vượt qua mọi thác ghềnh, đạt đỉnh cao về tự do tài chính. Lộc rơi lộc rụng rất nhiều.\n• Hậu vận: Cơ ngơi đồ sộ, cuộc sống sung túc, quyền lực và vô cùng mạnh mẽ.',
      },
      'Sa Trung Thổ': {
        y: 'Đất trong cát',
        v: 'Bản mệnh Sa Trung Thổ yêu thích sự tự do, không thích bị gò bó hay làm việc theo một khuôn mẫu cứng nhắc.\n\n• Tiền vận: Hay thay đổi định hướng, có chút ngang tàng, tiền bạc tụ rồi lại tán.\n• Trung vận: Khi tìm được đam mê thực sự sẽ phát huy năng lực khủng khiếp, mang lại nguồn tài lộc lớn lao.\n• Hậu vận: Tiêu diêu tự tại, tài chính dư dả đủ để làm bất cứ thứ gì mình thích.',
      },
      'Thiên Thượng Hỏa': {
        y: 'Lửa trên trời',
        v: 'Là ngọn lửa Thái Dương quang minh chính đại. Người mệnh này sống nhiệt huyết, bao dung và ghét sự khuất tất.\n\n• Tiền vận: Nổi bật trong đám đông, ham học hỏi và luôn là ngọn cờ đầu trong các phong trào.\n• Trung vận: Danh tiếng vang xa, được người đời kính nể. Công danh thăng tiến rực rỡ như mặt trời ban trưa.\n• Hậu vận: Tỏa sáng huy hoàng, tài lộc đỉnh cao, để lại nhiều giá trị tốt đẹp.',
      },
      'Thạch Lựu Mộc': {
        y: 'Gỗ cây lựu',
        v: 'Mệnh Thạch Lựu Mộc vô cùng cứng cỏi, không sợ gian khổ, càng trong nghịch cảnh càng vươn lên mạnh mẽ.\n\n• Tiền vận: Phải bôn ba rèn luyện, đôi khi gặp nhiều trắc trở nhưng không bao giờ lùi bước.\n• Trung vận: Đơm hoa kết trái rực rỡ. Làm đâu thắng đó, ý chí sắt đá giúp họ xây dựng cơ ngơi khổng lồ.\n• Hậu vận: Đa phúc đa thọ, đông con nhiều cháu, cuộc đời trọn vẹn.',
      },
      'Đại Hải Thủy': {
        y: 'Nước biển lớn',
        v: 'Đại Hải Thủy mang chí lớn vĩ đại. Tầm nhìn xa trông rộng, tính cách bao dung vạn vật nhưng cũng cực kỳ uy dũng.\n\n• Tiền vận: Vùng vẫy khắp nơi, không chịu ngồi yên một chỗ, luôn nuôi mộng làm nghiệp lớn.\n• Trung vận: Trở thành nhà lãnh đạo tài ba, quy tụ quần hùng. Tài lộc và của cải cuồn cuộn như nước biển.\n• Hậu vận: Quyền uy tối thượng, đứng trên đỉnh cao danh vọng, không ai sánh kịp.',
      },
    };

    // 2. Map 60 Can Chi vào 30 Nạp Âm
    const CAN_CHI_MAP: Record<string, string> = {
      'Giáp Tý': 'Hải Trung Kim',
      'Ất Sửu': 'Hải Trung Kim',
      'Bính Dần': 'Lư Trung Hỏa',
      'Đinh Mão': 'Lư Trung Hỏa',
      'Mậu Thìn': 'Đại Lâm Mộc',
      'Kỷ Tỵ': 'Đại Lâm Mộc',
      'Canh Ngọ': 'Lộ Bàng Thổ',
      'Tân Mùi': 'Lộ Bàng Thổ',
      'Nhâm Thân': 'Kiếm Phong Kim',
      'Quý Dậu': 'Kiếm Phong Kim',
      'Giáp Tuất': 'Sơn Đầu Hỏa',
      'Ất Hợi': 'Sơn Đầu Hỏa',
      'Bính Tý': 'Giản Hạ Thủy',
      'Đinh Sửu': 'Giản Hạ Thủy',
      'Mậu Dần': 'Thành Đầu Thổ',
      'Kỷ Mão': 'Thành Đầu Thổ',
      'Canh Thìn': 'Bạch Lạp Kim',
      'Tân Tỵ': 'Bạch Lạp Kim',
      'Nhâm Ngọ': 'Dương Liễu Mộc',
      'Quý Mùi': 'Dương Liễu Mộc',
      'Giáp Thân': 'Tuyền Trung Thủy',
      'Ất Dậu': 'Tuyền Trung Thủy',
      'Bính Tuất': 'Ốc Thượng Thổ',
      'Đinh Hợi': 'Ốc Thượng Thổ',
      'Mậu Tý': 'Tích Lịch Hỏa',
      'Kỷ Sửu': 'Tích Lịch Hỏa',
      'Canh Dần': 'Tùng Bách Mộc',
      'Tân Mão': 'Tùng Bách Mộc',
      'Nhâm Thìn': 'Trường Lưu Thủy',
      'Quý Tỵ': 'Trường Lưu Thủy',
      'Giáp Ngọ': 'Sa Trung Kim',
      'Ất Mùi': 'Sa Trung Kim',
      'Bính Thân': 'Sơn Hạ Hỏa',
      'Đinh Dậu': 'Sơn Hạ Hỏa',
      'Mậu Tuất': 'Bình Địa Mộc',
      'Kỷ Hợi': 'Bình Địa Mộc',
      'Canh Tý': 'Bích Thượng Thổ',
      'Tân Sửu': 'Bích Thượng Thổ',
      'Nhâm Dần': 'Kim Bạch Kim',
      'Quý Mão': 'Kim Bạch Kim',
      'Giáp Thìn': 'Phú Đăng Hỏa',
      'Ất Tỵ': 'Phú Đăng Hỏa',
      'Bính Ngọ': 'Thiên Hà Thủy',
      'Đinh Mùi': 'Thiên Hà Thủy',
      'Mậu Thân': 'Đại Trạch Thổ',
      'Kỷ Dậu': 'Đại Trạch Thổ',
      'Canh Tuất': 'Thoa Xuyến Kim',
      'Tân Hợi': 'Thoa Xuyến Kim',
      'Nhâm Tý': 'Tang Đố Mộc',
      'Quý Sửu': 'Tang Đố Mộc',
      'Giáp Dần': 'Đại Khê Thủy',
      'Ất Mão': 'Đại Khê Thủy',
      'Bính Thìn': 'Sa Trung Thổ',
      'Đinh Tỵ': 'Sa Trung Thổ',
      'Mậu Ngọ': 'Thiên Thượng Hỏa',
      'Kỷ Mùi': 'Thiên Thượng Hỏa',
      'Canh Thân': 'Thạch Lựu Mộc',
      'Tân Dậu': 'Thạch Lựu Mộc',
      'Nhâm Tuất': 'Đại Hải Thủy',
      'Quý Hợi': 'Đại Hải Thủy',
    };

    const tenNapAm = CAN_CHI_MAP[canChiStr];
    const info = tenNapAm ? NAP_AM_CHI_TIET[tenNapAm] : null;

    if (info) {
      return { n: tenNapAm, y: info.y, v: info.v };
    }
    return { n: 'Chưa rõ', y: 'Chưa rõ', v: 'Cuộc đời nhiều ẩn số.' };
  }

  private tinhTamHop(chi: string): string {
    const groups = [
      ['Thân', 'Tý', 'Thìn'],
      ['Dần', 'Ngọ', 'Tuất'],
      ['Tỵ', 'Dậu', 'Sửu'],
      ['Hợi', 'Mão', 'Mùi'],
    ];
    const match = groups.find((g) => g.includes(chi));
    return match ? match.join(' - ') : '';
  }

  private tinhTuHanhXung(chi: string): string {
    const groups = [
      ['Dần', 'Thân', 'Tỵ', 'Hợi'],
      ['Tý', 'Ngọ', 'Mão', 'Dậu'],
      ['Thìn', 'Tuất', 'Sửu', 'Mùi'],
    ];
    const match = groups.find((g) => g.includes(chi));
    return match ? match.join(' - ') : '';
  }

  private tinhMenh(lunarYear: number): string {
    const canIndex = lunarYear % 10;
    let canValue = 0;
    if ([4, 5].includes(canIndex)) canValue = 1;
    else if ([6, 7].includes(canIndex)) canValue = 2;
    else if ([8, 9].includes(canIndex)) canValue = 3;
    else if ([0, 1].includes(canIndex)) canValue = 4;
    else if ([2, 3].includes(canIndex)) canValue = 5;

    const chiIndex = lunarYear % 12;
    let chiValue = 0;
    if ([4, 5, 10, 11].includes(chiIndex)) chiValue = 0;
    else if ([6, 7, 0, 1].includes(chiIndex)) chiValue = 1;
    else if ([8, 9, 2, 3].includes(chiIndex)) chiValue = 2;

    let menhValue = canValue + chiValue;
    if (menhValue > 5) menhValue -= 5;

    switch (menhValue) {
      case 1:
        return 'Kim';
      case 2:
        return 'Thủy';
      case 3:
        return 'Hỏa';
      case 4:
        return 'Thổ';
      case 5:
        return 'Mộc';
      default:
        return 'Không rõ';
    }
  }

  private async isVipUser(userId: number): Promise<boolean> {
    if (!userId) return false;
    try {
      const now = new Date();
      const sub = await this.prisma.vipSubscription.findFirst({
        where: {
          userId,
          status: 1,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });
      return !!sub;
    } catch {
      return false;
    }
  }

  async analyze(dto: FengshuiAnalyzeDto, user?: any) {
    try {
      const [day, month, year] = dto.birthDate.split('/').map(Number);
      if (
        !day ||
        !month ||
        !year ||
        isNaN(day) ||
        isNaN(month) ||
        isNaN(year)
      ) {
        throw new Error(`Ngày sinh không hợp lệ: ${dto.birthDate}`);
      }

      const lunarYear =
        dto.calendarType === CalendarType.SOLAR
          ? this.lunarYearFromSolar(day, month, year)
          : year;

      const cungSo = this.tinhCungSo(lunarYear, dto.gender);
      const canChi = this.tinhCanChi(lunarYear);
      const menh = this.tinhMenh(lunarYear);
      const conGiap = this.tinhConGiap(lunarYear);

      const napAmInfo = this.tinhNapAmVaVan(canChi);
      const tamHop = this.tinhTamHop(conGiap.chi);
      const tuHanhXung = this.tinhTuHanhXung(conGiap.chi);

      let realCungSo = cungSo;
      let cungInfo = CUNG_SO_INFO[cungSo];
      if (cungSo === 5) {
        realCungSo = dto.gender === Gender.MALE ? 2 : 8;
        cungInfo = {
          ...CUNG_SO_INFO[realCungSo],
          ten: `Cung Trung Cung (${dto.gender === Gender.MALE ? 'Khôn' : 'Cấn'})`,
        };
      }

      const nguHanhSinh = NGU_HANH_TUONG_SINH[menh];
      const nguHanhKhac = NGU_HANH_TUONG_KHAC[menh];
      const isVip = await this.isVipUser(user?.id);

      const batTrachData = Object.values(BATTRACH_MAP[realCungSo]);
      const huongCat = batTrachData.filter((h) => h.loai === 'Cát');
      const huongHung = batTrachData.filter((h) => h.loai === 'Hung');

      const huongCanTim = cungInfo.huongTot;
      const locationWhere = dto.location
        ? {
          OR: [
            { city: { contains: dto.location } },
            { district: { contains: dto.location } },
          ],
        }
        : {};

      const takeLimit = isVip ? 8 : 4;
      const [houses, lands] = await Promise.all([
        this.prisma.house.findMany({
          where: { direction: { in: huongCanTim }, ...locationWhere },
          include: { images: true, category: true },
          take: takeLimit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.land.findMany({
          where: { direction: { in: huongCanTim }, ...locationWhere },
          include: { images: true, category: true },
          take: takeLimit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const freeData = {
        isVip,
        thongTinCaNhan: {
          ten: dto.name,
          ngaySinh: dto.birthDate,
          loaiLich:
            dto.calendarType === CalendarType.SOLAR ? 'Dương lịch' : 'Âm lịch',
          gioiTinh: dto.gender === Gender.MALE ? 'Nam' : 'Nữ',
          namAmLich: lunarYear,
          canChi,
          conGiap: {
            chi: conGiap.chi,
            ten: conGiap.ten,
            emoji: conGiap.emoji,
            tinhCach: conGiap.tinhCach,
          },
          batMiBanMenh: {
            napAm: napAmInfo.n,
            yNghiaNapAm: napAmInfo.y,
            vanMenh: napAmInfo.v,
            tamHop,
            tuHanhXung,
            soMayMan: cungInfo.soMayMan,
          },
        },
        menhCung: {
          menh,
          cungSo,
          tenCung: cungInfo.ten,
          moTa: cungInfo.moTa,
          nguHanhSinh,
          nguHanhKhac,
        },
        batTrach: { cat: huongCat, hung: huongHung },
        batDongSan: {
          nhaO: houses,
          datDai: lands,
          tongNha: houses.length,
          tongDat: lands.length,
        },
      };

      const vipData = isVip
        ? {
          phongThuyChiTiet: {
            mauSacHop: cungInfo.mauSac,
            vatLieuHop: cungInfo.vatLieu,
          },
          luuY: [
            `Nên ưu tiên cửa chính hướng Sinh Khí (${huongCat.find((h) => h.ten === 'Sinh Khí')?.huong}) để kích tài lộc cao nhất.`,
            `Tuyệt đối không xây cổng hoặc đặt giường ngủ hướng ${huongHung.find((h) => h.ten === 'Tuyệt Mệnh')?.huong} (Tuyệt Mệnh).`,
            `Màu sắc sinh vượng: ${cungInfo.mauSac.join(', ')}.`,
            `Vật liệu nạp khí tốt: ${cungInfo.vatLieu.join(', ')}.`,
            `Nên kết hợp yếu tố ${nguHanhSinh} và giảm yếu tố ${nguHanhKhac} trong thiết kế nội thất.`,
          ],
        }
        : null;

      return { ...freeData, vipData };
    } catch (error) {
      console.error('[FengshuiService] analyze error:', error);
      throw error;
    }
  }
}
