import React, { useState } from 'react';
import { Modal } from 'antd';
import { StarFilled } from '@ant-design/icons';

interface AiDescriptionGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (tone: 'polite' | 'friendly') => void;
    isGenerating: boolean;
}

const AiDescriptionGeneratorModal: React.FC<AiDescriptionGeneratorModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    isGenerating,
}) => {
    const [selectedTone, setSelectedTone] = useState<'polite' | 'friendly'>('polite');

    const handleGenerate = () => {
        onGenerate(selectedTone);
    };

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            title={null}
            centered
            className="ai-desc-modal"
            zIndex={110000}
            closable={!isGenerating}
            mask={{ closable: !isGenerating }}
        >
            <div className="p-4 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-brand-400 to-brand-600 shadow-lg shadow-brand-500/30">
                    <StarFilled className="text-white text-3xl" />
                </div>

                <h3 className="mb-2 text-2xl font-bold text-gray-800">
                    AI Mô tả tự động
                </h3>
                <p className="mb-6 text-sm text-gray-500">
                    Chọn phong cách ngôn ngữ để AI giúp bạn soạn một đoạn mô tả thật thu hút, chốt sale nhanh chóng.
                </p>

                <div className="mb-8 grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setSelectedTone('polite')}
                        disabled={isGenerating}
                        className={`relative overflow-hidden rounded-xl border-2 p-4 transition-all ${selectedTone === 'polite'
                                ? 'border-brand-500 bg-brand-50 shadow-md'
                                : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-gray-50'
                            }`}
                    >
                        <div className="mb-2 text-3xl">👔</div>
                        <div className={`font-semibold ${selectedTone === 'polite' ? 'text-brand-700' : 'text-gray-700'}`}>Lịch sự</div>
                        <div className="mt-1 text-xs text-gray-500">Sang trọng, chuyên nghiệp</div>
                        {selectedTone === 'polite' && (
                            <div className="absolute right-2 top-2 h-3 w-3 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedTone('friendly')}
                        disabled={isGenerating}
                        className={`relative overflow-hidden rounded-xl border-2 p-4 transition-all ${selectedTone === 'friendly'
                                ? 'border-brand-500 bg-brand-50 shadow-md'
                                : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-gray-50'
                            }`}
                    >
                        <div className="mb-2 text-3xl">👋</div>
                        <div className={`font-semibold ${selectedTone === 'friendly' ? 'text-brand-700' : 'text-gray-700'}`}>Thân thiện</div>
                        <div className="mt-1 text-xs text-gray-500">Gần gũi, thu hút giới trẻ</div>
                        {selectedTone === 'friendly' && (
                            <div className="absolute right-2 top-2 h-3 w-3 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                        )}
                    </button>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white transition-all hover:bg-gray-800 disabled:opacity-70"
                    >
                        {isGenerating ? (
                            <>
                                <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="animate-pulse">AI đang suy nghĩ...</span>
                            </>
                        ) : (
                            <>
                                Bắt đầu tạo
                                <StarFilled className="text-yellow-400 group-hover:animate-pulse text-lg" />
                            </>
                        )}
                        {/* Glow effect on hover */}
                        {!isGenerating && (
                            <div className="absolute inset-0 z-0 h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ transform: 'skewX(-20deg)', transformOrigin: 'top' }}></div>
                        )}
                    </button>
                    {!isGenerating && (
                        <button
                            onClick={onClose}
                            className="w-full rounded-xl py-3 font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                        >
                            Hủy bỏ
                        </button>
                    )}
                </div>
            </div>
            <style>{`
                .ai-desc-modal .ant-modal-content {
                    border-radius: 1.5rem;
                    padding: 0;
                    overflow: hidden;
                }
            `}</style>
        </Modal>
    );
};

export default AiDescriptionGeneratorModal;
