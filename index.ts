import { Board, BoardTiles, PieceType, Game, Coordinate, Color, Piece, Log } from './types';
const app = require('express')()
const MongoClient = require('mongodb').MongoClient
const http = require('http').createServer(app)
const io = require('socket.io')(http, {
  cors: {
    origin: "*"
  },
})


const LobbyList = require('./LobbyList')
const lobbyList = new LobbyList(io, undefined)
lobbyList.addNewLobby();

io.on('connection', (socket) => {

  socket.on('create-lobby', (username: string) => {
    const lobbyCode = lobbyList.addNewLobby()
    lobbyList.addUserToLobby(lobbyCode, username, socket)
  })

  socket.on('join-lobby', (msg) => {
    const lobbyCode = msg.lobbyCode
    const username = msg.username
    console.log(username,'wants to join lobby', lobbyCode)
    lobbyList.addUserToLobby(lobbyCode, username, socket)
  })

  socket.on('leave-lobby', (username: string) => {
    lobbyList.removeUserFromLobbies(username)
  })

})

const PORT = process.env.PORT || 5000
http.listen(PORT, () => console.log(`Listening on port ${PORT}`))

async function main() {
  const mongoUri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.bjjch.mongodb.net/<dbname>?retryWrites=true&w=majority`
  const mongo = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })

  try {
    await mongo.connect()
  } catch (e) {
    console.error(e);
  }

}

// main()