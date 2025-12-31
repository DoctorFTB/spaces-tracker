export function load(id, url, type) {
	const container = document.getElementById(id);
	const renderIframe = () => {
		container.innerHTML = `<iframe loading="lazy" src="${url}" frameborder="0" allowfullscreen width="100%" height="100%"></iframe>`;
	};
	if (type == "COLLAPS") {
		fetch(url)
			.then((response) => response.text())
			.then((html) => {
				const iframe = document.createElement("iframe");
				iframe.setAttribute("frameborder", "0");
				iframe.setAttribute("allowfullscreen", "");
				iframe.setAttribute("width", "100%");
				iframe.setAttribute("height", "100%");
				container.appendChild(iframe);
				iframe.contentDocument.write(html);
				iframe.contentDocument.close();
			})
			.catch((e) => {
				console.error("[external-video]", e);
				renderIframe();
			});
	} else {
		onWindowReady(() => renderIframe());
	}
}

function onWindowReady(cb) {
	if (document.readyState === "complete") {
		setTimeout(cb, 0);
	} else {
		const onLoad = () => {
			window.removeEventListener('load', onLoad, false);
			cb();
		};
		window.addEventListener('load', onLoad, false);
	}
}
