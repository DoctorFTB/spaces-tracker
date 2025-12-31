import module from 'module';
import $ from './jquery';
import cookie from './cookie';
import Device from './device';
import {Class} from './class';
import SpacesApp from './android/api';
import {Spaces, Url, Codes} from './spacesLib';
import {IPCSingleton} from './core/ipc';
import page_loader from './ajaxify';
import {SpacesSound} from './sound';
import * as sidebar from './widgets/swiper';
import notifications from './notifications';
import DdMenu from './dd_menu';
import {L, html_wrap, tick} from './utils';

import "Files/Player.css";

var has_session_storage = Device.can('sessionStorage');
var classes = {
	ico: {
		play:		'ico_player_play',
		pause:		'ico_player_pause',
		repeat_off:	'ico_reload',
		repeat_on:	'ico_reload_darkblue',
	},
	playlist: {
		hover: 'strong_clicked',
		active: 'gp-playlist_active'
	},
	copy2me: [
		'ico ico_plus_darkblue js-ico',
		'ico ico_ok_darkblue js-ico',
		'ico ico_spinner js-ico'
	]
};

// extern
var BasePlayList, ConstPlayList, ApiPlayList, XProxySpacesPL;

var $global_player, $global_player_win, $playlist_scroll,
	PLAYLISTS = {},
	PL_ID = 0,
	playlist, // Константный плейлист
	page_tmp_playlist, // Временный плейлист
	current, // Текущий трек
	sound,
	same_find = false,
	init_triggered = false,
	no_update_timeline = false,
	rewind_stop_update_timeline = false,
	initialized = false,
	use_native_scroll,
	render_mode = {
		dev: null,
		flying_btn: null,
		volume: null
	},
	ipc_interval,
	last_scroll = 0,
	
	gp_state = {
		// bool gp_menu_open
		// bool need_update_playlist
	},
	
	delayed_populate_timeout,
	run_delayed_populate = false; // Запустить populate после init

var tpl = {
	globalPlayerButton: function (data) {
		var html = 
			'<div id="gp" data-menu_id="gp_window" class="js-dd_menu_link gp"' + 
					'data-custom_class="gp-active" data-noclass="1">' + 
				'<div class="gp-content">' + 
					'<div class="gp-icon_wrap left js-music_gp">' + 
						'<span class="ico_player ico_player_play" id="gp_icon"></span>' + 
					'</div>' + 
					'<div class="gp-info_wrap">' + 
						'<div id="gp_artist"></div>' + 
						'<div id="gp_title"></div>' + 
					'</div>' + 
				'</div>' + 
			'</div>';
		return html;
	},
	globalPlayerWindow: function (data) {
		data = data || {};
		
		var close_btn = 
			'<div id="gp_bottom_tools" class="gp-mobile_show">' + 
				'<a href="#" class="list-link js-dd_menu_close t_center">' + 
					'<span class="ico ico_remove"></span> ' + L('Закрыть') + 
				'</a>' + 
			'</div>';
		
		var html = 
			'<div class="gp__dropdown-menu dropdown-menu__wrap gp-window js-dd_menu_item" id="gp_window" data-scroll="1">' + 
				'<div class="widgets-group dropdown-menu js-ddmenu_content gp-body_wrap links-group_grey">' + 
					'<div class="gp-body">' + 
						(!use_native_scroll ? close_btn : '') + 
						'<div class="stnd_padd light_border_bottom grey pointer">' + 
							'<div id="gp_main_player" class="player_item player-extended js-music_mp"></div>' + 
						'</div>' + 
						'<div class="links-group help-block dropdown-menu gp-playlist_size" id="gp_playlist"></div>' + 
						(use_native_scroll ? close_btn : '') + 
					'</div>' + 
				'</div>' + 
			'</div>';
		return html;
	},
	listSpinner: function () {
		var html = 
			'<span class="list-link js-music_spinner">' + 
				'<span class="ico ico_spinner"></span> ' + L('Загрузка...') + 
			'</span>';
		return html;
	},
	playlistItem: function (data) {
		var html = 
			'<a href="#" class="list-link js-music_pl_play no_word_break" data-n="' + data.index + '">' + 
				'<span class="ico_player ico_player_play js-music_pl_icon"></span> <b>' + html_wrap(data.artist) + '</b>' + 
					(data.title ? ' - ' + html_wrap(data.title) : '') + 
			'</a>';
		return html;
	},
	playerItem: function (data) {
		var html = 
			'<div class="p_i_tools oh">' + 
			'<table class="tools_table">' + 
				'<tr>' + 
					'<td class="play_td js-music_play" data-gp="1" data-noclass="1">' + 
						'<div class="p_i_t_playButton">' + 
							'<i class="ico_player p_i_t_pb_image"></i>' + 
						'</div>' + 
					'</td>' + 
					'<td class="gp-nav_buttons gp-desktop_show">' + 
						'<a href="#" class="js-music_prev m"><span class="ico_player ico_player_prev m" title="' + L('Предыдущая') + '"></span></a> ' +
						'<a href="#" class="js-music_next m"><span class="ico_player ico_player_next m" title="' + L('Следующая') + '"></span></a>' +
					'</td>' + 
					'<td class="right_text">' + 
						'<table class="tools_table player_tools_table">' + 
							'<tr>' + 
								'<td class="player-head_info">' + 
									'<span class="js-music_ct right"></span>' + 
									'<span class="js-music_tt right">' + data.duration + '</span>' + 
									'<div class="no_word_break">' + 
										'<b class="js-music_artist"></b><span class="js-music_sep"> - </span><span class="js-music_title"></span>' + 
									'</div>' + 
								'</td>' + 
							'</tr>' + 
							'<tr>' + 
								'<table class="tools_table"><tr>' + 
									'<td>' + 
										'<div class="p_i_progress oh" data-change="position">' + 
											'<div class="p_i_p_lines_bg p_i_p_lines p_i_p_lines_pg_bg"></div>' + 
											'<div class="p_i_p_loadLine p_i_p_lines js-music_loadline"></div>' + 
											'<div class="p_i_p_progressLine p_i_p_lines js-music_timeline"></div>' + 
										'</div>' + 
									'</td>' + 
									
									'<td class="volume_td gp-volume">' + 
										'<div class="p_i_progress oh" data-change="volume">' + 
											'<div class="p_i_p_lines_bg p_i_p_lines"></div>' + 
											'<div class="p_i_p_progressLine p_i_p_lines js-music_vol"></div>' + 
										'</div>' + 
									'</td>' + 
									
									'<td class="ico_td">' + 
										'<a href="#" class="tdn js-music_add" title="' + L("Добавить к себе") + '">' + 
											'<span class="ico ico_plus_darkblue js-ico"></span>' + 
										'</a>' + 
									'</td>' + 
									
									'<td class="ico_td">' + 
										'<a href="#" class="tdn js-music_repeat" title="' + L("Повторять эту композицию") + '">' + 
											'<span class="ico js-ico"></span>' + 
										'</a>' + 
									'</td>' + 
								'</tr></table>' + 
							'</tr>' + 
						'</table>' + 
					'</td>' + 
				'</tr>' + 
			'</table>';
		return html;
	},
	playerInlineError: function (text) {
		return '<div class="js-music_error red t_center">' + text + '</div>';
	}
};

