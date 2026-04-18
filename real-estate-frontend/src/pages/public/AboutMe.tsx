import { useEffect, useRef, useState } from "react";

import banner1 from "../../assets/ABbn1.jpg";
import banner2 from "../../assets/ABbn2.jpg";
import banner3 from "../../assets/ABbn3.jpg";

import iconMinhBach from "../../assets/muctieu.png";
import iconTienPhong from "../../assets/tamnhin.png";
import iconTanTam from "../../assets/giatri.png";

import anhCauChuyen from "../../assets/imggiatri.jpg";

const anhSuMenh =
  "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80";
const anhLienHe =
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80";

const slideImages = [banner1, banner2, banner3];


function useScrollReveal(threshold = 0.15): {
  ref: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}


const baseTransition =
  "transition-all duration-700 ease-out";

const fromBottom = (visible: boolean) =>
  `${baseTransition} ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
  }`;

const fromRight = (visible: boolean) =>
  `${baseTransition} ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-16"
  }`;

const fromLeft = (visible: boolean) =>
  `${baseTransition} ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-16"
  }`;

const fadeIn = (visible: boolean) =>
  `${baseTransition} ${visible ? "opacity-100" : "opacity-0"}`;

// ─────────────────────────────────────────────────────────────────────────────

const AboutMe = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Bóc tách biến để tránh lỗi "Cannot access refs during render"
  const { ref: heroRef, visible: heroVisible } = useScrollReveal(0.1);

  // --- Giá Trị Cốt Lõi ---
  const { ref: coreTitleRef, visible: coreTitleVisible } = useScrollReveal(0.1);
  const { ref: core1Ref, visible: core1Visible } = useScrollReveal(0.15);
  const { ref: core2Ref, visible: core2Visible } = useScrollReveal(0.15);
  const { ref: core3Ref, visible: core3Visible } = useScrollReveal(0.15);

  // --- Câu Chuyện ---
  const { ref: storyImgRef, visible: storyImgVisible } = useScrollReveal(0.15);
  const { ref: storyTextRef, visible: storyTextVisible } = useScrollReveal(0.15);

  // --- Sứ Mệnh ---
  const { ref: missionTextRef, visible: missionTextVisible } = useScrollReveal(0.15);
  const { ref: missionImgRef, visible: missionImgVisible } = useScrollReveal(0.15);

  // --- Liên Hệ ---
  const { ref: contactImgRef, visible: contactImgVisible } = useScrollReveal(0.15);
  const { ref: contactFormRef, visible: contactFormVisible } = useScrollReveal(0.15);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white min-h-screen font-sans text-gray-800">

      {/* ── Hero ── */}
      <div className="bg-gray-50 py-20 px-6">
        <div
          ref={heroRef}
          className={`max-w-7xl mx-auto text-center ${fromBottom(heroVisible)}`}
        >
          <h1 className="text-5xl font-bold text-gray-900 mb-8">
            Về Chúng Tôi
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-gray-700 leading-relaxed mb-16">
            Black's City tiên phong ứng dụng AI để cá nhân hóa hành trình tìm kiếm nhà ở. Với trợ lý ảo 24/7 và hệ thống gợi ý thông minh, chúng tôi giúp bạn kết nối với không gian sống lý tưởng nhanh chóng và chính xác nhất.
          </p>
          <div className="relative h-[500px] overflow-hidden rounded-3xl shadow-lg max-w-6xl mx-auto">
            <img
              src={slideImages[currentSlide]}
              alt="Black's City Banner"
              className="w-full h-full object-cover transition-opacity duration-700"
            />
          </div>
        </div>
      </div>

      {/* ── Giá Trị Cốt Lõi ── */}
      <div className="max-w-7xl mx-auto py-24 px-6">
        <div ref={coreTitleRef} className={fadeIn(coreTitleVisible)}>
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            Giá Trị Cốt Lõi
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-12 text-center">

          {/* Card 1 */}
          <div
            ref={core1Ref}
            style={{ transitionDelay: "0ms" }}
            className={`flex flex-col items-center ${fromBottom(core1Visible)}`}
          >
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 w-24 h-24 flex items-center justify-center">
              <img src={iconMinhBach} alt="Minh Bạch" className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-900">Minh Bạch</h3>
            <p className="text-gray-600 leading-relaxed text-justify px-4">
              Lấy sự trung thực làm nền tảng. Mọi quy trình tại Black's City luôn rõ ràng, giúp bạn hoàn toàn an tâm trong từng quyết định đầu tư.
            </p>
          </div>

          {/* Card 2 */}
          <div
            ref={core2Ref}
            style={{ transitionDelay: "150ms" }}
            className={`flex flex-col items-center ${fromBottom(core2Visible)}`}
          >
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 w-24 h-24 flex items-center justify-center">
              <img src={iconTienPhong} alt="Tiên Phong" className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-900">Tiên Phong</h3>
            <p className="text-gray-600 leading-relaxed text-justify px-4">
              Ứng dụng AI đột phá để tối ưu hóa hành trình tìm kiếm. Chúng tôi mang đến những giải pháp bất động sản thông minh cho thế hệ mới.
            </p>
          </div>

          {/* Card 3 */}
          <div
            ref={core3Ref}
            style={{ transitionDelay: "300ms" }}
            className={`flex flex-col items-center ${fromBottom(core3Visible)}`}
          >
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 w-24 h-24 flex items-center justify-center">
              <img src={iconTanTam} alt="Tận Tâm" className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-900">Tận Tâm</h3>
            <p className="text-gray-600 leading-relaxed text-justify px-4">
              Mỗi khách hàng là một cộng sự. Black's City không chỉ bán bất động sản, mà còn đồng hành cùng bạn kiến tạo không gian sống bền vững.
            </p>
          </div>

        </div>
      </div>

      {/* ── Câu Chuyện Của Chúng Tôi ── */}
      <div className="bg-gray-50 py-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">

          {/* Ảnh — fade bình thường */}
          <div
            ref={storyImgRef}
            className={`rounded-3xl overflow-hidden shadow-md h-[400px] ${fadeIn(storyImgVisible)}`}
          >
            <img
              src={anhCauChuyen}
              alt="Our Story"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Nội dung — trượt từ phải vào */}
          <div
            ref={storyTextRef}
            className={fromRight(storyTextVisible)}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-8">
              Câu Chuyện Của Chúng Tôi
            </h2>
            <div className="space-y-6 text-gray-700 leading-relaxed text-justify text-base">
              <p>
                <span className="font-semibold text-gray-800">Black's City</span> tự hào là đơn vị tiên phong kết hợp giữa kinh nghiệm bất động sản dày dặn và sức mạnh công nghệ đột phá. Với hơn 10 năm thấu hiểu thị trường, chúng tôi không ngừng tiến hóa để mang đến những giải pháp giao dịch minh bạch, chất lượng và đáng tin cậy.
              </p>
              <p>
                Chúng tôi tin rằng việc tìm kiếm một tổ ấm hay một cơ hội đầu tư không nên là một quá trình phức tạp. Bằng cách ứng dụng phân tích dữ liệu chuyên sâu và công nghệ trí tuệ nhân tạo, đội ngũ chuyên gia của Black's City cam kết mang đến cho bạn những lựa chọn tối ưu, cá nhân hóa theo đúng nhu cầu thực tế.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Sứ Mệnh ── */}
      <div className="max-w-7xl mx-auto py-24 px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Nội dung — trượt từ trái vào */}
          <div
            ref={missionTextRef}
            className={fromLeft(missionTextVisible)}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-8">
              Sứ Mệnh
            </h2>
            <div className="space-y-6 text-gray-700 leading-relaxed text-justify text-base">
              <p>
                Tại <span className="font-semibold text-gray-800">Black's City</span>, sứ mệnh của chúng tôi là trở thành người đồng hành công nghệ số một trong mọi hành trình bất động sản. Chúng tôi tận dụng trí tuệ nhân tạo (AI) để cung cấp những gợi ý chính xác và giải pháp tối ưu, giúp khách hàng hiện thực hóa giấc mơ về một không gian sống lý tưởng hoặc danh mục đầu tư sinh lời bền vững.
              </p>
              <p>
                Chúng tôi không chỉ xây dựng các công trình hay nền tảng số — chúng tôi xây dựng niềm tin, sự an tâm và một tương lai thịnh vượng cho cộng đồng khách hàng thông qua sự minh bạch và tận tâm tuyệt đối.
              </p>
            </div>
          </div>

          {/* Ảnh — fade bình thường */}
          <div
            ref={missionImgRef}
            className={`rounded-3xl overflow-hidden shadow-md h-[400px] ${fadeIn(missionImgVisible)}`}
          >
            <img
              src={anhSuMenh}
              alt="Our Mission"
              className="w-full h-full object-cover"
            />
          </div>

        </div>
      </div>

      {/* ── Liên Hệ ── */}
      <div className="bg-gray-50 py-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-stretch">

          {/* Ảnh — trượt từ trái vào */}
          <div
            ref={contactImgRef}
            className={`rounded-3xl overflow-hidden shadow-md flex h-full ${fromLeft(contactImgVisible)}`}
          >
            <img
              src={anhLienHe}
              alt="Contact"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Form — trượt từ phải vào, cùng lúc với ảnh */}
          <div
            ref={contactFormRef}
            className={`bg-white p-12 rounded-3xl shadow-lg border border-gray-100 flex flex-col justify-center ${fromRight(contactFormVisible)}`}
          >
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-gray-900 mb-3">Liên Hệ</h2>
              <p className="text-gray-600">Vui lòng để lại thông tin để nhận tư vấn chi tiết từ Black's City.</p>
            </div>
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
                <input type="text" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Địa chỉ Email</label>
                <input type="email" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Lời nhắn</label>
                <textarea rows={4} placeholder="Hãy cho chúng tôi biết yêu cầu hoặc dự án bạn đang quan tâm..." className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"></textarea>
              </div>
              <button type="submit" className="w-full bg-[#1e40af] text-white font-semibold py-3.5 rounded-lg hover:bg-[#1e3a8a] transition duration-150">
                Gửi Ngay
              </button>
            </form>
          </div>

        </div>
      </div>

    </div>
  );
};

export default AboutMe;