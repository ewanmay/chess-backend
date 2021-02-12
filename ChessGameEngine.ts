import { GameEngine, Board, BoardTiles, Game, Log, Color, Piece, PieceType, Coordinate } from './types'
const ChessPiece = require('./piece');

class ChessGameEngine implements GameEngine {

  board: Board
  game: Game
  log: Log
  sendMessageToAllUsers: (key:string, val:any) => void

  constructor(sendMessageToAllUsers: (key:string, val:any) => void) {
    this.sendMessageToAllUsers = sendMessageToAllUsers
    this.sendMessageToAllUsers('test', 'ChessGameEngine init')
    this.board = { tiles: [[]], vanguards: 0, whiteVanguards: 0, blackVanguards: 0 };
    this.game = { board: this.board, playersTurn: Color.White, inCheck: Color.Null, winner: Color.Null, stalemate: false, boardLength: 0, started: false, takenPieces: [] };
    this.log = { blackMoves: [], whiteMoves: [] };
    this.createGame();
    this.populateAvailableMoves();
    console.log("Game object constructed")
  }

  getGameInfo() {
    return {
      board: this.board,
      log: this.log
    }
  }

  populateAvailableMoves() {
    if (this.board.blackVanguards < this.board.vanguards || this.board.whiteVanguards < this.board.vanguards) {
      return;
    }

    this.board.tiles.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        const availableMoves = [];
        if (tile.piece.type != PieceType.Empty) {
          for (let i = 0; i < this.board.tiles.length; i++) {
            for (let j = 0; j < this.board.tiles.length; j++) {
              const testCoord: Coordinate = { row: i, col: j };
              if (ChessPiece.tryMove(this.board, testCoord, tile.piece)) {
                const newBoard: Board = JSON.parse(JSON.stringify(this.board));
                ChessPiece.makeMove(newBoard, testCoord, newBoard.tiles[rowIndex][colIndex].piece, () => { });
                newBoard.tiles.forEach((row) => {
                  row.forEach((tile) => {
                    const availableMoves = [];
                    for (let x = 0; x < newBoard.tiles.length; x++) {
                      for (let y = 0; y < newBoard.tiles.length; y++) {
                        const temp: Coordinate = { row: x, col: y }
                        if (ChessPiece.tryMove(newBoard, temp, tile.piece)) {
                          availableMoves.push(temp)
                        }
                      }
                    }                    
                    tile.spacesToMove = availableMoves;
                  })
                })

                const otherColor: Color = tile.piece.color === Color.White ? Color.Black : Color.White;
                if (!this.inCheck(otherColor, newBoard.tiles)) {
                  availableMoves.push(testCoord);
                }

              }
            }
          }
        }
        tile.spacesToMove = availableMoves;
      });
    })
  }

  // Pass in the color whos turn it is.
  inCheck(color: Color, tiles: BoardTiles[][]) {
    let opponentKing: Coordinate = null;
    // find king
    tiles.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        // TODO this is not performant, doesn't break loops after found. shouldn't use forEaches
        if (tile.piece.type === PieceType.King && tile.piece.color !== color && tile.piece.color !== Color.Null) {
          opponentKing = { row: rowIndex, col: colIndex };
        }
      })
    })

    // king gone
    if (opponentKing == null) {
      // game.winner = color; 
      return true;
    }

    let inCheck = false;
    tiles.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        if (tile.piece.color === color) {
          if (tile.spacesToMove.some(s => s.row === opponentKing.row && s.col === opponentKing.col)) {
            inCheck = true;
          }
        }
      })
    })

    return inCheck;
  }

  addTakenPiece(piece: Piece) {
    this.game.takenPieces.push(piece);
  }

  addLogMessage(msg: string, color: Color) {
    if (color === Color.Null) return 
    const log = color === Color.White ? this.log.whiteMoves : this.log.blackMoves
    log.push(msg)
    this.sendMessageToAllUsers('log-update', this.log)
  }

  setupSocketConnectionsForUser(socket){
    console.log("Setting up socket connection")
    //console.log('User Connected')
    let color: Color = Color.Null;
    socket.emit('make-game', this.game);

    socket.on('choose-team', (newColor: Color) => {
      //console.log('choosing team', newColor)
      color = newColor;
      console.log("Choosing team")
    });

    socket.on('start-game', () => {
      //console.log('starting game');
      this.game.started = true;
      this.sendMessageToAllUsers('vanguards-placed', false);
      this.sendMessageToAllUsers('game-update', this.game);
      this.sendMessageToAllUsers('log-update', this.log);
    });


    socket.on('quit-game', () => {
      //console.log('starting game');
      this.game.started = false;
      this.createGame();
      this.populateAvailableMoves();
      this.sendMessageToAllUsers('game-update', this.game);
      this.sendMessageToAllUsers('log-update', this.log);
    });

    socket.on('reset', (size: number) => {
      this.createGame(size);
      this.populateAvailableMoves();
      this.sendMessageToAllUsers('game-update', this.game);
      this.sendMessageToAllUsers('log-update', this.log);
    })


    socket.on('make-move', (msg) => {
      if (this.board.blackVanguards < this.board.vanguards || this.board.whiteVanguards < this.board.vanguards) {
        return;
      }

      const movingPieceCoord: Coordinate = msg.movingPieceCoord;
      const coordToMoveTo: Coordinate = msg.coordToMoveTo;
      const piece: Piece = this.board.tiles[movingPieceCoord.row][movingPieceCoord.col].piece;

      // Try move IF is players turn
      if ((this.game.playersTurn === piece.color) && ChessPiece.tryMove(this.game.board, coordToMoveTo, piece)) {
        ChessPiece.makeMove(this.game.board, coordToMoveTo, piece, this.addTakenPiece)
        //console.log("The pieces that moved", game.board.tiles[coordToMoveTo.row][coordToMoveTo.col].piece)

        this.board.tiles.forEach(row => row.forEach(tile => ChessPiece.moveMade(piece, tile.piece)));
        // Change player turn 
        const oldPlayer = this.game.playersTurn;
        this.game.playersTurn = (this.game.playersTurn === Color.White) ? Color.Black : Color.White

        this.populateAvailableMoves();
        if (this.inCheck(color, this.board.tiles)) {
          this.game.inCheck = this.game.playersTurn;
          let count = 0;
        }
        else {
          this.game.inCheck = Color.Null;
        }
        if (!this.board.tiles.some(row => row.some(tile => (tile.piece.color === this.game.playersTurn && tile.spacesToMove.length > 0)))) {
          if (this.game.inCheck) {
            // YOU LOST
            this.game.winner = oldPlayer;
          }
          else {
            // STALEMATE
            this.game.stalemate = true;
          }
        }

        // add message to log
        const alphabet = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"];

        let moveString = ""
        if (piece.type === PieceType.Knight) {
          moveString += "N"
        }
        else if (piece.type !== PieceType.Pawn) {
          moveString += piece.type.charAt(0).toUpperCase();
        }
        moveString += alphabet[coordToMoveTo.col];
        moveString += `${coordToMoveTo.row + 1}`;

        if (this.game.inCheck !== Color.Null) {
          moveString += "+";
        }

        this.addLogMessage(moveString, piece.color);


        this.sendMessageToAllUsers('game-update', this.game);
      }
    })

    socket.on('place-vanguard', (pos: Coordinate) => {

      const tile = this.board.tiles[pos.row][pos.col];
      if (color === Color.White && this.board.whiteVanguards < this.board.vanguards && tile.piece.color == Color.White && tile.piece.type == PieceType.Pawn) {
        this.board.whiteVanguards++;
        this.board.tiles[pos.row][pos.col] = { piece: new ChessPiece(Color.White, PieceType.Vanguard), spacesToMove: [] };
        ChessPiece.setCoordToPiece(pos, this.board.tiles[pos.row][pos.col].piece)
        this.populateAvailableMoves();
      }
      else if (color === Color.Black && this.board.blackVanguards < this.board.vanguards && tile.piece.color == Color.Black && tile.piece.type == PieceType.Pawn) {
        this.board.blackVanguards++;
        this.board.tiles[pos.row][pos.col] = { piece: new ChessPiece(Color.Black, PieceType.Vanguard), spacesToMove: [] };
        ChessPiece.setCoordToPiece(pos, this.board.tiles[pos.row][pos.col].piece)
        this.populateAvailableMoves();
      }

      this.sendMessageToAllUsers('game-update', this.game);

      // all vanguards placed
      if (this.board.blackVanguards >= this.board.vanguards && this.board.whiteVanguards >= this.board.vanguards) {
        this.sendMessageToAllUsers('vanguards-placed', true);
      }
    })
  }
  
  createGame(size: number = 8) {
    this.sendMessageToAllUsers('vanguards-placed', false);
    this.game.playersTurn = Color.White;
    this.game.winner = Color.Null;
    this.game.boardLength = size;
    this.game.stalemate = false;
    this.game.inCheck = Color.Null;
    this.game.takenPieces = [];
    this.board.whiteVanguards = 0;
    this.board.blackVanguards = 0;
    this.board.tiles = [[]];
    this.log.blackMoves = [];
    this.log.whiteMoves = [];

    switch (size) {
      case 8:
        this.board.vanguards = 2;
        this.board.tiles = [
          [{ piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] }],
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Black, PieceType.Pawn), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.White, PieceType.Pawn), spacesToMove: [] })),
          [{ piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] }]
        ];
        break;
      case 10:
        this.board.vanguards = 2;
        this.board.tiles = [
          [{ piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] }],
          new Array(10).fill(0).map(x => ({ piece: new ChessPiece(Color.Black, PieceType.Pawn), spacesToMove: [] })),
          new Array(10).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(10).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(10).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(10).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(10).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(10).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(10).fill(0).map(x => ({ piece: new ChessPiece(Color.White, PieceType.Pawn), spacesToMove: [] })),
          [{ piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] }]
        ];
        break;
      case 12:
        this.board.vanguards = 3;
        this.board.tiles = [
          [{ piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] }],
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.Black, PieceType.Pawn), spacesToMove: [] })),
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(12).fill(0).map(x => ({ piece: new ChessPiece(Color.White, PieceType.Pawn), spacesToMove: [] })),
          [{ piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] }]
        ];
        break;
      case 14:
        this.board.vanguards = 3;
        this.board.tiles = [
          [{ piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] }],
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Black, PieceType.Pawn), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(14).fill(0).map(x => ({ piece: new ChessPiece(Color.White, PieceType.Pawn), spacesToMove: [] })),
          [{ piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] }]
        ];
        break;
      case 16:
        this.board.vanguards = 4;
        this.board.tiles = [
          [{ piece: new ChessPiece(Color.Black, PieceType.Rook, { row: 0, col: 0 }), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook, { row: 0, col: 1 }), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight, { row: 0, col: 2 }), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight, { row: 0, col: 3 }), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop, { row: 0, col: 4 }), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] }],
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Black, PieceType.Pawn), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(16).fill(0).map(x => ({ piece: new ChessPiece(Color.White, PieceType.Pawn), spacesToMove: [] })),
          [{ piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] }]
        ];
        break;
      default:
        // return size 8 
        this.board.vanguards = 2;
        this.board.tiles = [
          [{ piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.Black, PieceType.Rook), spacesToMove: [] }],
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Black, PieceType.Pawn), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.Null, PieceType.Empty), spacesToMove: [] })),
          new Array(8).fill(0).map(x => ({ piece: new ChessPiece(Color.White, PieceType.Pawn), spacesToMove: [] })),
          [{ piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Queen), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.King), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Bishop), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Knight), spacesToMove: [] },
          { piece: new ChessPiece(Color.White, PieceType.Rook), spacesToMove: [] }]
        ];
    }

    this.board.tiles.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        ChessPiece.setCoordToPiece({ row: rowIndex, col: colIndex }, tile.piece)
      })
    })
  }
}

module.exports = ChessGameEngine