var MusicPlayer = {
	init: function () {
		var self = this;
		
		if (delayed_populate_timeout) {
			clearTimeout(delayed_populate_timeout);
			delayed_populate_timeout = null;
		}
		self.reset();
		
		if (Device.type != 'desktop' && page_loader.ok()) {
			page_loader.onJSC('music', function (jsc_params) {
				var el = $('#gp');
				!el.length ? page_loader.setJSC(false) : el.click();
			});
			page_loader.on('requestend', "music", function () {
				tick(function () {
					DdMenu.close("gp_window");
				});
			}, {persistOnRequest: true});
			page_loader.on('mailrequestend', "music", function () {
				tick(function () {
					DdMenu.close("gp_window");
				});
			}, {persistOnRequest: true});
		}
		
		if (initialized)
			return;
		
		if (android_app_player()) {
			SpacesApp.on('musicPlay', function (uniq_id, track_n) {
				if (!page_tmp_playlist || page_tmp_playlist.uniqId() != uniq_id) {
					self.stop();
					return;
				}
				
				var sorted_list = page_tmp_playlist.getSortedList();
				if (!sorted_list[track_n]) {
					self.stop();
					return;
				}
				
				var pid = sorted_list[track_n].index;
				if (self.isSame(pid, false)) {
					self.play(true);
				} else {
					self.switchTrack(pid, {
						newPlayList: true,
						autoScroll: false
					});
				}
			}).on('musicPause', function (uniq_id, track_n) {
				if (!current || !playlist || playlist.uniqId() != uniq_id)
					return;
				
				self.play(false, true);
			}).on('musicTimeUpdate', function (uniq_id, track_n, offset, duration) {
				if (!current || !playlist || playlist.uniqId() != uniq_id)
					return;
				
				if (current.duration != duration)
					self.provideRealDuration(duration);
				self.providePosition(offset, duration);
			}).on('musicBuffer', function (uniq_id, track_n, buffered) {
				if (!current || !playlist || playlist.uniqId() != uniq_id)
					return;
				
				self.provideBuffer(buffered);
			}).on('musicLoadStart', function (uniq_id, track_n) {
				if (!current || !playlist || playlist.uniqId() != uniq_id)
					return;
				
				self.trackLoading(true);
			}).on('musicLoadEnd', function (uniq_id, track_n) {
				if (!current || !playlist || playlist.uniqId() != uniq_id)
					return;
				
				self.trackLoading(false);
			}).on('musicStop', function (uniq_id, track_n) {
				if (!current || !playlist || playlist.uniqId() != uniq_id)
					return;
				
				self.stop();
			});
		}
		
		self.setDeviceClass(self.getRenderMode());
		use_native_scroll = Device.type == 'desktop';
		
		initialized = true;
		
		$('body').on('spUpdatePart', function (e, parts) {
			if (parts[Spaces.WIDGETS.SIDEBAR] && !render_mode.flying_btn)
				self.switchRenderMode(false, true);
		});
		// #main_wrap ниже body, плееру нужен приоритет
		$('#main_wrap')
		.on('click', '.js-music_repeat', function (e) {
			e.preventDefault(); e.stopPropagation();
			e.stopImmediatePropagation();
			
			self.repeat = !self.repeat;
			self.updateGP({playState: true});
		})
		.on('click', '.js-music_add', function (e) {
			e.preventDefault(); e.stopPropagation();
			e.stopImmediatePropagation();
			var el = $(this),
				data = el.data(),
				wrap = el.parents('.player_item'),
				n = wrap.data("n");
			
			var track;
			if (wrap.prop("id") == 'gp_main_player') {
				track = playlist && playlist.get(n);
			} else {
				track = page_tmp_playlist.get(n);
				if (!track || track.el != wrap.prop("id")) {
					track = playlist && playlist.get(n);
					if (track && track.el != wrap.prop("id"))
						track = false;
				}
			}
			
			if (!track)
				return;
			
			var do_save = !(track.saved && track.saved.state);
			
			if (!Spaces.params.nid) {
				self.showError(wrap, Spaces.view.onlyAuthMotivator());
				return;
			}
			
			track.saved = track.saved || {state: 0};
			
			if (track.saved.state == 2)
				return;
			track.saved.state = 2;
			
			var update_state = function () {
				$('#' + track.el).find('.js-ico').prop("className", classes.copy2me[track.saved.state]);
				self.updateGP({track: true});
			};
			
			var api_method, api_data;
			if (do_save) {
				api_method = "files.copy2me";
				if (track.copy2me) {
					api_data = (new Url(track.copy2me)).query;
				} else {
					api_data = {File_id: track.nid, Bias: track.bias, CK: null};
				}
			} else {
				api_method = "files.delete";
				api_data = {File_id: track.saved.nid, CK: null};
			}
			
			if (track.type != Spaces.TYPES.MUSIC)
				api_data.Ft = track.type;
			api_data.Type = Spaces.TYPES.MUSIC;
			
			update_state();
			
			Spaces.api(api_method, api_data, function (res) {
				data.disabled = false;
				if (!do_save && res.code == Codes.FILES.ERR_DIR_ACCESS_DENIED) // костыль!
					return;
				
				track.saved.state = do_save ? 1 : 0;
				update_state();
				
				if (res.code == 0 || res.fileId) {
					if (res.fileId)
						track.saved.nid = +res.fileId;
				} else {
					self.showError(wrap, Spaces.apiError(res));
				}
			}, {
				onError: function (err) {
					track.saved.state = 0;
					update_state();
					self.showError(wrap, err);
				}
			});
		}).on('click', '.js-music_gp', function (e) {
			e.preventDefault(); e.stopPropagation();
			e.stopImmediatePropagation();
			self.play(!current.playing);
		}).on('click', '.player_item', function (e) {
			if (!$.contains(this, e.target)) {
				e.preventDefault(); e.stopPropagation();
				e.stopImmediatePropagation();
			}
		}).on('click', '.js-music_play', function (e) {
			e.preventDefault(); e.stopPropagation();
			e.stopImmediatePropagation();
			
			var el = $(this),
				track_id = el.data("n"),
				is_gp = track_id !== undefined || el.parents('.player_item').hasClass('js-music_mp'),
				pid = track_id !== undefined ? track_id : self.getTrackId(el);
			
			if (android_app_player()) {
				var index = page_tmp_playlist.getSortedIndex(pid);
				SpacesApp.exec(self.isSame(pid, false) && current.playing ? 'pause' : 'play', {
					track:		index,
					uniqId:		page_tmp_playlist.uniqId()
				});
				
				return;
			}
			
			if (self.isSame(pid, is_gp)) {
				self.play(!current.playing);
			} else {
				self.switchTrack(pid, {
					newPlayList: !is_gp,
					autoScroll: false
				});
			}
		}).on('click', '.js-music_pl_play', function (e) {
			e.preventDefault(); e.stopPropagation();
			e.stopImmediatePropagation();
			var pid = $(this).data("n");
			if (self.isSame(pid, true)) {
				self.play(!current.playing);
			} else {
				self.switchTrack(pid, {
					newPlayList: false,
					autoScroll: false
				});
			}
		}).on('click', '.js-music_prev, .js-music_next', function (e) {
			e.preventDefault(); e.stopPropagation();
			e.stopImmediatePropagation();
			self.move($(this).hasClass('js-music_prev') ? -1 : 1);
		}).on('click', '.p_i_progress', function (e) {
			e.preventDefault();
			
			var el = $(this),
				pid = self.getTrackId(el),
				is_gp = el.parents('.player_item').hasClass('js-music_mp');
			
			if (el.data('change') != 'position')
				return;
			
			if (!self.isSame(pid, is_gp))
				self.switchTrack(pid, {newPlayList: !is_gp, autoScroll: true});
		}).on('progressStart', function (e, value, is_touch) {
			var el = $(e.target),
				pid = self.getTrackId(el),
				is_gp = el.parents('.player_item').hasClass('js-music_mp');
			
			var change = $(e.target).data('change');
			if (!self.isSame(pid, is_gp) && change != 'volume') {
				return false;
				/* if (!e.isTouch) {
					self.switchTrack(pid, {newPlayList: !is_gp, autoScroll: true});
					if (el.data('change') != 'volume')
						return false;
				} else {
					return false;
				} */
			}

			if (change != 'volume')
				no_update_timeline = true;
		}).on('progressChange', function (e, value) {
			var change = $(e.target).data('change');
			if (change == 'position') {
				self.setPosition(value, true);
			} else if (change == 'volume') {
				self.volume(value);
			}
		}).on('progressEnd', function (e, value) {
			var change = $(e.target).data('change');
			
			if (e.lieMove)
				return;
			
			if (change == 'position') {
				self.setPosition(value);
			} else if (change == 'volume') {
				self.volume(value);
			}

			no_update_timeline = false;
		}).progressControl('.p_i_progress', {
			pointer: false
		});
		
		if (run_delayed_populate)
			self.delayedPopulate();
		
		page_loader.on('shutdown', 'gp', function () {
			if (current && !current.playing) {
				// Если плеер на паузе и юзер переходит на другую стр - удаляем GP
				self.stop();
				self.destroyGP();
			}
		}, true);
		
		if (!android_app_player()) {
			var state = self.getState();
			if (state) {
				// Запускаем только если предыдущий таб умер
				// sessionStorage шарится на все табы, что открыты через target="_blank" =(
				notifications.isAliveTab(state.tab, function (alive) {
					if (!alive) {
						var pl_class = PLAYLISTS[state.type];
						playlist = new pl_class();
						playlist.restore(state.playlist);
						// self.play(false, true);
						
						self.repeat = state.repeat;
						
						self.switchTrack(state.id, {newPlayList: false, autoScroll: true, position: state.offset,
							noplay: true});
					}
					self.bindExists();
				});
			}
		}
		
		// API для AdvMusic
		window.SpacesMusicPlayer = window.SpacesMusicPlayer || {};
		$.extend(window.SpacesMusicPlayer, {
			play() {
				if (current && !current.playing)
					self.play(true);
			},
			
			pause() {
				if (current && current.playing)
					self.play(false);
			},
			
			isPlaying() {
				return current && current.playing;
			},
			
			isStopped() {
				return !!current;
			}
		});
		
		this.triggerEx('ready');
	},
	
	delayedPopulate: function () {
		if (!initialized) {
			run_delayed_populate = true;
			return;
		}
		MusicPlayer.populate();
	},
	
	populate: function () {
		var self = this, volume = self.volume();
		var players = $('body').find('.player_item'),
			changed = 0,
			now = Date.now();
		
		var detached;
		if (page_tmp_playlist == playlist)
			detached = page_tmp_playlist.getDetached();
		
		var last_inited_player, patches = [];
		for (var i = 0, l = players.length; i < l; ++i) {
			var p = players[i],
				inited = p.player_inited;
			
			if (inited) {
				last_inited_player = p;
				continue;
			}
			
			var track = {
				el: 'pl_' + (++PL_ID) + '_' + now,
				src: p.getAttribute('data-src'),
				nid: p.getAttribute('data-nid'),
				type: p.getAttribute('data-type'),
				artist: p.getAttribute('data-artist'),
				title: p.getAttribute('data-title'),
				duration: p.getAttribute('data-duration'),
				durationValue: p.getAttribute('data-duration-value'),
				bias: !!p.getAttribute('data-bias'),
				cover: p.getAttribute('data-cover'),
				my: !!p.getAttribute('data-my'),
				copy2me: p.getAttribute('data-copy2me')
			};
			
			if (!track.src)
				continue;
			
			var insert_at_pos;
			if (!inited && page_tmp_playlist == playlist) {
				// Просто заменяем ранее удалённый трек
				var old_p = detached && detached[track.nid + ':' + track.type];
				if (old_p) {
					p.id = old_p.el;
					p.player_inited = true;
					p.player_track = old_p.index;
					p.setAttribute('data-n', old_p.index);
					
					last_inited_player = p;
					
					if (current.index == old_p.index)
						self.updateView();
					
					continue;
				}
				// Добавляем в подгруженный список
				else if (last_inited_player) {
					insert_at_pos = page_tmp_playlist.getSortedIndex(last_inited_player.player_track) + 1;
				}
			}
			
			++changed;
			
			if (!track.artist && !track.title)
				_get_track_id3(track, p.getAttribute('data-name'));
			
			var index = page_tmp_playlist.add(track, insert_at_pos);
			p.setAttribute('data-n', index);
			p.id = track.el;
			p.player_inited = true;
			p.player_track = index;
			
			patches.push(index);
			
			last_inited_player = p;
		}
		
		tick(function () {
			if (changed > 0) {
				if (gp_state.gp_menu_open) {
					self.updateGP({
						playlist: true
					});
				} else {
					// Обновим плейлист после открытия GP
					gp_state.need_update_playlist = true;
				}
			}
			
			var last_tmp = page_tmp_playlist;
			
			self.volume(self.volume());
			self.bindExists(function () {
				if (android_app_player()) {
					if (page_tmp_playlist === playlist && page_tmp_playlist === last_tmp && patches.length) {
						var list = page_tmp_playlist._plSave();
						patches = patches.sort(function (a, b) {
							return a - b;
						});
						for (var i = 0; i < patches.length; ++i) {
							SpacesApp.exec('playlistInsert', {
								at:		patches[i],
								track:	list[patches[i]]
							});
						}
					} else if (page_tmp_playlist !== playlist) {
						SpacesApp.exec('playlist', {
							playlist:		page_tmp_playlist._plSave(),
							type:			page_tmp_playlist.TYPE,
							options:		page_tmp_playlist.getAppData(),
							uniqId:			page_tmp_playlist.uniqId()
						});
					}
				}
			});
		});
		
		return self;
	},
	
	// Метод, который сложной магией костылей и велосипедов биндит текущий плэйлист к плэйлисту на странице
	// (Ищет текущий плейлсит внутри играющего)
	bindExists: function (done_callback) {
		var self = this;
		
		if (page_tmp_playlist == playlist) {
			done_callback && done_callback();
			return;
		}
		
		if (!same_find && playlist && playlist.TYPE == page_tmp_playlist.TYPE && page_tmp_playlist.addr() == playlist.addr()) {
			var old_playlist = playlist.getSortedList(),
				new_playlist = page_tmp_playlist.getSortedList();
			
			if (!new_playlist.length || !old_playlist.length) {
				done_callback && done_callback();
				return;
			}
			
			var first = new_playlist[0], is_same = false, same_offset = 0;
			for (var i = 0, l = old_playlist.length; i < l; ++i) {
				var item = old_playlist[i];
				if (item.type == first.type && first.nid == item.nid) {
					if (i + new_playlist.length <= old_playlist.length) {
						is_same = true;
						same_offset = i;
						for (var j = 0, ll = new_playlist.length; j < ll; ++j) {
							var new_item = new_playlist[j],
								item = old_playlist[i + j];
							if (item.type != new_item.type || new_item.nid != item.nid) {
								is_same = false;
								break;
							}
						}
					}
					break;
				}
			}
			
			if (is_same) {
				tick(function () {
					for (var j = 0, l = new_playlist.length; j < l; ++j) {
						old_playlist[same_offset + j].el = new_playlist[j].el;
						$('#' + new_playlist[j].el).attr('data-n', old_playlist[same_offset + j].index);
					}
					page_tmp_playlist.destroy();
					page_tmp_playlist = playlist;
					if (current) {
						current.gp = false;
						self.updateView();
						self.bindGP();
						if (current.duration)
							self.providePosition(current.position, current.duration);
						if (current.buffer)
							self.provideBuffer(current.buffered);
					}
					done_callback && done_callback();
				});
			} else {
				done_callback && done_callback();
			}
			if (gp_state.gp_menu_open) {
				self.updateGP({
					playlist: true,
					saveScroll: true
				});
			}
			same_find = true;
		} else {
			done_callback && done_callback();
		}
	},
	
	reset: function () {
		// Сбрасываем временный плейлист
		if (page_tmp_playlist && page_tmp_playlist != playlist)
			page_tmp_playlist.destroy();
		page_tmp_playlist = null;
		
		// Ищем API-параметры для плейлиста
		var player_params = $('#player_params'),
			api_data = player_params.data("params"),
			api_prefix = player_params.data("prefix") || "files";
		if (api_data) {
			var pgn = $('.pgn').first(),
				on_page = pgn.data("on_page") || $('.js-file_item').length,
				cur = pgn.data("page") || 1,
				offset = on_page * (cur - 1);
			
			if (!pgn.length && player_params.data('noPagination')) {
				page_tmp_playlist = new ApiPlayList({
					data:	api_data,
					prefix:	api_prefix,
					offset:	0,
					limit:	20
				});
			} else if (pgn.data("hasNext")) {
				if (pgn.data("numbered")) {
					page_tmp_playlist = new ApiPlayList({
						data:	api_data,
						prefix:	api_prefix,
						offset:	offset,
						limit:	on_page
					});
				} else {
					var param = pgn.data("param");
					api_data[param] = pgn.data("page") + 1;
					page_tmp_playlist = new ApiPlayList({
						data:		api_data,
						prefix:		api_prefix,
						pageParam:	param
					});
				}
			}
		}
		
		if (!page_tmp_playlist)
			page_tmp_playlist = new ConstPlayList();
	},
	
	// Получить номер трека по вложенному элементу
	getTrackId: function (el) {
		return (el.hasClass('player_item') ? el : el.parents('.player_item'))
			.data("n");
	},
	
	// Переключить трэк
	switchTrack: function (id, opts) {
		var self = this;
		
		opts = $.extend({
			newPlayList: false,
			autoScroll: true
		}, opts);
		
		self.stop();
		
		if (opts.newPlayList && playlist != page_tmp_playlist)
			self.syncPlayList();
		
		var handler = function () {
			var player = playlist.get(id);
			
			if (current)
				self.trackLoading(false);
			
			current = {
				index: id,
				el: $('#' + player.el),
				id: player.nid + ':' + player.type,
				playing: false,
				loaded: false,
				loading: !android_app_player(),
				progress: 0,
				position: 0, lastPosition: 0
			};
			
			current.el.find('.js-music_error').remove();
			
			if (!android_app_player()) {
				self.unsupportedError();
				
				self.saveState();
				
				self.sound(function () {
					sound.load(player.src);
				});
				
				if (playlist.avail()) {
					if (current.index * 100 / playlist.loaded() >= 70)
						self.loadNextPage();
				}
			}
			
			self.updateView();
			self.updateGP({
				track: true,
				saveScroll: !opts.autoScroll
			});
			
			if (opts.position)
				self.setPosition(opts.position);
			
			if (android_app_player()) {
				if (!opts.noplay)
					self.play();
			} else {
				if (!opts.noplay) {
					self.play();
				} else {
					// Костыль. Иначе слетает буфферизация. 
					self.play(true);
					self.play(false);
				}
			}
		};
		
		if (android_app_player()) {
			tick(handler);
		} else {
			if (playlist.avail() && !playlist.avail(id)) {
				playlist.loadChunk(function () {
					handler();
				});
			} else {
				tick(handler);
			}
		}
	},
	
	updateView: function () {
		var self = this, player = playlist.get(current.index);
		current.el = $('#' + player.el);
		current.view = self.findPlayerView(current.el);
		
		current.view.duration.hide();
		current.view.time.html(self.formatTime(current.position)).show();
		
		current.view.artist.text(player.artist);
		current.view.title.text(player.title);
		current.view.sep.toggle(!!player.title);
		
		self._playState();
		self.trackLoading(current.loading);
	},
	
	// Синхронизация временного и постоянного плейлистов
	syncPlayList: function () {
		var self = this;
		if (playlist)
			playlist.destroy();
		playlist = page_tmp_playlist;
		self.renderPlayList();
	},
	
	isSame: function (pid, is_gp) {
		return current && pid == current.index && (is_gp || playlist == page_tmp_playlist);
	},
	
	findPlayerView: function (el) {
		return {
			duration: el.find('.js-music_tt'),
			time: el.find('.js-music_ct'),
			play: el.find('.js-music_play'),
			timeline: el.find('.js-music_timeline'),
			loadline: el.find('.js-music_loadline'),
			artist: el.find('.js-music_artist'),
			title: el.find('.js-music_title'),
			sep: el.find('.js-music_sep')
		};
	},
	
	// play
	play: function (v, no_api_call) {
		var self = this;
		if (v === undefined)
			v = true;
		if (current) {
			var changed = current.playing != v;
			
			current.playing = v;
			self._playState();
			
			self.updateGP({playState: true});
			
			if (!android_app_player()) {
				if (!no_api_call) {
					self.sound(function (sound) {
						if (v)
							sound.setVolume(self.volume());
						v ? sound.play() : sound.pause();
						self.saveState(true);
					});
				} else {
					self.saveState(true);
				}
			}
			
			if (changed) {
				if (!v) {
					IPCSingleton.instance('cp').stop('music');
				} else {
					IPCSingleton.instance('cp').start(function () {
						self.play(false);
					}, 'music');
				}
				
				if (current.playing) {
					this.triggerEx('play');
				} else {
					this.triggerEx('pause');
				}
			}
		}
	},
	
	_playState: function () {
		var self = this;
		current.el.toggleClass('playing', current.playing);
	},
	
	// stop
	stop: function () {
		var self = this;
		IPCSingleton.instance('cp').stop('music');
		if (current) {
			self.play(false);
			
			if (!android_app_player()) {
				self.sound(function () {
					sound.stop();
				});
			}
			
			var v = current.view;
			v.duration.show(); v.time.hide();
			v.timeline.css("width", "0%");
			v.loadline.css("width", "0%");
		}
		
		this.triggerEx('stop');
	},
	
	// Переключить трек, -1 назад, +1 вперёд
	move: function (dir) {
		var self = this;
		if (current) {
			if (playlist.loaded() > 1) {
				self.switchTrack(playlist.getNeighbor(current.index, dir));
			} else {
				self.stop();
			}
		}
	},
	
	// Перемотка в процентах
	setPosition: function (v, no_update) {
		var self = this;
		
		v = Math.min(Math.max(0, v), 100);
		if (current) {
			if (!no_update) {
				if (!current.duration) {
					current.progress = v;
				} else {
					if (android_app_player()) {
						SpacesApp.exec('rewind', {
							offset:		current.duration / 100 * v,
							uniqId:		page_tmp_playlist.uniqId()
						});
					} else {
						self.sound(function () {
							sound.setPosition(current.duration / 100 * v);
							rewind_stop_update_timeline = true;
							
							setTimeout(function () {
								rewind_stop_update_timeline = false;
							}, 1000);
						});
					}
				}
			}
			if (current.duration) {
				var new_pos = (current.duration / 100 * v);
				if (no_update_timeline)
					current.position = new_pos;
				current.view.time.html(self.formatTime(new_pos));
			}
			current.view.timeline.css("width", v + '%');
		}
	},
	
	// Ацессор громкости
	volume: function (vol) {
		var self = this, setter = vol !== undefined;
		
		var volume;
		if (Device.type != 'desktop') {
			volume = 100;
		} else if (Spaces.LocalStorage.support()) {
			if (setter)
				Spaces.LocalStorage.set("volume", vol);
			volume = Spaces.LocalStorage.get("volume", 100);
		} else {
			if (setter)
				self._player_volume = vol;
			if (self._player_volume === undefined)
				self._player_volume = 100;
			volume = self._player_volume;
		}
		
		if (setter)
			self.updateVolume();
		return volume;
	},
	
	updateVolume: function (el) {
		if (android_app_player())
			return;
		
		var self = this, volume = self.volume();
		if (Device.type == 'desktop') {
			el = el ? el.find('.js-music_vol') : $('.js-music_vol');
			el.css("width", volume + "%");
		}
		if (current) {
			self.sound(function () {
				sound.setVolume(volume);
			});
		}
	},
	
	// Прибиндить GP к текущему плееру
	bindGP: function () {
		var self = this;
		if (current && !current.gp) {
			current.gp = true;
			
			var track = playlist.get(current.index),
				v = current.view, v2 = self.findPlayerView($('#gp_main_player'));
			
			v2.time.toggle(v.time.css('display') != 'none');
			v2.time.text(v.time.text());
			
			v2.duration.toggle(v.duration.css('display') != 'none');
			v2.duration.text(v.duration.text());
			
			v2.timeline.css("width", v.timeline.css('width'));
			v2.loadline.css("width", v.loadline.css('width'));
			v2.artist.text(track.artist);
			v2.sep.toggle(!!track.title);
			v2.title.text(track.title);
			
			for (var k in v2)
				v[k] = v[k].add(v2[k]);
		}
	},
	
	setDeviceClass: function (mode, flying) {
		var self = this, body = $('body'),
			use_flying_btn = self.canFlyingBtn(mode);
		
		if (mode !== render_mode.dev) {
			body.toggleClass('gp-device_desktop', mode == 'desktop') // Полный режим
				.toggleClass('gp-device_mobile', mode == 'mobile')
				.toggleClass('gp-hide_volume', Device.type != 'desktop')
				.toggleClass('gp-show_volume', Device.type == 'desktop');
			if (use_native_scroll) // Использовать глобальный скролл, вместо overflow: scroll
				body.addClass('gp-native_scroll');
		}
		
		if (use_flying_btn !== render_mode.flying_btn) {
			body
				.toggleClass('gp-right_btn', use_flying_btn) // Кнопка плеера плавает справа
				.toggleClass('gp-left_btn', !use_flying_btn); // Кнопка плеера слева в панельке
		}
	},
	
	canFlyingBtn: function (mode) {
		mode = mode || render_mode.dev;
		
		var min_width = $('#rightbar').length ? 1500 : 1300;
		return mode == 'desktop' && $(window).width() >= min_width && !cookie.get('gp_left_btn');
	},
	
	fixScrollPL: function () {
		var gp_playlist = $('#gp_playlist').css("height", "");
		if (render_mode.dev == 'mobile' && use_native_scroll) {
			var parent = gp_playlist.parents('.js-ddmenu_content');
			if (parent.offset()) {
				gp_playlist.css("height", parent.offset().top + parent.height() - gp_playlist.offset().top -
					$('#gp_bottom_tools').outerHeight());
			}
		}
		
		if (render_mode.dev == 'desktop') {
			var new_height, style = gp_playlist.prop("style"),
				gp_window = $('#gp_window');
			if (render_mode.flying_btn) {
				var offset_y = parseInt(gp_window.prop("style").top || 0),
					padding = gp_window.outerHeight(true) - gp_playlist.height();
				new_height = Math.min(400, $(window).innerHeight() - (offset_y + padding)) + "px";
			} else {
				var offset_y = gp_window.offset().top,
					padding = gp_window.outerHeight() - gp_playlist.height();
				new_height = Math.min(400, $(window).innerHeight() - (offset_y + padding)) + "px";
			}
			if (style.height != new_height)
				style.height = new_height;
		}
	},
	
	getRenderMode: function () {
		// Если десктоп с w < 900, то показываем ему мобильную версию
		return Device.type == 'desktop' && $(window).width() >= 900 ? 'desktop' : 'mobile';
	},
	
	switchRenderMode: function (resize_event, force) {
		var self = this,
			wrap_all = $('#wrap_all');
		
		if (!$global_player)
			return;
		
		var tmp_device = self.getRenderMode(),
			tmp_can_flying_btn = self.canFlyingBtn(tmp_device),
			real_device_changed = (render_mode.dev != tmp_device || 
				tmp_can_flying_btn != render_mode.flying_btn),
			device_changed = force || real_device_changed;
		
		if (!resize_event || device_changed) {
			if (DdMenu.isOpen("gp_window")) {
				DdMenu.close();
				setTimeout(function () {
					self.switchRenderMode();
				}, 0);
				return;
			}
			
			if (device_changed) {
				if (render_mode.dev) {
					if (render_mode.dev === 'desktop') {
						$global_player.offset({left: ''});
					} else {
						$('#wrap_all').removeClass('hide');
					}
				}
				
				$global_player.css({left: '', position: ''});
				self.setDeviceClass(tmp_device);
				
				$global_player.data({
					position: tmp_device == 'desktop' ? (tmp_can_flying_btn ? "top" : "abs_val") : 
						(use_native_scroll ? "page_top" : "fullpage_top"),
					position_method: tmp_device == 'desktop' ? 'fixed' : '',
					position_top_val: $('#navi').outerHeight()
				});
				
				// Окно плеера
				if (tmp_device == 'desktop') {
					Spaces.view.pushWidget($global_player_win, true);
				} else {
					$global_player_win.insertAfter(wrap_all);
				}
				
				// Кнопка плеера
				if (tmp_can_flying_btn) {
					$('#main_wrap').append($global_player);
					$('#sidebar_player').addClass('hide');
				} else {
					$('#sidebar_player').append($global_player).removeClass('hide');
				}
				$global_player.show();
				
				render_mode.dev = tmp_device;
				render_mode.flying_btn = tmp_can_flying_btn;
				
				self.fixScrollPL();
			}
		}
		
		if (render_mode.dev == 'desktop') {
			if ($global_player && render_mode.flying_btn) {
				$global_player.offset({
					left: wrap_all.offset().left + wrap_all.outerWidth()
				});
			}
		}
		self.fixScrollPL();
	},
	
	// Сохранить состояние плеера в sessionStorage
	saveState: function (only_track) {
		var self = this;
		
		if (self.unsupported)
			return;
		
		if (has_session_storage) {
			window.sessionStorage['music:track'] = JSON.stringify({
				id: current.index,
				offset: current.position / current.duration * 100,
				playing: current.playing,
				tab: notifications.getTabId(),
				time: Date.now(),
				repeat: self.repeat
			});
			if (!only_track) {
				window.sessionStorage['music:playlist'] = JSON.stringify({
					playlist: playlist.serialize(),
					type: playlist.TYPE,
					time: Date.now()
				});
				Spaces.persistModules('music');
			}
		}
	},
	
	// Получить состояние плеера в sessionStorage
	getState: function (only_track) {
		var self = this;
		if (has_session_storage) {
			var track = window.sessionStorage['music:track'],
				playlist = window.sessionStorage['music:playlist'];
			if (track && playlist) {
				track = JSON.parse(track);
				playlist = JSON.parse(playlist);
				
				// Не восстанавливаем плейлист, если он старше 30 минут (иначе ссылки битые!)
				if (Date.now() - Math.min(track.time, track.playlist) > 30 * 60 * 1000)
					return null;
				if (!track.playing) // Если пауза, то не пытаемся восстановить
					return null;
				return $.extend(playlist, track);
			}
		}
		return null;
	},
	
	// Сбросить состояние плеера в sessionStorage
	resetState: function (only_track) {
		var self = this;
		if (has_session_storage) {
			delete window.sessionStorage['music:track'];
			delete window.sessionStorage['music:playlist'];
		}
	},
	
	// Обновить глобальный плеер
	updateGP: function (update) {
		var self = this,
			first_open = !$global_player;
		
		if (!playlist)
			return;
		
		// Отключаем глобальный плеер с Android
		if (android_app_player())
			return;
		
		update = $.extend({
			track: first_open, // Изменён трек
			playState: first_open, // Состояние play/pause
			playlist: first_open, // Плейлист
			saveScroll: false // Сохранить скролл
		}, update);
		
		var track = playlist.get(current.index),
			main_player = $('#gp_main_player');
		if (!$global_player) {
			var wrap_all = $('#wrap_all');
			
			$global_player = $(tpl.globalPlayerButton());
			$global_player_win = $(tpl.globalPlayerWindow());
			self.switchRenderMode();
			
			$global_player_win.on('dd_menu_open', function () {
				if (render_mode.dev == 'mobile') {
					last_scroll = $(window).scrollTop();
					$('html, body').scrollTop(0)
				}
				if (render_mode.dev == 'mobile')
					$('#wrap_all').addClass('hide');
				
				if (render_mode.dev == 'desktop' && !render_mode.flying_btn)
					$('html, body').scrollTop(0)
			}).on('dd_menu_opened', function () {
				gp_state.gp_menu_open = true;
				
				var $playlist = $('#gp_playlist')
				
				self.updateGP({
					playState: true,
					track: true,
					playlist: !!gp_state.need_update_playlist
				});
				gp_state.need_update_playlist = false;
				
				$global_player_win.find('.js-music_repeat')
					.parent()
					.toggleClass('hide', render_mode.dev != 'desktop' && self.repeat === undefined);
				
				if (render_mode.dev == 'mobile') {
					sidebar.toggle(false);
				}
				
				self.fixScrollPL();
				
				// Включаем глобальный скроллинг
				if (!use_native_scroll) {
					$playlist_scroll = $('#gp_playlist').
						scrollMonitor({up: 0, down: 0.8, mainScroll: true});
				}
				
				if (Device.type != 'desktop' && page_loader.ok())
					page_loader.setJSC('music', 0);
				
				if (playlist.avail() && !playlist.total()) {
					self.loadNextPage();
				}
				
				$(window).on('keydown.gp keyup.gp', function (e) {
					return self.gpKeysDispatcher(e);
				});
			}).on('dd_menu_closed', function () {
				gp_state.gp_menu_open = false;
				
				if (render_mode.dev == 'mobile')
					$('#wrap_all').removeClass('hide');
				
				// Отключаем глобальный скроллинг
				if (!use_native_scroll) {
					$('#gp_playlist').scrollMonitor(false);
					$playlist_scroll = null;
				}
				
				if (Device.type != 'desktop' && page_loader.ok() && page_loader.isJSC())
					window.history.back();
				
				$(window).off('keydown.gp keyup.gp');
				
				if (render_mode.dev == 'mobile')
					$('html, body').scrollTop(last_scroll);
			}).on('mouseenter mouseleave', '.js-music_pl_play', function(e) {
				self.highlightItem(e.type == "mouseleave" ? undefined : $(this));
			});
			
			main_player = $('#gp_main_player').html(tpl.playerItem({
				duration: track.duration,
				mainPlayer: true,
				track: track
			})).show();
			self.updateVolume();
			
			var gp_playlist = $('#gp_playlist');
			if (use_native_scroll) {
				gp_playlist.scrollMonitor({up: 0, down: 0.8}).mousewheel();
				$playlist_scroll = gp_playlist;
			}
			
			gp_playlist.on("scrollEnd", function (e) {
				if (playlist.avail()) 
					self.loadNextPage();
			});
			self.renderPlayList();
			
			$(window).on('resize.gp_window orientationchange.gp_window', function () {
				tick(function () {
					self.switchRenderMode(true);
				});
			});
		}
		
		if (update.playlist) {
			self.renderPlayList();
			update.track = true;
		}
		
		var gp_playlist = $('#gp_playlist');
		if (update.track) {
			// Задаём в глобальный плеер трек и обновляем кнопку плей
			$('#gp_artist').text(track.artist);
			$('#gp_title').text(track.title);
			
			// Убираем выделение с предыдущего трека
			var active = gp_playlist.find('.' + classes.playlist.active);
			if (active.length) {
				active.removeClass(classes.playlist.active)
					.find('.js-music_pl_icon')
					.removeClass(classes.ico.pause)
					.addClass(classes.ico.play);
			}
			
			if (!update.saveScroll) {
				var active = $(gp_playlist.children()[playlist.getSortedIndex(current.index)]);
				gp_playlist.scrollTo(active, {position: "center"});
			}
			
			if ($global_player_win) {
				var music_add = $global_player_win.find('.js-music_add');
				music_add.parents('td').first().toggle(track.type == Spaces.TYPES.MUSIC && !track.my);
				music_add.find('.js-ico').prop("className", classes.copy2me[(track.saved && track.saved.state) || 0]);
			}
			
			self.showError(false);
		}
		
		if (update.playState || update.track) {
			// Выделяем текущий трек в списке
			var active = $(gp_playlist.children()[playlist.getSortedIndex(current.index)]);
			active.addClass(classes.playlist.active)
				.find('.js-music_pl_icon')
				.toggleClass(classes.ico.play, !current.playing)
				.toggleClass(classes.ico.pause, current.playing);
			
			$global_player_win.find('.js-music_repeat .js-ico')
				.toggleClass(classes.ico.repeat_off, !self.repeat)
				.toggleClass(classes.ico.repeat_on, !!self.repeat);
		}
		
		if (update.playState) {
			main_player.toggleClass('playing', current.playing)
				.data("n", current.index);
			self.trackLoading(current.loading);
			$('#gp_icon')
				.toggleClass(classes.ico.play, !current.playing)
				.toggleClass(classes.ico.pause, current.playing);
		}
		
		// Биндим глобальный плеер к текущему
		self.bindGP();
	},
	
	gpKeysDispatcher: function (e) {
		var self = this,
			key = e.keyCode, keydown = (e.type == "keydown");
		if ($playlist_scroll && playlist) {
			if (keydown) {
				if (key == Spaces.KEYS.HOME || key == Spaces.KEYS.END) {
					var $playlist = $('#gp_playlist').children();
					var method = key == Spaces.KEYS.END ? "last" : "first";
					$playlist_scroll.scrollTo($playlist[method]());
					return false;
				} else if (key == Spaces.KEYS.PGUP || key == Spaces.KEYS.PGDOWN) {
					var polarity = key == Spaces.KEYS.PGUP ? -0.5 : 0.5;
					$playlist_scroll.scrollTop($playlist_scroll.scrollTop() + $playlist_scroll.innerHeight() * polarity);
					return false;
				} else if (key == Spaces.KEYS.UP || key == Spaces.KEYS.DOWN) {
					var list = $('#gp_playlist'),
						items = list.children(),
						active = list.find('.' + classes.playlist.hover),
						dir = key == Spaces.KEYS.UP ? -1 : 1;
					
					if (!active.length)
						active = list.find('.' + classes.playlist.active);
					
					var current_item;
					if (!active.length) {
						current_item = dir > 0 ? items.first() : items.last();
					} else {
						var index = active.index();
						if (dir > 0) {
							// вниз
							index = index + 1 < items.length ? index + 1 : 0;
						} else {
							// вверх
							index = index - 1 >= 0 ? index - 1 : items.length - 1;
						}
						current_item = $(items[index]);
					}
					
					if (current_item[0] != active[0]) {
						self.highlightItem(current_item);
						list.scrollTo(current_item, {
							position: "visible"
						});
					}
					return false;
				}
				
				if (key == Spaces.KEYS.ENTER || key == Spaces.KEYS.MAC_ENTER) {
					var active = $('#gp_playlist').find('.' + classes.playlist.hover);
					if (!active.length)
						active = list.find('.' + classes.playlist.active);
					if (active.length)
						active.click();
				}
			}
			
			if (key == Spaces.KEYS.LEFT || key == Spaces.KEYS.RIGHT) {
				if (keydown) {
					var polarity = key == Spaces.KEYS.LEFT ? -1 : 1;
					no_update_timeline = true;
					self.setPosition(((current.position + polarity * 10) / current.duration) * 100);
				} else {
					// Разрешаем обновлять таймлайн
					no_update_timeline = false;
				}
				return false;
			}
		}
		
	},
	
	highlightItem: function (el) {
		$('#gp_playlist').children().removeClass(classes.playlist.hover);
		if (el)
			el.addClass(classes.playlist.hover);
	},
	
	destroyGP: function () {
		var self = this;
		current  = null;
		gp_state = {};
		DdMenu.close("gp_window");
		$(window).off('.gp_window');
		$('#sidebar_player').addClass('hide');
		if ($global_player)
			$global_player.remove();
		if ($global_player_win)
			$global_player_win.remove();
		render_mode.dev = $global_player_win = $global_player = null;
		self.destroySound();
		self.resetState();
	},
	
	renderPlayList: function () {
		var self = this;
		// Заполняем плейлист
		var html = "",
			sorted_playlist = playlist.getSortedList();
		for (var i = 0; i < sorted_playlist.length; ++i)
			html += tpl.playlistItem(sorted_playlist[i]);
		
		var gp_playlist = $('#gp_playlist').html(html),
			active = gp_playlist.find('.' + classes.playlist.active);
		if (active.length) {
			active.removeClass(classes.playlist.active)
				.find('.js-music_pl_icon')
				.removeClass(classes.ico.pause)
				.addClass(classes.ico.play);
		}
	},
	
	// Подгрузка следующей страницы
	loadNextPage: function () {
		var self = this;
		if (playlist.avail() && !playlist.isLoading()) {
			$('#gp_playlist').append(tpl.listSpinner());
			playlist.loadChunk(function (success) {
				self.updateGP({
					playlist: true,
					saveScroll: true
				});
			});
		}
	},
	
	// provides
	providePosition: function (pos, total) {
		var self = this;
		if (current) {
			current.realPosition = pos;
			if (!no_update_timeline) {
				current.position = pos;
				
				if (!rewind_stop_update_timeline) {
					current.view.timeline.css("width", (pos * 100.0 / total).toFixed(2) + "%");
					current.view.time.html(self.formatTime(pos));
				}
				
				// Сохраняем состояние плейлиста
				if (Math.abs(current.lastPosition - current.position) > 2) {
					self.saveState(true);
					current.lastPosition = current.position;
				}
			}
		}
	},
	provideBuffer: function (pct) {
		if (current) {
			current.buffered = pct;
			current.view.loadline.css("width", (current.buffered * 100).toFixed(2) + "%");
		}
	},
	provideRealDuration: function (total) {
		var self = this;
		if (current && total) {
			current.duration = total;
			var saved = current.progress;
			if (saved) {
				current.progress = 0;
				self.setPosition(saved);
			}
		}
	},
	trackLoading: function (flag) {
		current.loading = !!flag;
		current.el.toggleClass('loading', current.loading);
		$('#gp_main_player').toggleClass('loading', current.loading);
	},

	showError: function (player, err) {
		$('.js-music_error').remove();
		if (err && player)
			player.append($(tpl.playerInlineError(err)));
	},
	
	unsupportedError: function () {
		var self = this;
		if (self.unsupported) {
			self.trackLoading(false);
			self.showError(current.el, L("Ваш браузер не поддерживает воспроизведение mp3."));
		}
	},
	
	sound: function (callback, only_if_inited) {
		var self = this;
		
		if (android_app_player())
			return;
		
		if (!init_triggered) {
			init_triggered = true;
			
			sound = new SpacesSound({
				autoLoad: true,
				onPlay: function () {
					self.play(true, true);
				},
				onPause: function () {
					self.play(false, true);
				},
				onEnded: function () {
					if (self.repeat) {
						self.setPosition(0);
						self.play();
					} else {
						self.move(1);
					}
				},
				onTimeUpdate: function () {
					if (current.duration != sound.duration)
						self.provideRealDuration(sound.duration);
					self.providePosition(sound.currentTime, sound.duration);
					current.loading && self.trackLoading(false);
				},
				onDurationChange: function () {
					self.provideRealDuration(sound.duration);
				},
				onLoadStart: function () {
					self.trackLoading(true);
				},
				onLoadEnd: function () {
					self.trackLoading(false);
				},
				onBuffer: function (e) {
					self.provideBuffer(sound.buffered);
				},
				onError: function (error) {
					self.showError(current.el, error);
					self.move(1);
				},
				onUnsupported: function () {
					self.unsupported = true;
					self.unsupportedError();
					self.resetState();
				}
			});
			sound.setVolume(self.volume());
		}
		if (callback && (!only_if_inited || sound))
			callback(sound);
		return sound;
	},
	
	playing: function () {
		return !!sound;
	},
	
	triggerEx: function (name) {
		name = 'on' + name.substr(0, 1).toUpperCase() + name.substr(1);
		if (window.SpacesMusicPlayer && window.SpacesMusicPlayer[name])
			tick(() => window.SpacesMusicPlayer[name]());
	},
	
	destroySound: function () {
		var self = this;
		self.sound(function () {
			sound.destroy();
			sound = null;
		});
		init_triggered = false;
	},
	
	// Отформатировать время в формате [hh:]mm:ss
	formatTime: function (time, full) {
		var h = Math.floor(time / 3600);
		time -= h * 3600;
		var m = Math.floor(time / 60),
			s = Math.floor(time -= m * 60),
			space = full ? '0' : '&nbsp;';
		return (h ? (h < 10 ? space + h : h) + ":" : "") + 
			(m < 10 ? (!h ? space : '0') + m : m) + ":" + (s < 10 ? '0' + s : s);
	}
};

