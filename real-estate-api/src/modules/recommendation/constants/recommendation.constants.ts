/**
 * ==================== BẢNG CẤU HÌNH HỆ THỐNG GỢI Ý ====================
 * File này chứa TẤT CẢ con số cấu hình. Muốn thay đổi hành vi hệ thống
 * chỉ cần sửa ở đây, không cần sửa logic.
 */

// ==================== Cache TTL (Time To Live) ====================
// Thời gian lưu cache trong Redis (đơn vị: giây)
// Sau khi hết TTL, lần request tiếp theo sẽ tính toán lại từ đầu

/** Cache kết quả gợi ý: 5 phút. Nghĩa là trong 5 phút, mọi request đều trả cùng 1 kết quả */
export const RECOMMENDATION_TTL = 300;

/** Cache user vector (embedding): 1 giờ. Vector ít thay đổi nên cache lâu hơn */
export const EMBEDDING_CACHE_TTL = 3600;

// ==================== Qdrant ID Offsets ====================
// Trong Qdrant (Vector DB), mỗi BĐS cần 1 ID duy nhất.
// Nhà và đất có thể trùng ID trong MySQL (VD: nhà id=5, đất id=5)
// → Dùng offset để phân biệt:
//   Nhà id=5  → qdrantId = 1_000_000 + 5 = 1_000_005
//   Đất id=5  → qdrantId = 2_000_000 + 5 = 2_000_005
// → Không bao giờ trùng nhau trong Qdrant

export const HOUSE_ID_OFFSET = 1_000_000;
export const LAND_ID_OFFSET = 2_000_000;

// ==================== Trọng số hành vi ====================
// Mỗi hành vi của user có mức độ quan trọng khác nhau.
// VD: User "save" 1 BĐS cho thấy sự quan tâm cao hơn chỉ "click" xem qua.
// Trọng số này ảnh hưởng trực tiếp đến User Profile và User Vector.

export const BEHAVIOR_WEIGHTS = {
  /** Save (lưu BĐS): quan tâm cao nhất → trọng số 3 */
  SAVE: 3,
  /** Click (nhấn xem chi tiết): quan tâm vừa → trọng số 2 */
  CLICK: 2,
  /** Hành vi mặc định: trọng số thấp nhất */
  DEFAULT: 1,
  /** Thêm vào danh sách yêu thích: tương đương save → trọng số 3 */
  FAVORITE: 3,
} as const;

// ==================== Trọng số chấm điểm (Rule-based Scoring) ====================
// Mỗi BĐS ứng viên được chấm điểm từ 0 → 1 dựa trên 4 tiêu chí:
// Giá (30%) + Khu vực (30%) + Tương đồng (30%) + Đa dạng/Mới (10%) = 100%

export const SCORING_WEIGHTS = {
  /** Giá phù hợp đóng góp 30% tổng điểm.
   *  VD: User thích nhà 5 tỷ → BĐS 4 tỷ được 80% × 30% = 0.24 điểm */
  PRICE_MATCH: 0.3,

  /** Khu vực quen thuộc đóng góp 30%.
   *  VD: User xem Q7 nhiều nhất → BĐS ở Q7 được điểm cao nhất */
  LOCATION_MATCH: 0.3,

  /** Tương đồng (category + diện tích) đóng góp 30%.
   *  VD: User hay xem "Nhà phố" 100m² → BĐS "Nhà phố" 95m² được điểm cao */
  SIMILARITY: 0.3,

  /** Bonus cho BĐS ở khu vực user CHƯA từng xem → khám phá mới */
  DIVERSITY_BONUS: 0.05,

  /** Bonus cho BĐS mới đăng (< 7 ngày) → ưu tiên tin mới */
  FRESHNESS_BOOST: 0.03,

  /** BĐS đăng trong bao nhiêu ngày được coi là "mới" */
  FRESHNESS_DAYS: 7,

  /** Bonus cho đất có loại phù hợp (thổ cư, nông nghiệp...) */
  LAND_TYPE_BONUS: 0.1,

  /** Trọng số phụ: category chiếm 40% trong nhóm "tương đồng" */
  CATEGORY_SUB_WEIGHT: 0.4,

  /** Trọng số phụ: diện tích chiếm 30% trong nhóm "tương đồng" */
  AREA_SUB_WEIGHT: 0.3,
} as const;

// ==================== Cấu hình Embedding (AI) ====================
// Quyết định khi nào tin AI nhiều, khi nào tin Rules nhiều.
// User có nhiều tương tác → data phong phú → embedding chính xác hơn → tăng trọng số AI.

