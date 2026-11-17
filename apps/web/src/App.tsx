import { HashRouter, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function App() {
  const { t } = useTranslation();
  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={<h1>{t('app.name')}</h1>} />
      </Routes>
    </HashRouter>
  );
}
