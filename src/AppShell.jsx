import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, BarChart3, Check, ChevronRight, Clock3, Copy,
  Database, FlaskConical, FolderKanban, Gauge, Network, Pause, Play,
  Plus, Search, Settings2, Square, X,
} from 'lucide-react';
import { NetworkMap, ValidationView, StatusBadge } from './App.jsx';
import './workspace.css';
import './shell.css';

const STORAGE_KEY = 'cascade-lab-shell-v3';
const PHASES = ['更新事件', '生成候选', '信息流排序', '模型决策', '提交行为'];
const NAV = [
  ['experiments', '我的实验', FolderKanban],
  ['processes', '进程管理', Clock3],
  ['library', '事件库', Database],
  ['validation', '验证中心', BarChart3],
];
const PAGE_META = {
  experiments: ['我的实验', '管理实验定义、版本与配置。'],
  processes: ['进程管理', '监控正在执行和等待执行的模拟任务。'],
  library: ['事件库', '检索目标事件并维护背景事件资源。'],
  validation: ['验证中心', '查看已完成实验的真实趋势与仿真结果。'],
  create: ['新建实验', '创建一个独立的模拟实验定义。'],
};
const EVENTS = [
  { id: 'EVT-001', name: '华北极端降雨预警', category: '社会', posts: 2431, summary: '强降雨预警、交通影响与应急响应相关信息。' },
  { id: 'EVT-002', name: '摄影比赛 AI 作品争议', category: '科技', posts: 1256, summary: '围绕 AI 生成作品参赛与评审规则的讨论。' },
  { id: 'EVT-003', name: '公共交通应急处置事件', category: '社会', posts: 806, summary: '公共交通场景中的突发事件与处置过程。' },
  { id: 'EVT-004', name: '公益项目舆情争议', category: '社会', posts: 1862, summary: '公益资助信息受到质疑后的回应与讨论。' },
  { id: 'EVT-005', name: '大型体育赛事决赛', category: '体育', posts: 5320, summary: '赛事结果、现场片段与赛后评论。' },
  { id: 'EVT-006', name: '消费电子新品发布', category: '科技', posts: 2180, summary: '新品发布、参数解读与用户讨论。' },
  { id: 'EVT-007', name: '电影新作上映', category: '文娱', posts: 3610, summary: '电影上映、口碑扩散与主创相关信息。' },
  { id: 'EVT-008', name: '城市公共服务调整', category: '生活', posts: 523, summary: '公共服务政策变化及居民反馈。' },
];
const DEFAULT_FORM = { name: '', targetIds: ['EVT-001'], background: 200, agents: 10000, stepMinutes: 30, browse: 8, duration: 14, seed: 20261012, schedule: '持续随机注入', capacity: 35 };

function buildExperiment(form, status = 'draft', step = 0) {
  const id = crypto.randomUUID();
  return {
    ...DEFAULT_FORM, ...form, id, code: `EXP-${id.slice(0, 8).toUpperCase()}`,
    status, step, phase: 0, batch: 0,
    totalSteps: Math.ceil(form.duration * 1440 / form.stepMinutes),
    createdAt: new Date().toISOString(), queuedAt: null,
    logs: [{ time: new Date().toLocaleTimeString('zh-CN'), message: '实验定义已创建' }],
  };
}
function initialStore() {
  try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (data?.experiments) return data; } catch {}
  return {
    slots: 2,
    experiments: [
      buildExperiment({ ...DEFAULT_FORM, name: '暴雨预警 · 背景竞争实验' }, 'paused', 126),
      buildExperiment({ ...DEFAULT_FORM, name: 'AI 摄影争议 · 基线组', targetIds: ['EVT-002'] }, 'completed', 672),
      buildExperiment({ ...DEFAULT_FORM, name: '公共交通 · 注意力容量实验', targetIds: ['EVT-003'], browse: 5 }, 'draft', 0),
    ],
  };
}
function appendLog(exp, message) {
  return { ...exp, logs: [...exp.logs, { time: new Date().toLocaleTimeString('zh-CN'), message }].slice(-300) };
}
function tabId(type, entityId = '') { return entityId ? `${type}:${entityId}` : type; }
function tabTitle(type, entity) {
  if (type === 'experiment') return entity?.name || '实验详情';
  if (type === 'event') return entity?.name || '事件详情';
  return PAGE_META[type]?.[0] || '页面';
}