export const EMBEDDING_CONFIG = {
  /** Nếu user có > 10 tương tác → dùng embedding weight cao */
  HIGH_INTERACTION_THRESHOLD: 10,

  /** Trọng số embedding khi user có nhiều tương tác (AI chiếm 70%, Rules 30%) */
  HIGH_EMBEDDING_WEIGHT: 0.7,

  /** Trọng số embedding khi user có ít tương tác (AI chỉ 40%, Rules 60%) */
  LOW_EMBEDDING_WEIGHT: 0.4,

  /** Ngưỡng embedding score để hiển thị tag "AI đề xuất phù hợp" */
  AI_SUGGEST_THRESHOLD: 0.5,

  /** Điểm vector search tối thiểu để giữ kết quả (dưới 0.1 = noise, bỏ) */
  MIN_SCORE_THRESHOLD: 0.1,

  /** Sàn normalize: score < 0.2 → coi như 0 (không liên quan) */
  NORMALIZATION_FLOOR: 0.2,
} as const;

// ==================== Đa dạng hóa kết quả ====================
// Tránh gợi ý toàn BĐS giống nhau (VD: 10 nhà ở Q7 giá 3 tỷ → nhàm chán)
// Mỗi "nhóm" (quận + tầm giá + loại) chỉ được tối đa 3 BĐS

export const DIVERSITY_CONFIG = {
  /** VD: max 3 BĐS cùng nhóm "Q7 | 3-5 tỷ | house" */
  MAX_PER_BUCKET: 3,
} as const;

// ==================== Ngưỡng giá (VND) để phân nhóm ====================
// Dùng trong diversity filter để gom BĐS cùng tầm giá vào 1 nhóm

export const PRICE_BUCKETS = {
  UNDER_1B: 1_000_000_000, // Dưới 1 tỷ
  UNDER_3B: 3_000_000_000, // Dưới 3 tỷ
  UNDER_5B: 5_000_000_000, // Dưới 5 tỷ
  UNDER_10B: 10_000_000_000, // Dưới 10 tỷ
  // Trên 10 tỷ = "over10ty"
} as const;

// ==================== Giới hạn truy vấn ====================
// Số lượng record tối đa cho từng loại query

export const QUERY_LIMITS = {
  /** Lấy tối đa 100 hành vi gần nhất (cho AI recommendation) */
  BEHAVIOR_LIMIT: 100,
  /** Lấy tối đa 50 hành vi (cho legacy house/land recommendation) */
  LEGACY_BEHAVIOR_LIMIT: 50,
  /** Tối đa 200 BĐS ứng viên từ DB (legacy) */
  CANDIDATE_LIMIT: 200,
  /** Tối đa 100 kết quả từ Qdrant vector search */
  VECTOR_CANDIDATE_LIMIT: 100,
  /** Lấy top 10 tương tác mạnh nhất để tạo text embedding (fallback) */
  TOP_INTERACTIONS_FOR_TEXT: 10,
  /** Mặc định trả về 10 BĐS cho AI recommendation */
  AI_DEFAULT_LIMIT: 10,
  /** Mặc định trả về 5 BĐS cho legacy house/land */
  LEGACY_DEFAULT_LIMIT: 5,
  /** Tối đa 50 BĐS ứng viên từ DB (cho AI hybrid) */
  DB_CANDIDATE_LIMIT: 50,
  /** Lấy top 5 khu vực yêu thích nhất để tạo filter */
  TOP_LOCATION_LIMIT: 5,
  /** Lấy top 5 loại BĐS yêu thích nhất để tạo filter */
  TOP_CATEGORY_LIMIT: 5,
  /** Lọc giá ±50% so với giá trung bình user thích.
   *  VD: user thích 4 tỷ → lọc từ 2 tỷ đến 6 tỷ */
  PRICE_RANGE_TOLERANCE: 0.5,
  /** Lọc diện tích ±50% tương tự */
  AREA_RANGE_TOLERANCE: 0.5,
} as const;

// ==================== Cache Key Builders ====================
// Tạo key Redis cho từng loại cache, theo userId.
// VD: User 42 → key = "recommendations:ai:42"

export const cacheKeys = {
  houseRecommendation: (userId: number) => `recommendations:houses:${userId}`,
  landRecommendation: (userId: number) => `recommendations:lands:${userId}`,
  aiRecommendation: (userId: number) => `recommendations:ai:${userId}`,
  userVector: (userId: number) => `recommendations:uservec:${userId}`,
} as const;
