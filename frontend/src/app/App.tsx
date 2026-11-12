import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '../shared/ui';
import { ErrorBoundary } from '../shared/ui/ErrorBoundary';
import { AppRoutes } from './router';

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary><AppRoutes /></ErrorBoundary>
      <Toaster />
    </BrowserRouter>
  );
}
