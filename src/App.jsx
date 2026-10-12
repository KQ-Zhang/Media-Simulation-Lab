import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Archive, BarChart3, BookOpen, Box, Check, ChevronDown,
  ChevronLeft, ChevronRight, CirclePause, CirclePlay, Clock3, Database,
  Download, FlaskConical, Gauge, Layers3, MoreHorizontal, Network,
  Pause, Play, Plus, Radio, Search, Settings2, SlidersHorizontal, Sparkles,
  Square, Users, X, Zap,
} from 'lucide-react';

const initialExperiments = [
  { id: 'EXP-024', name: '暴雨预警 · 多事件竞争', status: 'running', progress: 64, step: 431, totalSteps: 672, target: '华北极端降雨预警', targets: 2, background: 200, agents: 10000, updated: '刚刚', score: 88.7, eta: '约 41 分钟', queue: 0 },
  { id: 'EXP-023', name: '公共交通事件 · 基线组', status: 'paused', progress: 38, step: 256, totalSteps: 672, target: '公交司机应急处置', targets: 1, background: 160, agents: 8000, updated: '12 分钟前', score: null, eta: '暂停中', queue: 0 },
  { id: 'EXP-022', name: '公益争议 · 推荐权重实验', status: 'queued', progress: 0, step: 0, totalSteps: 336, target: '公益项目舆情争议', targets: 3, background: 200, agents: 12000, updated: '18 分钟前', score: null, eta: '队列第 1 位', queue: 1 },
  { id: 'EXP-021', name: 'AI 摄影作品争议 · 回放', status: 'completed', progress: 100, step: 672, totalSteps: 672, target: '摄影比赛 AI 作品争议', targets: 1, background: 200, agents: 10000, updated: '昨天 18:42', score: 91.2, eta: '已完成', queue: 0 },
  { id: 'EXP-020', name: '校园事件 · 参数校准', status: 'draft', progress: 0, step: 0, totalSteps: 672, target: '高校公开课事件', targets: 2, background: 120, agents: 6000, updated: '昨天 15:07', score: null, eta: '尚未提交', queue: 0 },
];

const nav = [
  ['overview', '实验总览', FlaskConical],
  ['library', '事件库', Database],
  ['population', '人群与网络', Users],
  ['validation', '验证中心', BarChart3],
];

const statusMeta = {
  running: ['运行中', 'green'], paused: ['已暂停', 'amber'], queued: ['排队中', 'blue'],
  completed: ['已完成', 'ink'], draft: ['草稿', 'gray'], failed: ['失败', 'red'],
};

function StatusBadge({ status }) {
  const [label, tone] = statusMeta[status] || statusMeta.draft;
  return <span className={`status ${tone}`}><i />{label}</span>;
}

function MiniBars() {
  return <div className="mini-bars" aria-label="最近运行负载">
    {[31,45,28,64,52,82,72,88,61,77,69,91,78,84,63,70,59,75,68,80].map((h, i) => <span key={i} style={{height: `${h}%`}} />)}
  </div>;
}

function StatCard({ label, value, detail, icon: Icon, accent }) {
  return <div className="stat-card">
    <div className={`stat-icon ${accent}`}><Icon size={18}/></div>
    <div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div>
  </div>;
}

function Sidebar({ page, setPage }) {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><Radio size={18}/></span><div><b>涟漪实验室</b><small>CASCADE LAB</small></div></div>
    <div className="workspace"><span>当前工作区</span><button>传播研究组 <ChevronDown size={14}/></button></div>
    <nav>
      <p>工作台</p>
      {nav.map(([id,label,Icon]) => <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={18}/><span>{label}</span></button>)}
      <p>管理</p>
      <button><BookOpen size={18}/><span>实验模板</span></button>
      <button><Archive size={18}/><span>归档</span></button>
    </nav>
    <div className="sidebar-bottom">
      <div className="capacity"><div><span>运行槽位</span><b>2 / 3</b></div><div className="capacity-track"><i /></div><small>1 个实验正在等待</small></div>
      <button className="user"><span>KQ</span><div><b>研究员</b><small>本地工作区</small></div><Settings2 size={17}/></button>
    </div>
  </aside>;
}

