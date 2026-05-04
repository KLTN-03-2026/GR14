import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntdApp } from 'antd';
import viVN from 'antd/locale/vi_VN';
import router from './routes';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { FavoritesProvider } from '@/context/FavoritesContext';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function App() {
  const queryClient = new QueryClient();
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ConfigProvider
        locale={viVN}
        theme={{
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6,
          },
        }}
      >
        <AntdApp>
          <FavoritesProvider>
            <QueryClientProvider client={queryClient}>
              <RouterProvider router={router} />
            </QueryClientProvider>
          </FavoritesProvider>
        </AntdApp>
      </ConfigProvider>
    </GoogleOAuthProvider>
  );
}

export default App;