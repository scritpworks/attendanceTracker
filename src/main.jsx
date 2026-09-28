import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './Components/AuthContext.jsx';
import { PermissionProvider } from './Components/context/PermissionContext.jsx';
import { LoadingProvider } from './Components/context/LoadingContext.jsx';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'bootstrap/dist/css/bootstrap.min.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <LoadingProvider>
            <App />
          </LoadingProvider>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
