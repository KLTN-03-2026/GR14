import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import viVN from 'antd/locale/vi_VN';
import router from './routes';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { FavoritesProvider } from '@/context/FavoritesContext';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function App() {
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
            <RouterProvider router={router} />
          </FavoritesProvider>
        </AntdApp>
      </ConfigProvider>
    </GoogleOAuthProvider>
  );
}

export default App;