function ProcessCenter({ experiments, onOpen, onAction }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const rows = experiments.filter(e => (filter==='all'||e.status===filter) && `${e.name}${e.id}${e.target}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <section className="hero-row">
      <div><span className="eyebrow">SIMULATION CONTROL</span><h1>实验总览</h1><p>创建、排队和监控多个传播仿真实验。</p></div>
      <button className="primary" onClick={()=>onAction('create')}><Plus size={17}/>新建实验</button>
    </section>
    <section className="stats-grid">
      <StatCard label="运行中" value={experiments.filter(e=>e.status==='running').length} detail="共 3 个计算槽位" icon={Activity} accent="mint"/>
      <StatCard label="等待队列" value={experiments.filter(e=>e.status==='queued').length} detail="预计 41 分钟后启动" icon={Clock3} accent="blue"/>
      <StatCard label="累计实验" value="24" detail="本月新增 11 个" icon={Layers3} accent="violet"/>
      <StatCard label="事件库" value="2,814" detail="200 个可用作背景" icon={Database} accent="sand"/>
    </section>
    <section className="system-strip">
      <div className="system-title"><span className="pulse"/><div><b>本地推理服务正常</b><small>决策接口已预留 · 具体策略待配置</small></div></div>
      <div className="load"><MiniBars/><div><b>68%</b><small>任务负载</small></div></div>
      <div className="throughput"><b>1,248</b><small>决策 / 分钟</small></div>
      <button className="ghost">查看系统状态 <ChevronRight size={15}/></button>
    </section>
    <section className="panel experiments-panel">
      <div className="panel-head"><div><h2>我的实验</h2><span>{experiments.length} 个实验</span></div><div className="filters">
        <div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索实验或目标事件"/></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部状态</option><option value="running">运行中</option><option value="queued">排队中</option><option value="paused">已暂停</option><option value="completed">已完成</option><option value="draft">草稿</option></select>
      </div></div>
      <div className="table-wrap"><table><thead><tr><th>实验</th><th>状态</th><th>运行进度</th><th>规模</th><th>最近更新</th><th></th></tr></thead><tbody>
        {rows.map(e=><tr key={e.id} onClick={()=>onOpen(e.id)}>
          <td><div className="exp-name"><span className={`exp-symbol ${e.status}`}><Network size={17}/></span><div><b>{e.name}</b><small>{e.id} · 目标：{e.target}</small></div></div></td>
          <td><StatusBadge status={e.status}/></td>
          <td><div className="progress-cell"><div><span>{e.status==='draft'?'未配置完成':`第 ${e.step} / ${e.totalSteps} 步`}</span><b>{e.progress}%</b></div><div className="progress"><i style={{width:`${e.progress}%`}} /></div><small>{e.eta}</small></div></td>
          <td><b className="size-label">{e.agents.toLocaleString()} 智能体</b><small>{e.targets} 个目标 · {e.background} 个背景</small></td>
          <td><span className="muted">{e.updated}</span></td>
          <td><div className="row-actions" onClick={ev=>ev.stopPropagation()}>{e.status==='running'&&<button title="暂停" onClick={()=>onAction('pause',e.id)}><Pause size={16}/></button>}{e.status==='paused'&&<button title="继续" onClick={()=>onAction('resume',e.id)}><Play size={16}/></button>}<button><MoreHorizontal size={18}/></button></div></td>
        </tr>)}
      </tbody></table></div>
    </section>
  </>;
}

function CreateExperiment({ onClose, onCreate }) {
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({name:'新传播竞争实验',targets:2,background:200,agents:10000,stepMinutes:30,browse:8,duration:14});
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));
  const steps=['基本信息','目标事件','背景环境','人群与网络','信息流规则','模型接口','验证设置'];
  return <div className="modal-backdrop"><div className="wizard">
    <button className="modal-close" onClick={onClose}><X size={20}/></button>
    <div className="wizard-side"><div className="brand inverse"><span className="brand-mark"><Radio size={18}/></span><div><b>创建实验</b><small>NEW SIMULATION</small></div></div><div className="step-list">{steps.map((s,i)=><button key={s} className={step===i+1?'current':step>i+1?'done':''} onClick={()=>setStep(i+1)}><span>{step>i+1?<Check size={14}/>:i+1}</span>{s}</button>)}</div><div className="wizard-tip"><Sparkles size={17}/><p>模型接口和 Agent 画像暂时只保存配置，后续可独立完善。</p></div></div>
    <div className="wizard-main"><div className="wizard-title"><span>步骤 {step} / {steps.length}</span><h2>{steps[step-1]}</h2><p>{step===1?'定义实验时间、容量与基础规模。':step===2?'选择本次实验真正关注和验证的事件。':step===3?'构造持续变化的互联网背景信息环境。':'设置本步骤的实验参数；详细策略稍后可以继续扩展。'}</p></div>
      {step===1&&<div className="form-grid"><label className="full">实验名称<input value={form.name} onChange={e=>upd('name',e.target.value)}/></label><label>时间步<select value={form.stepMinutes} onChange={e=>upd('stepMinutes',+e.target.value)}><option value="15">15 分钟</option><option value="30">30 分钟</option><option value="60">60 分钟</option></select></label><label>仿真时长<div className="input-suffix"><input type="number" value={form.duration} onChange={e=>upd('duration',+e.target.value)}/><span>天</span></div></label><label>智能体数量<input type="number" value={form.agents} onChange={e=>upd('agents',+e.target.value)}/></label><label>每步浏览上限<div className="input-suffix"><input type="number" value={form.browse} onChange={e=>upd('browse',+e.target.value)}/><span>条</span></div></label></div>}
      {step===2&&<EventPicker form={form} upd={upd} target/>}
      {step===3&&<EventPicker form={form} upd={upd}/>} 
      {step>3&&<PlaceholderConfig step={step}/>} 
      <div className="estimate"><Gauge size={19}/><div><b>预计 {Math.ceil(form.duration*24*60/form.stepMinutes)} 个时间步</b><span>{form.agents.toLocaleString()} 个智能体 · 每步最多 {form.browse} 条信息 · {form.background} 个背景事件</span></div></div>
      <div className="wizard-actions"><button className="secondary" onClick={()=>step===1?onClose():setStep(step-1)}><ChevronLeft size={16}/>{step===1?'取消':'上一步'}</button>{step<steps.length?<button className="primary" onClick={()=>setStep(step+1)}>下一步<ChevronRight size={16}/></button>:<button className="primary" onClick={()=>onCreate(form)}><Check size={16}/>创建为草稿</button>}</div>
    </div>
  </div></div>;
}

function EventPicker({form,upd,target=false}){
  return <div className="config-stack">
    <div className="choice-card selected"><div className="choice-icon"><Database size={19}/></div><div><b>{target?'从已提取事件中选择':'从背景事件库随机抽取'}</b><p>{target?'关联真实传播曲线，用于后续验证。':'按类别、热度与生命周期分层采样。'}</p></div><Check size={18}/></div>
    <div className="form-grid"><label>{target?'目标事件数量':'背景事件数量'}<input type="number" value={target?form.targets:form.background} onChange={e=>upd(target?'targets':'background',+e.target.value)}/></label><label>{target?'注入方式':'抽样方式'}<select><option>{target?'按实验时间注入':'按真实类别比例'}</option><option>{target?'保留真实相对时间':'完全随机'}</option></select></label></div>
    <div className="event-preview"><div><span className="dot coral"/><b>{target?'华北极端降雨预警':'社会公共事件'}</b><small>{target?'真实帖子 2,431 条':'占背景事件 36%'}</small></div><div><span className="dot blue"/><b>{target?'相关应急响应事件':'文娱与体育事件'}</b><small>{target?'真实帖子 806 条':'占背景事件 28%'}</small></div><button><Plus size={15}/>{target?'选择事件':'查看抽样预览'}</button></div>
  </div>
}

function PlaceholderConfig({step}){
 const data={4:['人群规模与网络','账号画像分布将从真实数据统计中采样。'],5:['候选召回与排序','配置关注流、推荐流、热榜和随机探索比例。'],6:['本地模型服务','保存服务地址、模型名称和并发参数，调用逻辑稍后接入。'],7:['真实趋势验证','选择对齐窗口、时间桶和主要评价指标。']}[step];
 return <div className="placeholder-config"><div className="placeholder-art"><SlidersHorizontal size={32}/></div><h3>{data[0]}</h3><p>{data[1]}</p><div className="config-lines"><i/><i/><i/></div></div>
}

const nodes = [
  [48,51,'target',16],[31,34,'target',10],[67,32,'exposed',11],[76,54,'other',9],[59,71,'target',12],[36,72,'exposed',8],[17,53,'idle',7],[85,29,'idle',6],[48,20,'other',7],[22,19,'idle',6],[83,76,'target',8],[70,84,'idle',6],[15,82,'other',6]
];
const links=[[0,1],[0,2],[0,3],[0,4],[0,5],[1,6],[1,8],[1,9],[2,3],[2,7],[4,5],[4,10],[4,11],[5,12],[3,10],[10,11]];

function NetworkMap(){return <div className="network-map"><svg viewBox="0 0 100 100" role="img" aria-label="目标事件传播网络示意图"><defs><filter id="glow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>{links.map(([a,b],i)=><line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} className={nodes[a][2]==='target'&&nodes[b][2]==='target'?'hot':''}/>)}{nodes.map(([x,y,t,r],i)=><g key={i}><circle cx={x} cy={y} r={r/10+1.4} className={`node ${t}`} filter={t==='target'?'url(#glow)':''}/>{t==='target'&&<circle cx={x} cy={y} r={r/10+3} className="node-ring"/>}</g>)}</svg><div className="map-legend"><span><i className="target"/>已传播</span><span><i className="exposed"/>已曝光</span><span><i className="other"/>其他事件</span><span><i className="idle"/>未触达</span></div></div>}

function TrendChart(){return <svg className="trend-chart" viewBox="0 0 620 190" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ea654f" stopOpacity=".24"/><stop offset="1" stopColor="#ea654f" stopOpacity="0"/></linearGradient></defs>{[30,70,110,150].map(y=><line key={y} x1="35" y1={y} x2="610" y2={y} className="gridline"/>)}<path className="range" d="M35 155 C110 152 120 136 180 125 S275 80 335 75 S410 56 475 45 S550 35 610 30 L610 62 C550 66 500 73 470 80 S370 105 330 110 S240 143 180 150 S80 165 35 165Z"/><path className="real-line" d="M35 158 C100 155 135 145 182 127 S250 100 300 80 S370 65 420 50 S520 34 610 27"/><path className="sim-line" d="M35 160 C110 158 140 148 185 133 S250 105 305 91 S370 75 425 62 S520 47 610 39"/><line x1="334" y1="23" x2="334" y2="165" className="peak"/><text x="341" y="35">峰值</text></svg>}

function ExperimentDetail({experiment,onBack,onAction}){
 const [tab,setTab]=useState('live');
 return <>
  <section className="detail-top"><button className="back" onClick={onBack}><ChevronLeft size={18}/></button><div className="detail-heading"><div><span className="mono">{experiment.id}</span><StatusBadge status={experiment.status}/></div><h1>{experiment.name}</h1></div><div className="detail-actions">{experiment.status==='running'?<button className="secondary" onClick={()=>onAction('pause',experiment.id)}><CirclePause size={17}/>暂停</button>:<button className="secondary" onClick={()=>onAction('resume',experiment.id)}><CirclePlay size={17}/>继续</button>}<button className="danger"><Square size={14}/>停止</button><button className="ghost"><MoreHorizontal size={18}/></button></div></section>
  <div className="tabs"><button className={tab==='live'?'active':''} onClick={()=>setTab('live')}>运行监控</button><button className={tab==='target'?'active':''} onClick={()=>setTab('target')}>目标事件</button><button className={tab==='decisions'?'active':''} onClick={()=>setTab('decisions')}>决策抽查</button><button className={tab==='validation'?'active':''} onClick={()=>setTab('validation')}>真实对比</button><button>配置快照</button><button>运行日志</button></div>
  {tab==='live'&&<LiveConsole experiment={experiment}/>} {tab==='target'&&<TargetEventView experiment={experiment}/>} {tab==='decisions'&&<DecisionInspector/>} {tab==='validation'&&<ValidationView experiment={experiment}/>} 
 </>
}

function LiveConsole({experiment}){return <div className="detail-grid">
  <section className="panel phase-panel"><div className="panel-head"><div><h2>当前时间步</h2><span>虚拟时间 · 第 9 天 23:30</span></div><b className="big-step">{experiment.step}<small> / {experiment.totalSteps}</small></b></div><div className="phases">{['更新事件','生成候选','信息流排序','模型决策','提交行为'].map((x,i)=><div className={i<3?'done':i===3?'doing':''} key={x}><span>{i<3?<Check size={14}/>:i+1}</span><b>{x}</b><small>{i<3?'完成':i===3?'6,482 / 8,104':'等待'}</small></div>)}</div><div className="request-progress"><div><span>本步决策进度</span><b>80%</b></div><div className="progress tall"><i style={{width:'80%'}}/></div><small>成功 6,439 · 重试 31 · 失败 12 · 平均 4.2 秒</small></div></section>
  <section className="panel live-target"><div className="panel-head"><div><h2>目标事件实时状态</h2><span>按传播人数排序</span></div><button className="ghost">查看全部</button></div><div className="target-row"><span className="rank">01</span><div><b>{experiment.target}</b><small>注入于第 12 步 · 当前增长期</small></div><div className="metric"><b>3,821</b><small>已曝光</small></div><div className="metric"><b>426</b><small>传播者</small></div><span className="up">↗ 18%</span></div><div className="target-row"><span className="rank">02</span><div><b>相关应急响应事件</b><small>注入于第 48 步 · 当前衰退期</small></div><div className="metric"><b>1,205</b><small>已曝光</small></div><div className="metric"><b>73</b><small>传播者</small></div><span className="flat">→ 2%</span></div></section>
  <section className="panel map-panel"><div className="panel-head"><div><h2>传播网络</h2><span>节点按当前主导事件着色</span></div><select><option>目标事件热力</option><option>全部事件</option><option>社区聚合</option></select></div><NetworkMap/></section>
  <section className="panel environment"><div className="panel-head"><div><h2>背景环境</h2><span>当前活跃 31 / 200 个事件</span></div></div><div className="heat-list">{[['大型赛事决赛结果',92,'体育'],['知名演员新作发布',86,'文娱'],[experiment.target,81,'目标'],['消费电子新品发布',73,'科技'],['城市公共服务调整',61,'社会']].map(([n,v,t])=><div key={n}><span>{t}</span><div><b>{n}</b><i><em style={{width:`${v}%`}}/></i></div><strong>{v}</strong></div>)}</div><div className="environment-foot"><div><Zap size={17}/><span>本步新增事件</span><b>4</b></div><div><Activity size={17}/><span>目标事件推荐份额</span><b>12.8%</b></div></div></section>
 </div>}

function TargetEventView({experiment}){return <div className="target-view"><section className="event-hero"><div><span className="target-label">TARGET EVENT 01</span><h2>{experiment.target}</h2><p>研究目标：观察突发公共事件在复杂背景信息流中的跨社区传播。</p></div><div className="event-actions"><button className="secondary"><Play size={16}/>播放扩散</button><button className="primary"><Download size={16}/>导出事件</button></div></section><div className="event-kpis">{[['进入候选池','18,420次'],['实际曝光','3,821人'],['参与互动','712人'],['传播账号','426人'],['文本变体','138条'],['跨社区传播','26次']].map(([a,b])=><div key={a}><span>{a}</span><b>{b}</b></div>)}</div><div className="target-layout"><section className="panel target-map"><div className="panel-head"><div><h2>事件扩散图</h2><span>第 {experiment.step} 步节点状态</span></div><select><option>传播状态</option><option>社区</option><option>账号类型</option></select></div><NetworkMap/><div className="timeline"><button><Play size={14}/></button><span>第 1 步</span><input type="range" min="1" max={experiment.totalSteps} defaultValue={experiment.step}/><span>第 {experiment.totalSteps} 步</span></div></section><section className="panel milestones"><div className="panel-head"><h2>关键节点</h2></div>{[['第12步','事件注入','3 个种子帖子进入平台'],['第47步','首次跨社区','普通用户 A-0281 触达社区 C3'],['第126步','进入热榜','推荐曝光占比升至 9.4%'],['第318步','传播峰值','单步新增 74 个传播账号']].map((x,i)=><div className="milestone" key={x[0]}><span>{i+1}</span><div><small>{x[0]}</small><b>{x[1]}</b><p>{x[2]}</p></div></div>)}</section></div></div>}

function DecisionInspector(){return <section className="panel inspector"><div className="panel-head"><div><h2>智能体决策抽查</h2><span>检查模型输入、结构化输出和最终提交动作</span></div><button className="secondary">随机抽取 10 条</button></div><div className="inspector-grid"><div className="agent-card"><span className="avatar">A8</span><h3>Agent-00821</h3><p>普通用户 · 抖音 · 社会/教育兴趣</p><dl><div><dt>粉丝层级</dt><dd>1万–10万</dd></div><div><dt>活跃度</dt><dd>0.63</dd></div><div><dt>转发倾向</dt><dd>0.28</dd></div><div><dt>本步浏览</dt><dd>8 条</dd></div></dl></div><div className="feed-stack"><h3>本步信息流</h3>{[1,2,3,4].map((i)=><div className={i===1?'chosen':''} key={i}><span>{i}</span><div><b>{i===1?'目标事件 · 华北极端降雨预警':['体育赛事赛果','本地生活资讯','科技产品发布'][i-2]}</b><small>推荐分 {(0.91-i*.07).toFixed(2)} · {i===1?'媒体账号':'普通账号'}</small></div><em>{i===1?'改写转发':'忽略'}</em></div>)}</div><div className="decision-card"><span className="decision-label">模型结构化输出</span><h3>改写后转发</h3><p>原因代码</p><div className="chips"><span>topic_interest</span><span>trusted_source</span><span>high_relevance</span></div><p>生成文本</p><blockquote>强降雨仍在持续，出行前请留意最新预警和道路信息。</blockquote><div className="confidence"><span>决策置信度</span><b>0.74</b></div><button className="ghost">查看完整 JSON</button></div></div></section>}

function ValidationView({experiment}){return <div className="validation-layout"><section className="panel validation-main"><div className="panel-head"><div><h2>真实传播与仿真结果</h2><span>{experiment.target} · 30 分钟时间桶</span></div><select><option>累计独立账号</option><option>新增账号</option><option>帖子数量</option></select></div><div className="chart-wrap"><TrendChart/><div className="chart-legend"><span className="real">真实记录</span><span className="sim">仿真中位数</span><span className="band">10%–90% 区间</span></div></div></section><section className="panel score-panel"><span>综合拟合得分</span><div className="score-ring"><b>{experiment.score||88.7}</b><small>/ 100</small></div><p>当前模型较好地复现了事件规模与增长阶段，峰值时间略有滞后。</p></section><section className="panel metrics-table"><div className="panel-head"><h2>差异指标</h2></div>{[['T50 误差','+1.3 h','轻微滞后'],['峰值误差','−7.2%','低于真实'],['账号规模误差','5.8%','良好'],['曲线距离','0.14','良好'],['重复发帖率','+2.1 pp','接近真实']].map(([a,b,c])=><div key={a}><span>{a}</span><b>{b}</b><em>{c}</em></div>)}</section><section className="panel diagnosis"><div className="panel-head"><h2>环境影响诊断</h2></div><div className="diagnosis-item"><span><Zap size={17}/></span><div><b>背景突发事件分流注意力</b><p>真实峰值附近，体育事件占据了 22% 的推荐位置，目标事件到峰时间因此延后。</p></div></div><div className="diagnosis-item"><span><Network size={17}/></span><div><b>跨社区扩散偏弱</b><p>模拟网络中的桥接节点数量可能偏低，建议下一轮提高跨社区连边率。</p></div></div></section></div>}

function PlaceholderPage({page}){const config={library:['事件库','管理目标候选事件与可随机抽取的背景事件。',Database],population:['人群与网络','管理真实数据校准的人群模板与合成网络。',Users],validation:['验证中心','跨实验比较目标事件的真实与仿真传播趋势。',BarChart3]}[page];const Icon=config[2];return <div className="placeholder-page"><Icon size={34}/><span className="eyebrow">MODULE PREVIEW</span><h1>{config[0]}</h1><p>{config[1]}</p><button className="primary">进入配置</button></div>}

export { Sidebar, ProcessCenter, CreateExperiment, NetworkMap, ValidationView, DecisionInspector, StatusBadge };

export function LegacyApp(){
 const [page,setPage]=useState('overview'); const [experiments,setExperiments]=useState(initialExperiments); const [selected,setSelected]=useState(null); const [creating,setCreating]=useState(false);
 useEffect(()=>{const id=setInterval(()=>setExperiments(xs=>xs.map(e=>e.status==='running'&&e.progress<99?{...e,progress:Math.min(99,e.progress+.1),step:Math.min(e.totalSteps,e.step+1),updated:'刚刚'}:e)),5000);return()=>clearInterval(id)},[]);
 const current=useMemo(()=>experiments.find(e=>e.id===selected),[experiments,selected]);
 function action(type,id){if(type==='create'){setCreating(true);return} setExperiments(xs=>xs.map(e=>e.id===id?{...e,status:type==='pause'?'paused':'running',eta:type==='pause'?'暂停中':'约 41 分钟'}:e));}
 function create(form){const id=`EXP-${String(25+experiments.length).padStart(3,'0')}`;setExperiments(xs=>[{id,name:form.name,status:'draft',progress:0,step:0,totalSteps:Math.ceil(form.duration*24*60/form.stepMinutes),target:'待选择目标事件',targets:form.targets,background:form.background,agents:form.agents,updated:'刚刚',score:null,eta:'尚未提交'},...xs]);setCreating(false)}
 return <div className="app"><Sidebar page={page} setPage={p=>{setPage(p);setSelected(null)}}/><main>{page==='overview'?(current?<ExperimentDetail experiment={current} onBack={()=>setSelected(null)} onAction={action}/>:<ProcessCenter experiments={experiments} onOpen={setSelected} onAction={action}/>):<PlaceholderPage page={page}/>}</main>{creating&&<CreateExperiment onClose={()=>setCreating(false)} onCreate={create}/>}</div>
}
