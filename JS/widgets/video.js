import module from 'module';
import require from 'require';
import {executeScripts} from 'loader';
import {base_domain, L, tick} from '../utils';
import $ from '../jquery';
import * as pushstream from '../core/lp';
import cookie from '../cookie';
import Device from '../device';
import Spaces from '../spacesLib';
import {IPCSingleton} from '../core/ipc';
import page_loader from '../ajaxify';
import SpacesApp from '../android/api';
import { canPlayQuality, getPreferredVideoQuality, getMaxSupportedQuality, getMimeByQuality, saveSelectedQuality } from './video/quality';
import { reachGoal } from '../metrics/track';

let global_video_id = 0;
let global_instances = {};
let global_direct_instances = {};

let converted_cache = {};

class VideoPlayer {
	static init() {
		window.VideoPlayer = {
			onConvertRequestDone(file_type, file_id, file_md5) {
				console.log("[vc] queued", file_type, file_id, file_md5);
			},
			
			onConvertRequestError(msg, file_type, file_id, file_md5) {
				VideoPlayer.instances(file_type, file_id, (player) => {
					player.converterError(msg);
				});
			}
		};
		
		pushstream.on("message", "video_convert", function (data) {
			if (data.act == pushstream.TYPES.VIDEO_CONVERT) {
				VideoPlayer.instances(data.file_type, data.file_id, (player) => {
					if (data.resolution) {
						player.updateConverterStatus(data.resolution, data.size, data.duration, !data.not_avail);
					} else if (!this.hasConverted()) {
						player.converterError(L('Ошибка конвертирования файла. Обратитесь в <a href="/soo/support">Support</a>.'));
					}
					
					if (data.message)
						player.converterError(data.message);
					
					player.deferInit();
				});
			}

			if (data.act == pushstream.TYPES.VIDEO_STORYBOARD) {
				VideoPlayer.instances(data.fileType, data.fileId, (player) => {
					player.onStoryboardReady(data.framesCount);
				});
			}
		});
		
		if (page_loader.ok()) {
			let disable_fullscreen = () => {
				for (let id in global_direct_instances) {
					let player = global_direct_instances[id];
					if (player && player.driver && player.driver.isFullscreen())
						player.driver.setFullscreen(false);
				}
			};
			
			page_loader.on('requestend', "vplayer", disable_fullscreen, true);
			page_loader.on('mailrequestend', "vplayer", disable_fullscreen, true);
			
			page_loader.onJSC('vp', (hash) => {
				let params = hash.split(":");
				let player = VideoPlayer.instance(params[0]);
				if (player) {
					if (player.driver) {
						player.driver.setFullscreen(true);
					} else {
						page_loader.setJSC(false);
					}
				}
			}, true);
		}
	}
	
	static destroy() {
		IPCSingleton.instance('cp').stop('video');
		pushstream.off("message", "video_convert");
		
		page_loader.off('requestend', "vplayer");
		page_loader.off('mailrequestend', "vplayer");
		
		global_instances = {};
		converted_cache = {};
		
		for (let id in global_direct_instances) {
			let player = global_direct_instances[id];
			player && player.destroy();
		}
	}
	
	static destroyDetached() {
		for (let id in global_direct_instances) {
			let player = global_direct_instances[id];
			player && player.isDetached() && player.destroy();
		}
	}
	
	static instance(id) {
		return global_direct_instances[id];
	}
	
	static instances(file_type, file_id, callback) {
		let instances = global_instances[file_type + "_" + file_id];
		if (instances) {
			for (let i = 0, l = instances.length; i < l; i++)
				callback(instances[i]);
		}
	}
	
	constructor(container) {
		this.container = container;
		this.options = container.data();
		
		this.on_ready = [];
		
		if (this.options.external)
			this.options.sources = [{res: 720, converted: true, link: this.options.externalId}];
		
		// Сортируем качества от большего к меньшему
		this.options.sources.sort((a, b) => {
			return b.res - a.res;
		});
		
		this.is_inited = false;
		
		this.instance_id = this.options.fileType + '_' + this.options.fileId;
		this.id = 'video-' + this.instance_id + '-' + global_video_id++;
		
		if (converted_cache[this.instance_id])
			this.restoreConvertedState(converted_cache[this.instance_id]);
		
		if (!global_instances[this.instance_id])
			global_instances[this.instance_id] = [];
		global_instances[this.instance_id].push(this);
		
		global_direct_instances[this.id] = this;
		
		container.prop({id: this.id});
		
		if (this.options.convertLink) {
			tick(() => {
				let link = this.options.convertLink + (this.options.convertLink.indexOf('?') >= 0 ? '&' : '?') + "_=" + (new Date().getTime());
				console.info("[vc] queue request: " + link);
				executeScripts([{src: link}]);
			});
		}
		
		this.deferInit();
	}
	