export {MusicPlayer};

/*
	Реализация плейлистов
*/

// Базовый клас плейлиста
BasePlayList = Class({
	Constructor: function (opts) {
		var self = this;
		self.count = 0;
		self.playlist = [];
		self.playlist_order = [];
		self.opts = $.extend({
			loadable: true // поддерживает динамическую подгрузку треков
		}, self.getDefaultOptions(), opts);
		self.initialize && self.initialize();
		self.uniq_id = Math.floor((new Date).getTime() / 1000);
	},
	 
	// ИД местоположения текущего плейлиста
	addr: function () { return this.TYPE; },
	
	// Уникальный ID
	uniqId: function () { return this.uniq_id; },
	
	// Параметры для приложения
	getAppData: function () { return this.opts; },
	
	// Грузится ли сейчас чанк
	isLoading: function () {
		var self = this;
		return self.is_loading;
	},
	
	// Есть ли ещё незагруженные треки?
	avail: function (n) {
		var self = this;
		if (n !== undefined)
			return self.playlist.length > 0 && n < self.playlist.length;
		return self.playlist.length < self.total() || (!self.total() && self.opts.loadable);
	},
	
	// Общее количество всех доступных треков
	total: function () {
		var self = this;
		return self.opts.loadable ? self.count : self.playlist.length;
	},
	
	// Сколько треков уже загружено
	loaded: function () {
		var self = this;
		return self.playlist.length;
	},
	
	// Получить трек по его номеру
	get: function (n) {
		var self = this;
		return self.playlist[n];
	},
	
	// Получить  отсортированный плейлист
	getSortedList: function () {
		return this.playlist_order;
	},
	
	// Получить следующий/предыдущий трек по отсортированному списку
	getNeighbor: function (track_id, dir, sorted_index) {
		var self = this;
		for (var i = 0; i < self.playlist_order.length; ++i) {
			var p = self.playlist_order[i];
			if (p.index === track_id) {
				var new_index = i + (dir < 0 ? -1 : 1);
				if (new_index < 0)
					new_index = self.loaded() - 1;
				if (new_index > self.total() - 1 && !self.avail())
					new_index = 0;
				return sorted_index ? new_index : 
					self.playlist_order[new_index].index;
			}
		}
		return -1;
	},
	
	// Обычная позиция трека в сортированную
	getSortedIndex: function (index) {
		var self = this;
		for (var i = 0; i < self.playlist_order.length; ++i) {
			var p = self.playlist_order[i];
			if (p.index === index)
				return i;
		}
		return -1;
	},
	
	// Добавить трек
	add: function (file, pos) {
		var self = this;
		file.el = file.el || 'pl_unk_' + (++PL_ID) + '_' + Date.now();
		file.id = file.nid + '_' + file.type;
		file.index = self.playlist.length;
		self.playlist.push(file);
		
		if (pos !== undefined) {
			// Добавляем трек по нужной позиции
			self.playlist_order.splice(pos, 0, file);
		} else {
			// Добавляем в конец плейлиста
			self.playlist_order.push(file);
		}
		
		return file.index;
	},
	
	// Загрузка трека
	load: function (n, callback) {
		var self = this;
		if (self.avail(n)) {
			callback && callback(self.get(n));
			return self;
		} else if (!self.opts.loadable) {
			throw new Error("not supported");
		}
		self.is_loading = true;
		self._loadChunk(function () {
			self.is_loading = false;
			callback && callback(self.get(n));
		}, self.playlist.length, self.getChunkSize());
		return self;
	},
	
	// Загрузка очередного чанка, если доступно
	loadChunk: function (callback) {
		var self = this;
		if (self.avail() && !self.isLoading())
			return self.load(self.playlist.length, callback);
		return self;
	},
	
	// Размер чанка
	getChunkSize: function () {
		return 30;
	},
	
	// Дефолтные опции
	getDefaultOptions: function () {
		return {};
	},
	
	getDetached: function () {
		var self = this;
		
		var deleted = {};
		for (var i = 0, l = self.playlist.length; i < l; ++i) {
			var p = self.playlist[i];
			if (!document.getElementById(p.el))
				deleted[p.nid + ':' + p.type] = p;
		}
		
		return deleted;
	},
	
	find: function (nid, type) {
		var self = this;
		for (var i = 0; i < self.playlist.length; ++i) {
			if (self.playlist[i].nid === nid && self.playlist[i].type === type)
				return self.playlist[i];
		}
		return null;
	},
	
	destroy: function () {
		var self = this;
		self.opts = undefined;
		self.playlist = undefined;
		self.playlist_order = undefined;
		self.onDestroy && self.onDestroy();
	},
	restore: function (data) {
		var self = this;
		$.extend(self, data);
		self._plRestore(data.playlist);
	},
	serialize: function () {
		var self = this, state = self._props({}, ['opts', 'count', 'next_page']);
		state.playlist = self._plSave();
		return state;
	},
	_props: function (out, props) {
		var self = this;
		for (var i = 0; i < props.length; ++i)
			out[props[i]] = self[props[i]];
		return out;
	},
	_plSave: function () {
		var self = this,
			out = [];
		for (var i = 0; i < self.playlist_order.length; ++i) {
			var file = $.extend(true, {}, self.playlist_order[i]);
			out.push(file);
		}
		return out;
	},
	_plRestore: function (pl) {
		var self = this;
		self.playlist_order = [];
		self.playlist = new Array(pl.length);
		for (var i = 0; i < pl.length; ++i) {
			var file = pl[i];
			self.playlist[file.index] = file;
			self.playlist_order.push(file);
		}
	}
	/* _loadChunk: function (callback, offset, chunk) { }, */
});

