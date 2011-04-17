/*
 *  Dropbox Phone to Chrome Javascript App                                    *
 *  Copyright Luis Gonzalez 2010                                              *
 *	                                                                          *
 *  Requires Dropbox Javascript library v1.1 (included in source)             *
 *  	 																	  *
 *  Licensed under the Apache License, Version 2.0 (the "License");           *
 *  you may not use this file except in compliance with the License.          *
 *  You may obtain a copy of the License at                                   *
 *	                                                                          *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *	                                                                          *
 *  Unless required by applicable law or agreed to in writing, software       *
 *  distributed under the License is distributed on an "AS IS" BASIS,         *
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  *
 *  See the License for the specific language governing permissions and       *
 *  limitations under the License.                                            */


var phone2chrome = {};
phone2chrome.path = "phone2chrome"; //Path where 'pages' file should be.

var a = "ENTER_YOURS";
var b = "ENTER_YOURS";

var pollIntervalMin = 1000 * 60;  // 1 minute
var pollIntervalMax = 1000 * 60 * 60;  // 1 hour
var requestFailureCount = 0;  // used for exponential backoff
var requestTimeout = 1000 * 2;  // 5 seconds

// First time
// Opción para no abrir los ya visitados
if (localStorage.getItem("deleteOld") == null) {
	setDeleteOld(true);
}

// Opción para autoabrir enlaces a false por defecto
if (localStorage["autoOpen"] == null) {
	localStorage["autoOpen"] = false;
}

dropbox.init(a, b);
//startRequest();


// init
function loadHandler() {
	if (getDeleteOld()) {
		//FIXME: No way to get this done with jQuery :S
		document.getElementById("check_delete").checked = true;
	}
  	if (dropbox.isLoggedin()) {
	  	// show singout button
	  	$("#signOut").show();
	  	// hide signIn form and button
		$("#signIn").hide();
		$("#form").hide(); 
		// open pages in tabs
		// FIXME: 404 error when file not found
		$("#msg").html("No pending pages to open.");

		// En realidad el callback es innecesario. La llamada a 'showPages' está implicita en el fichero pages.
		dropbox.getFile(phone2chrome.path+"/pages", showPages.name);	  	
	  	
	} else {
		$("#msg").html("Link with your Dropbox account");
		$("#form").show();
		$("#signOut").hide();
		$("#signIn").show();
		chrome.tabs.create({url: "link.html"}); 
	}
 
}

function createTabs(pages) {
	var tabs=new Array();
	jQuery.each(pages, function(index, item){
	       	// Old versions compatibility
	       	if (item.date == null) {
	       		var d = new Date();
	       		item.date = d.getTime();
	       	}
	       	
	       	if (getDeleteOld() && item.date <= localStorage[item.url]) {
	       		//console.log("Already visited link: "+item.url);
	       	} else {
		       	//console.log("New visited link: "+item.url);
		       	localStorage[item.url] = item.date;
	       		if (isUrl(item.url)) {
	       			chrome.tabs.create({url: item.url})		        
	       		} else {
	       			chrome.tabs.create({url: "textView.html"}, 
	       				function (tab) {
	       		    		chrome.tabs.sendRequest(tab.id, {title: item.title, body: item.url});
	       			});
	       		}
		       	
	       	}
	});
	//scheduleRequest();
}

function updateLinksCount(pages) {
	var i=0;	
	jQuery.each(pages, function(index, item){
	       	// Old versions compatibility
	       	if (item.date == null) {
	       		var d = new Date();
	       		item.date = d.getTime();
	       	}
	       	
	       	if (getDeleteOld() && item.date <= localStorage[item.url]) {
	       		//console.log("Already visited link: "+item.url);
	       	} else {
		       	i++;
	       	}
	});
	if (i>0) {
		chrome.browserAction.setBadgeText({text:String(i)});
	} else {
		chrome.browserAction.setBadgeText({text:""});
	}
}


// Open pages in tabs
function showPages(data) {
	$("#msg").html("Opening tabs...");
	var pages = data.pages;
	var updateCount = localStorage["updateCount"];
	
	// Si estamos actualizando la lista de pendientes y no tenemos que abrirlos automáticamente
	if ((updateCount == 1) && (localStorage["autoOpen"] == "false")) {
		updateLinksCount(pages);
	} else { // Sino estamos abriendo para crear nuevos tabs
		createTabs(pages);
	}
	// Levanto el semaforo para permitir hacer peticiones
	localStorage["updateCount"] = 0;
}

function isUrl(url) {
	var regexp = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
	return regexp.test(url);
}

function doLogin() {
	$("#alts").hide();
	$("#form").hide();
	$("#error").hide();
	$("#info").html("Successfully linked with "+$("#email").val()+" Dropbox");
	$("#loader").show();
	
	dropbox.login(escape($("#email").val()), escape($("#password").val()), a, b);
	//console.log("ea");
	scheduleRequest();
}

// Logout deletes accessToken and accessTokenSecret
function doLogout() {
	$("#msg").html("Unlinking from Dropbox...");
	dropbox.logout();
	chrome.tabs.create({url: "unlink.html"})	 
}

function showOptions(){
	$("#optionsDiv").toggle();
}

function setDeleteOld(value) {
	localStorage.setItem("deleteOld", value);
}
function getDeleteOld() {
	return localStorage["deleteOld"] == "true";
}
function setAuto(value) {
	localStorage.setItem("autoOpen", value);
	if (value == "true") {
		setDeleteOld(true);
		scheduleRequest();
	} 
}

// Programa una petición "startRequest" para dentro de "delay" milisegundos
// Se lanza la primera vez desde background.html
function scheduleRequest() {
	var delay = 5000; // 5 secs.
	var randomness;
	var exponent;
		
	if (localStorage["autoOpen"] == "false") {
		randomness = Math.random() * 2;
		exponent = 1;//Math.pow(2, requestFailureCount);
		delay = Math.min(randomness * pollIntervalMin * exponent,
		                     pollIntervalMax);
		delay = Math.round(delay);		
	}
	
 	window.setTimeout(startRequest, delay);
}

// Hace una petición si no hay otra en curso. En cualquier caso programa la siguiente siempre
function startRequest() {
	// Si está levantado el semáforo no hago nuevas peticiones
	if (localStorage["updateCount"] == 0) {
		localStorage["updateCount"] = 1;
		// Al lanzar la petición levanta el semáforo "updateCount"
		dropbox.getFile(phone2chrome.path+"/pages", showPages.name);	
	} 
	scheduleRequest();
}

/** History functions **/
function listAllLinksItems(){  
    for (i=0; i<=localStorage.length-1; i++)  
    {  
        key = localStorage.key(i);  
         
        if (isUrl(key)) { 
	        $("#historyList").append(
	        	"<li>"+
	        	"<a href='"+key+"'>"+key+"</a>"+
	        	"</li>");
        }
    }  
}  

function clearAllLinksItems(){  
    for (i=0; i<=localStorage.length-1; i++)  
    {  
        key = localStorage.key(i);  
         
        if (isUrl(key)) { 
	        localStorage.removeItem(key);
        }
    } 
	$("#historyList").html("");
}  



