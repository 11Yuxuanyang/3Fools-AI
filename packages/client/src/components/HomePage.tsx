import React, { useState, useEffect } from 'react';
import { MoreVertical, ChevronDown, Trash2, Copy, Edit3, LogOut, ArrowUp, Sparkles, Palette, Wand2, Plus } from 'lucide-react';
import { Project } from '../types';
import * as ProjectService from '../services/projectService';
import { LoginModal } from './LoginModal';
import { Logo } from './Logo';

interface User {
  id: string;
  nickname: string;
  avatar: string;
}

interface HomePageProps {
  onOpenProject?: (project: Project) => void;
  onCreateProject?: () => void;
}

export function HomePage(_props: HomePageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [promptInput, setPromptInput] = useState('');

  useEffect(() => {
    setProjects(ProjectService.getProjects());
    // 检查本地存储的用户
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setShowUserMenu(false);
  };

  const handleOpenProject = (project: Project) => {
    window.open(`#/project/${project.id}`, '_blank');
  };

  const handleCreateProject = () => {
    const newProject = ProjectService.createProject();
    window.open(`#/project/${newProject.id}`, '_blank');
  };

  const handlePromptSubmit = (prompt?: string) => {
    const inputPrompt = prompt || promptInput.trim();
    if (!inputPrompt) {
      handleCreateProject();
      return;
    }
    const newProject = ProjectService.createProject();
    // 将 prompt 存储到 localStorage（因为新窗口无法访问 sessionStorage）
    localStorage.setItem('pendingPrompt', JSON.stringify({
      projectId: newProject.id,
      prompt: inputPrompt,
    }));
    window.open(`#/project/${newProject.id}`, '_blank');
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个项目吗？')) {
      ProjectService.deleteProject(id);
      setProjects(ProjectService.getProjects());
    }
    setActiveMenu(null);
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    ProjectService.duplicateProject(id);
    setProjects(ProjectService.getProjects());
    setActiveMenu(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getProjectPreview = (project: Project) => {
    const image = project.items.find(item => item.type === 'image');
    return image?.src || project.thumbnail;
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === 'recent') {
      return b.updatedAt - a.updatedAt;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 border border-gray-300 rounded-full uppercase tracking-wide">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.nickname}
                    className="w-9 h-9 rounded-full ring-2 ring-gray-200"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-violet-500 flex items-center justify-center text-white font-medium text-sm ring-2 ring-violet-200">
                    {user.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.nickname}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut size={16} />
                      退出登录
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                登录
              </button>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
              >
                注册
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section - Pixel Style */}
      <div className="relative pt-16 pb-12 px-6 bg-white overflow-hidden">
        {/* Pixel Decorations */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Pixel blocks - left side */}
          <div className="absolute top-20 left-[10%] flex gap-1" style={{ animation: 'fadeIn 1s ease-out 0.3s both' }}>
            <div className="w-3 h-3 bg-[#FF6B6B]" />
            <div className="w-3 h-3 bg-[#4ECDC4]" />
          </div>
          <div className="absolute top-32 left-[8%]" style={{ animation: 'fadeIn 1s ease-out 0.5s both' }}>
            <div className="w-2 h-2 bg-[#FFE66D]" />
          </div>

          {/* Pixel blocks - right side */}
          <div className="absolute top-24 right-[12%] flex flex-col gap-1" style={{ animation: 'fadeIn 1s ease-out 0.4s both' }}>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-[#95E1D3]" />
              <div className="w-2 h-2 bg-[#95E1D3]" />
            </div>
            <div className="w-2 h-2 bg-[#95E1D3] ml-1" />
          </div>
          <div className="absolute top-40 right-[8%] flex gap-1" style={{ animation: 'fadeIn 1s ease-out 0.6s both' }}>
            <div className="w-3 h-3 bg-[#DDA0DD]" />
          </div>

          {/* Pixel cursor icon - left */}
          <div className="absolute bottom-32 left-[15%] opacity-40" style={{ animation: 'float 3s ease-in-out infinite' }}>
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
              <path d="M2 2h2v2H2V2zm2 2h2v2H4V4zm2 2h2v2H6V6zm2 2h2v2H8V8zm2 2h2v2h-2v-2zm-2 2h2v2H8v-2zm-2-2h2v2H6v-2z" fill="#4ECDC4"/>
            </svg>
          </div>

          {/* Pixel star - right */}
          <div className="absolute bottom-40 right-[18%] opacity-50" style={{ animation: 'pulse 2s ease-in-out infinite' }}>
            <svg width="20" height="20" viewBox="0 0 8 8" fill="none">
              <path d="M3 0h2v2h2v2h-2v2H3V4H1V2h2V0z" fill="#FFE66D"/>
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative max-w-3xl mx-auto">
          {/* Main Title - Pixel Style */}
          <div
            className="text-center mb-10"
            style={{ animation: 'fadeInUp 0.6s ease-out' }}
          >
            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                textShadow: '3px 3px 0 #e5e5e5',
                letterSpacing: '2px'
              }}
            >
              每个脑洞
              <br />
              <span className="text-[#4ECDC4]">都值得</span>被画出来
            </h1>

            <p className="text-base text-gray-500 max-w-xl mx-auto mt-6" style={{ fontFamily: 'monospace' }}>
              [ AI 生图 ] + [ 智能编辑 ] + [ 分镜创作 ]
            </p>
          </div>

          {/* Chat Input Box - Pixel Style */}
          <div
            className="relative"
            style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}
          >
            <div
              className="bg-white p-4 border-4 border-gray-900"
              style={{
                boxShadow: '6px 6px 0 #e5e5e5',
              }}
            >
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePromptSubmit();
                  }
                }}
                placeholder="► 描述你想要的画面..."
                className="w-full bg-transparent text-gray-900 placeholder-gray-400 text-base resize-none outline-none min-h-[80px] max-h-[200px]"
                style={{ fontFamily: 'monospace' }}
                rows={2}
              />

              {/* Submit Button - Pixel Style */}
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => handlePromptSubmit()}
                  disabled={!promptInput.trim()}
                  className={`px-4 py-2 border-3 font-bold text-sm transition-all ${
                    promptInput.trim()
                      ? 'bg-[#4ECDC4] border-gray-900 text-gray-900 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none cursor-pointer'
                      : 'bg-gray-200 border-gray-400 text-gray-400 cursor-not-allowed'
                  }`}
                  style={{
                    boxShadow: promptInput.trim() ? '4px 4px 0 #1a1a1a' : 'none',
                    fontFamily: 'monospace'
                  }}
                >
                  生成 ▶
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Chips - Pixel Style */}
          <div
            className="flex flex-wrap items-center justify-center gap-3 mt-8"
            style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}
          >
            <button
              onClick={() => handlePromptSubmit('一只可爱的柴犬在樱花树下')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF6B6B] text-white border-2 border-gray-900 text-sm font-bold hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              style={{ boxShadow: '3px 3px 0 #1a1a1a', fontFamily: 'monospace' }}
            >
              ✦ AI 生图
            </button>
            <button
              onClick={() => handleCreateProject()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFE66D] text-gray-900 border-2 border-gray-900 text-sm font-bold hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              style={{ boxShadow: '3px 3px 0 #1a1a1a', fontFamily: 'monospace' }}
            >
              ✎ 图片编辑
            </button>
            <button
              onClick={() => handleCreateProject()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#DDA0DD] text-white border-2 border-gray-900 text-sm font-bold hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              style={{ boxShadow: '3px 3px 0 #1a1a1a', fontFamily: 'monospace' }}
            >
              ▤ 分镜脚本
            </button>
          </div>
        </div>

        {/* CSS Animations */}
        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.1); }
          }
        `}</style>
      </div>

      {/* Projects Section Header */}
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium text-gray-900">我的项目</h2>
          <button
            onClick={handleCreateProject}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span>新建</span>
          </button>
        </div>

        <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>{sortBy === 'recent' ? '最近编辑' : '按名称'}</span>
              <ChevronDown size={16} />
            </button>

            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                  <button
                    onClick={() => { setSortBy('recent'); setShowSortMenu(false); }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${sortBy === 'recent' ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
                  >
                    最近编辑
                  </button>
                  <button
                    onClick={() => { setSortBy('name'); setShowSortMenu(false); }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${sortBy === 'name' ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
                  >
                    按名称
                  </button>
                </div>
              </>
            )}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {sortedProjects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Plus size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">还没有项目</h3>
            <p className="text-gray-500 mb-6">点击上方按钮创建你的第一个项目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedProjects.map((project) => {
              const preview = getProjectPreview(project);

              return (
                <div
                  key={project.id}
                  onClick={() => handleOpenProject(project)}
                  className={`group relative bg-white border-2 border-gray-100 hover:border-gray-300 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${activeMenu === project.id ? 'z-30' : ''}`}
                >
                  {/* Card Preview */}
                  <div className="aspect-[4/3] relative bg-gray-50 overflow-hidden rounded-t-xl">
                    {/* Dot Grid Pattern */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                      }}
                    />

                    {/* Preview Image */}
                    {preview && (
                      <img
                        src={preview}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain p-4"
                      />
                    )}

                    {/* Canvas Icon for empty projects */}
                    {!preview && project.items.length > 0 && (
                      <div className="absolute top-4 left-4 w-8 h-8 bg-white/80 rounded shadow-sm flex items-center justify-center">
                        <div className="w-4 h-4 border border-gray-300 rounded-sm" />
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatDate(project.updatedAt)}
                      </p>
                    </div>

                    {/* Menu Button */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === project.id ? null : project.id);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical size={18} className="text-gray-500" />
                      </button>

                      {activeMenu === project.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }} />
                          <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                            <button
                              onClick={(e) => handleDuplicate(e, project.id)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Copy size={16} />
                              复制
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newName = prompt('输入新名称:', project.name);
                                if (newName) {
                                  ProjectService.updateProjectName(project.id, newName);
                                  setProjects(ProjectService.getProjects());
                                }
                                setActiveMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit3 size={16} />
                              重命名
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={(e) => handleDelete(e, project.id)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 size={16} />
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
