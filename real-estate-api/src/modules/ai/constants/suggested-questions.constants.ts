import { ParsedIntent } from '../types/ai.types';

type SuggestedQuestionPreset =
  | 'default'
  | 'greeting'
  | 'search_property'
  | 'recommend_property'
  | 'qa_real_estate'
  | 'compare_property'
  | 'booking'
  | 'upgrade_account'
  | 'upgrade_listing'
  | 'investment_advice'
  | 'market_analysis'
  | 'financing_advice';

const SUGGESTED_QUESTION_PRESETS: Record<SuggestedQuestionPreset, string[]> = {
  default: [
    'Tìm giúp tôi căn hộ 2 phòng ngủ giá dưới 3 tỷ',
    'Tư vấn kinh nghiệm mua nhà lần đầu',
    'Thị trường bất động sản hiện tại ra sao?',
  ],
  greeting: [
    'Tìm nhà đất tại trung tâm giá dưới 5 tỷ',
    'Gợi ý bất động sản phù hợp để đầu tư',
    'Tính giúp tôi tiền trả góp nếu vay 2 tỷ',
  ],
  search_property: [
    'So sánh các bất động sản vừa tìm được',
    'Phân tích thị trường tại khu vực này',
    'Tính giúp tôi tiền trả góp nếu vay mua nhà',
  ],
  recommend_property: [
    'So sánh các bất động sản trên',
    'Tôi muốn đặt lịch xem các căn nhà này',
    'Có thêm gợi ý nào khác không?',
  ],
  qa_real_estate: [
    'Sổ hồng và sổ đỏ khác nhau như thế nào?',
    'Thủ tục sang tên đổi chủ nhà đất cần những gì?',
    'Kinh nghiệm mua nhà trả góp lần đầu',
  ],
  compare_property: [
    'So sánh các bất động sản tôi đang xem',
    'Điểm mạnh và yếu của các căn này là gì?',
    'Nên mua bất động sản nào trong số này?',
  ],
  booking: [
    'Tôi muốn đặt lịch xem căn nhà này',
    'Làm sao để liên hệ trực tiếp với môi giới?',
    'Hướng dẫn quy trình xem nhà thực tế',
  ],
  upgrade_account: [
    'Làm sao để nâng cấp tài khoản VIP?',
    'Tài khoản VIP có quyền lợi gì đặc biệt?',
    'Hướng dẫn các gói tài khoản',
  ],
  upgrade_listing: [
    'Làm sao để tin đăng của tôi được nhiều người xem hơn?',
    'Cách đẩy tin lên trang chủ',
    'Chi phí quảng cáo bài viết là bao nhiêu?',
  ],
  investment_advice: [
    'Tư vấn giúp tôi khu vực nào đáng đầu tư nhất hiện nay',
    'Có nên mua đất nền vào thời điểm này không?',
    'Phân tích cơ hội đầu tư chung cư cho thuê',
  ],
  market_analysis: [
    'Phân tích thị trường bất động sản Đà Nẵng',
    'Giá nhà trung bình ở khu vực này là bao nhiêu?',
    'Đánh giá tiềm năng tăng giá khu vực này',
  ],
  financing_advice: [
    'Tính giúp tôi tiền trả góp nếu vay 2 tỷ mua nhà',
    'Thu nhập 20 triệu/tháng có nên vay mua nhà không?',
    'Lãi suất vay mua nhà các ngân hàng hiện nay',
  ],
};

export function getSuggestedQuestionsByPreset(
  preset: SuggestedQuestionPreset,
): string[] {
  return [...(SUGGESTED_QUESTION_PRESETS[preset] ?? SUGGESTED_QUESTION_PRESETS.default)].slice(0, 3);
}

export function getSuggestedQuestionsForIntent(
  intent?: Pick<ParsedIntent, 'type'> | null,
): string[] {
  if (!intent?.type) {
    return getSuggestedQuestionsByPreset('default');
  }

  const preset = intent.type as SuggestedQuestionPreset;
  return getSuggestedQuestionsByPreset(
    preset in SUGGESTED_QUESTION_PRESETS ? preset : 'default',
  );
}
