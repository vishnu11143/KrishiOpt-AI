import { useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import FarmPlanner from './pages/FarmPlanner'
import CropIntelligence from './pages/CropIntelligence'
import ResourceOptimizer from './pages/ResourceOptimizer'
import WhatIfSimulator from './pages/WhatIfSimulator'
import RiskIntelligence from './pages/RiskIntelligence'
import AgriMap from './pages/AgriMap'
import Analytics from './pages/Analytics'
import Assistant from './pages/Assistant'
import Settings from './pages/Settings'

const NAV_ITEMS = [
  { section: 'Core', items: [
    { path: '/', label: 'Overview', icon: '📊' },
    { path: '/farm-planner', label: 'Farm Planner', icon: '🌾' },
    { path: '/crop-intelligence', label: 'Crop Intelligence', icon: '🌱' },
  ]},
  { section: 'Optimize', items: [
    { path: '/resource-optimizer', label: 'Resource Optimizer', icon: '⚡' },
    { path: '/what-if', label: 'What-If Simulator', icon: '🔄' },
    { path: '/risk', label: 'Risk Intelligence', icon: '🛡️' },
  ]},
  { section: 'Explore', items: [
    { path: '/map', label: 'Agricultural Map', icon: '🗺️' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/assistant', label: 'AI Assistant', icon: '🤖' },
  ]},
  { section: 'System', items: [
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ]},
]

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="app-layout">
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="btn btn-ghost" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
          ☰
        </button>
        <h1>
          <span className="brand-icon" style={{width:24,height:24,background:'var(--accent)',borderRadius:4,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',color:'#fff'}}>K</span>
          KrishiOpt AI
        </h1>
        <div style={{width:36}} />
      </div>

      {/* Mobile overlay */}
      <div className={`mobile-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="sidebar-brand">
          <h1>
            <span className="brand-icon">K</span>
            KrishiOpt AI
          </h1>
          <div className="brand-sub">Agricultural Intelligence</div>
        </div>
        <div className="sidebar-nav">
          {NAV_ITEMS.map(section => (
            <div className="sidebar-section" key={section.section}>
              <div className="sidebar-section-label">{section.section}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/farm-planner" element={<FarmPlanner />} />
          <Route path="/crop-intelligence" element={<CropIntelligence />} />
          <Route path="/resource-optimizer" element={<ResourceOptimizer />} />
          <Route path="/what-if" element={<WhatIfSimulator />} />
          <Route path="/risk" element={<RiskIntelligence />} />
          <Route path="/map" element={<AgriMap />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
