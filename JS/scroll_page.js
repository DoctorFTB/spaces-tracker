
var scroll_page = document.getElementById("scroll_page"),
	scroll_page_place = document.getElementById("scroll_page_place"),
	scroll_page_toTop = document.getElementById("scroll_page_toTop"),
	scroll_page_toBottom = document.getElementById("scroll_page_toBottom"),
	scroll_to_top = true;

function windowWidth(){
	return document.documentElement.clientWidth;
}

function scroll_page_width(){
	var window_width = windowWidth();
	
	if (window_width>=1100){
		var new_width = ((window_width - 900) / 4);
		if (new_width < 100){
			new_width = 100;
		}
		scroll_page.style.width =  new_width + "px";
	}else{
		scroll_page.style.width = "0";
	}
}

function window_scroll_Y(){
	if (window.scrollY){
		return window.scrollY;
	}else{
		return document.documentElement.scrollTop;
	}
}

function scroll_opacity(){
	var scroll = window_scroll_Y();
	if (scroll > 100){
		
		var opacity = (scroll / 1000);
		
		if (opacity > 1){
			opacity = 1;
		}
		scroll_page_toTop.style.opacity = 1;
		scroll_page_toTop.style.filter = "progid:DXImageTransform.Microsoft.Alpha(opacity=100)";
		
		scroll_page_toBottom.style.opacity = 0;
		scroll_page_toBottom.style.filter = "progid:DXImageTransform.Microsoft.Alpha(opacity=0)";
		
		scroll_page_place.style.opacity = opacity;
		var ie_opacity = opacity * 100;
		scroll_page_place.style.filter = "progid:DXImageTransform.Microsoft.Alpha(opacity="+ie_opacity+")";
		
		scroll_page.style.cursor = "pointer";
		scroll_to_top = true;
		
	}else{
		scroll_page_toTop.style.opacity = 0;
		scroll_page_place.style.opacity = 0;
		
		scroll_page_toTop.style.filter = "progid:DXImageTransform.Microsoft.Alpha(opacity=0)";
		scroll_page_place.style.filter = "progid:DXImageTransform.Microsoft.Alpha(opacity=0)";
		
		if (scroll_to_top !== true){
			scroll_page.style.cursor = "pointer";
		}else{
			scroll_page.style.cursor = "default";
		} 
	}
}

function move_page_Y(){
		if (scroll_to_top === true){
			if (window_scroll_Y() > 100){
				scroll_to_top = window_scroll_Y();
				window.scrollTo(0,0);
				
				
				scroll_page_toBottom.style.opacity = 1;
				scroll_page_toBottom.style.filter = "progid:DXImageTransform.Microsoft.Alpha(opacity=100)";
			}
		}else{
			window.scrollTo(0,scroll_to_top);
			scroll_to_top = true;
			
			scroll_page_toBottom.style.opacity = 0;
			scroll_page_toBottom.style.filter = "progid:DXImageTransform.Microsoft.Alpha(opacity=0)";
		}
}

document.body.onresize = scroll_page_width;
window.onscroll = scroll_opacity;
scroll_page.onclick = move_page_Y;

scroll_page_width();
scroll_opacity();
