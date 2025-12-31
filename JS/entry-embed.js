import cookie from './cookie';

// Удобно!
window.cookie = cookie;

// Метрика
import './metrics/track';

// Переключатор темы
import './core/theme';

if (window.devicePixelRatio)
	cookie.set("dpr", window.devicePixelRatio);
