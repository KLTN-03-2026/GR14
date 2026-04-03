import { Outlet } from 'react-router-dom';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';
import { ChatbotWidget } from '@/components/common';
import { Toaster } from 'react-hot-toast';

const PublicLayout: React.FC = () => {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                }}
            />
            <PublicHeader />
            <main style={{ flex: 1 }}>
                <Outlet />
            </main>
            <ChatbotWidget />
            <PublicFooter />
        </div>
    );
};

export default PublicLayout;
