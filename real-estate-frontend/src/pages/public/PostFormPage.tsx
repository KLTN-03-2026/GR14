import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { message, Modal } from 'antd';
import { CrownOutlined } from '@ant-design/icons';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { postApi, authApi, paymentApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';

type Demand = '' | 'SELL' | 'RENT';
type PostTypeApi = 'SELL_HOUSE' | 'SELL_LAND' | 'RENT_HOUSE' | 'RENT_LAND';
const POST_DRAFT_KEY = 'pendingPostDraft';

interface PostFormModel {
  title: string;
  propertyType: string;
  city: string;
  district: string;
  ward: string;
  address: string;
  contactPhone: string;
  contactLink: string;
  price: string;
  area: string;
  direction: string;
  // House fields (SELL_HOUSE / RENT_HOUSE)
  bedrooms: string;
  bathrooms: string;
  floors: string;
  // Land fields (SELL_LAND / RENT_LAND)
  frontWidth: string;
  landLength: string;
  landType: string;
  legalStatus: string;
}

const LAND_TYPES = [
  'Đất thổ cư',
  'Đất nông nghiệp',
  'Đất công nghiệp',
  'Đất thương mại',
  'Đất dự án',
  'Khác',
];

const LEGAL_STATUSES = [
  'Sổ đỏ (GCNQSDĐ)',
  'Sổ hồng (GCNQSH)',
  'Hợp đồng mua bán',
  'Giấy tờ tay',
  'Đang chờ sổ',
  'Khác',
];

const PostFormPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { user } = useAuthStore();
  const editingId = params.id ? Number(params.id) : undefined;
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  const [formData, setFormData] = useState<PostFormModel>({
    title: '',
    propertyType: '',
    city: '',
    district: '',
    ward: '',
    address: '',
    contactPhone: '',
    contactLink: '',
    price: '',
    area: '',
    direction: '',
    // House fields
    bedrooms: '',
    bathrooms: '',
    floors: '1',
    // Land fields
    frontWidth: '',
    landLength: '',
    landType: '',
    legalStatus: '',
  });

  const [step, setStep] = useState<1 | 2>(1);
  const [demand, setDemand] = useState<Demand>('');
  const [sectionOpen, setSectionOpen] = useState({
    address: true,
    main: true,
    extra: true,
  });
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const formDataRef = useRef(formData);
  const descriptionRef = useRef(description);
  const imagesRef = useRef(images);

  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { descriptionRef.current = description; }, [description]);
  useEffect(() => { imagesRef.current = images; }, [images]);

  useEffect(() => {
    if (editingId) return;
    const draftRaw = sessionStorage.getItem(POST_DRAFT_KEY);
    if (!draftRaw) return;
    try {
      const draft = JSON.parse(draftRaw);
      if (draft?.formData) {
        setFormData((prev) => ({ ...prev, ...draft.formData }));
      }
      if (draft?.description) setDescription(draft.description);
      if (draft?.demand) setDemand(draft.demand as Demand);
      setStep(2);
      if (new URLSearchParams(location.search).get('resumeDraft') === '1') {
        message.success('Đã khôi phục nội dung bài đăng. Bạn bấm "Đăng tin ngay" để gửi duyệt.');
      }
      sessionStorage.removeItem(POST_DRAFT_KEY);
    } catch {
      sessionStorage.removeItem(POST_DRAFT_KEY);
    }
  }, [editingId, location.search]);

  // Xác định đây là BDS đất hay nhà dựa trên propertyType
  const isLand = useMemo(() => {
    const v = (formData.propertyType || '').toLowerCase();
    return v.includes('đất') || v.includes('dat');
  }, [formData.propertyType]);

  const resolvedPostType: PostTypeApi | '' = useMemo(() => {
    if (!demand) return '';
    if (demand === 'SELL') return isLand ? 'SELL_LAND' : 'SELL_HOUSE';
    return isLand ? 'RENT_LAND' : 'RENT_HOUSE';
  }, [demand, isLand]);

  // Dữ liệu địa lý
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  useEffect(() => {
    fetch('https://provinces.open-api.vn/api/p/')
      .then((res) => res.json())
      .then((data) => setProvinces(data))
      .catch(() => message.error('Không thể tải danh sách tỉnh thành'));
  }, []);

  useEffect(() => {
    const fetchDistricts = async () => {
      const selectedProvince = provinces.find((p) => p.name === formData.city);
      if (selectedProvince) {
        try {
          const res = await fetch(`https://provinces.open-api.vn/api/p/${selectedProvince.code}?depth=2`);
          const data = await res.json();
          setDistricts(data.districts || []);
        } catch (error) {}
      } else {
        setDistricts([]);
      }
    };
    fetchDistricts();
  }, [formData.city, provinces]);

  useEffect(() => {
    const fetchWards = async () => {
      const selectedDistrict = districts.find((d) => d.name === formData.district);
      if (selectedDistrict) {
        try {
          const res = await fetch(`https://provinces.open-api.vn/api/d/${selectedDistrict.code}?depth=2`);
          const data = await res.json();
          setWards(data.wards || []);
        } catch (error) {}
      } else {
        setWards([]);
      }
    };
    fetchWards();
  }, [formData.district, districts]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, city: e.target.value, district: '', ward: '' }));
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, district: e.target.value, ward: '' }));
  };

  // Reset land/house specific fields khi đổi loại BDS
  const handlePropertyTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      propertyType: e.target.value,
      bedrooms: '',
      bathrooms: '',
      floors: '1',
      frontWidth: '',
      landLength: '',
      landType: '',
      legalStatus: '',
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setImages((prev) => [...prev, ...files]);
    const previews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...previews]);
  };

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
    setImagePreviews((prev) => {
      const newPreviews = prev.filter((_, index) => index !== indexToRemove);
      URL.revokeObjectURL(prev[indexToRemove]);
      return newPreviews;
    });
  };

  // Load dữ liệu khi Edit
  useEffect(() => {
    const initForm = async () => {
      if (!editingId) return;
      try {
        setIsLoading(true);
        const res = await postApi.getById(editingId);
        const post = res.data;
        setIsEditMode(true);

        const postType: string = post.postType ?? '';
        if (postType.startsWith('SELL_')) setDemand('SELL');
        if (postType.startsWith('RENT_')) setDemand('RENT');
        setStep(2);

        setFormData({
          title: post.title ?? '',
          propertyType: postType.includes('_LAND') ? 'Đất nền' : 'Nhà riêng',
          city: post.city ?? '',
          district: post.district ?? '',
          ward: post.ward ?? '',
          address: post.address ?? '',
          contactPhone: post.contactPhone ?? '',
          contactLink: post.contactLink ?? '',
          price: post.price?.toString() ?? '',
          area: post.area?.toString() ?? '',
          direction: post.direction ?? '',
          // House fields
          bedrooms: post.bedrooms?.toString() ?? '',
          bathrooms: post.bathrooms?.toString() ?? '',
          floors: post.floors?.toString() ?? '1',
          // Land fields
          frontWidth: post.frontWidth?.toString() ?? '',
          landLength: post.landLength?.toString() ?? '',
          landType: post.landType ?? '',
          legalStatus: post.legalStatus ?? '',
        });
        setDescription(post.description ?? '');
        const existingImages = post.images?.map((img: any) => img.url).filter(Boolean) ?? [];
        setImagePreviews(existingImages);
      } catch (error) {
        message.error('Không thể tải dữ liệu bài đăng để chỉnh sửa');
      } finally {
        setIsLoading(false);
      }
    };

    initForm();
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [editingId]);

  const checkVipStatus = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const res = await authApi.getMe();
      const currentUser = res.data?.user;
      if (currentUser) {
        const { setUser } = useAuthStore.getState();
        setUser(currentUser);
        if (!currentUser.isVip) return false;
        try {
          const subsRes = await paymentApi.getMySubscriptions({ limit: 100 });
          const subscriptions = subsRes.data?.data || [];
          const hasActiveVip = subscriptions.some(
            (sub: any) => sub.status === 1 && new Date(sub.endDate) > new Date()
          );
          return hasActiveVip;
        } catch {
          return currentUser.isVip || false;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking VIP status:', error);
      return user?.isVip || false;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!demand || !resolvedPostType) {
      message.error('❌ Vui lòng chọn nhu cầu (Bán/Cho thuê)');
      setStep(1);
      return;
    }

    if (!formData.title.trim()) { message.error('❌ Vui lòng nhập tiêu đề bài viết'); return; }
    if (!formData.propertyType) { message.error('❌ Vui lòng chọn loại bất động sản'); return; }
    if (!formData.city || !formData.district || !formData.ward) {
      message.error('❌ Vui lòng chọn tỉnh/thành, quận/huyện và phường/xã'); return;
    }
    if (!formData.address.trim()) { message.error('❌ Vui lòng nhập địa chỉ cụ thể'); return; }
    if (!formData.price || Number(formData.price) <= 0) {
      message.error('❌ Vui lòng nhập mức giá hợp lệ'); return;
    }
    if (!formData.area || Number(formData.area) <= 0) {
      message.error('❌ Vui lòng nhập diện tích hợp lệ'); return;
    }
    if (!description.trim()) { message.error('❌ Vui lòng nhập mô tả bài viết'); return; }
    if (!isEditMode && imagePreviews.length === 0) {
      message.error('❌ Vui lòng upload ít nhất 1 ảnh'); return;
    }

    // Kiểm tra VIP khi đăng bài mới
    if (!isEditMode) {
      try {
        setIsLoading(true);
        const isVip = await checkVipStatus();
        if (!isVip) {
          setIsLoading(false);
          sessionStorage.setItem(
            POST_DRAFT_KEY,
            JSON.stringify({
              demand,
              formData,
              description,
            })
          );
          Modal.confirm({
            title: '👑 Yêu cầu tài khoản VIP',
            icon: <CrownOutlined style={{ color: '#ff7a45' }} />,
            width: 480,
            content: (
              <div style={{ marginTop: 16 }}>
                <p style={{ color: '#666', marginBottom: 16 }}>
                  Bạn cần nâng cấp tài khoản VIP để đăng bài viết bất động sản.
                </p>
                <div style={{ backgroundColor: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: 16 }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>Lợi ích VIP:</p>
                  <p style={{ margin: '4px 0', color: '#666', fontSize: 13 }}>✓ Đăng tin không giới hạn trong thời gian VIP</p>
                  <p style={{ margin: '4px 0', color: '#666', fontSize: 13 }}>✓ Tin được ưu tiên hiển thị</p>
                  <p style={{ margin: '4px 0', color: '#666', fontSize: 13 }}>✓ Xếp hạng cao hơn, tiếp cận nhiều khách hơn</p>
                </div>
              </div>
            ),
            okText: '👑 Nâng cấp VIP ngay',
            cancelText: 'Để sau',
            okButtonProps: { style: { backgroundColor: '#ff7a45', borderColor: '#ff7a45' } },
            onOk: () => { navigate('/vip-upgrade?fromPost=1'); },
          });
          return;
        }
      } catch (error) {
        console.error('Error checking VIP:', error);
        message.error('❌ Không thể kiểm tra trạng thái VIP. Vui lòng thử lại.');
        return;
      } finally {
        setIsLoading(false);
      }
    }

    const confirmMsg = isEditMode
      ? 'Bạn có chắc muốn cập nhật bài viết này?'
      : 'Bạn có chắc muốn đăng bài viết này? Thông tin sẽ chờ Admin duyệt.';
    if (!window.confirm(confirmMsg)) return;

    setIsLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('postType', resolvedPostType);
      submitData.append('title', formData.title);
      submitData.append('city', formData.city);
      submitData.append('district', formData.district);
      submitData.append('ward', formData.ward);
      submitData.append('address', formData.address);
      submitData.append('contactPhone', formData.contactPhone);
      submitData.append('contactLink', formData.contactLink);
      submitData.append('price', formData.price);
      submitData.append('area', formData.area);
      submitData.append('direction', formData.direction);
      submitData.append('description', description);

      // Append house-specific fields
      if (!isLand) {
        if (formData.bedrooms) submitData.append('bedrooms', formData.bedrooms);
        if (formData.bathrooms) submitData.append('bathrooms', formData.bathrooms);
        if (formData.floors) submitData.append('floors', formData.floors);
      }

      // Append land-specific fields
      if (isLand) {
        if (formData.frontWidth) submitData.append('frontWidth', formData.frontWidth);
        if (formData.landLength) submitData.append('landLength', formData.landLength);
        if (formData.landType) submitData.append('landType', formData.landType);
        if (formData.legalStatus) submitData.append('legalStatus', formData.legalStatus);
      }

      images.forEach((image) => { submitData.append('images', image); });

      if (editingId) {
        await postApi.update(editingId, submitData);
        message.success('✅ Cập nhật bài viết thành công!');
      } else {
        await postApi.create(submitData);
        message.success('🎉 Đăng bài thành công! Thông tin đang chờ Admin duyệt.');
      }

      setFormData({
        title: '', propertyType: '', city: '', district: '', ward: '',
        address: '', contactPhone: '', contactLink: '', price: '', area: '', direction: '',
        bedrooms: '', bathrooms: '', floors: '1',
        frontWidth: '', landLength: '', landType: '', legalStatus: '',
      });
      setDemand('');
      setStep(1);
      setDescription('');
      setImages([]);
      setImagePreviews([]);
      if (user?.roles?.includes('ADMIN')) {
        navigate('/admin/posts');
      } else {
        navigate('/my-posts');
      }
    } catch (error: any) {
      console.error('Lỗi submit:', error);
      const errorMsg = error?.response?.data?.message || 'Không thể kết nối đến server. Vui lòng thử lại.';
      message.error(`❌ ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ===================== RENDER HELPERS =====================

  // Section: Thông tin đặc thù cho NHÀ (SELL_HOUSE / RENT_HOUSE)
  const renderHouseFields = () => (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">Thông tin nhà ở</span>
        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-200">
          {demand === 'SELL' ? 'Bán nhà' : 'Cho thuê nhà'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-blue-50 p-5 rounded-xl border border-blue-100">
        {/* Số phòng ngủ — bedrooms */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Số phòng ngủ
          </label>
          <input
            type="number"
            name="bedrooms"
            min="0"
            max="50"
            value={formData.bedrooms}
            onChange={handleInputChange}
            placeholder="VD: 3"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors"
          />
        </div>

        {/* Số phòng tắm — bathrooms */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Số phòng tắm / WC
          </label>
          <input
            type="number"
            name="bathrooms"
            min="0"
            max="50"
            value={formData.bathrooms}
            onChange={handleInputChange}
            placeholder="VD: 2"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors"
          />
        </div>

        {/* Số tầng — floors */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Số tầng
          </label>
          <input
            type="number"
            name="floors"
            min="1"
            max="200"
            value={formData.floors}
            onChange={handleInputChange}
            placeholder="VD: 4"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors"
          />
        </div>
      </div>
    </div>
  );

  // Section: Thông tin đặc thù cho ĐẤT (SELL_LAND / RENT_LAND)
  const renderLandFields = () => (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">Thông tin đất</span>
        <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
          {demand === 'SELL' ? 'Bán đất' : 'Cho thuê đất'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-green-50 p-5 rounded-xl border border-green-100">
        {/* Mặt tiền — frontWidth */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Chiều rộng mặt tiền (m)
          </label>
          <input
            type="number"
            name="frontWidth"
            min="0"
            step="0.1"
            value={formData.frontWidth}
            onChange={handleInputChange}
            placeholder="VD: 5.5"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors"
          />
        </div>

        {/* Chiều dài — landLength */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Chiều dài (m)
          </label>
          <input
            type="number"
            name="landLength"
            min="0"
            step="0.1"
            value={formData.landLength}
            onChange={handleInputChange}
            placeholder="VD: 20"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors"
          />
        </div>

        {/* Loại đất — landType */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Loại đất
          </label>
          <select
            name="landType"
            value={formData.landType}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer transition-colors"
          >
            <option value="">-- Chọn loại đất --</option>
            {LAND_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Pháp lý — legalStatus */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Tình trạng pháp lý
          </label>
          <select
            name="legalStatus"
            value={formData.legalStatus}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer transition-colors"
          >
            <option value="">-- Chọn pháp lý --</option>
            {LEGAL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const toggleSection = (key: 'address' | 'main' | 'extra') => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ===================== MAIN RENDER =====================
  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow-xl rounded-2xl mt-10 border border-gray-100">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-2 border-b-2 border-blue-100 pb-4 text-center">
        {isEditMode
          ? 'Chỉnh sửa tin Bất Động Sản'
          : demand === 'SELL'
            ? 'Đăng tin bán Bất Động Sản'
            : demand === 'RENT'
              ? 'Đăng tin cho thuê Bất Động Sản'
              : 'Tạo tin đăng'}
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        {isEditMode
          ? 'Cập nhật thông tin chi tiết về bất động sản của bạn'
          : ''}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ========== BƯỚC 1: NHU CẦU ========== */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="text-sm font-semibold text-gray-800">Bước 1. Thông tin BĐS</div>
            <button
              type="button"
              onClick={() => setStep(step === 1 ? 2 : 1)}
              className="text-sm text-gray-600 hover:text-gray-900"
              aria-label={step === 1 ? 'Mở bước tiếp theo' : 'Thu gọn'}
            >
              {step === 1 ? '⮟' : '⮝'}
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nhu cầu <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setDemand('SELL')}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                  demand === 'SELL'
                    ? 'border-red-500 bg-red-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  demand === 'SELL' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}>$</div>
                <div>
                  <div className="font-semibold text-gray-900">Bán</div>
                  <div className="text-xs text-gray-600">Đăng tin bán bất động sản</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDemand('RENT')}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                  demand === 'RENT'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  demand === 'RENT' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}>🔑</div>
                <div>
                  <div className="font-semibold text-gray-900">Cho thuê</div>
                  <div className="text-xs text-gray-600">Đăng tin cho thuê bất động sản</div>
                </div>
              </button>
            </div>
          </div>

          {step === 1 && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!demand) { message.error('❌ Vui lòng chọn Bán hoặc Cho thuê'); return; }
                  setStep(2);
                }}
                className="px-6 py-3 rounded-full font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg active:scale-[0.99]"
              >
                Tiếp tục
              </button>
            </div>
          )}
        </div>

        {/* ========== BƯỚC 2: THÔNG TIN BĐS ========== */}
        {step === 2 && (
          <>
            {/* Địa chỉ */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleSection('address')}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100"
              >
                <span className="text-sm font-semibold text-gray-800">Địa chỉ *</span>
                <span className="text-gray-500">{sectionOpen.address ? '▾' : '▸'}</span>
              </button>
              {sectionOpen.address && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Tiêu đề bài viết <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      required
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder={
                        demand === 'SELL'
                          ? 'VD: Bán căn hộ chung cư cao cấp quận 1...'
                          : 'VD: Cho thuê căn hộ chung cư cao cấp quận 1...'
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Loại bất động sản <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="propertyType"
                      required
                      value={formData.propertyType}
                      onChange={handlePropertyTypeChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer transition-colors"
                    >
                      <option value="" disabled>-- Chọn loại bất động sản --</option>
                      <optgroup label="Nhà ở">
                        <option value="Nhà riêng">Nhà riêng</option>
                        <option value="Căn hộ chung cư">Căn hộ chung cư</option>
                        <option value="Nhà phố">Nhà phố</option>
                        <option value="Biệt thự">Biệt thự</option>
                        <option value="Nhà trọ / Phòng trọ">Nhà trọ / Phòng trọ</option>
                      </optgroup>
                      <optgroup label="Thương mại / Văn phòng">
                        <option value="Văn phòng">Văn phòng</option>
                        <option value="Cửa hàng">Cửa hàng</option>
                        <option value="Kho xưởng">Kho xưởng</option>
                      </optgroup>
                      <optgroup label="Đất">
                        <option value="Đất nền">Đất nền</option>
                        <option value="Đất nông nghiệp">Đất nông nghiệp</option>
                        <option value="Đất công nghiệp">Đất công nghiệp</option>
                      </optgroup>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Tỉnh/Thành phố <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="city"
                        required
                        value={formData.city}
                        onChange={handleCityChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer transition-colors"
                      >
                        <option value="" disabled>-- Chọn Tỉnh/Thành phố --</option>
                        {provinces.map((p) => (
                          <option key={p.code} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Quận/Huyện <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="district"
                        required
                        value={formData.district}
                        onChange={handleDistrictChange}
                        disabled={!formData.city}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer disabled:bg-gray-100 transition-colors"
                      >
                        <option value="" disabled>-- Chọn Quận/Huyện --</option>
                        {districts.map((d) => (
                          <option key={d.code} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Phường/Xã <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="ward"
                        required
                        value={formData.ward}
                        onChange={handleInputChange}
                        disabled={!formData.district}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer disabled:bg-gray-100 transition-colors"
                      >
                        <option value="" disabled>-- Chọn Phường/Xã --</option>
                        {wards.map((w) => (
                          <option key={w.code} value={w.name}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Địa chỉ cụ thể (Số nhà, đường) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      required
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="VD: Số 10, Đường Lê Lợi"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    />
                  </div>


                </div>
              )}
            </div>

            {/* Thông tin chính */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleSection('main')}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100"
              >
                <span className="text-sm font-semibold text-gray-800">Thông tin chính *</span>
                <span className="text-gray-500">{sectionOpen.main ? '▾' : '▸'}</span>
              </button>
              {sectionOpen.main && (
                <div className="p-5 space-y-5 bg-gradient-to-b from-white to-gray-50/40">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Mức giá {demand === 'RENT' ? '(VNĐ/tháng)' : '(VNĐ)'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="price"
                        required
                        min="0"
                        value={formData.price}
                        onChange={handleInputChange}
                        placeholder="VD: 5000000"
                        className="w-full h-11 px-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors"
                      />
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Diện tích (m²) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="area"
                        required
                        min="0"
                        value={formData.area}
                        onChange={handleInputChange}
                        placeholder="VD: 60"
                        className="w-full h-11 px-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors"
                      />
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Hướng (Tùy chọn)</label>
                      <select
                        name="direction"
                        value={formData.direction}
                        onChange={handleInputChange}
                        className="w-full h-11 px-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer transition-colors"
                      >
                        <option value="">-- Chọn hướng --</option>
                        <option value="Đông">Đông</option>
                        <option value="Tây">Tây</option>
                        <option value="Nam">Nam</option>
                        <option value="Bắc">Bắc</option>
                        <option value="Đông Nam">Đông Nam</option>
                        <option value="Tây Nam">Tây Nam</option>
                        <option value="Đông Bắc">Đông Bắc</option>
                        <option value="Tây Bắc">Tây Bắc</option>
                      </select>
                    </div>
                    
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Số điện thoại liên hệ
                      </label>
                      <input
                        type="text"
                        name="contactPhone"
                        value={formData.contactPhone}
                        onChange={handleInputChange}
                        placeholder="VD: 0901234567"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Link liên hệ (Facebook/Zalo)
                      </label>
                      <input
                        type="text"
                        name="contactLink"
                        value={formData.contactLink}
                        onChange={handleInputChange}
                        placeholder="https://facebook.com/..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Thông tin khác */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleSection('extra')}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100"
              >
                <span className="text-sm font-semibold text-gray-800">Thông tin khác</span>
                <span className="text-gray-500">{sectionOpen.extra ? '▾' : '▸'}</span>
              </button>
              {sectionOpen.extra && (
                <div className="p-4 space-y-5">
                  {formData.propertyType && (
                    isLand ? renderLandFields() : renderHouseFields()
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mô tả bài viết <span className="text-red-500">*</span>
                    </label>
                    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                      <CKEditor
                        editor={ClassicEditor as any}
                        data={description}
                        config={{
                          licenseKey: 'GPL',
                          placeholder: 'Nhập mô tả chi tiết về bất động sản tại đây...',
                        }}
                        onChange={(_event, editor) => {
                          const data = editor.getData();
                          setDescription(data);
                        }}
                      />
                    </div>
                    <style>{`
                      .ck-editor__editable[role="textbox"] { height: 200px !important; }
                    `}</style>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hình ảnh (Hỗ trợ nhiều ảnh)
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Nhấn để chọn ảnh</span> hoặc kéo thả vào đây
                          </p>
                          <p className="text-xs text-gray-500">PNG, JPG, JPEG (Tối đa 10 ảnh)</p>
                        </div>
                        <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
                      </label>
                    </div>

                    {imagePreviews.length > 0 && (
                      <div className="mt-4 flex gap-3 flex-wrap">
                        {imagePreviews.map((src, index) => (
                          <div key={index} className="relative w-24 h-24 border rounded-lg overflow-hidden shadow-sm group">
                            <img src={src} alt={`preview-${index}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                              title="Xóa ảnh này"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 px-6 font-bold text-lg text-white rounded-full shadow-lg transition-all ${
                  isLoading
                    ? 'bg-blue-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl active:scale-[0.99]'
                }`}
              >
                {isLoading
                  ? '⏳ Đang xử lý bài viết...'
                  : isEditMode
                    ? '✏️ Cập nhật bài viết'
                    : '📤 Đăng tin ngay'}
              </button>
              <p className="text-xs text-gray-500 text-center mt-3">
                {isEditMode
                  ? 'Cập nhật thông tin bất động sản của bạn'
                  : 'Bài viết sẽ chờ Admin duyệt trước khi hiển thị công khai'}
              </p>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default PostFormPage;