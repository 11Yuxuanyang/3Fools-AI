import React, { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage';
import { CanvasEditor } from './components/CanvasEditor';
import { Project } from './types';
import * as ProjectService from './services/projectService';

export default function App() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [route, setRoute] = useState<string>(window.location.hash.slice(1));

  // 解析路由
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // 去掉 #
      setRoute(hash);

      // 如果是项目页面，加载项目
      if (hash.startsWith('/project/')) {
        const projectId = hash.replace('/project/', '');
        const project = ProjectService.getProject(projectId);
        if (project) {
          setCurrentProject(project);
        } else {
          // 项目不存在，回到首页
          window.location.hash = '';
          setCurrentProject(null);
        }
      } else {
        setCurrentProject(null);
      }
    };

    // 初始化
    handleHashChange();

    // 监听路由变化
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 返回首页
  const handleBack = () => {
    window.location.hash = '';
  };

  // 渲染编辑器页面
  if (route.startsWith('/project/') && currentProject) {
    return (
      <CanvasEditor
        key={currentProject.id}
        project={currentProject}
        onBack={handleBack}
      />
    );
  }

  // 渲染首页 - HomePage 内部处理导航
  return <HomePage onOpenProject={() => {}} onCreateProject={() => {}} />;
}
