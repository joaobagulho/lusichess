var express = require('express');
const { Chess } = require('chess.js');
const { Worker } = require("node:worker_threads");

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var clients = new Object();
var port = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});

http.listen(port, function () {
    console.log('listening on port: ' + port);
});

io.on('connection', function(socket){
    clients[socket.id] = new Chess();
    console.log(socket.id, ": connection");

    socket.on('disconnect', (reason)=>{
        console.log(socket.id, ": disconnected");
        delete clients[socket.id];
    });

    socket.on('move', function(msg){
        clients[socket.id].move(msg);
        
        if(clients[socket.id].isGameOver()){
            if(clients[socket.id].isCheckmate()){
                socket.emit('end', 'Checkmate');
            }else if(clients[socket.id].isDraw()){
                socket.emit('end', 'Draw');
            }else if(clients[socket.id].isInsufficientMaterial()){
                socket.emit('end', 'InsufficientMaterial');
            }else if(clients[socket.id].isStalemate()){
                socket.emit('end', 'StaleMate');
            }else if(clients[socket.id].isThreefoldRepetition()){
                socket.emit('end', 'ThreefoldRepetition');
            }
        }else{

            var job = new Worker("./chessbot.js", {workerData: [clients[socket.id].fen(), 'b']});

            job.on("message", (msg)=>{
                socket.emit('move', msg);
                clients[socket.id].move(msg.move);

                console.log(socket.id, ":", msg.stats);

                if(clients[socket.id].isGameOver()){
                    if(clients[socket.id].isCheckmate()){
                        socket.emit('end', 'Checkmate');
                    }else if(clients[socket.id].isDraw()){
                        socket.emit('end', 'Draw');
                    }else if(clients[socket.id].isInsufficientMaterial()){
                        socket.emit('end', 'InsufficientMaterial');
                    }else if(clients[socket.id].isStalemate()){
                        socket.emit('end', 'StaleMate');
                    }else if(clients[socket.id].isThreefoldRepetition()){
                        socket.emit('end', 'ThreefoldRepetition');
                    }
                }

                job.terminate();
            });
            delete job;
        }
    });
});
