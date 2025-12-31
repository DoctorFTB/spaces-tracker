import {extend, ce, ge} from './utils';

/*
	Flash Fallback для Spaces.Sound()
	Имитирует поведение HTML5 Audio для простоты внедрения
*/
var FLASH_DEBUG = !!document.cookie.match(/sound_debug=1/);

// Инициализатор и бридж для SM2 Flash плеера
var SM2Bridge = (function () {
	var flash_id = 'flash_audio_' + Date.now(),
		container_id = flash_id + '_wrap',
		ua = navigator.userAgent,
		is_IE = ua.match(/msie/i),
		is_webkit = ua.match(/webkit/i),
		swf_element,
		swf_container,
		flash_api,
		flash_error,
		start_init_time = 0,
		opts,
		
		setup_called = false,
		ready_callbacks = [];
	
	function init(user_opts) {
		opts = extend({
			perfomance: true,
			url: FLASH_DEBUG ? BASE_URL + '/touch/libs/soundmanager2_flash9_debug.swf' : BASE_URL + '/touch/libs/soundmanager2_flash9.swf'
		}, user_opts);
	}
	
	function ready(callback) {
		if (!setup_called) {
			setup_called = true;
			
			add_event(window, 'unload', function () {
				// http://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
				return false;
			});
			
			window.soundManager = {
				_externalInterfaceOK: function (ver) {
					console.log("[SM2] " + ver + ' (' + (Date.now() - start_init_time) + ' ms)');
					setTimeout(checkFlashInit, is_IE ? 100 : 1);
				},
				_setSandboxType: function (type) { },
				_writeDebug: function (debug) {
					console.log(debug);
				},
				sounds: {}
			};
			
			/*
			console.log('focus', document.hasFocus());
			if (typeof document.hasFocus == "function" && !document.hasFocus()) {
				console.log("init on focus");
				
				var on_focus;
				add_event(window, 'focus', on_focus = function () {
					console.log('call focus');
					remove_event(window, 'focus', on_focus);
					on_focus = null;
					createSwf(opts.url);
				});
			} else {
				createSwf(opts.url);
			}
			*/
			
			setTimeout(function () {
				createSwf(opts.url);
			}, 1000); // IE
		}
		if (flash_api) {
			callback({
				success: true,
				api: flash_api
			});
		} else if (flash_error) {
			callback({
				success: false,
				error: flash_error
			});
		} else {
			ready_callbacks.push(callback);
		}
	}
	
	function createSwf(url) {
		var options = {
			name: flash_id,
			id: flash_id,
			src: url.replace(/^(http:|https:)/i, ''),
			quality: 'high',
			allowScriptAccess: 'always',
			bgcolor: '#ffffff',
			FlashVars: FLASH_DEBUG ? 'debug=1' : undefined,
			title: 'JS/Flash audio component (SoundManager 2)',
			type: 'application/x-shockwave-flash',
			wmode: opts.perfomance ? 'transparent' : undefined,
			hasPriority: 'true'
		};
		
		var swf_html, swf_el;
		if (is_IE) {
			swf_html = '<object id="' + options.id + '" data="' + options.src + '" type="' + options.type + '" ' + 
				'title="' + options.title +'" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" ' + 
				'codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=6,0,40,0">';
			var ie_options = [
				["movie", options.src],
				["AllowScriptAccess", options.allowScriptAccess],
				["quality", options.quality],
				["bgcolor", options.bgcolor],
				["FlashVars", options.FlashVars],
				["wmode", options.wmode],
				["hasPriority", options.hasPriority]
			];
			for (var i = 0; i < ie_options.length; ++i) {
				if (ie_options[i][1])
					swf_html += '<param name="' + ie_options[i][0] + '" value="' + ie_options[i][1] + '" />';
			}
			swf_html += '</object>';
		} else {
			swf_el = ce('embed', {}, {}, options);
		}
		
		var swf_style;
		if (opts.perfomance) {
			// on-screen at all times
			swf_style = {
				'position': 'fixed',
				'width': '8px',
				'height': '8px',
				// >= 6px for flash to run fast, >= 8px to start up under Firefox/win32 in some cases. odd? yes.
				'bottom': '0px',
				'left': '0px',
				'overflow': 'hidden'
			};
		} else {
			// hide off-screen, lower priority
			swf_style = {
				'position': 'absolute',
				'width': '6px',
				'height': '6px',
				'top': '-9999px',
				'left': '-9999px'
			};
		}
		
		if (is_webkit) // safari 5 crash
			swf_style.zIndex = 10000;
		
		swf_container = ce('div', {
			id: container_id,
			className: ''
		}, swf_style);
		
		try {
			document.body.appendChild(swf_container);
			if (is_IE) {
				swf_container.appendChild(ce('div', {
					innerHTML: swf_html
				}));
			} else {
				swf_container.appendChild(swf_el);
			}
			swf_element = ge('#' + options.id);
		} catch (e) {
			var error = 'Flash DOM error: ' + (e.stack || e.toString());
			console.error(error);
			reportError(error);
			
			swf_container.parentNode.removeChild(swf_container);
			swf_element = swf_container = null;
			
			return;
		}
		start_init_time = Date.now();
	}
	
	function getFlash(id) {
		return ge('#' + id) || document[id] || window[id];
	}
	
	function checkFlashInit() {
		var audio = getFlash(flash_id);
		try {
			audio._externalInterfaceTest(false);
			audio._setPolling(true, opts.perfomance ? 10 : 50);
			if (!FLASH_DEBUG)
				audio._disableDebug();
			flash_api = audio;
		} catch (e) {
			var error = 'Flash API error: ' + (e.stack || e.toString());
			console.error(error);
			flash_api = null;
			reportError(error);
			return;
		}
		freeReadyQueue();
	}
	
	function reportError(error) {
		flash_error = error;
		freeReadyQueue();
	}
	
	function freeReadyQueue() {
		if (ready_callbacks.length) {
			var old_ready_callbacks = ready_callbacks;
			ready_callbacks = [];
			for (var i = 0; i < old_ready_callbacks.length; ++i)
				ready(old_ready_callbacks[i]);
		}
	}
	
	return {
		init: init,
		ready: ready
	};
})();

