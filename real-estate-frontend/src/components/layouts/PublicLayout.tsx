import { Outlet } from 'react-router-dom';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';
import { ChatbotWidget } from '@/components/common';

const PublicLayout: React.FC = () => {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
