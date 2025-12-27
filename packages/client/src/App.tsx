import React, { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage';
import { CanvasEditor } from './components/CanvasEditor';
import { LoginModal } from './components/LoginModal';
import { Project } from './types';
import * as ProjectService from './services/projectService';
import { isLoggedIn, getUser, logout, User } from './services/auth';

export default function App() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [route, setRoute] = useState<string>(window.location.hash.slice(1));
  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = () => {
      if (isLoggedIn()) {
        const savedUser = getUser();
        setUser(savedUser);
      } else {
        setUser(null);
        setShowLoginModal(true);
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  // 登录成功回调
  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setShowLoginModal(false);
  };

  // 退出登录
  const handleLogout = () => {
    logout();
    setUser(null);
    setShowLoginModal(true);
    window.location.hash = '';
  };

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

  // 等待认证检查完成
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  // 未登录显示登录弹窗
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">三傻大闹AI圈</h1>
          <p className="text-gray-300 mb-8">请登录后使用</p>
        </div>
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(true)}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  // 渲染编辑器页面
  if (route.startsWith('/project/') && currentProject) {
    return (
      <CanvasEditor
        key={currentProject.id}
        project={currentProject}
        onBack={handleBack}
        onLogout={handleLogout}
        user={user}
      />
    );
  }

  // 渲染首页 - HomePage 内部处理导航
  return <HomePage onOpenProject={() => {}} onCreateProject={() => {}} onLogout={handleLogout} user={user} />;
}
