import 'Files/VideoJs.css';
import videojs from 'video.js';
import videojs_ru from 'video.js/dist/lang/ru.json';

import { findSelectedSource } from './plugins/utils';
import { videojsEnableSyncSetSource } from './plugins/patchSyncSetSource';
import { videojsPatchSeekBar } from './plugins/patchSeekBar';
import './plugins/controlBarSpacer';
import './plugins/qualitySelector';
import './plugins/heatmap';
import './plugins/resizeMonitor';
import './plugins/smartAltTab';
import './plugins/seekingStatus';
import "./plugins/dummyDuration";
import './plugins/betterAutoplay';
import './plugins/hideOnBlur';
import './plugins/fullscreenOnRotate';
import './plugins/tapToRewind';
import './plugins/storyboard';
import './plugins/videoTitle';
import './plugins/fastShowOnHover';

// Патчим videojs
videojsEnableSyncSetSource(videojs);
videojsPatchSeekBar(videojs);

// Хук для выбора источника по-умолчанию
videojs.hook('beforesetup', (video, options) => {
	if (options.altSources)
		options.sources = [findSelectedSource(options.altSources)];
	return options;
});

// Добавляем русскую локализацию
videojs.addLanguage('ru', videojs_ru);

export default videojs;
