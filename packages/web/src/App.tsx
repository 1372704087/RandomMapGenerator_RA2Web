import { useEffect, useState } from 'react';
import GeneratePage from './pages/GeneratePage';
import SplitPage from './pages/SplitPage';
import RmgPage from './pages/RmgPage';

// ============== 页签定义 ==============

type TabId = 'generate' | 'split' | 'rmg';

const TABS: { id: TabId; label: string; sub: string }[] = [
  { id: 'generate', label: '生成地图', sub: 'GENERATE' },
  { id: 'split', label: '切片地图', sub: 'SPLIT' },
  { id: 'rmg', label: '自定义生成地图', sub: 'RMG' },
];

const TAB_IDS = TABS.map((t) => t.id);

function tabFromHash(): TabId {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return (TAB_IDS as string[]).includes(raw) ? (raw as TabId) : 'generate';
}

export default function App() {
  const [tab, setTab] = useState<TabId>(() => tabFromHash());

  // 页签与地址栏 hash 双向同步，便于直接分享某个页面
  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function selectTab(id: TabId) {
    setTab(id);
    window.location.hash = `#/${id}`;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">红色警戒 II 尤里的复仇 随机地图生成器</h1>
        <p className="app-subtitle">YURI'S REVENGE RANDOM MAP GENERATOR</p>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => selectTab(t.id)}
          >
            <span className="tab-label">{t.label}</span>
            <span className="tab-sub">{t.sub}</span>
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'generate' && <GeneratePage />}
        {tab === 'split' && <SplitPage />}
        {tab === 'rmg' && <RmgPage />}
      </main>

      <footer className="app-footer">
        <span>红色警戒 II 尤里的复仇 随机地图生成器 · React + Vite + TypeScript</span>
      </footer>
    </div>
  );
}
