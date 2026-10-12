import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowUp, Check, Menu, Minus, Search, X } from 'lucide-react';
import { allRequirements, functionalRequirements, nonFunctionalRequirements, type RequirementNode } from '@/data/requirements';
import { filterNode, nodeMatches, type FilterMode } from '@/lib/filter';
import { describeMove } from '@/lib/notice';
import {
  CHECKLIST_BACK_KEY,
  CHECKLIST_FULL_KEY,
  countProgress,
  fetchCloudState,
  findRequirementNode,
  isPartiallyChecked,
  loadTimestampedChecklist,
  mergeTimestampedStates,
  resetCloudState,
  restoreTimestampedState,
  saveTimestampedChecklist,
  syncCloudItems,
  syncParentStates,
  toggleExclusive,
  toPlainState,
  type ChecklistState,
  type TimestampedChecklistState,
} from '@/lib/checklist';

type CheckVariant = 'back' | 'full';

const NOTICE_TIMEOUT_MS = 10000;

type MoveNotice = {
  message: string;
  // Both lists as they were before the move, so "Desfazer" can restore them.
  snapshot: { back: TimestampedChecklistState; full: TimestampedChecklistState };
};

function NodeCheck({
  node,
  state,
  variant,
  onToggle,
}: {
  node: RequirementNode;
  state: ChecklistState;
  variant: CheckVariant;
  onToggle: (id: string) => void;
}) {
  const label = variant === 'back' ? 'Back completo, front faltando' : 'Back e Front completo';
  const partial = isPartiallyChecked(node, state);
  return (
    <label
      className="check-wrap"
      title={`Marcar ${node.code} — ${label}`}
    >
      <input
        ref={(input) => { if (input) input.indeterminate = partial; }}
        className="check-input"
        type="checkbox"
        checked={Boolean(state[node.id])}
        onChange={() => onToggle(node.id)}
        aria-label={`${label}: ${node.code} ${node.title}`}
      />
      <span className={`check-box check-box--${variant}`} aria-hidden="true">
        <span className="check-letter">{variant === 'back' ? 'B' : 'F'}</span>
        <Check className="check-icon" size={15} strokeWidth={2.7} />
        <Minus className="partial-icon" size={15} strokeWidth={2.7} />
      </span>
    </label>
  );
}

function NodeMeta({ node, backState, fullState }: { node: RequirementNode; backState: ChecklistState; fullState: ChecklistState }) {
  const backProgress = countProgress([node], backState);
  const fullProgress = countProgress([node], fullState);
  return (
    <div className="req-meta-group">
      <span className="req-count req-count--back">{backProgress.completed}/{backProgress.total} só back</span>
      <span className="req-count req-count--full">{fullProgress.completed}/{fullProgress.total} full</span>
    </div>
  );
}

