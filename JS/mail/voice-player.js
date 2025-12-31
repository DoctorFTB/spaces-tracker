import module from "module";
import 'howler/src/howler.core.js';
import { AudioWaveformWidget } from "../audio/visualisation";
import { L, formatDuration } from "../utils";
import { startDraggable, stopDraggable } from '../core/touch/draggable';
import { IPCSingleton } from "../core/ipc";
import * as pushstream from '../core/lp';
import Spaces from "../spacesLib";

let audio;
let globalPlayerId = 0;
let currentPlayerId;
let currentPlayer;
let players = {};
let playlist = [];
let timeUpdateTimer;
let rewinding = false;

const PLAYBACK_RATES = [1, 1.5, 2];

function init() {
	pushstream.on('message', 'voice-player', (message) => {
		if (message.act == pushstream.TYPES.MAIL_VOICE_LISTEN) {
			let playerElement = document.getElementById(`voice-message-${message.data.nid}`);
			if (playerElement)
				playerElement.classList.remove('voice-player--is-unlistened');
		}
	});
}

function destroyPlayer(playerItem) {
	if (playerItem.id === currentPlayerId) {
		audio.unload();
		audio = null;

		if (timeUpdateTimer) {
			cancelAnimationFrame(timeUpdateTimer);
			timeUpdateTimer = null
		}
	}
	if (playerItem.initialized) {
		stopDraggable(playerItem.view.waveformElement);
		playerItem.initialized = false;
	}
	playerItem.view.waveform.destroy();
	delete players[playerItem.id];
}

function destroy() {
	for (let id in players)
		destroyPlayer(players[id]);

	if (audio) {
		audio.unload();
		audio = null;
	}

	players = {};
	playlist = [];

	currentPlayer = null;
	currentPlayerId = null;

	IPCSingleton.instance('cp').stop('voice');
	pushstream.off('message', 'voice-player');
}

function initVoicePlayers() {
	let newPlaylist = [];
	let playersElements = document.getElementsByClassName('js-voice-player');
	for (let i = 0; i < playersElements.length; i++) {
		let playerElement = playersElements[i];
		if (playerElement.classList.contains('js-voice-player-queued'))
			initVoicePlayer(playerElement);
		if (playerElement.dataset.received)
			newPlaylist.push(+playerElement.dataset.id);
	}
	playlist = newPlaylist;
}

export function checkVoicePlayers() {
	for (let id in players) {
		let player = players[id];
		if (isDetached(player.element))
			destroyPlayer(player);
	}
}

function initVoicePlayer(playerElement) {
	let waveformElement = playerElement.querySelector('.js-voice-player-waveform');
	let skin = playerElement.classList.contains('voice-player--style-incoming') ? 'INCOMING' : 'OUTGOING';
	let waveformWidget = AudioWaveformWidget(waveformElement, { skin });

	waveformWidget.setProgress(0);
	waveformWidget.setWaveform(decodeWaveform(playerElement.dataset.waveform), false);

	let id = globalPlayerId++;
	let playerItem = {
		id,
		state: 'paused',
		element: playerElement,
		mp3: playerElement.dataset.mp3,
		ogg: playerElement.dataset.ogg,
		duration: parseFloat(playerElement.dataset.duration),
		playbackRate: 1,
		view: {
			playButton:		playerElement.querySelector('.js-voice-player-play'),
			time:			playerElement.querySelector('.js-voice-player-time'),
			speed:			playerElement.querySelector('.js-voice-player-speed'),
			errorMessage:	playerElement.querySelector('.js-voice-player-error'),
			waveform:		waveformWidget,
			waveformElement,
		},
		initialized: false
	};

	playerElement.dataset.id = id;

	playerItem.view.waveformElement.addEventListener('click', (e) => {
		if (currentPlayerId === id)
			return;
		switchPlayer(id);
		audio.play();
	});

	playerItem.view.speed.addEventListener('click', (e) => {
		let nextIndex = (PLAYBACK_RATES.indexOf(playerItem.playbackRate) + 1) % PLAYBACK_RATES.length;
		playerItem.playbackRate = PLAYBACK_RATES[nextIndex];
		e.target.innerHTML = playerItem.playbackRate + '×';
		e.target.classList.toggle('voice-player__speed--is-active', playerItem.playbackRate != 1);

		if (playerItem.id == currentPlayerId) {
			audio.rate(playerItem.playbackRate);
		}
	});

	playerItem.view.playButton.addEventListener('click', (e) => {
		e.preventDefault();
		switchPlayer(id);

		if (audio.playing()) {
			audio.pause();
		} else {
			audio.play();
			// У события onplay есть небольшой лаг
			setPlayerState('playing');
		}
	}, false);

	players[playerItem.id] = playerItem;

	playerElement.classList.remove('js-voice-player-queued');

	return playerItem.id;
}

