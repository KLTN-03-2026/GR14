import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { postApi } from '@/api';
import PostForm from '@/components/common/PostForm';

const CreatePostPage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setIsLoading(true);
        try {
            await postApi.create(formData);
            toast.success('Đăng bài thành công! Bài đăng đang chờ duyệt.');
            navigate('/my-posts');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string | string[] } } };
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra';
            toast.error(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        navigate('/my-posts');
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">Đăng bài mới</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Điền thông tin bên dưới để đăng bài. Bài đăng sẽ được duyệt trước khi hiển thị công khai.
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                        <PostForm
                            onSubmit={handleSubmit}
                            onCancel={handleCancel}
                            submitLabel="Đăng bài"
                            isLoading={isLoading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreatePostPage;
