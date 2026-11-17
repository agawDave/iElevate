import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ConfirmProvider } from './context/ConfirmContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
