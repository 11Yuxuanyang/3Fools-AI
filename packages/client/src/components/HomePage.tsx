import React, { useState, useEffect } from 'react';
import { Plus, MoreVertical, ChevronDown, Trash2, Copy, Edit3 } from 'lucide-react';
import { Project } from '../types';
import * as ProjectService from '../services/projectService';

interface HomePageProps {
  onOpenProject?: (project: Project) => void;
  onCreateProject?: () => void;
}

export function HomePage(_props: HomePageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    setProjects(ProjectService.getProjects());
  }, []);

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
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <MoreVertical size={20} className="text-gray-600" />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-white font-medium text-sm ring-2 ring-green-200">
            Y
          </div>
        </div>
      </header>

      {/* Hero Section with Gradient */}
      <div className="relative pt-16 pb-12 px-6 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-purple-300/60 rounded-full blur-[100px]" />
          <div className="absolute top-10 right-1/4 w-[500px] h-[350px] bg-pink-300/40 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/3 w-[400px] h-[300px] bg-blue-300/50 rounded-full blur-[100px]" />
        </div>

        <div className="relative text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-light text-gray-900 mb-4">
            用 AI 画出你的想法
          </h1>
          <p className="text-xl text-gray-500 font-light">
            输入描述，一键生成图片，自由编辑
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <button
          onClick={handleCreateProject}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>新建项目</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-gray-700">{sortBy === 'recent' ? '最近' : '名称'}</span>
            <ChevronDown size={18} className="text-gray-500" />
          </button>

          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => { setSortBy('recent'); setShowSortMenu(false); }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${sortBy === 'recent' ? 'text-violet-600 bg-violet-50' : 'text-gray-700'}`}
                >
                  最近
                </button>
                <button
                  onClick={() => { setSortBy('name'); setShowSortMenu(false); }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${sortBy === 'name' ? 'text-violet-600 bg-violet-50' : 'text-gray-700'}`}
                >
                  名称
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
    </div>
  );
}