export default function AppShell() {
  const [store, setStore] = useState(initialStore);
  const [tabs, setTabs] = useState([{ id: 'experiments', type: 'experiments', title: '我的实验', closable: false }]);
  const [activeId, setActiveId] = useState('experiments');
  const [notice, setNotice] = useState('');
  const active = tabs.find(t => t.id === activeId) || tabs[0];
  const running = store.experiments.filter(e => e.status === 'running');
  const queued = store.experiments.filter(e => e.status === 'queued').sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }, [store]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 3200); return () => clearTimeout(t); }, [notice]);
  useEffect(() => {
    const timer = setInterval(() => setStore(current => {
      let changed = false;
      let experiments = current.experiments.map(exp => {
        if (exp.status !== 'running') return exp;
        changed = true;
        let next = { ...exp, batch: exp.batch + 1 };
        if (next.batch >= 4) { next.batch = 0; next.phase += 1; }
        if (next.phase >= PHASES.length) { next.phase = 0; next.step += 1; next = appendLog(next, `第 ${next.step} 步提交完成`); }
        if (next.step >= next.totalSteps) next = appendLog({ ...next, step: next.totalSteps, status: 'completed' }, '模拟任务完成');
        return next;
      });
      const free = Math.max(0, current.slots - experiments.filter(e => e.status === 'running').length);
      const ready = new Set(experiments.filter(e => e.status === 'queued').sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0)).slice(0, free).map(e => e.id));
      experiments = experiments.map(e => ready.has(e.id) ? appendLog({ ...e, status: 'running' }, '获得运行槽位，任务开始') : e);
      if (ready.size) changed = true;
      return changed ? { ...current, experiments } : current;
    }), 900);
    return () => clearInterval(timer);
  }, []);

  function openTab(type, entityId = '', title) {
    const id = tabId(type, entityId);
    setTabs(current => current.some(t => t.id === id) ? current : [...current, { id, type, entityId, title: title || tabTitle(type), closable: id !== 'experiments' }]);
    setActiveId(id);
  }
  function closeTab(id) {
    setTabs(current => {
      const index = current.findIndex(t => t.id === id);
      const next = current.filter(t => t.id !== id);
      if (activeId === id) setActiveId((next[Math.max(0, index - 1)] || next[0]).id);
      return next;
    });
  }
  function updateExperiment(id, action) {
    setStore(current => ({ ...current, experiments: current.experiments.map(exp => {
      if (exp.id !== id) return exp;
      if (action === 'queue') return appendLog({ ...exp, status: 'queued', queuedAt: Date.now() }, '已提交到运行队列');
      if (action === 'pause') return appendLog({ ...exp, status: 'paused' }, '任务已暂停');
      if (action === 'resume') return appendLog({ ...exp, status: 'queued', queuedAt: Date.now() }, '恢复请求已进入队列');
      if (action === 'stop') return appendLog({ ...exp, status: 'stopped' }, '任务已停止，保留已完成步骤');
      return exp;
    }) }));
  }
  function duplicateExperiment(exp) {
    const copy = buildExperiment({ ...exp, name: `${exp.name} · 副本` });
    setStore(current => ({ ...current, experiments: [copy, ...current.experiments] }));
    setNotice('已复制为新的实验草稿');
    openTab('experiment', copy.id, copy.name);
  }
  function createExperiment(form) {
    const exp = buildExperiment(form);
    setStore(current => ({ ...current, experiments: [exp, ...current.experiments] }));
    setTabs(current => current.filter(t => t.id !== 'create'));
    openTab('experiment', exp.id, exp.name);
    setNotice('实验草稿已创建');
  }

  const breadcrumb = getBreadcrumb(active, store.experiments);
  return <div className="app shell-app">
    <Sidebar activeType={active.type} running={running.length} queued={queued.length} slots={store.slots} onNavigate={type => openTab(type)} />
    <main className="shell-main">
      <div className="demo-banner"><span><i />前端演示模式</span>页面结构与交互可用；vLLM、智能体和真实数据尚未接入。</div>
      <WorkspaceTabs tabs={tabs} activeId={activeId} onActivate={setActiveId} onClose={closeTab} />
      <Breadcrumb items={breadcrumb} onRoot={() => openTab('experiments')} />
      <PageRouter
        tab={active} store={store} setStore={setStore} openTab={openTab}
        updateExperiment={updateExperiment} duplicateExperiment={duplicateExperiment}
        onCreate={createExperiment} running={running} queued={queued}
      />
      <footer className="app-footer">涟漪实验室 / 多事件传播仿真工作台 <span>本地前端 · 演示模式</span></footer>
    </main>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
  </div>;
}

