import React, { createContext, useContext, useState } from 'react'

export const LIGHT = {
  bg:         '#f1f5f9',
  card:       '#ffffff',
  border:     '#e2e8f0',
  text:       '#1e2a45',
  textMuted:  '#64748b',
  primary:    '#0047b3',
  primaryBg:  '#e8f0fd',
  inputBg:    '#ffffff',
  inputBorder:'#d1d5db',
  tabBar:     '#ffffff',
  tabBorder:  '#e2e8f0',
  headerBg:   '#ffffff',
  shadow:     '#00000018',
  danger:     '#dc2626',
  dangerBg:   '#fee2e2',
  success:    '#16a34a',
  successBg:  '#dcfce7',
  warning:    '#d97706',
  warningBg:  '#fef3c7',
  info:       '#0047b3',
  infoBg:     '#dbeafe',
  purple:     '#9333ea',
  purpleBg:   '#f3e8ff',
  cyan:       '#0891b2',
  cyanBg:     '#cffafe',
  overlay:    'rgba(0,0,0,0.5)',
  chatMine:   '#0047b3',
  chatOther:  '#ffffff',
  chatMineTxt:'#ffffff',
  chatOtherTxt:'#1e2a45',
  sidebarBg:  '#f8fafc',
  sidebarActive:'#e8f0fd',
  sidebarActiveTxt:'#0047b3',
  badgeGray:  '#f1f5f9',
  badgeGrayTxt:'#64748b',
}

export const DARK = {
  bg:         '#0f172a',
  card:       '#1e293b',
  border:     '#334155',
  text:       '#e2e8f0',
  textMuted:  '#94a3b8',
  primary:    '#3b82f6',
  primaryBg:  '#1e3a5f',
  inputBg:    '#1e293b',
  inputBorder:'#334155',
  tabBar:     '#1e293b',
  tabBorder:  '#334155',
  headerBg:   '#1e293b',
  shadow:     '#00000040',
  danger:     '#f87171',
  dangerBg:   '#450a0a',
  success:    '#4ade80',
  successBg:  '#052e16',
  warning:    '#fbbf24',
  warningBg:  '#451a03',
  info:       '#60a5fa',
  infoBg:     '#1e3a5f',
  purple:     '#c084fc',
  purpleBg:   '#2e1065',
  cyan:       '#22d3ee',
  cyanBg:     '#083344',
  overlay:    'rgba(0,0,0,0.7)',
  chatMine:   '#1d4ed8',
  chatOther:  '#1e293b',
  chatMineTxt:'#ffffff',
  chatOtherTxt:'#e2e8f0',
  sidebarBg:  '#0f172a',
  sidebarActive:'#1e3a5f',
  sidebarActiveTxt:'#60a5fa',
  badgeGray:  '#334155',
  badgeGrayTxt:'#94a3b8',
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false)
  const colors = isDark ? DARK : LIGHT
  const toggleTheme = () => setIsDark(prev => !prev)

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
