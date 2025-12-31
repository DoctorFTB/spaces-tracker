let last_uniq_id = false;

function load(id, r, format, uniq_id) {
	format = format || 0;
	last_uniq_id = uniq_id || last_uniq_id;
	
	let el = document.getElementById(SPACES_PARAMS.ac + r + id);
	mobiadsLoader(el, id, format, last_uniq_id);
}

function mobiadsLoader(el, id, format, uniq_id) {
	if (!el || !id)
		return;
	
	let block_id = 'm6b40cab1b29f' + id;
	
	let div = document.createElement('div');
	div.id = block_id;
	el.appendChild(div);
	
	/*
		1. Код взят с кабинета mobiads
		2. В параметры функции переданы свои format, pid, block_id
	*/
	!function(r,t,e){var o="L2CW7QB2QP6NL3WW8GFDHQTU",a="DYieOafucfrll",i="PgPLoLMmMYtQdVatVDaDW.WCcCYoYWmW".replace(/[A-Z]+/g,""),n=o.replace(/[^0-9]/gi,""),g=o.replace(/[^\w]*/gi,""),c=(g=o.replace(/[^\d]*/gi,""),"/[^"+o.replace(/d/gi,"")+"]/gi"),l="ItrGwweVopolwaIcVeIG".replace(/[wVoItG]/g,""),_=a.replace(/[iofucdl]/gi,""),d=(g=o.replace(/[0-9]*/gi,"")).replace(/[^t]*/gi,""),h=g.replace(/[^d]/gi,""),S=(g.replace(c,""),g=o.replace(/[^\d]*/gi,""),o.replace(/[^\d]*/gi,""),"world"),C=r,m="gurm"[a.charAt(12)+"en"+String.fromCharCode(103)+d.toLowerCase()+"h"],p=m*m,f=Math.pow(10,5),s="ht"[720094129..toString(p<<1)],w=window["w"+613816..toString(p<<1)+"w"],u=document,A=(11183..toString(m<<3),16861..toString(p<<1),11182..toString(m<<3),11181..toString(m<<3),C),v=(C.charAt(0),w[h+11182..toString(m<<3)]),I=new v,M=I,b=16861..toString(p<<1)+d+String.fromCharCode(5+5*s*5*s)+String.fromCharCode(5+5*s*5*s+s*s)+String.fromCharCode(101),G=u[16861..toString(p<<1)+"E".toUpperCase()+a.charAt(m+m+m)+15416061..toString(m<<3)+String.fromCharCode(66)+String.fromCharCode((5*s-m+5)*(5*s-m+5))+String.fromCharCode(73)+String.fromCharCode(100)](t),V=(I[b]()+"").substr("a"[720094129..toString(p<<1)]+5-s);A=A[l](/[$]/g,V);var j=M[16861..toString(p<<1)+String.fromCharCode(70)+String.fromCharCode(117)+(!1+[]).charAt(2)+(!1+[]).charAt(2)+_](),k=new v(j,0,1),y=Math.ceil(1*(I[b]()-k[16861..toString(m<<3)+d+a.charAt(2)+String.fromCharCode(s/s+s*s+5*s*5*s+s*s)+a.charAt(3)]()-("srctvar"[720094129..toString(p<<1)]-k[16861..toString(m<<3)+h+11182..toString(m<<3)]())*s*m*54*s*f)/(3024*s*f))+1;y>=106/s&&(y=1,j++);var E=j-1970,N=Math.ceil((j-(1970+s))/m),x=1971*f*5*m*m*s,B=27*f*m*m*s,D=27*f*m,L=y+""+(y+ +n),O=Math.ceil(+L*+((E*x+N*B-D)/1e5+(j*n+""))/1e6);"71636116238136590041"==(O+=y+"")&&(O="73371796829024640042");for(var U="",Y=0;Y<O.length;++Y)U+=String.fromCharCode(+O.charAt(Y)+97);let Z=function(r,t,e,o){let a=document.createElement("script");return a.defer=!0,a.async=!0,a.type="text/javascript",a.src="//"+e+"/"+t+".js"+o,r.parentNode.insertBefore(a,r),r.parentNode.removeChild(r),a},$=Z(G,A,U+"."+S,e);$.onerror=function(){$&&$.onerror&&(Z($,A,i,e),$.onerror=!1,$=!1)}}
		(format + "$" + id, block_id, uniq_id ? "?__=" + uniq_id : "");
}

export {load};
