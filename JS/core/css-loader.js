var INITIAL_THEME = 'light';
(function (css_files) {
	try {
		INITIAL_THEME = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	} catch (e) { };
	for (var i = 0; i < css_files.length; i++) {
		var css = css_files[i];
		document.writeln('<link rel="stylesheet" type="text/css" href="' + css[INITIAL_THEME] + '" data-href="' + css.light + '|' + css.dark + '" data-sort="' + css.sort + '" />');
	}
})
