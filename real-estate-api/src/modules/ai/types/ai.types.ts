/**
 * @file ai.types.ts
 * @description Tất cả TypeScript types & interfaces của AI Chatbot module.
 *
 * Được import và dùng chung bởi: AiService, AiChatCompareService,
 * và tất cả các sub-service trong services/.
 */

/**
 * IndexedDoc — Đơn vị dữ liệu được đưa vào Qdrant.
 * Được xây dựng từ: houseToDoc(), landToDoc(), postToDoc() trong AiService.
 *
 * ID schema (tránh xung đột giữa 3 loại dữ liệu):
 *   House: id = 1_000_000 + house.id
 *   Land:  id = 2_000_000 + land.id
 *   Post:  id = 3_000_000 + post.id
 */
export type IndexedDoc = {
  id: number;      // ID duy nhất trong Qdrant (theo schema trên)
  text: string;    // Nội dung được embed (tiêu đề, vị trí, giá, mô tả...)
  payload: Record<string, unknown>; // Metadata lưu trong Qdrant (được trả về khi search)
};


/**
 * ChatTurn — Một lượt hội thoại (user hoặc assistant).
 * Được lưu dưới dạng mảng trong Redis (ConversationState.memory, tối đa 20 turn).
 */
export type ChatTurn = {
  role: 'user' | 'assistant'; // Người gửi: user hoặc AI
  text: string;               // Nội dung tin nhắn
  at: string;                 // ISO timestamp khi gửi
};


/**
 * IntentType — 13 loại ý định chatbot hỗ trợ.
 * Được phân tích bắt đầu bằng Gemini LLM, fallback về regex nếu LLM fail.
 *
 * Mỗi intent dẫn đến luồng xử lý khác nhau trong AiService:
 *   search_property    → Hybrid Search Qdrant + LLM generate
 *   recommend_property → Hybrid Search + User Profile filter
 *   qa_real_estate     → AiQAService (Static Bank → Gemini)
 *   compare_property   → AiChatCompareService (5 strategies)
 *   booking            → Direct answer (hướng dẫn đặt lịch)
 *   upgrade_account    → Direct answer (hướng dẫn nâng cấp VIP)
 *   upgrade_listing    → Direct answer (hướng dẫn đẩy tin)
 *   greeting           → Direct answer (chào hỏi)
 *   investment_advice  → MarketInsightService.buildInvestmentAdvice()
 *   market_analysis    → MarketInsightService.buildMarketAnalysisAnswer()
 *   financing_advice   → FinancingAdvisorService.buildFinancingAnswer()
 *   unknown            → Thử RAG search, nếu không có kết quả mới báo lỗi
 */
export type IntentType =
  | 'search_property'
  | 'recommend_property'
  | 'qa_real_estate'
  | 'compare_property'
  | 'booking'
  | 'upgrade_account'
  | 'upgrade_listing'
  | 'greeting'
  | 'investment_advice'
  | 'market_analysis'
  | 'financing_advice'
  | 'unknown';


/**
 * ParsedIntent — Kết quả phân tích ý định của người dùng.
 * Được sử dụng xuyên suốt pipeline: filter Qdrant, build prompt LLM, học User Profile.
 *
 * expandedQuery là trường đặc biệt: Gemini tự sinh câu query tối ưu cho Vector Search.
 * Ví dụ: "có miếng nào cắm dùi 2 tỏi" → "dat nen gia re duoi 2 ty de o xay nha"
 */
export type ParsedIntent = {
  type: IntentType;
  minPrice?: number;              // Giá tối thiểu (VND)
  maxPrice?: number;              // Giá tối đa (VND)
  location?: string;              // Tên khu vực (có dấu)
  locationTokens?: string[];      // Các token khu vực được tách rời
  sourceType?: 'house' | 'land' | 'post'; // Loại BDS cần tìm
  requiredKeyword?: string;       // Từ khóa bắt buộc xuất hiện trong kết quả
  compareIds?: number[];          // Danh sách ID BDS cần so sánh
  compareDescriptions?: string[]; // Mô tả người dùng nhập (tìm ID bằng description)
  transactionType?: 'sale' | 'rent'; // Loại giao dịch: mua bán hay cho thuê
  purpose?: 'invest' | 'live' | 'rent_out'; // Mục đích sử dụng
  monthlyIncome?: number;         // Thu nhập hàng tháng (dùng cho FinancingAdvisor)
  downPayment?: number;           // Số tiền trả trước (dùng cho FinancingAdvisor)
  expandedQuery?: string;         // Query được LLM mở rộng — dùng cho Vector Search
};


/** VectorHit — Một kết quả trả về từ Qdrant Hybrid Search. */
export type VectorHit = {
  id: number;                      // ID điểm vector trong Qdrant
  score: number;                   // Điểm tương đồng (0–1). Bị loại nếu < 0.18
  payload: Record<string, unknown>; // Metadata được gắn lúc index
};

/** ChatSourcePayload — Thông tin một BDS được trả trong response (sources / relatedSources). */
export type ChatSourcePayload = Record<string, unknown>;


/**
 * ConversationState — Trạng thái hội thoại được lưu trong Redis.
 * TTL: 24 giờ kể từ lần tương tác cuối.
 *
 * memory: Tối đa 20 turns chat gần nhất.
 * summaryMemory: Khi memory vượt 10 turns, LLM tự động nén thành đoạn tóm tắt ≤ 1000 chars.
 */
