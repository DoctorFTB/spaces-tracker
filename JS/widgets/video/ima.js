import {loadScript} from 'loader';

let imaSdkPromise;
let imaSdkLoaded = false;

export async function loadGoogleImaSdk() {
	if (imaSdkLoaded)
		return;
	if (!imaSdkPromise) {
		imaSdkPromise = new Promise((resolve, reject) => loadScript('//imasdk.googleapis.com/js/sdkloader/ima3.js', resolve, reject));
		imaSdkPromise.then(() => {
			imaSdkLoaded = true;
			imaSdkPromise = null;
		}).catch(() => {
			imaSdkPromise = null;
		});
	}
	return await imaSdkPromise;
}
