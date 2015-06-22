
var Controller = function(options)
{
	var self = this;
	this.screen = document.getElementById('telnet-screen');

	this.init = function(){
		self.terminal = new Terminal({telnetScreen: self.screen});
		self.terminal.input('head');
	}
	
	this.exec = function(command) {
		if (!command) {
			return false;
		}
		var command = command.split(' ');
		var name = command.shift();
		var actionName = 'action' + name[0].toUpperCase()+name.substring(1);
		console.log(actionName, command);
		try {
			if (typeof self[actionName]==='function') {
				self[actionName](command);
			} else {
				throw "unknow action: "+ name;
			}
		} catch(e) {
			self.actionError(e);
		}
	}
	
	this.actionError = function(e) {
		var msg = e.toString();
		self.terminal.output(msg, 'head');
	}
	
	this.actionHelp = function () {
		var msg = "命令可能是缩写。支持的命令为:\n\
			c    - close                    关闭当前连接\n\
			d    - display                  显示操作参数\n\
			o    - open hostname [port]     连接到主机(默认端口 23)。\n\
			q    - quit                     退出 telnet\n\
			set  - set                      设置选项(键入 'set ?' 获得列表)\n\
			sen  - send                     将字符串发送到服务器\n\
			st   - status                   打印状态信息\n\
			u    - unset                    解除设置选项(键入 'set ?' 获得列表)\n\
			?/h  - help                     打印帮助信息\n\
		";
		self.terminal.output(msg, 'head');
	}
	
	this.actionOpen = function(command) {
		self.terminal.input('body');
		options = {host:command[0], port:parseInt(command[1])};
		options.receiveCallback = function(msg) {
			self.terminal.output(msg, 'body');
		};
		self.socket = new Sockets(options);
		self.socket.init(function(){
			self.socket.connect(function(result){
				self.socket.info(function(info){
					var msg = 'Connected to '+ info.peerAddress +'.';
					self.terminal.output(msg, 'body');
					var msg = "Escape character is '^]'";
					self.terminal.output(msg, 'body');
				});
			});
		});
	}
}

var Terminal = function(options)
{
	var self = this;
	
	this.lastElement = null;
	this.screen = options.telnetScreen;
	
	this.init = function(){
		
	}
	
	this.createEle = function(type){
		if (self.lastElement) {
			self.lastElement.setAttribute('contenteditable', false);
		}
		
		var ele = document.createElement('div');
		ele.setAttribute('data-telnet', type);
		ele.setAttribute('contenteditable', true);
		self.bindEvent(ele);
		self.screen.appendChild(ele);
		ele.focus();
		
		self.lastElement = ele;
		return ele;
	}
	
	this.bindEvent = function(ele) {
		switch (ele.getAttribute('data-telnet'))
		{
			case 'head':
				ele.addEventListener('keypress', function(e){
					switch (e.keyCode) {
						case 13: // enter
							e.preventDefault();
							console.log('HEAD:' + e.target.innerText);
							controller.exec(e.target.innerText);
						break;
					}
				});
				break;
			case 'body':
				ele.addEventListener('keydown', function(e){
					switch (e.keyCode) {
						case 68: // ctrl+D
							if (e.ctrlKey) {
								e.preventDefault();
								console.log(ele.innerText);
								var msg = ele.innerText;
								controller.socket.send(msg, function(info){
									console.log("send: "+ encodeURI(msg), info);
								});
								controller.terminal.input('body');
							}
							break;
						case 13: // enter
							break;
							e.preventDefault();
							
							var msg = ele.innerText + "\r\n";
							controller.socket.send(msg, function(info){
								console.log("send: "+ encodeURI(msg), info);
							});
							controller.terminal.input('body');
							break;
					}
				});
				break;
		}
	}
	
	this.output = function(msg, type) {
		var body = self.createEle('body');
		body.innerText = msg;
		self.createEle(type);
	}
	
	this.input = function(type) {
		self.createEle(type);
	}
}


var Sockets = function(options)
{
	var self = this;
	
	this.socket = chrome.sockets.tcp;
	this.socketOptions = {"persistent":true};
	this.socketId = null;
	
	this.init = function(callback) {
		self.socket.onReceive.addListener(function(info){
			if (info.socketId !== self.socketId) {
				return ;
			}
			var msg = self.ab2str(info.data);
			self.receive(msg);
		});
		
		self.socket.create(self.socketOptions, function(param){
			self.socketId = param.socketId;
			callback();
		});
	}
	
	this.connect = function(callback) {
		self.socket.connect(self.socketId, options.host, options.port, callback);
	}
	
	this.send = function(msg, callback) {
		var arrayBuffer = self.str2ab(msg);
		self.socket.send(self.socketId, arrayBuffer, callback);
	}
	
	this.receive = function(msg) {
		options.receiveCallback(msg);
	}
	
	this.info = function(callback) {
		self.socket.getInfo(self.socketId, callback);
	}
	
	this.str2ab = function(str) {
		var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
		var bufView = new Uint8Array(buf);
		for (var i=0, strLen=str.length; i<strLen; i++) {
			bufView[i] = str.charCodeAt(i);
		}
		return buf;
    }
	
	this.ab2str = function (buf) {
		return String.fromCharCode.apply(null, new Uint8Array(buf));
	}
}

var controller = new Controller();
controller.init();