function Sidebar({ activeType, running, queued, slots, onNavigate }) {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><Activity size={19} /></span><div><b>涟漪实验室</b><small>CASCADE LAB</small></div></div>
    <div className="workspace"><span>个人工作区</span><div className="workspace-label">社会传播研究 / 本地</div></div>
    <nav><p>研究工作台</p>{NAV.map(([id, label, Icon]) => <button key={id} className={activeType === id ? 'active' : ''} onClick={() => onNavigate(id)}><Icon size={18} />{label}</button>)}</nav>
    <div className="sidebar-bottom"><div className="capacity"><div><span>演示运行槽位</span><b>{running} / {slots}</b></div><div className="capacity-track"><i style={{ width: `${running / slots * 100}%` }} /></div><small>{queued} 个任务等待运行</small></div><div className="user"><span>KQ</span><div><b>我的工作区</b><small>页面与实验保存在浏览器</small></div></div></div>
  </aside>;
}
function WorkspaceTabs({ tabs, activeId, onActivate, onClose }) {
  return <div className="workspace-tabs" aria-label="已打开页面">{tabs.map(tab => <div key={tab.id} className={tab.id === activeId ? 'active' : ''}><button className="tab-label" onClick={() => onActivate(tab.id)}>{tab.type === 'experiment' ? <FlaskConical size={14} /> : tab.type === 'event' ? <Database size={14} /> : <FolderKanban size={14} />}<span>{tab.title}</span></button>{tab.closable && <button className="tab-close" aria-label={`关闭 ${tab.title}`} onClick={() => onClose(tab.id)}><X size={13} /></button>}</div>)}</div>;
}
function Breadcrumb({ items, onRoot }) {
  return <nav className="breadcrumb" aria-label="页面路径"><button onClick={onRoot}>工作区</button>{items.map((item, index) => <span key={`${item}-${index}`}><ChevronRight size={13} />{index === items.length - 1 ? <b>{item}</b> : <em>{item}</em>}</span>)}</nav>;
}
function getBreadcrumb(tab, experiments) {
  if (tab.type === 'experiment') return ['我的实验', experiments.find(e => e.id === tab.entityId)?.name || '实验详情'];
  if (tab.type === 'event') return ['事件库', EVENTS.find(e => e.id === tab.entityId)?.name || '事件详情'];
  if (tab.type === 'create') return ['我的实验', '新建实验'];
  return [PAGE_META[tab.type]?.[0] || '页面'];
}

function PageRouter(props) {
  const { tab } = props;
  if (tab.type === 'experiments') return <ExperimentsPage {...props} />;
  if (tab.type === 'processes') return <ProcessesPage {...props} />;
  if (tab.type === 'library') return <LibraryPage {...props} />;
  if (tab.type === 'validation') return <ValidationCenter {...props} />;
  if (tab.type === 'create') return <CreateExperimentPage initialTarget={tab.entityId} onSave={props.onCreate} />;
  if (tab.type === 'experiment') return <ExperimentPage {...props} experiment={props.store.experiments.find(e => e.id === tab.entityId)} />;
  if (tab.type === 'event') return <EventPage {...props} event={EVENTS.find(e => e.id === tab.entityId)} />;
  return null;
}
function PageHeader({ type, action }) {
  const [title, description] = PAGE_META[type];
  return <section className="hero-row"><div><span className="eyebrow">{type.toUpperCase()}</span><h1>{title}</h1><p>{description}</p></div>{action}</section>;
}

