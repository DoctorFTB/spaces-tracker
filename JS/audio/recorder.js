import { BASE_URL } from '../core/env';
import Device from '../device';
import { compareVersions } from '../utils';
import { sendDataToWavEncoder, startWavEncoder, stopWavEncoder } from './wav-encoder';

const MEASURE_INTERVAL = 1000 / 16;
const MIN_VOLUME = 25.5;
const FFT_SIZE = 64;
const MIN_RECORDING_TIME = 1000;
const OGG_WORKER_URL = BASE_URL + '/vendor/opus-recorder/dist/encoderWorker.min.js';

const OGG_OPUS_MIME = 'audio/ogg;codecs=opus';
const WEBM_OPUS_MIME = 'audio/webm;codecs=opus';

let opusRecorderPromise;
let OpusRecorder;
let mediaRecorder;
let analyserNode;
let amplitudeArray;
let chunks;
let waveform;
let waveformChunk;
let analyserTimer;
let progressTimer;
let recordingStartTime;
let audioStream;
let audioContext;
let audioSourceNode;
let recordingEndSignal;

const CAN_PLAY_OGG = canPlayOGG();
const USE_NATIVE_OPUS = getNativeRecordingFormat();
const MIME_TYPE = USE_NATIVE_OPUS || OGG_OPUS_MIME;

export async function init() {
	// Нативная запись, без костылей
	if (USE_NATIVE_OPUS) {
		audioStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				channelCount: 1,
				echoCancellation: false,
				noiseSuppression: false
			}
		});
		mediaRecorder = new MediaRecorder(audioStream, {
			mimeType: MIME_TYPE,
			audioBitsPerSecond: 50000
		});
		console.log(`[recorder] use native encoder, format: ${MIME_TYPE}`);
		return;
	}

	// Legacy браузеры
	if (!opusRecorderPromise) {
		opusRecorderPromise = import('opus-recorder');
		OpusRecorder = (await opusRecorderPromise).default;
		mediaRecorder = await new OpusRecorder({
			encoderPath: OGG_WORKER_URL,
			reuseWorker: true,
			streamPages: !CAN_PLAY_OGG,
			mediaTrackConstraints: {
				channelCount: 1,
				echoCancellation: false,
				noiseSuppression: false
			}
		});
		if (!CAN_PLAY_OGG)
			startWavEncoder();
		console.log(`[recorder] use opus-encoder, format: ${MIME_TYPE}`);
	}
	return opusRecorderPromise;
}

export async function startRecording(options = {}) {
	options = {
		onWaveform: () => false,
		onProgress: () => false,
		...options
	};

	chunks = [];
	waveform = [];
	waveformChunk = [];

	recordingEndSignal = {};
	recordingEndSignal.promise = new Promise((resolve, reject) => {
		recordingEndSignal.resolve = resolve;
		recordingEndSignal.reject = reject;
	});

	await init();
	mediaRecorder.onstart = () => console.log('[recorder] recording started');
	mediaRecorder.onerror = (e) => {
		console.error('[recorder] recording error', e);
		recordingEndSignal.reject(e);
	};
	mediaRecorder.onstop = () => {
		console.log('[recorder] recording stopped');
		recordingEndSignal.resolve();
	};
	mediaRecorder.ondataavailable = (chunk) => {
		if (USE_NATIVE_OPUS) {
			chunks.push(chunk.data);
		} else {
			chunks.push(chunk);

			if (!CAN_PLAY_OGG)
				sendDataToWavEncoder(chunk);
		}
	};

	await mediaRecorder.start();

	recordingStartTime = Date.now();

	startWaveformAnalyser(options.onWaveform, options.onProgress);
}