function SubRequirement({
  node,
  backState,
  fullState,
  onToggleBack,
  onToggleFull,
}: {
  node: RequirementNode;
  backState: ChecklistState;
  fullState: ChecklistState;
  onToggleBack: (id: string) => void;
  onToggleFull: (id: string) => void;
}) {
  const isBackDone = Boolean(backState[node.id]);
  const isFullDone = Boolean(fullState[node.id]);
  const stateClass = isFullDone ? ' is-full-done' : isBackDone ? ' is-back-done' : '';
  return (
    <li className={`sub-item${stateClass}`}>
      <div className="dual-check-group">
        <NodeCheck node={node} state={backState} variant="back" onToggle={onToggleBack} />
        <NodeCheck node={node} state={fullState} variant="full" onToggle={onToggleFull} />
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
  onToggleBack,
  onToggleFull,
}: {
  node: RequirementNode;
  backState: ChecklistState;
  fullState: ChecklistState;
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
          <NodeCheck node={node} state={backState} variant="back" onToggle={onToggleBack} />
          <NodeCheck node={node} state={fullState} variant="full" onToggle={onToggleFull} />
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
  const [notice, setNotice] = useState<MoveNotice | null>(null);
  const [noticePaused, setNoticePaused] = useState(false);

  // Derive plain boolean states for UI calculation & cascading parents
  const backState = useMemo(() => syncParentStates(allRequirements, toPlainState(backTsState)), [backTsState]);
  const fullState = useMemo(() => syncParentStates(allRequirements, toPlainState(fullTsState)), [fullTsState]);

  const backProgress = useMemo(() => countProgress(allRequirements, backState), [backState]);
  const fullProgress = useMemo(() => countProgress(allRequirements, fullState), [fullState]);

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

  const commitStates = (nextBack: TimestampedChecklistState, nextFull: TimestampedChecklistState) => {
    if (nextBack !== backTsState) {
      setBackTsState(nextBack);
      saveTimestampedChecklist(nextBack, CHECKLIST_BACK_KEY);
    }
    if (nextFull !== fullTsState) {
      setFullTsState(nextFull);
      saveTimestampedChecklist(nextFull, CHECKLIST_FULL_KEY);
    }
  };

  const toggle = (id: string, type: CheckVariant) => {
    const isBack = type === 'back';
    const result = toggleExclusive(isBack ? backTsState : fullTsState, isBack ? fullTsState : backTsState, id, type);
    commitStates(
      isBack ? result.nextTsState : result.nextOppositeTsState,
      isBack ? result.nextOppositeTsState : result.nextTsState,
    );
    syncCloudItems(result.updates);

    // Checking an item moves it out of the other list: say so, and offer to undo it.
    const oppositeType: CheckVariant = isBack ? 'full' : 'back';
    const movedCount = result.updates.filter((update) => update.type === oppositeType && !update.value).length;
    const node = findRequirementNode(allRequirements, id);
    if (movedCount > 0 && node) {
      setNotice({ message: describeMove(node.code, type, movedCount), snapshot: { back: backTsState, full: fullTsState } });
    } else {
      // An older undo snapshot would also revert this newer change, so it must go away.
      setNotice(null);
    }
  };

  const toggleBack = (id: string) => toggle(id, 'back');
  const toggleFull = (id: string) => toggle(id, 'full');

  const undoMove = () => {
    if (!notice) return;
    const timestamp = Date.now();
    const restoredBack = restoreTimestampedState(backTsState, notice.snapshot.back, 'back', timestamp);
    const restoredFull = restoreTimestampedState(fullTsState, notice.snapshot.full, 'full', timestamp);
    commitStates(restoredBack.nextTsState, restoredFull.nextTsState);
    syncCloudItems([...restoredBack.updates, ...restoredFull.updates]);
    setNotice(null);
  };

  // Auto-dismiss the notice, except while the user is hovering/focusing it.
  useEffect(() => {
    if (!notice || noticePaused) return undefined;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [notice, noticePaused]);

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
            <div className="top-progress">
              <div className="top-progress-label"><span id="top-progress-back">Só back</span><span>{backProgress.percent}%</span></div>
              <progress className="progress-track progress-track--back" value={backProgress.percent} max={100} aria-labelledby="top-progress-back" />
            </div>
            <div className="top-progress">
              <div className="top-progress-label"><span id="top-progress-full">Tudo</span><span>{fullProgress.percent}%</span></div>
              <progress className="progress-track progress-track--full" value={fullProgress.percent} max={100} aria-labelledby="top-progress-full" />
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
          <p className="sidebar-note">Navegue pelo escopo e acompanhe o que já foi implementado.</p>
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
            <span className="eyebrow">Documentação do Progresso</span>
            <h1>Especificação de requisitos do <em>Mission App</em></h1>
            <p className="hero-lede">Uma plataforma para conscientizar igrejas sobre o trabalho missionário realizado ao redor do mundo através de campanhas recorrentes, conexões e projetos de impacto.</p>
            <div className="hero-meta"><span>Última revisão: 12 out 2026</span><a href="https://github.com/MissionAppFaithTech" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://www.figma.com/design/uMAwJPYKaEoN7ScjAmgZ6O/Mission-app" target="_blank" rel="noreferrer">Design no Figma ↗</a></div>
            <div className="hero-site-link">
              <span>Site com todos os requisitos especificados e detalhados:</span>
              <br />
              <a href="https://missionappfaithtech.github.io/MissionAppRequirementsList/" target="_blank" rel="noreferrer">https://missionappfaithtech.github.io/MissionAppRequirementsList/ ↗</a>
            </div>
          </section>
          <section className="summary-card" aria-label="Resumo do checklist">
            <div className="summary-ring-wrap">
              <div className="summary-ring summary-ring--back" style={{ '--percent': backProgress.percent } as CSSProperties} aria-hidden="true"><strong>{backProgress.percent}%</strong></div>
              <progress className="sr-only" value={backProgress.percent} max={100} aria-label="Back completo, front faltando" />
              <span className="summary-ring-label summary-ring-label--back">Back completo. Front faltando.</span>
            </div>
            <div className="summary-ring-wrap">
              <div className="summary-ring summary-ring--full" style={{ '--percent': fullProgress.percent } as CSSProperties} aria-hidden="true"><strong>{fullProgress.percent}%</strong></div>
              <progress className="sr-only" value={fullProgress.percent} max={100} aria-label="Back e Front integrados e completos" />
              <span className="summary-ring-label summary-ring-label--full">Back e Front integrados e completos.</span>
            </div>
            <div className="summary-copy"><h2>O desenvolvimento está avançando.</h2><p>Marque cada requisito individualmente. Seu progresso é sincronizado na nuvem e salvo neste dispositivo.</p></div>
            <div className="summary-stat">
              <div className="summary-stat-block">
                <div className="summary-stat-row">
                  <span className="summary-stat-dot summary-stat-dot--back" />
                  <strong>{backProgress.completed} / {backProgress.total}</strong>
                </div>
                <span>back sem front</span>
              </div>
              <div className="summary-stat-block">
                <div className="summary-stat-row">
                  <span className="summary-stat-dot summary-stat-dot--full" />
                  <strong>{fullProgress.completed} / {fullProgress.total}</strong>
                </div>
                <span>back e front integrados</span>
              </div>
            </div>
          </section>

          {/* Legend strip — checkbox examples */}
          <h3 className="legend-title">Legenda</h3>
          <div className="legend-strip">
            <div className="legend-item">
              <span className="legend-checkbox legend-checkbox--back" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
              <span>Caixa <strong>B</strong>: back completo. Front faltando.</span>
            </div>
            <div className="legend-item">
              <span className="legend-checkbox legend-checkbox--full" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
              <span>Caixa <strong>F</strong>: back e front integrados e completos.</span>
            </div>
            <div className="legend-item">
              <span className="legend-checkbox legend-checkbox--partial" aria-hidden="true"><Minus size={14} strokeWidth={3} /></span>
              <span><strong>Traço:</strong> somente parte dos subitens está marcado como pronto neste item.</span>
            </div>
          </div>
          <p className="legend-note">Cada item fica em uma só caixa: ao marcar uma, a outra é desmarcada. Você pode desfazer logo após a troca.</p>

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
                <div className="section-heading"><h2 id="functional-heading">Requisitos funcionais</h2><p>RF 01 — RF 20</p></div>
                <div className="req-list">
                  {visibleFunctional.map((node) => (
                    <RequirementCard
                      key={node.id}
                      node={node}
                      backState={backState}
                      fullState={fullState}
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
      <div className="sr-only" role="status" aria-live="polite">{notice?.message ?? ''}</div>
      {notice && (
        <div
          className="toast"
          role="group"
          aria-label="Aviso de troca de lista"
          onMouseEnter={() => setNoticePaused(true)}
          onMouseLeave={() => setNoticePaused(false)}
          onFocus={() => setNoticePaused(true)}
          onBlur={() => setNoticePaused(false)}
        >
          <p className="toast-text">{notice.message}</p>
          <button className="toast-action" type="button" onClick={undoMove}>Desfazer</button>
          <button className="toast-close" type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso"><X size={14} /></button>
        </div>
      )}
      <button className={`back-top${showTop ? ' visible' : ''}`} type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar ao topo"><ArrowUp size={18} /></button>
    </div>
  );
}

export default App;