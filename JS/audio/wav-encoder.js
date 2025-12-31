const OGG_DECODER_WORKER_URL = BASE_URL + '/vendor/opus-recorder/dist/decoderWorker.min.js';
const WAV_ENCODER_WORKER_URL = BASE_URL + '/vendor/opus-recorder/dist/waveWorker.min.js';

const SAMPLE_RATE = 48000;
const BIT_DEPTH = 16;

let decoderWorker;
let wavWorker;
let resultPromise = null;

export function startWavEncoder() {
	decoderWorker = new Worker(OGG_DECODER_WORKER_URL);
	wavWorker = new Worker(WAV_ENCODER_WORKER_URL);

	resultPromise = {};
	resultPromise.promise = new Promise((resolve, reject) => {
		resultPromise.resolve = resolve;
		resultPromise.reject = reject;
	});

	decoderWorker.onerror = (e) => {
		console.error('[ogg-decoder]', e);
		resultPromise.reject(e);
	};

	wavWorker.onerror = (e) => {
		console.error('[wav-encoder]', e);
		resultPromise.reject(e);
	};

	decoderWorker.onmessage = (e) => {
		if (e.data === null) {
			wavWorker.postMessage({ command: 'done' });
		} else {
			wavWorker.postMessage({ command: 'encode', buffers: e.data }, e.data.map(({ buffer }) => buffer));
		}
	};

	wavWorker.onmessage = (e) => {
		if (e.data.message === 'page') {
			resultPromise.resolve(new Blob([e.data.page], { type: 'audio/wav' }));
			stopWorkers();
		}
	};

	wavWorker.postMessage({
		command: 'init',
		wavBitDepth: BIT_DEPTH,
		wavSampleRate: SAMPLE_RATE
	});

	decoderWorker.postMessage({
		command: 'init',
		decoderSampleRate: SAMPLE_RATE,
		outputBufferSampleRate: SAMPLE_RATE
	});
}

function stopWorkers() {
	if (decoderWorker) {
		decoderWorker.terminate();
		decoderWorker = null;
	}

	if (wavWorker) {
		wavWorker.terminate();
		wavWorker = null;
	}
}

export async function stopWavEncoder() {
	let result = await resultPromise.promise;
	resultPromise = null;
	stopWorkers();
	return result;
}

export async function sendDataToWavEncoder(page) {
	decoderWorker.postMessage({ command: 'decode', pages: page });
}
