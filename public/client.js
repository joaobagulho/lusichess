import { Chess } from './lib/chess.js'

var board;
var game;
var socket = io();
var turn = 0;
var logel = document.getElementById("log");

function log(msg){
    logel.innerHTML += '<li>' + msg + '</li>';
    document.getElementById("turncount").innerHTML = ++turn;

    logel.scrollBy(0, logel.scrollHeight);
}

/*
 Always promote to a queen if possible
*/
let promotion = (target, piece)=>{
    if ((piece === 'wP') && (target[1] === '8')) {
        return 'q'
    }
    if ((piece === 'bP') && (target[1] === '1')) {
        return 'q'
    }
    return undefined;
}

/*
  Initialize a new game
  Improvements: 
  - Allow to play with black or white
  - Allow for a pre-defined games to be loaded

*/
var initGame = ()=>{

    // Only allow to move white parts
    const onDragStart = (source, piece, position, orientation)=>{
        return (piece.search(/^b/)=== -1)
    }

    var cfg = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: handleMove,
    };

    board = new ChessBoard('gameBoard', cfg);
    game = new Chess();
}

/*
  Handle a move and send it to the server if it is valid
*/
var handleMove = (source, target, piece)=>{
    var move = game.move({ from: source, to: target, promotion: promotion(target, piece) });
    if (move === null) return 'snapback';
    socket.emit('move', move);

    document.body.style.backgroundColor = "#f00";
    log('user: ' + move.san);
}

/*
  Receive a move from the server
*/
socket.on('move', (msg)=>{
    game.move(msg.move);
    board.position(game.fen());

    document.body.style.backgroundColor = "#0f0";
    log('bot: ' + msg.move + '<br><pre>' + JSON.stringify(msg.stats, null, 2) + '</pre>');
});

socket.on('end', (msg)=>{
    var who = "";
    if(msg == "Checkmate"){
        if(turn%2 == 0){
            who = ", you lose";
        }else{
            who = ", you win";
        }
    }
    logel.innerHTML += '<p>result: ' + msg+who + '</p>';
    logel.scrollBy(0, logel.scrollHeight);
    document.body.style.backgroundColor = "#000";
    alert(msg+who);
});

/*
  Start if all is loaded
*/
window.addEventListener('load', ()=>initGame());
