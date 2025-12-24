import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Layers, Sparkles, ArrowRight } from 'lucide-react';
import { Project } from '../types';
import * as ProjectService from '../services/projectService';

interface HomePageProps {
  onOpenProject?: (project: Project) => void;
  onCreateProject?: () => void;
}

export function HomePage(_props: HomePageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  useEffect(() => {
    setProjects(ProjectService.getProjects());
  }, []);

  const handleOpenProject = (project: Project) => {
    // Direct navigation - no popup blockers
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
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getProjectPreview = (project: Project) => {
    const image = project.items.find(item => item.type === 'image');
    return image?.src || project.thumbnail;
  };

  const getProjectStats = (project: Project) => {
    const images = project.items.filter(i => i.type === 'image').length;
    const shapes = project.items.filter(i => ['rectangle', 'circle', 'line', 'arrow'].includes(i.type)).length;
    const texts = project.items.filter(i => i.type === 'text').length;
    return { images, shapes, texts, total: project.items.length };
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white antialiased">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0b] via-[#0f0f12] to-[#0a0a0b]" />
      <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-amber-500/[0.03] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/[0.02] rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/[0.06] bg-[#0a0a0b]/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-lg font-semibold tracking-tight">
                Canvas<span className="text-amber-400">AI</span>
              </span>
            </div>

            <button
              onClick={handleCreateProject}
              className="group flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium text-sm hover:bg-amber-400 transition-all duration-200 shadow-lg shadow-white/10 hover:shadow-amber-400/20"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>新建项目</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-6 py-12">
          {/* Hero Section - Compact */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span className="text-white/90">创意</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">工作室</span>
            </h1>
            <p className="text-white/40 text-lg max-w-xl">
              AI 驱动的无限画布，释放你的创造力
            </p>
          </div>

          {/* Quick Create Card */}
          {projects.length === 0 && (
            <div
              onClick={handleCreateProject}
              className="group relative mb-12 p-8 rounded-2xl border border-dashed border-white/10 hover:border-amber-400/30 bg-white/[0.02] hover:bg-amber-400/[0.03] cursor-pointer transition-all duration-300"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center group-hover:from-amber-400/30 group-hover:to-orange-500/30 transition-all">
                  <Plus size={28} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-amber-300 transition-colors">
                    创建你的第一个项目
                  </h3>
                  <p className="text-white/40">
                    开始使用 AI 画布，生成图像、添加文字和形状
                  </p>
                </div>
                <ArrowRight size={24} className="text-white/20 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          )}

          {/* Projects Section */}
          {projects.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-white/90">我的项目</h2>
                  <span className="px-2.5 py-1 text-xs font-medium bg-white/[0.06] text-white/50 rounded-full">
                    {projects.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project, index) => {
                  const preview = getProjectPreview(project);
                  const stats = getProjectStats(project);
                  const isHovered = hoveredProject === project.id;

                  return (
                    <div
                      key={project.id}
                      onClick={() => handleOpenProject(project)}
                      onMouseEnter={() => setHoveredProject(project.id)}
                      onMouseLeave={() => setHoveredProject(null)}
                      className="group relative rounded-xl overflow-hidden cursor-pointer bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animation: 'fadeInUp 0.4s ease-out backwards'
                      }}
                    >
                      {/* Preview Area */}
                      <div className="aspect-[4/3] relative bg-[#111114] overflow-hidden">
                        {preview ? (
                          <>
                            <img
                              src={preview}
                              alt=""
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-transparent to-transparent opacity-60" />
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Layers size={32} className="text-white/10 mb-2" />
                            <span className="text-xs text-white/20">空白画布</span>
                          </div>
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          className={`absolute top-3 right-3 p-2 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white/60 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition-all ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        >
                          <Trash2 size={16} />
                        </button>

                        {/* Hover Overlay */}
                        <div className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                          <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium flex items-center gap-2">
                            打开项目
                            <ArrowRight size={14} />
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <h3 className="font-medium text-white/90 mb-2 truncate group-hover:text-amber-300 transition-colors">
                          {project.name}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-white/30">
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} />
                            {formatTime(project.updatedAt)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Layers size={12} />
                            {stats.total} 元素
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* New Project Card */}
                <div
                  onClick={handleCreateProject}
                  className="group rounded-xl overflow-hidden cursor-pointer border-2 border-dashed border-white/[0.08] hover:border-amber-400/30 bg-transparent hover:bg-amber-400/[0.02] transition-all duration-200"
                >
                  <div className="aspect-[4/3] flex flex-col items-center justify-center p-6">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.04] group-hover:bg-amber-400/10 flex items-center justify-center mb-3 transition-colors">
                      <Plus size={24} className="text-white/30 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <span className="text-sm font-medium text-white/40 group-hover:text-amber-300 transition-colors">
                      新建项目
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.04] mt-auto">
          <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-white/20">
            <span>© 2025 CanvasAI Studio</span>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white/40 transition-colors">关于</a>
              <a href="#" className="hover:text-white/40 transition-colors">帮助</a>
            </div>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
