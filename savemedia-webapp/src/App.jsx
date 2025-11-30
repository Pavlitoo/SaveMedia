import { useState, useEffect } from 'react'
import './App.css'
// Імпортуємо SDK Телеграму
import WebApp from '@twa-dev/sdk'

function App() {
  // Створюємо змінну для зберігання посилання
  const [link, setLink] = useState('');

  // Цей код спрацює один раз при запуску додатка
  useEffect(() => {
    // Повідомляємо Телеграму, що додаток готовий
    if (WebApp && typeof WebApp.ready === 'function') {
      try {
        WebApp.ready();
      } catch (e) {
        console.warn('WebApp.ready() failed:', e);
      }
    }

    // Просимо Телеграм розтягнути вікно на весь екран
    if (WebApp && typeof WebApp.expand === 'function') {
      try {
        WebApp.expand();
      } catch (e) {
        console.warn('WebApp.expand() failed:', e);
      }
    }
    
    // Встановлюємо колір хедера під колір фону (щоб було красиво)
    const bgColor = WebApp && WebApp.themeParams && WebApp.themeParams.bg_color
      ? WebApp.themeParams.bg_color
      : '#212121';
    if (WebApp && typeof WebApp.setHeaderColor === 'function') {
      try {
        WebApp.setHeaderColor(bgColor);
      } catch (e) {
        console.warn('WebApp.setHeaderColor() failed:', e);
      }
    }
  }, []);

  const handleDownload = () => {
    // Якщо посилання порожнє - нічого не робимо
    if (!link) {
      WebApp.showAlert("Будь ласка, вставте посилання!");
      return;
    }
    // Поки що просто покажемо алерт, щоб перевірити кнопку
    WebApp.showAlert(`Спробуємо скачати: ${link}\n(Поки що це тільки тест інтерфейсу)`);
  };

  return (
    <>
      <h1>SaveMedia ⬇️</h1>
      <div className="card">
        <p>Вставте посилання на відео (TikTok, Instagram, YouTube)</p>
        
        <input 
          type="text" 
          placeholder="https://..." 
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />

        <button onClick={handleDownload}>
          Скачати
        </button>
      </div>
      <p style={{fontSize: '12px', opacity: 0.6, marginTop: '20px'}}>
        Працює через офіційний Telegram Web App
      </p>
    </>
  )
}

export default App