// Простой константный плейлист
ConstPlayList = Class({
	Extends: BasePlayList,
	TYPE: 'const',
	getDefaultOptions: function () {
		return {loadable: false};
	},
	getAppData: function () {
		return false;
	}
});
PLAYLISTS[ConstPlayList.prototype.TYPE] = ConstPlayList;

// Плейлист юзерских файлов или ЗО
ApiPlayList = Class({
	Extends: BasePlayList,
	TYPE: 'api',
	addr: function () {
		var self = this, opts = self.opts.data;
		return [opts.user, opts.Type, opts.Lt, opts.Dir, opts.Sz].join(":");
	},
	_loadChunk: function (callback, offset, chunk) {
		var self = this;
		
		var api_data,
			plain_list = !self.opts.limit;
		
		if (plain_list) {
			// Игнорим offset и chunk
			api_data = self.opts.data;
		} else {
			api_data = $.extend({}, self.opts.data, {
				O: self.opts.offset + offset,
				L: chunk
			});
		}
		
		self.last_api_request = Spaces.api(self.opts.prefix + "." + (api_data.method || "getFiles"), api_data, function (res) {
			if (res.code == 0) {
				var files = res.widgets;
				
				var process_files = function () {
					for (var i = 0; i < files.length; ++i) {
						var file = files[i];
						if (files[i].type != Spaces.TYPES.MUSIC && files[i].fileext.toLowerCase() != "mp3")
							continue;
						var track = {
							src: file.playURL,
							nid: file.nid,
							type: file.type,
							my: file.my,
							artist: file.artist || "",
							title: file.title || "",
							duration: 0
						};
						_get_track_id3(track, file.filename);
						self.add(track);
					}
				};
				
				if (plain_list) {
					process_files();
					
					if (res.plainParams) {
						// Есть ещё страницы
						$.extend(self.opts.data, res.plainParams);
						++self.opts.data[self.opts.pageParam];
						self.count = self.playlist.length + 1; // Хак, что бы плеер думал, что есть ещё страницы
					} else {
						// Конец списка
						self.count = self.playlist.length;
					}
				} else {
					var api_bug = (files.length == 1 && self.find(files[0].nid, files[0].type));
					if (!api_bug) {
						self.count = res.count;
						process_files();
					}
					
					/*
						Это странное API для возвращает кол-во файлов + в подпапках, а не только в этой папке. 
						А ещё это странное API возвращает один файл, если передан кривой оффсет, который больше максимального. 
					*/
					if (files.length < chunk || api_bug) {
						// Считаем, что файлы закончились
						self.count = self.playlist.length;
					}
				}
				
				callback && callback(true);
			} else {
				callback && callback(false);
				self.count = self.playlist.length;
			}
		}, {
			onError: function () {
				callback && callback(false);
				self.count = self.playlist.length;
			}
		});
	},
	getAppData: function () {
		var self = this;
		return {
			offset:		self.opts.offset,
			limit:		self.opts.limit,
			params:		self.opts.data,
			prefix:		self.opts.prefix
		};
	},
	onDestroy: function () {
		var self = this;
		if (self.last_api_request)
			Spaces.cancelApi(self.last_api_request);
	}
});
PLAYLISTS[ApiPlayList.prototype.TYPE] = ApiPlayList;

