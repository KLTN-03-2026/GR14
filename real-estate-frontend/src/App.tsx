import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import router from './routes';
import { GoogleOAuthProvider } from '@react-oauth/google';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '324837961707-59q2n2n0skci4b4t32usi7o2v268osfc.apps.googleusercontent.com';

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
        <RouterProvider router={router} />
      </ConfigProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
