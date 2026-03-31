import { useEffect, useState } from "react";

import banner1 from "../../assets/ABbn1.jpg";
import banner2 from "../../assets/ABbn2.jpg";
import banner3 from "../../assets/ABbn3.jpg";

import anhmuctieu from "../../assets/imgmuctieu.png";
import anhtamnhin from "../../assets/imgtamnhin.png";
import anhgiatri from "../../assets/imggiatri.jpg";

import iconMuctieu from "../../assets/muctieu.png";
import iconTamnhin from "../../assets/tamnhin.png";
import iconGiatri from "../../assets/giatri.png";

const images = [banner1, banner2, banner3];

const AboutMe = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-100">
      <div className="relative h-[350px] overflow-hidden">
        <img
          src={images[current]}
          className="w-full h-full object-cover transition-all duration-700"
        />

        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
          <div className="text-center">
            <h1 className="text-4xl font-bold">Blacks City</h1>
            <p className="mt-5 text-xl font-bold">Dẫn Lối Đầu Tư - Vững Bước An Cư</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 p-6 grid md:grid-cols-3 gap-6">

        <div className="bg-[#f3d7c7] rounded-2xl p-5 relative text-center hover:scale-105 transition">
          <img
            src={anhmuctieu}
            className="rounded-xl mb-4 h-[150px] w-full object-cover"
          />

          <div className="absolute right-5 top-[120px] bg-white p-3 rounded-full shadow-md">
            <img src={iconMuctieu} className="w-5 h-5" />
          </div>

          <h3 className="font-semibold text-xl mb-2 ">Mục Tiêu</h3>
          <p className="text-base text-gray-700 text-justify leading-relaxed">
            Xây dựng nền tảng bất động sản minh bạch, tiện lợi và hiệu quả, giúp người dùng dễ dàng tìm kiếm, giao dịch và đầu tư an toàn thông qua công nghệ hiện đại.
          </p>
        </div>

        <div className="bg-[#cfd8f3] rounded-2xl p-5 relative text-center hover:scale-105 transition">
          <img
            src={anhtamnhin}
            className="rounded-xl mb-4 h-[150px] w-full object-cover"
          />

          <div className="absolute right-5 top-[120px] bg-white p-3 rounded-full shadow-md">
            <img src={iconTamnhin} className="w-5 h-5" />
          </div>

          <h3 className="font-semibold text-xl mb-2">Tầm Nhìn</h3>
          <p className="text-base text-gray-700 text-justify leading-relaxed">
            Trở thành nền tảng bất động sản hàng đầu, tiên phong ứng dụng công nghệ để kết nối người mua, người bán và nhà đầu tư một cách thông minh và bền vững.
          </p>
        </div>

        <div className="bg-[#f3e0c7] rounded-2xl p-5 relative text-center hover:scale-105 transition">
          <img
            src={anhgiatri}
            className="rounded-xl mb-4 h-[150px] w-full object-cover"
          />

          <div className="absolute right-5 top-[120px] bg-white p-3 rounded-full shadow-md">
            <img src={iconGiatri} className="w-5 h-5" />
          </div>

          <h3 className="font-semibold text-xl mb-2">Giá Trị</h3>
          <p className="text-base text-gray-700 text-justify leading-relaxed">
            Đề cao uy tín – minh bạch – chuyên nghiệp, luôn đặt khách hàng làm trung tâm và không ngừng nâng cao chất lượng dịch vụ.
          </p>
        </div>

      </div>
    </div>
  );
};

export default AboutMe;