export async function stopRecording() {
	if (!mediaRecorder || !recordingEndSignal)
		return;

	let recordedTime = Date.now() - recordingStartTime;
	if (recordedTime < MIN_RECORDING_TIME)
		await new Promise((resolve) => setTimeout(resolve, MIN_RECORDING_TIME - recordedTime));

	try {
		await mediaRecorder.stop();
		await recordingEndSignal.promise;
	} catch (e) {
		console.error(`[recorder] strange error:`, e);
	}

	if (USE_NATIVE_OPUS) {
		audioStream.getTracks().forEach((track) => track.stop());
		audioStream = null;
		mediaRecorder = null;
	}

	recordingEndSignal = null;

	let duration = Date.now() - recordingStartTime;
	let blob = new Blob(chunks, { type: MIME_TYPE });
	let result = { waveform, duration, blob, url: null };

	console.log(`[recorder] duration=${duration}, size=${blob.size}`);

	stopWaveformAnalyser();

	if (CAN_PLAY_OGG) {
		result.url = URL.createObjectURL(blob);
	} else {
		try {
			result.url = URL.createObjectURL(await stopWavEncoder());
		} catch (e) {
			console.error(`[recorder] wav encoder error:`, e);
			result = null;
		}
	}

	waveform = null;
	waveformChunk = null;
	chunks = null;

	return result;
}

// Привет айфонам :facepalm
function canPlayOGG() {
	let audio = new Audio();
	return audio.canPlayType(OGG_OPUS_MIME) === 'probably';
}

function getNativeRecordingFormat() {
	// https://bugs.webkit.org/show_bug.cgi?id=245428
	if (Device.browser.name == "safari" && compareVersions(Device.browser.version, "17.5") < 0)
		return null;

	if (!window.MediaRecorder)
		return null;

	if (MediaRecorder.isTypeSupported(OGG_OPUS_MIME)) {
		let audio = new Audio();
		return audio.canPlayType(OGG_OPUS_MIME) === 'probably' ? OGG_OPUS_MIME : null;
	}

	if (MediaRecorder.isTypeSupported(WEBM_OPUS_MIME)) {
		let audio = new Audio();
		return audio.canPlayType(WEBM_OPUS_MIME) === 'probably' ? WEBM_OPUS_MIME : null;
	}

	return null;
}

export function canRecordVoiceMessages() {
	// Не работает с MI Browser
	if (navigator.userAgent.indexOf('MiuiBrowser/') >= 0)
		return false;
	if (navigator.userAgent.indexOf('UCBrowser/') >= 0)
		return false;
	return navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AnalyserNode;
}

function startWaveformAnalyser(onWaveform, onProgress) {
	if (USE_NATIVE_OPUS) {
		audioContext = new AudioContext();
		audioSourceNode = audioContext.createMediaStreamSource(audioStream);
	} else {
		audioContext = mediaRecorder.sourceNode.context;
		audioSourceNode = mediaRecorder.sourceNode;
	}

	analyserNode = audioContext.createAnalyser();
	analyserNode.fftSize = FFT_SIZE;
	analyserNode.smoothingTimeConstant = 0;
	audioSourceNode.connect(analyserNode);

	amplitudeArray = new Uint8Array(analyserNode.frequencyBinCount);

	let analyseWaveform = () => {
		analyserNode.getByteFrequencyData(amplitudeArray);
		let sum = amplitudeArray.reduce((acc, current) => acc + current, 0);
		let volume = (sum / amplitudeArray.length);

		if (volume < MIN_VOLUME)
			volume = 0;

		waveformChunk.push(volume);
		waveform.push(volume);

		onWaveform(volume);
	};
	analyserTimer = setInterval(analyseWaveform, MEASURE_INTERVAL);

	progressTimer = setInterval(() => onProgress(Date.now() - recordingStartTime), 1000);
}

function stopWaveformAnalyser() {
	clearInterval(analyserTimer);
	clearInterval(progressTimer);
	analyserTimer = null;
	progressTimer = null;

	audioSourceNode.disconnect(analyserNode);
	analyserNode = null;

	audioSourceNode = null;

	if (USE_NATIVE_OPUS) {
		audioContext.close();
		audioContext = null;
	}
}
