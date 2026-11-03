import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '../shared/ui';
import { AppRoutes } from './router';

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  );
}
