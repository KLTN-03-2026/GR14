/**
 * Khớp cấu trúc `VipPackage.features` từ API (JSON string hoặc object):
 * highlight, topPost, featured, urgent, badge, singlePost — hoặc mảng chuỗi.
 */
export function parseVipPackageBenefitLines(
  features: string | null | undefined | Record<string, unknown>,
): string[] {
  if (features == null) return [];

  if (typeof features === 'object' && !Array.isArray(features)) {
    return objectFeaturesToLines(features as Record<string, unknown>);
  }

  const raw = String(features).trim();
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
    if (parsed && typeof parsed === 'object') {
      return objectFeaturesToLines(parsed as Record<string, unknown>);
    }
  } catch {
    return raw
      .split(/[\n;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function objectFeaturesToLines(o: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (o.singlePost === true) {
    lines.push('Đăng tin VIP theo từng bài (ưu tiên hiển thị)');
  }
  if (o.highlight === true) {
    lines.push('Tin được làm nổi bật (highlight)');
  }
  if (o.topPost === true) {
    lines.push('Ưu tiên xếp cao trong danh sách tin');
  }
  if (o.featured === true) {
    lines.push('Vị trí nổi bật / ưu tiên trên trang');
  }
  if (o.urgent === true) {
    lines.push('Gắn nhãn tin gấp / cần giao dịch nhanh');
  }
  if (typeof o.badge === 'string' && o.badge.trim()) {
    lines.push(`Nhãn hiển thị trên tin: "${o.badge.trim()}"`);
  }
  return lines;
}
