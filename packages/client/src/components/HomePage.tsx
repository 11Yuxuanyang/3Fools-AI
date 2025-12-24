import React, { useState, useEffect } from 'react';
import { Plus, MoreVertical, ChevronDown, Trash2, Copy, Edit3, LogOut } from 'lucide-react';
import { Project } from '../types';
import * as ProjectService from '../services/projectService';
import { LoginModal } from './LoginModal';

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
    window.location.hash = `/project/${project.id}`;
  };

  const handleCreateProject = () => {
    const newProject = ProjectService.createProject();
    window.location.hash = `/project/${newProject.id}`;
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
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold text-gray-900">三傻大闹AI圈</span>
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

      {/* Hero Section - Clean Minimal */}
      <div className="relative pt-24 pb-20 px-6 overflow-hidden bg-[#fafafa]">
        {/* Subtle Grid Background */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #e5e5e5 1px, transparent 1px),
              linear-gradient(to bottom, #e5e5e5 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Center Focal Point - Single Refined Element */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-[500px] h-[500px] border border-gray-200 rounded-full opacity-60"
            style={{ animation: 'scaleIn 1.2s ease-out' }}
          />
        </div>

        {/* Main Content */}
        <div className="relative max-w-3xl mx-auto text-center">
          {/* Main Title */}
          <h1 style={{ animation: 'fadeInUp 0.8s ease-out' }}>
            <span className="block text-5xl md:text-6xl font-semibold text-gray-900 tracking-tight leading-tight">
              用 AI 画出你的想法
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="mt-5 text-lg text-gray-500 font-normal"
            style={{ animation: 'fadeInUp 0.8s ease-out 0.15s both' }}
          >
            输入描述，一键生成图片，自由编辑
          </p>

          {/* CTA Button integrated into hero */}
          <div
            className="mt-10"
            style={{ animation: 'fadeInUp 0.8s ease-out 0.3s both' }}
          >
            <button
              onClick={handleCreateProject}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={20} />
              <span>开始创作</span>
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
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 0.6;
              transform: scale(1);
            }
          }
        `}</style>
      </div>

      {/* Projects Section Header */}
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">我的项目</h2>

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
                  className="group relative bg-white border-2 border-gray-100 hover:border-violet-200 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg"
                >
                  {/* Card Preview */}
                  <div className="aspect-[4/3] relative bg-gray-50 overflow-hidden">
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
                          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }} />
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
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