	deferInit() {
		if (this.is_inited || !this.hasConverted())
			return;
		
		if (this.options.convertLink) {
			if (this.isFullyConverted()) {
				this.hideConverterStatus();
			} else {
				this.checkConverterStatus();
			}
		}
		
		let module_id;
		
		// Внешнее видео
		if (this.options.external) {
			switch (this.options.external) {
				case Spaces.ExternalVideo.YOUTUBE:
					module_id = import.meta.id('./video/youtube');
				break;
				
				default:
					throw new Error('Unknown external id: ' + this.options.external);
			}
		}
		// Локальное видео
		else {
			if (Device.android_app && (this.options.nativeVideo || !getMaxSupportedQuality() || Device.android() < 3)) {
				// Внутри приложения используем встроенный плеер
				module_id = import.meta.id('./video/android');
			} else if (isNeedNativePlayer()) {
				// Для некоторых браузеров невозможно использовать плеер с UI, т.к. они сразу открывают какой-то свой полноразмерный плеер
				// Для них выводим нативный <video>
				module_id = import.meta.id('./video/native');
			} else {
				// Для всех остальных выводим обычный video.js
				module_id = import.meta.id('./video/videojs');
				import('Files/VideoJs.css');
			}
		}
		
		require.fast(module_id, (driver) => this.createDriver(driver.default));
		
		this.is_inited = true;
	}
	
	restoreConvertedState([converted, not_avail]) {
		this.options.sources.forEach((source) => {
			source.converted = converted[source.res];
			source.not_available = not_avail[source.res];
		});
		this.options.convertLink = false;
		this.hideConverterStatus();
	}
	
	isDetached() {
		return !document.getElementById(this.id);
	}
	
	isPlaying() {
		return this.driver && this.driver.isPlaying();
	}
	
	play() {
		return this.driver && this.driver.play();
	}
	
	pause() {
		return this.driver && this.driver.pause();
	}
	
	ready(callback) {
		if (this.is_ready) {
			callback && callback();
		} else {
			this.on_ready.push(callback);
		}
		return this;
	}
	
	createDriver(DriverClass) {
		let options = this.options;
		
		let can_autoplay = options.autoplay && (!this.options.viewer || this.isFullyConverted());
		
		this.driver = new DriverClass(this.id, this.container, {
			sources:		this.getSources(),
			preview:		options.preview,
			viewer:			options.viewer,
			autoplay:		can_autoplay,
			vast:			options.vast,
			native:			options.nativeVideo,
			viewToken:		options.viewToken,
			heatmap:		options.heatmap,
			storyboard:		options.storyboard,
			headerUrl:		options.headerUrl,
			title:			options.title,
			pageUrl:		options.pageUrl,
			videoWidth:		options.videoWidth,
			videoHeight:	options.videoHeight,
			duration:		options.duration,
			file:			$.extend({
				id:			options.fileId,
				type:		options.fileType,
				dir:		options.fileDir,
			}, options.listParams || {})
		});
		
		let last_jsc;
		
		this.driver
			.on('play', () => {
				let stop_all = (except) => {
					for (let id in global_direct_instances) {
						let player = global_direct_instances[id];
						if (player && player != except && player.isPlaying())
							player.pause();
					}
				};
				
				stop_all(this);
				
				IPCSingleton.instance('cp').start(() => {
					stop_all();
				}, 'video');
				
				this.container.trigger('video_play');
				
				if (options.viewer)
					this.hideConverterStatus();
			})
			.on('pause', () => {
				IPCSingleton.instance('cp').stop('video');
			})
			.on('quality-changed', (resolution) => {
				saveSelectedQuality(resolution);
				reachGoal("player_quality_" + resolution);
			})
			.on('fullscreen', (is_fullscreen) => {
				if (Device.android_app) {
					// Включаем реальный фуллскрин
					SpacesApp.exec("fullscreen", {enable: is_fullscreen});
					
					// В фуллскрине не должен работать pull-to-refresh
					SpacesApp.exec("pullToRefresh", {enable: !is_fullscreen});
					
					// Блокируем свайпы просмотрщика
					import('../gallery').then(({default: GALLERY}) => GALLERY.lock(is_fullscreen));
					
					// Блокируем открытие сайдбара
					import('../widgets/swiper').then(sidebar => sidebar.lock(is_fullscreen));
					
					// Отключаем скролл body
					document.body.style.position = is_fullscreen ? 'fixed' : 'static';
				}
				
				if (page_loader.ok()) {
					if (is_fullscreen) {
						if (page_loader.isJSC() !== 'vp')
							page_loader.setJSC('vp', this.id);
						last_jsc = location.hash;
					} else {
						if (last_jsc === location.hash)
							history.back();
						last_jsc = null;
					}
				}

				if (is_fullscreen)
					reachGoal("player_fullscreen");
			});
		
		this.driver.init(() => {
			this.is_ready = true;
			for (let i = 0, l = this.on_ready.length; i < l; i++)
				this.on_ready[i]();
		});
	}
	