function ExperimentsPage({ store, openTab, duplicateExperiment }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const rows = store.experiments.filter(e => (status === 'all' || e.status === status) && `${e.name}${e.code}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeader type="experiments" action={<button className="primary" onClick={() => openTab('create')}><Plus size={17} />新建实验</button>} />
    <section className="panel"><div className="panel-head"><div><h2>实验资产</h2><span>{store.experiments.length} 个实验定义</span></div><div className="filters"><div className="search"><Search size={15} /><input aria-label="搜索实验" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索名称或编号" /></div><select aria-label="筛选实验状态" value={status} onChange={e => setStatus(e.target.value)}><option value="all">全部状态</option><option value="draft">草稿</option><option value="running">运行中</option><option value="paused">已暂停</option><option value="completed">已完成</option></select></div></div>
      <div className="table-wrap"><table><thead><tr><th>实验</th><th>配置摘要</th><th>版本状态</th><th>最近进度</th><th>资产操作</th></tr></thead><tbody>{rows.map(exp => <tr key={exp.id}><td><button className="name-link" onClick={() => openTab('experiment', exp.id, exp.name)}>{exp.name}</button><small className="block">{exp.code}</small></td><td><b>{exp.targetIds.length} 个目标事件</b><small className="block">{exp.background} 个背景 · {exp.agents.toLocaleString()} 个智能体</small></td><td><Badge status={exp.status} /></td><td><span>{exp.step} / {exp.totalSteps} 步</span><small className="block">配置创建于 {new Date(exp.createdAt).toLocaleDateString('zh-CN')}</small></td><td><button className="secondary small-button" onClick={() => duplicateExperiment(exp)}><Copy size={14} />复制实验</button><button className="text-button" onClick={() => openTab('experiment', exp.id, exp.name)}>打开详情 →</button></td></tr>)}</tbody></table></div>
    </section></>;
}

function ProcessesPage({ store, setStore, running, queued, updateExperiment, openTab }) {
  const tasks = store.experiments.filter(e => ['running', 'queued', 'paused', 'stopped'].includes(e.status));
  return <><PageHeader type="processes" />
    <section className="process-overview"><div className="process-kpi"><Activity /><span>正在运行</span><b>{running.length}</b></div><div className="process-kpi"><Clock3 /><span>等待队列</span><b>{queued.length}</b></div><div className="process-kpi"><Gauge /><span>并行槽位</span><b>{store.slots}</b></div><label>调整槽位<select value={store.slots} onChange={e => setStore(s => ({ ...s, slots: +e.target.value }))}>{[1, 2, 3, 4].map(n => <option key={n} disabled={n < running.length}>{n}</option>)}</select></label></section>
    <section className="panel"><div className="panel-head"><div><h2>运行任务</h2><span>仅显示进入调度系统的实验</span></div></div><div className="process-list">{tasks.length ? tasks.map(exp => <article key={exp.id}><div className="process-title"><Badge status={exp.status} /><div><button className="name-link" onClick={() => openTab('experiment', exp.id, exp.name)}>{exp.name}</button><small>{exp.code}</small></div></div><div className="process-progress"><div><span>{exp.status === 'running' ? `当前：${PHASES[exp.phase]}` : exp.status === 'queued' ? `队列第 ${queued.findIndex(e => e.id === exp.id) + 1} 位` : '任务状态已保存'}</span><b>{Math.floor(exp.step / exp.totalSteps * 100)}%</b></div><div className="progress"><i style={{ width: `${exp.step / exp.totalSteps * 100}%` }} /></div><small>第 {exp.step} / {exp.totalSteps} 步</small></div><ProcessControls exp={exp} onAction={updateExperiment} /></article>) : <div className="empty">当前没有运行任务。请从实验详情提交一个草稿。</div>}</div></section></>;
}
function ProcessControls({ exp, onAction }) {
  return <div className="controls">{exp.status === 'running' && <button className="secondary" onClick={() => onAction(exp.id, 'pause')}><Pause size={14} />暂停</button>}{['paused', 'stopped'].includes(exp.status) && <button className="primary" onClick={() => onAction(exp.id, 'resume')}><Play size={14} />继续</button>}{['running', 'queued', 'paused'].includes(exp.status) && <button className="secondary" onClick={() => onAction(exp.id, 'stop')}><Square size={13} />{exp.status === 'queued' ? '取消排队' : '停止'}</button>}</div>;
}

function LibraryPage({ openTab }) {
  const [query, setQuery] = useState('');
  const rows = EVENTS.filter(e => `${e.name}${e.category}${e.summary}`.includes(query));
  return <><PageHeader type="library" />
    <section className="panel"><div className="panel-head"><div><h2>事件目录</h2><span>用于目标选择和背景抽样</span></div><div className="search"><Search size={15} /><input aria-label="搜索事件" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索名称、类别或摘要" /></div></div><div className="library-grid">{rows.map(event => <article key={event.id}><span className="eyebrow">{event.id} / {event.category}</span><h3>{event.name}</h3><p>{event.summary}</p><small>{event.posts.toLocaleString()} 条示例帖子</small><button className="secondary" onClick={() => openTab('event', event.id, event.name)}>打开事件详情</button></article>)}</div></section></>;
}
function EventPage({ event, openTab }) {
  if (!event) return <div className="empty">事件不存在。</div>;
  return <><section className="object-header"><div><span className="eyebrow">{event.id} / {event.category}</span><h1>{event.name}</h1><p>{event.summary}</p></div><button className="primary" onClick={() => openTab('create', event.id, '新建实验')}><Plus size={16} />以此为目标创建实验</button></section><div className="event-detail-grid"><section className="panel padded"><h2>事件资料</h2><div className="snapshot"><div><span>事件编号</span><b>{event.id}</b></div><div><span>类别</span><b>{event.category}</b></div><div><span>帖子记录</span><b>{event.posts.toLocaleString()} 条</b></div><div><span>数据状态</span><b>示例目录，真实数据待接入</b></div></div></section><section className="panel padded"><h2>传播趋势预览</h2><div className="event-placeholder"><Network size={36} /><p>真实事件曲线接入后在此显示。</p></div></section></div></>;
}

function ValidationCenter({ store, openTab }) {
  const completed = store.experiments.filter(e => e.status === 'completed');
  return <><PageHeader type="validation" /><section className="panel"><div className="panel-head"><div><h2>可验证实验</h2><span>仅包含已完成运行</span></div></div><div className="validation-cards">{completed.length ? completed.map(exp => <article key={exp.id}><div><span className="eyebrow">{exp.code}</span><h3>{exp.name}</h3><p>{exp.targetIds.length} 个目标事件 · {exp.totalSteps} 个时间步</p></div><button className="secondary" onClick={() => openTab('experiment', exp.id, exp.name)}>打开验证结果</button></article>) : <div className="empty">暂无已完成实验。</div>}</div></section></>;
}

function ExperimentPage({ experiment, updateExperiment, duplicateExperiment }) {
  const [section, setSection] = useState('summary');
  if (!experiment) return <div className="empty">实验不存在。</div>;
  const canQueue = ['draft', 'stopped'].includes(experiment.status);
  const targetNames = experiment.targetIds.map(id => EVENTS.find(e => e.id === id)?.name).filter(Boolean);
  return <><section className="object-header"><div><div className="object-meta"><span className="mono">{experiment.code}</span><Badge status={experiment.status} /></div><h1>{experiment.name}</h1><p>{targetNames.join('、')} · {experiment.background} 个背景事件</p></div><div className="controls">{canQueue && <button className="primary" onClick={() => updateExperiment(experiment.id, 'queue')}><Play size={15} />提交运行</button>}<button className="secondary" onClick={() => duplicateExperiment(experiment)}><Copy size={14} />复制实验</button></div></section>
    <div className="tabs section-tabs">{[['summary', '实验概览'], ['config', '配置快照'], ['logs', '运行记录'], ['result', '验证结果']].map(([id, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{label}</button>)}</div>
    {section === 'summary' && <div className="experiment-summary"><section className="panel padded"><h2>实验定义</h2><div className="snapshot">{Object.entries({目标事件: targetNames.join('、'),背景事件: experiment.background,智能体规模: experiment.agents.toLocaleString(),时间步: `${experiment.stepMinutes} 分钟`,浏览容量: `${experiment.browse} 条`,调度方式: experiment.schedule}).map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div></section><section className="panel"><div className="panel-head"><h2>目标事件图谱预览</h2><span>演示数据</span></div><NetworkMap /></section></div>}
    {section === 'config' && <section className="panel padded"><h2>不可变配置快照</h2><p className="muted">运行时使用该实验版本的参数；后续编辑将通过复制实验生成新版本。</p><pre className="config-code">{JSON.stringify({ ...experiment, logs: undefined }, null, 2)}</pre></section>}
    {section === 'logs' && <section className="panel"><div className="panel-head"><h2>运行记录</h2><span>{experiment.logs.length} 条</span></div><div className="log-list">{[...experiment.logs].reverse().map((item, i) => <div key={i}><time>{item.time}</time><span>{item.message}</span></div>)}</div></section>}
    {section === 'result' && (experiment.status === 'completed' ? <><p className="sample-label">示例曲线与指标，尚未执行真实验证。</p><ValidationView experiment={{ ...experiment, target: targetNames[0] }} /></> : <div className="empty-state"><BarChart3 size={38} /><h2>运行完成后生成验证结果</h2><p>进程控制请前往“进程管理”页面。</p></div>)}
  </>;
}

function CreateExperimentPage({ initialTarget, onSave }) {
  const [form, setForm] = useState({ ...DEFAULT_FORM, targetIds: [initialTarget || 'EVT-001'] });
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const steps = ['基本参数', '目标事件', '背景环境', '检查与创建'];
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  function validate() {
    if (!form.name.trim()) return '请输入实验名称。';
    if (!form.targetIds.length) return '至少选择一个目标事件。';
    for (const key of ['agents', 'stepMinutes', 'browse', 'duration', 'capacity']) if (!Number.isInteger(form[key]) || form[key] <= 0) return '规模、时间和容量必须为正整数。';
    if (!Number.isInteger(form.background) || form.background < 0) return '背景事件数必须为非负整数。';
    return '';
  }
  function next() { const message = validate(); if (message) { setError(message); return; } setError(''); if (step === 3) onSave({ ...form, name: form.name.trim() }); else setStep(step + 1); }
  return <><PageHeader type="create" />
    <div className="create-layout"><aside className="create-steps"><span className="eyebrow">CREATE EXPERIMENT</span><h2>实验配置</h2>{steps.map((label, i) => <button key={label} className={i === step ? 'active' : i < step ? 'done' : ''} onClick={() => setStep(i)}><span>{i < step ? <Check size={13} /> : i + 1}</span>{label}</button>)}<p>创建完成后保存为草稿。运行任务统一在进程管理中控制。</p></aside>
      <section className="panel create-content"><div className="create-heading"><span>步骤 {step + 1} / 4</span><h2>{steps[step]}</h2></div>
        {step === 0 && <div className="form-grid"><label className="full">实验名称<input autoFocus value={form.name} placeholder="例如：暴雨预警在热点竞争中的传播" onChange={e => update('name', e.target.value)} /></label>{[['agents', '智能体数量'], ['duration', '仿真时长（天）'], ['browse', '每步浏览上限'], ['seed', '随机种子']].map(([key, label]) => <label key={key}>{label}<input type="number" min="1" value={form[key]} onChange={e => update(key, +e.target.value)} /></label>)}<label>时间步<select value={form.stepMinutes} onChange={e => update('stepMinutes', +e.target.value)}>{[15, 30, 60].map(n => <option key={n} value={n}>{n} 分钟</option>)}</select></label></div>}
        {step === 1 && <div className="target-picker">{EVENTS.map(event => <label key={event.id} className={form.targetIds.includes(event.id) ? 'selected' : ''}><input type="checkbox" checked={form.targetIds.includes(event.id)} onChange={e => update('targetIds', e.target.checked ? [...form.targetIds, event.id] : form.targetIds.filter(id => id !== event.id))} /><div><b>{event.name}</b><small>{event.category} · {event.posts.toLocaleString()} 条示例帖子</small></div></label>)}</div>}
        {step === 2 && <div className="form-grid"><label>抽取背景事件数<input type="number" min="0" value={form.background} onChange={e => update('background', +e.target.value)} /></label><label>同时活跃事件上限<input type="number" min="1" value={form.capacity} onChange={e => update('capacity', +e.target.value)} /></label><label className="full">背景调度<select value={form.schedule} onChange={e => update('schedule', e.target.value)}>{['持续随机注入', '按类别分层抽样', '保留真实相对时间'].map(value => <option key={value}>{value}</option>)}</select></label></div>}
        {step === 3 && <div className="review-grid">{Object.entries({实验名称: form.name || '未填写',目标事件: form.targetIds.map(id => EVENTS.find(e => e.id === id)?.name).join('、'),背景事件: form.background,智能体: form.agents.toLocaleString(),时间步: `${form.stepMinutes} 分钟`,浏览容量: `${form.browse} 条`,调度方式: form.schedule,预计步数: Math.ceil(form.duration * 1440 / form.stepMinutes)}).map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="create-actions"><button className="secondary" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}><ArrowLeft size={15} />上一步</button><button className="primary" onClick={next}>{step === 3 ? '创建实验草稿' : '下一步'}{step < 3 && <ChevronRight size={15} />}</button></div>
      </section></div></>;
}

function Badge({ status }) {
  if (status === 'stopped') return <span className="status gray"><i />已停止</span>;
  return <StatusBadge status={status} />;
}