function switchPlayer(id) {
	if (currentPlayerId === id)
		return;

	if (currentPlayer) {
		setPlayerState('paused');
		currentPlayer.view.waveform.setProgress(0);
		updateDuration(currentPlayer.duration);

		if (audio.playing())
			audio.pause();
	}

	currentPlayerId = id;
	currentPlayer = players[id];

	showError(null);
	initializeAudio();
	initializeCurrentPlayer();
}

function onTimeUpdate() {
	if (!rewinding) {
		currentPlayer.view.waveform.setProgress(audio.seek() / currentPlayer.duration);
		updateDuration(audio.seek());
	}
	timeUpdateTimer = requestAnimationFrame(onTimeUpdate);
}

function initializeAudio() {
	if (audio) {
		audio.pause();
		audio.stop();
		audio.unload();
		audio = null;
	}

	audio = new Howl({
		src: [currentPlayer.ogg, currentPlayer.mp3],
		html5: true,
		rate: currentPlayer.playbackRate,
		onplayerror(error) {
			console.error(`[Howl]`, error);
			showError(L("Ошибка воспроизведения голосового сообщения: {0}", error));
		},
		onplay() {
			setPlayerState('playing');
			IPCSingleton.instance('cp').start(() => audio.pause(), 'voice');

			if (!timeUpdateTimer)
				onTimeUpdate();

			let playerElement = currentPlayer.element;
			if (playerElement.dataset.received && playerElement.dataset.unlistened) {
				playerElement.dispatchEvent(new Event('voice-message-listened', { bubbles: true }));

				Spaces.api("mail.voice.setListened", {
					CK: null,
					Id: playerElement.dataset.voiceId
				});

				playerElement.classList.remove('voice-player--is-unlistened');
				delete playerElement.dataset.unlistened;
			}
		},
		onseek() {
			if (!timeUpdateTimer)
				onTimeUpdate();
		},
		onpause() {
			setPlayerState('paused');
			IPCSingleton.instance('cp').stop('voice');

			if (timeUpdateTimer) {
				cancelAnimationFrame(timeUpdateTimer);
				timeUpdateTimer = null
			}
		},
		onend() {
			currentPlayer.view.waveform.setProgress(0);
			updateDuration(audio.duration());
			setPlayerState('paused');

			// Переключаемся на следующий трек
			let playlistIndex = playlist.indexOf(currentPlayerId);
			if (playlistIndex != -1 && playlistIndex + 1 < playlist.length) {
				switchPlayer(playlist[playlistIndex + 1]);
				audio.play();
			}
		}
	});
}

function showError(error) {
	currentPlayer.view.errorMessage.classList.toggle('hide', !error);
	if (error) {
		currentPlayer.view.errorMessage.innerHTML = error + '<br />' +
			L('Вы можете попробовать <a href="{0}">скачать голосовое сообщение</a>.', currentPlayer.ogg);
	}
}

function initializeCurrentPlayer() {
	if (currentPlayer.initialized)
		return;

	let id = currentPlayerId;
	startDraggable(currentPlayer.view.waveformElement, {
		calcRelative: true,
		preventTouchScroll: false,
		onBeforeDragStart() {
			return currentPlayerId === id;
		},
		onDragStart(e) {
			rewinding = true;
			currentPlayer.view.waveform.setProgress(e.relX);
			updateDuration(currentPlayer.duration * e.relX);
		},
		onDragMove(e) {
			currentPlayer.view.waveform.setProgress(e.relX);
			updateDuration(currentPlayer.duration * e.relX);
		},
		onDragEnd(e) {
			audio.seek(currentPlayer.duration * e.relX);
			rewinding = false;
		},
	});
}

function updateDuration(duration) {
	currentPlayer.view.time.innerHTML = formatDuration(Math.round(duration));
}

function setPlayerState(newState) {
	currentPlayer.element.classList.remove('voice-player--state-' + currentPlayer.state);
	currentPlayer.state = newState;
	currentPlayer.element.classList.add('voice-player--state-' + currentPlayer.state);
}

function decodeWaveform(str) {
	let decoded = [];
	for (let i = 0; i < str.length; i++) {
		let c = str.charCodeAt(i);
		if (c >= 48 && c <= 57) {
			decoded.push((c - 48) / 31 * 255);
		} else if (c >= 97 && c <= 122) {
			decoded.push((c - 87) / 31 * 255);
		}
	}
	return decoded;
}

function isDetached(element) {
	while (element) {
		if (element === document.body)
			return false;
		element = element.parentNode;
	}
	return true;
}

module.on("componentpage", init);
module.on("componentpagedone", destroy);
module.on("component", initVoicePlayers);
