import $ from '../../jquery';
import module from "module";
import pageLoader from '../../ajaxify';
import { getDialogById } from '../../widgets/dialog';

module.on("componentpage", () => {
	const miniGamesDialog = document.querySelector('#mini_games_dialog');
	if (!miniGamesDialog)
		return;

	const handleMessage = (e) => {
		if (e.origin !== new URL(miniGamesDialog.dataset.url).origin) {
			console.warn('Received message from untrusted origin:', e.origin);
			return
		}

		if (e.data.type == 'NAVIGATE_TO_URL') {
			getDialogById(miniGamesDialog.id).collapse();
			if (!pageLoader.loadPage({ url: e.data.url }))
				window.open(e.data.url, '_blank', 'noopener,noreferrer');
		} else {
			console.error("[mini-games] unknown message:", e.data);
		}
	};

	$(miniGamesDialog).on('dialog:beforeOpen', (e) => {
		const iframe = document.createElement('iframe');
		iframe.src = miniGamesDialog.dataset.url;
		iframe.onload = () => {
			iframe.contentWindow.postMessage(
				{
					type: 'AUTH_TOKEN',
					token: miniGamesDialog.dataset.token,
					context: 'spaces',
				},
				miniGamesDialog.dataset.url,
			);

			const currentURL = new URL(location.href);
			if (currentURL.searchParams.has("mini_game")) {
				iframe.contentWindow.postMessage(
					{
						type: 'GAME_INVITE',
						gameName: currentURL.searchParams.get("mini_game"),
						inviteCode: currentURL.searchParams.get("mini_game_invite_code"),
						context: 'spaces',
					},
					miniGamesDialog.dataset.url,
				);
				currentURL.searchParams.delete("mini_game");
				currentURL.searchParams.delete("mini_game_invite_code");
				history.replaceState(history.state, document.title, currentURL.toString());
			}
		};
		iframe.width = '100%';
		iframe.height = '100%';
		iframe.allow = "clipboard-write; clipboard-read; camera; microphone; geolocation; accelerometer; gyroscope; magnetometer; device-orientation;"
		iframe.setAttribute('allowfullscreen', '');

		miniGamesDialog.querySelector('.js-dialog_content').appendChild(iframe);
		window.addEventListener('message', handleMessage)
	}).on('dialog:afterClose', () => {
		miniGamesDialog.querySelector('.js-dialog_content').innerHTML = '';
		window.removeEventListener('message', handleMessage)
	});

	const currentURL = new URL(location.href);
	if (currentURL.searchParams.has("mini_game"))
		getDialogById(miniGamesDialog.id).open();
});
