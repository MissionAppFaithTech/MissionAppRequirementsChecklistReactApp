import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowUp, Check, Menu, RotateCcw, Search, X } from 'lucide-react';
import { allRequirements, functionalRequirements, nonFunctionalRequirements, normalizeText, type RequirementNode } from '@/data/requirements';
import { countProgress, loadChecklist, saveChecklist, toggleChecklist, type ChecklistState } from '@/lib/checklist';

type FilterMode = 'all' | 'open' | 'done';

function nodeMatches(node: RequirementNode, query: string): boolean {
  if (!query) return true;
  const haystack = normalizeText(`${node.code} ${node.title} ${node.description ?? ''}`);
  return haystack.includes(normalizeText(query)) || Boolean(node.children?.some((child) => nodeMatches(child, query)));
}

function filterNode(node: RequirementNode, query: string, mode: FilterMode, state: ChecklistState): RequirementNode | null {
  const children = node.children?.map((child) => filterNode(child, query, mode, state)).filter(Boolean) as RequirementNode[] | undefined;
  const ownMatch = nodeMatches(node, query);
  const descendantMatch = Boolean(children?.length);
  const statusMatch = mode === 'all' || (mode === 'done' ? Boolean(state[node.id]) || descendantMatch : !state[node.id] || descendantMatch);
  if ((!ownMatch && !children?.length) || !statusMatch) return null;
  return { ...node, children };
}

function NodeCheck({ node, state, onToggle }: { node: RequirementNode; state: ChecklistState; onToggle: (id: string) => void }) {
  return (
    <label className="check-wrap" title={`Marcar ${node.code}`}>
      <input
        className="check-input"
        type="checkbox"
        checked={Boolean(state[node.id])}
        onChange={() => onToggle(node.id)}
        aria-label={`Marcar ${node.code}: ${node.title}`}
      />
      <span className="check-box" aria-hidden="true"><Check size={15} strokeWidth={2.7} /></span>
    </label>
  );
}

function NodeMeta({ node, state }: { node: RequirementNode; state: ChecklistState }) {
  const progress = countProgress([node], state);
  return <span className="req-count">{progress.completed}/{progress.total} feitos</span>;
}

