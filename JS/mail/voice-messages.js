import { startRecording, stopRecording } from "../audio/recorder";
import { AudioWaveformWidget } from "../audio/visualisation";
import { L, formatDuration, tick } from '../utils';
import 'howler/src/howler.core.js';
import { startDraggable, stopDraggable } from '../core/touch/draggable';
import { IPCSingleton } from '../core/ipc';
import Spaces from '../spacesLib';

let waveformWidget;
let waveformElement;
let currentState = 'none';
let recordedAudio;
let rewinding = false;
let audio;
let onVoiceRecordedCallback;
let recordingTimeout;
let timeUpdateTimer;
let alreadyPlayed = false;

const tpl = {
	microphoneSetupAndroid() {
		return `
			${L('Также причина может быть в разрешениях вашего браузера.')}<br />
			<ul style="list-style: decimal">
				<li>
					${L('Перейдите в настройки вашего устройства.')}
				</li>
				<li>
					${L('Перейдите в:')}
					<i>${L('Приложения → Все приложения')}</i>.
				</li>
				<li>
					${L('Найдите ваш браузер в списке.')}
				</li>
				<li>
					${L('Перейдите в:')}
					<i>${L('Разрешения')}</i>.
				</li>
				<li>
					${L('Разрешите доступ к микрофону.')}
				</li>
			</ul>
			<br />
		`;
	},
	microphoneSetupIOS() {
		return `
			${L('Также причина может быть в разрешениях вашего браузера.')}<br />
			<ul style="list-style: decimal">
				<li>
					${L('Перейдите в настройки вашего устройства.')}
				</li>
				<li>
					${L('Найдите ваш браузер в списке.')}
				</li>
				<li>
					${L('Разрешите доступ к микрофону.')}
				</li>
			</ul>
			<br />
		`;
	},

	microphoneError(error) {
		const lockIcon = `<span class="ico_chat ico_chat_lock_black ico-inline"></span>`;
		const lockIcon2 = `<span class="ico ico_levels_black ico-inline"></span>`;

		let systemHelp = "";
		if (navigator.userAgent.match(/iPad|iPhone|iPod/i)) {
			systemHelp = tpl.microphoneSetupIOS();
		} else if (navigator.userAgent.match(/Android/i)) {
			systemHelp = tpl.microphoneSetupAndroid();
		}

		return `
			${L("Ошибка доступа к микрофону: {0}", error)}<br />
			${L("Нажмите на {0} или {1} в адресной строке браузера и разрешите доступ к микрофону.", lockIcon, lockIcon2)}

			<a href="#" onclick="
				document.getElementById('microphone-setup-help').classList.remove('hide');
				this.classList.add('hide');
				return false;
			">
				${L('Не помогло?')}
			</a>

			<div id="microphone-setup-help" class="hide">
				<br />
				${systemHelp}
				${L("Если проблему не удалось решить, обратитесь в {0}службу поддержки{1}.", "<a href='/soo/help/'>", "</a>")}
			</div>
		`;
	}
};

export function initVoiceMessages() {
	if (!document.getElementById('voice-recorder'))
		return;

	waveformElement = document.getElementById('voice-recorder-waveform');
	waveformWidget = AudioWaveformWidget(waveformElement, { skin: 'RECORDER' });

	waveformElement.addEventListener('click', (e) => {
		e.preventDefault();
		if (currentState == 'paused' && !alreadyPlayed)
			audio.play();
	}, false);

	document.querySelector('#voice-recorder-cancel').addEventListener('click', (e) => {
		closeVoiceRecoder();
		if (currentState == 'recording')
			stopVoiceRecording(true);
	}, false);

	document.querySelector('#voice-recorder-stop').addEventListener('click', (e) => {
		e.preventDefault();
		if (currentState == 'recording') {
			stopVoiceRecording(false);
		} else {
			if (audio.playing()) {
				audio.pause();
			} else {
				audio.play();
				// У события onplay есть небольшой лаг
				setState('playing');
			}
		}
	}, false);

	startDraggable(waveformElement, {
		calcRelative: true,
		preventTouchScroll: false,
		onBeforeDragStart() {
			if (alreadyPlayed) {
				return currentState == 'playing' || currentState == 'paused';
			} else {
				return currentState == 'playing';
			}
		},
		onDragStart(e) {
			rewinding = true;
			waveformWidget.setProgress(e.relX);
			updateDuration((recordedAudio.duration / 1000) * e.relX);
		},
		onDragMove(e) {
			waveformWidget.setProgress(e.relX);
			updateDuration((recordedAudio.duration / 1000) * e.relX);
		},
		onDragEnd(e) {
			audio.seek((recordedAudio.duration / 1000) * e.relX);
			rewinding = false;
		},
	});
}

