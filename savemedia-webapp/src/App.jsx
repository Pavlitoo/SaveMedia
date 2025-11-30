import { useState, useEffect } from 'react'
import './App.css'

const BACKEND_URL = "https://savemedia-server.onrender.com";

function App() {
  const [link, setLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('main');

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

  const renderMainSection = () => (
    <div className="section-content animate-in">
      <div className="hero">
        <div className="icon-container">
          <div className="download-icon">⬇</div>
        </div>
        <h1 className="app-title">SaveMedia</h1>
        <p className="subtitle">Універсальний завантажувач відео</p>
      </div>

      <div className="card">
        <div className="platforms-grid">
          <div className="platform-badge">TikTok</div>
          <div className="platform-badge">YouTube</div>
          <div className="platform-badge">Instagram</div>
          <div className="platform-badge">Twitter</div>
          <div className="platform-badge">Facebook</div>
          <div className="platform-badge">Reddit</div>
          <div className="platform-badge">Vimeo</div>
          <div className="platform-badge">+1000</div>
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Вставте посилання на відео..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={isLoading}
            className={isLoading ? 'loading' : ''}
          />
          {link && !isLoading && (
            <button className="clear-btn" onClick={() => setLink('')}>×</button>
          )}
        </div>

        <button
          className={`download-btn ${isLoading ? 'loading' : ''}`}
          onClick={handleDownload}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner"></span>
              <span>Завантаження...</span>
            </>
          ) : (
            <>
              <span>Скачати відео</span>
              <span className="btn-icon">→</span>
            </>
          )}
        </button>

        <div className="features">
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span>Швидко</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🔒</span>
            <span>Безпечно</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🎬</span>
            <span>HD якість</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🚫</span>
            <span>Без watermark</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAboutSection = () => (
    <div className="section-content animate-in">
      <h2 className="section-title">Про SaveMedia</h2>

      <div className="info-card">
        <div className="info-header">
          <span className="info-icon">📱</span>
          <h3>Що це таке?</h3>
        </div>
        <p>
          SaveMedia - це потужний інструмент для завантаження відео з будь-яких соціальних мереж
          та відео-платформ. Працює швидко, безпечно та зручно прямо в Telegram.
        </p>
      </div>

      <div className="info-card">
        <div className="info-header">
          <span className="info-icon">✨</span>
          <h3>Особливості</h3>
        </div>
        <ul className="features-list">
          <li>Підтримка 1000+ платформ</li>
          <li>Завантаження без водяних знаків</li>
          <li>Висока якість відео (до 1080p)</li>
          <li>Швидка обробка (5-30 секунд)</li>
          <li>Повністю безкоштовно</li>
          <li>Без реєстрації та обмежень</li>
        </ul>
      </div>

      <div className="info-card">
        <div className="info-header">
          <span className="info-icon">🔒</span>
          <h3>Безпека та приватність</h3>
        </div>
        <p>
          Ми не зберігаємо ваші відео та посилання. Всі завантаження обробляються
          в реальному часі та відразу видаляються. Ваша приватність - наш пріоритет.
        </p>
      </div>

      <button className="back-btn" onClick={() => setActiveSection('main')}>
        ← Повернутись
      </button>
    </div>
  );

  const renderPlatformsSection = () => (
    <div className="section-content animate-in">
      <h2 className="section-title">Підтримувані платформи</h2>

      <div className="platforms-section">
        <div className="platform-category">
          <h3>✅ Працює ідеально</h3>
          <div className="platform-list">
            <div className="platform-item">TikTok (без watermark)</div>
            <div className="platform-item">Instagram (Reels, Posts, Stories)</div>
            <div className="platform-item">Twitter / X</div>
            <div className="platform-item">Facebook (публічні)</div>
            <div className="platform-item">Reddit</div>
            <div className="platform-item">Vimeo</div>
            <div className="platform-item">Pinterest</div>
            <div className="platform-item">LinkedIn</div>
            <div className="platform-item">Dailymotion</div>
            <div className="platform-item">Twitch Clips</div>
          </div>
        </div>

        <div className="platform-category warning">
          <h3>⚠ YouTube (з обмеженнями)</h3>
          <div className="platform-list">
            <div className="platform-item success">✅ Звичайні відео (2-10 хв)</div>
            <div className="platform-item error">❌ Shorts не підтримуються</div>
            <div className="platform-item error">❌ Відео 18+ не працюють</div>
            <div className="platform-item info">💡 Для Shorts використовуйте TikTok/Instagram</div>
          </div>
        </div>

        <div className="platform-category">
          <h3>🌐 Інші платформи</h3>
          <p className="platform-description">
            Підтримуються понад 1000 різних сайтів та платформ.
            Якщо ви не знайшли потрібну платформу - просто спробуйте вставити посилання!
          </p>
        </div>
      </div>

      <button className="back-btn" onClick={() => setActiveSection('main')}>
        ← Повернутись
      </button>
    </div>
  );

  const renderFAQSection = () => (
    <div className="section-content animate-in">
      <h2 className="section-title">FAQ - Часті питання</h2>

      <div className="faq-list">
        <div className="faq-item">
          <div className="faq-question">🤔 Як скачати відео?</div>
          <div className="faq-answer">
            1. Скопіюйте посилання на відео<br/>
            2. Вставте його у поле вводу<br/>
            3. Натисніть "Скачати відео"<br/>
            4. Зачекайте 5-30 секунд<br/>
            5. Відео автоматично завантажиться в чат
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">💰 Це безкоштовно?</div>
          <div className="faq-answer">
            Так! SaveMedia повністю безкоштовний та не має обмежень на кількість завантажень.
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">📱 Які формати підтримуються?</div>
          <div className="faq-answer">
            Всі відео завантажуються у форматі MP4 - найпопулярнішому форматі,
            який відкривається на будь-яких пристроях.
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">🎬 Яка якість відео?</div>
          <div className="faq-answer">
            Ми завантажуємо відео в найкращій доступній якості (зазвичай 720p-1080p).
            Для деяких платформ може бути обмеження до 720p для швидшого завантаження.
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">⏱ Чому так довго?</div>
          <div className="faq-answer">
            Зазвичай завантаження займає 5-15 секунд. Для довших або HD відео може
            знадобитися до 30 секунд. Це залежить від розміру файлу та швидкості інтернету.
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">❌ Чому не працює?</div>
          <div className="faq-answer">
            Можливі причини:<br/>
            • Приватний акаунт (зробіть публічним)<br/>
            • Відео видалене або недоступне<br/>
            • Невірне посилання<br/>
            • YouTube Shorts (не підтримується)<br/>
            • Відео з віковим обмеженням 18+
          </div>
        </div>

        <div className="faq-item">
          <div className="faq-question">🔒 Чи зберігаються мої дані?</div>
          <div className="faq-answer">
            Ні! Ми не зберігаємо жодної інформації. Всі відео обробляються
            тимчасово та відразу видаляються після відправки вам.
          </div>
        </div>
      </div>

      <button className="back-btn" onClick={() => setActiveSection('main')}>
        ← Повернутись
      </button>
    </div>
  );

  return (
    <div className="app-container">
      {activeSection === 'main' && renderMainSection()}
      {activeSection === 'about' && renderAboutSection()}
      {activeSection === 'platforms' && renderPlatformsSection()}
      {activeSection === 'faq' && renderFAQSection()}

      <nav className="bottom-nav">
        <button
          className={`nav-btn ${activeSection === 'main' ? 'active' : ''}`}
          onClick={() => setActiveSection('main')}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Головна</span>
        </button>
        <button
          className={`nav-btn ${activeSection === 'platforms' ? 'active' : ''}`}
          onClick={() => setActiveSection('platforms')}
        >
          <span className="nav-icon">📱</span>
          <span className="nav-label">Платформи</span>
        </button>
        <button
          className={`nav-btn ${activeSection === 'about' ? 'active' : ''}`}
          onClick={() => setActiveSection('about')}
        >
          <span className="nav-icon">ℹ</span>
          <span className="nav-label">Про додаток</span>
        </button>
        <button
          className={`nav-btn ${activeSection === 'faq' ? 'active' : ''}`}
          onClick={() => setActiveSection('faq')}
        >
          <span className="nav-icon">❓</span>
          <span className="nav-label">FAQ</span>
        </button>
      </nav>
    </div>
  )
}

export default App