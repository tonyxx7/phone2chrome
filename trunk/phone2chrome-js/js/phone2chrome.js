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

// First time
if (localStorage.getItem("deleteOld") == null) {
	setDeleteOld(true);
}

dropbox.init(a, b);

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
		dropbox.getFile(phone2chrome.path+"/pages", showPages.name);	  	
	  	
	} else {
		$("#msg").html("Link with your Dropbox account");
		$("#form").show();
		$("#signOut").hide();
		$("#signIn").show();
		chrome.tabs.create({url: "link.html"}); 
	}
 
}

function deleted(){
	console.log("deleted");
}

// Open pages in tabs
function showPages(data) {
	$("#msg").html("Opening tabs...");
	var pages = data.pages;
	var tabs=new Array();
	jQuery.each(pages, function(index, item){
	       	//console.log("Item "+index+" - "+item.title + ":" + item.url);
	       	if (isUrl(item.url)) {
		       	$("#items").append("<li>"+item.title+"</li>");
		        chrome.tabs.create({url: item.url})	        
		    } else {
		    	console.log("Not valid url");
		    	chrome.tabs.create({url: "textView.html"}, 
		    		function (tab) {
			    		chrome.tabs.sendRequest(tab.id, {title: item.title, body: item.url});
				});
		    }
	});
	
	if (getDeleteOld()) {
		dropbox.deleteItem(phone2chrome.path+"/pages", deleted.name);
		// Old version Linux compatibility
		//dropbox.deleteItem("Phone2Chrome/pages", null);	
		
		//
		//var path = chrome.extension.getURL('pages');
		//dropbox.uploadFile(phone2chrome.path, path, uploaded.name);
	}
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
	
	dropbox.login($("#email").val(), $("#password").val(), a, b);
	
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