// Простой слайдер-ползунок
$.fn.progressControl = function (val, opts) {
	opts = $.extend({
		// pointer: false
	}, opts);
	
	var self = this, ns = '.progressControl';
	if (val === false) {
		self.off(ns);
	} else {
		var in_touching = false, true_touch;
		var handler = function (e) {
			var touches = e.originalEvent.touches;
			if (in_touching || (e.type == 'mousedown' && e.which != 1) || (touches && touches.length > 1))
				return;
			
			var el = $(this),
				x = touches ? touches[0].clientX : e.pageX,
				y = touches ? touches[0].clientY : e.pageY,
				startX = x, startY = y,
				width = el.width(),
				bx = el.offset().left,
				v = Math.min(100, Math.max(x - bx, 0) * 100 / width),
				lie_move = false,
				drag_started = false,
				is_touch = e.type == 'touchstart';
			
			var evt = $.Event('progressStart');
			evt.isTouch = is_touch;
			el.trigger(evt, v);
			
			if (evt.isDefaultPrevented())
				return true;
			
			in_touching = true;
			true_touch = (e.type == 'touchstart');
			
			if (!is_touch)
				el.trigger('progressChange', v);
			
			var on_move = function (e) {
				if (!in_touching || (e.type == 'mousemove' && true_touch))
					return;
				var touches = e.originalEvent ? e.originalEvent.touches : e.touches,
					x = touches ? touches[0].clientX : e.pageX,
					y = touches ? touches[0].clientY : e.pageY;
				
				if (!drag_started) {
					if (lie_move)
						return true;
					if (Math.abs(startX - x) < Math.abs(startY - y)) {
						lie_move = true;
						return true;
					}
					
					if (Math.abs(startX - x) > 0)
						drag_started = true;
				}
				
				e.stopPropagation && e.stopPropagation();
				e.preventDefault && e.preventDefault();
				if (drag_started) {
					v = Math.min(100, Math.max(x - bx, 0) * 100 / width);
					var evt = $.Event('progressChange');
					evt.isTouch = is_touch;
					el.trigger(evt, v);
				}
				return false;
			};
			var on_end = function (e) {
				// при мультитаче прилетают на каждый палец
				if (e.touches && e.touches.length)
					return;
				
				if (!in_touching || (e.type == 'mouseup' && true_touch))
					return;
				
				Device.android_app && window.SpacesApp.exec('sidebar', {enable: true});
				
				in_touching = false;
				
				e.stopPropagation();
				e.stopImmediatePropagation();
				
				if (el[0].removeEventListener) {
					el[0].removeEventListener('touchmove', on_move);
					document.removeEventListener('mousemove', on_move);
				}
				$(document).off('.mplayer_tmp');
				el.off('.mplayer_tmp');
				
				var evt = $.Event('progressEnd');
				evt.isTouch = is_touch;
				evt.lieMove = lie_move;
				el.trigger(evt, v);
			};
			
			Device.android_app && window.SpacesApp.exec('sidebar', {enable: false});
			
			if (el[0].addEventListener) {
				el[0].addEventListener('touchmove', on_move, false);
				document.addEventListener('mousemove', on_move, false);
			} else {
				el.on('touchmove.mplayer_tmp', on_move);
				$(document).on('mousemove.mplayer_tmp', on_move);
			}
			
			$(document).on('mouseup.mplayer_tmp', on_end);
			el.on('touchcancel.mplayer_tmp touchend.mplayer_tmp', on_end);
			
			if (Device.browser.name == 'ucbrowser')
				return false;
		};
		if (typeof val === 'string')
			self.on('mousedown' + ns + ' touchstart' + ns, val, handler);
		else
			self.on('mousedown' + ns + ' touchstart' + ns, handler);
	}
	return self;
};

function android_app_player() {
	return Device.android_app && window.SpacesApp.params.nativeMusicPlayer;
}

function pad_duration(d) {
	if (d.length == 4 || d.length == 7)
		return '&nbsp;' + d;
	return d;
}

function _get_track_id3(track, filename) {
	if (!track.artist && !track.title) {
		var names = (filename || "").replace(/[_\s]+/g, ' ').split(" - ");
		track.artist = names[0];
		track.title = names[1] || '';
	}
}

module.on("componentpage", function () {
	same_find = false;
	MusicPlayer.init();
});

module.on("component", function () {
	MusicPlayer.delayedPopulate();
});
