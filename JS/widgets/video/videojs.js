import videojs from './videojs/player';
import Spaces from '../../spacesLib';
import Device from '../../device';
import cookie from '../../cookie';
import BaseDriver from './base';
import { setupAds } from './videojs/ads';
import { setupStatistic, setupViewTracker } from './videojs/statistic';

// Адаптер для video.js
class VideoJsDriver extends BaseDriver {
	init(callback) {
		let video = document.createElement('video');
		video.className = `video-js vjs-16-9 vjs-big-play-centered ${videojs.browser.TOUCH_ENABLED ? 'vjs-theme-touch' : 'vjs-theme-desktop'}`;

		// На говнобраузерах постер растягивается....
		// Нужно сделать превьюшки на 16:9 сначала
		if (Device.type == 'desktop' || Device.engine.name == 'Blink')
			video.setAttribute('poster', this.options.preview);

		// Отключаем контекстное меню у плеера
		this.container.on('contextmenu', (e) => {
			e.preventDefault();
		});

		this.container.find('.js-vp_player')
			.removeClass('video-player--is-stub')
			.empty()
			.append(video);

		let controlbar_children = [
			'playToggle',
			'volumePanel',
			'progressControl',
			'currentTimeDisplay',
			'timeDivider',
			'durationDisplay',
			'controlBarSpacer',
			'qualitySelector'
		];

		// Картинку-в-Картинке включаем только в пк и только если плеер не внутри просмотрщика
		if (('exitPictureInPicture' in document) && !videojs.browser.TOUCH_ENABLED && !this.options.viewer)
			controlbar_children.push('pictureInPictureToggle');

		if (isFullscreenEnabled())
			controlbar_children.push('fullscreenToggle');

		let player_options = {
			controls:				true,
			poster:					this.options.preview,
			preload:				'none',
			altSources:				this.options.sources,
			autoplay:				this.options.autoplay,
			language:				Spaces.params.lang,
			playsinline:			true,
			nativeControlsForTouch:	false,
			enableSmoothSeeking:	true,

			userActions: {
				hotkeys: (e) => {
					if (e.which == 39) { // ArrowRight
						e.preventDefault();
						e.stopPropagation();

						player.controlBar.progressControl.seekBar.stepForward();
					} else if (e.which == 37) { // ArrowLeft
						e.preventDefault();
						e.stopPropagation();

						player.controlBar.progressControl.seekBar.stepBack();
					} else {
						player.handleHotkeys(e);
					}
				}
			},

			html5: {
				nativeTextTracks:	true,
				nativeCaptions:		true
			},

			controlBar: {
				children: controlbar_children,
				progressControl: {
					seekBar: {
						stepSeconds: videojs.browser.TOUCH_ENABLED ? 10 : 5,
					}
				}
			}
		};

		if (videojs.browser.TOUCH_ENABLED)
			player_options.disableSeekWhileScrubbingOnMobile = true;

		let player = videojs(video, player_options);
		this.player = player;

		if (this.options.viewer) {
			player.ready(() => {
				console.log('focus in viewer');
				player.focus();
			});
		}

		let old_playing;
		let trigger_pause = () => {
			if (old_playing) {
				this.trigger('pause');
				old_playing = false;
			}
		};

		player.on('play', () => {
			if (!old_playing) {
				this.trigger('play');
				old_playing = true;
			}

			this.played = true;
		});
		player.on('pause', trigger_pause);
		player.on('ended', trigger_pause);
		player.on('dispose', trigger_pause);
		player.on('volumechange', () => {
			saveVolume(player.volume(), player.muted());
		});
		player.on('fullscreenchange', () => {
			this.trigger('fullscreen', [player.isFullscreen()]);
		});
		player.on('quality-changed', (event, resolution) => {
			this.trigger('quality-changed', [resolution]);
		});

		/*
		if (cookie.set('vast_test')) {
			this.options.vast = [
				{
					"id": "postroll",
					"offset": "end",
					"tag": "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&correlator=",
					"type": "linear"
				},
				{
					"id": "preroll",
					"offset": "start",
					"tag": "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&correlator=",
					"type": "linear"
				}
			];
		}
		*/

		if (this.options.vast)
			setupAds(player, this.options.vast);

		let saved_volume = getSavedVolume();
		if (saved_volume) {
			player.volume(saved_volume.volume);
			player.muted(saved_volume.muted);
		}

		// Плагины
		player.betterAutoplay();
		player.resizeMonitor();
		player.seekingStatus();

		if (videojs.browser.TOUCH_ENABLED) {
			const isHorizontal = this.options.videoWidth && this.options.videoHeight && this.options.videoWidth / this.options.videoHeight >= 1.05;
			player.fullscreenOnRotate({
				enterOnRotate: true,
				exitOnRotate: true,
				lockOnRotate: false,
				lockToLandscapeOnEnter: false,
				lockToLandscapeOnManualEnter: isHorizontal,
			});
			player.tapToRewind();
		} else {
			player.smartAltTab();
			player.hideOnBlur();
			player.fastShowOnHover();
		}

		if (this.options.duration)
			player.dummyDuration({ duration: this.options.duration });

		if (this.options.storyboard && this.options.storyboard.totalFramesCount > 0)
			player.storyboard(this.options.storyboard);

		setupStatistic(player);

		if (this.options.viewToken)
			setupViewTracker(player, this.options.viewToken);

		if (this.options.heatmap) {
			player.heatmap({
				heatmap: this.options.heatmap
			});
		}

		if (this.options.headerUrl) {
			player.videoTitle({
				title: this.options.title,
				url: this.options.headerUrl,
			});
		}

		player.ready(callback);
	}

