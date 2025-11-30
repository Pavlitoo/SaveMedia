import { useState, useEffect } from 'react'
import './App.css'

// ==============================================================================
// ВАЖЛИВО: Встав сюди своє посилання з Render!
// Воно має бути в лапках. Не забудь https://
// ==============================================================================
const BACKEND_URL = "https://savemedia-server.onrender.com";


function App() {
  const [link, setLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (tg) {
      tg.ready?.();
      tg.expand?.();
      try {
        if (tg.themeParams?.bg_color) {
          tg.setHeaderColor?.(tg.themeParams.bg_color);
        }
      } catch (error) {
        console.log('Could not set header color:', error);
      }
    }
  }, [tg]);

  const handleDownload = async () => {
    if (!link) {
      tg?.showAlert?.("Будь ласка, вставте посилання!");
      return;
    }

    if (!BACKEND_URL || BACKEND_URL.includes("ВСТАВ_СЮДИ")) {
      tg?.showAlert?.("ПОМИЛКА В КОДІ:\nТи забув вставити посилання на сервер!");
      return;
    }

    const userId = tg?.initDataUnsafe?.user?.id;
    if (!userId) {
      tg?.showAlert?.("Помилка: Не вдалося отримати ваш ID. Відкрийте бот з офіційного клієнта Телеграм.");
      return;
    }

    setIsLoading(true);
    tg?.MainButton?.showProgress?.();

    try {
      const response = await fetch(`${BACKEND_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link, chatId: userId }),
      });

      const data = await response.json();

      if (data.success) {
        tg?.close?.();
      } else {
        tg?.showAlert?.(`Помилка: ${data.message || 'Щось пішло не так'}`);
      }
    } catch (error) {
      console.error(error);
      tg?.showAlert?.("Помилка з'єднання з сервером.");
    } finally {
      setIsLoading(false);
      tg?.MainButton?.hideProgress?.();
    }
  };

  return (
    <>
      <h1>SaveMedia ⬇️</h1>
      <div className="card">
        <p>Вставте посилання на відео</p>

        <div className="platforms">
          <span>✅ TikTok</span>
          <span>✅ YouTube</span>
          <span>✅ Instagram</span>
          <span>✅ Twitter/X</span>
          <span>✅ Facebook</span>
          <span>✅ та інші...</span>
        </div>

        <input
          type="text"
          placeholder="Встав сюди посилання..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={isLoading}
        />

        <button onClick={handleDownload} disabled={isLoading} style={{opacity: isLoading ? 0.7 : 1}}>
          {isLoading ? 'Зачекайте...' : 'Скачати'}
        </button>
      </div>
      <p style={{fontSize: '12px', opacity: 0.6, marginTop: '20px'}}>
        Працює через офіційний Telegram Web App
      </p>
    </>
  )
}

export default App