export type ConversationState = {
  memoryKey: string;     // Redis key cho mảng chat turns
  summaryKey: string;    // Redis key cho chuỗi tóm tắt
  memory: ChatTurn[];    // Lịch sử chat (tối đa 20 turns)
  summaryMemory: string; // Tóm tắt nén (tối đa 1000 chars) — inject vào prompt LLM
};

/**
 * ChatResponsePayload — Payload trung gian được AiService xây dựng.
 * Chưa có sessionId và memoryTurns — sẽ được wrap thành ChatResult trước khi trả về client.
 */
export type ChatResponsePayload = {
  answer: string;                          // Câu trả lời đã format (text hoặc HTML)
  structured: Record<string, unknown> | null; // JSON gốc từ LLM (nếu parse thành công)
  intent: ParsedIntent;                    // Intent đã phân tích
  confidence: number;                      // Score cao nhất trong vector hits (0–1)
  sources: ChatSourcePayload[];            // BDS chính trong câu trả lời
  relatedSources: ChatSourcePayload[];     // BDS liên quan gợi ý (tối đa 3)
  suggestedQuestions: string[];            // Câu hỏi tiếp theo gợi ý cho user (tối đa 3)
};

/**
 * ChatResult — Response cuối cùng trả về cho Frontend từ POST /ai/chat.
 * Bao gồm toàn bộ ChatResponsePayload + sessionId + memoryTurns.
 */
export type ChatResult = {
  ok: true;                                // Luôn true khi thành công
  sessionId: string;                       // Echo lại sessionId của request
  answer: string;                          // Câu trả lời hiển thị cho user
  structured: Record<string, unknown> | null; // JSON gốc từ LLM
  intent: ParsedIntent;                    // Intent đã phân loại
  confidence: number;                      // Độ tin cậy của kết quả vector search
  sources: ChatSourcePayload[];            // BDS gợi ý chính
  relatedSources: ChatSourcePayload[];     // BDS liên quan
  suggestedQuestions: string[];            // Câu hỏi gợi ý tiếp theo
  memoryTurns: number;                     // Số turns đang lưu trong Redis memory
};

// ─── User Profile ────────────────────────────────────────────────────────────

/**
 * UserProfile — Hồ sơ người dùng được học từ các lượt tương tác.
 * Lưu trong Redis với TTL 7 ngày, key: ai:profile:{sessionId}.
 * Được sử dụng bởi UserProfileService, inject vào system prompt Gemini.
 */
export type UserProfile = {
  sessionId: string;              // ID phiên âm dầu (liên kết với Redis key)
  preferredAreas: string[];       // Khu vực đã tìm kiếm (tối đa 5)
  preferredDistricts: string[];   // Quận/huyện ưa thích (tối đa 5)
  budgetMin?: number;             // Ngân sách tối thiểu (VND)
  budgetMax?: number;             // Ngân sách tối đa (VND)
  propertyType?: 'house' | 'land'; // Loại BDS đang quan tâm
  purpose?: 'invest' | 'live' | 'rent_out'; // Mục đích sử dụng
  bedrooms?: number;              // Số phòng ngủ mong muốn
  transactionType?: 'sale' | 'rent'; // Loại giao dịch: mua hoặc thuê
  viewedPropertyIds: number[];    // BDS đã xem (tối đa 50)
  dislikedPropertyIds: number[];  // BDS đã dislike — loại khỏi kết quả (tối đa 30)
  interactionCount: number;       // Tổng số lượt chat
  lastActiveAt: string;           // ISO timestamp của lần tương tác cuối
  keywords: string[];             // Từ khóa đã tích lũy (tối đa 10)
};



// ─── Market Insight ──────────────────────────────────────────────────────────

/**
 * MarketInsight — Dữ liệu thị trường được tổng hợp từ MySQL.
 * Được cache vào Redis với TTL 1 giờ (key: ai:market:{area}:{type}).
 */
export type MarketInsight = {
  area: string;                          // Khu vực phân tích
  avgPrice: number;                      // Giá trung bình (VND)
  minPrice: number;                      // Giá thấp nhất
  maxPrice: number;                      // Giá cao nhất
  totalListings: number;                 // Tổng số tin đăng đã lọc (chỉ tuyện mãi)
  avgPricePerM2: number;                 // Giá trung bình/m²
  priceBreakdown: { range: string; count: number }[]; // Phân bố giá theo dải
};

// ─── Financing ───────────────────────────────────────────────────────────────

/**
 * FinancingResult — Kết quả tính toán khả năng vay ngân hàng.
 * Được tính bằng công thức PMT trong FinancingAdvisorService.calculateFinancing().
 *
 * Có 2 chế độ:
 *   Thu nhập → Tính tối đa vay được và giá BDS có thể mua
 *   Giá BDS → Tính số tiền trả góp hàng tháng
 */
export type FinancingResult = {
  maxLoanAmount: number;         // Số tiền vay tối đa (VND)
  monthlyPayment: number;        // Tiền trả góp hàng tháng (VND)
  totalInterest: number;         // Tổng lãi phải trả trong suốt kỳ vay
  totalPayment: number;          // Tổng tiền phải trả (gốc + lãi)
  affordablePrice: number;       // Giá BDS có thể mua với thu nhập hiện tại
  loanToValue: number;           // Tỷ lệ vay/giá trị (mặc định 70%)
  interestRate: number;          // Lãi suất hàng năm (ưu đãi năm đầu 8%)
  loanTermYears: number;         // Kỳ hạn vay (mặc định 20 năm)
  downPaymentRequired: number;   // Số tiền cần trả trước (giá - vay)
};