	onStoryboardReady(totalFramesCount) {
		const storyboard = this.options.storyboard;
		if (!storyboard || this.player.getChild('Storyboard'))
			return;

		const realSpritesCount = Math.ceil(totalFramesCount / storyboard.spriteFramesCount);
		const sprites = storyboard.sprites.slice(0, realSpritesCount);

		this.player.storyboard({
			...storyboard,
			totalFramesCount,
			sprites
		});
	}

	updateSource(resolution, converted) {
		this.player.trigger('quality-enable', [resolution, converted]);
	}

	isFullscreen() {
		return this.player.isFullscreen();
	}

	setFullscreen(flag) {
		let player = this.player;
		player.ready(() => {
			if (flag) {
				if (!player.isFullscreen())
					player.requestFullscreen();
			} else {
				if (player.isFullscreen())
					player.exitFullscreen();
			}
		});
	}

	play() {
		let player = this.player;
		player.ready(() => player.play());
	}

	pause() {
		let player = this.player;
		player.ready(() => player.pause());
	}

	isPlaying() {
		return !this.player.paused()
	}

	destroy() {
		// Не уверен в этом API, лучше завернуть в try
		try {
			if (this.player.isInPictureInPicture())
				this.player.exitPictureInPicture();
		} catch (e) { }

		this.player.dispose();

		this.player = false;
	}
}

function isFullscreenEnabled() {
	let isEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled;
	return isEnabled || isEnabled === undefined;
}

function getSavedVolume() {
	try {
		if (window.localStorage && window.localStorage["videojs"])
			return JSON.parse(window.localStorage["videojs"]);
	} catch (e) { }

	// cookie fallback
	let from_cookie = cookie.get('vjs');
	if (from_cookie) {
		let tmp = from_cookie.split(":");
		return {volume: +tmp[0], muted: tmp[1] == 1};
	}

	return false;
}

function saveVolume(volume, muted) {
	try {
		if (window.localStorage) {
			window.localStorage["videojs"] = JSON.stringify({volume, muted});
			return;
		}
	} catch (e) { }

	// cookie fallback
	cookie.set('vjs', volume + ":" + (muted ? 1 : 0));
}

export default VideoJsDriver;
