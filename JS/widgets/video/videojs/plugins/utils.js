export function findSelectedSource(sources) {
	let selectedSource;
	let defaultSource;

	for (let i = 0; i < sources.length; i++) {
		const source = sources[i];
		if (source.selected)
			selectedSource = i;
		if (source.enabled) {
			defaultSource = i;
			if (selectedSource != null && i >= selectedSource)
				break;
		}
	}

	return sources[defaultSource];
}

export function silentPromise(title, promise) {
	if (isPromise(promise)) {
		promise.then(() => { console.log(title + ': OK'); });
		promise.catch((e) => { console.log(title + ': ' + e.message); });
	}
}

function isPromise(value) {
	return value && typeof value.then === 'function';
}
