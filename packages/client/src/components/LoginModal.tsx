import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, ArrowLeft, Smartphone } from 'lucide-react';
import { saveAuth } from '../services/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

interface User {
  id: string;
  nickname: string;
  avatar: string;
}

type AuthMode = 'login' | 'register';
type AuthMethod = 'select' | 'phone' | 'wechat';
type LoginStatus = 'idle' | 'loading' | 'pending' | 'scanned' | 'confirmed' | 'error' | 'expired';

export function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [method, setMethod] = useState<AuthMethod>('select');
  const [status, setStatus] = useState<LoginStatus>('idle');

  // 微信相关状态
  const [qrcodeUrl, setQrcodeUrl] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [configured, setConfigured] = useState<boolean>(true);

  // 手机号相关状态
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [phoneError, setPhoneError] = useState('');

  const [error, setError] = useState<string>('');

  // 重置状态
  const resetState = useCallback(() => {
    setMethod('select');
    setStatus('idle');
    setQrcodeUrl('');
    setState('');
    setError('');
    setPhone('');
    setCode('');
    setPhoneError('');
  }, []);

  // 验证手机号格式
  const isValidPhone = (phone: string) => {
    return /^1[3-9]\d{9}$/.test(phone);
  };

  // 发送验证码
  const handleSendCode = async () => {
    if (!isValidPhone(phone)) {
      setPhoneError('请输入正确的手机号');
      return;
    }

    setPhoneError('');
    setStatus('loading');

    try {
      const res = await fetch('/api/auth/phone/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (data.success) {
        setCountdown(60);
        setStatus('idle');
      } else {
        setPhoneError(data.error || '发送失败，请重试');
        setStatus('error');
      }
    } catch (_e) {
      setPhoneError('网络错误，请重试');
      setStatus('error');
    }
  };

  // 手机号登录/注册
  const handlePhoneSubmit = async () => {
    if (!isValidPhone(phone)) {
      setPhoneError('请输入正确的手机号');
      return;
    }
    if (code.length !== 6) {
      setPhoneError('请输入6位验证码');
      return;
    }

    setPhoneError('');
    setStatus('loading');

    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, mode }),
      });
      const data = await res.json();

      if (data.success && data.data.user) {
        setStatus('confirmed');
        // 保存 token 和用户信息
        if (data.data.token) {
          saveAuth(data.data.token, data.data.user);
        }
        localStorage.setItem('user', JSON.stringify(data.data.user));

        setTimeout(() => {
          onLoginSuccess(data.data.user);
          onClose();
          resetState();
        }, 1000);
      } else {
        setPhoneError(data.error || '验证失败');
        setStatus('error');
      }
    } catch (_e) {
      setPhoneError('网络错误，请重试');
      setStatus('error');
    }
  };

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 获取微信二维码
  const fetchWechatQrcode = useCallback(async () => {
    setStatus('loading');
    setError('');

    try {
      const res = await fetch('/api/auth/wechat/qrcode');
      const data = await res.json();

      if (data.success) {
        setQrcodeUrl(data.data.qrcodeUrl);
        setState(data.data.state);
        setConfigured(data.data.configured);
        setStatus('pending');
      } else {
        setError(data.error || '获取二维码失败');
        setStatus('error');
      }
    } catch (_e) {
      setError('网络错误，请重试');
      setStatus('error');
    }
  }, []);

  // 选择手机登录
  const handleSelectPhone = () => {
    setMethod('phone');
    setStatus('idle');
  };

  // 选择微信登录
  const handleSelectWechat = () => {
    setMethod('wechat');
    fetchWechatQrcode();
  };

  // 返回选择页
  const handleBack = () => {
    setMethod('select');
    setStatus('idle');
    setPhoneError('');
  };

  // 切换登录/注册模式
  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    resetState();
  };

  // 轮询检查微信登录状态
  useEffect(() => {
    if (!isOpen || method !== 'wechat' || !state || status === 'confirmed' || status === 'error' || status === 'expired') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/wechat/status/${state}`);
        const data = await res.json();

        if (!data.success) {
          setStatus('expired');
          setError(data.error || '登录已过期');
          clearInterval(pollInterval);
          return;
        }

        const newStatus = data.data.status;

        if (newStatus === 'confirmed' && data.data.user) {
          setStatus('confirmed');
          clearInterval(pollInterval);

          localStorage.setItem('user', JSON.stringify(data.data.user));

          setTimeout(() => {
            onLoginSuccess(data.data.user);
            onClose();
            resetState();
          }, 1500);
        } else if (newStatus === 'scanned') {
          setStatus('scanned');
        }
      } catch (e) {
        console.error('轮询登录状态失败:', e);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isOpen, method, state, status, onLoginSuccess, onClose, resetState]);

  // 关闭时重置状态
  useEffect(() => {
    if (!isOpen) {
      resetState();
      setMode('login');
    }
  }, [isOpen, resetState]);

  // 处理 URL 回调
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginResult = urlParams.get('login');
    const callbackState = urlParams.get('state');

    if (loginResult === 'success' && callbackState) {
      window.history.replaceState({}, '', window.location.pathname);
      setMethod('wechat');
      setState(callbackState);
      setStatus('pending');
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <X size={20} />
        </button>

        {/* 返回按钮 */}
        {method !== 'select' && (
          <button
            onClick={handleBack}
            className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors z-10"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="p-8">
          {method === 'select' ? (
            // 登录方式选择页
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {mode === 'login' ? '登录' : '注册'}
                </h2>
                <p className="text-gray-500">
                  {mode === 'login' ? '选择登录方式继续' : '选择注册方式创建账号'}
                </p>
              </div>

              <div className="space-y-3">
                {/* 手机号登录/注册 */}
                <button
                  onClick={handleSelectPhone}
                  className="w-full flex items-center gap-4 p-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <Smartphone size={22} />
                  </div>
                  <span className="font-medium">手机号{mode === 'login' ? '登录' : '注册'}</span>
                </button>

                {/* 微信登录/注册 */}
                <button
                  onClick={handleSelectWechat}
                  className="w-full flex items-center gap-4 p-4 bg-[#07C160] hover:bg-[#06AE56] text-white rounded-xl transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.007-.27-.018-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                    </svg>
                  </div>
                  <span className="font-medium">微信{mode === 'login' ? '登录' : '注册'}</span>
                </button>
              </div>

              {/* 切换登录/注册 */}
              <p className="text-center text-sm text-gray-500 mt-6">
                {mode === 'login' ? '还没有账号？' : '已有账号？'}
                <button
                  onClick={toggleMode}
                  className="text-gray-900 font-medium hover:underline ml-1"
                >
                  {mode === 'login' ? '立即注册' : '立即登录'}
                </button>
              </p>
            </>
          ) : method === 'phone' ? (
            // 手机号登录/注册页
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  手机号{mode === 'login' ? '登录' : '注册'}
                </h2>
                <p className="text-sm text-gray-500">
                  {mode === 'login' ? '输入手机号和验证码登录' : '输入手机号完成注册'}
                </p>
              </div>

              <div className="space-y-4">
                {/* 手机号输入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    手机号
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-gray-100 rounded-lg text-gray-500 text-sm">
                      +86
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="请输入手机号"
                      className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                </div>

                {/* 验证码输入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    验证码
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="请输入验证码"
                      className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                    <button
                      onClick={handleSendCode}
                      disabled={countdown > 0 || !isValidPhone(phone) || status === 'loading'}
                      className={`px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        countdown > 0 || !isValidPhone(phone) || status === 'loading'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </button>
                  </div>
                </div>

                {/* 错误提示 */}
                {phoneError && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {phoneError}
                  </p>
                )}

                {/* 提交按钮 */}
                <button
                  onClick={handlePhoneSubmit}
                  disabled={!isValidPhone(phone) || code.length !== 6 || status === 'loading'}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    !isValidPhone(phone) || code.length !== 6 || status === 'loading'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {status === 'loading' ? '处理中...' : status === 'confirmed' ? '成功！' : mode === 'login' ? '登录' : '注册'}
                </button>

                {/* 协议提示 */}
                <p className="text-xs text-gray-400 text-center">
                  {mode === 'register' && '注册即表示同意'}
                  {mode === 'login' && '登录即表示同意'}
                  <span className="text-gray-600 hover:underline cursor-pointer">用户协议</span>
                  {' 和 '}
                  <span className="text-gray-600 hover:underline cursor-pointer">隐私政策</span>
                </p>
              </div>
            </>
          ) : (
            // 微信扫码登录页
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  微信扫码{mode === 'login' ? '登录' : '注册'}
                </h2>
                <p className="text-sm text-gray-500">使用微信扫描下方二维码</p>
              </div>

              <div className="flex flex-col items-center">
                {!configured ? (
                  <div className="w-56 h-56 bg-gray-50 rounded-2xl flex flex-col items-center justify-center text-center p-6">
                    <AlertCircle size={40} className="text-amber-500 mb-3" />
                    <p className="text-gray-600 font-medium mb-1 text-sm">微信登录未配置</p>
                    <p className="text-xs text-gray-400">请先配置微信开放平台</p>
                  </div>
                ) : status === 'loading' ? (
                  <div className="w-56 h-56 bg-gray-50 rounded-2xl flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#07C160] border-t-transparent"></div>
                  </div>
                ) : status === 'error' || status === 'expired' ? (
                  <div className="w-56 h-56 bg-gray-50 rounded-2xl flex flex-col items-center justify-center">
                    <AlertCircle size={40} className="text-red-400 mb-3" />
                    <p className="text-gray-600 mb-3 text-sm">{error || '二维码已过期'}</p>
                    <button
                      onClick={fetchWechatQrcode}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#07C160] hover:bg-[#06AE56] text-white rounded-lg transition-colors text-sm"
                    >
                      <RefreshCw size={14} />
                      刷新
                    </button>
                  </div>
                ) : status === 'confirmed' ? (
                  <div className="w-56 h-56 bg-green-50 rounded-2xl flex flex-col items-center justify-center">
                    <CheckCircle size={56} className="text-green-500 mb-3" />
                    <p className="text-green-600 font-medium">{mode === 'login' ? '登录' : '注册'}成功</p>
                  </div>
                ) : (
                  <div className="relative">
                    <iframe
                      src={qrcodeUrl}
                      className="w-56 h-56 border-0 rounded-2xl bg-white"
                      sandbox="allow-scripts allow-same-origin"
                      title="微信登录二维码"
                    />

                    {status === 'scanned' && (
                      <div className="absolute inset-0 bg-white/90 rounded-2xl flex flex-col items-center justify-center">
                        <div className="animate-pulse">
                          <CheckCircle size={40} className="text-green-500 mb-3" />
                        </div>
                        <p className="text-gray-600 font-medium text-sm">扫描成功</p>
                        <p className="text-xs text-gray-400">请在手机上确认</p>
                      </div>
                    )}
                  </div>
                )}

                {status === 'pending' && configured && (
                  <button
                    onClick={fetchWechatQrcode}
                    className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <RefreshCw size={12} />
                    刷新二维码
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
