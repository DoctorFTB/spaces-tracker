const removeCookieBanner = () => {
	document.querySelector('#cookie_banner').remove();
	clearInterval(cookiesTimer);
};

const cookiesTimer = setInterval(() => {
	if (document.cookie.indexOf('cookies_accept=1') >= 0)
		removeCookieBanner();
}, 5000);

document.querySelector('#cookie_banner_accept').addEventListener('click', (e) => {
	e.preventDefault();
	Spaces.api("common.acceptCookies", { CK: null });
	removeCookieBanner();
});