// Flash Fallback
var FlashAudio = function (opts) {
	var self = this,
		opts,
		events = {},
		sound_id = 'flash_sound_' + Date.now(),
		flash_api, destroyed = false, real_src, flash_error,
		load_called, track_loaded, first_play, real_playing, real_paused,
		last_values = {
			position: 0,
			volume: 0
		};
	
	extend(self, {
		canPlayType: function () {
			return 'maybe';
		},
		load: loadSound,
		flashSync: sync,
		flashReset: resetTrack,
		flashDestory: destroy,
		play: function () {
			playPauseSound(true);
		},
		pause: function () {
			playPauseSound(false);
		},
		addEventListener: function (event, callback, flag) {
			events[event] = callback;
		},
		removeEventListener: function (event, callback) {
			events[event] = null;
		}
	});
	
	initFlashSound();
	
	function initFlashSound() {
		opts = extend({
			autoLoad: false
		}, opts);
		
		self.volume = 1;
		resetProps();
		SM2Bridge.init();
		SM2Bridge.ready(function (e) {
			if (destroyed)
				return;
			
			if (e.success) {
				SM2Bridge.ready(function (e) {
					flash_api = e.api;
					flash_api._createSound(
						sound_id,
						null,
						false, // usePeakData
						false, // useWaveformData
						false, // useEQData
						null, // useNetstream
						false, // bufferTime
						1, // loops
						null, // serverURL
						null, // duration
						false, // autoPlay
						true, // useEvents
						opts.autoLoad, // autoLoad
						false // checkPolicyFile
					);
				});
				triggerEvent('flashInit');
			} else {
				// Ошибка инициализации flash плеера
				flash_error = e.error;
				triggerEvent('error', flash_error);
			}
		});
		window.soundManager.sounds[sound_id] = {
		//	_onbufferchange: function (is_buffer) {
		//		console.warn("_onbufferchange", is_buffer);
		//	},
			_onload: function (valid) {
				if (!valid)
					triggerEvent('error');
			},
			_whileloading: function (loaded, total, duration) {
				if (!track_loaded && duration > 0) {
					track_loaded = true;
					playPauseSound(!self.paused);
					triggerEvent('canplay');
				}
				
				duration /= 1000;
				if (!self.duration || self.duration != duration) {
					self.duration = Math.round(duration * (total / loaded));
					triggerEvent('durationchange');
				}
				mk_buffered(self.buffered, loaded / total * self.duration, self.duration);
				triggerEvent('progress', {});
			},
			_ondataerror: function (error) {
				triggerEvent('error', error);
			},
			_whileplaying: function (position) {
				last_values.position = self.currentTime = position / 1000;
				if (self.duration > 0)
					triggerEvent('timeupdate');
			},
			_onfinish: function () {
				triggerEvent('ended');
			}
		};
	}
	
	function resetProps() {
		self.duration = last_values.position = self.currentTime = 0;
		track_loaded = false;
		real_paused = self.paused = true;
		first_play = true;
		self.buffered = {};
		last_values = {};
		mk_buffered(self.buffered, 0, 0);
	}
	
	function sync() {
		var time = self.currentTime;	// Сохраним значение для перемотки, иначе за каким-то хуем перетирается до вызова _setPosition,
										// потому что за каким-то хуем вызываются коллбэки, будто одновременно из разных тредов флеш вызывает JS. 
		if (flash_api && last_values.position !== time) {
			if (!first_play)
				flash_api._setPosition(sound_id, Math.round(time) * 1000, self.paused, false);
			last_values.position = time;
		}
		
		if (flash_api && last_values.volume !== self.volume) {
			self.volume = Math.max(0, Math.min(self.volume, 1));
			flash_api._setVolume(sound_id, self.volume * 100);
			last_values.volume = self.volume;
		}
	}
	
	function playPauseSound(state) {
		self.paused = !state;
		if (flash_api) {
			if (self.paused != real_paused) {
				real_paused = self.paused;
				
				triggerEvent(!real_paused ? 'play' : 'pause');
				
				if (!real_paused)
					flash_api._setVolume(sound_id, self.volume * 100);
				if (first_play) {
					first_play = false;
					flash_api._setPan(sound_id, 0); // L&R balans
					flash_api._start(sound_id, 1, self.currentTime * 1000, false);
				} else {
					if (!first_play)
						flash_api._pause(sound_id, false);
				}
			}
		} else if (flash_error) {
			triggerEvent('error', flash_error);
		}
	}
	
	function loadSound() {
		real_src = self.src;
		
		if (flash_error)
			triggerEvent('error', flash_error);
		
		if (load_called)
			return;
		load_called = true;
		
		SM2Bridge.ready(function (e) {
			load_called = false;
			if (!real_src || !flash_api)
				return;
			
			resetProps();
			flash_api._load(
				sound_id,
				real_src,
				true, // stream
				false, // autoPlay
				1, // loops
				opts.autoLoad, // autoLoad
				false // usePolicyFile
			);
		});
	}
	
	function resetTrack() {
		if (real_src && flash_api) {
			playPauseSound(false);
			flash_api._stop(sound_id, false);
			flash_api._unload(sound_id);
			real_src = null;
		}
		self.src = null;
		resetProps();
	}
	
	function destroy() {
		resetTrack();
		flash_api = null;
		if (!destroyed) {
			flash_api && flash_api._destroySound(sound_id);
			destroyed = true;
		}
	}
	
	function triggerEvent(event, e) {
	//	console.warn('FlashAudio->triggerEvent(' + event + ') =', e, !!events[event]);
		events[event] && events[event].apply(self, [e]);
	}
};
function add_event(o, n, f) {
	o.addEventListener ? o.addEventListener(n, f, false) : o.attachEvent('on' + n, f);
}
function remove_event(o, n) {
	o.removeEventListener ? o.removeEventListener(n, false) : o.detachEvent('on' + n);
}
function _buffered_start() {
	return this._start;
}
function _buffered_end() {
	return this._end;
}
function mk_buffered(buffered, loaded, total) {
	extend(buffered, {
		length: total ? 1 : 0,
		start: _buffered_start,
		end: _buffered_end,
		_start: 0,
		_end: loaded
	});
}

export {FlashAudio};
