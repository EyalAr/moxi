// this is a simple nodejs http & websockets server

// when a static file is requested, the server will look for it in the root
// by priority in the order they are specified.

// if non static routes are defined, they take presedence over any static file.

// http middleware can be mounted on http routes.
// websockets middleware can be mounted on channels.

(function(){

var express = require('express'),
    socketio = require('socket.io'),
    bodyParser = require('body-parser');

module.exports = MoxiServer;

function MoxiServer(){
    this.httpPort = null;
    this.httpsPort = null;
    this.wsPort = null;
    this.proxyProt = null;
    this.httpsCreds = null;
    this.allowedOrigin = null;
    this.hasRoots = false;
    this.hasHttpMiddleware = false;
    this.hasWsSubscribers = false;
    this.hasWsPublishers = false;
    this.httpApp = express();
    this.wsServer = socketio();

    this.httpApp.use(bodyParser.json());
    this.wsServer.serveClient(false);
}

MoxiServer.prototype.addRoot = function(path){
    this.hasRoots = true;
    this.httpApp.use(express.static(path));
};

MoxiServer.prototype.addHttpMiddleware = function(httpMethod, webPath, factoryPath, factoryParams){
    this.hasHttpMiddleware = true;
    var factory = require(factoryPath);
    this.httpApp[httpMethod](webPath, factory.apply(null, factoryParams || []));
};

MoxiServer.prototype.addWsSubscriber = function(wsChannel, factoryPath, factoryParams){
    this.hasWsSubscribers = true;
    this.wsServer.on('connection', function(socket){
        var factory = require(factoryPath);
        socket.on(wsChannel, factory.apply({
            socket: socket,
            channel: wsChannel
        }, factoryParams || []));
    });
};

MoxiServer.prototype.addWsPublisher = function(wsChannel, factoryPath, factoryParams){
    this.hasWsPublishers = true;
    this.wsServer.on('connection', function(socket){
        var factory = require(factoryPath);
        factory(function(data){
            socket.emit(wsChannel, data);
        });
    });
};

MoxiServer.prototype.setHttpPort = function(port){
    this.httpPort = port;
};

MoxiServer.prototype.setHttpsPort = function(port){
    this.httpsPort = port;
};

MoxiServer.prototype.setHttpsCreds = function(creds){
    this.httpsCreds = creds;
};

MoxiServer.prototype.setWsPort = function(port){
    this.wsPort = port;
};

MoxiServer.prototype.setProxyPort = function(port){
    this.proxyPort = port;
};

MoxiServer.prototype.setAllowedOrigin = function(origin){
    this.allowedOrigin = origin;
};

MoxiServer.prototype.run = function(){
    if (!(this.httpPort || this.wsPort))
        throw Error("Nothing to run, please set an HTTP port and/or ws port");
    if (this.httpPort){
        if (!this.hasHttpMiddleware || !this.hasRoots)
            throw Error("Nothing to run on HTTP server");
        require('http').createServer(this.httpApp).listen(this.httpPort);
    }
    if (this.httpsPort){
        if (!this.hasHttpMiddleware || !this.hasRoots)
            throw Error("Nothing to run on HTTPs server");
        require('https')
            .createServer(this.httpsCreds, this.httpApp)
            .listen(this.httpsPort);
    }
    if (this.wsPort){
        if (!this.hasWsSubscribers && !this.hasWsPublishers)
            throw Error("Nothing to run on WS server");
        this.wsServer.listen(this.wsPort);
    }
    if (this.proxyPort){
        var headers = {
            'access-control-allow-credentials': true
        };
        if(this.allowedOrigin)
            headers['access-control-allow-origin'] = this.allowedOrigin;
        require('cors-anywhere').createServer({
            //will create a https proxy if this.httpsCreds is set
            httpsOptions: this.httpsCreds,
            enforcedResponseHeaders: headers
        }).listen(this.proxyPort);
    }
};

})();
