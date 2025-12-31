export function findParent(el, selector) {
	while (el && el.parentElement) {
		el = el.parentElement;
		if (el.matches(selector))
			return el;
	}
	return null;
}

export function scrollIntoViewIfNotVisible(target, options = {}) {
	options = {
		start: "start",
		end: "end",
		behavior: "smooth",
		...options
	};
	const rect = target.getBoundingClientRect();
	if (rect.bottom > window.innerHeight) {
		target.scrollIntoView({ block: options.end, inline: "nearest", behavior: options.behavior });
	} else if (rect.top < 0) {
		target.scrollIntoView({ block: options.start, inline: "nearest", behavior: options.behavior });
	}
}

export function isVisibleOnScreen(target) {
	const rect = target.getBoundingClientRect();
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	if (rect.bottom < 0 || rect.top > vh)
		return false;
	if (rect.right < 0 || rect.left > vw)
		return false;
	return true;
}

export function parseDataset(element, meta, prefix = undefined) {
	const options = {};
	for (const k in meta) {
		const dataKey = prefix ? prefix + k.substring(0, 1).toUpperCase() + k.substring(1) : k;
		if (!(dataKey in element.dataset))
			continue;
		switch (meta[k]) {
			case "string":
				options[k] = element.dataset[dataKey];
				break;
			case "number":
				options[k] = parseInt(element.dataset[dataKey]);
				break;
			case "bool":
				options[k] = !(element.dataset[dataKey] == "false" || element.dataset[dataKey] == "0");
				break;
		}
	}
	return options;
}
