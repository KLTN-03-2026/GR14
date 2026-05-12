/**
 * @file index.dto.ts
 * @description DTO cho API POST /ai/index — trigger re-indexing dữ liệu BĐS vào Qdrant.
 *
 * Quy trình indexing (thực hiện trong AiService.indexData()):
 *   1. Lấy tối đa `limit` bản ghi mỗi loại (house, land, post) từ MySQL
 *   2. Chuyển mỗi record → IndexedDoc (nội dung text + metadata payload)
 *   3. Gọi Ollama nomic-embed-text → Dense Vector 768 chiều
 *   4. Tính BM25 Sparse Vector bằng AiUtils.buildBm25SparseVector()
 *   5. Upsert tất cả điểm vào Qdrant collection (upsert = tạo mới nếu chưa có, cập nhật nếu đã có)
 *
 * GHI CHÚ:
 *   - Lên thói quen gọi re-index khi có dữ liệu BĐS mới được đăng lên
 *   - `limit` mặc định 200 — không nên đặt quá cao — Ollama embedding tốn RAM
 *   - ID trong Qdrant: House = 1_000_000 + id | Land = 2_000_000 + id | Post = 3_000_000 + id
 */
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** DTO cho endpoint re-index dữ liệu BĐS vào Qdrant Vector DB. */
export class IndexDto {
  /**
   * Số bản ghi tối đa mỗi loại (house / land / post) sẽ được indexing.
   * Mặc định: 200. Bắt buộc phải là số nguyên dương (≥ 1).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 200;
}
