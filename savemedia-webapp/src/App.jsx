import { useState, useEffect } from 'react'
import './App.css'

// ==============================================================================
// ВАЖЛИВО: Встав сюди своє посилання з Render!
// Воно має бути в лапках. Не забудь https://
// ==============================================================================
const BACKEND_URL = "https://savemedia-server.onrender.com";


function App() {
  const [link, setLink] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Стан для анімації завантаження
  
  // Використовуємо надійний спосіб доступу до Телеграму
  const tg = window.Telegram.WebApp;

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      // Безпечне встановлення кольору
      try {
        if (tg.themeParams && tg.themeParams.bg_color) {
          tg.setHeaderColor(tg.themeParams.bg_color);
        }
      } catch (error) {
        console.log('Could not set header color:', error);
      }
    }
  }, [tg]);

  const handleDownload = async () => {
    // 1. Перевірки
    if (!link) {
      tg.showAlert("Будь ласка, вставте посилання!");
      return;
    }
    // Перевірка, чи ти не забув вставити посилання
    if (!BACKEND_URL || BACKEND_URL.includes("ВСТАВ_СЮДИ")) {
      tg.showAlert("🔴 ПОМИЛКА В КОДІ:\nТи забув вставити посилання на сервер Render у файлі App.jsx!");
      return;
    }

    // Отримуємо ID користувача, щоб знати, куди кидати відео
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) {
       tg.showAlert("Помилка: Не вдалося отримати ваш ID. Відкрийте бот з офіційного клієнта Телеграм.");
       return;
    }

    // 2. Починаємо процес
    setIsLoading(true); // Вмикаємо крутілку на кнопці
    if (tg.MainButton) { tg.MainButton.showProgress(); } // Показуємо прогрес в Телеграмі, якщо доступно

    try {
      // 3. Відправляємо запит на наш сервер Render
      const response = await fetch(`${BACKEND_URL}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Відправляємо посилання і ID юзера
        body: JSON.stringify({ url: link, chatId: userId }),
      });

      const data = await response.json();

      if (data.success) {
        // Якщо все ок, закриваємо вікно, відео вже летить у чат
        tg.close();
      } else {
        // Якщо помилка на сервері
        tg.showAlert(`Помилка від сервера: ${data.message || 'Щось пішло не так'}`);
      }

    } catch (error) {
      console.error(error);
      tg.showAlert("Помилка з'єднання з сервером.\nМожливо, сервер на Render ще спить (почекайте 30 сек) або у вас проблеми з інтернетом.");
    } finally {
      // 4. Завершуємо процес
      setIsLoading(false); // Вимикаємо крутілку
      if (tg.MainButton) { tg.MainButton.hideProgress(); } // Ховаємо прогрес в Телеграмі
    }
  };

  return (
    <>
      <h1>SaveMedia ⬇️</h1>
      <div className="card">
        <p>Вставте посилання на відео (TikTok, Instagram)</p>
        
        <input 
          type="text" 
          placeholder="Встав сюди посилання..." 
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={isLoading} // Блокуємо інпут під час завантаження
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