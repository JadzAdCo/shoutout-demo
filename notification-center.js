/* notification-center.js v28.28-nf */
(function(){
"use strict";
if(window.JADZ_NOTIFICATION_CENTER_LOADED)return;
window.JADZ_NOTIFICATION_CENTER_LOADED=true;

function removeBottomStatusBar(){
  const bar=document.getElementById("jadzGlobalStatusBar");
  if(bar)bar.remove();
}

document.addEventListener("DOMContentLoaded",removeBottomStatusBar);
setInterval(removeBottomStatusBar,2000);
})();
