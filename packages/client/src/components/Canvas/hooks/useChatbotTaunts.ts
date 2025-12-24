import { useState, useEffect, useCallback, useRef } from 'react';

const TAUNT_MESSAGES = [
  '写不出来吧？😏',
  '就这？就这？',
  '我都替你尴尬...',
  '要不要我帮你？🙄',
  '又在摸鱼？',
  '灵感枯竭了吗~',
  '我看你很久了👀',
  '点我啊，不敢吗',
  '哎，又发呆...',
  '今天也没产出呢',
  '要不...放弃算了？',
  '我等得花都谢了🌸',
  '你行不行啊',
  '需要我教你吗？',
  '啧啧啧...',
];

export interface UseChatbotTauntsProps {
  isOpen: boolean;
  intervalMs?: number;
}

export function useChatbotTaunts({ isOpen, intervalMs = 15000 }: UseChatbotTauntsProps) {
  const [tauntMessage, setTauntMessage] = useState('');
  const [isWiggling, setIsWiggling] = useState(false);
  const tauntIndexRef = useRef(0);

  const showRandomTaunt = useCallback(() => {
    // Get a random message different from the current one
    let newIndex = Math.floor(Math.random() * TAUNT_MESSAGES.length);
    while (newIndex === tauntIndexRef.current && TAUNT_MESSAGES.length > 1) {
      newIndex = Math.floor(Math.random() * TAUNT_MESSAGES.length);
    }
    tauntIndexRef.current = newIndex;

    setTauntMessage(TAUNT_MESSAGES[newIndex]);
    setIsWiggling(true);

    // Clear message after 3 seconds
    setTimeout(() => setTauntMessage(''), 3000);
    // Stop wiggling after 0.5 seconds
    setTimeout(() => setIsWiggling(false), 500);
  }, []);

  // Show taunts periodically when chat is closed
  useEffect(() => {
    if (isOpen) {
      setTauntMessage('');
      return;
    }

    const interval = setInterval(() => {
      // 30% chance to show taunt
      if (Math.random() < 0.3) {
        showRandomTaunt();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isOpen, intervalMs, showRandomTaunt]);

  return {
    tauntMessage,
    isWiggling,
    showRandomTaunt,
  };
}
