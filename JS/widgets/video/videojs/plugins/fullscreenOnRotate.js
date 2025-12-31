import videojs from 'video.js';

videojs.registerPlugin('fullscreenOnRotate', function VideoJsFullscreenOnRotate(options = {}) {
	let locked = false;

	options = {
		enterOnRotate: true,
		exitOnRotate: true,
		lockOnRotate: true,
		lockToLandscapeOnEnter: false,
		lockToLandscapeOnManualEnter: false,
		disabled: false,
		...options
	};

	const rotationHandler = () => {
		const currentOrientation = getOrientation();
		if (currentOrientation === 'landscape' && options.enterOnRotate) {
			if (this.paused() === false) {
				this.requestFullscreen();
				if ((options.lockOnRotate || options.lockToLandscapeOnEnter) &&
					window.screen.orientation && window.screen.orientation.lock) {
					window.screen.orientation.lock('landscape').then(() => {
						locked = true;
					}).catch((e) => {
						videojs.log('Browser refused orientation lock:', e);
					});
					}
			}
		} else if (currentOrientation === 'portrait' && options.exitOnRotate && !locked) {
			if (this.isFullscreen()) {
				this.exitFullscreen();
			}
		}
	};

	this.ready(() => {
		if (options.enterOnRotate || options.exitOnRotate) {
			if (videojs.browser.IS_IOS) {
				window.addEventListener('orientationchange', rotationHandler);

				this.on('dispose', () => {
					window.removeEventListener('orientationchange', rotationHandler);
				});
			} else if (window.screen.orientation) {
				// addEventListener('orientationchange') is not a user interaction on Android
				window.screen.orientation.onchange = rotationHandler;

				this.on('dispose', () => {
					window.screen.orientation.onchange = null;
				});
			}
		}

		this.on('fullscreenchange', _ => {
			if (this.isFullscreen() && options.lockToLandscapeOnManualEnter && getOrientation() === 'portrait') {
				window.screen.orientation.lock('landscape').then(()=>{
					locked = true;
				}).catch((e) => {
					videojs.log('Browser refused orientation lock:', e);
				});
			} else if (!this.isFullscreen() && locked) {
				window.screen.orientation.unlock();
				locked = false;
			}
		});

		this.on('ended', _ => {
			if (locked === true) {
				window.screen.orientation.unlock();
				locked = false;
			}
		});
	});
});

function getOrientation() {
	// Prefer the string over angle, as 0° can be landscape on some tablets
	const orientationString = ((window.screen.orientation || {}).type || window.screen.mozOrientation || window.screen.msOrientation || '').split('-')[0];

	if (orientationString === 'landscape' || orientationString === 'portrait')
		return orientationString;

	// iOS only supports window.orientation
	if (typeof window.orientation === 'number') {
		if (window.orientation === 0 || window.orientation === 180)
			return 'portrait';
		return 'landscape';
	}

	return 'portrait';
}
