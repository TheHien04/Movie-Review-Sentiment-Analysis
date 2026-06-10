import { Link, Route, Routes } from 'react-router-dom';
import AnalyzePage from './pages/AnalyzePage';
import HomePage from './pages/HomePage';
import StatsPage from './pages/StatsPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link to="/" className="brand">
          CineSentiment <span className="brand-tag">Modern UI</span>
        </Link>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/analyze">Analyze</Link>
          <Link to="/stats">Statistics</Link>
          <a href="/index.html">Classic UI</a>
        </nav>
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <small>v2.2 · React + TypeScript · Flask + FastAPI + MLflow + W&B</small>
      </footer>
    </div>
  );
}