	onStoryboardReady(totalFramesCount) {
		this.driver.onStoryboardReady(totalFramesCount);
	}

	hideConverterStatus() {
		this.container.find('.js-vc_status').addClass('hide');
	}
	
	checkConverterStatus() {
		// Особый случай, когда в просмотршике открыли не до конца сконвертированное видео
		// Скрываем UI ожидания конвертации, если нужное качество сконвертировалось
		// Иначе выводит кнопку "Воспроизвести в 240p", чтобы юзер при желании мог посмотреть видео в другом доступном качестве
		if (this.options.viewer) {
			let last_video_quality = getPreferredVideoQuality();
			let available_quality = this.hasConverted();
			
			if (available_quality) {
				if (available_quality != last_video_quality) {
					let play_btn = this.container.find('.js-vp_play');
					if (play_btn.hasClass('hide')) {
						play_btn.removeClass('hide');
						play_btn.click((e) => {
							e.preventDefault();
							this.hideConverterStatus();
							this.play();
						});
					}
					play_btn.text(L('Воспроизвести в {0}', available_quality + "p"));
				} else {
					this.hideConverterStatus();
				}
			}
		}
	}
	
	updateConverterStatus(resolution, size, duration, available) {
		let self = this;
		
		let converted = {};
		let not_avail = {};
		let available_count = 0;
		let converted_count = 0;
		
		this.options.sources.forEach((source) => {
			if (source.res == resolution) {
				if (available) {
					source.converted = true;
					console.log('[vc] ' + this.instance_id + ': ' + source.res + 'p - done');
					this.driver && this.driver.updateSource(source.res, true);
				} else {
					source.converted = false;
					source.not_available = true;
					console.log('[vc] ' + this.instance_id + ': ' + source.res + 'p - not available');
					this.driver && this.driver.updateSource(source.res, false);
				}
			}
			
			if (!source.not_available)
				available_count++;
			
			if (source.converted)
				converted_count++;
			
			not_avail[source.res] = source.not_available;
			converted[source.res] = source.converted;
		});
		
		// Показываем 144p только после того, как 240p сконвертится
		converted[144] = converted[240];
		
		// Обновляем размер файла
		if (size > 0) {
			$('.js-vc_filesize').each(function () {
				let $el = $(this);
				if ($el.data('id') == self.instance_id && $el.data('res') == resolution)
					$el.html(Spaces.getHumanSize(size)).removeClass('hide');
			});
		}
		
		// Обновляем длительность
		if (duration > 0) {
			$('.js-vc_duration').each(function () {
				let $el = $(this);
				if ($el.data('id') == self.instance_id)
					$el.html(printDuration(duration));
			});
		}
		
		// Показываем/скрываем ссылки на скачивание файла
		$('.js-vc_visible').each(function () {
			let $el = $(this),
				el_data = $el.data();
			
			if (el_data.id == self.instance_id) {
				if (el_data.show) {
					$el.toggleClass('hide', !converted[el_data.show]);
				} else if (el_data.hide) {
					$el.toggleClass('hide', !!converted[el_data.hide]);
				}
			}
		});
		
		let vc_status = this.container.find('.js-vc_status');
		if (this.isFullyConverted()) {
			vc_status.remove();
			
			converted_cache[this.instance_id] = [converted, not_avail];
			
			// Обновляем расширение на .mp4
			$('.js-vc_fileext').each(function () {
				let $el = $(this);
				if ($el.data('id') == self.instance_id)
					$el.text('mp4').removeClass('js-vc_fileext');
			});
		} else {
			// Обновляем статус конвертирования
			vc_status.find('.js-vc_pb').css("width", Math.max(5, converted_count / available_count * 100) + '%');
			vc_status.find('.js-vc_item').each(function () {
				let $el = $(this);
				$el.toggleClass('b blue', !!converted[$el.data('res')]);
			});
		}
		
		this.checkConverterStatus();
	}
	