export function closeVoiceRecoder() {
	if (timeUpdateTimer) {
		cancelAnimationFrame(timeUpdateTimer);
		timeUpdateTimer = null;
	}

	if (audio) {
		audio.unload();
		audio = null;
	}

	if (recordedAudio) {
		URL.revokeObjectURL(recordedAudio.url);
		recordedAudio = null;
	}
}

export function destroyVoiceMessages() {
	if (currentState == 'recording')
		stopRecording();

	closeVoiceRecoder();

	if (waveformWidget) {
		waveformWidget.destroy();
		waveformWidget = null;

		stopDraggable(waveformElement);
		waveformElement = null;
	}

	onVoiceRecordedCallback = null;
	recordedAudio = null;
	IPCSingleton.instance('cp').stop('voice-record');
	IPCSingleton.instance('cp').stop('voice-preview');
}

export async function startVoiceRecording(onVoiceRecorded) {
	onVoiceRecordedCallback = onVoiceRecorded;

	toggleLongDuration(false);

	setState('recording');
	waveformWidget.setProgress(1);
	waveformWidget.setWaveform([], true);
	waveformWidget.update();

	updateDuration(0);

	let isMoreThanHour = false;
	try {
		await startRecording({
			onProgress(recordingDuration) {
				updateDuration(recordingDuration / 1000);

				// Если длительность уже больше часа, расширяем поле для вывода времени
				if (recordingDuration >= 3600 * 1000 && !isMoreThanHour) {
					toggleLongDuration(true);
					isMoreThanHour = true;
				}
			},
			onWaveform(volume) {
				if (waveformWidget)
					waveformWidget.report(volume);
			}
		});
	} catch (e) {
		console.error(e);
		Spaces.showError(tpl.microphoneError(e.message));
		return false;
	}

	let maxRecordingTime = document.querySelector('#voice-recorder').dataset.maxRecordingTime * 1000;
	recordingTimeout = setTimeout(() => stopVoiceRecording(), maxRecordingTime);
	IPCSingleton.instance('cp').start(() => stopVoiceRecording(), 'voice-preview');

	return true;
}

export async function stopVoiceRecording(cancel) {
	if (currentState != 'recording')
		return;

	recordedAudio = await stopRecording();

	clearTimeout(recordingTimeout);
	recordingTimeout = null;

	if (!recordedAudio) {
		Spaces.showError(L("Ошибка при сохранении голосового сообщения."));
		onVoiceRecordedCallback(false);
	} else if (cancel) {
		onVoiceRecordedCallback(false);
	} else {
		setState('paused');
		waveformWidget.setProgress(1);
		waveformWidget.setWaveform(recordedAudio.waveform, false);
		updateDuration(recordedAudio.duration / 1000);
		initVoicePlayer();
		onVoiceRecordedCallback({ blob: recordedAudio.blob });
	}
}

function setState(state) {
	let recorderElement = document.querySelector('#voice-recorder');
	recorderElement.classList.remove('voice-recorder--state-' + currentState);
	currentState = state;
	recorderElement.classList.add('voice-recorder--state-' + currentState);
}

function toggleLongDuration(flag) {
	let recorderElement = document.querySelector('#voice-recorder');
	recorderElement.classList.toggle('voice-recorder--long-duration', flag);
	waveformWidget.update();
}

function onTimeUpdate() {
	if (!rewinding) {
		let progress = audio.seek() / (recordedAudio.duration / 1000);
		waveformWidget.setProgress(progress);
		updateDuration(audio.seek());
	}
	timeUpdateTimer = requestAnimationFrame(onTimeUpdate);
}

function initVoicePlayer() {
	if (audio) {
		audio.pause();
		audio.stop();
		audio.unload();
		audio = null;
	}

	audio = new Howl({
		src: [recordedAudio.url],
		html5: true,
		onplayerror(error) {
			console.error(`[Howl]`, error);
			Spaces.showError(L("Ошибка воспроизведения голосового сообщения: {0}", error));
		},
		onplay() {
			setState('playing');
			IPCSingleton.instance('cp').start(() => audio.pause(), 'voice-preview');
			alreadyPlayed = true;

			if (!timeUpdateTimer)
				onTimeUpdate();
		},
		onseek() {
			if (!timeUpdateTimer)
				onTimeUpdate();
		},
		onpause() {
			setState('paused');
			IPCSingleton.instance('cp').stop('voice-preview');

			if (timeUpdateTimer) {
				cancelAnimationFrame(timeUpdateTimer);
				timeUpdateTimer = null
			}
		},
		onend() {
			waveformWidget.setProgress(1);
			updateDuration((recordedAudio.duration / 1000));
			setState('paused');

			// На Firefox без этого костыля зависает
			tick(initVoicePlayer);
		}
	});

	alreadyPlayed = false;
}

function updateDuration(duration) {
	let durationEl = document.getElementById('voice-recorder-duration');
	durationEl.innerHTML = formatDuration(Math.round(duration));
}
