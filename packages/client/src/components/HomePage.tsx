import { useState, useEffect } from 'react';
import { MoreVertical, ChevronDown, Trash2, Copy, Edit3, LogOut, ArrowUp, Plus } from 'lucide-react';
import { Project } from '../types';
import * as ProjectService from '../services/projectService';
import { LoginModal } from './LoginModal';
import { Logo } from './Logo';
import { logout as authLogout, getUser } from '../services/auth';

interface User {
  id: string;
  nickname: string;
  avatar: string;
}

interface HomePageProps {
  onOpenProject?: (project: Project) => void;
  onCreateProject?: () => void;
  onLogout?: () => void;
  user?: {
    id: string;
    nickname: string;
    avatar?: string;
  } | null;
}

const typingPhrases = [
  '一只在月球上弹吉他的猫',
  '赛博朋克风格的东京街头',
  '水彩风格的春日樱花',
  '像素风的复古游戏场景',
  '梵高风格的星空下的咖啡馆',
  '穿着宇航服的柴犬在火星散步',
  '蒸汽朋克机械蝴蝶',
  '吉卜力风格的夏日乡村',
  '霓虹灯下的雨夜便利店',
  '漂浮在云端的水晶城堡',
  '古风少女在竹林中抚琴',
  '极简主义的日式枯山水',
  '超现实主义的融化时钟',
  '可爱的机器人在花园浇水',
  '北欧风格的温馨小木屋',
];

export function HomePage({ onLogout, user: propUser }: HomePageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [user, setUser] = useState<User | null>(propUser as User | null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 同步来自 props 的用户状态
  useEffect(() => {
    if (propUser) {
      setUser(propUser as User);
    }
  }, [propUser]);
  const [promptInput, setPromptInput] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Typing animation state
  const [displayText, setDisplayText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Typing animation effect
  useEffect(() => {
    const currentPhrase = typingPhrases[phraseIndex];
    const typingSpeed = isDeleting ? 30 : 80;
    const pauseTime = 2000;

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (displayText.length < currentPhrase.length) {
          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), pauseTime);
        }
      } else {
        // Deleting
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % typingPhrases.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, phraseIndex]);

  useEffect(() => {
    setProjects(ProjectService.getProjects());
    // 检查本地存储的用户（优先使用 auth 服务）
    const authUser = getUser();
    if (authUser) {
      setUser(authUser as User);
    } else {
      // 回退到旧的 user key
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (_e) {
          localStorage.removeItem('user');
        }
      }
    }
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    authLogout(); // 清理 token 和用户信息
    setUser(null);
    setShowUserMenu(false);
    if (onLogout) {
      onLogout(); // 通知父组件
    }
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

  const handleToggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProjects(newSelected);
    if (newSelected.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projects.map(p => p.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedProjects.size === 0) return;
    if (confirm(`确定要删除选中的 ${selectedProjects.size} 个项目吗？`)) {
      selectedProjects.forEach(id => {
        ProjectService.deleteProject(id);
      });
      setProjects(ProjectService.getProjects());
      setSelectedProjects(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleCancelSelection = () => {
    setSelectedProjects(new Set());
    setIsSelectionMode(false);
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

      {/* Hero Section - Clean Professional Style */}
      <div className="relative pt-16 pb-12 px-6 bg-[#f5f5f5]">
        {/* Main Content */}
        <div className="relative max-w-3xl mx-auto">
          {/* Main Title */}
          <div
            className="text-center mb-8"
            style={{ animation: 'fadeInUp 0.5s ease-out' }}
          >
            <p className="text-sm text-[#94a3b8] tracking-[0.2em] uppercase mb-4">AI-Powered Creative Studio</p>
            <h1 className="text-3xl md:text-4xl lg:text-[44px] font-light text-gray-900 leading-[1.35] tracking-tight">
              从<span className="font-medium">构思</span>到<span className="font-medium">成稿</span>
              <br />
              <span className="font-normal">创作只需一步</span>
            </h1>
          </div>

          {/* Chat Input Box - White Card Style */}
          <div
            className="relative"
            style={{ animation: 'fadeInUp 0.5s ease-out 0.1s both' }}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-4">
              <div className="relative">
                {/* Typing placeholder */}
                {!promptInput && (
                  <div className="absolute inset-0 pointer-events-none text-gray-400 text-base leading-relaxed">
                    {displayText}
                    <span className="inline-block w-[2px] h-[18px] bg-gray-300 ml-0.5 animate-pulse align-middle" />
                  </div>
                )}
                <textarea
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handlePromptSubmit();
                    }
                  }}
                  placeholder=""
                  className="w-full bg-transparent text-gray-900 text-base resize-none outline-none min-h-[28px] max-h-[200px] leading-relaxed relative z-10"
                  rows={1}
                  style={{
                    height: 'auto',
                    overflow: 'hidden'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                  }}
                />
              </div>

              {/* Bottom Bar */}
              <div className="flex items-center justify-end mt-4 pt-2">
                <button
                  onClick={() => handlePromptSubmit()}
                  disabled={!promptInput.trim()}
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                    promptInput.trim()
                      ? 'bg-gray-900 text-white hover:bg-gray-700 cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowUp size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions - Clean Pill Style */}
          <div
            className="flex flex-wrap items-center justify-center gap-2 mt-6"
            style={{ animation: 'fadeInUp 0.5s ease-out 0.2s both' }}
          >
            <button
              onClick={() => handlePromptSubmit('一只可爱的柴犬在樱花树下')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500">
                <path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.813 1.912a2 2 0 00-1.272 1.272L12 21l-1.912-5.813a2 2 0 00-1.272-1.272L3 12l5.813-1.912a2 2 0 001.272-1.272L12 3z" />
              </svg>
              AI 生图
            </button>
            <button
              onClick={() => handleCreateProject()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              图片编辑
            </button>
            <button
              onClick={() => handleCreateProject()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-500">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="9" rx="1" />
                <rect x="3" y="15" width="7" height="6" rx="1" />
                <rect x="14" y="15" width="7" height="6" rx="1" />
              </svg>
              分镜脚本
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
        `}</style>
      </div>

      {/* Projects Section Header */}
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium text-gray-900">我的项目</h2>
          {!isSelectionMode ? (
            <>
              <button
                onClick={handleCreateProject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Plus size={16} />
                <span>新建</span>
              </button>
              {projects.length > 0 && (
                <button
                  onClick={() => setIsSelectionMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  批量管理
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {selectedProjects.size === projects.length ? '取消全选' : '全选'}
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={selectedProjects.size === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  selectedProjects.size > 0
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <Trash2 size={16} />
                删除 {selectedProjects.size > 0 && `(${selectedProjects.size})`}
              </button>
              <button
                onClick={handleCancelSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          )}
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
                  onClick={() => isSelectionMode ? handleToggleSelect({} as React.MouseEvent, project.id) : handleOpenProject(project)}
                  className={`group relative bg-white border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    selectedProjects.has(project.id)
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-gray-100 hover:border-gray-300'
                  } ${activeMenu === project.id ? 'z-30' : ''}`}
                >
                  {/* Selection Checkbox */}
                  {isSelectionMode && (
                    <div
                      className="absolute top-3 left-3 z-20"
                      onClick={(e) => handleToggleSelect(e, project.id)}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedProjects.has(project.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-gray-300 hover:border-gray-400'
                      }`}>
                        {selectedProjects.has(project.id) && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  )}

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
