import Device from '../device';
import SpacesApp from '../android/api';

export function copyToClipboard(text) {
	try {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(text);
		} else if (window.clipboardData) {
			window.clipboardData.setData("Text", text);
		} else if (document.execCommand) {
			let input = document.createElement("textarea");
			input.value = text;
			document.body.appendChild(input);
			
			input.select();
			document.execCommand("Copy");
			
			input.parentNode.removeChild(input);
		}
	} catch (e) {
		console.error('[clipboard]', e);
	}
	
	if (Device.android_app)
		SpacesApp.exec("copyToClipboard", {text: text});
}