	converterError(error) {
		console.error('[vc] error:', error);
		let vc_status = this.container.find('.js-vc_status');
		vc_status.find('.js-vc_status_msg').html(`<span class="red">${error}</span>`);
	}
	
	isFullyConverted() {
		let {sources} = this.options;
		for (let i = 0, l = sources.length; i < l; i++) {
			if (!sources[i].converted && !sources[i].not_available)
				return false;
		}
		return true;
	}
	
	hasConverted() {
		let can_play_mp4 = getMaxSupportedQuality();
		let last_video_quality = getPreferredVideoQuality();
		let {sources} = this.options;
		let available_quality = false;
		
		for (let i = 0, l = sources.length; i < l; i++) {
			let source = sources[i];
			let supported = canPlayQuality(source.res);
			
			// Пропускаем неподдерживаемые источники, если браузер умеет нативно воспроизводить MP4
			if (can_play_mp4 && !supported)
				continue;
			
			if (source.converted) {
				available_quality = source.res;
				if (source.res <= last_video_quality)
					break;
			}
		}
		return available_quality;
	}
	
	getSources() {
		let can_play_mp4 = getMaxSupportedQuality();
		let last_video_quality = getPreferredVideoQuality();

		console.log("Preferred video quality:", last_video_quality);
		
		let default_index = 0;
		let new_sources = [];
		
		this.options.sources.forEach((source) => {
			let mime = getMimeByQuality(source.res);
			let supported = canPlayQuality(source.res);
			
			// Пропускаем неподдерживаемые источники, если браузер умеет нативно воспроизводить MP4
			if (can_play_mp4 && !supported)
				return;
			
			new_sources.push({
				resolution:	source.res,
				label:		source.res + "p",
				enabled:	!!source.converted,
				src:		source.link,
				type:		mime,
				selected:	false
			});
			
			if (source.res == last_video_quality)
				default_index = new_sources.length - 1;
		});
		
		new_sources[default_index].selected = true;
		
		return new_sources;
	}
	
	destroy() {
		let old_instances = global_instances[this.instance_id];
		if (old_instances) {
			let new_instances = [];
			for (let i = 0, l = old_instances.length; i < l; i++) {
				if (old_instances[i] != this)
					new_instances.push(old_instances[i]);
			}
			
			if (new_instances.length) {
				global_instances[this.instance_id] = new_instances;
			} else {
				delete global_instances[this.instance_id];
			}
		}
		
		delete global_direct_instances[this.id];
		this.driver && this.driver.destroy();
		this.driver = false;
	}
}

function moduleInit() {
	module.on('component', () => {
		let players = document.getElementsByClassName('js-vp_new');
		while (players.length)
			vplayer($(players[0]));
	});
	
	module.on('componentpage', () => {
		VideoPlayer.init();
	});
	
	module.on('componentpagedone', () => {
		VideoPlayer.destroy();
	});
}

function printDuration(duration) {
	var h = Math.floor(duration / 3600);
	duration -= h * 3600;
	var m = Math.floor(duration / 60);
	duration -= m * 60;
	if (h)
		return h + ":" + ("0" + m).slice(-2) + ":" + ("0" + duration).slice(-2);
	return m + ":" + ("0" + duration).slice(-2);
}

function isNeedNativePlayer() {
	// UC Browser заменяет плеер на свой кастомный
	return Device.browser.name == 'ucbrowser' && getMaxSupportedQuality();
}

function vplayer(container) {
	if (!(container instanceof $))
		container = $(container);
	
	container[0].className = container[0].className.replace('js-vp_new', '');
	
	let instance = container.data('video');
	if (!instance) {
		instance = new VideoPlayer(container);
		container.data('video', instance);
	}
	return instance;
}

moduleInit();

export default VideoPlayer;
export {VideoPlayer, vplayer};
