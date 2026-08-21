import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowUp, Check, Menu, Search, X } from 'lucide-react';
import { allRequirements, functionalRequirements, nonFunctionalRequirements, normalizeText, type RequirementNode } from '@/data/requirements';
import {
  CHECKLIST_BACK_KEY,
  CHECKLIST_FULL_KEY,
  countProgress,
  fetchCloudState,
  getLockedIds,
  loadTimestampedChecklist,
  mergeTimestampedStates,
  resetCloudState,
  saveTimestampedChecklist,
  syncCloudItems,
  syncParentStates,
  toggleTimestampedChecklist,
  toPlainState,
  type ChecklistState,
  type TimestampedChecklistState,
} from '@/lib/checklist';

type FilterMode = 'all' | 'open' | 'done';
type CheckVariant = 'back' | 'full';

const LOCK_TOOLTIP = 'Para selecionar esta opção, desmarque a outra';

function nodeMatches(node: RequirementNode, query: string): boolean {
  if (!query) return true;
  const haystack = normalizeText(`${node.code} ${node.title} ${node.description ?? ''}`);
  return haystack.includes(normalizeText(query)) || Boolean(node.children?.some((child) => nodeMatches(child, query)));
}

function filterNode(node: RequirementNode, query: string, mode: FilterMode, backState: ChecklistState, fullState: ChecklistState): RequirementNode | null {
  const children = node.children?.map((child) => filterNode(child, query, mode, backState, fullState)).filter(Boolean) as RequirementNode[] | undefined;
  const ownMatch = nodeMatches(node, query);
  const descendantMatch = Boolean(children?.length);
  const isDone = Boolean(backState[node.id]) || Boolean(fullState[node.id]);
  const statusMatch = mode === 'all' || (mode === 'done' ? isDone || descendantMatch : !isDone || descendantMatch);
  if ((!ownMatch && !children?.length) || !statusMatch) return null;
  return { ...node, children };
}

function NodeCheck({
  node,
  state,
  locked,
  variant,
  onToggle,
}: {
  node: RequirementNode;
  state: ChecklistState;
  locked: boolean;
  variant: CheckVariant;
  onToggle: (id: string) => void;
}) {
  const label = variant === 'back' ? 'Back completo' : 'Back e Front completo';
  return (
    <label
      className="check-wrap"
      title={locked ? LOCK_TOOLTIP : `Marcar ${node.code} — ${label}`}
    >
      <input
        className="check-input"
        type="checkbox"
        checked={Boolean(state[node.id])}
        onChange={() => onToggle(node.id)}
        disabled={locked}
        aria-label={`${label}: ${node.code} ${node.title}`}
      />
      <span className={`check-box check-box--${variant}`} aria-hidden="true">
        <Check size={15} strokeWidth={2.7} />
      </span>
    </label>
  );
}

function NodeMeta({ node, backState, fullState }: { node: RequirementNode; backState: ChecklistState; fullState: ChecklistState }) {
  const backProgress = countProgress([node], backState);
  const fullProgress = countProgress([node], fullState);
  return (
    <div className="req-meta-group">
      <span className="req-count req-count--back">{backProgress.completed}/{backProgress.total} back</span>
      <span className="req-count req-count--full">{fullProgress.completed}/{fullProgress.total} full</span>
    </div>
  );
}

