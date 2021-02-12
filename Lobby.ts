
import { User } from './types'

const ChessGameEngine = require('./ChessGameEngine')

class Lobby {
  
  io: any // TODO
  db: any // TODO
  lobbyCode: string
  users: User[]
  game: typeof ChessGameEngine


  constructor(io, db, lobbyCode) {
    this.io = io
    this.db = db
    this.lobbyCode = lobbyCode
    this.users = []
    this.game = new ChessGameEngine(this.sendMessageToAllUsers.bind(this))

    this.io.emit('test', 'hello world')
    console.log("Creating new lobby")
  }

  /*
   *  Creates an object to fully describe this objects state.
   */
  getLobbyInfo() {
    return {
      lobbyCode: this.lobbyCode,
      users: this.users ? this.users.map((u) => u.username) : [],
      gameInfo: this.game.getGameInfo(),
    }
  }

  /*
   *  Adds a user to a lobby.
   *  Will update all users in this lobby of the change.
   */
  addUserToLobby(username: string, socket) {
    if(!this.users) return
    this.users.push({ username, socket })
    socket.join(this.lobbyCode)
    socket.emit('joined-lobby', this.getLobbyInfo())
    this.sendMessageToAllUsers('lobby-updated', this.getLobbyInfo())
    socket.once('leave-lobby', () => {
      this.removeUserFromLobby(username)
    })

    this.game.setupSocketConnectionsForUser(socket)

  }

  removeUserFromLobby(username: string): boolean {
    if(!this.users) return false
    const user = this.users.find((u) => u.username === username)
    if (!user) return false
    user.socket.leave(this.lobbyCode)
    this.users = this.users.filter((u) => u.username !== username)
    this.sendMessageToAllUsers('lobby-updated', this.getLobbyInfo())
    return true
  }

  lobbySize(): number {
    return this.users.length
  }

  /*
   *  Will send the provided message to all users in this lobby, including the host.
   *  Requires:
   *  - command: string key matcher for socket io connection
   *  - message: the message to broadcast to all users.
   */
  sendMessageToAllUsers(command: string, message: any) {
    // Long method why arent rooms working
    if (this.users) console.log("USERS", this.users.map(u=>u.username))
    // if(this.users) this.users.forEach((user) => user.socket.emit(command, message))
    if (this.io) this.io.to(this.lobbyCode).emit(command, message)
  }

}

module.exports = Lobby