import module from 'module';
import $ from '../../jquery';

$(window).on('resize orientationchange', function (e) {
	resizeVideo();
});

resizeVideo();

function resizeVideo() {
	let video = $('.js-vp').show();
	let aspect = 16 / 9; // на текущий момент плеер всегда 16:9
	
	// У плеера может быть небольшой тулбар снизу, пробуем его вычислить
	let extra_height = getPlayerExtraHeight(video.width(), video.height(), aspect);
	
	let max_height = $(window).innerHeight() - extra_height;
	let player_width = $(window).innerWidth();
	let player_height = Math.floor(player_width / aspect);
	
	if (player_height > max_height) {
		player_height = max_height;
		player_width =  Math.floor(player_height * aspect);
	}
	
	video
		.css("margin-top", (max_height - player_height) / 2 + "px")
		.css("max-width", player_width + "px");
}

function getPlayerExtraHeight(player_width, player_height, aspect) {
	return player_height - Math.floor(player_width / aspect);
}