function SubRequirement({
  node,
  backState,
  fullState,
  backLockedIds,
  fullLockedIds,
  onToggleBack,
  onToggleFull,
}: {
  node: RequirementNode;
  backState: ChecklistState;
  fullState: ChecklistState;
  backLockedIds: Set<string>;
  fullLockedIds: Set<string>;
  onToggleBack: (id: string) => void;
  onToggleFull: (id: string) => void;
}) {
  const isBackDone = Boolean(backState[node.id]);
  const isFullDone = Boolean(fullState[node.id]);
  const stateClass = isFullDone ? ' is-full-done' : isBackDone ? ' is-back-done' : '';
  return (
    <li className={`sub-item${stateClass}`}>
      <div className="dual-check-group">
        <NodeCheck node={node} state={backState} locked={backLockedIds.has(node.id)} variant="back" onToggle={onToggleBack} />
        <NodeCheck node={node} state={fullState} locked={fullLockedIds.has(node.id)} variant="full" onToggle={onToggleFull} />
      </div>
      <div>
        <div className="req-title-row"><span className="req-code">{node.code}</span><h4 className="req-title">{node.title}</h4></div>
        {node.description && <p className="req-description">{node.description}</p>}
        {node.children?.length ? (
          <ul className="sub-list">
            {node.children.map((child) => (
              <SubRequirement
                key={child.id}
                node={child}
                backState={backState}
                fullState={fullState}
                backLockedIds={backLockedIds}
                fullLockedIds={fullLockedIds}
                onToggleBack={onToggleBack}
                onToggleFull={onToggleFull}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function RequirementCard({
  node,
  backState,
  fullState,
  backLockedIds,
  fullLockedIds,
  onToggleBack,
  onToggleFull,
}: {
  node: RequirementNode;
  backState: ChecklistState;
  fullState: ChecklistState;
  backLockedIds: Set<string>;
  fullLockedIds: Set<string>;
  onToggleBack: (id: string) => void;
  onToggleFull: (id: string) => void;
}) {
  const backProgress = countProgress([node], backState);
  const fullProgress = countProgress([node], fullState);
  const isFullDone = fullProgress.completed === fullProgress.total;
  const isBackDone = backProgress.completed === backProgress.total;
  const stateClass = isFullDone ? ' is-full-done' : isBackDone ? ' is-back-done' : '';
  return (
    <article id={node.id} className={`req-card${stateClass}`}>
      <div className="req-card-head">
        <div className="dual-check-group">
          <NodeCheck node={node} state={backState} locked={backLockedIds.has(node.id)} variant="back" onToggle={onToggleBack} />
          <NodeCheck node={node} state={fullState} locked={fullLockedIds.has(node.id)} variant="full" onToggle={onToggleFull} />
        </div>
        <div>
          <div className="req-title-row"><span className="req-code">{node.code}</span><h3 className="req-title">{node.title}</h3></div>
          {node.description && <p className="req-description">{node.description}</p>}
        </div>
        <NodeMeta node={node} backState={backState} fullState={fullState} />
      </div>
      {node.children?.length ? (
        <ul className="sub-list">
          {node.children.map((child) => (
            <SubRequirement
              key={child.id}
              node={child}
              backState={backState}
              fullState={fullState}
              backLockedIds={backLockedIds}
              fullLockedIds={fullLockedIds}
              onToggleBack={onToggleBack}
              onToggleFull={onToggleFull}
            />
          ))}
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

function App() {
  const [backTsState, setBackTsState] = useState<TimestampedChecklistState>(() => loadTimestampedChecklist(CHECKLIST_BACK_KEY));
  const [fullTsState, setFullTsState] = useState<TimestampedChecklistState>(() => loadTimestampedChecklist(CHECKLIST_FULL_KEY));
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<FilterMode>('all');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState('rf-1');
  const [showTop, setShowTop] = useState(false);

  // Derive plain boolean states for UI calculation & cascading parents
  const backState = useMemo(() => syncParentStates(allRequirements, toPlainState(backTsState)), [backTsState]);
  const fullState = useMemo(() => syncParentStates(allRequirements, toPlainState(fullTsState)), [fullTsState]);

  const backProgress = useMemo(() => countProgress(allRequirements, backState), [backState]);
  const fullProgress = useMemo(() => countProgress(allRequirements, fullState), [fullState]);

  // Compute locked IDs: nodes checked in backState lock those IDs in the full checklist, and vice-versa
  const backLockedIds = useMemo(() => getLockedIds(fullState, allRequirements), [fullState]);
  const fullLockedIds = useMemo(() => getLockedIds(backState, allRequirements), [backState]);

  // Save to localStorage on change
  useEffect(() => { saveTimestampedChecklist(backTsState, CHECKLIST_BACK_KEY); }, [backTsState]);
  useEffect(() => { saveTimestampedChecklist(fullTsState, CHECKLIST_FULL_KEY); }, [fullTsState]);

  // Initial cloud state sync on mount (Vercel KV fetch)
  useEffect(() => {
    let mounted = true;
    fetchCloudState().then((cloudState) => {
      if (!mounted || !cloudState) return;

      setBackTsState((currentLocal) => {
        const merged = mergeTimestampedStates(currentLocal, cloudState.back);
        saveTimestampedChecklist(merged, CHECKLIST_BACK_KEY);
        return merged;
      });

      setFullTsState((currentLocal) => {
        const merged = mergeTimestampedStates(currentLocal, cloudState.full);
        saveTimestampedChecklist(merged, CHECKLIST_FULL_KEY);
        return merged;
      });
    });

    return () => { mounted = false; };
  }, []);

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

  const toggleBack = (id: string) => {
    const timestamp = Date.now();
    const { nextTsState, updates } = toggleTimestampedChecklist(backTsState, id, 'back', timestamp);
    setBackTsState(nextTsState);
    saveTimestampedChecklist(nextTsState, CHECKLIST_BACK_KEY);
    syncCloudItems(updates);
  };

  const toggleFull = (id: string) => {
    const timestamp = Date.now();
    const { nextTsState, updates } = toggleTimestampedChecklist(fullTsState, id, 'full', timestamp);
    setFullTsState(nextTsState);
    saveTimestampedChecklist(nextTsState, CHECKLIST_FULL_KEY);
    syncCloudItems(updates);
  };

  const visibleFunctional = useMemo(() => functionalRequirements.map((node) => filterNode(node, query, mode, backState, fullState)).filter(Boolean) as RequirementNode[], [query, mode, backState, fullState]);
  const visibleNonFunctional = useMemo(() => nonFunctionalRequirements.map((node) => filterNode(node, query, mode, backState, fullState)).filter(Boolean) as RequirementNode[], [query, mode, backState, fullState]);
  const resultCount = visibleFunctional.length + visibleNonFunctional.length;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#conteudo" aria-label="Ir para o conteúdo principal">
          <img src="/logo.png" alt="Mission App Logo" className="brand-logo" />
          <span className="brand-copy"><span className="brand-name">Mission App</span><span className="brand-caption">Atlas de requisitos</span></span>
        </a>
        <div className="top-actions">
          <div className="top-progress-group">
            <div className="top-progress" aria-label={`Back: ${backProgress.percent}% concluído`}>
              <div className="top-progress-label"><span>Back</span><span>{backProgress.percent}%</span></div>
              <div className="progress-track"><div className="progress-fill progress-fill--back" style={{ width: `${backProgress.percent}%` }} /></div>
            </div>
            <div className="top-progress" aria-label={`Full: ${fullProgress.percent}% concluído`}>
              <div className="top-progress-label"><span>Full</span><span>{fullProgress.percent}%</span></div>
              <div className="progress-track"><div className="progress-fill progress-fill--full" style={{ width: `${fullProgress.percent}%` }} /></div>
            </div>
          </div>
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
            <div className="summary-ring-wrap">
              <div className="summary-ring summary-ring--back" style={{ '--percent': backProgress.percent } as CSSProperties}><strong>{backProgress.percent}%</strong></div>
              <span className="summary-ring-label summary-ring-label--back">Back completo. Front faltando.</span>
            </div>
            <div className="summary-ring-wrap">
              <div className="summary-ring summary-ring--full" style={{ '--percent': fullProgress.percent } as CSSProperties}><strong>{fullProgress.percent}%</strong></div>
              <span className="summary-ring-label summary-ring-label--full">Back e Front Completo.</span>
            </div>
            <div className="summary-copy"><h2>O mapa está em movimento.</h2><p>Marque cada requisito individualmente. Seu progresso é sincronizado na nuvem e salvo neste dispositivo.</p></div>
            <div className="summary-stat">
              <div className="summary-stat-row">
                <span className="summary-stat-dot summary-stat-dot--back" />
                <strong>{backProgress.completed} / {backProgress.total}</strong>
              </div>
              <span>back concluídos</span>
              <div className="summary-stat-row" style={{ marginTop: '6px' }}>
                <span className="summary-stat-dot summary-stat-dot--full" />
                <strong>{fullProgress.completed} / {fullProgress.total}</strong>
              </div>
              <span>full concluídos</span>
            </div>
          </section>

          {/* Legend strip — checkbox examples */}
          <h3 className="legend-title">Legenda</h3>
          <div className="legend-strip">
            <div className="legend-item">
              <span className="legend-checkbox legend-checkbox--back" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
              Back completo. Front faltando.
            </div>
            <div className="legend-item">
              <span className="legend-checkbox legend-checkbox--full" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
              Back e Front Completo.
            </div>
          </div>

          <div className="section-heading">
            <h2>Escopo do produto</h2>
            <p>{query || mode !== 'all' ? `${resultCount} áreas visíveis` : `${backProgress.total} itens no mapa`}</p>
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
                <div className="req-list">
                  {visibleFunctional.map((node) => (
                    <RequirementCard
                      key={node.id}
                      node={node}
                      backState={backState}
                      fullState={fullState}
                      backLockedIds={backLockedIds}
                      fullLockedIds={fullLockedIds}
                      onToggleBack={toggleBack}
                      onToggleFull={toggleFull}
                    />
                  ))}
                </div>
              </section>
              <section aria-labelledby="non-functional-heading">
                <div className="section-heading"><h2 id="non-functional-heading">Requisitos não funcionais</h2><p>NF 01 — NF 06</p></div>
                <div className="req-list">
                  {visibleNonFunctional.map((node) => (
                    <RequirementCard
                      key={node.id}
                      node={node}
                      backState={backState}
                      fullState={fullState}
                      backLockedIds={backLockedIds}
                      fullLockedIds={fullLockedIds}
                      onToggleBack={toggleBack}
                      onToggleFull={toggleFull}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
      <button className={`back-top${showTop ? ' visible' : ''}`} type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar ao topo"><ArrowUp size={18} /></button>
    </div>
  );
}

export default App;