function SubRequirement({ node, state, onToggle }: { node: RequirementNode; state: ChecklistState; onToggle: (id: string) => void }) {
  const done = Boolean(state[node.id]);
  return (
    <li className={`sub-item${done ? ' is-done' : ''}`}>
      <NodeCheck node={node} state={state} onToggle={onToggle} />
      <div>
        <div className="req-title-row"><span className="req-code">{node.code}</span><h4 className="req-title">{node.title}</h4></div>
        {node.description && <p className="req-description">{node.description}</p>}
        {node.children?.length ? (
          <ul className="sub-list">
            {node.children.map((child) => <SubRequirement key={child.id} node={child} state={state} onToggle={onToggle} />)}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function RequirementCard({ node, state, onToggle }: { node: RequirementNode; state: ChecklistState; onToggle: (id: string) => void }) {
  const progress = countProgress([node], state);
  const done = progress.completed === progress.total;
  return (
    <article id={node.id} className={`req-card${done ? ' is-done' : ''}`}>
      <div className="req-card-head">
        <NodeCheck node={node} state={state} onToggle={onToggle} />
        <div>
          <div className="req-title-row"><span className="req-code">{node.code}</span><h3 className="req-title">{node.title}</h3></div>
          {node.description && <p className="req-description">{node.description}</p>}
        </div>
        <NodeMeta node={node} state={state} />
      </div>
      {node.children?.length ? (
        <ul className="sub-list">
          {node.children.map((child) => <SubRequirement key={child.id} node={child} state={state} onToggle={onToggle} />)}
        </ul>
      ) : null}
    </article>
  );
}

function NavGroup({ label, nodes, query, activeId, onNavigate }: { label: string; nodes: RequirementNode[]; query: string; activeId: string; onNavigate: () => void }) {
  const filtered = nodes.filter((node) => nodeMatches(node, query));
  return (
    <>
      <p className="nav-label">{label}</p>
      {filtered.length ? (
        <ul className="nav-list">
          {filtered.map((node) => (
            <li key={node.id}>
              <a className={`nav-item${activeId === node.id ? ' active' : ''}`} href={`#${node.id}`} onClick={onNavigate}>
                <span>{node.title}</span><span className="nav-item-code">{node.code.replace('RF ', '').replace('NF.', '')}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="nav-empty">Nenhum requisito encontrado.</p>}
    </>
  );
}

function ConfirmReset({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <h2 id="reset-title">Começar de novo?</h2>
        <p>Todos os itens marcados serão desmarcados neste navegador. Esta ação não pode ser desfeita.</p>
        <div className="modal-actions">
          <button className="modal-cancel" type="button" onClick={onCancel}>Cancelar</button>
          <button className="modal-danger" type="button" onClick={onConfirm}>Limpar checklist</button>
        </div>
      </section>
    </div>
  );
}

function App() {
  const [state, setState] = useState<ChecklistState>(() => loadChecklist(allRequirements));
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<FilterMode>('all');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [activeId, setActiveId] = useState('rf-1');
  const [showTop, setShowTop] = useState(false);
  const progress = useMemo(() => countProgress(allRequirements, state), [state]);

  useEffect(() => { saveChecklist(state); }, [state]);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 420);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const sections = allRequirements.map((node) => document.getElementById(node.id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveId(visible[0].target.id);
    }, { rootMargin: '-16% 0px -68% 0px', threshold: 0 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [query, mode]);

  const toggle = (id: string) => setState((current) => toggleChecklist(current, id));
  const reset = () => { setState({}); setResetOpen(false); };
  const visibleFunctional = useMemo(() => functionalRequirements.map((node) => filterNode(node, query, mode, state)).filter(Boolean) as RequirementNode[], [query, mode, state]);
  const visibleNonFunctional = useMemo(() => nonFunctionalRequirements.map((node) => filterNode(node, query, mode, state)).filter(Boolean) as RequirementNode[], [query, mode, state]);
  const resultCount = visibleFunctional.length + visibleNonFunctional.length;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#conteudo" aria-label="Ir para o conteúdo principal">
          <span className="brand-mark">M</span>
          <span className="brand-copy"><span className="brand-name">Mission App</span><span className="brand-caption">Atlas de requisitos</span></span>
        </a>
        <div className="top-actions">
          <div className="top-progress" aria-label={`${progress.percent}% concluído`}>
            <div className="top-progress-label"><span>Progresso</span><span>{progress.percent}%</span></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress.percent}%` }} /></div>
          </div>
          <button className="reset-button" type="button" onClick={() => setResetOpen(true)} aria-label="Limpar checklist"><RotateCcw size={14} /><span>Limpar</span></button>
          <button className="mobile-menu" type="button" onClick={() => setMobileOpen((open) => !open)} aria-expanded={mobileOpen} aria-controls="doc-sidebar">
            {mobileOpen ? <X size={16} /> : <Menu size={16} />} <span>Sumário</span>
          </button>
        </div>
      </header>
      <div className="layout">
        <aside id="doc-sidebar" className={`sidebar${mobileOpen ? ' open' : ''}`} aria-label="Sumário dos requisitos">
          <h2 className="sidebar-heading">Sumário</h2>
          <p className="sidebar-note">Navegue pelo escopo e acompanhe o que já foi cuidado.</p>
          <label className="search-wrap">
            <span className="sr-only">Buscar requisito</span>
            <Search size={16} />
            <input className="search-input" type="search" placeholder="Buscar requisito..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <NavGroup label="Requisitos funcionais" nodes={functionalRequirements} query={query} activeId={activeId} onNavigate={() => setMobileOpen(false)} />
          <NavGroup label="Requisitos não funcionais" nodes={nonFunctionalRequirements} query={query} activeId={activeId} onNavigate={() => setMobileOpen(false)} />
        </aside>
        {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
        <main className="main" id="conteudo">
          <section className="hero">
            <span className="eyebrow">Documento vivo · v1.0</span>
            <h1>Especificação de requisitos do <em>Mission App</em></h1>
            <p className="hero-lede">Uma plataforma para conscientizar igrejas sobre o trabalho missionário realizado ao redor do mundo através de campanhas recorrentes, conexões e projetos de impacto.</p>
            <div className="hero-meta"><span>Última revisão: 06 mar 2025</span><a href="https://github.com/MissionAppFaithTech" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://www.figma.com/design/uMAwJPYKaEoN7ScjAmgZ6O/Mission-app" target="_blank" rel="noreferrer">Design no Figma ↗</a></div>
            <div className="hero-site-link">
              <span>Site com todos os requisitos especificados e detalhados:</span>
              <br />
              <a href="https://missionappfaithtech.github.io/MissionAppRequirementsList/" target="_blank" rel="noreferrer">https://missionappfaithtech.github.io/MissionAppRequirementsList/ ↗</a>
            </div>
          </section>
          <section className="summary-card" aria-label="Resumo do checklist">
            <div className="summary-ring" style={{ '--percent': progress.percent } as CSSProperties}><strong>{progress.percent}%</strong></div>
            <div className="summary-copy"><h2>O mapa está em movimento.</h2><p>Marque cada requisito individualmente. Seu progresso fica salvo neste dispositivo.</p></div>
            <div className="summary-stat"><strong>{progress.completed} / {progress.total}</strong><span>itens concluídos</span></div>
          </section>
          <div className="section-heading">
            <h2>Escopo do produto</h2>
            <p>{query || mode !== 'all' ? `${resultCount} áreas visíveis` : `${progress.total} itens no mapa`}</p>
          </div>
          <div className="filter-bar" role="toolbar" aria-label="Filtros de requisitos">
            {(['all', 'open', 'done'] as FilterMode[]).map((filter) => (
              <button key={filter} type="button" className={`filter-button${mode === filter ? ' active' : ''}`} onClick={() => setMode(filter)}>
                {filter === 'all' ? 'Todos' : filter === 'open' ? 'Em aberto' : 'Concluídos'}
              </button>
            ))}
          </div>
          {query && !resultCount ? <div className="empty-state"><strong>Nenhum requisito encontrado.</strong>Tente outra palavra ou remova o filtro de busca.</div> : (
            <>
              <section aria-labelledby="functional-heading">
                <div className="section-heading"><h2 id="functional-heading">Requisitos funcionais</h2><p>RF 01 — RF 19</p></div>
                <div className="req-list">{visibleFunctional.map((node) => <RequirementCard key={node.id} node={node} state={state} onToggle={toggle} />)}</div>
              </section>
              <section aria-labelledby="non-functional-heading">
                <div className="section-heading"><h2 id="non-functional-heading">Requisitos não funcionais</h2><p>NF 01 — NF 06</p></div>
                <div className="req-list">{visibleNonFunctional.map((node) => <RequirementCard key={node.id} node={node} state={state} onToggle={toggle} />)}</div>
              </section>
            </>
          )}
        </main>
      </div>
      <button className={`back-top${showTop ? ' visible' : ''}`} type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar ao topo"><ArrowUp size={18} /></button>
      {resetOpen && <ConfirmReset onCancel={() => setResetOpen(false)} onConfirm={reset} />}
    </div>
  );
}

export default App;